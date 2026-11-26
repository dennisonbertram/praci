import type { SidebarPageTemplate } from "@rakazo/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";
import {
  addSidebarBotPage,
  addSidebarPage,
  listSidebarPages,
  removeSidebarBotPage,
  removeSidebarPage,
} from "./sidebar-pages.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

const page = (key: string, over: Partial<SidebarPageTemplate> = {}): SidebarPageTemplate => ({
  key,
  route: `/app/${key}`,
  platforms: ["web"],
  available: true,
  ...over,
});
const templates = [
  page("alpha"),
  page("beta"),
  page("off", { available: false }),
  page("owned", { ownerOnly: true }),
];

describePostgres("sidebar pages (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `sidebar-org-${suffix}`;
  const owner = {
    spaceId: `sidebar-space-a-${suffix}`,
    userId: `sidebar-user-a-${suffix}`,
  };
  const member = { spaceId: owner.spaceId, userId: `sidebar-user-b-${suffix}` };
  const otherSpace = {
    spaceId: `sidebar-space-b-${suffix}`,
    userId: owner.userId,
  };
  const userIds = [owner.userId, member.userId];
  const pages = async (who: typeof owner) => (await listSidebarPages(prisma, who, templates)).pages;
  let prisma: PrismaClient;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    await prisma.user.createMany({
      data: userIds.map((id) => ({
        id,
        name: id,
        email: `${id}@example.test`,
      })),
    });
    await prisma.organization.create({
      data: {
        id: organizationId,
        name: "Sidebar Org",
        slug: organizationId,
        createdAt: new Date(),
      },
    });
    await prisma.space.createMany({
      data: [owner.spaceId, otherSpace.spaceId].map((id) => ({
        id,
        organizationId,
        name: id,
      })),
    });
    await prisma.member.createMany({
      data: userIds.map((userId) => ({
        id: `m-${userId}`,
        organizationId,
        userId,
        role: "member",
        createdAt: new Date(),
      })),
    });
    await prisma.spaceMember.createMany({
      data: [
        { ...owner, role: "owner" },
        { ...member, role: "member" },
        { ...otherSpace, role: "member" },
      ].map((m) => ({
        id: `sm-${m.spaceId}-${m.userId}`,
        organizationId,
        createdAt: new Date(),
        ...m,
      })),
    });
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await close();
  });

  it("adds idempotently, lists in order, and removes (missing is a no-op)", async () => {
    await addSidebarPage(prisma, owner, "alpha", templates);
    await addSidebarPage(prisma, owner, "beta", templates);
    await addSidebarPage(prisma, owner, "alpha", templates);
    expect(await pages(owner)).toEqual([{ templateKey: "alpha" }, { templateKey: "beta" }]);
    await removeSidebarPage(prisma, owner, "alpha");
    await removeSidebarPage(prisma, owner, "alpha");
    expect(await pages(owner)).toEqual([{ templateKey: "beta" }]);
  });

  it("keeps pages private to the user and the space", async () => {
    expect(await pages(member)).toEqual([]);
    expect(await pages(otherSpace)).toEqual([]);
    await removeSidebarPage(prisma, member, "beta");
    expect(await pages(owner)).toEqual([{ templateKey: "beta" }]);
  });

  it("rejects unknown and unavailable templates", async () => {
    await expect(addSidebarPage(prisma, owner, "nope", templates)).rejects.toMatchObject({
      code: "unknown",
    });
    await expect(addSidebarPage(prisma, owner, "off", templates)).rejects.toMatchObject({
      code: "unavailable",
    });
  });

  it("lets only the space owner add an owner-only template", async () => {
    await expect(addSidebarPage(prisma, member, "owned", templates)).rejects.toMatchObject({
      code: "owner_only",
    });
    await expect(addSidebarPage(prisma, otherSpace, "owned", templates)).rejects.toMatchObject({
      code: "owner_only",
    });
    await addSidebarPage(prisma, owner, "owned", templates);
    expect((await pages(owner)).map((p) => ("templateKey" in p ? p.templateKey : ""))).toContain(
      "owned",
    );
  });

  it("offers owner-only templates in addable only to the space owner", async () => {
    await removeSidebarPage(prisma, owner, "owned");
    const ownerState = await listSidebarPages(prisma, owner, templates);
    const memberState = await listSidebarPages(prisma, member, templates);
    expect(ownerState.addable).toContain("owned");
    expect(memberState.addable).toEqual(["alpha", "beta"]);
    expect(ownerState.addable).not.toContain("off");
    expect(ownerState.addable).not.toContain("beta");
  });

  it("hides a saved owner-only page from a caller who is no longer the owner", async () => {
    await addSidebarPage(prisma, owner, "owned", templates);
    await prisma.spaceMember.update({
      where: { spaceId_userId: owner },
      data: { role: "member" },
    });
    expect(
      (await pages(owner)).map((p) => ("templateKey" in p ? p.templateKey : "")),
    ).not.toContain("owned");
    await prisma.spaceMember.update({
      where: { spaceId_userId: owner },
      data: { role: "owner" },
    });
    expect((await pages(owner)).map((p) => ("templateKey" in p ? p.templateKey : ""))).toContain(
      "owned",
    );
  });

  describe("bot pages", () => {
    const bot = (id: string, spaceId: string, userId: string, over = {}) =>
      prisma.bot.create({
        data: { id: `${id}-${suffix}`, spaceId, userId, name: id, color: "#000000", ...over },
      });
    const botPage = (id: string, botId: string, spaceId: string, title: string) =>
      prisma.botPage.create({
        data: {
          id: `${id}-${suffix}`,
          botId: `${botId}-${suffix}`,
          spaceId,
          userId: botId === "bot-b" ? member.userId : owner.userId,
          updatedBy: "bot",
          title,
          content: "",
        },
      });
    const pid = (id: string) => `${id}-${suffix}`;

    beforeAll(async () => {
      await bot("bot-a", owner.spaceId, owner.userId);
      await bot("bot-b", owner.spaceId, member.userId);
      await bot("bot-c", otherSpace.spaceId, owner.userId);
      await bot("bot-old", owner.spaceId, owner.userId, { archivedAt: new Date() });
      await botPage("pg-a1", "bot-a", owner.spaceId, "Cash");
      await botPage("pg-a2", "bot-a", owner.spaceId, "Burn");
      await botPage("pg-b", "bot-b", owner.spaceId, "Private");
      await botPage("pg-c", "bot-c", otherSpace.spaceId, "Elsewhere");
      await botPage("pg-old", "bot-old", owner.spaceId, "Archived");
    });

    it("lists only the user's own bot pages, grouped by bot, and adds, lists and removes one", async () => {
      const before = await listSidebarPages(prisma, owner, templates);
      expect(before.botPages).toEqual([
        {
          botId: pid("bot-a"),
          pages: [
            { id: pid("pg-a1"), title: "Cash" },
            { id: pid("pg-a2"), title: "Burn" },
          ],
        },
      ]);
      const after = await addSidebarBotPage(prisma, owner, pid("pg-a1"), templates);
      await addSidebarBotPage(prisma, owner, pid("pg-a1"), templates);
      expect(after.pages).toContainEqual({
        pageId: pid("pg-a1"),
        botId: pid("bot-a"),
        title: "Cash",
      });
      expect(after.botPages[0]?.pages).toEqual([{ id: pid("pg-a2"), title: "Burn" }]);
      const removed = await removeSidebarBotPage(prisma, owner, pid("pg-a1"), templates);
      expect(removed.pages.some((p) => "pageId" in p)).toBe(false);
      expect(removed.botPages[0]?.pages).toHaveLength(2);
    });

    it("refuses another user's bot, another space's page, an archived bot and an unknown page", async () => {
      for (const [who, id] of [
        [owner, "pg-b"],
        [member, "pg-a1"],
        [owner, "pg-c"],
        [otherSpace, "pg-a1"],
        [owner, "pg-old"],
      ] as const) {
        await expect(addSidebarBotPage(prisma, who, pid(id), templates)).rejects.toMatchObject({
          code: "unknown",
        });
      }
      await expect(addSidebarBotPage(prisma, owner, "missing", templates)).rejects.toMatchObject({
        code: "unknown",
      });
    });

    it("does not let one user remove another's row, and drops a row when its bot is archived", async () => {
      await addSidebarBotPage(prisma, owner, pid("pg-a2"), templates);
      await removeSidebarBotPage(prisma, member, pid("pg-a2"), templates);
      expect((await pages(owner)).some((p) => "pageId" in p)).toBe(true);
      await prisma.bot.update({ where: { id: pid("bot-a") }, data: { archivedAt: new Date() } });
      expect((await pages(owner)).some((p) => "pageId" in p)).toBe(false);
      await prisma.bot.update({ where: { id: pid("bot-a") }, data: { archivedAt: null } });
    });

    it("removes the sidebar row when the page is deleted", async () => {
      expect((await pages(owner)).some((p) => "pageId" in p)).toBe(true);
      await prisma.botPage.delete({ where: { id: pid("pg-a2") } });
      expect(await prisma.sidebarPage.count({ where: { pageId: pid("pg-a2") } })).toBe(0);
    });

    it("requires exactly one of templateKey and pageId", async () => {
      const base = { spaceId: owner.spaceId, userId: owner.userId, position: 99 };
      await expect(prisma.sidebarPage.create({ data: base })).rejects.toThrow();
      await expect(
        prisma.sidebarPage.create({ data: { ...base, templateKey: "x", pageId: pid("pg-a1") } }),
      ).rejects.toThrow();
    });
  });
});
