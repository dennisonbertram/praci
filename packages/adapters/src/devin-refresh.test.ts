import { readFileSync } from "node:fs";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DEVIN_MCP_ENDPOINT } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { describe, expect, it, vi } from "vitest";
import { createDevinCallTool } from "./devin-call-tool.js";
import { refreshDevinConnection, runDevinRefreshJob } from "./devin-refresh.js";

// Every fixture is synthetic: invented data in the documented format (issue #516 replaces them).
const fixture = (name: string) =>
  readFileSync(new URL(`./__fixtures__/devin/${name}`, import.meta.url), "utf8");
const errors = JSON.parse(fixture("errors.json")) as Record<string, string>;

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const T0 = new Date("2026-10-21T12:00:00Z");

type Row = Record<string, unknown> & { sessionId: string };
type State = Record<string, unknown> & { serverId: string };

/** In-memory stand-in for the four Prisma delegates the refresh uses. */
function fakeDb(
  opts: { states?: State[]; sessions?: Row[]; member?: boolean; revision?: number } = {},
) {
  const states = new Map<string, State>();
  for (const state of opts.states ?? [
    {
      serverId: "srv-1",
      spaceId: "space-1",
      version: 0,
      leaseToken: null,
      leaseUntil: null,
      lastSucceededAt: null,
      backoffUntil: null,
      backoffStep: 0,
      rejectedAt: null,
      lastError: null,
    },
  ]) {
    states.set(state.serverId, { ...state });
  }
  const sessions = new Map<string, Row>();
  for (const row of opts.sessions ?? []) sessions.set(`${row.serverId}/${row.sessionId}`, row);
  const db = {
    member: opts.member ?? true,
    revision: opts.revision ?? 1,
    inTransaction: false,
    states,
    sessions,
  };
  const matchState = (state: State, where: Record<string, unknown>, now = Date.now()) => {
    if (where.serverId !== undefined && state.serverId !== where.serverId) return false;
    if (where.version !== undefined && state.version !== where.version) return false;
    if (where.leaseToken !== undefined && state.leaseToken !== where.leaseToken) return false;
    if (where.OR) {
      const until = state.leaseUntil as Date | null;
      if (until && until.getTime() >= now) return false;
    }
    return true;
  };
  const prisma = {
    devinConnectionState: {
      findUnique: vi.fn(async ({ where }: { where: { serverId: string } }) => {
        const state = states.get(where.serverId);
        return state
          ? { ...state, server: { spaceId: "space-1", userId: "user-1", revision: db.revision } }
          : null;
      }),
      findMany: vi.fn(async () => [...states.values()].filter((s) => !s.rejectedAt)),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: Record<string, unknown>;
          data: Record<string, unknown>;
        }) => {
          const hits = [...states.values()].filter((s) => matchState(s, where, T0.getTime()));
          for (const state of hits) {
            for (const [key, value] of Object.entries(data)) {
              const inc = (value as { increment?: number } | null)?.increment;
              state[key] = inc === undefined ? value : (state[key] as number) + inc;
            }
          }
          return { count: hits.length };
        },
      ),
    },
    spaceMember: { findFirst: vi.fn(async () => (db.member ? { id: "m" } : null)) },
    // The commit's `SELECT 1 FROM mcp_servers ... revision = ${revision} FOR SHARE`.
    $queryRaw: vi.fn(async (_strings: unknown, _id: string, revision: number) =>
      revision === db.revision ? [{}] : [],
    ),
    devinSession: {
      findMany: vi.fn(async () => [...sessions.values()]),
      upsert: vi.fn(
        async ({
          where,
          create,
          update,
        }: {
          where: { serverId_sessionId: { serverId: string; sessionId: string } };
          create: Row;
          update: Record<string, unknown>;
        }) => {
          const key = `${where.serverId_sessionId.serverId}/${where.serverId_sessionId.sessionId}`;
          const existing = sessions.get(key);
          sessions.set(key, existing ? { ...existing, ...update } : create);
        },
      ),
      deleteMany: vi.fn(
        async ({ where }: { where: { serverId: string; lastSeenAt: { lt: Date } } }) => {
          for (const [key, row] of sessions) {
            if (row.serverId === where.serverId && (row.lastSeenAt as Date) < where.lastSeenAt.lt)
              sessions.delete(key);
          }
        },
      ),
    },
    $transaction: vi.fn(async (run: (tx: unknown) => unknown) => {
      db.inTransaction = true;
      try {
        return await run(prisma);
      } finally {
        db.inTransaction = false;
      }
    }),
  };
  return { db, prisma: prisma as unknown as PrismaClient };
}

