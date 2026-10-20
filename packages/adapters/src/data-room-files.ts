import { randomUUID } from "node:crypto";
import type { ArtifactStore, JobPublisher } from "@rakazo/adapter-kit";
import {
  DATA_ROOM_EMBEDDING_DIMENSIONS,
  dataRoomBlobDeleteJob,
  dataRoomStepJob,
  dataRoomZipUnpackJob,
} from "@rakazo/adapter-kit";
import type { Actor } from "@rakazo/contracts";
import type { createDataRoomRepos, DataRoomItemRecord, PrismaClient } from "@rakazo/db";
import { createDataRoomImport } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import type { DataRoomAi } from "./data-room-models.js";
import { isZipFile, listZip, storeZipSource, ZipRefusal } from "./zip-unpack.js";

// biome-ignore lint/suspicious/noControlCharactersInRegex: names must not hold control characters.
const PATH_OR_CONTROL = /[/\\\u0000-\u001f\u007f]/g;
export const DATA_ROOM_MIME = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i;

/**
 * How long one streamed download or zip unpack may run. Below the queue's 4 h limit, after which
 * a locked job counts as abandoned and is run again.
 */
export const DATA_ROOM_STREAM_TIMEOUT_MS = 3 * 60 * 60 * 1000;
/** A stored zip no job picked up is removed after this long. */
const ZIP_BACKSTOP_MS = 24 * 60 * 60 * 1000;

export interface FileDataRoomDeps {
  prisma: Pick<PrismaClient, "dataRoomItem" | "dataRoomFolder" | "dataRoomImport">;
  artifacts: ArtifactStore;
  jobs: JobPublisher;
}

export interface FileDataRoomInput {
  /** A stream is written to storage as it arrives; bytes are for small files already in memory. */
  content: { bytes: Uint8Array } | { stream: AsyncIterable<Uint8Array> };
  /** Aborts a streamed write (a client that went away); the partial object is removed. */
  signal?: AbortSignal;
  name: string;
  mimeType: string;
  folderId: string | null;
  importId?: string;
  source: "upload" | "gmail" | "drive" | "box" | "chat";
  sourceConnectionId?: string;
  externalId?: string;
  sourceUrl?: string;
  sourceUpdatedAt?: Date;
}

/** A filed item, or (`item: null`) a zip stored for unpacking in the background. */
export type FiledDataRoomItem =
  | { item: DataRoomItemRecord; created: boolean }
  | { item: null; created: true; importId: string };

export function dataRoomBlobContext(actor: Actor, operation: string, signal?: AbortSignal) {
  const operationId = `${operation}:${randomUUID()}`;
  return {
    operationId,
    traceId: operationId,
    spaceId: actor.spaceId,
    userId: actor.userId,
    signal: signal ?? new AbortController().signal,
  };
}

/** A name safe for a Data room file or folder: no separators or control characters, at most 255 characters. */
export const dataRoomSafeName = (name: string, fallback: string) =>
  name.replace(PATH_OR_CONTROL, "_").trim().slice(0, 255) || fallback;

/** The name and type every import files: a safe name and a well-formed MIME type. */
export function dataRoomFileFields(file: { name: string; mimeType: string }, fallbackName: string) {
  const mimeType = file.mimeType.toLowerCase();
  return {
    name: dataRoomSafeName(file.name, fallbackName),
    mimeType: DATA_ROOM_MIME.test(mimeType) ? mimeType : "application/octet-stream",
  };
}

/**
 * Stores the content, files the item and queues ingest. A repeat (same upload bytes, or the same
 * external id) returns the existing item with created=false and drops the blob this call stored.
 * A zip is stored and queued for unpacking instead. Errors are the repository's own; the API maps
 * them to its error type.
 */
