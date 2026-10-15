import { createHash, randomUUID } from "node:crypto";
import type { BackgroundJob, Embedder } from "@rakazo/adapter-kit";
import { DATA_ROOM_EMBEDDING_DIMENSIONS } from "@rakazo/adapter-kit";
import type { DataRoomAi } from "@rakazo/adapters";
import type { Actor } from "@rakazo/contracts";
import { DATA_ROOM_DISCLOSURE_VERSION } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDataRoomRepos, createDb } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDataRoomService } from "./data-room.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

/** The same text always embeds to the same vector, so a query equal to a chunk finds that chunk. */
const fakeVector = (text: string) => {
  const hash = createHash("sha256").update(text).digest();
  return Array.from(
    { length: DATA_ROOM_EMBEDDING_DIMENSIONS },
    (_, i) => (hash[i % 32] ?? 0) / 255,
  );
};

class FakeEmbedder implements Embedder {
  calls: string[][] = [];
  failWith: Error | null = null;
  readonly modelName = "fake-embed-1";
  describe() {
    return {
      id: "fake",
      contractVersion: "1",
      adapterVersion: "1",
      capabilities: { dimensions: DATA_ROOM_EMBEDDING_DIMENSIONS, maxBatch: 64 },
    };
  }
  async embed(texts: string[]) {
    this.calls.push(texts);
    if (this.failWith) throw this.failWith;
    return { model: this.modelName, vectors: texts.map(fakeVector) };
  }
}

const fakeAi = (overrides: Partial<DataRoomAi> = {}): DataRoomAi => ({
  model: { provider: "openai-compatible", id: "chat-1" } as DataRoomAi["model"],
  embedder: null,
  embeddingModel: null,
  recipients: [{ key: "k1", name: "Example (https://llm.example.test)", detail: "chat-1" }],
  consentKey: "data-room:test",
  allowed: true,
  ...overrides,
});

