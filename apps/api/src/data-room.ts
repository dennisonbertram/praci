import { createHash } from "node:crypto";
import { ORPCError } from "@orpc/server";
import type { ArtifactStore, JobPublisher, MailProvider } from "@rakazo/adapter-kit";
import { dataRoomBlobDeleteJob, dataRoomStepJob } from "@rakazo/adapter-kit";
import type { DataRoomAi } from "@rakazo/adapters";
import {
  createFileDataRoomItem as createFileItem,
  DATA_ROOM_MIME,
  DriveFileError,
  type DriveFilesDeps,
  dataRoomBlobContext,
  dataRoomFileFields,
  dataRoomQueryVector,
  downloadDriveFile,
  listDriveAccounts,
  listDriveFiles,
  modelAcceptsImageInput,
} from "@rakazo/adapters";
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
import { inboxAttachment } from "./inbox.js";
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
  /** Needed only to import mail attachments. */
  mail?: MailProvider;
  /** Needed only to import from Google Drive. */
  connectors?: DriveFilesDeps["connectors"];
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
  sourceUrl: item.sourceUrl,
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

/**
 * The query's words joined by "or", for a second try when every word had to match. Null for a
 * single word. Quotes and leading minus signs are dropped, so the words are plain terms.
 */
export function anyWordQuery(query: string): string | null {
  const words = query
    .replace(/["]/g, " ")
    .split(/\s+/)
    .map((word) => word.replace(/^-+/, ""))
    .filter((word) => word && word.toLowerCase() !== "or");
  return words.length > 1 ? words.join(" or ") : null;
}

const DRIVE_ERRORS = {
  not_connected: "PRECONDITION_FAILED",
  reconnect: "PRECONDITION_FAILED",
  not_found: "NOT_FOUND",
  unsupported: "BAD_REQUEST",
  too_large: "PAYLOAD_TOO_LARGE",
  rate_limited: "TOO_MANY_REQUESTS",
  failed: "INTERNAL_SERVER_ERROR",
} as const;

/** Runs a Drive call as the caller's first connected Drive account, with failures as API errors. */
async function withDrive<T>(
  deps: DataRoomDeps,
  actor: Actor,
  run: (drive: DriveFilesDeps, connectionId: string) => Promise<T>,
): Promise<T> {
  const connectors = deps.connectors;
  if (!connectors) throw new ORPCError("SERVICE_UNAVAILABLE", { message: "Drive is unavailable" });
  try {
    const [account] = await listDriveAccounts(deps.prisma, actor);
    if (!account) throw new DriveFileError("not_connected", "No connected Google Drive account");
    return await run({ prisma: deps.prisma, connectors }, account.id);
  } catch (error) {
    if (error instanceof DriveFileError)
      throw new ORPCError(DRIVE_ERRORS[error.code], { message: error.message });
    throw error;
  }
}

/**
 * The shared filing helper from the adapters, with repository errors mapped to API errors.
 * Agents file through the same helper, so an import is stored and queued one way everywhere.
 */
export function createFileDataRoomItem(
  deps: DataRoomDeps,
  repo: ReturnType<typeof createDataRoomRepos>,
) {
  const files = createFileItem(deps, repo);
  return {
    ...files,
    fileItem: (...args: Parameters<typeof files.fileItem>) =>
      dataRoomCall(() => files.fileItem(...args)),
  };
}

const REINDEX_BATCH = 200;

/** Procedure bodies for `dataRoom.*`; the router adds the Actor. */
export function createDataRoomService(deps: DataRoomDeps) {
  const repo = createDataRoomRepos(deps.prisma);
  const { fileItem, known } = createFileDataRoomItem(deps, repo);

  /** The name and folder path live in the item's metadata chunk, so a change re-indexes it. */
  const enqueueIndex = async (actor: Actor, ids: string[]) => {
    for (const id of ids) {
      await deps.jobs
        .enqueue(dataRoomStepJob("dataroom.index", actor, id))
        .catch((error: unknown) => getLogger().error("data room index enqueue failed", error));
    }
  };
  // ponytail: runs in the request, one queued job per item in batches; a dedicated fan-out job if folders get huge.
  const reindexFolder = async (actor: Actor, folderId: string) => {
    for (;;) {
      const ids = await repo.reindexFolder(actor, folderId, REINDEX_BATCH);
      await enqueueIndex(actor, ids);
      if (ids.length < REINDEX_BATCH) return;
    }
  };

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
    folders: async (actor: Actor) => {
      const [folders, counts] = await Promise.all([
        repo.listFolders(actor),
        repo.folderItemCounts(actor),
      ]);
      return folders.map((folder) => ({
        ...folderDto(folder),
        itemCount: counts.get(folder.id) ?? 0,
      }));
    },
    facetValues: (actor: Actor, filters: Parameters<typeof toFilters>[0]) =>
      repo.facetValues(actor, toFilters(filters)),
    createFolder: (actor: Actor, input: { name: string; parentId?: string | null }) =>
      dataRoomCall(async () => folderDto(await repo.createFolder(actor, input))),
    renameFolder: (actor: Actor, input: { id: string; name: string }) =>
      dataRoomCall(async () => {
        const folder = await repo.renameFolder(actor, input.id, input.name);
        await reindexFolder(actor, folder.id);
        return folderDto(folder);
      }),
    moveFolder: (actor: Actor, input: { id: string; parentId: string | null }) =>
      dataRoomCall(async () => {
        const folder = await repo.moveFolder(actor, input.id, input.parentId);
        await reindexFolder(actor, folder.id);
        return folderDto(folder);
      }),
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
      dataRoomCall(async () => {
        const item = await repo.updateItem(actor, input.id, { name: input.name });
        await enqueueIndex(actor, await repo.reindexItems(actor, [item.id]));
        return itemDto(item);
      }),
    moveItem: (actor: Actor, input: { id: string; folderId: string | null }) =>
      dataRoomCall(async () => {
        const item = await repo.moveItem(actor, input.id, input.folderId);
        await enqueueIndex(actor, await repo.reindexItems(actor, [item.id]));
        return itemDto(item);
      }),
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
    /** A failed item starts over from reading its text; any other status is a conflict. */
    retryItem: (actor: Actor, id: string) =>
      dataRoomCall(async () => {
        const item = await repo.getItem(actor, id);
        if (item.status !== "failed" || !(await repo.restartItem(actor, id))) {
          throw new ORPCError("CONFLICT", { message: "This file is already being read." });
        }
        await deps.jobs.enqueue(dataRoomStepJob("dataroom.ingest", actor, id));
        return itemDto(await repo.getItem(actor, id));
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
      const visionReady =
        ai.model && modelAcceptsImageInput(ai.model.provider, ai.model.id, ai.model.acceptsImages);
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

    /**
     * Copies attachments of the caller's own mail into the Data room through the upload pipeline.
     * The attachment id is stable for a message, so `gmail:<message>:<attachment>` names a repeat.
     */
    importEmail: async (
      actor: Actor,
      input: { picks: { messageId: string; attachmentId: string }[]; folderId?: string | null },
      signal?: AbortSignal,
    ) => {
      const mail = deps.mail;
      if (!mail) throw new ORPCError("SERVICE_UNAVAILABLE", { message: "Mail is unavailable" });
      const folderId = input.folderId ?? null;
      if (folderId) {
        const folder = await deps.prisma.dataRoomFolder.findFirst({
          where: { id: folderId, spaceId: actor.spaceId, userId: actor.userId },
          select: { id: true },
        });
        if (!folder) throw new ORPCError("NOT_FOUND");
      }
      let imported = 0;
      let duplicates = 0;
      let failed = 0;
      // Every message is checked before anything is filed, so a pick that is not the caller's
      // refuses the whole request instead of leaving a partial import.
      const messages = new Map<string, { connectionId: string; providerMessageId: string }>();
      for (const { messageId } of input.picks) {
        if (messages.has(messageId)) continue;
        const message = await deps.prisma.cachedMailMessage.findFirst({
          where: { id: messageId, spaceId: actor.spaceId, userId: actor.userId },
          select: { connectionId: true, providerMessageId: true },
        });
        if (!message) throw new ORPCError("NOT_FOUND");
        messages.set(messageId, message);
      }
      for (const pick of input.picks) {
        const message = messages.get(pick.messageId);
        if (!message) continue;
        const sourceConnectionId = message.connectionId;
        const externalId = `gmail:${message.providerMessageId}:${pick.attachmentId}`;
        if (await known(actor, externalId, sourceConnectionId)) {
          duplicates += 1;
          continue;
        }
        try {
          const file = await inboxAttachment(
            { prisma: deps.prisma, mail, jobs: deps.jobs },
            actor,
            pick,
            signal,
          );
          const { created } = await fileItem(actor, {
            source: "gmail",
            ...dataRoomFileFields(
              { name: file.filename, mimeType: file.mimeType, bytes: file.bytes },
              "attachment",
            ),
            folderId,
            sourceConnectionId,
            externalId,
            sourceUrl: `/app/inbox?mail=${pick.messageId}`,
          });
          if (created) imported += 1;
          else duplicates += 1;
        } catch (error) {
          // The message was already shown to be the caller's; a provider or storage failure only
          // skips this file so the others are still filed.
          getLogger().warn("data room mail import failed", {
            reason: error instanceof Error ? error.message : "unknown",
          });
          failed += 1;
        }
      }
      return { imported, duplicates, failed };
    },

    driveList: (
      actor: Actor,
      input: { query?: string; folderId?: string; pageToken?: string },
      signal?: AbortSignal,
    ) =>
      withDrive(deps, actor, (drive, connectionId) =>
        listDriveFiles(drive, dataRoomBlobContext(actor, "data-room.drive", signal), {
          ...input,
          connectionId,
        }),
      ),

    /** Copies files of the caller's own Drive into the Data room; a Drive file id names a repeat. */
    importDrive: async (
      actor: Actor,
      input: { fileIds: string[]; folderId?: string | null },
      signal?: AbortSignal,
    ) => {
      const folderId = input.folderId ?? null;
      if (folderId) {
        const folder = await deps.prisma.dataRoomFolder.findFirst({
          where: { id: folderId, spaceId: actor.spaceId, userId: actor.userId },
          select: { id: true },
        });
        if (!folder) throw new ORPCError("NOT_FOUND");
      }
      return withDrive(deps, actor, async (drive, sourceConnectionId) => {
        const context = dataRoomBlobContext(actor, "data-room.drive", signal);
        let imported = 0;
        let duplicates = 0;
        let failed = 0;
        for (const externalId of new Set(input.fileIds)) {
          if (await known(actor, externalId, sourceConnectionId)) {
            duplicates += 1;
            continue;
          }
          // One bad file does not stop the rest; an account or rate problem would fail them all.
          const file = await downloadDriveFile(drive, context, externalId, {
            connectionId: sourceConnectionId,
            maxBytes: deps.maxUploadBytes ?? DATA_ROOM_UPLOAD_MAX_BYTES,
          }).catch((error: unknown) => {
            if (
              error instanceof DriveFileError &&
              ["not_found", "unsupported", "too_large", "failed"].includes(error.code)
            )
              return null;
            throw error;
          });
          if (!file) {
            failed += 1;
            continue;
          }
          const modified = new Date(file.modifiedTime);
          const { created } = await fileItem(actor, {
            source: "drive",
            ...dataRoomFileFields(file, "file"),
            folderId,
            sourceConnectionId,
            externalId,
            ...(file.webViewLink ? { sourceUrl: file.webViewLink } : {}),
            ...(Number.isNaN(modified.getTime()) ? {} : { sourceUpdatedAt: modified }),
          });
          if (created) imported += 1;
          else duplicates += 1;
        }
        return { imported, duplicates, failed };
      });
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
        const vector = await dataRoomQueryVector(deps.resolveAi, actor, input.query);
        const filters = input.filters && toFilters(input.filters);
        let page = await repo.searchPage(actor, { ...input, ...vector, filters });
        // A question ("when does our lease end") rarely has every word in one file: on a first page
        // with nothing found, match any of its words instead.
        const anyWords = anyWordQuery(input.query);
        if (!input.cursor && page.results.length === 0 && anyWords) {
          page = await repo.searchPage(actor, { ...input, ...vector, filters, query: anyWords });
          // ponytail: the fallback shows its first page only; carry the mode in the cursor if needed.
          page = { ...page, nextCursor: null };
        }
        return {
          results: page.results.map((hit) => ({ ...hit, item: itemDto(hit.item) })),
          nextCursor: page.nextCursor,
        };
      }),
  };
}

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

  const { fileItem, requeueStuck } = createFileDataRoomItem(deps, repo);

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
    const type = mimeType && DATA_ROOM_MIME.test(mimeType) ? mimeType : "application/octet-stream";

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

    const { item, created } = await fileItem(actor, {
      source: "upload",
      sha256: body.sha256,
      name: name.data,
      mimeType: type,
      bytes: body.bytes,
      folderId,
    });
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
      dataRoomBlobContext(actor, "data-room.download"),
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
