import type { JobPublisher } from "@rakazo/adapter-kit";
import { routineWakeupJob, TransientModelError } from "@rakazo/adapter-kit";
import { nextCronDateAcross, nextRoutineRunDateAcross } from "@rakazo/core";
import type { Prisma, PrismaClient } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";

/** The first account-error failure holds the routine this long; each further one doubles it. */
const ROUTINE_ACCOUNT_BACKOFF_BASE_MS = 5 * 60_000;
const ROUTINE_ACCOUNT_BACKOFF_MAX_MS = 24 * 60 * 60_000;

interface RoutineBackoffDeps {
  prisma: PrismaClient;
  jobs: JobPublisher;
}

type RoutineSchedule = {
  active: boolean;
  crons: string[];
  timezone: string;
  watch: unknown;
  nextRunAt: Date | null;
  accountFailures: number;
};

/** A rejected or forbidden key, an exhausted balance or plan, or a model the account lacks. */
const ACCOUNT_REFUSAL =
  /\b40[123]\b|unauthori[sz]ed|invalid[_ ]api[_ ]key|incorrect api key|api key[^.]*(?:invalid|expired|revoked)|authentication[_ ]error|permission[_ ]denied|insufficient[_ ](?:quota|funds|credits?|balance)|exceeded your current quota|credit balance|out of credits|payment required|model[_ ]not[_ ]found/i;
/** Limits that clear on their own, or that name a date or window, are not an account to fix. */
const SELF_CLEARING =
  /rate.?limit|too many requests|resets? (?:at|on|in)|try again in|retry[- ]after|overload|timed? out|timeout|usage limit|daily limit|per[- ]minute/i;

/**
 * Whether the provider refused the account in a way that stays refused until the user acts.
 * Rate limits, timeouts and limits that reset on their own do not count. Reads the message
 * text, since runtimes often expose nothing else. Transient model errors never count.
 */
export function isModelAccountRefusal(error: unknown): boolean {
  if (error instanceof TransientModelError) return false;
  const message = error instanceof Error ? error.message : String(error);
  return ACCOUNT_REFUSAL.test(message) && !SELF_CLEARING.test(message);
}

export function routineAccountBackoffMs(failures: number): number {
  return Math.min(
    ROUTINE_ACCOUNT_BACKOFF_BASE_MS * 2 ** Math.max(0, failures - 1),
    ROUTINE_ACCOUNT_BACKOFF_MAX_MS,
  );
}

/**
 * A missing or refused model connection of the user's own fails every run the same way until
 * the user fixes it, so a frequent routine would keep firing against it. Push
 * its next run out by a gap that doubles with each such failure in a row.
 */
export async function backOffRoutineAfterAccountError(
  deps: RoutineBackoffDeps,
  routineId: string,
  now = new Date(),
): Promise<void> {
  await updateSchedule(deps, routineId, "routine.backoff", (routine) => {
    const accountFailures = routine.accountFailures + 1;
    if (!routine.active || !routine.nextRunAt) return { accountFailures };
    const resumeAt = new Date(now.getTime() + routineAccountBackoffMs(accountFailures));
    if (routine.nextRunAt >= resumeAt) return { accountFailures };
    // A timer routine keeps its cadence after the gap; a change trigger just checks again then.
    const nextRunAt =
      (routine.watch == null
        ? nextRoutineRunDateAcross(routine.crons, routine.nextRunAt, resumeAt, routine.timezone)
        : null) ?? resumeAt;
    return { accountFailures, nextRunAt };
  });
}

/**
 * A run of the routine got through, so its schedule returns to normal: a held timer routine
 * takes its next occurrence the way turning it back on would.
 */
