import type { Actor } from "@rakazo/contracts";
import { getLogger } from "@rakazo/logging";
import type { PrismaClient } from "./client.js";
import { createNotification } from "./notifications.js";

type Owner = Pick<Actor, "spaceId" | "userId">;
export type DataRoomImportSource = "drive" | "box" | "gmail" | "upload";

const SOURCE_NAMES: Record<DataRoomImportSource, string> = {
  drive: "Google Drive",
  box: "Box",
  gmail: "Email",
  upload: "Upload",
};
/** How long an import that has not finished is still reported; a lost job must not spin forever. */
const ACTIVE_MAX_MS = 24 * 60 * 60 * 1000;
/** How long a finished import is still reported. */
const FINISHED_VISIBLE_MS = 5 * 60 * 1000;
const LATEST_ITEMS = 3;

/**
 * Starts tracking an import of `total` files. `rejected` files were skipped before it began.
 * It finishes at once when nothing is left to wait for.
 */
export async function createDataRoomImport(
  prisma: PrismaClient,
  actor: Owner,
  input: { source: DataRoomImportSource; total: number; rejected?: number },
) {
  const row = await prisma.dataRoomImport.create({
    data: {
      spaceId: actor.spaceId,
      userId: actor.userId,
      source: input.source,
      total: input.total,
      rejected: input.rejected ?? 0,
    },
  });
  await settleDataRoomImport(prisma, row.id);
  return row;
}

/** Counts files that never became an item, then finishes the import if that was the last file. */
export async function recordImportSkips(
  prisma: PrismaClient,
  importId: string,
  skips: { duplicates?: number; rejected?: number },
) {
  if (!skips.duplicates && !skips.rejected) return;
  await prisma.dataRoomImport
    .update({
      where: { id: importId },
      data: {
        duplicates: { increment: skips.duplicates ?? 0 },
        rejected: { increment: skips.rejected ?? 0 },
      },
    })
    .catch((error: unknown) => getLogger().error("data room import count failed", error));
  await settleDataRoomImport(prisma, importId);
}

const plural = (n: number) => (n === 1 ? "1 file" : `${n} files`);

/**
 * Finishes the import once every file is ready, failed or skipped, and tells the owner once. The
 * compare-and-set on `notifiedAt` lets one of several concurrent workers win. Never throws: it
 * runs after an item's own write, which must not be undone by a bookkeeping failure.
 */
export async function settleDataRoomImport(prisma: PrismaClient, importId: string) {
  try {
    const row = await prisma.dataRoomImport.findUnique({ where: { id: importId } });
    if (!row || row.notifiedAt) return;
    const counts = await prisma.dataRoomItem.groupBy({
      by: ["status"],
      where: { importId },
      _count: { _all: true },
    });
    const items = (status: string) => counts.find((c) => c.status === status)?._count._all ?? 0;
    const done = items("ready") + row.duplicates;
    const failed = items("failed") + row.rejected;
    if (done + failed < row.total) return;
    const now = new Date();
    const { count } = await prisma.dataRoomImport.updateMany({
      where: { id: importId, notifiedAt: null },
      data: { finishedAt: now, notifiedAt: now },
    });
    // Files that were all in the Data room already have nothing to report.
    const filed = items("ready");
    if (count === 0 || (filed === 0 && failed === 0)) return;
    const source = SOURCE_NAMES[row.source as DataRoomImportSource] ?? row.source;
    await createNotification(prisma, {
      spaceId: row.spaceId,
      userId: row.userId,
      surface: "data-room",
      importance: "info",
      title: filed > 0 ? `Imported ${plural(filed)} from ${source}` : `${source} import failed`,
      body: failed > 0 ? `${failed} failed` : null,
      link: "/app/data-room",
      dedupeKey: `data-room-import:${importId}`,
      skipRateLimits: true,
    });
  } catch (error) {
    getLogger().error("data room import settle failed", error);
  }
}

/** The caller's imports that are running, or finished in the last few minutes. */
export async function listDataRoomImports(prisma: PrismaClient, actor: Owner, now = new Date()) {
  const rows = await prisma.dataRoomImport.findMany({
    where: {
      spaceId: actor.spaceId,
      userId: actor.userId,
      total: { gt: 0 },
      OR: [
        { finishedAt: null, createdAt: { gt: new Date(now.getTime() - ACTIVE_MAX_MS) } },
        { finishedAt: { gt: new Date(now.getTime() - FINISHED_VISIBLE_MS) } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  const views = await Promise.all(
    rows.map(async (row) => {
      const where = { importId: row.id, spaceId: actor.spaceId, userId: actor.userId };
      const [counts, latest] = await Promise.all([
        prisma.dataRoomItem.groupBy({ by: ["status"], where, _count: { _all: true } }),
        prisma.dataRoomItem.findMany({
          where: { ...where, status: "ready" },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: LATEST_ITEMS,
          select: { id: true, name: true },
        }),
      ]);
      const items = (status: string) => counts.find((c) => c.status === status)?._count._all ?? 0;
      // "indexing" only brings search up to date: the file is already readable and filed.
      const done = items("ready") + items("indexing") + row.duplicates;
      const failed = items("failed") + row.rejected;
      const added = counts.reduce((n, c) => n + c._count._all, 0) + row.duplicates + row.rejected;
      return {
        id: row.id,
        source: row.source,
        total: row.total,
        done,
        failed,
        inProgress: Math.max(0, row.total - done - failed),
        finished: row.finishedAt !== null,
        // Entries filed, skipped or failed so far; the files are read after the last is added.
        added,
        stage: row.stage as "opening" | "adding" | "reading" | "done" | null,
        currentName: row.currentName,
        latest,
      };
    }),
  );
  // An import of files that were all in the Data room already has nothing to show.
  return views.filter((view) => !view.finished || view.latest.length > 0 || view.failed > 0);
}
