import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRouterClient } from "@orpc/server";
import type { BackgroundJob } from "@rakazo/adapter-kit";
import {
  createBackgroundJobHandlers,
  DRIVE_IMPORT_MAX_FILES,
  DriveApiEmulator,
  LocalArtifactStore,
  runDriveFileImport,
  runDriveImport,
} from "@rakazo/adapters";
import type { Actor, DataRoomApiItem } from "@rakazo/contracts";
import { dataRoomAgentSpawnKey } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDataRoomRepos, createDb, settleDataRoomImport } from "@rakazo/db";
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
  let failEnqueue = false;
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
            if (failEnqueue) throw new Error("queue down");
            const key = (job.payload as { storageKey: string }).storageKey;
            rowAtEnqueue.push(
              (await prisma.dataRoomItem.count({ where: { storageKey: key } })) > 0,
            );
            enqueued.push(job);
          },
        },
        artifacts: new LocalArtifactStore(root),
        mail,
        connectors: { managed: () => driveConnector },
      } as unknown as RouterDeps),
      { context: { actor: who } as never },
    );

  /** A mailbox with one attachment per connection id; accounts are the connections of the asked user. */
  const accounts: { id: string; userId: string }[] = [];
  const mail = {
    listAccounts: async (scope: { userId: string }) =>
      accounts.filter((a) => a.userId === scope.userId),
    getAttachment: async (_account: unknown, _message: string, attachmentId: string) => {
      if (attachmentId === "broken") throw new Error("provider down");
      return {
        filename: "invoice/2026.pdf",
        mimeType: "application/pdf",
        size: 5,
        bytes: new TextEncoder().encode(`%PDF-${attachmentId}`),
      };
    },
  };

  const PDF = new TextEncoder().encode("%PDF-drive");
  const emulator = new DriveApiEmulator({
    accounts: {
      "acct-a": {
        email: "a@example.test",
        files: [
          {
            id: "doc1",
            name: "Plan/2026",
            mimeType: "application/vnd.google-apps.doc" + "ument",
            pdf: PDF,
          },
          { id: "dir1", name: "Folder", mimeType: "application/vnd.google-apps.folder" },
          { id: "solo", name: "solo.pdf", mimeType: "application/pdf", bytes: PDF },
          { id: "p1", name: "top.pdf", mimeType: "application/pdf", bytes: PDF, parents: ["dir1"] },
          {
            id: "sub1",
            name: "Sub",
            mimeType: "application/vnd.google-apps.folder",
            parents: ["dir1"],
          },
          {
            id: "p2",
            name: "deep.pdf",
            mimeType: "application/pdf",
            bytes: PDF,
            parents: ["sub1"],
          },
          {
            id: "emp",
            name: "Empty",
            mimeType: "application/vnd.google-apps.folder",
            parents: ["sub1"],
          },
          {
            id: "frm",
            name: "Survey",
            mimeType: "application/vnd.google-apps.form",
            parents: ["sub1"],
          },
        ],
      },
      "acct-d": {
        email: "d@example.test",
        files: [
          { id: "big", name: "Big", mimeType: "application/vnd.google-apps.folder" },
          ...Array.from({ length: DRIVE_IMPORT_MAX_FILES + 1 }, (_, i) => ({
            id: `bf${i}`,
            name: `bf${i}.pdf`,
            mimeType: "application/pdf",
            size: "10",
            parents: ["big"],
          })),
        ],
      },
    },
  });
  let driveDownloads = 0;
  const driveConnector = {
    proxy: async (r: { accountRef: string; url: string; method: string }) => {
      if (r.url.includes("/export")) driveDownloads += 1;
      return emulator.handle(r.accountRef, r.url, r.method);
    },
  };

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
      const organizationId = `dra-org-${spaceLabel}-${run}`;
      const spaceId = actors[spaceLabel].spaceId;
      await prisma.member.create({
        data: {
          id: `dra-mem-${label}-${run}`,
          organizationId,
          userId,
          role: "member",
          createdAt: new Date(),
        },
      });
      await prisma.spaceMember.upsert({
        where: { spaceId_userId: { spaceId, userId } },
        update: {},
        create: {
          id: `dra-sm-${label}-${run}`,
          spaceId,
          organizationId,
          userId,
          createdAt: new Date(),
        },
      });
      actors[label] = { ...actors[spaceLabel], userId, email: `${userId}@rakazo.test` };
    };
    await make("a", "A");
    await make("a2", "A"); // second member of space A
    await make("b", "B");
    await make("s", "S");
    await make("d", "B"); // a second user with their own Drive
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

  it("creates one Data room agent per user, however often it is asked", async () => {
    const [first, again, other] = await Promise.all([
      client(actors.a).dataRoom.agent(),
      client(actors.a).dataRoom.agent(),
      client(actors.a2).dataRoom.agent(),
    ]);
    expect(again.id).toBe(first.id);
    expect(first).toMatchObject({
      name: "Data room agent",
      spawnKey: dataRoomAgentSpawnKey(actors.a.userId),
    });
    // A member of the same space gets their own agent, not the first user's.
    expect(other.id).not.toBe(first.id);
    expect(other.spawnKey).toBe(dataRoomAgentSpawnKey(actors.a2.userId));
    expect(
      await prisma.bot.count({
        where: { spaceId: actors.a.spaceId, spawnKey: { startsWith: "data-room-agent:" } },
      }),
    ).toBe(2);
    await expect(
      client(actors.a).bots.create({
        name: "Squatter",
        title: "",
        description: "",
        instructions: "",
        notifyOnFinish: true,
        computerMode: "team" as const,
        spawnKey: dataRoomAgentSpawnKey(actors.b.userId),
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

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
    expect(enqueued).toHaveLength(1);
    expect(enqueued[0]).toMatchObject({
      name: "dataroom.ingest",
      payload: { spaceId: actors.A.spaceId, userId: actors.a.userId, itemId: item.id },
      replaceKey: `dataroom.ingest:${item.id}`,
    });
  });

  it("returns the existing item for the same bytes and stores no second blob", async () => {
    const res = await upload("a", "name=renamed.txt", "quokka report");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { item: DataRoomApiItem; duplicate: boolean };
    expect(body).toMatchObject({ duplicate: true, item: { id: item.id } });
    expect(await blobCount(actors.A.spaceId)).toBe(1);
    // The first upload is still pending, so the duplicate runs ingest again (the job key dedupes).
    expect(enqueued.filter((job) => job.name === "dataroom.ingest")).toHaveLength(2);
    expect(new Set(enqueued.map((job) => job.replaceKey)).size).toBe(1);
  });

  it("restarts a duplicate of a failed item, but leaves a ready one alone", async () => {
    const before = enqueued.filter((job) => job.name === "dataroom.ingest").length;
    await prisma.dataRoomItem.update({
      where: { id: item.id },
      data: { status: "failed", failures: 3, error: "boom" },
    });
    expect((await upload("a", "name=again.txt", "quokka report")).status).toBe(200);
    expect(await prisma.dataRoomItem.findUniqueOrThrow({ where: { id: item.id } })).toMatchObject({
      status: "pending",
      failures: 0,
      error: null,
    });
    expect(enqueued.filter((job) => job.name === "dataroom.ingest")).toHaveLength(before + 1);
    await prisma.dataRoomItem.update({ where: { id: item.id }, data: { status: "ready" } });
    await upload("a", "name=again.txt", "quokka report");
    expect(enqueued.filter((job) => job.name === "dataroom.ingest")).toHaveLength(before + 1);
    await prisma.dataRoomItem.update({ where: { id: item.id }, data: { status: "pending" } });
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
    // The folder list says how many items each folder holds, so a parent never looks empty.
    expect((await c.dataRoom.folders()).find((f) => f.id === folder.id)?.itemCount).toBe(1);
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

  it("reads a failed item again on Try again, and refuses one that is not failed", async () => {
    const response = await upload("a", "name=retry.txt", `retry me ${run}`);
    const { item: failed } = (await response.json()) as { item: DataRoomApiItem };
    await prisma.dataRoomItem.update({
      where: { id: failed.id },
      data: { status: "failed", failures: 3, error: "boom" },
    });
    enqueued.length = 0;
    const c = client(actors.a);
    expect(await c.dataRoom.itemRetry({ id: failed.id })).toMatchObject({
      status: "pending",
      error: null,
    });
    expect(enqueued.map((job) => job.name)).toEqual(["dataroom.ingest"]);
    await expect(c.dataRoom.itemRetry({ id: failed.id })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await expect(client(actors.b).dataRoom.itemRetry({ id: failed.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await c.dataRoom.itemDelete({ id: failed.id });
    enqueued.length = 0;
  });

  it("offers every type, party and source of a folder's items, not only one page", async () => {
    const c = client(actors.a);
    const folder = await c.dataRoom.folderCreate({ name: `Facets ${run}` });
    const make = async (name: string, folderId: string | null, data: object) => {
      const query = `name=${name}${folderId ? `&folderId=${folderId}` : ""}`;
      const { item } = (await (await upload("a", query, `${name} ${run}`)).json()) as {
        item: DataRoomApiItem;
      };
      await prisma.dataRoomItem.update({ where: { id: item.id }, data });
      return item;
    };
    const inside = await make("lease.txt", folder.id, {
      docType: "contract",
      parties: ["Landlord (Mock)"],
      docDate: new Date("2025-01-31"),
    });
    const outside = await make("deck.txt", null, { docType: "presentation", source: "drive" });
    // A list page of one item still gets every value.
    expect((await c.dataRoom.items.list({ limit: 1 })).items).toHaveLength(1);
    const all = await c.dataRoom.facetValues({});
    expect(all.types).toEqual(expect.arrayContaining(["contract", "presentation"]));
    expect(all.parties).toContain("Landlord (Mock)");
    expect(all.sources).toEqual(expect.arrayContaining(["upload", "drive"]));
    expect(all.hasDates).toBe(true);
    expect(await c.dataRoom.facetValues({ folderId: folder.id })).toEqual({
      types: ["contract"],
      parties: ["Landlord (Mock)"],
      sources: ["upload"],
      hasDates: true,
    });
    // With a filter set, the others offer only values that still find something; its own keeps
    // every alternative.
    expect(
      await c.dataRoom.facetValues({ folderId: folder.id, party: "Someone Else (Mock)" }),
    ).toEqual({ types: [], parties: ["Landlord (Mock)"], sources: [], hasDates: false });
    // Another member of the same space sees none of it.
    expect(await client(actors.a2).dataRoom.facetValues({ folderId: folder.id })).toEqual({
      types: [],
      parties: [],
      sources: [],
      hasDates: false,
    });
    for (const item of [inside, outside]) await c.dataRoom.itemDelete({ id: item.id });
    await c.dataRoom.folderDelete({ id: folder.id });
    enqueued.length = 0;
  });

  it("answers a plain question by matching any of its words when all of them find nothing", async () => {
    const response = await upload("a", "name=lease.txt", `lease text ${run}`);
    const { item: lease } = (await response.json()) as { item: DataRoomApiItem };
    await createDataRoomRepos(prisma).replaceChunks(actors.a, lease.id, [
      { ordinal: 0, text: `Office${run} renewal is January 31`, contentHash: `lease-${run}` },
    ]);
    const c = client(actors.a);
    const page = await c.dataRoom.search({
      query: `when does our office${run} lease end`,
      limit: 10,
    });
    expect(page.results.map((r) => r.item.id)).toEqual([lease.id]);
    expect(page.nextCursor).toBeNull();
    await c.dataRoom.itemDelete({ id: lease.id });
    enqueued.length = 0;
  });

  it("imports a mail attachment once, and only from the caller's own mail and folders", async () => {
    const connection = await prisma.connection.create({
      data: {
        spaceId: actors.A.spaceId,
        userId: actors.a.userId,
        connectorId: "google",
        provider: "gmail",
        displayName: "Test mail",
        status: "connected",
      },
    });
    accounts.push({ id: connection.id, userId: actors.a.userId });
    const message = await prisma.cachedMailMessage.create({
      data: {
        spaceId: actors.A.spaceId,
        userId: actors.a.userId,
        connectionId: connection.id,
        providerMessageId: `pm-${run}`,
        threadId: "t1",
        fromAddress: "billing@example.com",
        toAddresses: [],
        ccAddresses: [],
        subject: "Invoice",
        snippet: "",
        receivedAt: new Date(),
        unread: false,
        seenAt: new Date(),
      },
    });
    const pick = { messageId: message.id, attachmentId: "att1" };
    const before = enqueued.length;

    await expect(client(actors.a).dataRoom.importEmail({ picks: [pick] })).resolves.toMatchObject({
      imported: 1,
      duplicates: 0,
      failed: 0,
    });
    const row = await prisma.dataRoomItem.findFirstOrThrow({
      where: { spaceId: actors.A.spaceId, externalId: `gmail:pm-${run}:att1` },
    });
    expect(row).toMatchObject({
      source: "gmail",
      sourceConnectionId: connection.id,
      name: "invoice_2026.pdf",
      sourceUrl: `/app/inbox?mail=${message.id}`,
    });
    expect(enqueued.slice(before).map((j) => j.name)).toEqual(["dataroom.ingest"]);

    // The same pick again stores no second item or blob.
    const blobs = await blobCount(actors.A.spaceId);
    await expect(client(actors.a).dataRoom.importEmail({ picks: [pick] })).resolves.toMatchObject({
      imported: 0,
      duplicates: 1,
      failed: 0,
    });
    expect(await blobCount(actors.A.spaceId)).toBe(blobs);

    // Another member of the same space and a user in another space cannot reach the message.
    await expect(client(actors.a2).dataRoom.importEmail({ picks: [pick] })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(client(actors.b).dataRoom.importEmail({ picks: [pick] })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    // A folder that is not the caller's is refused before anything is stored.
    const folderB = await client(actors.b).dataRoom.folderCreate({ name: "B import" });
    await expect(
      client(actors.a).dataRoom.importEmail({ picks: [pick], folderId: folderB.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("files the other picks when one attachment cannot be fetched", async () => {
    const connection = await prisma.connection.findFirstOrThrow({
      where: { spaceId: actors.A.spaceId, userId: actors.a.userId, provider: "gmail" },
    });
    const message = await prisma.cachedMailMessage.findFirstOrThrow({
      where: { connectionId: connection.id },
    });
    const result = await client(actors.a).dataRoom.importEmail({
      picks: [
        { messageId: message.id, attachmentId: "broken" },
        { messageId: message.id, attachmentId: "att2" },
      ],
    });
    expect(result).toMatchObject({ imported: 1, duplicates: 0, failed: 1 });
    expect(
      await prisma.dataRoomItem.count({
        where: { spaceId: actors.A.spaceId, externalId: `gmail:${message.providerMessageId}:att2` },
      }),
    ).toBe(1);
  });

  it("imports a Drive file once, only through the caller's own Drive and folders", async () => {
    // No Drive account yet.
    await expect(client(actors.a).dataRoom.driveList({})).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    const connection = await prisma.connection.create({
      data: {
        spaceId: actors.A.spaceId,
        userId: actors.a.userId,
        connectorId: "google",
        provider: "googledrive",
        providerRef: "acct-a",
        displayName: "Test drive",
        status: "connected",
      },
    });
    const listed = await client(actors.a).dataRoom.driveList({});
    expect(listed.files.map((f) => f.id).sort()).toEqual(["dir1", "doc1", "solo"]);

    const before = enqueued.length;
    await expect(
      client(actors.a).dataRoom.importDrive({ fileIds: ["doc1"] }),
    ).resolves.toMatchObject({
      imported: 1,
      duplicates: 0,
      failed: 0,
    });
    const row = await prisma.dataRoomItem.findFirstOrThrow({
      where: { spaceId: actors.A.spaceId, externalId: "doc1" },
    });
    expect(row).toMatchObject({
      source: "drive",
      sourceConnectionId: connection.id,
      name: "Plan_2026.pdf",
      mimeType: "application/pdf",
    });
    expect(row.sourceUrl).toContain("doc1");
    expect(enqueued.slice(before).map((j) => j.name)).toEqual(["dataroom.ingest"]);

    // A repeat is a duplicate and downloads nothing.
    const downloads = driveDownloads;
    await expect(
      client(actors.a).dataRoom.importDrive({ fileIds: ["doc1"] }),
    ).resolves.toMatchObject({
      imported: 0,
      duplicates: 1,
      failed: 0,
    });
    expect(driveDownloads).toBe(downloads);

    // Another member of the same space and a user in another space have no Drive account.
    await expect(
      client(actors.a2).dataRoom.importDrive({ fileIds: ["doc1"] }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    await expect(client(actors.b).dataRoom.driveList({})).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });

    // A folder that is not the caller's is refused, and one bad file does not stop the rest.
    const folderB = await client(actors.b).dataRoom.folderCreate({ name: "B drive import" });
    await expect(
      client(actors.a).dataRoom.importDrive({ fileIds: ["doc1"], folderId: folderB.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    // A file that cannot be imported is counted and does not stop the others.
    await expect(
      client(actors.a).dataRoom.importDrive({ fileIds: ["dir1", "missing", "doc1"] }),
    ).resolves.toMatchObject({ imported: 0, duplicates: 1, failed: 2 });
  });

  it("imports Drive folders as Data room folders, once, only through the caller's own Drive", async () => {
    const a = client(actors.a);
    const target = await a.dataRoom.folderCreate({ name: `Drive target ${run}` });
    const connection = await prisma.connection.findFirstOrThrow({
      where: { spaceId: actors.A.spaceId, userId: actors.a.userId, provider: "googledrive" },
    });
    const start = enqueued.length;
    const jobsNamed = (name: string) => enqueued.slice(start).filter((j) => j.name === name);
    const queue: BackgroundJob[] = [];
    const deps = () =>
      ({
        prisma,
        artifacts: new LocalArtifactStore(root),
        jobs: { enqueue: async (job: BackgroundJob) => void queue.push(job) },
        connectors: { managed: () => driveConnector },
      }) as never;
    const runImports = async () => {
      for (const job of jobsNamed("dataroom.drive.import"))
        await runDriveImport(deps(), job.payload as never);
    };
    const drain = async () => {
      await runImports();
      for (const job of queue.splice(0)) await runDriveFileImport(deps(), job.payload as never);
    };

    // The form is skipped and counted. The request writes nothing but the one queued plan.
    const downloads = driveDownloads;
    const result = await a.dataRoom.importDrive({ driveFolderIds: ["dir1"], folderId: target.id });
    expect(result).toMatchObject({
      imported: 0,
      duplicates: 0,
      failed: 1,
      queued: 2,
      folders: 3,
      total: 3,
    });
    expect(jobsNamed("dataroom.drive.import")).toHaveLength(1);
    expect((await a.dataRoom.folders()).filter((f) => f.name === "Sub")).toHaveLength(0);
    await runImports();
    expect(queue).toHaveLength(2);
    const folders = (await a.dataRoom.folders()).filter((f) => f.parentId !== undefined);
    const byName = (name: string) => folders.find((f) => f.name === name);
    const top = byName("Folder");
    const sub = byName("Sub");
    expect(top?.parentId).toBe(target.id);
    expect(sub?.parentId).toBe(top?.id);
    // An empty Drive folder still appears.
    expect(byName("Empty")?.parentId).toBe(sub?.id);

    // The queued jobs file each item in its folder, and a retry or second run adds nothing.
    await drain();
    await drain();
    const items = await prisma.dataRoomItem.findMany({
      where: {
        spaceId: actors.A.spaceId,
        externalId: { in: ["p1", "p2"] },
        sourceConnectionId: connection.id,
      },
    });
    expect(items.map((i) => [i.externalId, i.folderId]).sort()).toEqual([
      ["p1", top?.id],
      ["p2", sub?.id],
    ]);

    // Importing again reuses the folders and files nothing new.
    await a.dataRoom.importDrive({ driveFolderIds: ["dir1"], folderId: target.id });
    await drain();
    expect((await a.dataRoom.folders()).filter((f) => f.name === "Sub")).toHaveLength(1);
    expect(
      await prisma.dataRoomItem.count({
        where: { spaceId: actors.A.spaceId, externalId: { in: ["p1", "p2"] } },
      }),
    ).toBe(2);
    expect(driveDownloads).toBe(downloads);

    // Another user's job cannot import through this connection: it is not in their accounts.
    const foreign = { spaceId: actors.B.spaceId, userId: actors.d.userId, folderId: null };
    await runDriveFileImport(deps(), {
      ...foreign,
      connectionId: connection.id,
      externalId: "p1",
    } as never);
    await runDriveImport(deps(), {
      ...foreign,
      connectionId: connection.id,
      folders: [{ name: "Stolen", parent: null }],
      files: [],
    } as never);
    expect(await prisma.dataRoomItem.count({ where: { userId: actors.d.userId } })).toBe(0);
    expect(await prisma.dataRoomFolder.count({ where: { userId: actors.d.userId } })).toBe(0);
  });

  it("tracks a folder import through its jobs and reuses a folder of the same name", async () => {
    const a = client(actors.a);
    const target = await a.dataRoom.folderCreate({ name: `Tracked ${run}` });
    // A folder the user made by hand, with the name of the Drive folder.
    const mine = await a.dataRoom.folderCreate({ name: "Folder", parentId: target.id });
    await prisma.dataRoomItem.deleteMany({
      where: { userId: actors.a.userId, externalId: { in: ["p1", "p2"] } },
    });
    const queue: BackgroundJob[] = [];
    const deps = {
      prisma,
      artifacts: new LocalArtifactStore(root),
      jobs: { enqueue: async (job: BackgroundJob) => void queue.push(job) },
      connectors: { managed: () => driveConnector },
    } as never;
    const start = enqueued.length;
    const result = await a.dataRoom.importDrive({ driveFolderIds: ["dir1"], folderId: target.id });
    // Two files to wait for, and the form that was skipped.
    expect(result).toMatchObject({ total: 3, queued: 2 });
    const shown = async (id: string) => (await a.dataRoom.imports()).filter((i) => i.id === id);
    expect(await shown(result.importId)).toMatchObject([
      { total: 3, done: 0, failed: 1, inProgress: 2, finished: false },
    ]);

    for (const job of enqueued.slice(start).filter((j) => j.name === "dataroom.drive.import"))
      await runDriveImport(deps, job.payload as never);
    const created = (await a.dataRoom.folders()).filter((f) => f.name.startsWith("Folder"));
    expect(created.filter((f) => f.parentId === target.id).map((f) => [f.id, f.name])).toEqual([
      [mine.id, "Folder"],
    ]);
    for (const job of queue.splice(0)) await runDriveFileImport(deps, job.payload as never);
    const items = await prisma.dataRoomItem.findMany({ where: { importId: result.importId } });
    expect(items.map((i) => i.externalId).sort()).toEqual(["p1", "p2"]);
    expect(items.every((i) => i.folderId !== null)).toBe(true);

    // The files are read by the pipeline; the last one to be ready finishes the import.
    await prisma.dataRoomItem.updateMany({
      where: { importId: result.importId },
      data: { status: "ready" },
    });
    await settleDataRoomImport(prisma, result.importId);
    expect(await shown(result.importId)).toMatchObject([
      { done: 2, failed: 1, inProgress: 0, finished: true },
    ]);
    expect(
      await prisma.notification.count({
        where: { dedupeKey: `data-room-import:${result.importId}` },
      }),
    ).toBe(1);

    // Another user sees none of it.
    expect(await client(actors.b).dataRoom.imports()).toEqual([]);

    // Importing the same folder again files nothing new, so there is nothing to show.
    const again = await a.dataRoom.importDrive({ driveFolderIds: ["dir1"], folderId: target.id });
    for (const job of enqueued.slice(start).filter((j) => j.name === "dataroom.drive.import"))
      await runDriveImport(deps, job.payload as never);
    for (const job of queue.splice(0)) await runDriveFileImport(deps, job.payload as never);
    expect(
      (await prisma.dataRoomImport.findUniqueOrThrow({ where: { id: again.importId } })).finishedAt,
    ).not.toBeNull();
    // It only reports the skipped form; the two files were already in the Data room.
    expect(await shown(again.importId)).toMatchObject([{ done: 2, failed: 1, latest: [] }]);
  });

  it("finishes an import whose file is gone from Drive or whose plan cannot run", async () => {
    const connection = await prisma.connection.findFirstOrThrow({
      where: { spaceId: actors.A.spaceId, userId: actors.a.userId, provider: "googledrive" },
    });
    const deps = {
      prisma,
      artifacts: new LocalArtifactStore(root),
      jobs: { enqueue: async () => {} },
      connectors: { managed: () => driveConnector },
    } as never;
    const finished = async (id: string) =>
      (await prisma.dataRoomImport.findUniqueOrThrow({ where: { id } })).finishedAt !== null;
    const gone = await prisma.dataRoomImport.create({
      data: { spaceId: actors.A.spaceId, userId: actors.a.userId, source: "drive", total: 1 },
    });
    const payload = {
      spaceId: actors.A.spaceId,
      userId: actors.a.userId,
      connectionId: connection.id,
    };
    await runDriveFileImport(deps, {
      ...payload,
      externalId: "missing",
      folderId: null,
      importId: gone.id,
    } as never);
    expect(await finished(gone.id)).toBe(true);
    expect(await prisma.dataRoomImport.findUniqueOrThrow({ where: { id: gone.id } })).toMatchObject(
      {
        rejected: 1,
      },
    );

    // A plan for a connection that is not the user's files nothing, and counts every file.
    const refused = await prisma.dataRoomImport.create({
      data: { spaceId: actors.B.spaceId, userId: actors.d.userId, source: "drive", total: 2 },
    });
    await runDriveImport(deps, {
      spaceId: actors.B.spaceId,
      userId: actors.d.userId,
      connectionId: connection.id,
      folderId: null,
      importId: refused.id,
      folders: [],
      files: [
        { id: "p1", folder: null },
        { id: "p2", folder: null },
      ],
    } as never);
    expect(await finished(refused.id)).toBe(true);
    expect(await prisma.dataRoomItem.count({ where: { importId: refused.id } })).toBe(0);
  });

  it("ends a queued import quietly once the user is no longer a member of the space", async () => {
    const connection = await prisma.connection.create({
      data: {
        spaceId: actors.A.spaceId,
        userId: actors.a2.userId,
        connectorId: "google",
        provider: "googledrive",
        providerRef: "acct-a",
        displayName: "Second drive",
        status: "connected",
      },
    });
    const deps = {
      prisma,
      artifacts: new LocalArtifactStore(root),
      jobs: { enqueue: async () => {} },
      connectors: { managed: () => driveConnector },
    } as never;
    const payload = {
      spaceId: actors.A.spaceId,
      userId: actors.a2.userId,
      connectionId: connection.id,
      folderId: null,
    };
    const member = await prisma.spaceMember.findFirstOrThrow({
      where: { spaceId: actors.A.spaceId, userId: actors.a2.userId },
    });
    await prisma.spaceMember.delete({ where: { id: member.id } });
    await runDriveFileImport(deps, { ...payload, externalId: "p1" } as never);
    await runDriveImport(deps, {
      ...payload,
      folders: [{ name: "Late", parent: null }],
      files: [],
    } as never);
    expect(await prisma.dataRoomItem.count({ where: { userId: actors.a2.userId } })).toBe(0);
    expect(await prisma.dataRoomFolder.count({ where: { userId: actors.a2.userId } })).toBe(0);
    await prisma.spaceMember.create({ data: member });
  });

  it("leaves nothing behind when the plan cannot be queued, and finishes a half-written plan on retry", async () => {
    const a = client(actors.a);
    const folderCount = () => prisma.dataRoomFolder.count({ where: { userId: actors.a.userId } });
    const before = await folderCount();
    failEnqueue = true;
    await expect(a.dataRoom.importDrive({ driveFolderIds: ["dir1"] })).rejects.toThrow();
    failEnqueue = false;
    expect(await folderCount()).toBe(before);

    // The plan job fails after the folders and one file job were written; the retry completes it.
    const connection = await prisma.connection.findFirstOrThrow({
      where: { spaceId: actors.A.spaceId, userId: actors.a.userId, provider: "googledrive" },
    });
    const queued: string[] = [];
    let calls = 0;
    const jobs = {
      enqueue: async (job: BackgroundJob) => {
        if (++calls === 2) throw new Error("queue down");
        queued.push((job.payload as { externalId: string }).externalId);
      },
    };
    const plan = {
      spaceId: actors.A.spaceId,
      userId: actors.a.userId,
      connectionId: connection.id,
      folderId: null,
      folders: [{ name: `Half ${run}`, parent: null }],
      files: [
        { id: "p1", folder: 0 },
        { id: "p2", folder: 0 },
      ],
    };
    await expect(runDriveImport({ prisma, jobs } as never, plan)).rejects.toThrow("queue down");
    await runDriveImport({ prisma, jobs } as never, plan);
    expect(await prisma.dataRoomFolder.count({ where: { name: `Half ${run}` } })).toBe(1);
    expect(new Set(queued)).toEqual(new Set(["p1", "p2"]));
  });

  it("files direct picks with a folder import only through the one queued plan", async () => {
    const a = client(actors.a);
    const itemCount = () =>
      prisma.dataRoomItem.count({ where: { userId: actors.a.userId, externalId: "solo" } });
    failEnqueue = true;
    await expect(
      a.dataRoom.importDrive({ driveFolderIds: ["dir1"], fileIds: ["solo"] }),
    ).rejects.toThrow();
    failEnqueue = false;
    expect(await itemCount()).toBe(0);

    const start = enqueued.length;
    const result = await a.dataRoom.importDrive({ driveFolderIds: ["dir1"], fileIds: ["solo"] });
    expect(result).toMatchObject({ imported: 0, queued: 3 });
    expect(await itemCount()).toBe(0);
    const [job] = enqueued.slice(start).filter((j) => j.name === "dataroom.drive.import");
    expect(
      ((job as BackgroundJob).payload as unknown as { files: unknown[] }).files,
    ).toContainEqual({
      id: "solo",
      folder: null,
    });
  });

  it("refuses a folder import over the file limit before creating anything", async () => {
    const connection = await prisma.connection.create({
      data: {
        spaceId: actors.B.spaceId,
        userId: actors.d.userId,
        connectorId: "google",
        provider: "googledrive",
        providerRef: "acct-d",
        displayName: "Big drive",
        status: "connected",
      },
    });
    accounts.push({ id: connection.id, userId: actors.d.userId });
    const before = enqueued.length;
    await expect(
      client(actors.d).dataRoom.importDrive({ driveFolderIds: ["big"] }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: `Folder imports are limited to ${DRIVE_IMPORT_MAX_FILES} files.`,
    });
    expect(enqueued.length).toBe(before);
    expect(await prisma.dataRoomFolder.count({ where: { userId: actors.d.userId } })).toBe(0);

    // A folder id from someone else's Drive is just not found there: skipped, nothing queued.
    await expect(
      client(actors.d).dataRoom.importDrive({ driveFolderIds: ["dir1"] }),
    ).resolves.toMatchObject({ imported: 0, duplicates: 0, failed: 1, queued: 0, folders: 0 });
  });
});
