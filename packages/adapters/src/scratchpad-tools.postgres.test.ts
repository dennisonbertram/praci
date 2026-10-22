import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  addScratchpadItemFromTool,
  consumeApprovedPost,
  removeScratchpadItemFromTool,
  removeScratchpadItemFromUser,
  updateScratchpadItemFromTool,
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

  describe("durable directory approval policy", () => {
    const now = new Date("2026-10-22T12:00:00.000Z");
    const scope = { spaceId, userId, botId };
    const deps = () => ({ prisma, now: () => now });
    const directory = () =>
      prisma.scratchpadItem.create({
        data: {
          ...scope,
          title: "Synthetic directory",
          category: "create_account",
          channel: "directory",
          status: "parked",
        },
      });
    const approve = (item: { id: string; updatedAt: Date }) =>
      updateScratchpadItemFromUser(deps(), {
        ...scope,
        itemId: item.id,
        status: "open",
        updatedAt: item.updatedAt.toISOString(),
      });
    const open = (itemId: string) =>
      updateScratchpadItemFromTool(deps(), { ...scope, itemId, status: "open" });
    const park = (itemId: string) =>
      updateScratchpadItemFromTool(deps(), { ...scope, itemId, status: "parked" });
    const history = (approvedBy: string) =>
      prisma.scratchpadApproval.count({ where: { ...scope, approvedBy } });
    const founderThreshold = async () => {
      for (let i = 0; i < 3; i++) expect(await approve(await directory())).toHaveProperty("item");
    };
    beforeEach(async () => {
      await prisma.scratchpadApproval.deleteMany({ where: scope });
      await prisma.scratchpadItem.deleteMany({ where: { ...scope, category: "create_account" } });
    });

    it("requires distinct founder items and retains history across edits, reparking, discard and expiry", async () => {
      const first = await directory();
      for (let i = 0; i < 3; i++) {
        expect(
          await approve(await prisma.scratchpadItem.findUniqueOrThrow({ where: { id: first.id } })),
        ).toHaveProperty("item");
        expect(await park(first.id)).toHaveProperty("item");
      }
      const candidate = await directory();
      expect(await history("user")).toBe(3);
      expect(await open(candidate.id)).toHaveProperty("error");
      const second = await directory();
      const third = await directory();
      expect(await approve(second)).toHaveProperty("item");
      expect(await approve(third)).toHaveProperty("item");
      expect(
        await updateScratchpadItemFromUser(deps(), {
          ...scope,
          itemId: second.id,
          notes: "Changed after approval",
        }),
      ).toMatchObject({ item: { status: "parked", approvedAt: null } });
      expect(
        await removeScratchpadItemFromUser(deps(), { ...scope, itemId: first.id }),
      ).toHaveProperty("ok", true);
      // Normal scratchpad expiry also deletes the item, not its approval history.
      await prisma.scratchpadItem.deleteMany({ where: { ...scope, id: third.id } });
      expect(await open(candidate.id)).toMatchObject({
        item: { status: "open", approvedBy: "policy" },
      });
      expect(await history("user")).toBe(5);
    });

    it("counts every reopening but not retries, and discard cannot reset the policy cap", async () => {
      await founderThreshold();
      const item = await directory();
      for (let i = 0; i < 5; i++) {
        expect(await open(item.id)).toHaveProperty("item");
        expect(await open(item.id)).toHaveProperty("error");
        expect(await history("policy")).toBe(i + 1);
        expect(await park(item.id)).toHaveProperty("item");
      }
      expect(await open(item.id)).toHaveProperty("error");
      expect(
        await removeScratchpadItemFromUser(deps(), { ...scope, itemId: item.id }),
      ).toHaveProperty("ok", true);
      expect(await open((await directory()).id)).toHaveProperty("error");
      expect(await history("policy")).toBe(5);
      // The policy cap does not constrain explicit founder approvals.
      expect(await approve(await directory())).toHaveProperty("item");
      expect(await history("user")).toBe(4);
    });

    it("two concurrent policy openings at the cap leave exactly one open", async () => {
      await founderThreshold();
      for (let i = 0; i < 4; i++) expect(await open((await directory()).id)).toHaveProperty("item");
      const left = await directory();
      const right = await directory();
      const results = await Promise.all([open(left.id), open(right.id)]);
      expect(results.filter((result) => "item" in result)).toHaveLength(1);
      expect(
        await prisma.scratchpadItem.count({
          where: {
            ...scope,
            id: { in: [left.id, right.id] },
            status: "open",
            approvedBy: "policy",
          },
        }),
      ).toBe(1);
      expect(await history("policy")).toBe(5);
    });

    it("records nothing for stale, invalid, foreign-scope or repeated approvals", async () => {
      const item = await directory();
      expect(
        await updateScratchpadItemFromTool(deps(), {
          ...scope,
          itemId: item.id,
          notes: "New terms",
        }),
      ).toHaveProperty("item");
      expect(await approve(item)).toEqual({ conflict: true });
      expect(
        await updateScratchpadItemFromUser(deps(), { ...scope, itemId: item.id, status: "open" }),
      ).toHaveProperty("error");
      expect(
        await updateScratchpadItemFromUser(deps(), {
          ...scope,
          userId: "other-user",
          itemId: item.id,
          status: "open",
          updatedAt: item.updatedAt.toISOString(),
        }),
      ).toHaveProperty("error");
      expect(await history("user")).toBe(0);
      const current = await prisma.scratchpadItem.findUniqueOrThrow({ where: { id: item.id } });
      const results = await Promise.all([approve(current), approve(current)]);
      expect(results.filter((result) => "item" in result)).toHaveLength(1);
      expect(await history("user")).toBe(1);
      expect(await approve(current)).toEqual({ conflict: true });
      expect(await history("user")).toBe(1);
    });

    it("uses only scoped history in (now minus 24 hours, now], never mutable approval columns", async () => {
      const otherUser = `${userId}-other`;
      const otherSpace = `${spaceId}-other`;
      const otherBot = `${botId}-other`;
      await prisma.user.create({
        data: { id: otherUser, name: "Other", email: `${otherUser}@example.test` },
      });
      await prisma.space.create({ data: { id: otherSpace, organizationId, name: "Other" } });
      await prisma.bot.create({
        data: { id: otherBot, spaceId, userId, name: "Other", color: "black" },
      });
      try {
        const ignored = [
          { userId: otherUser },
          { spaceId: otherSpace },
          { botId: otherBot },
          { channel: "email" },
          { category: "public_post" },
          { approvedAt: new Date(now.getTime() - 86_400_000) },
          { approvedAt: new Date(now.getTime() - 86_400_001) },
          { approvedAt: new Date(now.getTime() + 1) },
        ];
        for (const approvedBy of ["user", "policy"]) {
          for (const override of ignored) {
            for (let i = 0; i < 5; i++)
              await prisma.scratchpadApproval.create({
                data: {
                  ...scope,
                  itemId: `ignored-${i}`,
                  category: "create_account",
                  channel: "directory",
                  approvedAt: now,
                  approvedBy,
                  ...override,
                },
              });
          }
        }
        const candidate = await directory();
        // Legacy/current item columns without ledger rows are not policy authority.
        for (let i = 0; i < 3; i++)
          await prisma.scratchpadItem.create({
            data: {
              ...scope,
              title: "No history",
              category: "create_account",
              channel: "directory",
              status: "open",
              approvedBy: "user",
              approvedAt: now,
            },
          });
        expect(await open(candidate.id)).toHaveProperty("error");
        for (let i = 0; i < 3; i++)
          await prisma.scratchpadApproval.create({
            data: {
              ...scope,
              itemId: `valid-${i}`,
              category: "create_account",
              channel: "directory",
              approvedBy: "user",
              approvedAt: i === 0 ? new Date(now.getTime() - 86_400_000 + 1) : now,
            },
          });
        expect(await open(candidate.id)).toHaveProperty("item");
      } finally {
        await prisma.user.delete({ where: { id: otherUser } });
        await prisma.space.delete({ where: { id: otherSpace } });
        await prisma.bot.delete({ where: { id: otherBot } });
      }
    });
  });
});
