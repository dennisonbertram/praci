import { RPCHandler } from "@orpc/server/fetch";
import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { describe, expect, it, vi } from "vitest";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

// Offline boundary: a fake Prisma client drives the real pages handlers and the real
// repos.getBot ownership check.

type Row = Record<string, unknown>;
const actor = {
  spaceId: "space-1",
  userId: "user-1",
  email: "user@rakazo.test",
  isDeploymentOwner: false,
} satisfies Actor;

const compare = (actual: unknown, expected: unknown): number | null => {
  if (actual instanceof Date && expected instanceof Date)
    return actual.getTime() - expected.getTime();
  if (typeof actual === "number" && typeof expected === "number") return actual - expected;
  return null;
};

const matchesValue = (actual: unknown, expected: unknown): boolean => {
  if (expected instanceof Date) return compare(actual, expected) === 0;
  if (expected && typeof expected === "object" && !Array.isArray(expected)) {
    const operators = expected as Record<string, unknown>;
    if ("lt" in operators) return (compare(actual, operators.lt) ?? Infinity) < 0;
    if ("lte" in operators) return (compare(actual, operators.lte) ?? Infinity) <= 0;
  }
  return actual === expected;
};

const match = (row: Row, where: Row = {}) =>
  Object.entries(where).every(([key, value]) => {
    if (key === "AND")
      return Array.isArray(value) && value.every((part) => match(row, part as Row));
    if (key === "OR") return Array.isArray(value) && value.some((part) => match(row, part as Row));
    return matchesValue(row[key], value);
  });

