import type { AdapterContext, ArtifactStore, JobPublisher } from "@rakazo/adapter-kit";
import { dataRoomDriveFileJob } from "@rakazo/adapter-kit";
import type { Actor } from "@rakazo/contracts";
import { DATA_ROOM_UPLOAD_MAX_BYTES } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDataRoomRepos, DataRoomConflictError, IsolationError } from "@rakazo/db";
import { createFileDataRoomItem, dataRoomFileFields, dataRoomSafeName } from "./data-room-files.js";
import {
  DriveFileError,
  type DriveFilesDeps,
  downloadDriveFile,
  getDriveFile,
  isImportableDriveFile,
  listDriveFiles,
} from "./drive-files.js";
import { listDriveAccounts } from "./drive-tools.js";

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
  /** Selected ids that are not folders, and files that cannot be imported (type or size). */
  skipped: number;
};

/**
 * Walks the selected Drive folders and all their subfolders, read-only. Throws `too_many` before
 * anything is written when the selection is over the limit. Shortcuts and other Google files with
 * nothing to download are skipped and counted, never followed. A selected folder inside another
 * selected folder stays nested; a directly picked file inside a selected folder goes to that
 * folder, and the other direct picks go to the import target.
 */
export async function planDriveFolders(
  deps: DriveFilesDeps,
  context: AdapterContext,
  input: {
    connectionId: string;
    folderIds: string[];
    /** Files picked directly; they count toward the limit with the folders' files. */
    directFileIds?: string[];
    maxBytes: number;
    maxScanned?: number;
  },
): Promise<DrivePlan> {
  const target = { connectionId: input.connectionId };
  const tooMany = () =>
    new DriveFileError(
      "too_many",
      `Folder imports are limited to ${DRIVE_IMPORT_MAX_FILES} files.`,
    );
  const maxScanned = input.maxScanned ?? DRIVE_IMPORT_MAX_SCANNED;
  const tooManyScanned = (max: number) =>
    new DriveFileError("too_many", `Folder imports are limited to ${max} items.`);
  let skippedSelected = 0;
  const selected: { id: string; name: string }[] = [];
  for (const id of new Set(input.folderIds)) {
    const root = await getDriveFile(deps, context, id, target).catch((error: unknown) => {
      if (error instanceof DriveFileError && error.code === "not_found") return null;
      throw error;
    });
    if (root?.isFolder) selected.push({ id: root.id, name: root.name });
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
        const page = await listDriveFiles(deps, context, {
          ...target,
          folderId: current.id,
          ...(pageToken ? { pageToken } : {}),
        });
        scanned += page.files.length;
        if (scanned > maxScanned) throw tooManyScanned(maxScanned);
        for (const child of page.files) {
          if (child.isFolder) {
            if (rootIds.has(child.id)) covered.add(child.id);
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

type Scope = { spaceId: string; userId: string; connectionId: string };

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

const actorFor = (scope: { spaceId: string; userId: string }): Actor => ({
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
  if (!(await stillAuthorized(deps, payload))) return;
  const actor = actorFor(payload);
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

/**
 * Writes a planned import: the Data room folders (a same-named folder is reused), then one file
 * job per file. Every step is repeatable, so a failure part-way is finished by the retry.
 */
export async function runDriveImport(
  deps: { prisma: PrismaClient; jobs: JobPublisher },
  payload: Scope & {
    folderId: string | null;
    folders: { name: string; parent: number | null }[];
    files: { id: string; folder: number | null }[];
  },
): Promise<void> {
  if (!(await stillAuthorized(deps, payload))) return;
  const actor = actorFor(payload);
  const roomFolders: string[] = [];
  try {
    for (const node of payload.folders) {
      const parent = node.parent === null ? payload.folderId : (roomFolders[node.parent] ?? null);
      roomFolders.push(await ensureFolder(deps.prisma, actor, parent, node.name));
    }
  } catch (error) {
    // The target folder is not the user's (any more).
    if (error instanceof IsolationError) return;
    throw error;
  }
  for (const file of payload.files) {
    await deps.jobs.enqueue(
      dataRoomDriveFileJob(
        actor,
        payload.connectionId,
        file.id,
        file.folder === null ? payload.folderId : (roomFolders[file.folder] ?? null),
      ),
    );
  }
}
