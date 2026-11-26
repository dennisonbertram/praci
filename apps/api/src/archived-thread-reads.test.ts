import { RPCHandler } from "@orpc/server/fetch";
import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { describe, expect, it, vi } from "vitest";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

function fixture() {
  const actor = {
    userId: "user-1",
    spaceId: "space-1",
    email: "fixture@example.test",
    isDeploymentOwner: false,
  } satisfies Actor;
  const bot = {
    id: "bot-1",
    userId: actor.userId,
    spaceId: actor.spaceId,
    archivedAt: new Date(),
    thread: { id: "thread-1" },
    computer: null,
  };
  const findBot = vi.fn(
    async ({
      where,
    }: {
      where: { id: string; userId: string; spaceId: string; archivedAt?: null };
    }) => {
      return where.id === bot.id &&
        where.userId === bot.userId &&
        where.spaceId === bot.spaceId &&
        where.archivedAt === undefined
        ? bot
        : null;
    },
  );
  const findMessages = vi.fn(async () => [
    {
      id: "message-1",
      seq: 1,
      threadId: "thread-1",
      role: "user",
      botId: "bot-1",
      blocks: [{ kind: "text", text: "Saved conversation" }],
      createdAt: new Date(),
      runId: null,
    },
  ]);
  const prisma = {
    bot: { findFirst: findBot, findMany: vi.fn(async () => []) },
    thread: { findFirst: vi.fn(async () => null) },
    threadGoal: { findFirst: vi.fn(async () => null) },
    spaceModelPreference: { findFirst: vi.fn(async () => null) },
    deploymentSettings: { findUnique: vi.fn(async () => null) },
    $queryRaw: vi.fn(async () => []),
    message: { findMany: findMessages },
    event: { findFirst: vi.fn(async () => null) },
    // findMany backs the delegated-approval lookup threads/get makes (f91a2ca17).
    run: { findFirst: vi.fn(async () => null), findMany: vi.fn(async () => []) },
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(prisma)),
  };
  const deps = {
    prisma: prisma as unknown as PrismaClient,
    env: { webOrigin: "http://127.0.0.1", sandboxProvider: "fake", agentRuntime: "scripted" },
  } as RouterDeps;
  const handler = new RPCHandler(createRouter(deps));
  async function call(proc: string, input: unknown, requestActor = actor) {
    const { response } = await handler.handle(
      new Request(`http://127.0.0.1/rpc/${proc}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ json: input }),
      }),
      { prefix: "/rpc", context: { actor: requestActor } },
    );
    return { status: response.status, body: await response.json() };
  }
  async function callStream(proc: string, input: unknown, requestActor = actor) {
    const { response } = await handler.handle(
      new Request(`http://127.0.0.1/rpc/${proc}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ json: input }),
      }),
      { prefix: "/rpc", context: { actor: requestActor } },
    );
    return { status: response.status, text: await response.text() };
  }
  return { actor, call, callStream, findBot, findMessages, prisma };
}

// IsolationError is opaque at the RPC boundary. Access is denied before any history reads or writes.
describe("archived thread read authorization", () => {
  it.each(["threads/get", "threads/messages"])(
    "%s reads the owned archived history",
    async (proc) => {
      const { call, findBot } = fixture();
      const result = await call(proc, { botId: "bot-1" });
      expect(result.status).toBe(200);
      expect(result.body.json.messages).toEqual([expect.objectContaining({ id: "message-1" })]);
      expect(findBot).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "bot-1", userId: "user-1", spaceId: "space-1" } }),
      );
    },
  );
  it("answers a stream for another user's bot exactly as one that does not exist", async () => {
    const { actor, callStream } = fixture();
    const foreign = await callStream(
      "threads/subscribe",
      { botId: "bot-1", cursor: 0 },
      { ...actor, userId: "other-user" },
    );
    const missing = await callStream("threads/subscribe", { botId: "no-such-bot", cursor: 0 });
    expect(foreign.text).toContain('"code":"NOT_FOUND"');
    expect(foreign.text).not.toContain("INTERNAL_SERVER_ERROR");
    expect(foreign.text).toEqual(missing.text);
  });
  it("answers another user's bot exactly as one that does not exist", async () => {
    const { actor, call } = fixture();
    const otherUsers = await call(
      "threads/get",
      { botId: "bot-1" },
      {
        ...actor,
        userId: "other-user",
      },
    );
    const missing = await call("threads/get", { botId: "no-such-bot" });
    expect(otherUsers.status).toBe(missing.status);
    expect(otherUsers.body).toEqual(missing.body);
  });
  it.each(["threads/get", "threads/messages"])(
    "%s keeps user and space isolation",
    async (proc) => {
      const { actor, call, findMessages } = fixture();
      const otherUser = await call(proc, { botId: "bot-1" }, { ...actor, userId: "other-user" });
      expect(otherUser.status).toBe(404);
      expect(otherUser.body.json.code).toBe("NOT_FOUND");
      const otherSpace = await call(proc, { botId: "bot-1" }, { ...actor, spaceId: "other-space" });
      expect(otherSpace.status).toBe(404);
      expect(otherSpace.body.json.code).toBe("NOT_FOUND");
      expect(findMessages).not.toHaveBeenCalled();
    },
  );
  it.each([
    ["threads/send", { botId: "bot-1", text: "Cannot send" }],
    [
      "threads/react",
      { botId: "bot-1", messageId: "message-1", reaction: "👍", clientNonce: "fixture" },
    ],
    [
      "threads/answer",
      { botId: "bot-1", runId: "run-1", messageId: "message-1", answer: "Cannot answer" },
    ],
    ["threads/clear", { botId: "bot-1" }],
    ["threads/stop", { botId: "bot-1" }],
    ["threads/followUp", { botId: "bot-1", text: "Cannot run" }],
    ["threads/markRead", { botId: "bot-1" }],
    ["computer/boot", { botId: "bot-1" }],
  ])("%s still rejects an archived bot", async (proc, input) => {
    const { call, findBot } = fixture();
    const result = await call(proc as string, input);
    expect(result.status).toBe(404);
    expect(result.body.json.code).toBe("NOT_FOUND");
    expect(findBot).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ archivedAt: null }) }),
    );
  });
});

// A row that lost its thread is a broken invariant, not an access decision: it stays a logged 500.
describe("broken thread invariants", () => {
  it("keeps a bot without its thread a server error, not a missing record", async () => {
    const { call, prisma } = fixture();
    prisma.bot.findMany.mockResolvedValue([
      { id: "bot-1", spaceId: "space-1", userId: "user-1", thread: null, runs: [] },
    ]);
    const result = await call("bots/list", {});
    expect(result.status).toBe(500);
    expect(result.body.json.code).toBe("INTERNAL_SERVER_ERROR");
  });
});
