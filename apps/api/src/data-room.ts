import { createHash, randomUUID } from "node:crypto";
import { ORPCError } from "@orpc/server";
import type { ArtifactStore, JobPublisher } from "@rakazo/adapter-kit";
import {
  DATA_ROOM_EMBEDDING_DIMENSIONS,
  dataRoomBlobDeleteJob,
  dataRoomStepJob,
} from "@rakazo/adapter-kit";
import type { DataRoomAi } from "@rakazo/adapters";
import { modelAcceptsImageInput } from "@rakazo/adapters";
import type {
  Actor,
  DataRoomApiFolder,
  DataRoomApiItem,
  DataRoomApiUploadResponse,
  DataRoomConsentStatus,
} from "@rakazo/contracts";
import {
  DATA_ROOM_DISCLOSURE,
  DATA_ROOM_DISCLOSURE_VERSION,
  DATA_ROOM_UPLOAD_MAX_BYTES,
  DataRoomApiName,
} from "@rakazo/contracts";
import type {
  DataRoomFilters,
  DataRoomFolderRecord,
  DataRoomItemRecord,
  DataRoomSort,
  PrismaClient,
} from "@rakazo/db";
import { createDataRoomRepos, DataRoomConflictError, IsolationError } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import type { Hono } from "hono";
import { cancelBody } from "./http-body.js";
import { contentDisposition, downloadType } from "./inbox-attachment.js";

export interface DataRoomDeps {
  prisma: PrismaClient;
  artifacts: ArtifactStore;
  jobs: JobPublisher;
  /**
   * Which models the Data room may call for a user. Without it nothing is sent to a model and
   * search is keyword-only.
   */
  resolveAi?: (scope: { userId: string; spaceId: string }) => Promise<DataRoomAi>;
  /** Injectable so tests can use a small cap. */
  maxUploadBytes?: number;
  /** How long the blob cleanup waits, so a failed row delete can be seen first. Tests shorten it. */
  blobDeleteDelayMs?: number;
}

export const folderDto = (folder: DataRoomFolderRecord): DataRoomApiFolder => ({
  id: folder.id,
  name: folder.name,
  parentId: folder.parentId,
  createdAt: folder.createdAt.toISOString(),
});

/** The storage key stays on the server. */
export const itemDto = (item: DataRoomItemRecord): DataRoomApiItem => ({
  id: item.id,
  name: item.name,
  mimeType: item.mimeType,
  size: item.size,
  folderId: item.folderId,
  source: item.source,
  status: item.status,
  error: item.error,
  facets: {
    docType: item.docType,
    docDate: item.docDate?.toISOString() ?? null,
    parties: item.parties,
    amountCents: item.amountCents === null ? null : Number(item.amountCents),
    currency: item.currency,
    tags: item.tags,
    summary: item.summary,
  },
  createdAt: item.createdAt.toISOString(),
});

/** A record the actor cannot see is "not found"; a folder name clash or cycle is a conflict. */
export async function dataRoomCall<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof IsolationError) throw new ORPCError("NOT_FOUND");
    if (error instanceof DataRoomConflictError) {
      throw new ORPCError("CONFLICT", { message: error.message });
    }
    throw error;
  }
}

function blobContext(actor: Actor, operation: string) {
  const operationId = `${operation}:${randomUUID()}`;
  return {
    operationId,
    traceId: operationId,
    spaceId: actor.spaceId,
    userId: actor.userId,
    signal: new AbortController().signal,
  };
}

const toFilters = (input: {
  folderId?: string | null;
  docDateFrom?: string;
  docDateTo?: string;
  [key: string]: unknown;
}): DataRoomFilters => {
  const { docDateFrom, docDateTo, ...rest } = input;
  return {
    ...(rest as DataRoomFilters),
    ...(docDateFrom ? { docDateFrom: new Date(docDateFrom) } : {}),
    ...(docDateTo ? { docDateTo: new Date(docDateTo) } : {}),
  };
};

const QUERY_EMBED_TIMEOUT_MS = 10_000;

