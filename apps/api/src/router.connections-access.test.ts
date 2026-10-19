import { RPCHandler } from "@orpc/server/fetch";
import type { Actor } from "@rakazo/contracts";
import { integrationAgentSpawnKey } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { describe, expect, it, vi } from "vitest";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

type Row = Record<string, unknown>;
const owner: Actor = {
  spaceId: "s1",
  userId: "u1",
  email: "a@rakazo.test",
  isDeploymentOwner: true,
};
const stranger: Actor = { ...owner, userId: "u2" };

function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, want]) => {
    if (want && typeof want === "object" && "in" in want)
      return (want as { in: unknown[] }).in.includes(row[key]);
    if (want && typeof want === "object" && "not" in want)
      return row[key] !== (want as { not: unknown }).not;
    return row[key] === want;
  });
}

const conn = (id: string, status: string, extra: Row = {}): Row => ({
  id,
  spaceId: "s1",
  userId: "u1",
  connectorId: "composio",
  provider: "slack",
  displayName: id,
  status,
  allAgents: true,
  agentBotId: null,
  createdAt: new Date("2026-10-01T00:00:00Z"),
  ...extra,
});

function harness(connections: Row[], bots: Row[], access: Row[] = []) {
  const client = {
    connection: {
      findMany: vi.fn(async ({ where }: { where: Row }) => {
        return connections
          .filter((r) => matches(r, where))
          .map((r) => ({ ...r, botAccess: access.filter((a) => a.connectionId === r.id) }));
      }),
      findFirst: vi.fn(async ({ where }: { where: Row }) => {
        const row = connections.find((r) => matches(r, where));
        if (!row) return null;
        return {
          ...row,
          botAccess: access.filter((a) => a.connectionId === row.id && a.userId === where.userId),
        };
      }),
      update: vi.fn(async ({ where, data }: { where: Row; data: Row }) =>
        Object.assign(connections.find((r) => matches(r, where)) as Row, data),
      ),
      updateMany: vi.fn(async ({ where, data }: { where: Row; data: Row }) => {
        const rows = connections.filter((r) => matches(r, where));
        for (const row of rows) Object.assign(row, data);
        return { count: rows.length };
      }),
      create: vi.fn(async ({ data }: { data: Row }) => {
        const row = { ...conn(`new${connections.length}`, "pending"), ...data };
        connections.push(row);
        return row;
      }),
    },
    $executeRaw: vi.fn(async () => 0),
    bot: {
      findMany: vi.fn(async ({ where }: { where: Row }) => {
        const { archivedAt: _archived, ...scope } = where;
        return bots
          .filter((r) => matches(r, scope) && (r.archivedAt ?? null) === null)
          .map((r) => ({ id: r.id, spawnKey: r.spawnKey ?? null, archivedAt: null }));
      }),
      count: vi.fn(
        async ({ where }: { where: Row }) => bots.filter((r) => matches(r, where)).length,
      ),
      updateMany: vi.fn(async ({ where }: { where: Row }) => ({
        count: bots.filter((r) => matches(r, where)).length,
      })),
    },
    botConnectionAccess: {
      deleteMany: vi.fn(async ({ where }: { where: Row }) => {
        for (let i = access.length - 1; i >= 0; i--)
          if (matches(access[i] as Row, where)) access.splice(i, 1);
      }),
      createMany: vi.fn(async ({ data }: { data: Row[] }) => void access.push(...data)),
    },
  };
  const prisma = {
    ...client,
    $transaction: vi.fn(async (fn: (tx: typeof client) => Promise<unknown>) => fn(client)),
  };
  const deps = {
    prisma: prisma as unknown as PrismaClient,
    connectors: {
      managed: vi.fn(() => ({
        begin: vi.fn(async () => ({ authorizationUrl: "https://x.test", state: "st" })),
      })),
    },
    env: { webOrigin: "http://localhost" },
  } as unknown as RouterDeps;
  const handler = new RPCHandler(createRouter(deps));
  async function call(path: string, input: unknown, actor: Actor = owner) {
    const { response } = await handler.handle(
      new Request(`http://127.0.0.1/rpc/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ json: input }),
      }),
      { prefix: "/rpc", context: { actor } },
    );
    const body = JSON.parse(await response!.text());
    return { status: response!.status, json: body.json };
  }
  return { call, access, connections };
}

const bot = (id: string, userId = "u1", extra: Row = {}): Row => ({
  id,
  spaceId: "s1",
  userId,
  ...extra,
});

describe("connections.list", () => {
  it("returns connected, pending and error rows with a reason, never revoked", async () => {
    const h = harness(
      [conn("a", "connected"), conn("b", "pending"), conn("c", "error"), conn("d", "revoked")],
      [],
    );
    const { json } = await h.call("connections/list", undefined);
    expect(json.map((r: Row) => [r.id, r.status, r.error])).toEqual([
      ["a", "connected", null],
      ["b", "pending", null],
      ["c", "error", expect.any(String)],
    ]);
  });

  it("marks a mail account whose sign-in the provider refused, as the Inbox does", async () => {
    const lapsed = { needsReconnect: true, lastErrorAt: new Date() };
    const h = harness(
      [
        conn("a", "connected", { mailSyncState: lapsed }),
        conn("b", "connected", { mailSyncState: { needsReconnect: true, lastErrorAt: null } }),
        conn("c", "connected"),
      ],
      [],
    );
    const { json } = await h.call("connections/list", undefined);
    expect(json.map((r: Row) => [r.id, r.needsReconnect])).toEqual([
      ["a", true],
      ["b", undefined],
      ["c", undefined],
    ]);
  });

  it("does not list another user's rows", async () => {
    const h = harness([conn("a", "connected")], []);
    expect((await h.call("connections/list", undefined, stranger)).json).toEqual([]);
  });
});

describe("connections.access and setAccess", () => {
  it("defaults to all agents with no bot list", async () => {
    const h = harness([conn("a", "connected")], []);
    expect((await h.call("connections/access", { connectionId: "a" })).json).toEqual({
      allAgents: true,
      botIds: [],
    });
  });

  it("reports the bots that can really use a connection, within the caller's own bots", async () => {
    const h = harness(
      [
        conn("a", "connected"),
        conn("b", "connected", { allAgents: false, provider: "github" }),
        conn("p", "pending", { provider: "notion" }),
        conn("own", "connected", {
          connectorId: "google",
          provider: "gmail",
          allAgents: false,
          agentBotId: "agent",
        }),
        conn("sibling", "connected", { connectorId: "google", provider: "gmail" }),
        conn("cl", "connected", { provider: "linear", allAgents: false, agentBotId: "agent" }),
        conn("cs", "connected", { provider: "linear" }),
      ],
      [
        bot("b1"),
        bot("b2", "u1", { archivedAt: new Date() }),
        bot("theirs", "u2"),
        bot("agent", "u1", { spawnKey: integrationAgentSpawnKey("cl") }),
      ],
      [{ connectionId: "cl", botId: "agent", userId: "u1", spaceId: "s1" }],
    );
    const all = (await h.call("connections/effectiveAccess", undefined)).json;
    const effective = async (connectionId: string) => all[connectionId];
    // Shared row: every active bot of this user, not archived or another user's; not the linked agent.
    expect(await effective("a")).toEqual({ shared: "all", botIds: ["b1"] });
    // Restricted with no grants, and a pending row, have no users.
    expect(await effective("b")).toEqual({ shared: "none", botIds: [] });
    expect(await effective("p")).toEqual({ shared: "none", botIds: [] });
    // A linked Google account does not deny its shared sibling; an integration agent has no mail.
    expect(await effective("own")).toEqual({ shared: "none", botIds: [] });
    expect(await effective("sibling")).toEqual({ shared: "all", botIds: ["b1"] });
    // Composio keeps the app-wide rule: the exclusive linked account hides its shared sibling.
    expect(await effective("cl")).toEqual({ shared: "some", botIds: ["agent"] });
    expect(await effective("cs")).toEqual({ shared: "none", botIds: [] });
    // Another user sees none of these connections or bots.
    expect((await h.call("connections/effectiveAccess", undefined, stranger)).json).toEqual({});
    expect(
      (await h.call("connections/access", { connectionId: "a" }, stranger)).status,
    ).toBeGreaterThanOrEqual(400);
  });

  it("round-trips a restricted list", async () => {
    const h = harness([conn("a", "connected")], [bot("b1"), bot("b2")]);
    const set = await h.call("connections/setAccess", {
      connectionId: "a",
      allAgents: false,
      botIds: ["b1", "b2", "b1"],
    });
    expect(set.json).toEqual({ allAgents: false, botIds: ["b1", "b2"] });
    expect((await h.call("connections/access", { connectionId: "a" })).json).toEqual(set.json);
    const reset = await h.call("connections/setAccess", {
      connectionId: "a",
      allAgents: true,
      botIds: [],
    });
    expect(reset.json).toEqual({ allAgents: true, botIds: [] });
  });

  it("rejects another user's connection and another user's bot", async () => {
    const h = harness([conn("a", "connected")], [bot("theirs", "u2")]);
    expect(
      (await h.call("connections/access", { connectionId: "a" }, stranger)).status,
    ).toBeGreaterThanOrEqual(400);
    expect(
      (
        await h.call(
          "connections/setAccess",
          { connectionId: "a", allAgents: false, botIds: [] },
          stranger,
        )
      ).status,
    ).toBeGreaterThanOrEqual(400);
    const withForeignBot = await h.call("connections/setAccess", {
      connectionId: "a",
      allAgents: false,
      botIds: ["theirs"],
    });
    expect(withForeignBot.status).toBeGreaterThanOrEqual(400);
    expect(h.connections[0]?.allAgents).toBe(true);
    expect(h.access).toEqual([]);
  });

  it("fans out ordinary access to matching accounts and leaves other apps alone", async () => {
    const h = harness(
      [
        conn("a", "connected"),
        conn("b", "connected"),
        conn("c", "connected", { provider: "github" }),
        conn("d", "connected", { allAgents: false, agentBotId: "linked-agent" }),
      ],
      [bot("b1"), bot("linked-agent")],
      [{ connectionId: "d", botId: "linked-agent", userId: "u1", spaceId: "s1" }],
    );
    await h.call("connections/setAccess", { connectionId: "a", allAgents: false, botIds: ["b1"] });
    expect(h.connections.map((r) => [r.id, r.allAgents])).toEqual([
      ["a", false],
      ["b", false],
      ["c", true],
      ["d", false],
    ]);
    expect(h.access.map((r) => [r.connectionId, r.botId])).toEqual([
      ["d", "linked-agent"],
      ["a", "b1"],
      ["b", "b1"],
    ]);
  });

  it("does not let setAccess grant other bots on an exclusive agent connection", async () => {
    const h = harness(
      [conn("a", "connected", { allAgents: false, agentBotId: "agent" })],
      [
        bot("agent", "u1", {
          spawnKey: integrationAgentSpawnKey("a"),
          archivedAt: null,
        }),
        bot("other"),
      ],
      [{ connectionId: "a", botId: "agent", userId: "u1", spaceId: "s1" }],
    );

    const result = await h.call("connections/setAccess", {
      connectionId: "a",
      allAgents: false,
      botIds: ["agent", "other"],
    });

    expect(result.status).toBeGreaterThanOrEqual(400);
    expect(h.connections[0]).toMatchObject({ allAgents: false, agentBotId: "agent" });
    expect(h.access).toEqual([{ connectionId: "a", botId: "agent", userId: "u1", spaceId: "s1" }]);
  });

  it("gives a new account the ordinary app setting without inheriting a linked sibling", async () => {
    const h = harness(
      [
        conn("a", "connected", { allAgents: false }),
        conn("linked", "connected", { allAgents: false, agentBotId: "linked-agent" }),
      ],
      [bot("b1"), bot("linked-agent")],
      [
        { connectionId: "a", botId: "b1", userId: "u1", spaceId: "s1" },
        { connectionId: "linked", botId: "linked-agent", userId: "u1", spaceId: "s1" },
      ],
    );
    await h.call("connections/begin", {
      connectorId: "composio",
      provider: "slack",
      displayName: "Second",
    });
    const created = h.connections.at(-1) as Row;
    expect(created.allAgents).toBe(false);
    expect(h.access.map((r) => [r.connectionId, r.botId])).toEqual([
      ["a", "b1"],
      ["linked", "linked-agent"],
      [created.id, "b1"],
    ]);
  });
});
