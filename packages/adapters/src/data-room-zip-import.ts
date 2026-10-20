import type { ArtifactStore, BackgroundJobPayloads, JobPublisher } from "@rakazo/adapter-kit";
import type { Actor } from "@rakazo/contracts";
import { inferAttachmentMimeType } from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";
import { createDataRoomRepos, recordImportSkips } from "@rakazo/db";
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

/**
 * Files each entry of a stored zip as its own item, reading the zip from storage with ranged
 * requests and streaming every entry back, so memory stays flat whatever the sizes. The zip is
 * removed once its entries are filed or the whole zip is refused; a failure that a retry could fix
 * (storage down, the job's time ran out) rethrows and keeps it. Safe to run again: an entry an
 * earlier attempt filed is not counted twice.
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
  /** Nothing will be filed, so every file the zip counted for is failed. */
  const abandon = async () => {
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
  for (const entry of entries) {
    signal.throwIfAborted();
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
        folderId: await folderAt(actor, payload.folderId, entry.folders),
        importId: payload.importId,
        ...(payload.sourceConnectionId ? { sourceConnectionId: payload.sourceConnectionId } : {}),
        ...(payload.externalId ? { externalId: `${payload.externalId}#${fullPath}` } : {}),
        ...(payload.sourceUrl ? { sourceUrl: payload.sourceUrl } : {}),
      });
      // An entry an earlier attempt of this job filed is already counted as an item.
      if (!result.created && result.item.importId !== payload.importId) duplicates += 1;
    } catch (error) {
      // The job ran out of time: leave the zip for the retry instead of failing every entry.
      if (signal.aborted) throw error;
      // One bad entry does not stop the rest; each is bounded on its own.
      getLogger().warn("data room zip entry failed", {
        reason: error instanceof Error ? error.message : "unknown",
      });
      rejected += 1;
    }
  }
  await recordImportSkips(deps.prisma, payload.importId, { duplicates, rejected });
  await removeZip();
}
