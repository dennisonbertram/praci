import { createRouterClient } from "@orpc/server";
import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("sidebar folders over RPC (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `sf-org-${suffix}`;
  const spaceId = `sf-space-${suffix}`;
  const alice: Actor = {
    spaceId,
    userId: `sf-alice-${suffix}`,
    email: "a@example.test",
    isDeploymentOwner: false,
  };
  const bob: Actor = { ...alice, userId: `sf-bob-${suffix}`, email: "b@example.test" };
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  const client = (actor: Actor) =>
    createRouterClient(createRouter({ prisma } as unknown as RouterDeps), { context: { actor } });
  const bot = async (actor: Actor, name: string, spawnKey?: string) =>
    (
      await prisma.bot.create({
        data: { spaceId, userId: actor.userId, name, color: "#000", spawnKey },
      })
    ).id;

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    await prisma.user.createMany({
      data: [alice, bob].map((a) => ({
        id: a.userId,
        name: a.userId,
        email: `${a.userId}@x.test`,
      })),
    });
    await prisma.organization.create({
      data: {
        id: organizationId,
        name: "Folders Org",
        slug: organizationId,
        createdAt: new Date(),
      },
    });
    await prisma.space.create({ data: { id: spaceId, organizationId, name: spaceId } });
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: [alice.userId, bob.userId] } } });
    await close();
  });

  it("creates, collapses, lists privately, and deletes a folder without deleting chats", async () => {
    const folder = await client(alice).botSections.add({ name: "Ops" });
    expect(folder).toMatchObject({ name: "Ops", collapsed: false });
    expect(
      await client(alice).botSections.setCollapsed({ sectionId: folder.id, collapsed: true }),
    ).toMatchObject({ collapsed: true });
    expect((await client(alice).botSections.list()).map((f) => f.name)).toEqual(["Ops"]);
    expect(await client(bob).botSections.list()).toEqual([]);
    await expect(
      client(bob).botSections.setCollapsed({ sectionId: folder.id, collapsed: false }),
    ).rejects.toThrow();
    await expect(client(alice).botSections.add({ name: "Ops" })).rejects.toThrow();

    const chief = await bot(alice, "Chief");
    await client(alice).sidebar.move({ item: { kind: "bot", id: chief }, folderId: folder.id });
    expect((await prisma.bot.findUniqueOrThrow({ where: { id: chief } })).sectionId).toBe(
      folder.id,
    );
    await client(alice).botSections.remove({ sectionId: folder.id });
    expect((await prisma.bot.findUniqueOrThrow({ where: { id: chief } })).sectionId).toBeNull();
    expect(await client(alice).botSections.list()).toEqual([]);
  });

  it("auto-groups and restores through the API", async () => {
    await prisma.bot.deleteMany({ where: { spaceId } });
    await bot(alice, "Inbox", `inbox-agent:${alice.userId}`);
    await bot(alice, "Scout");
    const snapshot = await client(alice).sidebar.autoGroup();
    expect((await client(alice).botSections.list()).map((f) => f.name).sort()).toEqual([
      "Agents",
      "Workspace",
    ]);
    await client(alice).sidebar.restore(snapshot);
    expect(await client(alice).botSections.list()).toEqual([]);
    await expect(client(bob).sidebar.restore(snapshot)).rejects.toThrow();
  });
});
