import type { ArtifactStore, BackgroundJobPayloads, JobPublisher } from "@rakazo/adapter-kit";
import type { Actor } from "@rakazo/contracts";
import { inferAttachmentMimeType } from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";
import {
  createDataRoomRepos,
  DataRoomConflictError,
  IsolationError,
  recordImportSkips,
} from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import {
  createFileDataRoomItem,
  dataRoomBlobContext,
  dataRoomFileFields,
} from "./data-room-files.js";
import { listZip, storeZipSource, streamZipEntry, ZipRefusal } from "./zip-unpack.js";

export interface ZipUnpackDeps {
  prisma: PrismaClient;
  artifacts: ArtifactStore;
  jobs: JobPublisher;
}

const isEntryProblem = (error: unknown) =>
  error instanceof ZipRefusal ||
  error instanceof IsolationError ||
  error instanceof DataRoomConflictError;

/**
 * Files each entry of a stored zip as its own item, reading the zip from storage with ranged
 * requests and streaming every entry back, so memory stays flat whatever the sizes. The zip is
 * removed once its entries are filed or the whole zip is refused. Only a problem with one entry
 * (it cannot be read, or its folder or owner is refused) fails that entry; any other failure
 * (storage down, the job's time ran out) rethrows and keeps the zip for the retry. Safe to run
 * again: an entry an earlier attempt filed is not counted twice.
 */
export async function runDataRoomZipUnpack(
  deps: ZipUnpackDeps,
  payload: BackgroundJobPayloads["dataroom.zip.unpack"],
  signal: AbortSignal = new AbortController().signal,
): Promise<void> {
  const actor: Actor = {
    spaceId: payload.spaceId,
    userId: payload.userId,
    email: "",
    isDeploymentOwner: false,
  };
  const context = dataRoomBlobContext(actor, "data-room.zip-unpack", signal);
  const removeZip = () =>
    deps.artifacts
      .remove(payload.storageKey, dataRoomBlobContext(actor, "data-room.zip-unpack"))
      .catch((error: unknown) => getLogger().error("data room zip removal failed", error));
  const setStage = (data: { stage: string; currentName?: string | null }) =>
    deps.prisma.dataRoomImport
      .update({ where: { id: payload.importId }, data })
      .catch((error: unknown) => getLogger().error("data room import stage failed", error));
  await setStage({ stage: "opening", currentName: null });
  /** Nothing will be filed, so every file the zip counted for is failed. */
  const abandon = async () => {
    await setStage({ stage: "done", currentName: null });
    await recordImportSkips(deps.prisma, payload.importId, { rejected: payload.entries });
    await removeZip();
  };

  const member = await deps.prisma.spaceMember.findUnique({
    where: { spaceId_userId: { spaceId: payload.spaceId, userId: payload.userId } },
    select: { id: true },
  });
  if (!member) return abandon();

  const source = storeZipSource(deps.artifacts, payload.storageKey, payload.size, context);
  let entries: Awaited<ReturnType<typeof listZip>>;
  try {
    entries = await listZip(source);
  } catch (error) {
    if (error instanceof ZipRefusal) return abandon();
    throw error;
  }

  const { storeAndFile, folderAt } = createFileDataRoomItem(deps, createDataRoomRepos(deps.prisma));
  let duplicates = 0;
  let rejected = Math.max(0, payload.entries - entries.length);
  // Items filed or matched in this run, to tell a repeat inside the zip from a retried entry.
  const seen = new Set<string>();
  // Folders this run made, in parent-first order; a folder left empty (all duplicates) is removed.
  const made: string[] = [];
  const repos = createDataRoomRepos(deps.prisma);
  await setStage({ stage: "adding", currentName: null });
  let lastWrite = Date.now();
  for (const [index, entry] of entries.entries()) {
    signal.throwIfAborted();
    // Throttled: every 5th entry or after half a second, and the last one.
    if (index % 5 === 0 || index === entries.length - 1 || Date.now() - lastWrite > 500) {
      lastWrite = Date.now();
      await setStage({ stage: "adding", currentName: entry.name });
    }
    try {
      const fullPath = [...entry.folders, entry.name].join("/");
      const result = await storeAndFile(actor, {
        source: payload.source,
        ...dataRoomFileFields(
          {
            name: entry.name,
            mimeType: inferAttachmentMimeType(entry.name) ?? "application/octet-stream",
          },
          "file",
        ),
        content: { stream: streamZipEntry(source, entry) },
        signal,
        folderId: await folderAt(actor, payload.folderId, entry.folders, made),
        importId: payload.importId,
        ...(payload.sourceConnectionId ? { sourceConnectionId: payload.sourceConnectionId } : {}),
        ...(payload.externalId ? { externalId: `${payload.externalId}#${fullPath}` } : {}),
        ...(payload.sourceUrl ? { sourceUrl: payload.sourceUrl } : {}),
      });
      // An entry an earlier attempt of this job filed is already counted as an item.
      if (
        !result.created &&
        (result.item.importId !== payload.importId || seen.has(result.item.id))
      )
        duplicates += 1;
      seen.add(result.item.id);
    } catch (error) {
      // Anything but a problem with this entry (storage, network, time) is left for the retry.
      if (signal.aborted || !isEntryProblem(error)) throw error;
      // One bad entry does not stop the rest; each is bounded on its own.
      getLogger().warn("data room zip entry failed", {
        reason: error instanceof Error ? error.message : "unknown",
      });
      rejected += 1;
    }
  }
  for (const id of made.reverse()) {
    // Refuses a folder that holds anything, so only the empty ones go.
    await repos.deleteFolder(actor, id).catch((error: unknown) => {
      if (!(error instanceof DataRoomConflictError || error instanceof IsolationError)) throw error;
    });
  }
  await setStage({ stage: "done", currentName: null });
  await recordImportSkips(deps.prisma, payload.importId, { duplicates, rejected });
  await removeZip();
}