/** Procedure bodies for `dataRoom.*`; the router adds the Actor. */
export function createDataRoomService(deps: DataRoomDeps) {
  const repo = createDataRoomRepos(deps.prisma);

  /**
   * The query's vector, only when an embedder exists and the user consented. Any failure means
   * keyword-only search, never an error.
   */
  async function queryVector(actor: Actor, query: string) {
    try {
      const ai = await deps.resolveAi?.(actor);
      if (!ai?.embedder || !ai.allowed) return {};
      const operationId = `data-room.search:${randomUUID()}`;
      const { model, vectors } = await ai.embedder.embed([query], {
        operationId,
        traceId: operationId,
        spaceId: actor.spaceId,
        userId: actor.userId,
        signal: AbortSignal.timeout(QUERY_EMBED_TIMEOUT_MS),
      });
      const vector = vectors[0];
      if (
        !vector ||
        vector.length !== DATA_ROOM_EMBEDDING_DIMENSIONS ||
        !vector.every(Number.isFinite)
      ) {
        return {};
      }
      return { vector, embeddingModel: model };
    } catch (error) {
      getLogger().error("data room query embedding failed; using keyword search", error);
      return {};
    }
  }

  async function consentStatus(actor: Actor): Promise<DataRoomConsentStatus & { ai?: DataRoomAi }> {
    const ai = await deps.resolveAi?.(actor);
    return {
      key: ai?.consentKey ?? "",
      version: DATA_ROOM_DISCLOSURE_VERSION,
      allowed: ai?.allowed ?? false,
      disclosure: DATA_ROOM_DISCLOSURE,
      recipients: ai?.recipients.map(({ name, detail }) => ({ name, detail })) ?? [],
      ai,
    };
  }

  return {
    folders: async (actor: Actor) => (await repo.listFolders(actor)).map(folderDto),
    createFolder: (actor: Actor, input: { name: string; parentId?: string | null }) =>
      dataRoomCall(async () => folderDto(await repo.createFolder(actor, input))),
    renameFolder: (actor: Actor, input: { id: string; name: string }) =>
      dataRoomCall(async () => folderDto(await repo.renameFolder(actor, input.id, input.name))),
    moveFolder: (actor: Actor, input: { id: string; parentId: string | null }) =>
      dataRoomCall(async () => folderDto(await repo.moveFolder(actor, input.id, input.parentId))),
    deleteFolder: (actor: Actor, id: string) =>
      dataRoomCall(async () => {
        await repo.deleteFolder(actor, id);
        return { ok: true as const };
      }),

    items: (
      actor: Actor,
      input: { limit: number; cursor?: string; sort: DataRoomSort } & Parameters<
        typeof toFilters
      >[0],
    ) =>
      dataRoomCall(async () => {
        const { limit, cursor, sort, ...filters } = input;
        const page = await repo.listItemsPage(actor, toFilters(filters), { sort, limit, cursor });
        return { items: page.items.map(itemDto), nextCursor: page.nextCursor };
      }),
    item: (actor: Actor, id: string) =>
      dataRoomCall(async () => itemDto(await repo.getItem(actor, id))),
    renameItem: (actor: Actor, input: { id: string; name: string }) =>
      dataRoomCall(async () =>
        itemDto(await repo.updateItem(actor, input.id, { name: input.name })),
      ),
    moveItem: (actor: Actor, input: { id: string; folderId: string | null }) =>
      dataRoomCall(async () => itemDto(await repo.moveItem(actor, input.id, input.folderId))),
    deleteItem: (actor: Actor, id: string) =>
      dataRoomCall(async () => {
        const { storageKey } = await repo.getItem(actor, id);
        // Queue the cleanup first: if the row delete fails, the job finds the row and keeps the blob.
        if (storageKey) {
          const at = new Date(Date.now() + (deps.blobDeleteDelayMs ?? 60_000));
          await deps.jobs.enqueue(dataRoomBlobDeleteJob(actor.spaceId, storageKey, at));
        }
        await repo.deleteItem(actor, id);
        return { ok: true as const };
      }),
    consent: async (actor: Actor): Promise<DataRoomConsentStatus> => {
      const { ai: _ai, ...status } = await consentStatus(actor);
      return status;
    },
    /**
     * Records consent for exactly the providers shown, then sends the items that skipped
     * classification or have no embeddings back through the pipeline.
     */
    consentGrant: async (
      actor: Actor,
      input: { key: string; version: string },
    ): Promise<DataRoomConsentStatus> => {
      const { ai, ...status } = await consentStatus(actor);
      if (!ai?.recipients.length || input.key !== status.key || input.version !== status.version) {
        throw new ORPCError("CONFLICT", { message: "AI data sharing changed. Review it again." });
      }
      await deps.prisma.aiDataConsent.upsert({
        where: {
          userId_spaceId_recipientKey: {
            userId: actor.userId,
            spaceId: actor.spaceId,
            recipientKey: status.key,
          },
        },
        create: {
          userId: actor.userId,
          spaceId: actor.spaceId,
          recipientKey: status.key,
          version: status.version,
        },
        update: { version: status.version, grantedAt: new Date() },
      });
      const queue = async (step: "ingest" | "classify" | "index", embeddingModel?: string) => {
        for (const id of await repo.requeueReady(actor, step, embeddingModel)) {
          await deps.jobs.enqueue(dataRoomStepJob(`dataroom.${step}`, actor, id));
        }
      };
      const visionReady = ai.model && modelAcceptsImageInput(ai.model.provider, ai.model.id, ai.model.acceptsImages);
      if (visionReady) await queue("ingest");
      await queue("classify");
      if (ai.embeddingModel) await queue("index", ai.embeddingModel);
      return { ...status, allowed: true };
    },

    embeddingModel: async (actor: Actor) => {
      const preference = await deps.prisma.spaceModelPreference.findFirst({
        where: { spaceId: actor.spaceId, userId: actor.userId, isDefault: true },
        select: { embeddingModel: true },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      });
      return { modelId: preference?.embeddingModel ?? null };
    },
    setEmbeddingModel: async (actor: Actor, input: { modelId: string | null }) => {
      const modelId = input.modelId?.trim() || null;
      const { count } = await deps.prisma.spaceModelPreference.updateMany({
        where: { spaceId: actor.spaceId, userId: actor.userId, isDefault: true },
        data: { embeddingModel: modelId },
      });
      if (count === 0) {
        throw new ORPCError("CONFLICT", { message: "Choose a default model first." });
      }
      return { modelId };
    },

    search: (
      actor: Actor,
      input: {
        query: string;
        limit: number;
        cursor?: string;
        filters?: Parameters<typeof toFilters>[0];
        sort?: DataRoomSort;
      },
    ) =>
      dataRoomCall(async () => {
        const page = await repo.searchPage(actor, {
          ...input,
          ...(await queryVector(actor, input.query)),
          filters: input.filters && toFilters(input.filters),
        });
        return {
          results: page.results.map((hit) => ({ ...hit, item: itemDto(hit.item) })),
          nextCursor: page.nextCursor,
        };
      }),
  };
}

