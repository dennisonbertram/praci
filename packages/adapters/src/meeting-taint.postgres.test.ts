import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { markMeetingTaintOnDelivery } from "./meeting-tools.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("meeting taint mark (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const orgId = `mtt-org-${suffix}`;
  const scope = { spaceId: `mtt-space-${suffix}`, userId: `mtt-user-${suffix}` };
  const ids = (n: string) => `mtt-${n}-${suffix}`;
  let prisma: PrismaClient;
  let close: () => Promise<void>;

  const mark = (from: string, to: string) =>
    markMeetingTaintOnDelivery(prisma, {
      ...scope,
      senderBotId: ids(from),
      sourceThreadId: ids(`t-${from}`),
      targetThreadId: ids(`t-${to}`),
    });
  const marked = async (n: string) =>
    (await prisma.thread.findUniqueOrThrow({ where: { id: ids(`t-${n}`) } })).meetingTaintedAt !==
    null;

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    await prisma.user.create({
      data: { id: scope.userId, name: "u", email: `${scope.userId}@example.test` },
    });
    await prisma.organization.create({
      data: { id: orgId, name: "MTT", slug: orgId, createdAt: new Date() },
    });
    await prisma.space.create({ data: { id: scope.spaceId, organizationId: orgId, name: "s" } });
    for (const n of ["meeting", "a", "b", "other"]) {
      await prisma.bot.create({
        data: {
          id: ids(n),
          ...scope,
          name: n,
          color: "#000000",
          spawnKey: n === "meeting" ? `integration-agent:${ids("srv")}` : null,
        },
      });
      await prisma.thread.create({ data: { id: ids(`t-${n}`), ...scope, botId: ids(n) } });
    }
    await prisma.mcpServer.create({
      data: {
        id: ids("srv"),
        ...scope,
        slug: `g-${suffix}`,
        name: "Granola",
        transport: "http",
        endpoint: "https://mcp.granola.ai/mcp",
        agentBotId: ids("meeting"),
      },
    });
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: scope.userId } });
    await close();
  });

  it("marks the thread a meeting agent delivers into, and no thread an ordinary agent delivers into", async () => {
    await mark("other", "b");
    expect(await marked("b")).toBe(false);
    await mark("meeting", "b");
    expect(await marked("b")).toBe(true);
  });

  it("carries the mark forward when the marked agent forwards, even after the source agent is gone", async () => {
    await prisma.mcpServer.deleteMany({ where: { id: ids("srv") } });
    await prisma.bot.update({ where: { id: ids("meeting") }, data: { archivedAt: new Date() } });
    expect(await marked("a")).toBe(false);
    await mark("b", "a");
    expect(await marked("a")).toBe(true);
  });
});
