import { createHash } from "node:crypto";
import { ORPCError } from "@orpc/server";
import type {
  AdapterContext,
  AgentRunModel,
  ArtifactStore,
  JobPublisher,
  MailProvider,
} from "@rakazo/adapter-kit";
import {
  dataRoomBlobDeleteJob,
  dataRoomBoxImportJob,
  dataRoomDriveImportJob,
  dataRoomStepJob,
} from "@rakazo/adapter-kit";
import type { AutoSortItem, BoxFilesDeps, DataRoomAi, DriveFilesDeps } from "@rakazo/adapters";
import {
  AUTO_SORT_ITEM_LIMIT,
  autoSortFolderPaths,
  BoxFileError,
  boxExternalId,
  buildAutoSortPlan,
  createFileDataRoomItem as createFileItem,
  DATA_ROOM_MIME,
  DriveFileError,
  dataRoomBlobContext,
  dataRoomFileFields,
  dataRoomQueryVector,
  dataRoomVisionKey,
  downloadBoxFile,
  downloadDriveFile,
  hasThumbnailType,
  listBoxAccounts,
  listBoxFiles,
  listDriveAccounts,
  listDriveFiles,
  planBoxFolders,
  planDriveFolders,
  ZipRefusal,
} from "@rakazo/adapters";
import type {
  Actor,
  AutoSortOperation,
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
import {
  createDataRoomAutoSortRepos,
  createDataRoomImport,
  createDataRoomRepos,
  DataRoomConflictError,
  IsolationError,
  listDataRoomImports,
  recordImportSkips,
} from "@rakazo/db";
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
  /**
   * One model call that places the items of a tidy-up; returns the raw answer, which is validated
   * against the known item ids. Without it, or when it throws, a tidy-up only merges duplicate folders.
   */
  proposeSort?: (
    model: AgentRunModel,
    input: { folders: string[][]; items: (AutoSortItem & { folder: string })[] },
    context: AdapterContext,
  ) => Promise<unknown>;
  /** Needed only to import mail attachments. */
  mail?: MailProvider;
  /** Needed only to import from Google Drive. */
  connectors?: DriveFilesDeps["connectors"];
  /** Needed only to import from Box: reads the sign-in of the user's Box connection. */
  box?: Omit<BoxFilesDeps, "prisma">;
  /** Injectable so tests can use a small cap. */
  maxUploadBytes?: number;
  /** How long the blob cleanup waits, so a failed row delete can be seen first. Tests shorten it. */
  blobDeleteDelayMs?: number;
}

const folderDto = (folder: DataRoomFolderRecord): DataRoomApiFolder => ({
  id: folder.id,
  name: folder.name,
  parentId: folder.parentId,
  createdAt: folder.createdAt.toISOString(),
});

/** The storage key stays on the server. */
const itemDto = (item: DataRoomItemRecord): DataRoomApiItem => ({
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
  hasThumbnail: item.thumbnailKey !== null,
  previewText: item.previewText,
});

