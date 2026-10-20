import type {
  AdapterContext,
  ArtifactStore,
  BackgroundJob,
  JobPublisher,
} from "@rakazo/adapter-kit";
import { dataRoomDriveFileJob } from "@rakazo/adapter-kit";
import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import {
  createDataRoomRepos,
  DataRoomConflictError,
  IsolationError,
  recordImportSkips,
} from "@rakazo/db";
import { createFileDataRoomItem, dataRoomFileFields, dataRoomSafeName } from "./data-room-files.js";
import type { DriveFilesDeps } from "./drive-files.js";
import {
  DriveFileError,
  getDriveFile,
  isImportableDriveFile,
  listDriveFiles,
  streamDriveFile,
} from "./drive-files.js";
import { listDriveAccounts } from "./drive-tools.js";
import { streamChunks } from "./stream-chunks.js";

/** The most files, and the most folders, one folder import takes. */
export const DRIVE_IMPORT_MAX_FILES = 500;
/** Data room folders are nested at most this deep under the import target; deeper Drive folders are flattened. */
export const DRIVE_IMPORT_MAX_DEPTH = 8;
/** The most Drive entries one plan looks at, importable or not, so a folder of Forms still stops. */
export const DRIVE_IMPORT_MAX_SCANNED = 5000;
const FLATTEN = " > ";

export type DrivePlan = {
  /** Data room folders to create. `parent` indexes an earlier entry; null is the import target. */
  folders: { name: string; parent: number | null }[];
  /** Files to import; `folder` indexes `folders`, null is the import target (direct picks). */
  files: { id: string; folder: number | null }[];
  /** Selected ids that are not folders, and files that cannot be imported (type). */
  skipped: number;
};

/** Where a folder import reads from: a provider's folders, with the files it can import marked. */
export type FolderSource = {
  /** The folder's name, or null when the id is gone or not a folder. */
  folder(id: string): Promise<{ id: string; name: string } | null>;
  list(
    folderId: string,
    pageToken?: string,
  ): Promise<{
    children: { id: string; name: string; isFolder: boolean; importable: boolean }[];
    nextPageToken?: string;
  }>;
  /** The error for a selection over the limits. */
  limitError(message: string): Error;
};

/**
 * Walks the selected folders and all their subfolders, read-only. Throws `limitError` before
 * anything is written when the selection is over the limit. Children that cannot be imported
 * (type, shortcuts) are skipped and counted, never followed. A selected folder inside another
 * selected folder stays nested; a directly picked file inside a selected folder goes to that
 * folder, and the other direct picks go to the import target.
 */