const MIME = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i;

/**
 * Reads the body into one buffer, hashing as it goes, and gives up (cancelling the body) the moment
 * it holds more than `max` bytes. Never holds more than `max` bytes plus one chunk.
 */
async function readCapped(request: Request, max: number) {
  const declared = request.headers.get("content-length");
  if (declared !== null && !request.headers.has("transfer-encoding") && Number(declared) > max) {
    cancelBody(request.body);
    return null;
  }
  const hash = createHash("sha256");
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (request.body) {
    const reader = request.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > max) {
          cancelBody(reader);
          return null;
        }
        hash.update(value);
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
  }
  return { bytes: Buffer.concat(chunks), sha256: hash.digest("hex") };
}

/** Session-authenticated raw routes: streamed upload and forced-download of the stored bytes. */
export function mountDataRoomRoutes(
  app: Hono,
  deps: DataRoomDeps,
  authenticate: (request: Request) => Promise<Actor | null>,
) {
  const repo = createDataRoomRepos(deps.prisma);
  const max = deps.maxUploadBytes ?? DATA_ROOM_UPLOAD_MAX_BYTES;

  /** A duplicate of an item stuck in `pending` or `failed` runs ingest again. */
  const requeueStuck = async (actor: Actor, item: DataRoomItemRecord) => {
    if (!(await repo.restartItem(actor, item.id))) return;
    await deps.jobs
      .enqueue(dataRoomStepJob("dataroom.ingest", actor, item.id))
      .catch((error: unknown) => getLogger().error("data room ingest enqueue failed", error));
  };

  app.post("/api/data-room/upload", async (c) => {
    const actor = await authenticate(c.req.raw);
    if (!actor) return c.json({ error: "Unauthorized" }, 401);
    const reject = (message: string, status: 400 | 404 | 413) => {
      cancelBody(c.req.raw.body);
      return c.json({ error: message }, status);
    };

    const name = DataRoomApiName.safeParse(c.req.query("name"));
    if (!name.success) return reject("Invalid file name", 400);
    const folderId = c.req.query("folderId") || null;
    if (
      folderId &&
      !(await deps.prisma.dataRoomFolder.findFirst({
        where: { id: folderId, spaceId: actor.spaceId, userId: actor.userId },
        select: { id: true },
      }))
    ) {
      return reject("Folder not found", 404);
    }
    const mimeType = (c.req.header("content-type") ?? "").split(";")[0]?.trim().toLowerCase();
    const type = mimeType && MIME.test(mimeType) ? mimeType : "application/octet-stream";

    const body = await readCapped(c.req.raw, max);
    if (!body) return c.json({ error: "File is too large." }, 413);

    const respond = (item: DataRoomItemRecord, duplicate: boolean) =>
      c.json(
        { item: itemDto(item), duplicate } satisfies DataRoomApiUploadResponse,
        duplicate ? 200 : 201,
      );

    const existing = await deps.prisma.dataRoomItem.findFirst({
      where: {
        spaceId: actor.spaceId,
        userId: actor.userId,
        source: "upload",
        sha256: body.sha256,
      },
    });
    if (existing) {
      await requeueStuck(actor, existing);
      return respond(existing, true);
    }

    const stored = await deps.artifacts.put(
      { name: name.data, mimeType: type, bytes: body.bytes },
      blobContext(actor, "data-room.upload"),
    );
    const { item, created } = await dataRoomCall(() =>
      repo.createItem(actor, {
        source: "upload",
        sha256: body.sha256,
        name: name.data,
        mimeType: type,
        size: body.bytes.byteLength,
        storageKey: stored.id,
        folderId,
      }),
    ).catch(async (error: unknown) => {
      await deps.jobs.enqueue(dataRoomBlobDeleteJob(actor.spaceId, stored.id));
      throw error;
    });
    // Lost a race with a concurrent identical upload: drop the blob this request stored.
    if (!created) {
      await deps.jobs.enqueue(dataRoomBlobDeleteJob(actor.spaceId, stored.id));
      await requeueStuck(actor, item);
    } else {
      // The upload itself succeeded; a queue outage must not turn it into a failed upload.
      await deps.jobs
        .enqueue(dataRoomStepJob("dataroom.ingest", actor, item.id))
        .catch((error: unknown) => getLogger().error("data room ingest enqueue failed", error));
    }
    return respond(item, !created);
  });

  app.get("/api/data-room/items/:id/content", async (c) => {
    const actor = await authenticate(c.req.raw);
    if (!actor) return c.json({ error: "Unauthorized" }, 401);
    const item = await repo.getItem(actor, c.req.param("id")).catch((error: unknown) => {
      if (error instanceof IsolationError) return null;
      throw error;
    });
    if (!item?.storageKey) return c.json({ error: "Not found" }, 404);
    const bytes = await deps.artifacts.get(
      item.storageKey,
      blobContext(actor, "data-room.download"),
    );
    // Documents are untrusted: always a download, never active content on the API origin.
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": downloadType(item.mimeType),
        "content-length": String(bytes.byteLength),
        "content-disposition": contentDisposition(item.name),
        "x-content-type-options": "nosniff",
        "content-security-policy": "sandbox; default-src 'none'",
        "cache-control": "private, no-store",
      },
    });
  });
}
