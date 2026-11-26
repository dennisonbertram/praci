import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "./client.js";

// Needs DATABASE_MIGRATION_URL (the owner), as `pnpm test:integration` provides.
const migrationUrl = process.env.DATABASE_MIGRATION_URL;
const describePostgres = process.env.VERIFY_DATABASE && migrationUrl ? describe : describe.skip;

describePostgres("page sources (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const ids = {
    org: `ps-org-${suffix}`,
    user: `ps-user-${suffix}`,
    space: `ps-space-${suffix}`,
    bot: `ps-bot-${suffix}`,
    page: `ps-page-${suffix}`,
  };
  let handle: ReturnType<typeof createDb>;

  const source = (name: string) => ({
    spaceId: ids.space,
    userId: ids.user,
    botId: ids.bot,
    pageId: ids.page,
    name,
    kind: "praci",
    call: { tool: "finance_overview", args: {} },
    schedule: "1h",
    status: "active",
  });

  beforeAll(async () => {
    handle = createDb(migrationUrl!);
    const db = handle.prisma;
    await db.organization.create({
      data: { id: ids.org, name: "PS", slug: ids.org, createdAt: new Date() },
    });
    await db.user.create({
      data: { id: ids.user, name: "u", email: `${ids.user}@rakazo.test`, emailVerified: true },
    });
    await db.space.create({ data: { id: ids.space, organizationId: ids.org, name: "s" } });
    await db.bot.create({
      data: { id: ids.bot, spaceId: ids.space, userId: ids.user, name: "b", color: "#000" },
    });
    await db.botPage.create({
      data: {
        id: ids.page,
        spaceId: ids.space,
        userId: ids.user,
        botId: ids.bot,
        title: "Cash",
        content: "",
        updatedBy: "user",
      },
    });
  });

  afterAll(async () => {
    if (!handle) return;
    await handle.prisma.organization.deleteMany({ where: { id: ids.org } });
    await handle.prisma.user.deleteMany({ where: { id: ids.user } });
    await handle.prisma.$disconnect();
    await handle.pool.end();
  });

  it("refuses two sources whose names differ only in case, and removes sources and snapshots with the page", async () => {
    const db = handle.prisma;
    const first = await db.pageSource.create({ data: source("Cash") });
    await expect(db.pageSource.create({ data: source("cash") })).rejects.toThrow(/Unique|unique/);
    await db.pageSource.create({ data: source("Revenue") });
    await db.pageSourceSnapshot.create({
      data: { spaceId: ids.space, sourceId: first.id, value: { a: 1 }, bytes: 7 },
    });
    await db.botPage.delete({ where: { id: ids.page } });
    expect(await db.pageSource.count({ where: { botId: ids.bot } })).toBe(0);
    expect(await db.pageSourceSnapshot.count({ where: { spaceId: ids.space } })).toBe(0);
  });
});