function setup() {
  const bots: Row[] = [
    { id: "bot-1", userId: "user-1", spaceId: "space-1", archivedAt: null, name: "Writer" },
    {
      id: "bot-other-user",
      userId: "user-2",
      spaceId: "space-1",
      archivedAt: null,
      name: "Writer",
    },
    {
      id: "bot-other-space",
      userId: "user-1",
      spaceId: "space-2",
      archivedAt: null,
      name: "Writer",
    },
  ];
  const pages: Row[] = [];
  const sources: Row[] = [];
  const snapshots: Row[] = [];
  const prisma = {
    // removeBotPage deletes the page and ends its share links in one transaction.
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
    artifactShare: { updateMany: vi.fn(async () => ({ count: 0 })) },
    bot: {
      findFirst: vi.fn(async ({ where }: { where: Row }) => {
        const bot = bots.find((entry) => match(entry, where));
        return bot ? { ...bot, thread: null, computer: null } : null;
      }),
    },
    botPage: {
      findFirst: vi.fn(
        async ({ where }: { where: Row }) => pages.find((p) => match(p, where)) ?? null,
      ),
      findMany: vi.fn(async ({ where }: { where: Row }) => pages.filter((p) => match(p, where))),
      create: vi.fn(async ({ data }: { data: Row }) => {
        const row = {
          id: `page-${pages.length + 1}`,
          updatedAt: new Date("2026-10-17T00:00:00Z"),
          ...data,
        };
        pages.push(row);
        return row;
      }),
      updateMany: vi.fn(async ({ where, data }: { where: Row; data: Row }) => {
        const row = pages.find((p) => match(p, where));
        if (row) Object.assign(row, data);
        return { count: row ? 1 : 0 };
      }),
      deleteMany: vi.fn(async ({ where }: { where: Row }) => {
        const i = pages.findIndex((p) => match(p, where));
        if (i >= 0) pages.splice(i, 1);
        return { count: i >= 0 ? 1 : 0 };
      }),
    },
    pageSource: {
      findMany: vi.fn(async ({ where }: { where: Row }) => sources.filter((r) => match(r, where))),
      findFirst: vi.fn(
        async ({ where }: { where: Row }) => sources.find((r) => match(r, where)) ?? null,
      ),
      updateMany: vi.fn(async ({ where, data }: { where: Row; data: Row }) => {
        const row = sources.find((r) => match(r, where));
        if (row) Object.assign(row, data);
        return { count: row ? 1 : 0 };
      }),
      update: vi.fn(async ({ where, data }: { where: Row; data: Row }) => {
        const row = sources.find((r) => match(r, where)) as Row;
        Object.assign(row, data);
        return row;
      }),
      deleteMany: vi.fn(async ({ where }: { where: Row }) => {
        const i = sources.findIndex((r) => match(r, where));
        if (i >= 0) sources.splice(i, 1);
        return { count: i >= 0 ? 1 : 0 };
      }),
    },
    pageSourceSnapshot: {
      findMany: vi.fn(async ({ where, take }: { where: Row; take: number }) =>
        snapshots
          .filter((r) => match(r, where))
          .slice(-take)
          .reverse(),
      ),
    },
    botPageRevision: { create: vi.fn() },
    thread: { findFirst: vi.fn(async () => ({ id: "thread-1" })) },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) => fn(prisma));
  const events = { append: vi.fn(async () => ({})) };
  const deps = {
    prisma: prisma as unknown as PrismaClient,
    events,
    env: { mailWritesDisabled: false },
  } as unknown as RouterDeps;
  const handler = new RPCHandler(createRouter(deps));
  async function call(
    path:
      | "get"
      | "save"
      | "list"
      | "create"
      | "rename"
      | "remove"
      | "data"
      | "refresh"
      | "sources"
      | "removeSource"
      | "setSourceSchedule"
      | "pauseSource"
      | "resumeSource",
    input: unknown,
  ) {
    const { response } = await handler.handle(
      new Request(`http://127.0.0.1/rpc/pages/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ json: input }),
      }),
      { prefix: "/rpc", context: { actor } },
    );
    if (!response) throw new Error("Procedure did not match");
    return { status: response.status, body: (await response.json()) as { json: Row | null } };
  }
  return { prisma, events, pages, sources, snapshots, call };
}

describe("pages router", () => {
  it("saves as the user, reads back, and returns a conflict for a stale revision", async () => {
    const { call, events } = setup();
    expect((await call("get", { botId: "bot-1" })).body.json).toBeNull();
    const saved = await call("save", { botId: "bot-1", content: "# Plan", baseRevision: 0 });
    expect(saved.body.json).toMatchObject({ ok: true, page: { revision: 1, updatedBy: "user" } });
    expect(events.append).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "page.updated",
        payload: { pageId: "page-1", revision: 1, updatedBy: "user" },
      }),
    );
    expect((await call("get", { botId: "bot-1" })).body.json).toMatchObject({ content: "# Plan" });
    const stale = await call("save", { botId: "bot-1", content: "x", baseRevision: 0 });
    expect(stale.body.json).toMatchObject({ ok: false, reason: "conflict", page: { revision: 1 } });
  });

  it("rejects an invalid chart as a bad request", async () => {
    const { call, pages } = setup();
    const result = await call("save", {
      botId: "bot-1",
      content: "```chart\nnope\n```",
      baseRevision: 0,
    });
    expect(result.status).toBe(400);
    expect(pages).toHaveLength(0);
  });

  it("does not expose or modify another user's or another space's bot", async () => {
    const { call, pages } = setup();
    for (const botId of ["bot-other-user", "bot-other-space"]) {
      expect((await call("get", { botId })).status).toBeGreaterThanOrEqual(400);
      expect(
        (await call("save", { botId, content: "x", baseRevision: 0 })).status,
      ).toBeGreaterThanOrEqual(400);
    }
    expect(pages).toHaveLength(0);
  });

  it("lists, creates, renames and removes named pages, and addresses each by pageId", async () => {
    const { call } = setup();
    await call("save", { botId: "bot-1", content: "first", baseRevision: 0 });
    const created = await call("create", { botId: "bot-1", title: " Cash " });
    expect(created.body.json).toMatchObject({ title: "Cash", revision: 1, content: "" });
    const pageId = created.body.json?.id as string;
    expect((await call("create", { botId: "bot-1", title: "Cash" })).status).toBe(409);
    expect((await call("list", { botId: "bot-1" })).body.json).toMatchObject([
      { title: "Writer", revision: 1 },
      { title: "Cash", revision: 1 },
    ]);
    // No pageId still means the first page.
    expect((await call("get", { botId: "bot-1" })).body.json).toMatchObject({ content: "first" });
    const saved = await call("save", { botId: "bot-1", pageId, content: "c", baseRevision: 1 });
    expect(saved.body.json).toMatchObject({ ok: true, page: { title: "Cash", revision: 2 } });
    expect((await call("get", { botId: "bot-1", pageId })).body.json).toMatchObject({
      content: "c",
    });
    expect(
      (await call("rename", { botId: "bot-1", pageId, title: "Money" })).body.json,
    ).toMatchObject({
      title: "Money",
    });
    expect((await call("remove", { botId: "bot-1", pageId })).body.json).toEqual({ ok: true });
    expect((await call("get", { botId: "bot-1", pageId })).body.json).toBeNull();
  });

  it("treats a pageId of another bot as not found", async () => {
    const { call, pages } = setup();
    pages.push({
      id: "foreign",
      botId: "bot-other-user",
      spaceId: "space-1",
      title: "Theirs",
      content: "secret",
      revision: 1,
      updatedBy: "user",
      updatedAt: new Date(),
    });
    expect((await call("get", { botId: "bot-1", pageId: "foreign" })).body.json).toBeNull();
    expect(
      (await call("save", { botId: "bot-1", pageId: "foreign", content: "x", baseRevision: 1 }))
        .status,
    ).toBe(404);
    expect(
      (await call("rename", { botId: "bot-1", pageId: "foreign", title: "Mine" })).status,
    ).toBe(404);
    expect((await call("remove", { botId: "bot-1", pageId: "foreign" })).status).toBe(404);
    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({ title: "Theirs", content: "secret" });
    for (const path of ["list", "create"] as const) {
      expect(
        (await call(path, { botId: "bot-other-user", title: "x" })).status,
      ).toBeGreaterThanOrEqual(400);
    }
  });

  describe("live data", () => {
    const metric =
      '```metric\n{"label":"People","source":"people","path":"/n","format":"number"}\n```';
    const source = (over: Row = {}): Row => ({
      id: "src-1",
      spaceId: "space-1",
      userId: "user-1",
      botId: "bot-1",
      pageId: "page-1",
      name: "people",
      kind: "praci",
      call: { tool: "finance_overview", args: {} },
      schedule: "1h",
      status: "active",
      failures: 0,
      lastError: null,
      lastRefreshAt: null,
      leaseUntil: null,
      ...over,
    });

    async function withPage() {
      const ctx = setup();
      await ctx.call("save", { botId: "bot-1", content: metric, baseRevision: 0 });
      return ctx;
    }

    it("resolves a page's live blocks from stored snapshots, and is null without a page", async () => {
      const { call, sources, snapshots } = setup();
      expect((await call("data", { botId: "bot-1" })).body.json).toBeNull();
      await call("save", { botId: "bot-1", content: metric, baseRevision: 0 });
      expect((await call("data", { botId: "bot-1" })).body.json).toMatchObject({
        blocks: [{ status: "missing" }],
      });
      sources.push(source());
      snapshots.push({
        sourceId: "src-1",
        spaceId: "space-1",
        value: { n: 1200 },
        fetchedAt: new Date("2026-10-01T00:00:00Z"),
      });
      expect((await call("data", { botId: "bot-1" })).body.json).toEqual({
        pageId: "page-1",
        revision: 1,
        blocks: [{ status: "ok", fetchedAt: "2026-10-01T00:00:00.000Z", text: "1,200" }],
      });
      for (const botId of ["bot-other-user", "bot-other-space"]) {
        for (const path of ["data", "refresh", "sources"] as const) {
          expect((await call(path, { botId })).status).toBeGreaterThanOrEqual(400);
        }
      }
    });

    it("lists sources and removes only this bot's source, announcing page.data", async () => {
      const { call, sources, events } = await withPage();
      sources.push(source(), source({ id: "foreign", botId: "bot-other-user", name: "theirs" }));
      expect((await call("sources", { botId: "bot-1" })).body.json).toMatchObject([
        { id: "src-1", name: "people", status: "active", lastError: null },
      ]);
      expect((await call("removeSource", { botId: "bot-1", sourceId: "foreign" })).status).toBe(
        404,
      );
      expect(sources).toHaveLength(2);
      expect((await call("removeSource", { botId: "bot-1", sourceId: "src-1" })).body.json).toEqual(
        { ok: true },
      );
      expect(sources.map((row) => row.id)).toEqual(["foreign"]);
      expect(events.append).toHaveBeenCalledWith(
        expect.objectContaining({ type: "page.data", payload: { pageId: "page-1" } }),
      );
    });

    it("changes the schedule, pauses and resumes only this bot's source", async () => {
      const { call, sources } = await withPage();
      sources.push(source({ failures: 5 }), source({ id: "foreign", botId: "bot-other-user" }));
      const before = Date.now();
      expect(
        (await call("setSourceSchedule", { botId: "bot-1", sourceId: "src-1", schedule: "1d" }))
          .body.json,
      ).toMatchObject({ id: "src-1", schedule: "1d" });
      expect(new Date(sources[0]?.nextRefreshAt as Date).getTime()).toBeGreaterThanOrEqual(
        before + 86_400_000,
      );
      expect(
        (await call("pauseSource", { botId: "bot-1", sourceId: "src-1" })).body.json,
      ).toMatchObject({ status: "paused" });
      expect(
        (await call("resumeSource", { botId: "bot-1", sourceId: "src-1" })).body.json,
      ).toMatchObject({ status: "active" });
      expect(sources[0]).toMatchObject({ status: "active", failures: 0 });
      for (const path of ["pauseSource", "resumeSource"] as const) {
        expect((await call(path, { botId: "bot-1", sourceId: "foreign" })).status).toBe(404);
      }
      expect(
        (
          await call("setSourceSchedule", {
            botId: "bot-1",
            sourceId: "foreign",
            schedule: "1w",
          })
        ).status,
      ).toBe(404);
      expect(sources[1]).toMatchObject({ status: "active", schedule: "1h" });
      expect(
        (await call("pauseSource", { botId: "bot-other-user", sourceId: "src-1" })).status,
      ).toBeGreaterThanOrEqual(400);
    });

    it("refresh skips a source refreshed in the last minute and records a failure for the rest", async () => {
      const { call, sources, events } = await withPage();
      sources.push(source({ lastRefreshAt: new Date() }));
      await call("refresh", { botId: "bot-1" });
      expect(sources[0]?.failures).toBe(0);
      expect(events.append).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: "page.data" }),
      );
      sources[0] = source({ lastRefreshAt: new Date(Date.now() - 120_000) });
      const result = await call("refresh", { botId: "bot-1" });
      // Chief is not a Finance agent, so the same gate a run applies refuses the call.
      expect(sources[0]).toMatchObject({
        failures: 1,
        lastError: "This bot does not have finance_overview.",
      });
      expect(result.body.json).toMatchObject({
        blocks: [{ status: "failed", error: "This bot does not have finance_overview." }],
      });
      expect(events.append).toHaveBeenCalledWith(expect.objectContaining({ type: "page.data" }));
    });
  });
});
