import type { ArtifactStore, JobPublisher } from "@rakazo/adapter-kit";
import { dataRoomBoxFileJob } from "@rakazo/adapter-kit";
import { DATA_ROOM_UPLOAD_MAX_BYTES } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDataRoomRepos, IsolationError, recordImportSkips } from "@rakazo/db";
import {
  BoxFileError,
  type BoxFilesDeps,
  downloadBoxFile,
  getBoxItem,
  listBoxAccounts,
  listBoxFiles,
} from "./box-files.js";
import {
  abandonFolderImport,
  actorFor,
  type DrivePlan,
  planFolders,
  runFolderImport,
  type Scope,
} from "./data-room-drive-import.js";
import { createFileDataRoomItem, dataRoomFileFields } from "./data-room-files.js";

/** Walks the picked Box folders and their subfolders, read-only; see `planFolders` for the limits and shape. */
export function planBoxFolders(
  deps: BoxFilesDeps,
  scope: { spaceId: string; userId: string; signal: AbortSignal },
  input: {
    connectionId: string;
    folderIds: string[];
    directFileIds?: string[];
    maxBytes: number;
    maxScanned?: number;
  },
): Promise<DrivePlan> {
  return planFolders(
    {
      folder: async (id) => {
        const root = await getBoxItem(deps, scope, id, "folder", input.connectionId).catch(
          (error: unknown) => {
            if (error instanceof BoxFileError && error.code === "not_found") return null;
            throw error;
          },
        );
        return root ? { id: root.id, name: root.name } : null;
      },
      list: async (folderId, pageToken) => {
        const page = await listBoxFiles(deps, scope, {
          connectionId: input.connectionId,
          folderId,
          ...(pageToken ? { pageToken } : {}),
        });
        return {
          children: page.files.map((child) => ({
            id: child.id,
            name: child.name,
            isFolder: child.isFolder,
            importable: child.size === undefined || child.size <= input.maxBytes,
          })),
          ...(page.nextPageToken ? { nextPageToken: page.nextPageToken } : {}),
        };
      },
      limitError: (message) => new BoxFileError("too_many", message),
    },
    input,
  );
}

/**
 * Queued jobs outlive the request that made them, so each re-checks, when it runs, that the user
 * is still a member of the space and still owns the Box connection.
 */
async function stillAuthorized(deps: { prisma: PrismaClient }, scope: Scope): Promise<boolean> {
  const member = await deps.prisma.spaceMember.findUnique({
    where: { spaceId_userId: { spaceId: scope.spaceId, userId: scope.userId } },
    select: { id: true },
  });
  if (!member) return false;
  const accounts = await listBoxAccounts(deps.prisma, scope);
  return accounts.some((account) => account.id === scope.connectionId);
}

/**
 * A Box connection is an MCP server, not a `Connection` row, so an item cannot point at it. The
 * Box file id, prefixed, names a repeat instead; the unique key covers (space, user, external id).
 */
export const boxExternalId = (fileId: string) => `box:${fileId}`;

export interface BoxFileImportDeps {
  prisma: PrismaClient;
  artifacts: ArtifactStore;
  jobs: JobPublisher;
  box: Omit<BoxFilesDeps, "prisma">;
}

/**
 * Imports one Box file of a folder import, as the job's own user. Safe to run twice: a file already
 * filed from this Box account is left alone. Files that can never import (gone, a folder, too
 * large) end the job quietly; anything else throws so the queue retries.
 */
export async function runBoxFileImport(
  deps: BoxFileImportDeps,
  payload: Scope & { externalId: string; folderId: string | null; importId?: string },
  signal: AbortSignal = new AbortController().signal,
): Promise<void> {
  const { importId } = payload;
  /** A file that ends here never becomes an item, so the import counts it itself. */
  const skip = (skips: { duplicates?: number; rejected?: number }) =>
    importId ? recordImportSkips(deps.prisma, importId, skips) : undefined;
  if (!(await stillAuthorized(deps, payload))) return void (await skip({ rejected: 1 }));
  const actor = actorFor(payload);
  const { fileItem, known } = createFileDataRoomItem(deps, createDataRoomRepos(deps.prisma));
  const existing = await known(actor, boxExternalId(payload.externalId));
  if (existing) {
    // A retry of a job that already filed this item must not count it twice.
    if (existing.importId !== importId) await skip({ duplicates: 1 });
    return;
  }
  const file = await downloadBoxFile(
    { prisma: deps.prisma, ...deps.box },
    { spaceId: actor.spaceId, userId: actor.userId, signal },
    payload.externalId,
    { connectionId: payload.connectionId, maxBytes: DATA_ROOM_UPLOAD_MAX_BYTES },
  ).catch((error: unknown) => {
    if (
      error instanceof BoxFileError &&
      ["not_found", "unsupported", "too_large"].includes(error.code)
    )
      return null;
    throw error;
  });
  if (!file) return void (await skip({ rejected: 1 }));
  const modified = new Date(file.modifiedTime);
  try {
    const { created } = await fileItem(actor, {
      source: "box",
      ...dataRoomFileFields(file, "file"),
      folderId: payload.folderId,
      ...(importId ? { importId } : {}),
      externalId: boxExternalId(payload.externalId),
      sourceUrl: file.webViewLink,
      ...(Number.isNaN(modified.getTime()) ? {} : { sourceUpdatedAt: modified }),
    });
    // Lost a race with another import of the same file.
    if (!created) await skip({ duplicates: 1 });
  } catch (error) {
    // The Data room folder was deleted while the import was queued.
    if (!(error instanceof IsolationError)) throw error;
    await skip({ rejected: 1 });
  }
}

/** Writes a planned Box import; see `runFolderImport`. */
export async function runBoxImport(
  deps: { prisma: PrismaClient; jobs: JobPublisher },
  payload: Parameters<typeof runFolderImport>[1],
): Promise<void> {
  if (!(await stillAuthorized(deps, payload))) return abandonFolderImport(deps, payload);
  await runFolderImport(deps, payload, (actor, id, folderId) =>
    dataRoomBoxFileJob(actor, payload.connectionId, id, folderId, payload.importId),
  );
}
