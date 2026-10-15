import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { saveBotPage } from "./pages.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("bot page saves (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `page-organization-${suffix}`;
  const spaceId = `page-space-${suffix}`;
  const userId = `page-user-${suffix}`;
  const events = { append: async () => ({}) as never };
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let botId: string;
  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    await prisma.user.create({
      data: { id: userId, name: "Page tester", email: `${userId}@example.test` },
    });
    await prisma.organization.create({
      data: { id: organizationId, name: "Page Org", slug: organizationId, createdAt: new Date() },
    });
    await prisma.space.create({
      data: { id: spaceId, organizationId, name: "General", isDefault: true },
    });
    botId = (await prisma.bot.create({ data: { spaceId, userId, name: "Writer", color: "blue" } }))
      .id;
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.delete({ where: { id: userId } });
    await close();
  });

  it("lets exactly one of several concurrent saves win, for create and for update", async () => {
    const save = (content: string, baseRevision: number) =>
      saveBotPage(
        { prisma, events },
        { spaceId, botId, userId, content, baseRevision, updatedBy: "user" },
      );
    for (const baseRevision of [0, 1]) {
      const results = await Promise.all(
        Array.from({ length: 6 }, (_, i) => save(`draft ${baseRevision}-${i}`, baseRevision)),
      );
      expect(results.filter((result) => result.ok)).toHaveLength(1);
      expect(
        results.filter((result) => !result.ok).every((r) => r.page?.revision === baseRevision + 1),
      ).toBe(true);
    }
    const page = await prisma.botPage.findUniqueOrThrow({ where: { botId } });
    expect(page.revision).toBe(2);
    expect(await prisma.botPageRevision.count({ where: { pageId: page.id } })).toBe(2);
  });
});
