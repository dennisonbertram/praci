import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRouterClient } from "@orpc/server";
import type { BackgroundJob } from "@rakazo/adapter-kit";
import { createBackgroundJobHandlers, LocalArtifactStore } from "@rakazo/adapters";
import type { Actor, DataRoomApiItem } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDataRoomRepos, createDb } from "@rakazo/db";
import { Hono } from "hono";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDataRoomService, mountDataRoomRoutes } from "./data-room.js";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

const CAP = 64;

describePostgres("Data room API (PostgreSQL)", () => {
  const run = randomUUID().slice(0, 8);
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let root: string;
  let app: Hono;
  const enqueued: BackgroundJob[] = [];
  /** Whether the item row still existed when each job was queued. */
  const rowAtEnqueue: boolean[] = [];
  const actors: Record<string, Actor> = {};
  const spaceIds: string[] = [];

  const blobCount = async (spaceId: string) =>
    (await readdir(path.join(root, "artifacts", spaceId)).catch(() => [])).length;

  const client = (who: Actor | null) =>
    createRouterClient(
      createRouter({
        prisma,
        env: { webOrigin: "https://app.example.com" },
        jobs: {
          enqueue: async (job: BackgroundJob) => {
            const key = (job.payload as { storageKey: string }).storageKey;
            rowAtEnqueue.push(
              (await prisma.dataRoomItem.count({ where: { storageKey: key } })) > 0,
            );
            enqueued.push(job);
          },
        },
        artifacts: new LocalArtifactStore(root),
      } as unknown as RouterDeps),
      { context: { actor: who } as never },
    );

  const send = (who: string | null, url: string, init: RequestInit = {}) =>
    app.request(url, {
      ...init,
      headers: { ...(who ? { "x-test-actor": who } : {}), ...(init.headers as object) },
    });
  const upload = (
    who: string | null,
    query: string,
    body: string | Uint8Array,
    type = "text/plain",
  ) =>
    send(who, `/api/data-room/upload?${query}`, {
      method: "POST",
      body: body as BodyInit,
      headers: { "content-type": type },
    });

  beforeAll(async () => {
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    root = await mkdtemp(path.join(tmpdir(), "dr51-"));
    const make = async (label: string, spaceLabel: string) => {
      const userId = `dra-user-${label}-${run}`;
      if (!actors[spaceLabel]) {
        const orgId = `dra-org-${spaceLabel}-${run}`;
        const spaceId = `dra-space-${spaceLabel}-${run}`;
        await prisma.organization.create({
          data: { id: orgId, name: spaceLabel, slug: orgId, createdAt: new Date() },
        });
        await prisma.space.create({
          data: { id: spaceId, organizationId: orgId, name: spaceLabel, isDefault: true },
        });
        spaceIds.push(spaceId);
        actors[spaceLabel] = { userId, spaceId, email: "x@rakazo.test", isDeploymentOwner: false };
      }
      await prisma.user.create({
        data: { id: userId, name: label, email: `${userId}@rakazo.test`, emailVerified: false },
      });
      actors[label] = { ...actors[spaceLabel], userId, email: `${userId}@rakazo.test` };
    };
    await make("a", "A");
    await make("a2", "A"); // second member of space A
    await make("b", "B");
    await make("s", "S");
    app = new Hono();
    mountDataRoomRoutes(
      app,
      {
        prisma,
        artifacts: new LocalArtifactStore(root),
        jobs: { enqueue: async (j) => void enqueued.push(j) },
        maxUploadBytes: CAP,
      },
      async (request) => actors[request.headers.get("x-test-actor") ?? ""] ?? null,
    );
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.space.deleteMany({ where: { id: { in: spaceIds } } });
    await prisma.organization.deleteMany({
      where: { id: { startsWith: "dra-org-" }, slug: { endsWith: run } },
    });
    await prisma.user.deleteMany({ where: { id: { startsWith: "dra-user-", endsWith: run } } });
    await rm(root, { recursive: true, force: true });
    await close();
  });

  let item: DataRoomApiItem;

  it("rejects unauthenticated upload, download and procedures", async () => {
    expect((await upload(null, "name=x.txt", "hi")).status).toBe(401);
    expect((await send(null, "/api/data-room/items/anything/content")).status).toBe(401);
    await expect(client(null).dataRoom.folders()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(client(null).dataRoom.search({ query: "x", limit: 10 })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("stores an upload as a pending item without exposing the storage key", async () => {
    const res = await upload("a", "name=notes.txt", "quokka report");
    expect(res.status).toBe(201);
    const body = (await res.json()) as { item: DataRoomApiItem; duplicate: boolean };
    expect(body.duplicate).toBe(false);
    item = body.item;
    expect(item).toMatchObject({
      name: "notes.txt",
      mimeType: "text/plain",
      size: 13,
      status: "pending",
      source: "upload",
      folderId: null,
    });
    expect(JSON.stringify(body)).not.toContain("storageKey");
    expect(await blobCount(actors.A.spaceId)).toBe(1);
    expect(enqueued).toEqual([]);
  });

  it("returns the existing item for the same bytes and stores no second blob", async () => {
    const res = await upload("a", "name=renamed.txt", "quokka report");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { item: DataRoomApiItem; duplicate: boolean };
    expect(body).toMatchObject({ duplicate: true, item: { id: item.id } });
    expect(await blobCount(actors.A.spaceId)).toBe(1);
  });

  it("refuses an upload over the cap with 413 and stores no blob", async () => {
    const before = await blobCount(actors.A.spaceId);
    expect((await upload("a", "name=big.bin", new Uint8Array(CAP + 1))).status).toBe(413);
    // No content-length: the cap is enforced while reading the stream.
    const stream = new ReadableStream({
      start(c) {
        c.enqueue(new Uint8Array(CAP));
        c.enqueue(new Uint8Array(CAP));
        c.close();
      },
    });
    const res = await send("a", "/api/data-room/upload?name=big2.bin", {
      method: "POST",
      body: stream,
      duplex: "half",
    } as RequestInit);
    expect(res.status).toBe(413);
    expect(await blobCount(actors.A.spaceId)).toBe(before);
  });

  it("rejects invalid names and a folder that is not the actor's", async () => {
    for (const name of ["", "a/b.txt", "a\\b.txt", "x".repeat(256)]) {
      expect((await upload("a", `name=${encodeURIComponent(name)}`, "z")).status).toBe(400);
    }
    expect((await upload("a", "", "z")).status).toBe(400);
    const folderB = await client(actors.b).dataRoom.folderCreate({ name: "B only" });
    expect((await upload("a", `name=f.txt&folderId=${folderB.id}`, "z")).status).toBe(404);
    expect((await upload("a", "name=f.txt&folderId=nope", "z")).status).toBe(404);
    expect(await blobCount(actors.A.spaceId)).toBe(1);
  });

  it("downloads only as an attachment with sandboxing headers", async () => {
    const evil = await upload(
      "a",
      `name=${encodeURIComponent('"x".html')}`,
      "<script>alert(1)</script>",
      "text/html",
    );
    const { item: html } = (await evil.json()) as { item: DataRoomApiItem };
    const res = await send("a", `/api/data-room/items/${html.id}/content`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("<script>alert(1)</script>");
    expect(res.headers.get("content-disposition")).toMatch(/^attachment; filename=/);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-security-policy")).toMatch(/^sandbox/);
    expect(res.headers.get("content-type")).toBe("application/octet-stream");
    await client(actors.a).dataRoom.itemDelete({ id: html.id });
    enqueued.length = 0;
  });

  it("hides the item from another space and from another member of the same space", async () => {
    await prisma.dataRoomChunk.count(); // table exists
    await createDataRoomRepos(prisma).replaceChunks(actors.a, item.id, [
      { ordinal: 0, text: "confidential quokka report", contentHash: "h" },
    ]);
    expect(
      (await client(actors.a).dataRoom.search({ query: "quokka", limit: 10 })).results[0]?.item.id,
    ).toBe(item.id);
    for (const who of ["b", "a2"]) {
      const c = client(actors[who]);
      expect((await c.dataRoom.items.list({ limit: 50 })).items).toEqual([]);
      expect((await c.dataRoom.search({ query: "quokka", limit: 10 })).results).toEqual([]);
      await expect(c.dataRoom.item({ id: item.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(c.dataRoom.itemRename({ id: item.id, name: "x" })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      await expect(c.dataRoom.itemMove({ id: item.id, folderId: null })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      await expect(c.dataRoom.itemDelete({ id: item.id })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      expect((await send(who, `/api/data-room/items/${item.id}/content`)).status).toBe(404);
    }
    expect(enqueued).toEqual([]);
  });

  it("lists, renames, moves and manages folders for the owner", async () => {
    const c = client(actors.a);
    const folder = await c.dataRoom.folderCreate({ name: "Contracts" });
    await expect(c.dataRoom.folderCreate({ name: "Contracts" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect((await c.dataRoom.itemRename({ id: item.id, name: "q.txt" })).name).toBe("q.txt");
    expect((await c.dataRoom.itemMove({ id: item.id, folderId: folder.id })).folderId).toBe(
      folder.id,
    );
    expect(
      (await c.dataRoom.items.list({ limit: 50, folderId: folder.id })).items.map((i) => i.id),
    ).toEqual([item.id]);
    expect((await c.dataRoom.folders()).map((f) => f.id)).toContain(folder.id);
    await expect(c.dataRoom.folderDelete({ id: folder.id })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await c.dataRoom.itemMove({ id: item.id, folderId: null });
    await c.dataRoom.folderDelete({ id: folder.id });
  });

  it("pages items with a cursor", async () => {
    const c = client(actors.a);
    await upload("a", "name=p1.txt", "page one");
    await upload("a", "name=p2.txt", "page two");
    const first = await c.dataRoom.items.list({ limit: 2 });
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).toBeTruthy();
    const second = await c.dataRoom.items.list({ limit: 2, cursor: first.nextCursor as string });
    expect(second.items).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
    for (const i of [...first.items, ...second.items].filter((i) => i.name.startsWith("p"))) {
      await c.dataRoom.itemDelete({ id: i.id });
    }
    enqueued.length = 0;
  });

  describe("server-side sort and cursor paging", () => {
    type Row = {
      id: string;
      name: string;
      docDate: Date | null;
      docType: string | null;
      createdAt: Date;
    };
    let rows: Row[];
    const day = (n: number) => new Date(Date.UTC(2026, 0, n));

    beforeAll(async () => {
      // Ties on name, docDate, docType and createdAt; nulls in docDate and docType.
      const spec: [string, number | null, string | null, number][] = [
        ["b.txt", 3, "invoice", 1],
        ["a.txt", 3, "contract", 2],
        ["b.txt", null, "invoice", 2],
        ["c.txt", 1, null, 1],
        ["a.txt", null, null, 3],
        ["d.txt", 2, "contract", 3],
        ["b.txt", 3, "invoice", 1],
      ];
      rows = [];
      for (const [i, [name, d, type, created]] of spec.entries()) {
        const created_ = await prisma.dataRoomItem.create({
          data: {
            spaceId: actors.S.spaceId,
            userId: actors.S.userId,
            source: "upload",
            sha256: `sort-${run}-${i}`,
            name,
            mimeType: "text/plain",
            size: 1,
            docType: type,
            docDate: d === null ? null : day(d),
            createdAt: day(created),
          },
        });
        rows.push({
          id: created_.id,
          name,
          docDate: d === null ? null : day(d),
          docType: type,
          createdAt: day(created),
        });
      }
    });

    const column = {
      date: "docDate",
      name: "name",
      type: "docType",
      createdAt: "createdAt",
    } as const;
    const expected = (field: keyof typeof column, direction: "asc" | "desc", pool = rows) => {
      const key = (r: Row) => {
        const v = r[column[field]];
        return v instanceof Date ? v.getTime() : v;
      };
      return [...pool]
        .sort((x, y) => {
          const a = key(x);
          const b = key(y);
          if (a !== b) {
            if (a === null) return 1;
            if (b === null) return -1;
            return (a < b ? -1 : 1) * (direction === "asc" ? 1 : -1);
          }
          return x.id < y.id ? -1 : 1;
        })
        .map((r) => r.id);
    };
    const walk = async (input: Record<string, unknown>, limit = 2) => {
      const c = client(actors.S);
      const ids: string[] = [];
      let cursor: string | undefined;
      for (let guard = 0; guard < 20; guard += 1) {
        const page = await c.dataRoom.items.list({ ...input, limit, cursor } as never);
        ids.push(...page.items.map((i) => i.id));
        if (!page.nextCursor) return ids;
        cursor = page.nextCursor;
      }
      throw new Error("cursor never ended");
    };

    for (const field of ["date", "name", "type", "createdAt"] as const) {
      for (const direction of ["asc", "desc"] as const) {
        it(`orders by ${field} ${direction} (nulls last, id ties) across cursor pages`, async () => {
          expect(await walk({ sort: { field, direction } })).toEqual(expected(field, direction));
          expect(await walk({ sort: { field, direction } }, 100)).toEqual(
            expected(field, direction),
          );
        });
      }
    }

    it("defaults to createdAt descending", async () => {
      expect(await walk({})).toEqual(expected("createdAt", "desc"));
    });

    it("applies filters in SQL together with sort and paging", async () => {
      const contracts = rows.filter((r) => r.docType === "contract");
      expect(
        await walk({ docType: "contract", sort: { field: "name", direction: "desc" } }, 1),
      ).toEqual(expected("name", "desc", contracts));
      const ranged = rows.filter((r) => r.docDate && r.docDate >= day(2));
      expect(
        await walk(
          { docDateFrom: day(2).toISOString(), sort: { field: "date", direction: "asc" } },
          2,
        ),
      ).toEqual(expected("date", "asc", ranged));
    });

    it("rejects a malformed cursor", async () => {
      await expect(
        client(actors.S).dataRoom.items.list({ limit: 2, cursor: "not-a-cursor" }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
    });

    const searchWalk = async (input: Record<string, unknown>, limit: number) => {
      const c = client(actors.S);
      const ids: string[] = [];
      let cursor: string | undefined;
      for (let guard = 0; guard < 20; guard += 1) {
        const page = await c.dataRoom.search({ query: "zebra", ...input, limit, cursor } as never);
        ids.push(...page.results.map((h) => h.item.id));
        if (!page.nextCursor) return ids;
        cursor = page.nextCursor;
      }
      throw new Error("cursor never ended");
    };

    describe("search paging", () => {
      beforeAll(async () => {
        const repo = createDataRoomRepos(prisma);
        for (const [i, r] of rows.entries()) {
          // Different match strengths, with ties, so relevance order has something to do.
          const text = `zebra ${"zebra ".repeat(i % 3)}stripes`;
          await repo.replaceChunks(actors.S, r.id, [{ ordinal: 0, text, contentHash: `z${i}` }]);
        }
      });

      for (const field of ["date", "name", "type", "createdAt"] as const) {
        for (const direction of ["asc", "desc"] as const) {
          it(`pages search by ${field} ${direction} in global order`, async () => {
            const want = expected(field, direction);
            expect(await searchWalk({ sort: { field, direction } }, 2)).toEqual(want);
            expect(await searchWalk({ sort: { field, direction } }, 50)).toEqual(want);
          });
        }
      }

      it("pages relevance order without repeats or gaps", async () => {
        const whole = await searchWalk({}, 50);
        expect(whole).toHaveLength(rows.length);
        const scores = (
          await client(actors.S).dataRoom.search({ query: "zebra", limit: 50 })
        ).results.map((h) => h.score);
        expect(scores).toEqual([...scores].sort((a, b) => b - a));
        expect(await searchWalk({}, 2)).toEqual(whole);
        expect(await searchWalk({}, 1)).toEqual(whole);
      });

      it("combines filters with sort across pages and rejects a bad cursor", async () => {
        const invoices = rows.filter((r) => r.docType === "invoice");
        expect(
          await searchWalk(
            { filters: { docType: "invoice" }, sort: { field: "name", direction: "asc" } },
            1,
          ),
        ).toEqual(expected("name", "asc", invoices));
        await expect(
          client(actors.S).dataRoom.search({ query: "zebra", limit: 2, cursor: "bad" }),
        ).rejects.toMatchObject({ code: "CONFLICT" });
      });
    });
  });

  it("deletes the row and chunks and enqueues exactly one blob cleanup", async () => {
    const [{ storageKey }] = await prisma.dataRoomItem.findMany({
      where: { id: item.id },
      select: { storageKey: true },
    });
    expect(await prisma.dataRoomChunk.count({ where: { itemId: item.id } })).toBe(1);
    await client(actors.a).dataRoom.itemDelete({ id: item.id });
    expect(await prisma.dataRoomItem.count({ where: { id: item.id } })).toBe(0);
    expect(await prisma.dataRoomChunk.count({ where: { itemId: item.id } })).toBe(0);
    expect(enqueued).toHaveLength(1);
    // Queued before the row was deleted, and not to run immediately.
    expect(rowAtEnqueue.at(-1)).toBe(true);
    expect(enqueued[0]?.availableAt?.getTime()).toBeGreaterThan(Date.now() + 30_000);
    expect(enqueued[0]).toMatchObject({
      name: "dataroom.blob.delete",
      payload: { spaceId: actors.A.spaceId, storageKey },
      replaceKey: expect.stringContaining(storageKey as string),
    });
    expect((await send("a", `/api/data-room/items/${item.id}/content`)).status).toBe(404);
  });

  it("keeps the blob when the row delete fails after the cleanup was queued", async () => {
    const res = await upload("a", "name=fail.txt", "delete will fail");
    const { item: target } = (await res.json()) as { item: DataRoomApiItem };
    const row = await prisma.dataRoomItem.findFirstOrThrow({ where: { id: target.id } });
    const failing = new Proxy(prisma, {
      get(real, key) {
        const value = Reflect.get(real, key);
        if (key !== "dataRoomItem") return typeof value === "function" ? value.bind(real) : value;
        return new Proxy(value, {
          get(model, method) {
            if (method === "deleteMany") {
              return async () => {
                throw new Error("row delete failed");
              };
            }
            const fn = Reflect.get(model, method);
            return typeof fn === "function" ? fn.bind(model) : fn;
          },
        });
      },
    });
    const queued: BackgroundJob[] = [];
    const service = createDataRoomService({
      prisma: failing,
      artifacts: new LocalArtifactStore(root),
      jobs: { enqueue: async (job: BackgroundJob) => void queued.push(job) },
    });
    await expect(service.deleteItem(actors.a, target.id)).rejects.toThrow("row delete failed");
    expect(queued).toHaveLength(1);
    expect(queued[0]?.name).toBe("dataroom.blob.delete");
    expect(await prisma.dataRoomItem.count({ where: { id: target.id } })).toBe(1);

    const handlers = createBackgroundJobHandlers({
      prisma,
      artifacts: new LocalArtifactStore(root),
    } as unknown as Parameters<typeof createBackgroundJobHandlers>[0]);
    await expect(handlers["dataroom.blob.delete"](queued[0]?.payload as never)).rejects.toThrow(
      "still references",
    );
    await expect(
      new LocalArtifactStore(root).get(row.storageKey as string, {
        operationId: "t",
        traceId: "t",
        spaceId: actors.A.spaceId,
        userId: actors.a.userId,
        signal: new AbortController().signal,
      }),
    ).resolves.toBeInstanceOf(Uint8Array);
    await client(actors.a).dataRoom.itemDelete({ id: target.id });
    enqueued.length = 0;
  });
});
