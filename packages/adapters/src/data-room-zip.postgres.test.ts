import { randomBytes, randomUUID } from "node:crypto";
import type { BackgroundJob } from "@rakazo/adapter-kit";
import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDataRoomRepos, createDb } from "@rakazo/db";
import { zipSync } from "fflate";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createFileDataRoomItem } from "./data-room-files.js";
import { MemoryArtifacts, RecordingJobs } from "./data-room-test-fakes.js";
import { runDataRoomZipUnpack } from "./data-room-zip-import.js";
import { ZipRefusal } from "./zip-unpack.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

const text = (value: string) => new TextEncoder().encode(value);
type UnpackJob = Extract<BackgroundJob, { name: "dataroom.zip.unpack" }>;

describePostgres("Data room zip unpacking (PostgreSQL)", () => {
  const run = randomUUID().slice(0, 8);
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let artifacts: MemoryArtifacts;
  let files: ReturnType<typeof createFileDataRoomItem>;
  let jobs: RecordingJobs;
  let owner: Actor;
  let other: Actor;
  const spaceId = `zip-space-${run}`;

  const zipInput = (name: string, bytes: Uint8Array, over: { importId?: string } = {}) => ({
    source: "upload" as const,
    name,
    mimeType: "application/zip",
    content: { bytes },
    folderId: null,
    ...over,
  });
  const owned = (who: Actor) => ({ spaceId: who.spaceId, userId: who.userId });
  /** The unpack jobs queued so far that nothing has run yet. */
  const queuedUnpacks = () => {
    const taken = jobs.take();
    return taken.filter((job): job is UnpackJob => job.name === "dataroom.zip.unpack");
  };
  const unpack = async (job: UnpackJob, signal?: AbortSignal) =>
    runDataRoomZipUnpack({ prisma, artifacts, jobs }, job.payload, signal);
  const itemNames = async (who: Actor) =>
    (await prisma.dataRoomItem.findMany({ where: owned(who) })).map((i) => i.name).sort();

  async function* pieces(bytes: Uint8Array, size = 1024 * 1024) {
    for (let at = 0; at < bytes.length; at += size) yield bytes.subarray(at, at + size);
  }

  beforeAll(async () => {
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await prisma.dataRoomItem.deleteMany({ where: { spaceId } });
      await prisma.dataRoomImport.deleteMany({ where: { spaceId } });
      await prisma.dataRoomFolder.deleteMany({ where: { spaceId } });
      await prisma.space.deleteMany({ where: { id: spaceId } });
      await prisma.organization.deleteMany({ where: { id: spaceId } });
      await prisma.user.deleteMany({ where: { id: { in: [owner.userId, other.userId] } } });
      await prisma.$disconnect();
      await db.pool.end();
    };
    await prisma.organization.create({
      data: { id: spaceId, name: "zip", slug: spaceId, createdAt: new Date() },
    });
    await prisma.space.create({
      data: { id: spaceId, organizationId: spaceId, name: "zip", isDefault: true },
    });
    const user = async (label: string, member: boolean): Promise<Actor> => {
      const userId = `zip-user-${label}-${run}`;
      await prisma.user.create({
        data: { id: userId, name: label, email: `${userId}@rakazo.test`, emailVerified: false },
      });
      // A trigger adds the member to the organization's default space.
      if (member) {
        await prisma.member.create({
          data: {
            id: `m-${userId}`,
            organizationId: spaceId,
            userId,
            role: "member",
            createdAt: new Date(),
          },
        });
      }
      return { userId, spaceId, email: `${userId}@rakazo.test`, isDeploymentOwner: false };
    };
    owner = await user("owner", true);
    other = await user("other", true);
  });
  afterAll(async () => close?.());

  beforeAll(() => {
    artifacts = new MemoryArtifacts();
    jobs = new RecordingJobs();
    files = createFileDataRoomItem({ prisma, artifacts, jobs }, createDataRoomRepos(prisma));
  });

  it("queues a zip as one import and files nothing during the request", async () => {
    const zip = zipSync({ "a.txt": text("alpha"), "docs/b.txt": text("bravo") });
    const result = await files.fileItem(owner, zipInput("queued.zip", zip));
    expect(result).toMatchObject({ item: null, created: true });
    const importId = (result as { importId: string }).importId;
    expect(await prisma.dataRoomItem.count({ where: owned(owner) })).toBe(0);
    expect(await prisma.dataRoomImport.findUnique({ where: { id: importId } })).toMatchObject({
      source: "upload",
      total: 2,
    });
    // The zip waits in storage, with one unpack job and a delayed backstop cleanup.
    expect(artifacts.blobs.size).toBe(1);
    const queued = jobs.take();
    const unpackJob = queued.find((job) => job.name === "dataroom.zip.unpack") as UnpackJob;
    expect(unpackJob.payload).toMatchObject({
      spaceId,
      userId: owner.userId,
      importId,
      entries: 2,
      size: zip.length,
    });
    expect(unpackJob.replaceKey).toBe(
      `dataroom.zip.unpack:${spaceId}:${unpackJob.payload.storageKey}`,
    );
    const cleanup = queued.find((job) => job.name === "dataroom.blob.delete");
    expect(cleanup?.availableAt?.getTime()).toBeGreaterThan(Date.now() + 60 * 60 * 1000);

    // Running the job files the entries and removes the zip.
    await unpack(unpackJob);
    expect(await itemNames(owner)).toEqual(["a.txt", "b.txt"]);
    expect(artifacts.blobs.has(unpackJob.payload.storageKey)).toBe(false);
    for (const item of await prisma.dataRoomItem.findMany({ where: owned(owner) })) {
      await prisma.dataRoomItem.delete({ where: { id: item.id } });
    }
    await prisma.dataRoomFolder.deleteMany({ where: { spaceId } });
  });

  it("creates only the folders that receive a new file when a zip is re-uploaded elsewhere", async () => {
    const dr = createDataRoomRepos(prisma);
    const target = await dr.createFolder(owner, { name: `Target ${run}` });
    const unpackInto = async (zip: Uint8Array) => {
      await files.fileItem(owner, { ...zipInput("dup.zip", zip), folderId: target.id });
      const [job] = queuedUnpacks() as [UnpackJob];
      await unpack(job);
    };
    const folderCount = () => prisma.dataRoomFolder.count({ where: owned(owner) });
    const first = zipSync({ "keep/a.txt": text("dup-a"), "keep/deep/b.txt": text("dup-b") });
    await unpackInto(first);
    // Same bytes again, into another folder: every file is a duplicate, so no folder is made.
    const other2 = await dr.createFolder(owner, { name: `Other ${run}` });
    const before = await folderCount();
    await files.fileItem(owner, { ...zipInput("dup.zip", first), folderId: other2.id });
    await unpack((queuedUnpacks() as [UnpackJob])[0]);
    expect(await folderCount()).toBe(before);
    // One new file: only its own folder path appears.
    await files.fileItem(owner, {
      ...zipInput("dup2.zip", zipSync({ "keep/a.txt": text("dup-a"), "fresh/new.txt": text("n") })),
      folderId: other2.id,
    });
    await unpack((queuedUnpacks() as [UnpackJob])[0]);
    expect(await folderCount()).toBe(before + 1);
    const fresh = await prisma.dataRoomFolder.findFirst({
      where: { ...owned(owner), parentId: other2.id },
    });
    expect(fresh?.name).toBe("fresh");
    for (const table of [prisma.dataRoomItem, prisma.dataRoomFolder] as const) {
      await (table as typeof prisma.dataRoomItem).deleteMany({ where: owned(owner) });
    }
  });

  it("files one item per file, in the zip's folders, for the owner only", async () => {
    const inner = zipSync({ "in.txt": text("inside") });
    const zip = zipSync({
      "readme.txt": text("top"),
      "contracts/nda.md": text("# nda"),
      "contracts/2026/lease.txt": text("lease"),
      "nested.zip": inner,
      "__MACOSX/._readme.txt": text("meta"),
      ".DS_Store": text("meta"),
    });
    const queued = await files.fileItem(owner, zipInput("bundle.zip", zip));
    expect(queued.item).toBeNull();
    const [job] = queuedUnpacks() as [UnpackJob];
    const ingestsBefore = jobs.all.filter((j) => j.name === "dataroom.ingest").length;
    await unpack(job);

    const items = await prisma.dataRoomItem.findMany({
      where: owned(owner),
      include: { folder: true },
    });
    expect(items.map((i) => i.name).sort()).toEqual([
      "lease.txt",
      "nda.md",
      "nested.zip",
      "readme.txt",
    ]);
    expect(items.some((i) => i.name === "bundle.zip")).toBe(false);
    expect(items.every((i) => i.source === "upload" && i.status === "pending")).toBe(true);
    const lease = items.find((i) => i.name === "lease.txt");
    const parent = await prisma.dataRoomFolder.findFirst({ where: { id: lease?.folderId ?? "" } });
    expect([parent?.name, items.find((i) => i.name === "nda.md")?.folder?.name]).toEqual([
      "2026",
      "contracts",
    ]);
    expect(items.find((i) => i.name === "readme.txt")?.folderId).toBeNull();
    // The nested zip is a plain file of its own, not unpacked.
    expect(Number(items.find((i) => i.name === "nested.zip")?.size)).toBe(inner.length);
    expect(items.some((i) => i.name === "in.txt")).toBe(false);

    // Ingest was queued for each item, and none of it is visible to another user.
    expect(jobs.all.filter((j) => j.name === "dataroom.ingest").length - ingestsBefore).toBe(4);
    expect(await prisma.dataRoomItem.count({ where: owned(other) })).toBe(0);
    expect(await prisma.dataRoomFolder.count({ where: owned(other) })).toBe(0);

    // The import row backs "Importing X of N".
    const imp = await prisma.dataRoomImport.findFirst({
      where: { ...owned(owner), id: (queued as { importId: string }).importId },
    });
    expect(imp).toMatchObject({ source: "upload", total: 4, duplicates: 0, rejected: 0 });
    expect(artifacts.blobs.has(job.payload.storageKey)).toBe(false);

    // The same zip again files nothing new.
    await files.fileItem(owner, zipInput("bundle.zip", zip));
    const [again] = queuedUnpacks() as [UnpackJob];
    await unpack(again);
    expect(await prisma.dataRoomItem.count({ where: owned(owner) })).toBe(4);
    expect(
      await prisma.dataRoomImport.findUnique({ where: { id: again.payload.importId } }),
    ).toMatchObject({
      total: 4,
      duplicates: 4,
    });
  });

  it("unpacks a zip over 50 MB with entries over 50 MB without buffering them", async () => {
    const before = await prisma.dataRoomItem.count({ where: owned(owner) });
    const a = randomBytes(60 * 1024 * 1024);
    const b = randomBytes(60 * 1024 * 1024);
    // Stored (level 0): random bytes do not compress, and a zero-filled entry would be refused as a bomb.
    const zip = zipSync({ "big/a.bin": [a, { level: 0 }], "big/b.bin": [b, { level: 0 }] });
    expect(zip.length).toBeGreaterThan(100 * 1024 * 1024);

    // Nothing may be written whole: `put` throws, so only streaming gets through.
    artifacts.failPut = true;
    artifacts.chunks = 0;
    artifacts.maxChunkBytes = 0;
    try {
      const queued = await files.fileItem(owner, {
        ...zipInput("huge.zip", zip),
        content: { stream: pieces(zip, 64 * 1024) },
      });
      expect(queued.item).toBeNull();
      const [job] = queuedUnpacks() as [UnpackJob];
      expect(job.payload.size).toBe(zip.length);
      artifacts.chunks = 0;
      artifacts.maxChunkBytes = 0;
      await unpack(job);
      expect(artifacts.chunks).toBeGreaterThan(1_000);
      expect(artifacts.maxChunkBytes).toBeLessThanOrEqual(1024 * 1024);
      expect(artifacts.blobs.has(job.payload.storageKey)).toBe(false);
    } finally {
      artifacts.failPut = false;
    }
    const added = (await prisma.dataRoomItem.findMany({ where: owned(owner) })).filter(
      (i) => i.name === "a.bin" || i.name === "b.bin",
    );
    expect(added.map((i) => Number(i.size))).toEqual([a.length, b.length]);
    expect(await prisma.dataRoomItem.count({ where: owned(owner) })).toBe(before + 2);
    for (const item of added) {
      expect(
        Buffer.from(artifacts.blobs.get(item.storageKey ?? "") ?? []).equals(
          item.name === "a.bin" ? a : b,
        ),
      ).toBe(true);
    }
  }, 120_000);

  it("removes the stored zip after a refusal and after entries fail", async () => {
    // The job re-checks the zip: garbage in storage is refused and every file counts as failed.
    const garbage = await artifacts.put({
      bytes: text("not a zip at all, definitely not a zip"),
    });
    const imp = await prisma.dataRoomImport.create({
      data: { ...owned(owner), source: "upload", total: 3 },
    });
    await runDataRoomZipUnpack(
      { prisma, artifacts, jobs },
      {
        ...owned(owner),
        storageKey: garbage.id,
        size: 38,
        entries: 3,
        importId: imp.id,
        name: "g.zip",
        source: "upload",
        folderId: null,
      },
    );
    expect(artifacts.blobs.has(garbage.id)).toBe(false);
    expect(await prisma.dataRoomImport.findUnique({ where: { id: imp.id } })).toMatchObject({
      rejected: 3,
    });

    // One entry that cannot be inflated is rejected; the other is filed; the zip is removed.
    const good = text("fine ".repeat(200));
    const bad = text("will be damaged ".repeat(200));
    const zip = zipSync({ "good.txt": good, "bad.txt": bad });
    // Damage the deflated data of bad.txt (the entry after good.txt).
    const at = Buffer.from(zip).indexOf(Buffer.from("bad.txt")) + "bad.txt".length;
    zip.fill(0xff, at + 2, at + 12);
    const queued = await files.fileItem(owner, zipInput("partial.zip", zip));
    const [job] = queuedUnpacks() as [UnpackJob];
    await unpack(job);
    const names = (await itemNames(owner)).filter((n) => n === "good.txt" || n === "bad.txt");
    expect(names).toEqual(["good.txt"]);
    expect(
      await prisma.dataRoomImport.findUnique({
        where: { id: (queued as { importId: string }).importId },
      }),
    ).toMatchObject({ total: 2, rejected: 1 });
    expect(artifacts.blobs.has(job.payload.storageKey)).toBe(false);
  });

  it("keeps the stored zip when storage fails, and a retry runs it", async () => {
    const zip = zipSync({ "retry-a.txt": text("a"), "retry-b.txt": text("b") });
    await files.fileItem(owner, zipInput("retry.zip", zip));
    const [job] = queuedUnpacks() as [UnpackJob];
    const realGetStream = artifacts.getStream.bind(artifacts);
    artifacts.getStream = async () => {
      throw new Error("storage is down");
    };
    await expect(unpack(job)).rejects.toThrow("storage is down");
    artifacts.getStream = realGetStream;
    expect(artifacts.blobs.has(job.payload.storageKey)).toBe(true);
    await unpack(job);
    expect(await itemNames(owner)).toEqual(expect.arrayContaining(["retry-a.txt", "retry-b.txt"]));
    expect(artifacts.blobs.has(job.payload.storageKey)).toBe(false);
  });

  it("counts earlier entries once when a job is retried", async () => {
    const zip = zipSync({ "once-a.txt": text("first"), "once-b.txt": text("second") });
    const queued = await files.fileItem(owner, zipInput("once.zip", zip));
    const [job] = queuedUnpacks() as [UnpackJob];
    // The job runs out of time after it filed the first entry.
    const controller = new AbortController();
    const realPutStream = artifacts.putStream.bind(artifacts);
    artifacts.putStream = async (...args) => {
      const stored = await realPutStream(...args);
      controller.abort();
      return stored;
    };
    await expect(unpack(job, controller.signal)).rejects.toThrow();
    artifacts.putStream = realPutStream;
    expect(artifacts.blobs.has(job.payload.storageKey)).toBe(true);
    await unpack(job);
    const row = await prisma.dataRoomImport.findUnique({
      where: { id: (queued as { importId: string }).importId },
    });
    expect(row).toMatchObject({ total: 2, duplicates: 0, rejected: 0 });
    expect((await itemNames(owner)).filter((n) => n.startsWith("once-"))).toEqual([
      "once-a.txt",
      "once-b.txt",
    ]);
    expect(artifacts.blobs.has(job.payload.storageKey)).toBe(false);
  });

  it("narrates the import in stages, and a retry ends in the same state", async () => {
    const zip = zipSync({ "n-a.txt": text("a1"), "n-b.txt": text("b2"), "n-c.txt": text("c3") });
    const queued = (await files.fileItem(owner, zipInput("narrate.zip", zip))) as {
      importId: string;
    };
    const [job] = queuedUnpacks() as [UnpackJob];
    const writes: { stage?: string; currentName?: string | null }[] = [];
    const update = prisma.dataRoomImport.update.bind(prisma.dataRoomImport);
    const spy = vi.spyOn(prisma.dataRoomImport, "update").mockImplementation(((args: {
      data: { stage?: string; currentName?: string | null };
    }) => {
      writes.push(args.data);
      return update(args as never);
    }) as never);
    await unpack(job);
    spy.mockRestore();
    const stages = writes.map((w) => w.stage).filter(Boolean);
    expect(stages[0]).toBe("opening");
    expect(stages.at(-1)).toBe("done");
    expect(stages).toContain("adding");
    const names = writes.map((w) => w.currentName).filter(Boolean);
    expect(names[0]).toBe("n-a.txt");
    expect(names.at(-1)).toBe("n-c.txt");
    const row = () => prisma.dataRoomImport.findUnique({ where: { id: queued.importId } });
    expect(await row()).toMatchObject({
      stage: "done",
      currentName: null,
      total: 3,
      duplicates: 0,
    });
    // Running the same job again changes no count.
    artifacts.blobs.set(job.payload.storageKey, zip);
    await unpack(job);
    expect(await row()).toMatchObject({
      stage: "done",
      currentName: null,
      total: 3,
      duplicates: 0,
    });
  });

  it("counts a repeat inside one zip as a duplicate, also across a retry", async () => {
    const same = text("licence text");
    const zip = zipSync({ "a/LICENSE-x": same, "b/LICENSE-y": same, "c.txt": text("other") });
    const queued = await files.fileItem(owner, zipInput("twins.zip", zip));
    const importId = (queued as { importId: string }).importId;
    const [job] = queuedUnpacks() as [UnpackJob];
    // The job runs out of time after the first entry, then a retry files the rest.
    const controller = new AbortController();
    const realPutStream = artifacts.putStream.bind(artifacts);
    artifacts.putStream = async (...args) => {
      const stored = await realPutStream(...args);
      controller.abort();
      return stored;
    };
    await expect(unpack(job, controller.signal)).rejects.toThrow();
    artifacts.putStream = realPutStream;
    await unpack(job);
    expect(await prisma.dataRoomImport.findUnique({ where: { id: importId } })).toMatchObject({
      total: 3,
      duplicates: 1,
      rejected: 0,
    });
    expect(await prisma.dataRoomItem.count({ where: { ...owned(owner), importId } })).toBe(2);
  });

  it("keeps the zip when storage fails on a later entry, then files it on retry", async () => {
    const zip = zipSync({ "flaky-a.txt": text("fa"), "flaky-b.txt": text("fb") });
    const queued = await files.fileItem(owner, zipInput("flaky.zip", zip));
    const [job] = queuedUnpacks() as [UnpackJob];
    const realPutStream = artifacts.putStream.bind(artifacts);
    let calls = 0;
    artifacts.putStream = async (...args) => {
      if (++calls === 2) throw new Error("storage timed out");
      return realPutStream(...args);
    };
    await expect(unpack(job)).rejects.toThrow("storage timed out");
    artifacts.putStream = realPutStream;
    expect(artifacts.blobs.has(job.payload.storageKey)).toBe(true);
    await unpack(job);
    expect(
      await prisma.dataRoomImport.findUnique({
        where: { id: (queued as { importId: string }).importId },
      }),
    ).toMatchObject({ total: 2, duplicates: 0, rejected: 0 });
    expect(await itemNames(owner)).toEqual(expect.arrayContaining(["flaky-a.txt", "flaky-b.txt"]));
    expect(artifacts.blobs.has(job.payload.storageKey)).toBe(false);
  });

  it("abandons the zip when the user left the space", async () => {
    const zip = zipSync({ "gone.txt": text("x") });
    const stored = await artifacts.put({ bytes: zip });
    const stranger: Actor = { ...owner, userId: `zip-user-stranger-${run}` };
    await prisma.user.create({
      data: {
        id: stranger.userId,
        name: "s",
        email: `${stranger.userId}@rakazo.test`,
        emailVerified: false,
      },
    });
    const imp = await prisma.dataRoomImport.create({
      data: { ...owned(stranger), source: "upload", total: 1 },
    });
    await runDataRoomZipUnpack(
      { prisma, artifacts, jobs },
      {
        ...owned(stranger),
        storageKey: stored.id,
        size: zip.length,
        entries: 1,
        importId: imp.id,
        name: "z.zip",
        source: "upload",
        folderId: null,
      },
    );
    expect(await prisma.dataRoomItem.count({ where: owned(stranger) })).toBe(0);
    expect(artifacts.blobs.has(stored.id)).toBe(false);
    expect(await prisma.dataRoomImport.findUnique({ where: { id: imp.id } })).toMatchObject({
      rejected: 1,
    });
    await prisma.dataRoomImport.delete({ where: { id: imp.id } });
    await prisma.user.delete({ where: { id: stranger.userId } });
  });

  it("adds to the caller's import and folder when it has them", async () => {
    const folder = await createDataRoomRepos(prisma).createFolder(owner, { name: "Inbox" });
    const imp = await prisma.dataRoomImport.create({
      data: { ...owned(owner), source: "gmail", total: 1 },
    });
    const zip = zipSync({ "x/one.txt": text("1"), "two.txt": text("2") });
    await files.fileItem(owner, {
      ...zipInput("mail.zip", zip, { importId: imp.id }),
      source: "gmail",
      folderId: folder.id,
      externalId: "gmail:m1:a1",
    });
    expect((await prisma.dataRoomImport.findUnique({ where: { id: imp.id } }))?.total).toBe(2);
    const [job] = queuedUnpacks() as [UnpackJob];
    await unpack(job);
    const two = await prisma.dataRoomItem.findFirst({
      where: { ...owned(owner), name: "two.txt" },
    });
    expect([two?.folderId, two?.importId, two?.externalId]).toEqual([
      folder.id,
      imp.id,
      "gmail:m1:a1#two.txt",
    ]);
    const one = await prisma.dataRoomItem.findFirst({
      where: { ...owned(owner), name: "one.txt" },
    });
    const sub = await prisma.dataRoomFolder.findFirst({ where: { id: one?.folderId ?? "" } });
    expect([sub?.name, sub?.parentId]).toEqual(["x", folder.id]);
  });

  it.each([
    ["unsafe", () => zipSync({ "../evil.txt": text("x") })],
    ["not a zip", () => text("this is just text, and not a zip file at all")],
    ["bomb", () => zipSync({ "bomb.txt": new Uint8Array(8 * 1024 * 1024) })],
  ])("refuses a %s zip before queueing and leaves no blob", async (_name, make) => {
    const before = artifacts.blobs.size;
    const items = await prisma.dataRoomItem.count({ where: owned(owner) });
    await expect(files.fileItem(owner, zipInput("bad.zip", make()))).rejects.toBeInstanceOf(
      ZipRefusal,
    );
    expect(artifacts.blobs.size).toBe(before);
    expect(await prisma.dataRoomItem.count({ where: owned(owner) })).toBe(items);
    expect(queuedUnpacks()).toEqual([]);
  });
});