describePostgres("Data room search, consent and embedding model (PostgreSQL)", () => {
  const run = randomUUID().slice(0, 8);
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let a: Actor;
  let other: Actor;
  let ai: DataRoomAi;
  let embedder: FakeEmbedder;
  const enqueued: BackgroundJob[] = [];
  const service = () =>
    createDataRoomService({
      prisma,
      artifacts: {} as never,
      jobs: { enqueue: async (job) => void enqueued.push(job) },
      resolveAi: async () => ai,
    });
  const repo = () => createDataRoomRepos(prisma);

  const addItem = async (actor: Actor, label: string, text: string, embed: boolean) => {
    const { item } = await repo().createItem(actor, {
      source: "upload",
      sha256: `ai-${label}-${run}`,
      name: `${label}.txt`,
      mimeType: "text/plain",
      size: 1,
    });
    const contentHash = `h-${label}-${run}`;
    await repo().replaceChunks(actor, item.id, [{ ordinal: 0, text, contentHash }]);
    if (embed) {
      await repo().saveEmbeddings(actor, item.id, "fake-embed-1", [
        { ordinal: 0, contentHash, vector: fakeVector(text) },
      ]);
    }
    await prisma.dataRoomItemText.create({
      data: { itemId: item.id, spaceId: actor.spaceId, userId: actor.userId, text },
    });
    await prisma.dataRoomItem.update({ where: { id: item.id }, data: { status: "ready" } });
    return item;
  };

  beforeAll(async () => {
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    const orgId = `drai-org-${run}`;
    const spaceId = `drai-space-${run}`;
    await prisma.organization.create({
      data: { id: orgId, name: "ai", slug: orgId, createdAt: new Date() },
    });
    await prisma.space.create({
      data: { id: spaceId, organizationId: orgId, name: "ai", isDefault: true },
    });
    const make = async (label: string): Promise<Actor> => {
      const userId = `drai-user-${label}-${run}`;
      await prisma.user.create({
        data: { id: userId, name: label, email: `${userId}@rakazo.test`, emailVerified: false },
      });
      await prisma.member.create({
        data: {
          id: `drai-m-${label}-${run}`,
          organizationId: orgId,
          userId,
          role: "member",
          createdAt: new Date(),
        },
      });
      return { userId, spaceId, email: `${userId}@rakazo.test`, isDeploymentOwner: false };
    };
    a = await make("a");
    other = await make("other");
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.space.deleteMany({ where: { id: `drai-space-${run}` } });
    await prisma.organization.deleteMany({ where: { id: `drai-org-${run}` } });
    await prisma.userModelCredential.deleteMany({ where: { userId: { endsWith: run } } });
    await prisma.user.deleteMany({ where: { id: { startsWith: "drai-user-", endsWith: run } } });
    await close();
  });

  const reset = () => {
    embedder = new FakeEmbedder();
    ai = fakeAi({ embedder, embeddingModel: embedder.modelName, consentKey: `data-room:${run}` });
    enqueued.length = 0;
  };

  describe("search", () => {
    const search = (query: string) => service().search(a, { query, limit: 10 });

    it("adds the vector leg when an embedder exists and the user consented", async () => {
      reset();
      await addItem(a, "semantic", "unrelated words entirely", true);
      // The query embeds to the same vector as this chunk's text, so the chunk is nearest.
      const hits = await search("unrelated words entirely");
      expect(embedder.calls).toEqual([["unrelated words entirely"]]);
      expect(hits.results.map((r) => r.item.name)).toContain("semantic.txt");
      const noKeyword = await search(`zzz${run}`);
      expect(noKeyword.results.length).toBeGreaterThan(0); // found by vector alone
    });

    it("stays keyword-only without consent, without an embedder, and when embedding fails", async () => {
      reset();
      await addItem(a, "plain", `quokka${run} sightings`, true);
      ai = { ...ai, allowed: false };
      expect((await search(`quokka${run}`)).results).toHaveLength(1);
      expect((await search(`zzz${run}`)).results).toEqual([]);
      expect(embedder.calls).toEqual([]);

      ai = { ...ai, allowed: true, embedder: null, embeddingModel: null };
      expect((await search(`zzz${run}`)).results).toEqual([]);

      reset();
      embedder.failWith = new Error("provider down");
      expect((await search(`quokka${run}`)).results).toHaveLength(1);
      expect((await search(`zzz${run}`)).results).toEqual([]);
    });

    it("ignores a query vector of the wrong size", async () => {
      reset();
      embedder.embed = async () => ({ model: "fake-embed-1", vectors: [[1, 2, 3]] });
      expect((await search(`quokka${run}`)).results).toHaveLength(1);
      expect((await search(`zzz${run}`)).results).toEqual([]);
    });
  });

  describe("consent", () => {
    it("reports the disclosure and providers, and refuses a stale key or version", async () => {
      reset();
      ai = { ...ai, allowed: false };
      const status = await service().consent(a);
      expect(status).toMatchObject({
        key: ai.consentKey,
        version: DATA_ROOM_DISCLOSURE_VERSION,
        allowed: false,
        recipients: [{ name: ai.recipients[0]?.name, detail: "chat-1" }],
      });
      expect(status.disclosure).toMatch(/full text/);
      await expect(
        service().consentGrant(a, { key: "other", version: status.version }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(
        service().consentGrant(a, { key: status.key, version: "old" }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      // With no model there is nothing to consent to.
      ai = fakeAi({ model: null, recipients: [], allowed: false });
      await expect(
        service().consentGrant(a, { key: ai.consentKey, version: status.version }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
    });

    it("records consent and sends skipped and unembedded items back through the pipeline", async () => {
      reset();
      ai = { ...ai, allowed: false };
      const skipped = await addItem(a, "skipped", "needs classifying", false);
      const unembedded = await addItem(a, "unembedded", "needs vectors", false);
      await prisma.dataRoomItem.update({
        where: { id: unembedded.id },
        data: { classifiedAt: new Date() },
      });
      const done = await addItem(a, "done", "already complete", true);
      await prisma.dataRoomItem.update({
        where: { id: done.id },
        data: { classifiedAt: new Date() },
      });
      const theirs = await addItem(other, "theirs", "someone else's", false);
      // An image whose vision was skipped has an empty text; a text file with empty text is not an image.
      const image = await addItem(a, "scan", "x", false);
      await prisma.dataRoomItem.update({ where: { id: image.id }, data: { mimeType: "image/png" } });
      await prisma.dataRoomItemText.update({ where: { itemId: image.id }, data: { text: "" } });
      await prisma.dataRoomChunk.deleteMany({ where: { itemId: image.id } });
      ai = {
        ...ai,
        model: { provider: "openai-compatible", id: "vis", acceptsImages: true } as never,
      };

      const granted = await service().consentGrant(a, {
        key: ai.consentKey,
        version: DATA_ROOM_DISCLOSURE_VERSION,
      });
      expect(granted.allowed).toBe(true);
      expect(
        await prisma.aiDataConsent.count({
          where: { userId: a.userId, spaceId: a.spaceId, recipientKey: ai.consentKey },
        }),
      ).toBe(1);
      const queued = enqueued.map((j) => `${j.name}:${(j.payload as { itemId: string }).itemId}`);
      expect(queued).toContain(`dataroom.classify:${skipped.id}`);
      expect(queued).toContain(`dataroom.index:${unembedded.id}`);
      expect(queued).toContain(`dataroom.ingest:${image.id}`);
      expect(queued).not.toContain(`dataroom.classify:${image.id}`);
      expect(queued.some((q) => q.endsWith(done.id))).toBe(false);
      expect(queued.some((q) => q.endsWith(theirs.id))).toBe(false);
      const status = async (id: string) =>
        (await prisma.dataRoomItem.findUniqueOrThrow({ where: { id } })).status;
      expect(await status(skipped.id)).toBe("classifying");
      expect(await status(unembedded.id)).toBe("indexing");
      expect(await status(done.id)).toBe("ready");
      expect(await status(theirs.id)).toBe("ready");
    });
  });

  describe("embedding model setting", () => {
    it("needs a default model, then saves, reads and clears the setting", async () => {
      reset();
      await expect(service().setEmbeddingModel(a, { modelId: "m" })).rejects.toMatchObject({
        code: "CONFLICT",
      });
      const credential = await prisma.userModelCredential.create({
        data: { userId: a.userId, provider: "openai-compatible", label: "x", secretId: `s-${run}` },
      });
      await prisma.spaceModelPreference.create({
        data: {
          spaceId: a.spaceId,
          userId: a.userId,
          credentialId: credential.id,
          modelId: "chat-1",
          isDefault: true,
        },
      });
      expect(await service().embeddingModel(a)).toEqual({ modelId: null });
      expect(await service().setEmbeddingModel(a, { modelId: "  embed-1 " })).toEqual({
        modelId: "embed-1",
      });
      expect(await service().embeddingModel(a)).toEqual({ modelId: "embed-1" });
      expect(await service().embeddingModel(other)).toEqual({ modelId: null });
      expect(await service().setEmbeddingModel(a, { modelId: "" })).toEqual({ modelId: null });
    });
  });
});