/** A record the actor cannot see is "not found"; a folder name clash or cycle is a conflict. */
async function dataRoomCall<T>(run: () => Promise<T>): Promise<T> {
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
 * single word, and for a query that already uses operators (quotes, "-word", "or"), which
 * broadening would change.
 */
export function anyWordQuery(query: string): string | null {
  if (/["]|(^|\s)-\S|(^|\s)or(\s|$)/i.test(query)) return null;
  const words = query.split(/\s+/).filter(Boolean);
  return words.length > 1 ? words.join(" or ") : null;
}

const ANY_PREFIX = "any:";

/**
 * A question ("when does our lease end") rarely has every word in one file: on a first page with
 * nothing found, match any of its words instead. The cursor of such a page is marked, so later
 * pages keep matching any word.
 */
export async function searchWithFallback<
  P extends { results: unknown[]; nextCursor: string | null },
>(
  searchPage: (query: string, cursor: string | undefined) => Promise<P>,
  input: { query: string; cursor?: string },
): Promise<P> {
  const anyWords = anyWordQuery(input.query);
  if (input.cursor?.startsWith(ANY_PREFIX) && anyWords) {
    const page = await searchPage(anyWords, input.cursor.slice(ANY_PREFIX.length));
    return { ...page, nextCursor: page.nextCursor && ANY_PREFIX + page.nextCursor };
  }
  const page = await searchPage(input.query, input.cursor);
  if (input.cursor || page.results.length > 0 || !anyWords) return page;
  const broad = await searchPage(anyWords, undefined);
  return { ...broad, nextCursor: broad.nextCursor && ANY_PREFIX + broad.nextCursor };
}

const DRIVE_ERRORS = {
  not_connected: "PRECONDITION_FAILED",
  reconnect: "PRECONDITION_FAILED",
  not_found: "NOT_FOUND",
  unsupported: "BAD_REQUEST",
  too_large: "PAYLOAD_TOO_LARGE",
  rate_limited: "TOO_MANY_REQUESTS",
  too_many: "BAD_REQUEST",
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

/** Runs a Box call as the caller's only connected Box account, with failures as API errors. */
async function withBox<T>(
  deps: DataRoomDeps,
  actor: Actor,
  run: (box: BoxFilesDeps, connectionId: string) => Promise<T>,
): Promise<T> {
  const box = deps.box;
  if (!box) throw new ORPCError("SERVICE_UNAVAILABLE", { message: "Box is unavailable" });
  try {
    const [account] = await listBoxAccounts(deps.prisma, actor);
    if (!account) throw new BoxFileError("not_connected", "No connected Box account");
    return await run({ prisma: deps.prisma, ...box }, account.id);
  } catch (error) {
    if (error instanceof BoxFileError)
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
  const sortRepo = createDataRoomAutoSortRepos(deps.prisma);
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

  /** Items whose name or folder path changed go back through indexing. */
  const reindexAfterSort = async (actor: Actor, done: { itemIds: string[] }) => {
    // The change is committed: a failure here must not hide the batch id the caller needs to undo it.
    try {
      await enqueueIndex(actor, await repo.reindexItems(actor, done.itemIds));
    } catch (error) {
      getLogger().error("data room re-index after auto-sort failed", error);
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
        // Items shown without a thumbnail get one drawn, once; the grid shows it on a later read.
        // ponytail: an item claimed here whose enqueue fails gets none; a retry flag if that matters.
        const claimed = await repo.claimThumbnails(
          actor,
          page.items.flatMap((i) =>
            i.storageKey && !i.thumbnailKey && !i.thumbnailTriedAt && hasThumbnailType(i)
              ? [i.id]
              : [],
          ),
        );
        for (const id of claimed) {
          await deps.jobs
            .enqueue(dataRoomStepJob("dataroom.thumbnail", actor, id))
            .catch((error: unknown) =>
              getLogger().error("data room thumbnail enqueue failed", error),
            );
        }
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
        const { storageKey, thumbnailKey } = await repo.getItem(actor, id);
        // Queue the cleanup first: if the row delete fails, the job finds the row and keeps the blob.
        for (const key of [storageKey, thumbnailKey]) {
          if (!key) continue;
          const at = new Date(Date.now() + (deps.blobDeleteDelayMs ?? 60_000));
          await deps.jobs.enqueue(dataRoomBlobDeleteJob(actor.spaceId, key, at));
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
    autoSort: {
      /** Proposes a tidy-up and changes nothing. The model sees names and facets, never full text. */
      plan: async (actor: Actor) => {
        const [folders, items, ai] = await Promise.all([
          repo.listFolders(actor),
          repo.listForSort(actor, AUTO_SORT_ITEM_LIMIT),
          deps.resolveAi?.(actor),
        ]);
        let proposal: unknown = null;
        let asked = false;
        if (ai?.model && ai.allowed && deps.proposeSort && items.length) {
          asked = true;
          const paths = autoSortFolderPaths(folders);
          const operationId = `data-room-sort:${actor.spaceId}:${Date.now()}`;
          try {
            proposal = await deps.proposeSort(
              ai.model,
              {
                folders: [...paths.values()],
                items: items.map((item) => ({
                  ...item,
                  folder: (item.folderId ? paths.get(item.folderId) : undefined)?.join(" / ") ?? "",
                })),
              },
              {
                operationId,
                traceId: operationId,
                spaceId: actor.spaceId,
                userId: actor.userId,
                signal: AbortSignal.timeout(120_000),
              },
            );
          } catch (error) {
            getLogger().warn("data room auto-sort model failed; merging duplicates only", {
              error: error instanceof Error ? error.message : "unknown",
            });
          }
        }
        const plan = buildAutoSortPlan({ folders, items, proposal });
        if (plan.mode === "ai" || plan.reason || !items.length) return plan;
        return { ...plan, reason: asked ? ("ai_failed" as const) : ("ai_unavailable" as const) };
      },
      apply: (actor: Actor, input: { operations: AutoSortOperation[] }) =>
        dataRoomCall(async () => {
          const done = await sortRepo.apply(actor, input.operations);
          await reindexAfterSort(actor, done);
          return {
            batchId: done.batchId,
            items: done.itemIds.length,
            skipped: done.skipped.length,
          };
        }),
      undo: (actor: Actor, batchId: string) =>
        dataRoomCall(async () => {
          const done = await sortRepo.undo(actor, batchId);
          await reindexAfterSort(actor, done);
          return { restored: done.restored, skipped: done.skipped };
        }),
    },
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
      const visionKey = dataRoomVisionKey({ ...ai, allowed: true });
      const queue = async (step: "ingest" | "classify" | "index", embeddingModel?: string) => {
        for (const id of await repo.requeueReady(actor, step, embeddingModel, visionKey)) {
          await deps.jobs.enqueue(dataRoomStepJob(`dataroom.${step}`, actor, id));
        }
      };
      await queue("ingest");
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

    /** The attachments of the caller's own messages that an email import already filed. */
    emailImported: async (actor: Actor, input: { messageIds: string[] }) => {
      const messages = await deps.prisma.cachedMailMessage.findMany({
        where: { id: { in: input.messageIds }, spaceId: actor.spaceId, userId: actor.userId },
        select: { id: true, connectionId: true, providerMessageId: true },
      });
      if (messages.length === 0) return { files: [] };
      const items = await deps.prisma.dataRoomItem.findMany({
        where: {
          spaceId: actor.spaceId,
          userId: actor.userId,
          source: "gmail",
          OR: messages.map((m) => ({
            sourceConnectionId: m.connectionId,
            externalId: { startsWith: `gmail:${m.providerMessageId}:` },
          })),
        },
        select: { externalId: true, sourceConnectionId: true },
      });
      const files: { messageId: string; attachmentId: string }[] = [];
      for (const m of messages) {
        const prefix = `gmail:${m.providerMessageId}:`;
        for (const item of items) {
          if (item.sourceConnectionId === m.connectionId && item.externalId?.startsWith(prefix)) {
            files.push({ messageId: m.id, attachmentId: item.externalId.slice(prefix.length) });
          }
        }
      }
      return { files };
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
      const tracked = await createDataRoomImport(deps.prisma, actor, {
        source: "gmail",
        total: input.picks.length,
      });
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
            importId: tracked.id,
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
      await recordImportSkips(deps.prisma, tracked.id, { duplicates, rejected: failed });
      return { imported, duplicates, failed, importId: tracked.id };
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
      input: { fileIds: string[]; driveFolderIds?: string[]; folderId?: string | null },
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
        // Listing is read-only, so an over-limit selection is refused before anything is written.
        // Direct picks join the plan, so a mixed import writes only the one queued job.
        const plan = input.driveFolderIds?.length
          ? await planDriveFolders(drive, context, {
              connectionId: sourceConnectionId,
              folderIds: input.driveFolderIds,
              directFileIds: input.fileIds,
              maxBytes: deps.maxUploadBytes ?? DATA_ROOM_UPLOAD_MAX_BYTES,
            })
          : undefined;
        const direct = plan ? [] : [...new Set(input.fileIds)];
        const tracked = await createDataRoomImport(deps.prisma, actor, {
          source: "drive",
          total: plan ? plan.files.length + plan.skipped : direct.length,
          rejected: plan?.skipped ?? 0,
        });
        let handled = 0;
        try {
          for (const externalId of direct) {
            if (await known(actor, externalId, sourceConnectionId)) {
              duplicates += 1;
              handled += 1;
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
            handled += 1;
            if (!file) {
              failed += 1;
              continue;
            }
            const modified = new Date(file.modifiedTime);
            const { created } = await fileItem(actor, {
              source: "drive",
              ...dataRoomFileFields(file, "file"),
              folderId,
              importId: tracked.id,
              sourceConnectionId,
              externalId,
              ...(file.webViewLink ? { sourceUrl: file.webViewLink } : {}),
              ...(Number.isNaN(modified.getTime()) ? {} : { sourceUpdatedAt: modified }),
            });
            if (created) imported += 1;
            else duplicates += 1;
          }
        } catch (error) {
          // The files after the one that broke the request are not coming.
          await recordImportSkips(deps.prisma, tracked.id, { rejected: direct.length - handled });
          throw error;
        }
        if (!plan) {
          await recordImportSkips(deps.prisma, tracked.id, { duplicates, rejected: failed });
          return { imported, duplicates, failed, importId: tracked.id, total: direct.length };
        }
        // One queued job holds the whole plan: it either exists, or nothing was written.
        if (plan.folders.length > 0 || plan.files.length > 0)
          await deps.jobs
            .enqueue(
              dataRoomDriveImportJob({
                spaceId: actor.spaceId,
                userId: actor.userId,
                connectionId: sourceConnectionId,
                folderId,
                importId: tracked.id,
                folders: plan.folders,
                files: plan.files,
              }),
            )
            .catch(async (error: unknown) => {
              await deps.prisma.dataRoomImport.delete({ where: { id: tracked.id } });
              throw error;
            });
        return {
          imported,
          duplicates,
          failed: failed + plan.skipped,
          importId: tracked.id,
          total: plan.files.length + plan.skipped,
          queued: plan.files.length,
          folders: plan.folders.length,
        };
      });
    },

    imports: (actor: Actor) => listDataRoomImports(deps.prisma, actor),

    boxList: (
      actor: Actor,
      input: { query?: string; folderId?: string; pageToken?: string },
      signal?: AbortSignal,
    ) =>
      withBox(deps, actor, (box, connectionId) =>
        listBoxFiles(
          box,
          { ...actor, signal: signal ?? new AbortController().signal },
          {
            ...input,
            connectionId,
          },
        ),
      ),

    /** Copies files of the caller's own Box into the Data room; a Box file id names a repeat. */
    importBox: async (
      actor: Actor,
      input: { fileIds: string[]; boxFolderIds?: string[]; folderId?: string | null },
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
      return withBox(deps, actor, async (box, sourceConnectionId) => {
        const scope = {
          spaceId: actor.spaceId,
          userId: actor.userId,
          signal: signal ?? new AbortController().signal,
        };
        const maxBytes = deps.maxUploadBytes ?? DATA_ROOM_UPLOAD_MAX_BYTES;
        let imported = 0;
        let duplicates = 0;
        let failed = 0;
        // Listing is read-only, so an over-limit selection is refused before anything is written.
        const plan = input.boxFolderIds?.length
          ? await planBoxFolders(box, scope, {
              connectionId: sourceConnectionId,
              folderIds: input.boxFolderIds,
              directFileIds: input.fileIds,
              maxBytes,
            })
          : undefined;
        const direct = plan ? [] : [...new Set(input.fileIds)];
        const tracked = await createDataRoomImport(deps.prisma, actor, {
          source: "box",
          total: plan ? plan.files.length + plan.skipped : direct.length,
          rejected: plan?.skipped ?? 0,
        });
        let handled = 0;
        try {
          for (const externalId of direct) {
            if (await known(actor, boxExternalId(externalId))) {
              duplicates += 1;
              handled += 1;
              continue;
            }
            // One bad file does not stop the rest; an account or rate problem would fail them all.
            const file = await downloadBoxFile(box, scope, externalId, {
              connectionId: sourceConnectionId,
              maxBytes,
            }).catch((error: unknown) => {
              if (
                error instanceof BoxFileError &&
                ["not_found", "unsupported", "too_large", "failed"].includes(error.code)
              )
                return null;
              throw error;
            });
            handled += 1;
            if (!file) {
              failed += 1;
              continue;
            }
            const modified = new Date(file.modifiedTime);
            const { created } = await fileItem(actor, {
              source: "box",
              ...dataRoomFileFields(file, "file"),
              folderId,
              importId: tracked.id,
              externalId: boxExternalId(externalId),
              sourceUrl: file.webViewLink,
              ...(Number.isNaN(modified.getTime()) ? {} : { sourceUpdatedAt: modified }),
            });
            if (created) imported += 1;
            else duplicates += 1;
          }
        } catch (error) {
          // The files after the one that broke the request are not coming.
          await recordImportSkips(deps.prisma, tracked.id, { rejected: direct.length - handled });
          throw error;
        }
        if (!plan) {
          await recordImportSkips(deps.prisma, tracked.id, { duplicates, rejected: failed });
          return { imported, duplicates, failed, importId: tracked.id, total: direct.length };
        }
        // One queued job holds the whole plan: it either exists, or nothing was written.
        if (plan.folders.length > 0 || plan.files.length > 0)
          await deps.jobs
            .enqueue(
              dataRoomBoxImportJob({
                spaceId: actor.spaceId,
                userId: actor.userId,
                connectionId: sourceConnectionId,
                folderId,
                importId: tracked.id,
                folders: plan.folders,
                files: plan.files,
              }),
            )
            .catch(async (error: unknown) => {
              await deps.prisma.dataRoomImport.delete({ where: { id: tracked.id } });
              throw error;
            });
        return {
          imported,
          duplicates,
          failed: failed + plan.skipped,
          importId: tracked.id,
          total: plan.files.length + plan.skipped,
          queued: plan.files.length,
          folders: plan.folders.length,
        };
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
        const page = await searchWithFallback(
          (query, cursor) =>
            repo.searchPage(actor, { ...input, ...vector, filters, query, cursor }),
          input,
        );
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

    try {
      const { item, created } = await fileItem(actor, {
        source: "upload",
        sha256: body.sha256,
        name: name.data,
        mimeType: type,
        bytes: body.bytes,
        folderId,
      });
      return respond(item, !created);
    } catch (error) {
      // A zip that cannot be unpacked is the caller's file, not a server fault.
      if (error instanceof ZipRefusal)
        return c.json({ error: error.message, code: error.code }, 400);
      throw error;
    }
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

  /** The small WebP we drew ourselves, so it may be shown inline; cached by the browser only. */
  app.get("/api/data-room/items/:id/thumbnail", async (c) => {
    const actor = await authenticate(c.req.raw);
    if (!actor) return c.json({ error: "Unauthorized" }, 401);
    const item = await repo.getItem(actor, c.req.param("id")).catch((error: unknown) => {
      if (error instanceof IsolationError) return null;
      throw error;
    });
    if (!item?.thumbnailKey) return c.json({ error: "Not found" }, 404);
    const bytes = await deps.artifacts.get(
      item.thumbnailKey,
      dataRoomBlobContext(actor, "data-room.thumbnail"),
    );
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": "image/webp",
        "content-length": String(bytes.byteLength),
        "x-content-type-options": "nosniff",
        "content-security-policy": "sandbox; default-src 'none'",
        "cache-control": "private, max-age=86400",
      },
    });
  });
}
