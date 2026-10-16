import type { SidebarPageTemplate } from "@rakazo/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";
import { addSidebarPage, listSidebarPages, removeSidebarPage } from "./sidebar-pages.js";

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
    expect((await pages(owner)).map((p) => p.templateKey)).toContain("owned");
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
    expect((await pages(owner)).map((p) => p.templateKey)).not.toContain("owned");
    await prisma.spaceMember.update({
      where: { spaceId_userId: owner },
      data: { role: "owner" },
    });
    expect((await pages(owner)).map((p) => p.templateKey)).toContain("owned");
  });
});
