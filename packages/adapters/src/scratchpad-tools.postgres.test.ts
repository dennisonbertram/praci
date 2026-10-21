import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addScratchpadItemFromTool,
  consumeApprovedPost,
  removeScratchpadItemFromTool,
  updateScratchpadItemFromUser,
} from "./scratchpad-tools.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("scratchpad store (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `sp-org-${suffix}`;
  const spaceId = `sp-space-${suffix}`;
  const userId = `sp-user-${suffix}`;
  const botId = `sp-bot-${suffix}`;
  let prisma: PrismaClient;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    await prisma.user.create({
      data: { id: userId, name: userId, email: `${userId}@example.test` },
    });
    await prisma.organization.create({
      data: {
        id: organizationId,
        name: organizationId,
        slug: organizationId,
        createdAt: new Date(),
      },
    });
    await prisma.space.create({ data: { id: spaceId, organizationId, name: spaceId } });
    await prisma.bot.create({
      data: {
        id: botId,
        spaceId,
        userId,
        name: "Scratchpad test bot",
        color: "black",
      },
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await close();
  });

  const effectKey = (name: string) => `run-${name}:posts_create:${"a".repeat(64)}`;
  const post = (
    text = "Exact post",
    scheduledFor = new Date(Date.now() + 60 * 60_000),
    target = "account-1",
  ) =>
    prisma.scratchpadItem.create({
      data: {
        spaceId,
        userId,
        botId,
        title: "Post",
        status: "open",
        notes: text,
        category: "public_post",
        channel: "x",
        target,
        scheduledFor,
        approvedAt: new Date(),
        approvedBy: "user",
      },
    });

  it("allows one of two concurrent consumers and replays the same stamped item before an identical copy", async () => {
    const scheduledFor = new Date(Date.now() + 60 * 60_000);
    const concurrent = await post("Concurrent post", scheduledFor, "account-concurrent");
    const base = {
      spaceId,
      userId,
      botId,
      text: "Concurrent post",
      scheduledFor: scheduledFor.toISOString(),
      target: "account-concurrent",
    };
    const [left, right] = await Promise.all([
      consumeApprovedPost({ prisma }, { ...base, effectKey: effectKey("concurrent-a") }),
      consumeApprovedPost({ prisma }, { ...base, effectKey: effectKey("concurrent-b") }),
    ]);
    expect([left.count, right.count].filter(Boolean)).toHaveLength(1);
    const oneStamp = await prisma.scratchpadItem.findMany({
      where: { spaceId, userId, botId, target: "account-concurrent", proof: { not: null } },
    });
    expect(oneStamp).toHaveLength(1);
    expect(oneStamp[0]?.id).toBe(concurrent.id);

    const first = await post("Exact post", scheduledFor, "account-replay");
    const second = await post("Exact post", scheduledFor, "account-replay");
    const sameKey = effectKey("replay");
    const replayArgs = { ...base, text: "Exact post", target: "account-replay" };
    const consumed = await consumeApprovedPost({ prisma }, { ...replayArgs, effectKey: sameKey });
    expect(consumed.count).toBe(1);
    if (consumed.count !== 1) return;
    const replay = await consumeApprovedPost({ prisma }, { ...replayArgs, effectKey: sameKey });
    expect(replay.count).toBe(1);
    if (replay.count !== 1) return;
    expect(replay.item.id).toBe(consumed.item.id);
    expect([first.id, second.id]).toContain(consumed.item.id);
    const unconsumedCopy = await prisma.scratchpadItem.findMany({
      where: { spaceId, userId, botId, target: "account-replay", proof: null },
    });
    expect(unconsumedCopy).toHaveLength(1);
    expect(unconsumedCopy[0]?.id).not.toBe(consumed.item?.id);
  });

  it("requires exact approved post text before consuming and preserves gated work from agents", async () => {
    const scheduledFor = new Date(Date.now() + 60 * 60_000);
    const item = await post("Exact post", scheduledFor, "account-whitespace");
    const base = {
      spaceId,
      userId,
      botId,
      scheduledFor: scheduledFor.toISOString(),
      target: "account-whitespace",
    };
    const whitespaceOnlyMismatch = await consumeApprovedPost(
      { prisma },
      {
        ...base,
        text: "  Exact post ",
        effectKey: effectKey("whitespace-mismatch"),
      },
    );
    const afterMismatch = await prisma.scratchpadItem.findFirst({
      where: { id: item.id, spaceId, userId, botId },
    });
    const exactText = await consumeApprovedPost(
      { prisma },
      {
        ...base,
        text: "Exact post",
        effectKey: effectKey("exact-text"),
      },
    );
    const afterExact = await prisma.scratchpadItem.findFirst({
      where: { id: item.id, spaceId, userId, botId },
    });
    expect(whitespaceOnlyMismatch.count).toBe(0);
    expect(afterMismatch).toMatchObject({ proof: null });
    expect(exactText.count).toBe(1);
    expect(afterExact).toMatchObject({ proof: effectKey("exact-text") });

    const protectedItem = await post("Protected post", scheduledFor, "account-protected");
    const removal = await removeScratchpadItemFromTool(
      { prisma },
      { spaceId, userId, botId, itemId: protectedItem.id },
    );
    const survivingItem = await prisma.scratchpadItem.findFirst({
      where: { id: protectedItem.id, spaceId, userId, botId },
    });
    expect(removal).toMatchObject({ error: expect.any(String) });
    expect(survivingItem).not.toBeNull();
  });

  it("makes a stale founder approval lose its guarded update", async () => {
    const item = await prisma.scratchpadItem.create({
      data: {
        spaceId,
        userId,
        botId,
        title: "Stale approval",
        status: "parked",
        notes: "",
        category: "public_post",
        channel: "x",
        target: "account-1",
      },
    });
    await prisma.scratchpadItem.updateMany({
      where: { id: item.id, spaceId, userId, botId },
      data: { updatedAt: new Date(Date.now() + 1) },
    });
    const result = await updateScratchpadItemFromUser(
      { prisma },
      {
        spaceId,
        userId,
        botId,
        itemId: item.id,
        status: "open",
        updatedAt: item.updatedAt.toISOString(),
      },
    );
    expect(result).toMatchObject({ conflict: true });
    expect(
      await prisma.scratchpadItem.findFirst({
        where: { id: item.id, spaceId, userId, botId },
      }),
    ).toMatchObject({
      status: "parked",
      approvedAt: null,
    });
  });

  it("serializes concurrent goal creation including parked goals", async () => {
    const results = await Promise.all([
      addScratchpadItemFromTool(
        { prisma },
        {
          spaceId,
          userId,
          botId,
          title: "Goal one",
          category: "goal",
          status: "parked",
        },
      ),
      addScratchpadItemFromTool(
        { prisma },
        {
          spaceId,
          userId,
          botId,
          title: "Goal two",
          category: "goal",
          status: "parked",
        },
      ),
    ]);
    expect(results.filter((result) => "item" in result)).toHaveLength(1);
    const goals = await prisma.scratchpadItem.findMany({
      where: { spaceId, userId, botId, category: "goal", status: { not: "done" } },
    });
    expect(goals).toHaveLength(1);
  });
});
