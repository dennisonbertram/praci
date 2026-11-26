import type { WatchSpec } from "@rakazo/contracts";
import type { CheckInCadence } from "@rakazo/core";
import {
  CHECK_IN_MANAGED_KIND,
  checkInCadenceFromRoutine,
  checkInCrons,
  checkInInstruction,
  diffSnapshots,
  isNoisy,
  nextCronDateAcrossStrict,
  nextWatchCheckAt,
  recordCheckOutcome,
  SPACE_WATCH_WAKES_PER_DAY,
  shouldPauseForErrors,
  truncateSnapshot,
  WATCHES_PER_BOT,
  WATCHES_PER_SPACE,
  wakeBudget,
  watchDay,
} from "@rakazo/core";
import { fingerprintText } from "@rakazo/core/node/watch-fingerprint";
import { cancelQueuedRoutineRuns } from "./cancel-runs.js";
import type { PrismaClient } from "./client.js";
import { Prisma } from "./client.js";

type Db = PrismaClient | Prisma.TransactionClient;

/*
 * Page watches. RoutineWatchState holds one row per watching routine.
 *   fingerprint  sha256 of the normalized text the last check SAW (compared check to check).
 *   snapshot     normalized text (<= 16 KB) the model was last TOLD about (the diff baseline).
 * A change the model has not been told about yet (daily budget used up, a wake in flight)
 * leaves snapshot alone and sets pendingChange, so later changes fold into one diff.
 *
 * A bot's check-in setting is its managed routine (managedKind "check_in"): the routine's
 * crons and active flag ARE the setting, so Bot has no check-in column. One per bot is
 * enforced by the partial unique index routines_botId_managedKind_key.
 */

/** A claimed row stays claimed (nextCheckAt pushed out) this long if the worker dies before recording. */
export const WATCH_CLAIM_LEASE_MINUTES = 10;

export type ClaimedWatchCheck = {
  routineId: string;
  spaceId: string;
  botId: string;
  userId: string;
  timezone: string;
  watch: WatchSpec;
};

/**
 * Atomically claims up to `limit` watches that are due (nextCheckAt <= now), unpaused and on an
 * active routine. FOR UPDATE SKIP LOCKED plus the lease update means two workers never get the same one.
 */
export async function claimDueWatchChecks(
  db: Db,
  now: Date,
  limit: number,
): Promise<ClaimedWatchCheck[]> {
  const leaseUntil = new Date(now.getTime() + WATCH_CLAIM_LEASE_MINUTES * 60_000);
  const rows = await db.$queryRaw<
    Array<{
      routineId: string;
      spaceId: string;
      botId: string;
      userId: string;
      timezone: string;
      watch: WatchSpec;
    }>
  >`
    WITH due AS (
      SELECT s."routineId" FROM "routine_watch_states" s
      JOIN "routines" r ON r."id" = s."routineId"
      WHERE s."nextCheckAt" <= ${now} AND s."pausedReason" IS NULL
        AND r."active" = true AND r."watch" IS NOT NULL
      ORDER BY s."nextCheckAt"
      LIMIT ${limit}
      FOR UPDATE OF s SKIP LOCKED
    )
    UPDATE "routine_watch_states" s SET "nextCheckAt" = ${leaseUntil}
    FROM due, "routines" r
    WHERE s."routineId" = due."routineId" AND r."id" = s."routineId"
    RETURNING s."routineId", s."spaceId", r."botId", r."userId", r."timezone", r."watch"
  `;
  return rows;
}

/** The routine's local calendar day, used for wake counts. */
const today = (now: Date, timezone: string) => watchDay(now, timezone);

/** Wakes already spent today by all watches in a space (each counted in its own routine's local day). */
export async function spaceWatchWakesToday(db: Db, input: { spaceId: string; now: Date }) {
  const states = await db.routineWatchState.findMany({
    where: { spaceId: input.spaceId, wakesToday: { gt: 0 } },
    select: { wakesToday: true, wakesDay: true, routine: { select: { timezone: true } } },
  });
  return states.reduce(
    (sum, s) => (s.wakesDay === today(input.now, s.routine.timezone) ? sum + s.wakesToday : sum),
    0,
  );
}

/** Watches (routines with a watch spec) in a bot and in the whole space, for the 5 and 20 limits. */
export async function countWatches(db: Db, input: { spaceId: string; botId: string }) {
  const where = { spaceId: input.spaceId, watch: { not: Prisma.DbNull } };
  const [space, bot] = await Promise.all([
    db.routine.count({ where }),
    db.routine.count({ where: { ...where, botId: input.botId } }),
  ]);
  return { bot, space };
}

/** The message to show when the bot or space is at its watch limit, else null. One rule for the router and watch_create. */
export async function watchLimitError(db: Db, input: { spaceId: string; botId: string }) {
  const count = await countWatches(db, input);
  return count.bot >= WATCHES_PER_BOT || count.space >= WATCHES_PER_SPACE
    ? `A bot can watch ${WATCHES_PER_BOT} pages and a space ${WATCHES_PER_SPACE}.`
    : null;
}

