import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";
import { listWaitingOnYouItems } from "./scratchpad-waiting.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("waiting on you (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `wy-org-${suffix}`;
  const spaceId = `wy-space-${suffix}`;
  const otherSpaceId = `wy-space2-${suffix}`;
  const userId = `wy-user-${suffix}`;
  const otherUserId = `wy-other-${suffix}`;
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    for (const id of [userId, otherUserId]) {
      await prisma.user.create({ data: { id, name: id, email: `${id}@example.test` } });
    }
    await prisma.organization.create({
      data: { id: organizationId, name: "Org", slug: organizationId, createdAt: new Date() },
    });
    await prisma.space.create({
      data: { id: spaceId, organizationId, name: "A", isDefault: true },
    });
    await prisma.space.create({ data: { id: otherSpaceId, organizationId, name: "B" } });
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await close();
  });
  it("lists only this user's, this space's items that wait on them or are past due", async () => {
    const now = new Date("2026-01-10T12:00:00Z");
    const past = new Date("2026-01-01T00:00:00Z");
    const future = new Date("2026-02-01T00:00:00Z");
    const bot = await prisma.bot.create({ data: { spaceId, userId, name: "Ada", color: "blue" } });
    const otherUserBot = await prisma.bot.create({
      data: { spaceId, userId: otherUserId, name: "Ben", color: "blue" },
    });
    const otherSpaceBot = await prisma.bot.create({
      data: { spaceId: otherSpaceId, userId, name: "Cy", color: "blue" },
    });
    const add = (
      botId: string,
      sId: string,
      uId: string,
      title: string,
      extra: { status?: string; waitingOn?: string; dueAt?: Date } = {},
    ) =>
      prisma.scratchpadItem.create({
        data: { spaceId: sId, userId: uId, botId, title, status: "open", ...extra },
      });
    await add(bot.id, spaceId, userId, "waits on you", { waitingOn: "You" });
    await add(bot.id, spaceId, userId, "waits on you to sign", { waitingOn: "you to sign" });
    await add(bot.id, spaceId, userId, "past due", { dueAt: past });
    await add(bot.id, spaceId, userId, "waits on Acme", { waitingOn: "Acme legal", dueAt: future });
    await add(bot.id, spaceId, userId, "done", { waitingOn: "you", status: "done" });
    await add(otherUserBot.id, spaceId, otherUserId, "other user", { waitingOn: "you" });
    await add(otherSpaceBot.id, otherSpaceId, userId, "other space", { waitingOn: "you" });
    await add(bot.id, spaceId, userId, "waits on Youssef", { waitingOn: "Youssef", dueAt: future });
    const items = await listWaitingOnYouItems(prisma, { spaceId, userId }, now);
    expect(items.map((item) => item.title).sort()).toEqual([
      "past due",
      "waits on you",
      "waits on you to sign",
    ]);
    expect(items.every((item) => item.botName === "Ada")).toBe(true);
  });
});
