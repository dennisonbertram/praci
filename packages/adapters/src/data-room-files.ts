import { createHash, randomUUID } from "node:crypto";
import type { ArtifactStore, JobPublisher } from "@rakazo/adapter-kit";
import {
  DATA_ROOM_EMBEDDING_DIMENSIONS,
  dataRoomBlobDeleteJob,
  dataRoomStepJob,
} from "@rakazo/adapter-kit";
import type { Actor } from "@rakazo/contracts";
import { DATA_ROOM_UPLOAD_MAX_BYTES } from "@rakazo/contracts";
import { inferAttachmentMimeType } from "@rakazo/core";
import type { createDataRoomRepos, DataRoomItemRecord, PrismaClient } from "@rakazo/db";
import { createDataRoomImport, recordImportSkips } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import type { DataRoomAi } from "./data-room-models.js";
import { isZipFile, listZip, readZipEntry, ZipRefusal } from "./zip-unpack.js";

// biome-ignore lint/suspicious/noControlCharactersInRegex: names must not hold control characters.
const PATH_OR_CONTROL = /[/\\\u0000-\u001f\u007f]/g;
export const DATA_ROOM_MIME = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i;

export interface FileDataRoomDeps {
  prisma: Pick<PrismaClient, "dataRoomItem" | "dataRoomFolder" | "dataRoomImport">;
  artifacts: ArtifactStore;
  jobs: JobPublisher;
}

export interface FileDataRoomInput {
  bytes: Uint8Array;
  sha256: string;
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

/** The name, type and hash every import files: a safe name and a well-formed MIME type. */
export function dataRoomFileFields(
  file: { name: string; mimeType: string; bytes: Uint8Array },
  fallbackName: string,
) {
  const mimeType = file.mimeType.toLowerCase();
  return {
    bytes: file.bytes,
    sha256: createHash("sha256").update(file.bytes).digest("hex"),
    name: dataRoomSafeName(file.name, fallbackName),
    mimeType: DATA_ROOM_MIME.test(mimeType) ? mimeType : "application/octet-stream",
  };
}

/**
 * Stores the bytes, files the item and queues ingest. A repeat (same upload bytes, or the same
 * external id) returns the existing item with created=false and drops the blob this call stored.
 * Errors are the repository's own; the API maps them to its error type.
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

  const fileOne = async (actor: Actor, input: FileDataRoomInput) => {
    const { bytes, ...fields } = input;
    const stored = await deps.artifacts.put(
      { name: input.name, mimeType: input.mimeType, bytes },
      dataRoomBlobContext(
        actor,
        input.source === "upload" ? "data-room.upload" : "data-room.import",
      ),
    );
    const { item, created } = await repo
      .createItem(actor, { ...fields, size: bytes.byteLength, storageKey: stored.id })
      .catch(async (error: unknown) => {
        await deps.jobs.enqueue(dataRoomBlobDeleteJob(actor.spaceId, stored.id));
        throw error;
      });
    // Lost a race with a concurrent identical request: drop the blob this request stored.
    if (!created) {
      await deps.jobs.enqueue(dataRoomBlobDeleteJob(actor.spaceId, stored.id));
      await requeueStuck(actor, item);
    } else {
      // The file itself is saved; a queue outage must not turn it into a failure.
      await deps.jobs
        .enqueue(dataRoomStepJob("dataroom.ingest", actor, item.id))
        .catch((error: unknown) => getLogger().error("data room ingest enqueue failed", error));
    }
    return { item, created };
  };

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
   * Files each file of a zip as its own item, in the folders the zip names under `input.folderId`.
   * The zip itself is not kept. Progress shows in the import row: `input.importId` when the caller
   * tracks one (the zip counted as one file there), else a new one. Throws `ZipRefusal` when the
   * whole zip is refused, before anything is filed.
   */
  const unpackZip = async (actor: Actor, input: FileDataRoomInput) => {
    const { entries, oversized } = listZip(input.bytes, {
      maxEntryBytes: DATA_ROOM_UPLOAD_MAX_BYTES,
    });
    if (entries.length === 0) throw new ZipRefusal("invalid");
    const prisma = deps.prisma as PrismaClient;
    let importId = input.importId;
    if (importId) {
      await prisma.dataRoomImport.update({
        where: { id: importId },
        data: { total: { increment: entries.length + oversized - 1 } },
      });
    } else {
      importId = (
        await createDataRoomImport(prisma, actor, {
          source: "upload",
          total: entries.length + oversized,
        })
      ).id;
    }
    let first: DataRoomItemRecord | undefined;
    let created = 0;
    let duplicates = 0;
    let rejected = oversized;
    for (const entry of entries) {
      try {
        const bytes = readZipEntry(input.bytes, entry);
        const fullPath = [...entry.folders, entry.name].join("/");
        const result = await fileOne(actor, {
          source: input.source,
          ...dataRoomFileFields(
            {
              name: entry.name,
              mimeType: inferAttachmentMimeType(entry.name) ?? "application/octet-stream",
              bytes,
            },
            "file",
          ),
          folderId: await folderAt(actor, input.folderId, entry.folders),
          importId,
          ...(input.sourceConnectionId ? { sourceConnectionId: input.sourceConnectionId } : {}),
          ...(input.externalId ? { externalId: `${input.externalId}#${fullPath}` } : {}),
          ...(input.sourceUrl ? { sourceUrl: input.sourceUrl } : {}),
        });
        first ??= result.item;
        if (result.created) created += 1;
        else duplicates += 1;
      } catch (error) {
        // One bad entry does not stop the rest; each is bounded on its own.
        getLogger().warn("data room zip entry failed", {
          reason: error instanceof Error ? error.message : "unknown",
        });
        rejected += 1;
      }
    }
    await recordImportSkips(prisma, importId, { duplicates, rejected });
    if (!first) throw new ZipRefusal("invalid");
    return { item: first, created: created > 0 };
  };

  const fileItem = (actor: Actor, input: FileDataRoomInput) =>
    isZipFile(input.name, input.mimeType) ? unpackZip(actor, input) : fileOne(actor, input);
  return { fileItem, requeueStuck, known };
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
