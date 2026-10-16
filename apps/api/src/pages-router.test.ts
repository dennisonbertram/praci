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

const match = (row: Row, where: Row = {}) =>
  Object.entries(where).every(([key, value]) => row[key] === value);

function setup() {
  const bots: Row[] = [
    { id: "bot-1", userId: "user-1", spaceId: "space-1", archivedAt: null },
    { id: "bot-other-user", userId: "user-2", spaceId: "space-1", archivedAt: null },
    { id: "bot-other-space", userId: "user-1", spaceId: "space-2", archivedAt: null },
  ];
  const pages: Row[] = [];
  const prisma = {
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
      create: vi.fn(async ({ data }: { data: Row }) => {
        const row = { id: "page-1", updatedAt: new Date("2026-10-17T00:00:00Z"), ...data };
        pages.push(row);
        return row;
      }),
      updateMany: vi.fn(),
    },
    botPageRevision: { create: vi.fn() },
    thread: { findFirst: vi.fn(async () => ({ id: "thread-1" })) },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) => fn(prisma));
  const events = { append: vi.fn(async () => ({})) };
  const deps = { prisma: prisma as unknown as PrismaClient, events } as unknown as RouterDeps;
  const handler = new RPCHandler(createRouter(deps));
  async function call(path: "get" | "save", input: unknown) {
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
  return { prisma, events, pages, call };
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
        payload: { revision: 1, updatedBy: "user" },
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
});