export function createFileDataRoomItem(
  deps: FileDataRoomDeps,
  repo: ReturnType<typeof createDataRoomRepos>,
) {
  /** A duplicate of an item stuck in `pending` or `failed` runs ingest again. */
  const requeueStuck = async (actor: Actor, item: DataRoomItemRecord) => {
    if (!(await repo.restartItem(actor, item.id))) return;
    await deps.jobs
      .enqueue(dataRoomStepJob("dataroom.ingest", actor, item.id))
      .catch((error: unknown) => getLogger().error("data room ingest enqueue failed", error));
  };

  /** The caller's item already filed from this external id (and connection), re-queued if stuck. */
  const known = async (actor: Actor, externalId: string, sourceConnectionId?: string) => {
    const item = await deps.prisma.dataRoomItem.findFirst({
      where: {
        spaceId: actor.spaceId,
        userId: actor.userId,
        sourceConnectionId: sourceConnectionId ?? null,
        externalId,
      },
    });
    if (item) await requeueStuck(actor, item);
    return item;
  };

  /** Removes a blob nothing references; if the store is down, a queued job removes it later. */
  const dropBlob = async (actor: Actor, key: string) => {
    try {
      await deps.artifacts.remove(key, dataRoomBlobContext(actor, "data-room.cleanup"));
    } catch {
      await deps.jobs
        .enqueue(dataRoomBlobDeleteJob(actor.spaceId, key))
        .catch((error: unknown) =>
          getLogger().error("data room blob cleanup enqueue failed", error),
        );
    }
  };

  /** Writes the content to the store; the store is the only source of the hash and size. */
  const store = async (actor: Actor, input: FileDataRoomInput) => {
    const context = dataRoomBlobContext(
      actor,
      input.source === "upload" ? "data-room.upload" : "data-room.import",
      input.signal,
    );
    const file = { name: input.name, mimeType: input.mimeType };
    if ("stream" in input.content)
      return deps.artifacts.putStream(input.content.stream, file, context);
    const { bytes } = input.content;
    const stored = await deps.artifacts.put({ ...file, bytes }, context);
    return { ...stored, size: bytes.byteLength };
  };

  const fileStored = async (
    actor: Actor,
    input: FileDataRoomInput,
    stored: { id: string; hash: string; size: number },
  ) => {
    const { content: _content, signal: _signal, ...fields } = input;
    const { item, created } = await repo
      .createItem(actor, {
        ...fields,
        sha256: stored.hash,
        size: stored.size,
        storageKey: stored.id,
      })
      .catch(async (error: unknown) => {
        await deps.jobs.enqueue(dataRoomBlobDeleteJob(actor.spaceId, stored.id));
        throw error;
      });
    // A repeat, or a lost race with a concurrent identical request: drop the blob this call stored.
    if (!created) {
      await dropBlob(actor, stored.id);
      await requeueStuck(actor, item);
    } else {
      // The file itself is saved; a queue outage must not turn it into a failure.
      await deps.jobs
        .enqueue(dataRoomStepJob("dataroom.ingest", actor, item.id))
        .catch((error: unknown) => getLogger().error("data room ingest enqueue failed", error));
    }
    return { item, created };
  };

  /** Streams or writes the content to storage and files it as one item. */
  const storeAndFile = async (actor: Actor, input: FileDataRoomInput) =>
    fileStored(actor, input, await store(actor, input));

  /** The folder at `path` under `rootId`, made when it is missing. */
  const folderAt = async (actor: Actor, rootId: string | null, path: string[]) => {
    let parentId = rootId;
    for (const raw of path) {
      const name = dataRoomSafeName(raw, "folder");
      const existing = await deps.prisma.dataRoomFolder.findFirst({
        where: { spaceId: actor.spaceId, userId: actor.userId, parentId, name },
        select: { id: true },
      });
      parentId = existing?.id ?? (await repo.createFolder(actor, { name, parentId })).id;
    }
    return parentId;
  };

  /**
   * Stores a zip, checks its directory, and queues a job that files each entry as its own item.
   * Progress shows in the import row: `input.importId` when the caller tracks one (the zip counted
   * as one file there), else a new one. Throws `ZipRefusal` when the whole zip is refused, before
   * anything is filed and with no blob left behind.
   */
  const queueZip = async (actor: Actor, input: FileDataRoomInput): Promise<FiledDataRoomItem> => {
    const stored = await store(actor, input);
    let entryCount: number;
    try {
      const context = dataRoomBlobContext(actor, "data-room.zip", input.signal);
      const entries = await listZip(
        storeZipSource(deps.artifacts, stored.id, stored.size, context),
      );
      if (entries.length === 0) throw new ZipRefusal("invalid");
      entryCount = entries.length;
    } catch (error) {
      await dropBlob(actor, stored.id);
      throw error;
    }
    const prisma = deps.prisma as PrismaClient;
    let importId = input.importId;
    try {
      if (importId) {
        await prisma.dataRoomImport.update({
          where: { id: importId },
          data: { total: { increment: entryCount - 1 } },
        });
      } else {
        importId = (
          await createDataRoomImport(prisma, actor, { source: "upload", total: entryCount })
        ).id;
      }
      await deps.jobs.enqueue(
        dataRoomZipUnpackJob({
          spaceId: actor.spaceId,
          userId: actor.userId,
          storageKey: stored.id,
          size: stored.size,
          entries: entryCount,
          importId,
          name: input.name,
          source: input.source,
          folderId: input.folderId,
          ...(input.sourceConnectionId ? { sourceConnectionId: input.sourceConnectionId } : {}),
          ...(input.externalId ? { externalId: input.externalId } : {}),
          ...(input.sourceUrl ? { sourceUrl: input.sourceUrl } : {}),
        }),
      );
    } catch (error) {
      if (importId && !input.importId) {
        await prisma.dataRoomImport.delete({ where: { id: importId } }).catch(() => undefined);
      } else if (importId) {
        await prisma.dataRoomImport
          .update({ where: { id: importId }, data: { total: { decrement: entryCount - 1 } } })
          .catch(() => undefined);
      }
      await dropBlob(actor, stored.id);
      throw error;
    }
    // Backstop for a job that never runs; the handler only removes blobs no item references.
    await deps.jobs
      .enqueue(
        dataRoomBlobDeleteJob(actor.spaceId, stored.id, new Date(Date.now() + ZIP_BACKSTOP_MS)),
      )
      .catch((error: unknown) => getLogger().error("data room zip cleanup enqueue failed", error));
    return { item: null, created: true, importId };
  };

  const fileItem = (actor: Actor, input: FileDataRoomInput): Promise<FiledDataRoomItem> =>
    isZipFile(input.name, input.mimeType) ? queueZip(actor, input) : storeAndFile(actor, input);
  return { fileItem, storeAndFile, requeueStuck, known, folderAt, dropBlob };
}

const QUERY_EMBED_TIMEOUT_MS = 10_000;

/**
 * The query's vector, only when an embedder exists and the user consented. Any failure means
 * keyword-only search, never an error.
 */
export async function dataRoomQueryVector(
  resolveAi: ((scope: { userId: string; spaceId: string }) => Promise<DataRoomAi>) | undefined,
  actor: Actor,
  query: string,
): Promise<{ vector?: number[]; embeddingModel?: string }> {
  try {
    const ai = await resolveAi?.(actor);
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