type Call = { name: string; args: Record<string, unknown> };

/** A fake Devin: the synthetic search pages and message list, with per-test overrides. */
function fakeDevin(
  handlers: { search?: (args: Record<string, unknown>) => string; messages?: () => string } = {},
) {
  const calls: Call[] = [];
  const callTool = vi.fn(async (_id: string, name: string, args: Record<string, unknown>) => {
    calls.push({ name, args });
    if (name === "devin_session_search") {
      return handlers.search
        ? handlers.search(args)
        : fixture(args.after ? "search-page-2.txt" : "search-page-1.txt");
    }
    return handlers.messages ? handlers.messages() : fixture("messages-waiting.txt");
  });
  const messageCalls = () => calls.filter((c) => c.name === "devin_session_interact");
  const searchCalls = () => calls.filter((c) => c.name === "devin_session_search");
  return { callTool, calls, messageCalls, searchCalls };
}

const line = (id: string, status: string, updated = 1760003600, extra = "") =>
  `- id=${id} title="Session ${id}" status=${status} created_at=1759000000 updated_at=${updated} origin=api${extra}\n`;

const refresh = (fake: ReturnType<typeof fakeDb>, devin: ReturnType<typeof fakeDevin>, now = T0) =>
  refreshDevinConnection(
    { prisma: fake.prisma, callTool: devin.callTool, now: () => now },
    "srv-1",
  );