export async function planFolders(
  source: FolderSource,
  input: {
    folderIds: string[];
    /** Files picked directly; they count toward the limit with the folders' files. */
    directFileIds?: string[];
    maxScanned?: number;
  },
): Promise<DrivePlan> {
  const tooMany = () =>
    source.limitError(`Folder imports are limited to ${DRIVE_IMPORT_MAX_FILES} files.`);
  const maxScanned = input.maxScanned ?? DRIVE_IMPORT_MAX_SCANNED;
  const tooManyScanned = (max: number) =>
    source.limitError(`Folder imports are limited to ${max} items.`);
  let skippedSelected = 0;
  const selected: { id: string; name: string }[] = [];
  for (const id of new Set(input.folderIds)) {
    const root = await source.folder(id);
    if (root) selected.push(root);
    else skippedSelected += 1;
  }
  const walk = async (roots: { id: string; name: string }[]) => {
    const plan: DrivePlan = { folders: [], files: [], skipped: skippedSelected };
    const rootIds = new Set(roots.map((root) => root.id));
    const covered = new Set<string>();
    const seenFolders = new Set(rootIds);
    const seenFiles = new Set<string>();
    const names = new Map<number | null, Set<string>>();
    let scanned = 0;
    const queue: { id: string; index: number }[] = [];
    const depths: number[] = [];

    const add = (id: string, name: string, parent: number | null) => {
      const depth = parent === null ? 1 : (depths[parent] ?? 0) + 1;
      if (plan.folders.length >= DRIVE_IMPORT_MAX_FILES) throw tooMany();
      const own = dataRoomSafeName(name, "Folder");
      const above = parent === null ? undefined : plan.folders[parent];
      // The last level and everything below it sit in the depth-limit ancestor, the path in the name.
      const flat = depth > DRIVE_IMPORT_MAX_DEPTH && above;
      const place = flat ? above.parent : parent;
      const wanted = flat ? dataRoomSafeName(`${above.name}${FLATTEN}${own}`, own) : own;
      // Distinct Drive folders never share a name, or the import would merge them.
      const taken = names.get(place) ?? new Set<string>();
      names.set(place, taken);
      let unique = wanted;
      for (let n = 2; taken.has(unique); n++) unique = dataRoomSafeName(`${wanted} (${n})`, wanted);
      taken.add(unique);
      plan.folders.push({ name: unique, parent: place });
      depths.push(depth);
      queue.push({ id, index: plan.folders.length - 1 });
    };

    for (const root of roots) add(root.id, root.name, null);

    for (let next = 0; next < queue.length; next++) {
      const current = queue[next];
      if (!current) break;
      let pageToken: string | undefined;
      do {
        // An empty folder still costs a request, so a request counts as an entry.
        if (++scanned > maxScanned) throw tooManyScanned(maxScanned);
        const page = await source.list(current.id, pageToken);
        scanned += page.children.length;
        if (scanned > maxScanned) throw tooManyScanned(maxScanned);
        for (const child of page.children) {
          if (child.isFolder) {
            if (rootIds.has(child.id)) covered.add(child.id);
            if (seenFolders.has(child.id)) continue;
            seenFolders.add(child.id);
            add(child.id, child.name, current.index);
          } else if (!seenFiles.has(child.id)) {
            seenFiles.add(child.id);
            if (!child.importable) {
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
    for (const id of new Set(input.directFileIds)) {
      if (seenFiles.has(id)) continue;
      if (plan.files.length >= DRIVE_IMPORT_MAX_FILES) throw tooMany();
      plan.files.push({ id, folder: null });
    }
    return { plan, covered };
  };

  const first = await walk(selected);
  if (first.covered.size === 0) return first.plan;
  // A selected folder reached under another selected folder is already covered: walk again
  // without it as a root so it stays nested.
  return (await walk(selected.filter((root) => !first.covered.has(root.id)))).plan;
}

/** Plans a Drive folder import; see `planFolders`. */
export function planDriveFolders(
  deps: DriveFilesDeps,
  context: AdapterContext,
  input: {
    connectionId: string;
    folderIds: string[];
    directFileIds?: string[];
    maxScanned?: number;
  },
): Promise<DrivePlan> {
  const target = { connectionId: input.connectionId };
  return planFolders(
    {
      folder: async (id) => {
        const root = await getDriveFile(deps, context, id, target).catch((error: unknown) => {
          if (error instanceof DriveFileError && error.code === "not_found") return null;
          throw error;
        });
        return root?.isFolder ? { id: root.id, name: root.name } : null;
      },
      list: async (folderId, pageToken) => {
        const page = await listDriveFiles(deps, context, {
          ...target,
          folderId,
          ...(pageToken ? { pageToken } : {}),
        });
        return {
          children: page.files.map((child) => ({
            id: child.id,
            name: child.name,
            isFolder: child.isFolder,
            importable: isImportableDriveFile(child),
          })),
          ...(page.nextPageToken ? { nextPageToken: page.nextPageToken } : {}),
        };
      },
      limitError: (message) => new DriveFileError("too_many", message),
    },
    input,
  );
}

export type Scope = { spaceId: string; userId: string; connectionId: string };

/**
 * Queued jobs outlive the request that made them, so each re-checks, when it runs, that the user
 * is still a member of the space and still owns the Drive connection.
 */
async function stillAuthorized(deps: { prisma: PrismaClient }, scope: Scope): Promise<boolean> {
  const member = await deps.prisma.spaceMember.findUnique({
    where: { spaceId_userId: { spaceId: scope.spaceId, userId: scope.userId } },
    select: { id: true },
  });
  if (!member) return false;
  const accounts = await listDriveAccounts(deps.prisma, scope);
  return accounts.some((account) => account.id === scope.connectionId);
}

export const actorFor = (scope: { spaceId: string; userId: string }): Actor => ({
  spaceId: scope.spaceId,
  userId: scope.userId,
  email: "",
  isDeploymentOwner: false,
});

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
 * unsupported) end the job quietly; anything else throws so the queue retries.
 */
export async function runDriveFileImport(
  deps: DriveFileImportDeps,
  payload: {
    spaceId: string;
    userId: string;
    connectionId: string;
    externalId: string;
    folderId: string | null;
    importId?: string;
  },
  signal: AbortSignal = new AbortController().signal,
): Promise<void> {
  const { importId } = payload;
  /** A file that ends here never becomes an item, so the import counts it itself. */
  const skip = (skips: { duplicates?: number; rejected?: number }) =>
    importId ? recordImportSkips(deps.prisma, importId, skips) : undefined;
  if (!(await stillAuthorized(deps, payload))) return void (await skip({ rejected: 1 }));
  const actor = actorFor(payload);
  const { fileItem, known } = createFileDataRoomItem(deps, createDataRoomRepos(deps.prisma));
  const existing = await known(actor, payload.externalId, payload.connectionId);
  if (existing) {
    // A retry of a job that already filed this item must not count it twice.
    if (existing.importId !== importId) await skip({ duplicates: 1 });
    return;
  }
  const operationId = `data-room.drive-folder:${payload.externalId}`;
  const file = await streamDriveFile(
    { prisma: deps.prisma, connectors: deps.connectors, google: deps.google },
    { operationId, traceId: operationId, spaceId: actor.spaceId, userId: actor.userId, signal },
    payload.externalId,
    { connectionId: payload.connectionId },
  ).catch((error: unknown) => {
    if (
      error instanceof DriveFileError &&
      ["not_found", "unsupported", "too_large"].includes(error.code)
    )
      return null;
    throw error;
  });
  if (!file) return void (await skip({ rejected: 1 }));
  const modified = new Date(file.modifiedTime);
  try {
    const { created } = await fileItem(actor, {
      source: "drive",
      ...dataRoomFileFields(file, "file"),
      content: { stream: streamChunks(file.stream) },
      signal,
      folderId: payload.folderId,
      ...(importId ? { importId } : {}),
      sourceConnectionId: payload.connectionId,
      externalId: payload.externalId,
      ...(file.webViewLink ? { sourceUrl: file.webViewLink } : {}),
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

/** The caller's folder of that name under `parentId`, created when missing. */
async function ensureFolder(
  prisma: PrismaClient,
  actor: Actor,
  parentId: string | null,
  name: string,
): Promise<string> {
  const find = () =>
    prisma.dataRoomFolder.findFirst({
      where: { spaceId: actor.spaceId, userId: actor.userId, parentId, name },
      select: { id: true },
    });
  const existing = await find();
  if (existing) return existing.id;
  try {
    return (await createDataRoomRepos(prisma).createFolder(actor, { name, parentId })).id;
  } catch (error) {
    // A concurrent import made it first.
    const raced = error instanceof DataRoomConflictError && (await find());
    if (raced) return raced.id;
    throw error;
  }
}

/** Nothing will be filed (the user lost access, or the target folder is gone), so every file of the import counts as failed. */
export async function abandonFolderImport(
  deps: { prisma: PrismaClient },
  payload: { importId?: string; files: unknown[] },
): Promise<void> {
  if (payload.importId) {
    await recordImportSkips(deps.prisma, payload.importId, { rejected: payload.files.length });
  }
}

/**
 * Writes a planned import: the Data room folders (a same-named folder is reused), then one file
 * job per file. Every step is repeatable, so a failure part-way is finished by the retry.
 */
export async function runFolderImport(
  deps: { prisma: PrismaClient; jobs: JobPublisher },
  payload: Scope & {
    folderId: string | null;
    importId?: string;
    folders: { name: string; parent: number | null }[];
    files: { id: string; folder: number | null }[];
  },
  fileJob: (actor: Actor, externalId: string, folderId: string | null) => BackgroundJob,
): Promise<void> {
  const actor = actorFor(payload);
  const roomFolders: string[] = [];
  try {
    for (const node of payload.folders) {
      const parent = node.parent === null ? payload.folderId : (roomFolders[node.parent] ?? null);
      roomFolders.push(await ensureFolder(deps.prisma, actor, parent, node.name));
    }
  } catch (error) {
    // The target folder is not the user's (any more).
    if (error instanceof IsolationError) return abandonFolderImport(deps, payload);
    throw error;
  }
  for (const file of payload.files) {
    await deps.jobs.enqueue(
      fileJob(
        actor,
        file.id,
        file.folder === null ? payload.folderId : (roomFolders[file.folder] ?? null),
      ),
    );
  }
}

/** Writes a planned Drive import; see `runFolderImport`. */
export async function runDriveImport(
  deps: { prisma: PrismaClient; jobs: JobPublisher },
  payload: Parameters<typeof runFolderImport>[1],
): Promise<void> {
  if (!(await stillAuthorized(deps, payload))) return abandonFolderImport(deps, payload);
  await runFolderImport(deps, payload, (actor, id, folderId) =>
    dataRoomDriveFileJob(actor, payload.connectionId, id, folderId, payload.importId),
  );
}
