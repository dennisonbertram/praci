import { inboxAgentSpawnKey, integrationAgentSpawnKey } from "@rakazo/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";
import { createRepos } from "./repos.js";
import {
  addSidebarFolder,
  autoGroupSidebar,
  moveSidebarFolder,
  moveSidebarItem,
  removeSidebarFolder,
  restoreSidebar,
  setSidebarFolderCollapsed,
} from "./sidebar-folders.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("sidebar folders (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `folders-org-${suffix}`;
  const spaceId = `folders-space-${suffix}`;
  const alice = { spaceId, userId: `folders-alice-${suffix}` };
  const bob = { spaceId, userId: `folders-bob-${suffix}` };
  const carol = { spaceId, userId: `folders-carol-${suffix}` };
  const userIds = [alice.userId, bob.userId, carol.userId];
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let n = 0;

  const bot = async (who: typeof alice, name: string, extra: Record<string, unknown> = {}) =>
    (
      await prisma.bot.create({
        data: { ...who, name, color: "#000", position: n++, ...extra },
      })
    ).id;
  const group = async (who: typeof alice, name: string, extra: Record<string, unknown> = {}) =>
    (await prisma.chatGroup.create({ data: { ...who, name, ...extra } })).id;
  const folders = async (who: typeof alice) =>
    (
      await createRepos(prisma).listBotSections({ ...who, email: "", isDeploymentOwner: false })
    ).map((f) => f.name);
  /** Ids in the order the sidebar shows them for a container (bots and groups together). */
  const order = async (who: typeof alice, sectionId: string | null) => {
    const [bots, groups] = await Promise.all([
      prisma.bot.findMany({ where: { ...who, sectionId, pinned: false, archivedAt: null } }),
      prisma.chatGroup.findMany({ where: { ...who, sectionId, pinned: false, archivedAt: null } }),
    ]);
    return [...bots, ...groups]
      .sort((a, b) => (a.position ?? 1e9) - (b.position ?? 1e9))
      .map((row) => row.name);
  };
  const ref = (kind: "bot" | "group", id: string) => ({ kind, id });

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    await prisma.user.createMany({
      data: userIds.map((id) => ({ id, name: id, email: `${id}@example.test` })),
    });
    await prisma.organization.create({
      data: { id: organizationId, name: "Folders", slug: organizationId, createdAt: new Date() },
    });
    await prisma.space.create({ data: { id: spaceId, organizationId, name: spaceId } });
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await close();
  });

  it("keeps last-activity time when organizing the sidebar", async () => {
    const old = new Date("2026-01-02T03:04:05.000Z");
    const stamp = async (kind: "bot" | "group", id: string) =>
      (kind === "bot"
        ? await prisma.bot.findUniqueOrThrow({ where: { id } })
        : await prisma.chatGroup.findUniqueOrThrow({ where: { id } })
      ).updatedAt.getTime();
    const setOld = async (kind: "bot" | "group", id: string) => {
      if (kind === "bot")
        await prisma.$executeRaw`UPDATE "bots" SET "updatedAt" = ${old} WHERE id = ${id}`;
      else await prisma.$executeRaw`UPDATE "chat_groups" SET "updatedAt" = ${old} WHERE id = ${id}`;
    };
    const b = await bot(carol, "Activity bot");
    const g = await group(carol, "Activity group");
    const pinned = await bot(carol, "Activity pinned", { pinned: true });
    const all = [ref("bot", b), ref("group", g), ref("bot", pinned)] as const;
    const resetAll = () => Promise.all(all.map((r) => setOld(r.kind, r.id)));
    const expectUntouched = async () => {
      for (const r of all) expect(await stamp(r.kind, r.id)).toBe(old.getTime());
    };
    await resetAll();
    const f = await addSidebarFolder(prisma, carol, "Activity");
    await moveSidebarItem(prisma, carol, { item: ref("bot", b), folderId: f.id });
    await moveSidebarItem(prisma, carol, { item: ref("group", g), folderId: f.id });
    await expectUntouched();
    await removeSidebarFolder(prisma, carol, f.id);
    await expectUntouched();
    const snapshot = await autoGroupSidebar(prisma, carol);
    expect(snapshot.placements.length).toBeGreaterThan(0);
    await expectUntouched();
    await restoreSidebar(prisma, carol, snapshot);
    await expectUntouched();
  });

  it("keeps folders private to the user and rejects another user's folder", async () => {
    const mine = await addSidebarFolder(prisma, alice, "Mine");
    expect(await folders(alice)).toEqual(["Mine"]);
    expect(await folders(bob)).toEqual([]);
    const bobBot = await bot(bob, "Bob bot");
    await expect(
      moveSidebarItem(prisma, bob, { item: ref("bot", bobBot), folderId: mine.id }),
    ).rejects.toThrow();
    await expect(setSidebarFolderCollapsed(prisma, bob, mine.id, true)).rejects.toThrow();
    await expect(removeSidebarFolder(prisma, bob, mine.id)).rejects.toThrow();
    await expect(
      moveSidebarItem(prisma, alice, { item: ref("bot", bobBot), folderId: null }),
    ).rejects.toThrow();
    expect(await folders(alice)).toEqual(["Mine"]);
    await removeSidebarFolder(prisma, alice, mine.id);
  });

  it("orders bots and groups together on move and across folders", async () => {
    const a = await bot(alice, "A");
    const b = await bot(alice, "B");
    const g = await group(alice, "G");
    const f = await addSidebarFolder(prisma, alice, "Ops");
    // Untouched: bots in creation order, groups after them.
    await moveSidebarItem(prisma, alice, {
      item: ref("group", g),
      folderId: null,
      beforeItem: ref("bot", a),
    });
    expect(await order(alice, null)).toEqual(["G", "A", "B"]);
    await moveSidebarItem(prisma, alice, { item: ref("bot", b), folderId: f.id });
    await moveSidebarItem(prisma, alice, {
      item: ref("bot", a),
      folderId: f.id,
      beforeItem: ref("bot", b),
    });
    expect(await order(alice, f.id)).toEqual(["A", "B"]);
    expect(await order(alice, null)).toEqual(["G"]);
    await expect(
      moveSidebarItem(prisma, alice, {
        item: ref("bot", a),
        folderId: null,
        beforeItem: ref("bot", b),
      }),
    ).rejects.toThrow();
    const second = await addSidebarFolder(prisma, alice, "Second");
    await moveSidebarFolder(prisma, alice, second.id, f.id);
    const sections = await createRepos(prisma).listBotSections({
      ...alice,
      email: "",
      isDeploymentOwner: false,
    });
    expect(sections.filter((s) => ["Ops", "Second"].includes(s.name)).map((s) => s.name)).toEqual([
      "Second",
      "Ops",
    ]);
  });

  it("deleting a folder moves its items to the root and deletes none", async () => {
    const ops = await prisma.botSection.findFirstOrThrow({ where: { ...alice, name: "Ops" } });
    await removeSidebarFolder(prisma, alice, ops.id);
    expect(await folders(alice)).not.toContain("Ops");
    expect(await order(alice, null)).toEqual(["G", "A", "B"]);
    expect(await prisma.bot.count({ where: { ...alice } })).toBe(2);
  });

  it("auto-groups unfiled items, reuses folders, and undo restores everything", async () => {
    await prisma.chatGroup.deleteMany({ where: alice });
    await prisma.bot.deleteMany({ where: alice });
    await prisma.botSection.deleteMany({ where: alice });
    const inbox = await bot(alice, "Inbox", { spawnKey: inboxAgentSpawnKey(alice.userId) });
    const mercury = await bot(alice, "Mercury", { spawnKey: integrationAgentSpawnKey("mercury") });
    const chief = await bot(alice, "Chief", { spawnKey: "onboarding:first" });
    const pinned = await bot(alice, "Pinned", { pinned: true });
    const g = await group(alice, "Ops group");
    const existing = await addSidebarFolder(prisma, alice, "Apps");
    const filed = await bot(alice, "Filed", { sectionId: existing.id });

    const snapshot = await autoGroupSidebar(prisma, alice);
    const names = async () => {
      const rows = await prisma.botSection.findMany({
        where: alice,
        include: { bots: true, groups: true },
      });
      return Object.fromEntries(
        rows.map((r) => [r.name, [...r.bots, ...r.groups].map((x) => x.name).sort()]),
      );
    };
    expect(await names()).toEqual({
      Apps: ["Filed", "Mercury"],
      Workspace: ["Inbox"],
      Agents: ["Chief"],
      Groups: ["Ops group"],
    });
    expect((await prisma.bot.findUniqueOrThrow({ where: { id: pinned } })).sectionId).toBeNull();
    expect(snapshot.createdFolderIds).toHaveLength(3);
    // Running it again changes nothing.
    expect((await autoGroupSidebar(prisma, alice)).placements).toEqual([]);

    await restoreSidebar(prisma, alice, snapshot);
    expect(await names()).toEqual({ Apps: ["Filed"] });
    expect(await order(alice, null)).toEqual(["Inbox", "Mercury", "Chief", "Ops group"]);
    expect(
      await prisma.bot.count({ where: { id: { in: [inbox, mercury, chief, filed, pinned] } } }),
    ).toBe(5);
    expect(await prisma.chatGroup.count({ where: { id: g } })).toBe(1);
    // Another user's snapshot cannot touch these rows.
    await expect(restoreSidebar(prisma, bob, snapshot)).rejects.toThrow();
  });
});
