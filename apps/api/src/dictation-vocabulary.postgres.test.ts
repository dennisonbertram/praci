import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dictationVocabulary } from "./dictation-vocabulary.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("dictationVocabulary (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const id = (name: string) => `dvoc-${name}-${suffix}`;
  const orgA = id("org-a");
  const orgB = id("org-b");
  const spaceA = id("space-a");
  const spaceB = id("space-b");
  const userA = id("user-a");
  const userB = id("user-b");
  const actor = (userId: string, spaceId: string): Actor => ({
    userId,
    spaceId,
    email: `${userId}@rakazo.test`,
    isDeploymentOwner: false,
  });
  let prisma: PrismaClient;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await db.prisma.$disconnect();
      await db.pool.end();
    };
    for (const userId of [userA, userB]) {
      await prisma.user.create({
        data: { id: userId, name: userId, email: `${userId}@rakazo.test`, emailVerified: false },
      });
    }
    for (const [org, space] of [
      [orgA, spaceA],
      [orgB, spaceB],
    ] as const) {
      await prisma.organization.create({
        data: { id: org, name: org, slug: org, createdAt: new Date() },
      });
      await prisma.space.create({
        data: { id: space, organizationId: org, name: "General", isDefault: true },
      });
    }
    // User B shares space A with user A; user B also has a bot and a contact there.
    for (const [userId, org] of [
      [userA, orgA],
      [userB, orgA],
    ] as const) {
      await prisma.member.create({
        data: {
          id: id(`member-${userId}`),
          organizationId: org,
          userId,
          role: "member",
          createdAt: new Date(),
        },
      });
    }
    const bot = (name: string, userId: string, spaceId: string) =>
      prisma.bot.create({
        data: { id: id(`bot-${name}`), name, userId, spaceId, color: "#000000" },
      });
    await bot("Ada Assistant", userA, spaceA);
    await bot("Bea Private", userB, spaceA);
    await bot("Other Space Bot", userA, spaceB);
    const contact = (name: string, userId: string, spaceId: string) =>
      prisma.contact.create({ data: { name, userId, spaceId } });
    await contact("Cora Investor", userA, spaceA);
    await contact("Dmitri Private", userB, spaceA);
    await contact("Elsewhere Contact", userA, spaceB);
    for (const [spaceId, title] of [
      [spaceA, "Fix Quokka sync"],
      [spaceB, "Hidden Zebra plan"],
    ] as const) {
      const board = await prisma.board.create({ data: { spaceId } });
      await prisma.ticket.create({
        data: { boardId: board.id, spaceId, number: 1, title, createdByUserId: userA },
      });
    }
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
    await close();
  });

  it("lists the actor's bots, own contacts and visible ticket titles in that order", async () => {
    expect(
      await dictationVocabulary({ prisma, ticketBoardEnabled: true }, actor(userA, spaceA)),
    ).toEqual(["Ada Assistant", "Cora Investor", "Fix Quokka sync"]);
  });

  it("vocabulary never includes another user's or space's names", async () => {
    const list = await dictationVocabulary(
      { prisma, ticketBoardEnabled: true },
      actor(userA, spaceA),
    );
    for (const hidden of ["Bea Private", "Dmitri Private", "Other Space Bot", "Elsewhere Contact"])
      expect(list).not.toContain(hidden);
    expect(list).not.toContain("Hidden Zebra plan");
  });

  it("excludes a ticket on a different board", async () => {
    const other = await prisma.board.findUniqueOrThrow({ where: { spaceId: spaceB } });
    await prisma.ticket.create({
      data: { boardId: other.id, spaceId: spaceA, number: 2, title: "Wrong board Narwhal" },
    });
    const list = await dictationVocabulary(
      { prisma, ticketBoardEnabled: true },
      actor(userA, spaceA),
    );
    expect(list).toContain("Fix Quokka sync");
    expect(list).not.toContain("Wrong board Narwhal");
  });

  it("skips tickets when the board is off", async () => {
    expect(await dictationVocabulary({ prisma }, actor(userA, spaceA))).toEqual([
      "Ada Assistant",
      "Cora Investor",
    ]);
  });
});
