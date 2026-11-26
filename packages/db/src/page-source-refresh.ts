import type { PrismaClient } from "./client.js";

type Db = Pick<PrismaClient, "$queryRaw" | "$executeRaw">;

export const PAGE_SOURCE_LEASE_MINUTES = 10;
/** Snapshots older than this are deleted. */
export const PAGE_SNAPSHOT_MAX_AGE_DAYS = 400;
/** Only this many newest snapshots stay per source. */
export const PAGE_SNAPSHOTS_KEPT_PER_SOURCE = 2000;
const DELETE_BATCH = 1000;

export interface ClaimedPageSource {
  id: string;
  spaceId: string;
  userId: string;
  botId: string;
  pageId: string;
  name: string;
  kind: string;
  call: unknown;
  schedule: string;
  status: string;
  failures: number;
  lastRefreshAt: Date | null;
  lastError: string | null;
}

/**
 * Atomically claims up to `limit` active sources that are due and not leased. FOR UPDATE SKIP
 * LOCKED plus the lease update means two workers never get the same row; a worker that dies
 * leaves a lease that expires on its own.
 */
export async function claimDuePageSources(
  db: Db,
  now: Date,
  limit: number,
): Promise<ClaimedPageSource[]> {
  const leaseUntil = new Date(now.getTime() + PAGE_SOURCE_LEASE_MINUTES * 60_000);
  return db.$queryRaw<ClaimedPageSource[]>`
    WITH due AS (
      SELECT "id" FROM "page_sources"
      WHERE "status" = 'active' AND "nextRefreshAt" <= ${now}
        AND ("leaseUntil" IS NULL OR "leaseUntil" < ${now})
      ORDER BY "nextRefreshAt"
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE "page_sources" s SET "leaseUntil" = ${leaseUntil}
    FROM due
    WHERE s."id" = due."id"
    RETURNING s."id", s."spaceId", s."userId", s."botId", s."pageId", s."name", s."kind",
      s."call", s."schedule", s."status", s."failures", s."lastRefreshAt", s."lastError"
  `;
}

/**
 * Deletes snapshots older than 400 days, then all but the newest 2,000 of each source, a batch at
 * a time so one run never holds a long lock.
 */
export async function deleteExpiredPageSnapshots(
  db: Db,
  now = new Date(),
): Promise<{ old: number; surplus: number }> {
  const cutoff = new Date(now.getTime() - PAGE_SNAPSHOT_MAX_AGE_DAYS * 86_400_000);
  let old = 0;
  let surplus = 0;
  for (let n = DELETE_BATCH; n === DELETE_BATCH; old += n) {
    n = await db.$executeRaw`
      DELETE FROM "page_source_snapshots" WHERE "id" IN (
        SELECT "id" FROM "page_source_snapshots" WHERE "fetchedAt" < ${cutoff} LIMIT ${DELETE_BATCH})`;
  }
  for (let n = DELETE_BATCH; n === DELETE_BATCH; surplus += n) {
    n = await db.$executeRaw`
      DELETE FROM "page_source_snapshots" WHERE "id" IN (
        SELECT "id" FROM (
          SELECT "id", row_number() OVER (PARTITION BY "sourceId" ORDER BY "fetchedAt" DESC, "id" DESC) AS rn
          FROM "page_source_snapshots") ranked
        WHERE rn > ${PAGE_SNAPSHOTS_KEPT_PER_SOURCE} LIMIT ${DELETE_BATCH})`;
  }
  return { old, surplus };
}
