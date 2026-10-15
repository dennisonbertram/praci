import { createHash, randomUUID } from "node:crypto";
import type { BackgroundJob } from "@rakazo/adapter-kit";
import { EmbedderMisconfiguredError } from "@rakazo/adapter-kit";
import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDataRoomRepos, createDb } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DataRoomJobDeps } from "./data-room-jobs.js";
import {
  reconcileDataRoom,
  runDataRoomClassify,
  runDataRoomIndex,
  runDataRoomIngest,
} from "./data-room-jobs.js";
import {
  FakeClassifier,
  FakeEmbedder,
  fakeAi,
  MemoryArtifacts,
  makePdf,
  RecordingJobs,
} from "./data-room-test-fakes.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("data room pipeline jobs (PostgreSQL)", () => {
  const run = randomUUID().slice(0, 8);
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let actor: Actor;
  let repo: ReturnType<typeof createDataRoomRepos>;
  let artifacts: MemoryArtifacts;
  let jobs: RecordingJobs;
  let classifier: FakeClassifier;
  let embedder: FakeEmbedder;
  let ai = fakeAi();
  const scope = () => ({ spaceId: actor.spaceId, userId: actor.userId });

  const deps = (): DataRoomJobDeps => ({
    prisma,
    jobs,
    artifacts,
    resolveAi: async () => ai,
    classifier: () => classifier,
  });

  const dispatch = async (job: BackgroundJob) => {
    const payload = job.payload as { spaceId: string; userId: string; itemId: string };
    if (job.name === "dataroom.ingest") await runDataRoomIngest(deps(), payload);
    else if (job.name === "dataroom.classify") await runDataRoomClassify(deps(), payload);
    else if (job.name === "dataroom.index") await runDataRoomIndex(deps(), payload);
  };
  /** Runs queued jobs, and the jobs they queue, until none are left. */
  const drain = async () => {
    for (let jobsRun = 0; jobs.queue.length && jobsRun < 20; jobsRun++) {
      await dispatch(jobs.queue.shift() as BackgroundJob);
    }
  };

  let counter = 0;
  const addItem = async (
    text: string | Uint8Array,
    opts: { name?: string; mimeType?: string; folderId?: string | null } = {},
  ) => {
    const bytes = typeof text === "string" ? new TextEncoder().encode(text) : text;
    const stored = await artifacts.put({ bytes });
    const { item } = await repo.createItem(actor, {
      source: "upload",
      sha256: createHash("sha256").update(`${run}-${counter++}`).digest("hex"),
      name: opts.name ?? "doc.txt",
      mimeType: opts.mimeType ?? "text/plain",
      size: bytes.byteLength,
      storageKey: stored.id,
      folderId: opts.folderId ?? null,
    });
    jobs.queue.push({
      name: "dataroom.ingest",
      payload: { ...scope(), itemId: item.id },
    } as BackgroundJob);
    return item;
  };
  const reload = (id: string) => prisma.dataRoomItem.findUniqueOrThrow({ where: { id } });
  const chunksOf = async (id: string) => (await allChunksOf(id)).filter((c) => c.ordinal >= 0);
  const allChunksOf = (id: string) =>
    prisma.$queryRaw<{ ordinal: number; embedded: boolean; model: string | null }[]>`
      SELECT ordinal, embedding IS NOT NULL AS embedded, "embeddingModel" AS model
      FROM data_room_chunks WHERE "itemId" = ${id} ORDER BY ordinal`;

  beforeAll(async () => {
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    const userId = `drj-user-${run}`;
    const orgId = `drj-org-${run}`;
    const spaceId = `drj-space-${run}`;
    await prisma.user.create({
      data: { id: userId, name: "j", email: `${userId}@rakazo.test`, emailVerified: false },
    });
    await prisma.organization.create({
      data: { id: orgId, name: "j", slug: orgId, createdAt: new Date() },
    });
    await prisma.space.create({
      data: { id: spaceId, organizationId: orgId, name: "j", isDefault: true },
    });
    actor = { userId, spaceId, email: `${userId}@rakazo.test`, isDeploymentOwner: false };
    repo = createDataRoomRepos(prisma);
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.space.deleteMany({ where: { id: actor.spaceId } });
    await prisma.organization.deleteMany({ where: { slug: `drj-org-${run}` } });
    await prisma.user.deleteMany({ where: { id: actor.userId } });
    await close();
  });

  const reset = () => {
    artifacts = new MemoryArtifacts();
    jobs = new RecordingJobs();
    classifier = new FakeClassifier();
    embedder = new FakeEmbedder();
    ai = fakeAi({ embedder, embeddingModel: embedder.modelName });
  };

  it("takes a PDF from pending to ready: text, facets, folder and embeddings", async () => {
    reset();
    const item = await addItem(makePdf("Invoice 4821 from Acme Example Co"), {
      name: "inv.pdf",
      mimeType: "application/pdf",
    });
    await drain();
    const done = await reload(item.id);
    expect(done).toMatchObject({
      status: "ready",
      error: null,
      failures: 0,
      docType: "invoice",
      currency: "USD",
      parties: ["Acme Example Co"],
      tags: ["billing"],
      summary: "An invoice.",
    });
    expect(done.amountCents).toBe(123_456n);
    expect(done.docDate?.toISOString()).toBe("2026-03-15T00:00:00.000Z");
    expect(done.classifiedAt).not.toBeNull();
    expect(await repo.getItemText(actor, item.id)).toContain("Invoice 4821 from Acme Example Co");
    expect(classifier.calls[0]?.text).toContain("Invoice 4821");
    expect(await chunksOf(item.id)).toEqual([
      { ordinal: 0, embedded: true, model: "fake-embed-1" },
    ]);

    const folders = await prisma.dataRoomFolder.findMany({
      where: { spaceId: actor.spaceId, userId: actor.userId },
    });
    const leaf = folders.find((f) => f.name === "2026");
    const parent = folders.find((f) => f.name === "Invoices");
    expect(leaf?.parentId).toBe(parent?.id);
    expect(folders.every((f) => f.createdBy === "agent")).toBe(true);
    expect(done.folderId).toBe(leaf?.id);
    // The next upload gets the existing folder list and reuses the folders instead of copying them.
    const second = await addItem("another invoice");
    await drain();
    expect(classifier.calls.at(-1)?.folders).toHaveLength(2);
    expect(classifier.calls.at(-1)?.folders).toContainEqual(["Invoices", "2026"]);
    expect((await reload(second.id)).folderId).toBe(leaf?.id);
    expect(await prisma.dataRoomFolder.count({ where: { spaceId: actor.spaceId } })).toBe(2);
  });

  it("keeps an item the user uploaded into a folder where it is", async () => {
    reset();
    const mine = await repo.createFolder(actor, { name: `Mine-${run}` });
    const item = await addItem("contract text", { folderId: mine.id });
    const before = await prisma.dataRoomFolder.count({ where: { spaceId: actor.spaceId } });
    await drain();
    const done = await reload(item.id);
    expect(done.folderId).toBe(mine.id);
    expect(done.docType).toBe("invoice");
    expect(await prisma.dataRoomFolder.count({ where: { spaceId: actor.spaceId } })).toBe(before);
  });

  it("skips the model steps without consent and indexes keyword-only", async () => {
    reset();
    ai = fakeAi({ embedder, embeddingModel: embedder.modelName, allowed: false });
    const item = await addItem("unconsented text");
    await drain();
    const done = await reload(item.id);
    expect(done).toMatchObject({ status: "ready", docType: null, classifiedAt: null });
    expect(classifier.calls).toEqual([]);
    expect(embedder.calls).toEqual([]);
    expect(await chunksOf(item.id)).toEqual([{ ordinal: 0, embedded: false, model: null }]);
  });

  it("skips the model steps when no model resolves", async () => {
    reset();
    ai = fakeAi({
      model: null,
      embedder: null,
      embeddingModel: null,
      recipients: [],
      allowed: false,
    });
    const item = await addItem("no model text");
    await drain();
    expect((await reload(item.id)).status).toBe("ready");
    expect(classifier.calls).toEqual([]);
  });

  it("indexes Office documents with no text and no model calls", async () => {
    reset();
    const item = await addItem("PK fake docx", {
      name: "a.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    await drain();
    expect((await reload(item.id)).status).toBe("ready");
    expect(await repo.getItemText(actor, item.id)).toBe("");
    expect(classifier.calls).toEqual([]);
    expect(await chunksOf(item.id)).toEqual([]);
    expect(await allChunksOf(item.id)).toHaveLength(1); // the metadata chunk
  });

  it("keeps unchanged chunks' embeddings and re-embeds after the model changes", async () => {
    reset();
    const item = await addItem("stable text");
    await drain();
    expect(embedder.calls).toHaveLength(1);
    const again = async () => {
      await prisma.dataRoomItem.update({ where: { id: item.id }, data: { status: "indexing" } });
      await runDataRoomIndex(deps(), { ...scope(), itemId: item.id });
    };
    await again();
    expect(embedder.calls).toHaveLength(1);

    const next = new FakeEmbedder("fake-embed-2");
    ai = fakeAi({ embedder: next, embeddingModel: next.modelName });
    await again();
    expect(next.calls).toHaveLength(1);
    expect(await chunksOf(item.id)).toEqual([
      { ordinal: 0, embedded: true, model: "fake-embed-2" },
    ]);
  });

  it("falls back to keyword-only when the embedder is misconfigured", async () => {
    reset();
    embedder.failWith = new EmbedderMisconfiguredError("wrong size");
    const item = await addItem("misconfigured embedder");
    await drain();
    expect((await reload(item.id)).status).toBe("ready");
    expect(await chunksOf(item.id)).toEqual([{ ordinal: 0, embedded: false, model: null }]);
  });

  it("does nothing for an item that was deleted, at every step", async () => {
    reset();
    const item = await addItem("soon gone");
    await repo.deleteItem(actor, item.id);
    for (const step of [runDataRoomIngest, runDataRoomClassify, runDataRoomIndex]) {
      await expect(step(deps(), { ...scope(), itemId: item.id })).resolves.toBeUndefined();
    }
    expect(jobs.queue.length).toBe(1); // only the ingest job this test queued itself
    expect(classifier.calls).toEqual([]);
    expect(embedder.calls).toEqual([]);
    expect(await prisma.dataRoomItemText.count({ where: { itemId: item.id } })).toBe(0);
  });

  it("writes nothing when the item changed while the step ran", async () => {
    reset();
    const item = await addItem("changes under it");
    await runDataRoomIngest(deps(), { ...scope(), itemId: item.id });
    jobs.take();
    const slow = new FakeClassifier();
    classifier = slow;
    const classify = slow.classify.bind(slow);
    slow.classify = async (input) => {
      const result = await classify(input);
      await prisma.dataRoomItem.update({
        where: { id: item.id },
        data: { revision: { increment: 1 } },
      });
      return result;
    };
    await runDataRoomClassify(deps(), { ...scope(), itemId: item.id });
    const after = await reload(item.id);
    expect(after.docType).toBeNull();
    expect(after.status).toBe("classifying");
    expect(jobs.queue).toEqual([]);
  });

  it("does not repeat a model call once its result is saved, and queues the next step", async () => {
    reset();
    const item = await addItem("retry me");
    await runDataRoomIngest(deps(), { ...scope(), itemId: item.id });
    await runDataRoomClassify(deps(), { ...scope(), itemId: item.id });
    jobs.take();
    expect(classifier.calls).toHaveLength(1);
    // The queue delivers the classify job again (for example after a lost acknowledgement).
    await runDataRoomClassify(deps(), { ...scope(), itemId: item.id });
    expect(classifier.calls).toHaveLength(1);
    expect(jobs.queue.map((j) => j.name)).toEqual(["dataroom.index"]);
    // A repeated ingest after the text was saved queues classify without reading the blob again.
    const other = await addItem("ingest retry");
    jobs.take();
    await runDataRoomIngest(deps(), { ...scope(), itemId: other.id });
    jobs.take();
    artifacts.blobs.clear();
    await runDataRoomIngest(deps(), { ...scope(), itemId: other.id });
    expect(jobs.queue.map((j) => j.name)).toEqual(["dataroom.classify"]);
  });

  it("records each classify failure, then gives up on facets and still indexes the item", async () => {
    reset();
    classifier.failWith = new Error("model said no");
    const item = await addItem("will fail to classify");
    await runDataRoomIngest(deps(), { ...scope(), itemId: item.id });
    jobs.take();
    const classify = () => runDataRoomClassify(deps(), { ...scope(), itemId: item.id });
    await expect(classify()).rejects.toThrow("model said no");
    expect(await reload(item.id)).toMatchObject({
      status: "classifying",
      failures: 1,
      error: "Error: model said no",
    });
    await expect(classify()).rejects.toThrow();
    // The last attempt does not throw: it queues index.
    await classify();
    expect(await reload(item.id)).toMatchObject({
      status: "indexing",
      failures: 0,
      error: "Error: model said no",
    });
    expect(jobs.queue.map((j) => j.name)).toEqual(["dataroom.index"]);
    await drain();
    // Ready, searchable by text and name, and still showing why it was not filed.
    expect(await reload(item.id)).toMatchObject({
      status: "ready",
      failures: 0,
      error: "Error: model said no",
      docType: null,
    });
    expect(await allChunksOf(item.id)).toHaveLength(2);
    // A stray delivery after that must not call the model again.
    await classify();
    expect(classifier.calls).toHaveLength(3);
  });

  it("finds a document with no text by a word from its file name", async () => {
    reset();
    const item = await addItem("PK fake docx", {
      name: "zephyrquartz-budget.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    await drain();
    expect(await repo.getItemText(actor, item.id)).toBe("");
    const hits = await repo.searchPage(actor, { query: "zephyrquartz" });
    expect(hits.results.map((r) => r.item.id)).toEqual([item.id]);
    expect(hits.results[0]?.ordinal).toBe(-1);
  });

  it("rewrites the metadata chunk and re-embeds it when the facets change", async () => {
    reset();
    const item = await addItem("some text");
    await drain();
    const before = await prisma.dataRoomChunk.findFirstOrThrow({
      where: { itemId: item.id, ordinal: -1 },
    });
    await prisma.dataRoomItem.update({
      where: { id: item.id },
      data: { status: "indexing", summary: "Totally new summary" },
    });
    await runDataRoomIndex(deps(), { ...scope(), itemId: item.id });
    const after = await prisma.dataRoomChunk.findFirstOrThrow({
      where: { itemId: item.id, ordinal: -1 },
    });
    expect(after.text).toContain("Totally new summary");
    expect(after.contentHash).not.toBe(before.contentHash);
    expect((await allChunksOf(item.id)).find((c) => c.ordinal === -1)?.embedded).toBe(true);
  });

  it("returns a failed ingest to failed after the last attempt", async () => {
    reset();
    const item = await addItem("x");
    artifacts.blobs.clear();
    const ingest = () => runDataRoomIngest(deps(), { ...scope(), itemId: item.id });
    for (let i = 0; i < 3; i++) await expect(ingest()).rejects.toThrow("missing blob");
    expect(await reload(item.id)).toMatchObject({ status: "failed", failures: 3 });
  });

  it("lets exactly one of two overlapping index runs embed, and the loser writes nothing", async () => {
    reset();
    const item = await addItem("overlap text");
    await runDataRoomIngest(deps(), { ...scope(), itemId: item.id });
    await runDataRoomClassify(deps(), { ...scope(), itemId: item.id });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const embed = embedder.embed.bind(embedder);
    let started = 0;
    embedder.embed = async (texts, ctx) => {
      started += 1;
      await gate;
      return embed(texts, ctx);
    };
    const first = runDataRoomIndex(deps(), { ...scope(), itemId: item.id });
    while (started === 0) await new Promise((r) => setTimeout(r, 5));
    const before = await reload(item.id);
    await runDataRoomIndex(deps(), { ...scope(), itemId: item.id }); // loses the claim at once
    expect(started).toBe(1);
    expect(await reload(item.id)).toMatchObject({
      revision: before.revision,
      status: "indexing",
    });
    release();
    await first;
    expect(embedder.calls).toHaveLength(1);
    const done = await reload(item.id);
    expect(done).toMatchObject({ status: "ready", leaseUntil: null });
    expect((await chunksOf(item.id))[0]?.embedded).toBe(true);
  });

  it("leaves a leased item to its holder and takes over once the lease expires", async () => {
    reset();
    const item = await addItem("lease text");
    await runDataRoomIngest(deps(), { ...scope(), itemId: item.id });
    await runDataRoomClassify(deps(), { ...scope(), itemId: item.id });
    await prisma.dataRoomItem.update({
      where: { id: item.id },
      data: { leaseUntil: new Date(Date.now() + 60_000) },
    });
    await runDataRoomIndex(deps(), { ...scope(), itemId: item.id });
    expect(await reload(item.id)).toMatchObject({ status: "indexing" });
    expect(embedder.calls).toEqual([]);
    await prisma.dataRoomItem.update({
      where: { id: item.id },
      data: { leaseUntil: new Date(Date.now() - 1000) },
    });
    await runDataRoomIndex(deps(), { ...scope(), itemId: item.id });
    expect((await reload(item.id)).status).toBe("ready");
  });

  it("re-queues stranded items and leaves leased or recent ones alone", async () => {
    reset();
    const old = new Date(Date.now() - 60 * 60_000);
    const make = async (status: string, lease: Date | null, updatedAt: Date) => {
      const item = await addItem(`stranded ${status}`);
      jobs.take();
      await prisma.dataRoomItem.update({
        where: { id: item.id },
        data: { status, leaseUntil: lease },
      });
      await prisma.$executeRaw`UPDATE data_room_items SET "updatedAt" = ${updatedAt} WHERE id = ${item.id}`;
      return item.id;
    };
    const indexing = await make("indexing", null, old);
    const extracting = await make("extracting", new Date(Date.now() - 1000), old);
    const classifying = await make("classifying", null, old);
    const leased = await make("indexing", new Date(Date.now() + 60_000), old);
    const recent = await make("indexing", null, new Date());
    const ready = await make("ready", null, old);
    await reconcileDataRoom(deps());
    const queued = jobs.take().map((j) => `${j.name}:${(j.payload as { itemId: string }).itemId}`);
    expect(queued).toContain(`dataroom.index:${indexing}`);
    expect(queued).toContain(`dataroom.ingest:${extracting}`);
    expect(queued).toContain(`dataroom.classify:${classifying}`);
    for (const id of [leased, recent, ready])
      expect(queued.some((q) => q.endsWith(id))).toBe(false);
    // Replace, never keep: the job that holds the key may be locked by a worker that died.
    expect(jobs.all.at(-1)?.keepExisting).toBeUndefined();
    expect(jobs.all.at(-1)?.replaceKey).toMatch(/^dataroom\./);
    // Other tests' stranded leftovers aside, running the queued index job finishes the item.
    await runDataRoomIndex(deps(), { ...scope(), itemId: indexing });
    expect((await reload(indexing)).status).toBe("ready");
  });
});