export async function clearRoutineBackoff(
  deps: RoutineBackoffDeps,
  routineId: string,
  now = new Date(),
): Promise<void> {
  // Most completions have nothing to clear; skip the locked write for them. A failed read
  // here must never turn a completed run into a failed one.
  let held = 0;
  try {
    held = await deps.prisma.routine.count({
      where: { id: routineId, accountFailures: { gt: 0 } },
    });
  } catch (error) {
    getLogger().error("routine.backoff_clear", error);
    return;
  }
  if (held === 0) return;
  await updateSchedule(deps, routineId, "routine.backoff_clear", (routine) => {
    if (routine.accountFailures === 0) return null;
    if (!routine.active || !routine.nextRunAt || routine.watch != null) {
      return { accountFailures: 0 };
    }
    const nextRunAt = nextCronDateAcross(routine.crons, now, routine.timezone);
    return nextRunAt && nextRunAt < routine.nextRunAt
      ? { accountFailures: 0, nextRunAt }
      : { accountFailures: 0 };
  });
}

/**
 * Reads and writes the routine under its row lock, so a success and a failure of overlapping
 * runs cannot interleave and undo each other's schedule.
 */
async function updateSchedule(
  deps: RoutineBackoffDeps,
  routineId: string,
  logMessage: string,
  change: (routine: RoutineSchedule) => { accountFailures: number; nextRunAt?: Date } | null,
): Promise<void> {
  try {
    const nextRunAt = await deps.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.$queryRaw`SELECT id FROM routines WHERE id = ${routineId} FOR UPDATE`;
      const routine = await tx.routine.findUnique({
        where: { id: routineId },
        select: {
          active: true,
          crons: true,
          timezone: true,
          watch: true,
          nextRunAt: true,
          accountFailures: true,
        },
      });
      const data = routine ? change(routine) : null;
      if (!data) return null;
      await tx.routine.update({ where: { id: routineId }, data });
      return data.nextRunAt ?? null;
    });
    if (nextRunAt) await deps.jobs.enqueue(routineWakeupJob(routineId, nextRunAt));
  } catch (error) {
    getLogger().error(logMessage, error);
  }
}

/** How long routines skip a connection whose account ran out of credit before trying it again. */
// ponytail: fixed cool-down; count repeats and double it if hourly retries prove too noisy.
export const CONNECTION_CREDIT_PAUSE_MS = 60 * 60_000;

/** One owner's model connection in one space. */
export type ConnectionScope = { spaceId: string; userId: string; credentialId: string };

/**
 * The provider said the connection is out of credit. Routines on it in this space skip their
 * occurrences until the cool-down ends or a run on it gets through. Insert-or-extend in one
 * statement, so workers that hit the same refusal at once leave one row. `routineId` names the
 * routine whose run was refused, so its status shows the pause at once.
 */
export async function pauseConnectionForCredit(
  deps: { prisma: PrismaClient },
  scope: ConnectionScope,
  routineId?: string | null,
  now = new Date(),
): Promise<void> {
  const pausedUntil = new Date(now.getTime() + CONNECTION_CREDIT_PAUSE_MS);
  try {
    await deps.prisma.$executeRaw`
      INSERT INTO model_connection_pauses ("spaceId", "userId", "credentialId", "pausedUntil", "updatedAt")
      VALUES (${scope.spaceId}, ${scope.userId}, ${scope.credentialId}, ${pausedUntil}, ${now})
      ON CONFLICT ("spaceId", "userId", "credentialId") DO UPDATE
      SET "pausedUntil" = GREATEST(model_connection_pauses."pausedUntil", EXCLUDED."pausedUntil"),
          "updatedAt" = EXCLUDED."updatedAt"`;
    if (routineId) {
      await deps.prisma.routine.updateMany({
        where: { id: routineId, spaceId: scope.spaceId, userId: scope.userId },
        data: { pausedConnectionId: scope.credentialId },
      });
    }
  } catch (error) {
    getLogger().error("model_connection.credit_pause", error);
  }
}

/** A run on the connection got through, so its routines run again (their status clears too). */
export async function clearConnectionPause(
  deps: { prisma: PrismaClient },
  scope: ConnectionScope,
): Promise<void> {
  try {
    await deps.prisma.modelConnectionPause.deleteMany({ where: scope });
  } catch (error) {
    getLogger().error("model_connection.credit_pause_clear", error);
  }
}