/**
 * Keeps the state row in step with a routine create/update. No watch deletes the row. A watch
 * (or changed address) starts a fresh baseline and is due now. Does not touch the paused flag
 * of an unchanged watch; use resumeWatch for that.
 */
export async function syncWatchState(
  db: Db,
  input: {
    routineId: string;
    spaceId: string;
    watch: WatchSpec | null;
    /** True on create and when the url or interval was edited. */
    watchChanged: boolean;
    now: Date;
  },
) {
  if (!input.watch) {
    await db.routineWatchState.deleteMany({
      where: { routineId: input.routineId, spaceId: input.spaceId },
    });
    return null;
  }
  const fresh = {
    fingerprint: null,
    snapshot: null,
    lastCheckedAt: null,
    lastChangedAt: null,
    consecutiveErrors: 0,
    nextCheckAt: input.now,
    pausedReason: null,
    wakesToday: 0,
    wakesDay: null,
    pendingChange: false,
    recentChanges: [],
  };
  return db.routineWatchState.upsert({
    where: { routineId: input.routineId },
    create: { routineId: input.routineId, spaceId: input.spaceId, ...fresh },
    update: input.watchChanged ? fresh : {},
  });
}

/** Clears a pause (errors, noisy, budget, access) and checks again now. Keeps the baseline. */
export async function resumeWatch(
  db: Db,
  input: { routineId: string; spaceId: string; now: Date },
) {
  const result = await db.routineWatchState.updateMany({
    where: { routineId: input.routineId, spaceId: input.spaceId },
    data: { pausedReason: null, consecutiveErrors: 0, recentChanges: [], nextCheckAt: input.now },
  });
  return result.count > 0;
}

export type WatchCheckInput = {
  routineId: string;
  spaceId: string;
  now: Date;
  /** Normalized page text (normalizePageText) on success. */
  text?: string;
  /** Set instead of text when the fetch failed. "access" pauses at once (e.g. a revoked grant). */
  error?: { kind: "transient" | "access" };
  /** A wake for this watch is queued or running: do not start another, fold the change. */
  wakeInFlight?: boolean;
};

export type WatchCheckResult<T = unknown> =
  | { outcome: "missing" }
  | { outcome: "baseline" }
  | { outcome: "unchanged" }
  | { outcome: "error"; paused: boolean; pausedReason: string | null }
  /** Changed but not delivered (budget or a wake in flight); folds into a later wake. */
  | { outcome: "pending" }
  /** Start an unattended run whose prompt carries `diff` (fenced as untrusted data). */
  | { outcome: "wake"; diff: string; created: T | null }
  /** Paused as noisy. Notify once. */
  | { outcome: "noisy" };

/**
 * Applies one probe result to the watch state in a transaction (row locked). Returns what the
 * worker should do next. The caller enqueues the run for "wake" and sends the one notification
 * when a result is paused (error/access/noisy).
 */
