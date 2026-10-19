import { createHash, randomUUID } from "node:crypto";
import type { ArtifactStore, JobPublisher } from "@rakazo/adapter-kit";
import {
  DATA_ROOM_EMBEDDING_DIMENSIONS,
  dataRoomBlobDeleteJob,
  dataRoomStepJob,
} from "@rakazo/adapter-kit";
import type { Actor } from "@rakazo/contracts";
import type { createDataRoomRepos, DataRoomItemRecord, PrismaClient } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import type { DataRoomAi } from "./data-room-models.js";

// biome-ignore lint/suspicious/noControlCharactersInRegex: names must not hold control characters.
const PATH_OR_CONTROL = /[/\\\u0000-\u001f\u007f]/g;
export const DATA_ROOM_MIME = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i;

export interface FileDataRoomDeps {
  prisma: Pick<PrismaClient, "dataRoomItem">;
  artifacts: ArtifactStore;
  jobs: JobPublisher;
}

export interface FileDataRoomInput {
  bytes: Uint8Array;
  sha256: string;
  name: string;
  mimeType: string;
  folderId: string | null;
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

  const fileItem = async (actor: Actor, input: FileDataRoomInput) => {
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
