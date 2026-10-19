import { randomUUID } from "node:crypto";
import type { Actor, AutoSortOperation } from "@rakazo/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";
import { createDataRoomRepos } from "./data-room.js";
import { createDataRoomAutoSortRepos } from "./data-room-autosort.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("data room auto-sort apply and undo (PostgreSQL)", () => {
  const run = randomUUID().slice(0, 8);
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let dr: ReturnType<typeof createDataRoomRepos>;
  let sort: ReturnType<typeof createDataRoomAutoSortRepos>;
  const spaceIds: string[] = [];

  beforeAll(async () => {
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    dr = createDataRoomRepos(prisma);
    sort = createDataRoomAutoSortRepos(prisma);
  });

  let n = 0;
  /** A new space with its owner, another user of that space, and the owner's second space. */
  const fresh = async () => {
    const id = `${run}-${++n}`;
    const space = async (label: string, userId: string): Promise<Actor> => {
      const orgId = `as-org-${label}-${id}`;
      const spaceId = `as-space-${label}-${id}`;
      await prisma.organization.create({
        data: { id: orgId, name: label, slug: orgId, createdAt: new Date() },
      });
      await prisma.space.create({
        data: {
          id: spaceId,
          organizationId: orgId,
          name: label,
          isDefault: true,
          createdByUserId: userId,
        },
      });
      spaceIds.push(spaceId);
      return { userId, spaceId, email: `${userId}@rakazo.test`, isDeploymentOwner: false };
    };
    for (const user of ["a", "b"]) {
      await prisma.user.create({
        data: {
          id: `as-user-${user}-${id}`,
          name: user,
          email: `as-${user}-${id}@rakazo.test`,
          emailVerified: false,
        },
      });
    }
    const a = await space("a", `as-user-a-${id}`);
    return {
      a,
      otherUser: { ...a, userId: `as-user-b-${id}` },
      otherSpace: await space("a2", a.userId),
    };
  };

  afterAll(async () => {
    if (!prisma) return;
    await prisma.space.deleteMany({ where: { id: { in: spaceIds } } });
    await prisma.organization.deleteMany({
      where: { id: { startsWith: "as-org-" }, slug: { contains: run } },
    });
    await prisma.user.deleteMany({ where: { id: { startsWith: "as-user-", contains: run } } });
    await close();
  });

  const file = async (actor: Actor, name: string, folderId: string | null) =>
    (
      await dr.createItem(actor, {
        source: "upload",
        sha256: `as-${name}-${actor.spaceId}-${actor.userId}`,
        name,
        mimeType: "image/png",
        size: 1,
        folderId,
      })
    ).item;

  /** Folders and items as (id, name, parent or folder), for comparing whole states. */
  const snapshot = async (actor: Actor) => ({
    folders: (await dr.listFolders(actor)).map((f) => [f.id, f.name, f.parentId]).sort(),
    items: (
      await prisma.dataRoomItem.findMany({
        where: { spaceId: actor.spaceId, userId: actor.userId },
      })
    )
      .map((i) => [i.id, i.name, i.folderId])
      .sort(),
  });

  const messy = async (actor: Actor) => {
    // Each caller gets its own actor, so folder names never clash.
    const ben = await dr.createFolder(actor, { name: "Benefits" });
    const ben2 = await dr.createFolder(actor, { name: "Benefits (2)" });
    const dental = await dr.createFolder(actor, { name: "Dental", parentId: ben2.id });
    const fin = await dr.createFolder(actor, { name: "Finance" });
    const plan = await file(actor, "plan.pdf", ben2.id);
    const policy = await file(actor, "policy.pdf", dental.id);
    const shot = await file(actor, "Screenshot 1.png", fin.id);
    const loose = await file(actor, "scan0001.pdf", null);
    const ops: AutoSortOperation[] = [
      {
        type: "merge_folder",
        key: "m",
        folderId: ben2.id,
        intoFolderId: ben.id,
        from: "Benefits (2)",
        into: "Benefits",
      },
      {
        type: "move_item",
        key: "mv1",
        itemId: plan.id,
        name: plan.name,
        fromFolderId: ben2.id,
        toPath: ["Benefits", "Health"],
        from: "",
        to: "",
      },
      {
        type: "move_item",
        key: "mv2",
        itemId: loose.id,
        name: loose.name,
        fromFolderId: null,
        toPath: ["Legal"],
        from: "",
        to: "",
      },
      {
        type: "rename_item",
        key: "r",
        itemId: shot.id,
        fromName: shot.name,
        toName: "Cap table.png",
      },
    ];
    return { ben, ben2, dental, plan, policy, shot, loose, ops };
  };

  it("merges, moves, creates folders and renames, then undo restores the exact prior state", async () => {
    const { a } = await fresh();
    const { ben, ben2, dental, plan, policy, shot, loose, ops } = await messy(a);
    const before = await snapshot(a);

    const done = await sort.apply(a, ops);
    expect(done.skipped).toEqual([]);
    // policy sits in a sub-folder that moved with its parent: its path changed too.
    expect(done.itemIds.sort()).toEqual([plan.id, policy.id, shot.id, loose.id].sort());

    const folders = await dr.listFolders(a);
    expect(folders.find((f) => f.id === ben2.id)).toBeUndefined();
    expect(folders.find((f) => f.id === dental.id)?.parentId).toBe(ben.id);
    const health = folders.find((f) => f.name === "Health");
    expect(health?.parentId).toBe(ben.id);
    expect((await prisma.dataRoomItem.findUniqueOrThrow({ where: { id: plan.id } })).folderId).toBe(
      health?.id,
    );
    expect((await prisma.dataRoomItem.findUniqueOrThrow({ where: { id: shot.id } })).name).toBe(
      "Cap table.png",
    );
    // Nothing was deleted.
    expect(
      await prisma.dataRoomItem.count({ where: { spaceId: a.spaceId, userId: a.userId } }),
    ).toBe(4); // policy, plan, shot, loose

    const undone = await sort.undo(a, done.batchId);
    expect(undone.skipped).toBe(0);
    expect(await snapshot(a)).toEqual(before);
    // A second undo finds nothing left to reverse.
    expect(await sort.undo(a, done.batchId)).toMatchObject({ restored: 0 });
  });

  it("skips operations whose items or folders changed since the plan", async () => {
    const { a } = await fresh();
    const { ben2, plan, shot, loose, ops } = await messy(a);
    await dr.moveItem(a, plan.id, null);
    await dr.updateItem(a, shot.id, { name: "Renamed by hand.png" });
    await dr.deleteItem(a, loose.id);
    const done = await sort.apply(a, ops);
    expect(done.skipped.map((s) => s.key).sort()).toEqual(["mv1", "mv2", "r"]);
    // The merge still ran.
    expect((await dr.listFolders(a)).find((f) => f.id === ben2.id)).toBeUndefined();
  });

  it("leaves another user's and another space's rows alone", async () => {
    const { a, otherUser, otherSpace } = await fresh();
    const mine = await messy(a);
    const theirs = await messy(otherUser);
    const done = await sort.apply(a, theirs.ops);
    expect(done.skipped).toHaveLength(theirs.ops.length);
    expect(await prisma.dataRoomFolder.count({ where: { id: theirs.ben2.id } })).toBe(1);
    expect(
      (await prisma.dataRoomItem.findUniqueOrThrow({ where: { id: theirs.shot.id } })).name,
    ).toBe("Screenshot 1.png");
    // The same ids from my other space do not match either.
    expect((await sort.apply(otherSpace, mine.ops)).skipped).toHaveLength(mine.ops.length);
    // Another actor cannot undo my batch.
    const real = await sort.apply(a, mine.ops);
    expect((await sort.undo(otherUser, real.batchId)).restored).toBe(0);
    expect((await sort.undo(otherSpace, real.batchId)).restored).toBe(0);
  });

  it("leaves a change alone on undo when its rows moved on", async () => {
    const { a } = await fresh();
    const { shot, ops } = await messy(a);
    const done = await sort.apply(a, ops);
    await dr.updateItem(a, shot.id, { name: "Edited later.png" });
    const undone = await sort.undo(a, done.batchId);
    expect(undone.skipped).toBe(1);
    expect((await prisma.dataRoomItem.findUniqueOrThrow({ where: { id: shot.id } })).name).toBe(
      "Edited later.png",
    );
  });

  it("does not re-parent a folder under its own descendant on undo", async () => {
    const { a } = await fresh();
    const p = await dr.createFolder(a, { name: "P" });
    const f = await dr.createFolder(a, { name: "F", parentId: p.id });
    const c = await dr.createFolder(a, { name: "C", parentId: f.id });
    const into = await dr.createFolder(a, { name: "I" });
    const done = await sort.apply(a, [
      {
        type: "merge_folder",
        key: "m",
        folderId: f.id,
        intoFolderId: into.id,
        from: "F",
        into: "I",
      },
    ]);
    await dr.moveFolder(a, p.id, c.id);
    const undone = await sort.undo(a, done.batchId);
    expect(undone.skipped).toBeGreaterThan(0);
    // Every folder still reaches the top without a loop.
    const all = new Map((await dr.listFolders(a)).map((x) => [x.id, x]));
    for (const folder of all.values()) {
      const seen = new Set<string>();
      for (
        let n: typeof folder | undefined = folder;
        n;
        n = n.parentId ? all.get(n.parentId) : undefined
      ) {
        expect(seen.has(n.id)).toBe(false);
        seen.add(n.id);
      }
    }
  });

  it("returns the items under restored folders so they are indexed again", async () => {
    const { a } = await fresh();
    const { policy, ops } = await messy(a);
    const done = await sort.apply(a, ops);
    const undone = await sort.undo(a, done.batchId);
    expect(undone.itemIds).toContain(policy.id);
  });
});
