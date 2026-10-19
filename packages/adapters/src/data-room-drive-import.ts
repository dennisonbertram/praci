import type { AdapterContext, ArtifactStore, JobPublisher } from "@rakazo/adapter-kit";
import type { Actor } from "@rakazo/contracts";
import { DATA_ROOM_UPLOAD_MAX_BYTES } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDataRoomRepos, IsolationError } from "@rakazo/db";
import { createFileDataRoomItem, dataRoomFileFields, dataRoomSafeName } from "./data-room-files.js";
import {
  DriveFileError,
  type DriveFilesDeps,
  downloadDriveFile,
  getDriveFile,
  isImportableDriveFile,
  listDriveFiles,
} from "./drive-files.js";

/** The most files, and the most folders, one folder import takes. */
export const DRIVE_IMPORT_MAX_FILES = 500;
/** Data room folders are nested at most this deep under the import target; deeper Drive folders are flattened. */
export const DRIVE_IMPORT_MAX_DEPTH = 8;
const FLATTEN = " > ";

export type DrivePlan = {
  /** Data room folders to create. `parent` indexes an earlier entry; null is the import target. */
  folders: { name: string; parent: number | null }[];
  /** Files to import; `folder` indexes `folders`. */
  files: { id: string; folder: number }[];
  /** Selected ids that are not folders, and files that cannot be imported (type or size). */
  skipped: number;
};

/**
 * Walks the selected Drive folders and all their subfolders, read-only. Throws `too_many` before
 * anything is written when the selection is over the limit. Shortcuts and other Google files with
 * nothing to download are skipped and counted, never followed.
 */
export async function planDriveFolders(
  deps: DriveFilesDeps,
  context: AdapterContext,
  input: { connectionId: string; folderIds: string[]; maxBytes: number },
): Promise<DrivePlan> {
  const target = { connectionId: input.connectionId };
  const plan: DrivePlan = { folders: [], files: [], skipped: 0 };
  const seenFolders = new Set<string>();
  const seenFiles = new Set<string>();
  const tooMany = () =>
    new DriveFileError(
      "too_many",
      `Folder imports are limited to ${DRIVE_IMPORT_MAX_FILES} files.`,
    );
  const queue: { id: string; index: number }[] = [];
  const depths: number[] = [];

  const add = (id: string, name: string, parent: number | null) => {
    const depth = parent === null ? 1 : (depths[parent] ?? 0) + 1;
    if (plan.folders.length >= DRIVE_IMPORT_MAX_FILES) throw tooMany();
    const own = dataRoomSafeName(name, "Folder");
    const above = parent === null ? undefined : plan.folders[parent];
    // Past the limit a folder goes into the depth-limit ancestor; deeper ones extend its name.
    const flat = depth > DRIVE_IMPORT_MAX_DEPTH && above;
    plan.folders.push(
      !flat
        ? { name: own, parent }
        : depth === DRIVE_IMPORT_MAX_DEPTH + 1
          ? { name: own, parent }
          : { name: dataRoomSafeName(`${above.name}${FLATTEN}${own}`, own), parent: above.parent },
    );
    depths.push(depth);
    queue.push({ id, index: plan.folders.length - 1 });
  };

  for (const id of new Set(input.folderIds)) {
    const root = await getDriveFile(deps, context, id, target).catch((error: unknown) => {
      if (error instanceof DriveFileError && error.code === "not_found") return null;
      throw error;
    });
    if (!root?.isFolder) plan.skipped += 1;
    else if (!seenFolders.has(root.id)) {
      seenFolders.add(root.id);
      add(root.id, root.name, null);
    }
  }

  for (let next = 0; next < queue.length; next++) {
    const current = queue[next];
    if (!current) break;
    let pageToken: string | undefined;
    do {
      const page = await listDriveFiles(deps, context, {
        ...target,
        folderId: current.id,
        ...(pageToken ? { pageToken } : {}),
      });
      for (const child of page.files) {
        if (child.isFolder) {
          if (seenFolders.has(child.id)) continue;
          seenFolders.add(child.id);
          add(child.id, child.name, current.index);
        } else if (!seenFiles.has(child.id)) {
          seenFiles.add(child.id);
          const tooBig = child.size !== undefined && child.size > input.maxBytes;
          if (
            !isImportableDriveFile(child) ||
            (tooBig && !child.mimeType.startsWith("application/vnd.google-apps."))
          ) {
            plan.skipped += 1;
          } else {
            if (plan.files.length >= DRIVE_IMPORT_MAX_FILES) throw tooMany();
            plan.files.push({ id: child.id, folder: current.index });
          }
        }
      }
      pageToken = page.nextPageToken;
    } while (pageToken);
  }
  return plan;
}

export interface DriveFileImportDeps {
  prisma: PrismaClient;
  artifacts: ArtifactStore;
  jobs: JobPublisher;
  connectors: DriveFilesDeps["connectors"];
  google?: DriveFilesDeps["google"];
}

/**
 * Imports one Drive file of a folder import, as the job's own user. Safe to run twice: a file
 * already filed from this Drive connection is left alone. Files that can never import (gone,
 * unsupported, too large) end the job quietly; anything else throws so the queue retries.
 */
export async function runDriveFileImport(
  deps: DriveFileImportDeps,
  payload: {
    spaceId: string;
    userId: string;
    connectionId: string;
    externalId: string;
    folderId: string | null;
  },
  signal: AbortSignal = new AbortController().signal,
): Promise<void> {
  const actor: Actor = {
    spaceId: payload.spaceId,
    userId: payload.userId,
    email: "",
    isDeploymentOwner: false,
  };
  const { fileItem, known } = createFileDataRoomItem(deps, createDataRoomRepos(deps.prisma));
  if (await known(actor, payload.externalId, payload.connectionId)) return;
  const operationId = `data-room.drive-folder:${payload.externalId}`;
  const file = await downloadDriveFile(
    { prisma: deps.prisma, connectors: deps.connectors, google: deps.google },
    { operationId, traceId: operationId, spaceId: actor.spaceId, userId: actor.userId, signal },
    payload.externalId,
    { connectionId: payload.connectionId, maxBytes: DATA_ROOM_UPLOAD_MAX_BYTES },
  ).catch((error: unknown) => {
    if (
      error instanceof DriveFileError &&
      ["not_found", "unsupported", "too_large"].includes(error.code)
    )
      return null;
    throw error;
  });
  if (!file) return;
  const modified = new Date(file.modifiedTime);
  try {
    await fileItem(actor, {
      source: "drive",
      ...dataRoomFileFields(file, "file"),
      folderId: payload.folderId,
      sourceConnectionId: payload.connectionId,
      externalId: payload.externalId,
      ...(file.webViewLink ? { sourceUrl: file.webViewLink } : {}),
      ...(Number.isNaN(modified.getTime()) ? {} : { sourceUpdatedAt: modified }),
    });
  } catch (error) {
    // The Data room folder was deleted while the import was queued.
    if (!(error instanceof IsolationError)) throw error;
  }
}
