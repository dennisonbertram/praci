import type { PinStat } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { pinsToolFromTool, refreshBotPins, saveBotPins } from "./pins.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("bot pins (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const orgId = `pins-org-${suffix}`;
  const spaceId = `pins-space-${suffix}`;
  const otherSpaceId = `pins-other-space-${suffix}`;
  const userId = `pins-user-${suffix}`;
  const append = vi.fn(async () => ({}) as never);
  const sendUserMessage = vi.fn(async () => ({
    messageId: "m",
    seq: 1,
    taskId: null,
    runId: null,
  }));
  const events = { append, sendUserMessage };
  const jobs = { enqueue: vi.fn(async () => undefined) };
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let scope: { spaceId: string; botId: string; userId: string };
  let serverId: string;
  let otherServerId: string;
  const source = (id: string, tool = "get_balance") => ({
    serverId: id,
    tool,
    args: {},
    path: "/balance",
    format: "usd" as const,
  });
  const stat = (over: Partial<PinStat> = {}): PinStat => ({
    id: "s1",
    label: "Balance",
    value: "$1",
    ...over,
  });

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    await prisma.user.create({
      data: { id: userId, name: "Pins tester", email: `${userId}@example.test` },
    });
    await prisma.organization.create({
      data: { id: orgId, name: "Pins Org", slug: orgId, createdAt: new Date() },
    });
    for (const id of [spaceId, otherSpaceId]) {
      await prisma.space.create({
        data: { id, organizationId: orgId, name: id, isDefault: id === spaceId },
      });
    }
    const bot = await prisma.bot.create({
      data: { spaceId, userId, name: "Pinner", color: "blue" },
    });
    scope = { spaceId, botId: bot.id, userId };
    await prisma.thread.create({ data: { spaceId, botId: bot.id, userId } });
    const server = (space: string, slug: string) =>
      prisma.mcpServer.create({
        data: {
          spaceId: space,
          userId,
          slug,
          name: slug,
          transport: "http",
          endpoint: "https://mcp.example.test",
        },
      });
    serverId = (await server(spaceId, "bank")).id;
    otherServerId = (await server(otherSpaceId, "other")).id;
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.delete({ where: { id: userId } });
    await close();
  });

  it("creates, saves only the given section, and returns a conflict for a stale revision", async () => {
    const deps = { prisma, events };
    const created = await saveBotPins(deps, scope, {
      stats: [stat()],
      baseRevision: 0,
      updatedBy: "bot",
      refreshedAt: new Date(),
    });
    expect(created).toMatchObject({
      ok: true,
      pins: { revision: 1, updatedBy: "bot", list: null },
    });
    const list = { title: "To do", items: [{ id: "a", text: "Ship it", done: false }] };
    const saved = await saveBotPins(deps, scope, { list, baseRevision: 1, updatedBy: "user" });
    expect(saved).toMatchObject({
      ok: true,
      pins: { revision: 2, updatedBy: "user", list, stats: [{ id: "s1" }] },
    });
    expect(append).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "pins.updated",
        payload: { revision: 2, updatedBy: "user" },
      }),
    );
    const stale = await saveBotPins(deps, scope, {
      list: null,
      baseRevision: 1,
      updatedBy: "user",
    });
    expect(stale).toMatchObject({ ok: false, reason: "conflict", pins: { revision: 2, list } });
    const cleared = await saveBotPins(deps, scope, {
      list: null,
      baseRevision: 2,
      updatedBy: "user",
    });
    expect(cleared).toMatchObject({ ok: true, pins: { revision: 3, list: null } });
  });

  it("rejects a source on another space's server and a non-read-only tool", async () => {
    const deps = { prisma, events };
    const write = (s: PinStat) =>
      pinsToolFromTool(
        "pins_write",
        deps,
        { ...scope, runId: "r" },
        {
          stats: [s],
          baseRevision: 3,
        },
      );
    expect(await write(stat({ source: source(otherServerId) }))).toMatchObject({
      error: expect.stringContaining("not available"),
    });
    expect(await write(stat({ source: source(serverId, "delete_account") }))).toMatchObject({
      error: expect.stringContaining("not read-only"),
    });
    expect(await write(stat({ source: source(serverId, "listAccounts") }))).toMatchObject({
      ok: true,
    });
    expect(await write({ ...stat(), label: "x".repeat(41) })).toMatchObject({
      error: expect.stringContaining("Invalid stats"),
    });
  });

  it("keeps the old value and sets error when a source fails, then clears it on success", async () => {
    const stats = [stat({ source: source(serverId) })];
    const current = await prisma.botPins.findUniqueOrThrow({ where: { botId: scope.botId } });
    await saveBotPins({ prisma, events }, scope, {
      stats,
      baseRevision: current.revision,
      updatedBy: "bot",
    });
    const callServerTool = vi.fn().mockRejectedValueOnce(new Error("upstream down"));
    const deps = { prisma, events, jobs, mcp: { callServerTool } };
    const failed = await refreshBotPins(deps, scope);
    expect(failed).toMatchObject({
      botRun: false,
      pins: { stats: [{ value: "$1", error: "upstream down" }] },
    });
    callServerTool.mockResolvedValueOnce({
      content: [{ type: "text", text: JSON.stringify({ balance: 1234.56 }) }],
    });
    const ok = await refreshBotPins(deps, scope);
    expect(ok?.pins.stats[0]).toEqual(expect.objectContaining({ value: "$1,235" }));
    expect(ok?.pins.stats[0]).not.toHaveProperty("error");
    expect(ok?.pins.refreshedAt).not.toBeNull();
    expect(sendUserMessage).not.toHaveBeenCalled();
  });

  it("asks the bot to update unsourced numbers", async () => {
    const current = await prisma.botPins.findUniqueOrThrow({ where: { botId: scope.botId } });
    await saveBotPins({ prisma, events }, scope, {
      stats: [stat({ id: "free", label: "Mood", value: "ok" })],
      baseRevision: current.revision,
      updatedBy: "bot",
    });
    const result = await refreshBotPins({ prisma, events, jobs }, scope);
    expect(result?.botRun).toBe(true);
    expect(sendUserMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        botId: scope.botId,
        spaceId,
        userId,
        prompt: "Update your pinned numbers.",
        trigger: "user",
      }),
    );
  });
});
