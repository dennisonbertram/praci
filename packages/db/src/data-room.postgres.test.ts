import { randomUUID } from "node:crypto";
import type { Actor } from "@rakazo/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type PrismaClient } from "./client.js";
import { createDataRoomRepos, DataRoomConflictError } from "./data-room.js";
import { IsolationError } from "./scope.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("data room repository (PostgreSQL)", () => {
  const run = randomUUID().slice(0, 8);
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let a: Actor;
  let b: Actor;
  /** A second member of space A. */
  let a2: Actor;
  let dr: ReturnType<typeof createDataRoomRepos>;
  const spaceIds: string[] = [];

  const upload = (actor: Actor, name: string, sha256: string, extra = {}) =>
    dr.createItem(actor, {
      source: "upload",
      sha256,
      name,
      mimeType: "text/plain",
      size: 10,
      storageKey: `blob/${sha256}`,
      ...extra,
    });

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    const make = async (label: string): Promise<Actor> => {
      const userId = `dr-user-${label}-${run}`;
      const orgId = `dr-org-${label}-${run}`;
      const spaceId = `dr-space-${label}-${run}`;
      await prisma.user.create({
        data: { id: userId, name: label, email: `${userId}@rakazo.test`, emailVerified: false },
      });
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
    a = await make("a");
    b = await make("b");
    a2 = { ...a, userId: `dr-user-a2-${run}`, email: `a2-${run}@rakazo.test` };
    dr = createDataRoomRepos(prisma);
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.space.deleteMany({ where: { id: { in: spaceIds } } });
    await prisma.organization.deleteMany({
      where: { id: { startsWith: "dr-org-" }, slug: { endsWith: run } },
    });
    await prisma.user.deleteMany({ where: { id: { endsWith: run, startsWith: "dr-user-" } } });
    await close();
  });

  it("keeps a second space out of reads, lists, search, moves and dedupe", async () => {
    const sha = `same-sha-${run}`;
    const folderA = await dr.createFolder(a, { name: "Contracts" });
    const { item: itemA } = await upload(a, "a.txt", sha, { folderId: folderA.id });
    await dr.replaceChunks(a, itemA.id, [
      { ordinal: 0, text: "master services agreement with Acme", contentHash: "h0" },
    ]);

    // Same bytes in another space is a different item, not a dedupe hit.
    const { item: itemB, created } = await upload(b, "b.txt", sha);
    expect(created).toBe(true);
    expect(itemB.id).not.toBe(itemA.id);

    await expect(dr.getItem(b, itemA.id)).rejects.toThrow(IsolationError);
    await expect(dr.updateItem(b, itemA.id, { name: "x" })).rejects.toThrow(IsolationError);
    await expect(dr.deleteItem(b, itemA.id)).rejects.toThrow(IsolationError);
    await expect(dr.replaceChunks(b, itemA.id, [])).rejects.toThrow(IsolationError);
    await expect(dr.moveItem(b, itemB.id, folderA.id)).rejects.toThrow(IsolationError);
    await expect(dr.createFolder(b, { name: "x", parentId: folderA.id })).rejects.toThrow(
      IsolationError,
    );
    await expect(dr.renameFolder(b, folderA.id, "y")).rejects.toThrow(IsolationError);
    await expect(dr.deleteFolder(b, folderA.id)).rejects.toThrow(IsolationError);
    expect(await dr.listFolders(b)).toEqual([]);
    expect((await dr.listItems(b, {})).map((i) => i.id)).toEqual([itemB.id]);
    expect(await dr.searchKeyword(b, { query: "agreement" })).toEqual([]);
    expect((await dr.searchKeyword(a, { query: "agreement" })).map((r) => r.item.id)).toEqual([
      itemA.id,
    ]);
    // Space A's row is untouched by every attempt above.
    expect((await dr.getItem(a, itemA.id)).name).toBe("a.txt");
  });

  it("keeps a second member of the same space out of the first member's items", async () => {
    const sha = `member-sha-${run}`;
    const folder = await dr.createFolder(a, { name: "Private" });
    const { item } = await upload(a, "mine.txt", sha, { folderId: folder.id });
    await dr.replaceChunks(a, item.id, [
      { ordinal: 0, text: "confidential quokka report", contentHash: "q" },
    ]);
    await expect(dr.getItem(a2, item.id)).rejects.toThrow(IsolationError);
    await expect(dr.updateItem(a2, item.id, { name: "x" })).rejects.toThrow(IsolationError);
    await expect(dr.moveItem(a2, item.id, null)).rejects.toThrow(IsolationError);
    await expect(dr.deleteItem(a2, item.id)).rejects.toThrow(IsolationError);
    await expect(dr.replaceChunks(a2, item.id, [])).rejects.toThrow(IsolationError);
    await expect(dr.renameFolder(a2, folder.id, "y")).rejects.toThrow(IsolationError);
    expect(await dr.listFolders(a2)).toEqual([]);
    expect(await dr.listItems(a2, {})).toEqual([]);
    expect(await dr.searchKeyword(a2, { query: "quokka" })).toEqual([]);
    // The same bytes from the second member are their own item.
    const second = await upload(a2, "theirs.txt", sha);
    expect(second.created).toBe(true);
    expect(second.item.id).not.toBe(item.id);
    expect((await dr.getItem(a, item.id)).name).toBe("mine.txt");
  });

  it("dedupes uploads by sha256 within a space and member", async () => {
    const first = await upload(a, "dup.txt", `dup-${run}`);
    const second = await upload(a, "other-name.txt", `dup-${run}`);
    expect(second.created).toBe(false);
    expect(second.item.id).toBe(first.item.id);
  });

  it("enforces folder names at the root and nested", async () => {
    const root = await dr.createFolder(a, { name: "Root-unique" });
    await expect(dr.createFolder(a, { name: "Root-unique" })).rejects.toThrow(
      DataRoomConflictError,
    );
    const child = await dr.createFolder(a, { name: "Kid", parentId: root.id });
    await expect(dr.createFolder(a, { name: "Kid", parentId: root.id })).rejects.toThrow(
      DataRoomConflictError,
    );
    // Same name under a different parent and in another space is fine.
    await dr.createFolder(a, { name: "Kid" });
    await dr.createFolder(b, { name: "Root-unique" });
    const other = await dr.createFolder(a, { name: "Other" });
    await expect(dr.moveFolder(a, child.id, other.id)).resolves.toMatchObject({
      parentId: other.id,
    });
    await expect(dr.moveFolder(a, root.id, root.id)).rejects.toThrow(DataRoomConflictError);
    await expect(dr.moveFolder(a, other.id, child.id)).rejects.toThrow(DataRoomConflictError);
  });

  it("refuses to delete a non-empty folder", async () => {
    const folder = await dr.createFolder(a, { name: "Full" });
    const { item } = await upload(a, "in-folder.txt", `full-${run}`, { folderId: folder.id });
    await expect(dr.deleteFolder(a, folder.id)).rejects.toThrow(DataRoomConflictError);
    await dr.moveItem(a, item.id, null);
    await dr.deleteFolder(a, folder.id);
    expect((await dr.listFolders(a)).some((f) => f.id === folder.id)).toBe(false);
  });

  it("hard delete removes chunks and returns the storage key", async () => {
    const { item } = await upload(a, "gone.txt", `gone-${run}`);
    await dr.replaceChunks(a, item.id, [{ ordinal: 0, text: "ephemeral", contentHash: "x" }]);
    expect(await dr.deleteItem(a, item.id)).toEqual({ storageKey: `blob/gone-${run}` });
    const rows = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM data_room_chunks WHERE "itemId" = ${item.id}`;
    expect(Number(rows[0]!.n)).toBe(0);
  });

  it("replaces only changed chunks", async () => {
    const { item } = await upload(a, "chunks.txt", `chunks-${run}`);
    const first = await dr.replaceChunks(a, item.id, [
      { ordinal: 0, text: "alpha", contentHash: "h-a" },
      { ordinal: 1, text: "beta", contentHash: "h-b" },
    ]);
    expect(first).toEqual({ written: 2, skipped: 0, removed: 0 });
    // Simulate an embedding on chunk 0 and 1; a changed chunk must lose its stale vector.
    const vec = `[${Array.from({ length: 1024 }, () => 0.1).join(",")}]`;
    await prisma.$executeRaw`UPDATE data_room_chunks SET embedding = ${vec}::vector,
      "embeddingModel" = 'm' WHERE "itemId" = ${item.id}`;
    const second = await dr.replaceChunks(a, item.id, [
      { ordinal: 0, text: "alpha", contentHash: "h-a" },
      { ordinal: 1, text: "beta changed", contentHash: "h-b2" },
    ]);
    expect(second).toEqual({ written: 1, skipped: 1, removed: 0 });
    const rows = await prisma.$queryRaw<
      { ordinal: number; hasVec: boolean; text: string }[]
    >`SELECT ordinal, text, embedding IS NOT NULL AS "hasVec" FROM data_room_chunks
      WHERE "itemId" = ${item.id} ORDER BY ordinal`;
    expect(rows).toEqual([
      { ordinal: 0, text: "alpha", hasVec: true },
      { ordinal: 1, text: "beta changed", hasVec: false },
    ]);
    const third = await dr.replaceChunks(a, item.id, [
      { ordinal: 0, text: "alpha", contentHash: "h-a" },
    ]);
    expect(third).toEqual({ written: 0, skipped: 1, removed: 1 });

    // Re-embedding after a model change is not skipped, even with identical text.
    const chunk = [{ ordinal: 0, text: "alpha", contentHash: "h-a" }];
    await prisma.$executeRaw`UPDATE data_room_chunks SET embedding = ${vec}::vector,
      "embeddingModel" = 'm1' WHERE "itemId" = ${item.id}`;
    expect(await dr.replaceChunks(a, item.id, chunk, { embeddingModel: "m1" })).toMatchObject({
      written: 0,
      skipped: 1,
    });
    expect(await dr.replaceChunks(a, item.id, chunk, { embeddingModel: "m2" })).toMatchObject({
      written: 1,
      skipped: 0,
    });
    const after = await prisma.$queryRaw<{ hasVec: boolean }[]>`
      SELECT embedding IS NOT NULL AS "hasVec" FROM data_room_chunks WHERE "itemId" = ${item.id}`;
    expect(after[0]!.hasVec).toBe(false);
  });

  it("ranks keyword results, applies facet filters and caps the limit", async () => {
    const strong = await upload(a, "strong.txt", `strong-${run}`, {
      docType: "invoice",
      docDate: new Date("2026-03-10"),
      parties: ["Zephyr Corp"],
    });
    const weak = await upload(a, "weak.txt", `weak-${run}`, {
      docType: "memo",
      docDate: new Date("2025-01-10"),
      parties: ["Other LLC"],
    });
    await dr.replaceChunks(a, strong.item.id, [
      {
        ordinal: 0,
        text: "zorblax zorblax zorblax invoice for zorblax services",
        contentHash: "1",
      },
    ]);
    await dr.replaceChunks(a, weak.item.id, [
      {
        ordinal: 0,
        text: "meeting notes mention zorblax once among many other unrelated words",
        contentHash: "2",
      },
      { ordinal: 1, text: "nothing relevant here", contentHash: "3" },
    ]);

    const all = await dr.searchKeyword(a, { query: "zorblax" });
    expect(all.map((r) => r.item.id)).toEqual([strong.item.id, weak.item.id]);
    expect(all[0]).toMatchObject({ ordinal: 0 });
    expect(all[0]!.snippet).toContain("<b>zorblax</b>");

    const byType = await dr.searchKeyword(a, { query: "zorblax", filters: { docType: "memo" } });
    expect(byType.map((r) => r.item.id)).toEqual([weak.item.id]);
    const byParty = await dr.searchKeyword(a, {
      query: "zorblax",
      filters: { party: "Zephyr Corp" },
    });
    expect(byParty.map((r) => r.item.id)).toEqual([strong.item.id]);
    const byDate = await dr.searchKeyword(a, {
      query: "zorblax",
      filters: { docDateFrom: new Date("2026-01-01"), docDateTo: new Date("2026-12-31") },
    });
    expect(byDate.map((r) => r.item.id)).toEqual([strong.item.id]);

    expect(await dr.searchKeyword(a, { query: "zorblax", limit: 1 })).toHaveLength(1);
    expect(await dr.searchKeyword(a, { query: "" })).toEqual([]);
    // limit is clamped to 50 and never rejected
    expect(
      (await dr.searchKeyword(a, { query: "zorblax", limit: 5000 })).length,
    ).toBeLessThanOrEqual(50);
  });
});