describe("refreshDevinConnection", () => {
  it("in the first successful refresh stores a waiting session with its real message id, already notified", async () => {
    const fake = fakeDb();
    const devin = fakeDevin();
    expect(await refresh(fake, devin)).toBe("refreshed");

    const row = fake.db.sessions.get("srv-1/devin-0001");
    expect(row).toMatchObject({
      kind: "needs_you",
      question: "Which environment should I test against?\nStaging or production?",
      lastMessageId: "ev-103",
      notifiedMessageId: "ev-103",
      spaceId: "space-1",
    });
    expect(devin.messageCalls()).toHaveLength(1);
    expect(fake.db.sessions.size).toBe(5);
    expect(fake.db.states.get("srv-1")).toMatchObject({
      lastError: null,
      complete: true,
      skipped: 0,
      leaseToken: null,
    });
    expect(fake.db.states.get("srv-1")?.lastSucceededAt).toEqual(T0);
  });

  it("after the first refresh, a session first seen already waiting is read once and left unnotified", async () => {
    const fake = fakeDb();
    fake.db.states.get("srv-1")!.lastSucceededAt = new Date(T0.getTime() - MIN);
    const devin = fakeDevin();
    await refresh(fake, devin);
    expect(fake.db.sessions.get("srv-1/devin-0001")).toMatchObject({
      question: expect.stringContaining("Which environment"),
      lastMessageId: "ev-103",
      notifiedMessageId: null,
    });
    expect(devin.messageCalls()).toHaveLength(1);
  });

  it("an unchanged waiting session fetches no messages in two further runs", async () => {
    const fake = fakeDb();
    await refresh(fake, fakeDevin());
    const again = fakeDevin();
    await refresh(fake, again, new Date(T0.getTime() + 2 * MIN));
    await refresh(fake, again, new Date(T0.getTime() + 4 * MIN));
    expect(again.messageCalls()).toHaveLength(0);
    expect(fake.db.sessions.get("srv-1/devin-0001")?.notifiedMessageId).toBe("ev-103");
  });

  it("a session turning needs_you fetches messages once and keeps the earlier notified id", async () => {
    const fake = fakeDb();
    await refresh(fake, fakeDevin({ search: () => line("a-1", "running", 100) }));
    const turn = fakeDevin({ search: () => line("a-1", "blocked", 200) });
    await refresh(fake, turn, new Date(T0.getTime() + 2 * MIN));
    await refresh(fake, turn, new Date(T0.getTime() + 4 * MIN));
    expect(turn.messageCalls()).toHaveLength(1);
    expect(fake.db.sessions.get("srv-1/a-1")).toMatchObject({
      kind: "needs_you",
      lastMessageId: "ev-103",
      notifiedMessageId: null,
    });
  });

  it("cuts a stored question to 500 characters", async () => {
    const fake = fakeDb();
    const long = `- event_id=ev-9 source=devin created_at=1 body="${"x".repeat(700)}"\n`;
    await refresh(fake, fakeDevin({ messages: () => long }));
    expect((fake.db.sessions.get("srv-1/devin-0001")?.question as string).length).toBe(500);
  });

  it("commits the first page when the second page fails, marks the listing incomplete and deletes nothing", async () => {
    const stale = {
      serverId: "srv-1",
      sessionId: "old",
      kind: "finished",
      lastSeenAt: new Date(T0.getTime() - 30 * DAY),
    };
    const fake = fakeDb({ sessions: [stale] });
    const devin = fakeDevin({
      search: (args) => {
        if (args.after) throw new Error("boom");
        return fixture("search-page-1.txt");
      },
    });
    expect(await refresh(fake, devin)).toBe("refreshed");
    expect(fake.db.states.get("srv-1")).toMatchObject({ complete: false, lastError: null });
    expect(fake.db.sessions.has("srv-1/devin-0001")).toBe(true);
    expect(fake.db.sessions.has("srv-1/devin-0004")).toBe(false);
    expect(fake.db.sessions.has("srv-1/old")).toBe(true);
  });

  it("deletes nothing when lines were skipped, even from a complete listing", async () => {
    const stale = {
      serverId: "srv-1",
      sessionId: "old",
      lastSeenAt: new Date(T0.getTime() - 30 * DAY),
    };
    const fake = fakeDb({ sessions: [stale] });
    await refresh(fake, fakeDevin({ search: () => `${line("a-1", "running")}- not a line\n` }));
    expect(fake.db.states.get("srv-1")).toMatchObject({ complete: true, skipped: 1 });
    expect(fake.db.sessions.has("srv-1/old")).toBe(true);
  });

  it("after a complete listing deletes rows unseen for 7 days and keeps a row unseen for 1 day", async () => {
    const fake = fakeDb({
      sessions: [
        { serverId: "srv-1", sessionId: "week", lastSeenAt: new Date(T0.getTime() - 8 * DAY) },
        { serverId: "srv-1", sessionId: "day", lastSeenAt: new Date(T0.getTime() - DAY) },
      ],
    });
    await refresh(fake, fakeDevin({ search: () => line("a-1", "running") }));
    expect([...fake.db.sessions.keys()].sort()).toEqual(["srv-1/a-1", "srv-1/day"]);
  });

  it("repeated incomplete refreshes across 8 days delete nothing", async () => {
    const fake = fakeDb({
      sessions: [{ serverId: "srv-1", sessionId: "old", lastSeenAt: T0 }],
    });
    const failing = fakeDevin({
      search: (args) => {
        if (args.after) throw new Error("boom");
        return fixture("search-page-1.txt");
      },
    });
    for (let day = 0; day <= 8; day += 1) {
      await refresh(fake, failing, new Date(T0.getTime() + day * DAY));
    }
    expect(fake.db.sessions.has("srv-1/old")).toBe(true);
  });

  it("a 401 and a listing 403 reject the connection and the next run skips it", async () => {
    for (const status of ["401", "403"]) {
      const fake = fakeDb();
      const devin = fakeDevin({
        search: () => {
          throw new Error(errors[status]);
        },
      });
      expect(await refresh(fake, devin)).toBe("failed");
      expect(fake.db.states.get("srv-1")).toMatchObject({ lastError: "rejected" });
      expect(fake.db.states.get("srv-1")?.rejectedAt).toEqual(T0);
      const next = fakeDevin();
      expect(await refresh(fake, next, new Date(T0.getTime() + DAY))).toBe("skipped");
      expect(next.calls).toHaveLength(0);
    }
  });

  it("a 403 on one session leaves the connection healthy and the question null", async () => {
    const fake = fakeDb();
    const devin = fakeDevin({
      messages: () => {
        throw new Error(errors["403"]);
      },
    });
    expect(await refresh(fake, devin)).toBe("refreshed");
    expect(fake.db.states.get("srv-1")).toMatchObject({ lastError: null, rejectedAt: null });
    expect(fake.db.sessions.get("srv-1/devin-0001")?.question).toBeNull();
  });

  it("backs off 10, 20, then 40 minutes on 429 and 5 minutes on a timeout", async () => {
    const fake = fakeDb();
    const limited = fakeDevin({
      search: () => {
        throw new Error(errors["429"]);
      },
    });
    let now = T0;
    for (const minutes of [10, 20, 40]) {
      expect(await refresh(fake, limited, now)).toBe("failed");
      const state = fake.db.states.get("srv-1");
      expect(state?.lastError).toBe("rate_limited");
      expect((state?.backoffUntil as Date).getTime() - now.getTime()).toBe(minutes * MIN);
      // Inside the backoff window nothing is read.
      const calls = limited.calls.length;
      expect(await refresh(fake, limited, new Date(now.getTime() + MIN))).toBe("skipped");
      expect(limited.calls).toHaveLength(calls);
      now = new Date(now.getTime() + minutes * MIN + 1);
    }

    const timeout = fakeDb();
    const slow = fakeDevin({
      search: () => {
        throw new Error("The operation was aborted due to timeout");
      },
    });
    await refresh(timeout, slow);
    const state = timeout.db.states.get("srv-1");
    expect(state?.lastError).toBe("unreachable");
    expect((state?.backoffUntil as Date).getTime() - T0.getTime()).toBe(5 * MIN);
  });

  it("a 401 or 429 on a later page fails the run like one on the first page", async () => {
    for (const [status, lastError] of [
      ["401", "rejected"],
      ["429", "rate_limited"],
    ] as const) {
      const fake = fakeDb();
      const devin = fakeDevin({
        search: (args) => {
          if (args.after) throw new Error(errors[status]);
          return fixture("search-page-1.txt");
        },
      });
      expect(await refresh(fake, devin)).toBe("failed");
      expect(fake.db.states.get("srv-1")).toMatchObject({ lastError, lastSucceededAt: null });
      expect(fake.db.sessions.size).toBe(0);
    }
  });

  it("a connector who left the space is marked connector_gone and nothing is listed", async () => {
    const fake = fakeDb({ member: false });
    const devin = fakeDevin();
    expect(await refresh(fake, devin)).toBe("connector_gone");
    expect(fake.db.states.get("srv-1")?.lastError).toBe("connector_gone");
    expect(devin.calls).toHaveLength(0);
  });

  it("recording connector_gone drops a lease held by an in-flight refresh", async () => {
    const fake = fakeDb({ member: false });
    Object.assign(fake.db.states.get("srv-1")!, { leaseToken: "inflight", leaseUntil: T0 });
    await refresh(fake, fakeDevin());
    expect(fake.db.states.get("srv-1")?.leaseToken).toBeNull();
  });

  it("treats an isError result as a failure, not an empty list", async () => {
    const fake = fakeDb();
    const result: CallToolResult = JSON.parse(fixture("is-error.json"));
    const callTool = createDevinCallTool(
      {
        mcpServer: {
          findUnique: vi.fn(async () => ({
            id: "srv-1",
            spaceId: "space-1",
            userId: "user-1",
            enabled: true,
            endpoint: DEVIN_MCP_ENDPOINT,
          })),
        },
      } as unknown as Pick<PrismaClient, "mcpServer">,
      { callServerTool: vi.fn(async () => result) },
    );
    const outcome = await refreshDevinConnection(
      { prisma: fake.prisma, callTool, now: () => T0 },
      "srv-1",
    );
    expect(outcome).toBe("failed");
    expect(fake.db.states.get("srv-1")).toMatchObject({ lastError: "unreachable" });
    expect(fake.db.states.get("srv-1")?.lastSucceededAt).toBeNull();
    expect(fake.db.sessions.size).toBe(0);
  });

  it("holds no transaction open while the caller awaits", async () => {
    const fake = fakeDb();
    const devin = fakeDevin();
    const open: boolean[] = [];
    const callTool = vi.fn(async (...args: Parameters<typeof devin.callTool>) => {
      open.push(fake.db.inTransaction);
      return devin.callTool(...args);
    });
    await refreshDevinConnection({ prisma: fake.prisma, callTool, now: () => T0 }, "srv-1");
    expect(open.length).toBeGreaterThan(2);
    expect(open.every((value) => !value)).toBe(true);
  });

  it("while another process holds the lease reads and writes nothing", async () => {
    const fake = fakeDb();
    fake.db.states.get("srv-1")!.leaseUntil = new Date(T0.getTime() + MIN);
    fake.db.states.get("srv-1")!.leaseToken = "other";
    const devin = fakeDevin();
    expect(await refresh(fake, devin)).toBe("busy");
    expect(devin.calls).toHaveLength(0);
    expect(fake.db.sessions.size).toBe(0);
    expect(fake.db.states.get("srv-1")?.leaseToken).toBe("other");
  });

  it("discards the results when the server revision changed during the run", async () => {
    const fake = fakeDb();
    const devin = fakeDevin();
    const callTool = vi.fn(async (...args: Parameters<typeof devin.callTool>) => {
      fake.db.revision = 2;
      return devin.callTool(...args);
    });
    expect(
      await refreshDevinConnection({ prisma: fake.prisma, callTool, now: () => T0 }, "srv-1"),
    ).toBe("discarded");
    expect(fake.db.sessions.size).toBe(0);
    expect(fake.db.states.get("srv-1")).toMatchObject({ lastSucceededAt: null, leaseToken: null });
  });

  it("discards the results when a newer holder took the lease", async () => {
    const fake = fakeDb();
    const devin = fakeDevin();
    const callTool = vi.fn(async (...args: Parameters<typeof devin.callTool>) => {
      const state = fake.db.states.get("srv-1")!;
      state.leaseToken = "newer";
      state.version = (state.version as number) + 1;
      return devin.callTool(...args);
    });
    expect(
      await refreshDevinConnection({ prisma: fake.prisma, callTool, now: () => T0 }, "srv-1"),
    ).toBe("discarded");
    expect(fake.db.sessions.size).toBe(0);
    expect(fake.db.states.get("srv-1")?.leaseToken).toBe("newer");
  });
});

