import { randomUUID } from "node:crypto";
import type { Actor } from "@rakazo/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";
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
    expect((await dr.moveItem(a, item.id, null)).folderId).toBeNull();
    expect((await dr.moveItem(a, item.id, folder.id)).folderId).toBe(folder.id);
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
    expect(all[0]!.snippet).toContain("\u0001zorblax\u0002");
    expect(all[0]!.snippet).not.toContain("<b>");

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

  it("shows the matching text, not the name, when both match, ranked by the better match", async () => {
    const { item } = await upload(a, "glimmer-lease.txt", `glimmer-${run}`);
    await dr.replaceChunks(a, item.id, [
      { ordinal: -1, text: "glimmer lease glimmer lease", contentHash: "m" },
      { ordinal: 0, text: "the glimmer renewal date is January 31", contentHash: "t" },
    ]);
    const [hit] = await dr.searchKeyword(a, { query: "glimmer" });
    expect(hit).toMatchObject({ ordinal: 0 });
    expect(hit!.snippet).toContain("renewal date");
  });

  it("marks highlights with control characters and strips forged markers", async () => {
    const { item } = await upload(a, "hostile.txt", `hostile-${run}`);
    await dr.replaceChunks(a, item.id, [
      { ordinal: 0, text: "plinth \u0001forged\u0002 <script>alert(1)</script>", contentHash: "s" },
    ]);
    const stored = await prisma.$queryRaw<{ text: string }[]>`
      SELECT text FROM data_room_chunks WHERE "itemId" = ${item.id}`;
    expect(stored[0]!.text).toBe("plinth forged <script>alert(1)</script>");
    const [hit] = await dr.searchKeyword(a, { query: "plinth" });
    // Our markers are the only highlight syntax; the document's own text stays literal text.
    expect(hit!.snippet).toContain("\u0001plinth\u0002");
    expect(hit!.snippet).not.toContain("<b>");
    expect(hit!.snippet.split("\u0001")).toHaveLength(2);
    expect(hit!.snippet.split("\u0002")).toHaveLength(2);
  });

  it("never forms a folder cycle under concurrent moves", async () => {
    const x = await dr.createFolder(a, { name: `cyc-x-${run}` });
    const y = await dr.createFolder(a, { name: `cyc-y-${run}` });
    const results = await Promise.allSettled([
      dr.moveFolder(a, x.id, y.id),
      dr.moveFolder(a, y.id, x.id),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const fx = await prisma.dataRoomFolder.findUniqueOrThrow({ where: { id: x.id } });
    const fy = await prisma.dataRoomFolder.findUniqueOrThrow({ where: { id: y.id } });
    expect(fx.parentId === y.id && fy.parentId === x.id).toBe(false);
  });

  it("does not lose a child created while its parent is deleted", async () => {
    for (let i = 0; i < 5; i++) {
      const parent = await dr.createFolder(a, { name: `race-${i}-${run}` });
      const [del, add] = await Promise.allSettled([
        dr.deleteFolder(a, parent.id),
        dr.createFolder(a, { name: "child", parentId: parent.id }),
      ]);
      const children = await prisma.dataRoomFolder.count({ where: { parentId: parent.id } });
      const parentExists = (await prisma.dataRoomFolder.count({ where: { id: parent.id } })) === 1;
      if (add.status === "fulfilled") {
        // Child exists, so the delete must have been refused and the parent kept.
        expect(del.status).toBe("rejected");
        expect(parentExists && children === 1).toBe(true);
      } else {
        // Child refused (parent already gone): no orphan row remains.
        expect(del.status).toBe("fulfilled");
        expect(children).toBe(0);
      }
    }
  });

  it("serializes concurrent chunk replacements into one complete set", async () => {
    const { item } = await upload(a, "race-chunks.txt", `race-chunks-${run}`);
    const setA = [0, 1, 2, 3].map((n) => ({
      ordinal: n,
      text: `from a ${n}`,
      contentHash: `a${n}`,
    }));
    const setB = [0, 1].map((n) => ({ ordinal: n, text: `from b ${n}`, contentHash: `b${n}` }));
    await Promise.all([dr.replaceChunks(a, item.id, setA), dr.replaceChunks(a, item.id, setB)]);
    const rows = await prisma.$queryRaw<{ ordinal: number; contentHash: string }[]>`
      SELECT ordinal, "contentHash" FROM data_room_chunks WHERE "itemId" = ${item.id}
      ORDER BY ordinal`;
    const expected = (set: typeof setA) =>
      set.map((c) => ({ ordinal: c.ordinal, contentHash: c.contentHash }));
    expect([expected(setA), expected(setB)]).toContainEqual(rows);
  });

  it("dedupes external ids per owner, including with no connection", async () => {
    const external = (actor: Actor, sha: string) =>
      dr.createItem(actor, {
        source: "chat",
        sha256: sha,
        name: "msg",
        mimeType: "text/plain",
        size: 1,
        externalId: `ext-${run}`,
      });
    const first = await external(a, "e1");
    await expect(external(a, "e2")).resolves.toMatchObject({
      created: false,
      item: { id: first.item.id },
    });
    // The same external id for another member or space is a different item.
    await expect(external(a2, "e3")).resolves.toMatchObject({ created: true });
    await expect(external(b, "e4")).resolves.toMatchObject({ created: true });
  });

  it("returns the existing item for a repeated import of the same source id", async () => {
    const connection = await prisma.connection.create({
      data: {
        spaceId: a.spaceId,
        userId: a.userId,
        connectorId: "google",
        provider: "gmail",
        displayName: "Test mail",
        status: "connected",
      },
    });
    const imported = (sha: string) =>
      dr.createItem(a, {
        source: "gmail",
        sha256: sha,
        name: "invoice.pdf",
        mimeType: "application/pdf",
        size: 1,
        sourceConnectionId: connection.id,
        externalId: `gmail:m1-${run}:att1`,
      });
    const first = await imported("i1");
    expect(first.created).toBe(true);
    const again = await imported("i2");
    expect(again).toMatchObject({ created: false });
    expect(again.item.id).toBe(first.item.id);
  });

  it("writes only to the caller's own rows", async () => {
    const { item } = await upload(a, "mine2.txt", `mine2-${run}`);
    const folder = await dr.createFolder(a, { name: `own-${run}` });
    const mine = await dr.createFolder(a2, { name: `a2-${run}` });
    await expect(dr.updateItem(a2, item.id, { name: "hacked" })).rejects.toThrow(IsolationError);
    await expect(dr.moveItem(a2, item.id, mine.id)).rejects.toThrow(IsolationError);
    await expect(dr.renameFolder(a2, folder.id, "hacked")).rejects.toThrow(IsolationError);
    await expect(dr.moveFolder(a2, folder.id, mine.id)).rejects.toThrow(IsolationError);
    await expect(dr.deleteItem(a2, item.id)).rejects.toThrow(IsolationError);
    expect((await dr.getItem(a, item.id)).name).toBe("mine2.txt");
    expect((await dr.getItem(a, item.id)).folderId).toBeNull();
    const after = await prisma.dataRoomFolder.findUniqueOrThrow({ where: { id: folder.id } });
    expect(after).toMatchObject({ name: `own-${run}`, parentId: null });
  });

  it("refuses to delete a folder that holds another owner's child row", async () => {
    const parent = await dr.createFolder(a, { name: `foreign-parent-${run}` });
    await prisma.$executeRaw`
      INSERT INTO data_room_folders (id, "spaceId", "userId", "parentId", name, "createdBy", "updatedAt")
      VALUES (${randomUUID()}, ${a.spaceId}, ${a2.userId}, ${parent.id}, 'foreign', 'user', now())`;
    await expect(dr.deleteFolder(a, parent.id)).rejects.toThrow(DataRoomConflictError);
    expect(await prisma.dataRoomFolder.count({ where: { parentId: parent.id } })).toBe(1);
  });

  it("rejects a page cursor from another sort direction or field", async () => {
    for (const n of ["x", "y", "z"]) await upload(b, `cursor-${n}.txt`, `cursor-sha-${n}-${run}`);
    const asc = { field: "name", direction: "asc" } as const;
    const first = await dr.listItemsPage(b, {}, { sort: asc, limit: 1 });
    expect(first.nextCursor).toBeTruthy();
    // Same sort continues where the first page stopped.
    const next = await dr.listItemsPage(b, {}, { sort: asc, limit: 1, cursor: first.nextCursor! });
    expect(next.items[0]?.id).not.toBe(first.items[0]?.id);
    for (const sort of [
      { field: "name", direction: "desc" },
      { field: "type", direction: "asc" },
    ] as const) {
      await expect(
        dr.listItemsPage(b, {}, { sort, limit: 1, cursor: first.nextCursor! }),
      ).rejects.toThrow(DataRoomConflictError);
    }
  });

  describe("hybrid search", () => {
    const MODEL = `hyb-model-${run}`;
    /** A 1024-number vector that is `weight` along axis `axis` and 0 elsewhere. */
    const unit = (axis: number, weight = 1, axis2 = -1, weight2 = 0) =>
      Array.from({ length: 1024 }, (_, k) => (k === axis ? weight : k === axis2 ? weight2 : 0));
    const put = async (
      actor: Actor,
      label: string,
      text: string,
      vector: number[] | null,
      model = MODEL,
    ) => {
      const { item } = await upload(actor, `${label}.txt`, `hyb-${label}-${run}`);
      const contentHash = `hash-${label}-${run}`;
      await dr.replaceChunks(actor, item.id, [{ ordinal: 0, text, contentHash }]);
      if (vector)
        await dr.saveEmbeddings(actor, item.id, model, [{ ordinal: 0, contentHash, vector }], 0);
      return item;
    };
    const ids = (results: { item: { id: string } }[]) => results.map((r) => r.item.id);

    it("ranks the nearest chunk first when no keyword matches", async () => {
      const near = await put(a, "near", "alpha one", unit(0));
      const mid = await put(a, "mid", "alpha two", unit(0, 0.5, 1, 1));
      const far = await put(a, "far", "alpha three", unit(7));
      const page = await dr.searchPage(a, {
        query: `nosuchword${run}`,
        vector: unit(0, 1, 1, 0.1),
        embeddingModel: MODEL,
        limit: 10,
      });
      expect(ids(page.results)).toEqual([near.id, mid.id, far.id]);
    });

    it("fuses the keyword and vector legs by reciprocal rank", async () => {
      const q = `fusion${run}`;
      const both = await put(a, "both", `${q} ${q} ${q}`, unit(20, 1, 21, 0.2));
      const keywordOnly = await put(a, "kw", `${q} and some padding words`, unit(30));
      const vectorOnly = await put(a, "vec", "unrelated text", unit(20));
      const { results } = await dr.searchPage(a, {
        query: q,
        vector: unit(20),
        embeddingModel: MODEL,
        limit: 10,
      });
      // both: keyword rank 1 + vector rank 2; vector-only: vector rank 1; keyword-only: keyword rank 2.
      expect(ids(results).slice(0, 3)).toEqual([both.id, keywordOnly.id, vectorOnly.id]);
      expect(results[0]?.score).toBeCloseTo(1 / 61 + 1 / 62, 10);
      expect(results[2]?.score).toBeCloseTo(1 / 61, 10);
    });

    it("compares only chunks embedded by the given model", async () => {
      const stale = await put(a, "stale", "stalechunk", unit(40), `other-${run}`);
      const current = await put(a, "current", "currentchunk", unit(41));
      const { results } = await dr.searchPage(a, {
        query: `nosuchword${run}`,
        vector: unit(40),
        embeddingModel: MODEL,
      });
      expect(ids(results)).toContain(current.id);
      expect(ids(results)).not.toContain(stale.id);
    });

    it("never returns another member's or another space's chunks, even when nearer", async () => {
      const own = await put(a, "own", "ownchunk", unit(50, 1, 51, 1));
      const member = await put(a2, "member", "memberchunk", unit(50));
      const space = await put(b, "space", "spacechunk", unit(50));
      const { results } = await dr.searchPage(a, {
        query: `nosuchword${run}`,
        vector: unit(50),
        embeddingModel: MODEL,
      });
      expect(ids(results)).toContain(own.id);
      expect(ids(results)).not.toContain(member.id);
      expect(ids(results)).not.toContain(space.id);
    });

    it("pages fused relevance results without gaps or repeats", async () => {
      const q = `paging${run}`;
      for (let i = 0; i < 7; i++) {
        await put(a, `page${i}`, i % 2 ? `${q} word` : "plain words", unit(60, 1, 61 + i, i / 10));
      }
      const input = { query: q, vector: unit(60), embeddingModel: MODEL };
      const whole = ids((await dr.searchPage(a, { ...input, limit: 50 })).results).filter(
        (id) => id,
      );
      const collected: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await dr.searchPage(a, { ...input, limit: 3, cursor });
        collected.push(...ids(page.results));
        cursor = page.nextCursor ?? undefined;
      } while (cursor);
      expect(collected).toEqual(whole);
      expect(new Set(collected).size).toBe(collected.length);
      expect(collected.length).toBeGreaterThanOrEqual(7);
    });

    it("still searches by keyword alone, and when the vector finds nothing embedded", async () => {
      const q = `lonely${run}`;
      const only = await put(a, "lonely", `${q} text`, null);
      const keyword = await dr.searchPage(a, { query: q });
      expect(ids(keyword.results)).toEqual([only.id]);
      const withVector = await dr.searchPage(a, {
        query: q,
        vector: unit(900),
        embeddingModel: `empty-${run}`,
      });
      expect(ids(withVector.results)).toEqual([only.id]);
    });

    it("moves ready items back to a step only when they need it", async () => {
      const skipped = await put(a, "skipped", "needs classify", null);
      await prisma.dataRoomItem.update({ where: { id: skipped.id }, data: { status: "ready" } });
      await prisma.dataRoomItemText.create({
        data: { itemId: skipped.id, spaceId: a.spaceId, userId: a.userId, text: "body" },
      });
      expect(await dr.requeueReady(a, "classify")).toContain(skipped.id);
      expect(
        (await prisma.dataRoomItem.findUniqueOrThrow({ where: { id: skipped.id } })).status,
      ).toBe("classifying");
      expect(await dr.requeueReady(b, "classify")).not.toContain(skipped.id);
    });

    it("never sends an item that already has a type, date or parties back to classify", async () => {
      const tagged = await put(a, "tagged", "already tagged", null);
      await prisma.dataRoomItem.update({
        where: { id: tagged.id },
        data: { status: "ready", docType: "Lease", parties: ["Landlord (Mock)"] },
      });
      await prisma.dataRoomItemText.create({
        data: { itemId: tagged.id, spaceId: a.spaceId, userId: a.userId, text: "body" },
      });
      expect(await dr.requeueReady(a, "classify")).not.toContain(tagged.id);
      const after = await prisma.dataRoomItem.findUniqueOrThrow({ where: { id: tagged.id } });
      expect([after.status, after.docType]).toEqual(["ready", "Lease"]);
    });

    it("counts the items directly in each folder", async () => {
      const parent = await dr.createFolder(a, { name: `count-${run}` });
      const child = await dr.createFolder(a, { name: "child", parentId: parent.id });
      const one = await put(a, "c1", "count one", null);
      const two = await put(a, "c2", "count two", null);
      await dr.moveItem(a, one.id, parent.id);
      await dr.moveItem(a, two.id, child.id);
      const counts = await dr.folderItemCounts(a);
      expect([counts.get(parent.id), counts.get(child.id)]).toEqual([1, 1]);
      expect((await dr.folderItemCounts(b)).get(parent.id)).toBeUndefined();
    });

    it("requeues images stored as octet-stream by their extension for vision", async () => {
      const { item } = await upload(a, `shot-${run}.PNG`, `oct-${run}`, {
        mimeType: "application/octet-stream",
      });
      await prisma.dataRoomItem.update({ where: { id: item.id }, data: { status: "ready" } });
      await prisma.dataRoomItemText.create({
        data: { itemId: item.id, spaceId: a.spaceId, userId: a.userId, text: "" },
      });
      expect(await dr.requeueReady(a, "ingest")).toContain(item.id);
    });

    it("refuses a cursor from the other search mode or another embedding model", async () => {
      const q = `mode${run}`;
      for (let i = 0; i < 3; i++) await put(a, `mode${i}`, `${q} text ${i}`, unit(80 + i));
      const hybrid = { query: q, vector: unit(80), embeddingModel: MODEL, limit: 1 };
      const keyword = { query: q, limit: 1 };
      const hybridCursor = (await dr.searchPage(a, hybrid)).nextCursor as string;
      const keywordCursor = (await dr.searchPage(a, keyword)).nextCursor as string;
      expect(hybridCursor && keywordCursor).toBeTruthy();
      const conflict = { name: "DataRoomConflictError", message: "Search changed; start again" };
      await expect(dr.searchPage(a, { ...keyword, cursor: hybridCursor })).rejects.toMatchObject(
        conflict,
      );
      await expect(dr.searchPage(a, { ...hybrid, cursor: keywordCursor })).rejects.toMatchObject(
        conflict,
      );
      await expect(
        dr.searchPage(a, { ...hybrid, embeddingModel: `new-${run}`, cursor: hybridCursor }),
      ).rejects.toMatchObject(conflict);
      // Same mode continues, in both relevance and sorted order.
      expect((await dr.searchPage(a, { ...hybrid, cursor: hybridCursor })).results).toHaveLength(1);
      const sort = { field: "name" as const, direction: "asc" as const };
      const sorted = (await dr.searchPage(a, { ...hybrid, sort })).nextCursor as string;
      await expect(dr.searchPage(a, { ...keyword, sort, cursor: sorted })).rejects.toMatchObject(
        conflict,
      );
      expect(
        (await dr.searchPage(a, { ...hybrid, sort, cursor: sorted })).results.length,
      ).toBeGreaterThan(0);
    });

    it("returns only the items a requeue moved, and refuses stale step writes", async () => {
      const item = await put(a, "lease", "lease text", null);
      await prisma.dataRoomItem.update({ where: { id: item.id }, data: { status: "ready" } });
      await prisma.dataRoomItemText.create({
        data: { itemId: item.id, spaceId: a.spaceId, userId: a.userId, text: "" },
      });
      expect(await dr.reindexItems(a, [item.id, "nope"])).toEqual([item.id]);
      expect(await dr.reindexItems(a, [item.id])).toEqual([]); // no longer ready
      const claimed = await dr.claimStep(a, item.id, ["indexing"], "indexing");
      expect(claimed?.leaseUntil?.getTime()).toBeGreaterThan(Date.now());
      expect(await dr.claimStep(a, item.id, ["indexing"], "indexing")).toBeNull(); // leased
      await dr.stepWrite(a, item.id, (claimed?.revision ?? 0) + 5, { status: "ready" });
      expect((await dr.getItem(a, item.id)).status).toBe("indexing"); // wrong revision
      const chunk = { ordinal: 0, text: "new text", contentHash: "new-hash" };
      await expect(
        dr.replaceChunks(a, item.id, [chunk], { revision: (claimed?.revision ?? 0) - 1 }),
      ).rejects.toMatchObject({ name: "DataRoomStaleError" });
      expect(
        await prisma.dataRoomChunk.count({ where: { itemId: item.id, text: "new text" } }),
      ).toBe(0);
      await dr.replaceChunks(a, item.id, [chunk], { revision: claimed?.revision });
      await dr.saveEmbeddings(a, item.id, MODEL, [{ ...chunk, vector: unit(1) }], 999);
      expect(
        await prisma.dataRoomChunk.count({ where: { itemId: item.id, embeddingModel: MODEL } }),
      ).toBe(0);
      expect(await dr.stepWrite(a, item.id, claimed?.revision ?? 0, { status: "ready" })).toBe(
        true,
      );
      expect((await dr.getItem(a, item.id)).leaseUntil).toBeNull();
    });
  });
});