export async function recordWatchCheck<T = unknown>(
  db: PrismaClient,
  input: WatchCheckInput,
  /**
   * Runs inside the same transaction that advances the snapshot and spends the wake budget, so a
   * crash leaves either nothing changed (the next probe re-detects) or a queued run (the job
   * reconciler enqueues queued runs). Enqueueing the job can happen after commit.
   */
  createWake?: (tx: Prisma.TransactionClient, diff: string) => Promise<T | null>,
): Promise<WatchCheckResult<T>> {
  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ routineId: string }>>`
      SELECT "routineId" FROM "routine_watch_states"
      WHERE "routineId" = ${input.routineId} AND "spaceId" = ${input.spaceId} FOR UPDATE`;
    if (rows.length === 0) return { outcome: "missing" } as const;
    const [state, routine] = await Promise.all([
      tx.routineWatchState.findUniqueOrThrow({ where: { routineId: input.routineId } }),
      tx.routine.findFirst({
        where: { id: input.routineId, spaceId: input.spaceId },
        select: { timezone: true, watch: true },
      }),
    ]);
    const interval = (routine?.watch as WatchSpec | null)?.intervalMinutes ?? 60;
    const save = (data: Prisma.RoutineWatchStateUpdateInput) =>
      tx.routineWatchState.update({ where: { routineId: input.routineId }, data });

    if (input.text === undefined) {
      const access = input.error?.kind === "access";
      const errors = state.consecutiveErrors + 1;
      const paused = access || shouldPauseForErrors(errors);
      const pausedReason = access ? "access" : paused ? "errors" : null;
      await save({
        consecutiveErrors: errors,
        lastCheckedAt: input.now,
        pausedReason,
        nextCheckAt: paused ? null : nextWatchCheckAt(input.now, interval, errors),
      });
      return { outcome: "error", paused, pausedReason } as const;
    }

    // The fingerprint covers the whole page; only the stored snapshot (the diff baseline) is cut.
    const text = truncateSnapshot(input.text);
    const fingerprint = fingerprintText(input.text);
    const common = {
      consecutiveErrors: 0,
      lastCheckedAt: input.now,
      fingerprint,
      nextCheckAt: nextWatchCheckAt(input.now, interval, 0),
    };

    if (state.fingerprint === null || state.snapshot === null) {
      await save({ ...common, snapshot: text, pendingChange: false });
      return { outcome: "baseline" } as const;
    }

    const changedSinceLastCheck = fingerprint !== state.fingerprint;
    const ring = recordCheckOutcome(state.recentChanges, changedSinceLastCheck);
    // ponytail: a change past 16 KB that is deferred (budget, wake in flight) is forgotten once the
    // fingerprint settles, because the kept snapshot cannot show it. Store a told-fingerprint if it matters.
    const beyondSnapshot = text === state.snapshot && changedSinceLastCheck;
    const differsFromTold = text !== state.snapshot || beyondSnapshot;
    const lastChangedAt = changedSinceLastCheck ? input.now : undefined;

    if (isNoisy(ring)) {
      await save({
        ...common,
        recentChanges: ring,
        lastChangedAt,
        pausedReason: "noisy",
        nextCheckAt: null,
      });
      return { outcome: "noisy" } as const;
    }
    if (!differsFromTold) {
      await save({ ...common, recentChanges: ring, lastChangedAt, pendingChange: false });
      return { outcome: "unchanged" } as const;
    }

    const day = today(input.now, routine?.timezone ?? "UTC");
    const own = wakeBudget({ wakesToday: state.wakesToday, wakesDay: state.wakesDay, today: day });
    // Serialize the space cap: concurrent probes in one space must not all read the same count.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.spaceId}, 0))`;
    const spaceUsed = await spaceWatchWakesToday(tx, { spaceId: input.spaceId, now: input.now });
    // The space total already includes this watch's own wakes today.
    const spaceFull = spaceUsed >= SPACE_WATCH_WAKES_PER_DAY;
    if (!own.allowed || spaceFull || input.wakeInFlight) {
      await save({ ...common, recentChanges: ring, lastChangedAt, pendingChange: true });
      return { outcome: "pending" } as const;
    }
    await save({
      ...common,
      recentChanges: ring,
      lastChangedAt,
      snapshot: text,
      pendingChange: false,
      wakesToday: own.nextWakesToday,
      wakesDay: own.nextWakesDay,
    });
    const diff = beyondSnapshot
      ? "The page changed below the part I keep (first 16 KB)."
      : diffSnapshots(state.snapshot, text);
    const created = createWake ? await createWake(tx, diff) : null;
    return { outcome: "wake", diff, created } as const;
  });
}

export async function getCheckInRoutine(db: Db, input: { spaceId: string; botId: string }) {
  return db.routine.findFirst({
    where: { spaceId: input.spaceId, botId: input.botId, managedKind: CHECK_IN_MANAGED_KIND },
  });
}

export async function getCheckInCadence(
  db: Db,
  input: { spaceId: string; botId: string },
): Promise<CheckInCadence> {
  return checkInCadenceFromRoutine(await getCheckInRoutine(db, input));
}

/**
 * Creates, updates or deactivates the bot's single managed check-in routine. Off keeps the row
 * (history stays) with active=false. Returns the row; the caller enqueues routineWakeupJob when
 * it is active with a nextRunAt.
 */
export async function upsertCheckInRoutine(
  db: PrismaClient,
  input: {
    spaceId: string;
    userId: string;
    botId: string;
    cadence: CheckInCadence;
    timezone: string;
    now?: Date;
  },
) {
  const existing = await getCheckInRoutine(db, input);
  const crons = checkInCrons(input.cadence, input.timezone);
  const active = input.cadence !== "off";
  const nextRunAt = active
    ? nextCronDateAcrossStrict(crons, input.now ?? new Date(), input.timezone)
    : null;
  if (existing) {
    const data = {
      active,
      nextRunAt,
      ...(active ? { crons, timezone: input.timezone } : {}),
    };
    if (active) return db.routine.update({ where: { id: existing.id }, data });
    return db.$transaction(async (tx) => {
      const row = await tx.routine.update({ where: { id: existing.id }, data });
      await cancelQueuedRoutineRuns(
        tx,
        { routineId: existing.id, spaceId: input.spaceId, userId: input.userId },
        input.now ?? new Date(),
      );
      return row;
    });
  }
  if (!active) return null;
  return db.routine.create({
    data: {
      spaceId: input.spaceId,
      userId: input.userId,
      botId: input.botId,
      name: "Check-in",
      prompt: checkInInstruction(),
      crons,
      timezone: input.timezone,
      active: true,
      quiet: true,
      managedKind: CHECK_IN_MANAGED_KIND,
      nextRunAt,
    },
  });
}