describe("runDevinRefreshJob", () => {
  const second = {
    serverId: "srv-2",
    spaceId: "space-2",
    version: 0,
    leaseToken: null,
    leaseUntil: null,
    lastSucceededAt: null,
    backoffUntil: null,
    backoffStep: 0,
    rejectedAt: null,
    lastError: null,
  };
  const states = (): State[] => [{ ...second, serverId: "srv-1", spaceId: "space-1" }, second];

  it("with no payload refreshes every candidate server, skipping rejected ones", async () => {
    const fake = fakeDb({
      states: [...states(), { ...second, serverId: "srv-3", rejectedAt: T0 }],
    });
    const devin = fakeDevin({ search: () => "" });
    await runDevinRefreshJob({ prisma: fake.prisma, callTool: devin.callTool, now: () => T0 }, {});
    const servers = devin.callTool.mock.calls.map((call) => call[0]);
    expect(new Set(servers)).toEqual(new Set(["srv-1", "srv-2"]));
  });

  it("with a payload refreshes only the named server", async () => {
    const fake = fakeDb({ states: states() });
    const devin = fakeDevin({ search: () => "" });
    await runDevinRefreshJob(
      { prisma: fake.prisma, callTool: devin.callTool, now: () => T0 },
      { serverId: "srv-2" },
    );
    expect(new Set(devin.callTool.mock.calls.map((call) => call[0]))).toEqual(new Set(["srv-2"]));
  });
});
