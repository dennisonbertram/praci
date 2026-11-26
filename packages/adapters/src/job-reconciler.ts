import type { JobPublisher } from "@rakazo/adapter-kit";
import {
  goalCheckJob,
  messagingDeliverJob,
  routineWakeupJob,
  runContinueJob,
} from "@rakazo/adapter-kit";
import type { MessageBlock } from "@rakazo/contracts";
import { stuckWorkStatusMessages } from "@rakazo/core";
import type { NotificationEvents, Pool, PrismaClient, ThreadEvents } from "@rakazo/db";
import { pruneApprovalDecisions, runAsSystem } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import type { PoolClient } from "pg";
import { returnBotMessageOutcome } from "./bot-messages.js";
import { scheduleComputerControlExpiry } from "./computer-control.js";
import { expireExternalActions, pruneMcpCallLog } from "./external-actions.js";
import { MAIL_APPROVAL_STALE_MS, reconcileMailApprovals } from "./mail-approval-recovery.js";
import { reconcileMailReplyBatches } from "./mail-reply-batch.js";
import { MESSAGING_SENDING_STALE_MS } from "./messaging-delivery.js";
import { notifyPastDueItems } from "./past-due.js";
import { reconcilePipelineImports } from "./pipeline-import-tools.js";
import { reconcileStuckWork } from "./stuck-work.js";
import { isLoopGuardStopText } from "./tool-loop.js";
import { isUserProgressClientNonce } from "./user-progress.js";

const DEFAULT_INTERVAL_MS = 30_000;
const DEFAULT_BATCH_SIZE = 100;
const ROUTINE_LOOKAHEAD_MS = 60_000;
const CONTROL_LOOKAHEAD_MS = 60_000;
/**
 * A queued run's job lock older than a run lease is abandoned. A live worker
 * finishing a failed attempt holds it for seconds before Graphile unlocks it.
 */
const ABANDONED_QUEUED_LOCK_MS = 5 * 60_000;
// Two keys give Praci's lock a namespace without relying on a hash that might collide
// with an application using the one-key advisory-lock API.
const RECONCILIATION_LOCK_NAMESPACE = 1_380_019_075;
const RECONCILIATION_LOCK_ID = 1;

type Cursor = { at: Date; id: string };
type ControlCursor = { at: Date | null; id: string };

export interface ReconciliationLeadership {
  tryAcquire(): Promise<boolean>;
  release(): Promise<void>;
}

/**
 * Holds a session advisory lock for the lifetime of the elected reconciler. Followers
 * retry on every reconciliation interval, so a disconnected or stopped leader is
 * replaced without coordinating through application state.
 */
export function createPostgresReconciliationLeadership(
  pool: Pick<Pool, "connect">,
  options: { lockId?: number } = {},
): ReconciliationLeadership {
  const lockId = options.lockId ?? RECONCILIATION_LOCK_ID;
  let leaderClient: PoolClient | undefined;
  let leaderErrorListener: (() => void) | undefined;

  const loseClient = (client: PoolClient) => {
    if (leaderClient !== client) return;
    leaderClient = undefined;
    leaderErrorListener = undefined;
    client.release(true);
  };

  return {
    async tryAcquire() {
      if (leaderClient) return true;

      const candidate = await pool.connect();
      try {
        const result = await candidate.query<{ acquired: boolean }>(
          "SELECT pg_try_advisory_lock($1::integer, $2::integer) AS acquired",
          [RECONCILIATION_LOCK_NAMESPACE, lockId],
        );
        if (!result.rows[0]?.acquired) {
          candidate.release();
          return false;
        }

        leaderClient = candidate;
        leaderErrorListener = () => loseClient(candidate);
        candidate.once("error", leaderErrorListener);
        return true;
      } catch (error) {
        candidate.release(true);
        throw error;
      }
    },

    async release() {
      const client = leaderClient;
      if (!client) return;
      leaderClient = undefined;
      if (leaderErrorListener) client.removeListener("error", leaderErrorListener);
      leaderErrorListener = undefined;

      let destroy = false;
      try {
        const result = await client.query<{ released: boolean }>(
          "SELECT pg_advisory_unlock($1::integer, $2::integer) AS released",
          [RECONCILIATION_LOCK_NAMESPACE, lockId],
        );
        destroy = result.rows[0]?.released !== true;
      } catch {
        // Never return a connection with an uncertain session lock to the pool.
        destroy = true;
      } finally {
        client.release(destroy);
      }
    },
  };
}

export function createJobReconciler(
  deps: {
    prisma: PrismaClient;
    jobs: JobPublisher;
    events?: ThreadEvents;
    notificationEvents?: NotificationEvents;
    leadership?: ReconciliationLeadership;
    reconcileComputerUpdates?: () => Promise<void>;
    reconcileCloudAgents?: () => Promise<void>;
    reconcileDataRoom?: () => Promise<unknown>;
    reconcileMeetings?: () => Promise<unknown>;
    reconcileCompanyImports?: () => Promise<void>;
    /** Deletes typed passwords held for teaching that nobody saved or skipped in time. */
    reconcileTeachHeldValues?: () => Promise<unknown>;
    /** Watch probes; the in-process mode has no Graphile cron, so the tick runs here. */
    runWatchProbes?: () => Promise<unknown>;
    /** Page source refreshes; the in-process mode has no Graphile cron, so the tick runs here. */
    runPageRefreshes?: () => Promise<unknown>;
    /** Tells the owner about routine retries whose job queue attempts ran out. */
    reconcileRoutineRetryNotices?: () => Promise<void>;
  },
  options: { intervalMs?: number; batchSize?: number } = {},
) {
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  let timer: ReturnType<typeof setInterval> | undefined;
  let reconciling: Promise<void> | undefined;
  let stuckCursor: Cursor | undefined;
  let runCursor: Cursor | undefined;
  let goalCursor: Cursor | undefined;
  let routineCursor: Cursor | undefined;
  let controlCursor: ControlCursor | undefined;
  let controlScanDeadline: Date | undefined;

  const reconcileOnce = async () => {
    if (reconciling) return reconciling;
    reconciling = (async () => {
      if (deps.leadership && !(await deps.leadership.tryAcquire())) return;

      const auxiliary = await Promise.allSettled(
        [
          deps.reconcileCloudAgents,
          deps.reconcileComputerUpdates,
          deps.reconcileDataRoom,
          deps.reconcileMeetings,
          deps.reconcileCompanyImports,
          deps.reconcileTeachHeldValues,
          deps.runWatchProbes,
          deps.runPageRefreshes,
          deps.reconcileRoutineRetryNotices,
        ].map(async (reconcile) => reconcile?.()),
      );
      for (const result of auxiliary) {
        if (result.status === "rejected")
          getLogger().error("auxiliary reconciliation", result.reason);
      }

      const now = new Date();
      try {
        stuckCursor = await reconcileStuckWork({
          prisma: deps.prisma,
          jobs: deps.jobs,
          events: deps.events,
          notificationEvents: deps.notificationEvents,
          now,
          batchSize,
          cursor: stuckCursor,
        });
      } catch (error) {
        getLogger().error("stuck work reconciliation", error);
      }
      try {
        await notifyPastDueItems({
          prisma: deps.prisma,
          notificationEvents: deps.notificationEvents,
          now,
        });
      } catch (error) {
        getLogger().error("past-due reconciliation", error);
      }
      try {
        await expireExternalActions(deps.prisma, now);
      } catch (error) {
        getLogger().error("external action expiry", error);
      }
      try {
        await pruneMcpCallLog(deps.prisma, now);
      } catch (error) {
        getLogger().error("mcp call log retention", error);
      }
      try {
        await runAsSystem("prune approval decisions", () =>
          pruneApprovalDecisions(deps.prisma, now),
        );
      } catch (error) {
        getLogger().error("approval decision retention", error);
      }
      if (deps.events) {
        try {
          await reconcileMailApprovals({
            prisma: deps.prisma,
            events: deps.events,
            now,
            batchSize,
          });
        } catch (error) {
          getLogger().error("mail approval reconciliation", error);
        }
        try {
          await reconcileMailReplyBatches({
            prisma: deps.prisma,
            jobs: deps.jobs,
            events: deps.events,
            now,
            batchSize,
          });
        } catch (error) {
          getLogger().error("mail reply batch reconciliation", error);
        }
      }
      try {
        goalCursor = await reconcileGoalChecks(deps.prisma, deps.jobs, batchSize, goalCursor);
      } catch (error) {
        getLogger().error("goal check reconciliation", error);
      }
      try {
        await reconcilePipelineImports({
          prisma: deps.prisma,
          jobs: deps.jobs,
          now,
          batchSize,
          staleMs: MAIL_APPROVAL_STALE_MS,
        });
      } catch (error) {
        getLogger().error("pipeline import reconciliation", error);
      }
      controlScanDeadline ??= new Date(now.getTime() + CONTROL_LOOKAHEAD_MS);
      const runCursorFilter = runCursor
        ? {
            OR: [
              { updatedAt: { gt: runCursor.at } },
              { updatedAt: runCursor.at, id: { gt: runCursor.id } },
            ],
          }
        : undefined;
      const routineCursorFilter = routineCursor
        ? {
            OR: [
              { nextRunAt: { gt: routineCursor.at } },
              { nextRunAt: routineCursor.at, id: { gt: routineCursor.id } },
            ],
          }
        : undefined;
      const controlCursorFilter = controlCursor
        ? controlCursor.at
          ? {
              OR: [
                { controlLeaseExpiresAt: { gt: controlCursor.at } },
                {
                  controlLeaseExpiresAt: controlCursor.at,
                  id: { gt: controlCursor.id },
                },
                { controlLeaseExpiresAt: null },
              ],
            }
          : { controlLeaseExpiresAt: null, id: { gt: controlCursor.id } }
        : undefined;
      const [runs, routines, controls, dueOutbound, unmirroredMessagingRuns] = await Promise.all([
        deps.prisma.run.findMany({
          where: {
            AND: [
              {
                OR: [
                  { status: "queued" },
                  {
                    status: { in: ["leased", "running"] },
                    leaseExpiresAt: { lte: now },
                  },
                ],
              },
              ...(runCursorFilter ? [runCursorFilter] : []),
            ],
          },
          orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
          take: batchSize,
          select: { id: true, status: true, updatedAt: true },
        }),
        deps.prisma.routine.findMany({
          where: {
            AND: [
              {
                active: true,
                nextRunAt: { lte: new Date(now.getTime() + ROUTINE_LOOKAHEAD_MS) },
              },
              ...(routineCursorFilter ? [routineCursorFilter] : []),
            ],
          },
          orderBy: [{ nextRunAt: "asc" }, { id: "asc" }],
          take: batchSize,
          select: { id: true, nextRunAt: true },
        }),
        deps.prisma.computer.findMany({
          where: {
            AND: [
              { controlLeaseId: { not: null } },
              {
                OR: [
                  { controlLeaseExpiresAt: null },
                  {
                    controlLeaseExpiresAt: {
                      lte: controlScanDeadline,
                    },
                  },
                ],
              },
              ...(controlCursorFilter ? [controlCursorFilter] : []),
            ],
          },
          orderBy: [{ controlLeaseExpiresAt: "asc" }, { id: "asc" }],
          take: batchSize,
          select: {
            id: true,
            controlBotId: true,
            controlLeaseId: true,
            controlLeaseExpiresAt: true,
          },
        }),
        deps.prisma.messagingOutbound.findFirst({
          where: {
            OR: [
              {
                status: "pending",
                OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
              },
              {
                status: "sending",
                updatedAt: { lt: new Date(now.getTime() - MESSAGING_SENDING_STALE_MS) },
              },
            ],
          },
          select: { id: true },
        }),
        deps.prisma.run.findMany({
          where: { trigger: "messaging", status: "completed", messagingMirroredAt: null },
          orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
          take: batchSize,
          select: { id: true },
        }),
      ]);

      const events = deps.events;
      if (events) {
        const outcomes = await deps.prisma.run.findMany({
          where: {
            trigger: "bot_message",
            botOutcomeReturnedAt: null,
            OR: [
              { status: { in: ["completed", "failed"] } },
              { status: "cancelled", error: { in: [...stuckWorkStatusMessages()] } },
            ],
          },
          orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
          take: batchSize,
          select: {
            id: true,
            spaceId: true,
            threadId: true,
            botId: true,
            userId: true,
            sourceMessageId: true,
            status: true,
            error: true,
            bot: { select: { name: true } },
          },
        });
        await Promise.all(
          outcomes.map(async (run) => {
            const stuckCancel = run.status === "cancelled";
            const transcript =
              run.status === "failed" || stuckCancel
                ? { text: "", progressOnly: false }
                : await botRunOutcomeText(deps.prisma, run.id);
            const text = stuckCancel
              ? (run.error ?? "")
              : run.status === "failed"
                ? `Could not complete the delegated request: ${run.error ?? "unknown error"}`
                : transcript.text ||
                  "The delegated bot completed its turn without a written summary.";
            // Loop-guard stops complete without an error; their persisted final text
            // is the only marker available when the executor's outcome delivery fails.
            const loopGuardStop = isLoopGuardStopText(transcript.text);
            // Same stable delivery key as the executor path (auto-outcome:<runId>), so a
            // concurrent or earlier return is replayed instead of double-posted. Progress-only
            // transcripts (all mid-turn user-progress messages) return as status.
            const intent =
              run.status === "failed" ||
              stuckCancel ||
              !transcript.text.trim() ||
              transcript.progressOnly
                ? "status"
                : ("result" as const);
            const returned = await returnBotMessageOutcome(
              { prisma: deps.prisma, jobs: deps.jobs, events },
              run,
              { id: run.botId, name: run.bot.name },
              text,
              intent,
              { forceUnread: run.status === "failed" || stuckCancel || loopGuardStop },
            ).catch((error) => {
              getLogger().error("bot message outcome reconciliation", error);
              return false;
            });
            if (!returned) {
              await deps.prisma.run.updateMany({
                where: { id: run.id, botOutcomeReturnedAt: null },
                data: { updatedAt: new Date() },
              });
            }
          }),
        );
      }

      // A queued run already has a job while it waits out failure backoff.
      // Default replace would zero that job's attempts and run it now. keepExisting
      // leaves the job while attempts remain, and still replaces one that is exhausted.
      // A locked job whose worker died is never unlocked, so it is replaced: any lock
      // for a run whose lease expired, and for a queued run only a lock older than
      // a lease, since a live worker finishing a failed attempt still holds it.
      const abandonedQueuedLockAt = new Date(now.getTime() - ABANDONED_QUEUED_LOCK_MS);
      await Promise.all([
        ...runs.map((run) =>
          deps.jobs.enqueue({
            ...runContinueJob(run.id),
            keepExisting: true,
            replaceLockedBefore: run.status === "queued" ? abandonedQueuedLockAt : now,
          }),
        ),
        ...routines.flatMap((routine) =>
          routine.nextRunAt
            ? [deps.jobs.enqueue(routineWakeupJob(routine.id, routine.nextRunAt))]
            : [],
        ),
        ...controls.flatMap((computer) =>
          computer.controlLeaseId
            ? [
                scheduleComputerControlExpiry(
                  deps.jobs,
                  computer.id,
                  computer.controlLeaseId,
                  computer.controlLeaseExpiresAt ?? now,
                ),
              ]
            : [],
        ),
        ...(dueOutbound ? [deps.jobs.enqueue(messagingDeliverJob())] : []),
        ...unmirroredMessagingRuns.map((run) => deps.jobs.enqueue(messagingDeliverJob(run.id))),
      ]);

      const lastRun = runs.at(-1);
      runCursor =
        runs.length === batchSize && lastRun
          ? { at: lastRun.updatedAt, id: lastRun.id }
          : undefined;
      const lastRoutine = routines.at(-1);
      routineCursor =
        routines.length === batchSize && lastRoutine?.nextRunAt
          ? { at: lastRoutine.nextRunAt, id: lastRoutine.id }
          : undefined;
      const lastControl = controls.at(-1);
      controlCursor =
        controls.length === batchSize && lastControl
          ? { at: lastControl.controlLeaseExpiresAt, id: lastControl.id }
          : undefined;
      if (!controlCursor) controlScanDeadline = undefined;
    })().finally(() => {
      reconciling = undefined;
    });
    return reconciling;
  };
  const reconcileSafely = () => {
    void reconcileOnce().catch((error) =>
      getLogger().error("background job reconciliation", error),
    );
  };

  return {
    reconcileOnce,
    start() {
      if (timer) return;
      reconcileSafely();
      timer = setInterval(reconcileSafely, intervalMs);
      timer.unref?.();
    },
    async stop() {
      if (timer) clearInterval(timer);
      timer = undefined;
      await reconciling?.catch(() => undefined);
      await deps.leadership?.release();
    },
  };
}

/**
 * An active goal whose newest goal run ended without a check (the worker died between finalize and
 * the enqueue) gets one. Only goals with no live run on the thread: a live run enqueues its own.
 */
async function reconcileGoalChecks(
  prisma: PrismaClient,
  jobs: JobPublisher,
  batchSize: number,
  cursor: Cursor | undefined,
): Promise<Cursor | undefined> {
  const goals = await prisma.threadGoal.findMany({
    where: {
      status: "active",
      NOT: {
        thread: {
          runs: {
            some: {
              status: { in: ["queued", "leased", "running", "waiting_input", "waiting_takeover"] },
            },
          },
        },
      },
      ...(cursor
        ? {
            OR: [{ updatedAt: { gt: cursor.at } }, { updatedAt: cursor.at, id: { gt: cursor.id } }],
          }
        : {}),
    },
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    take: batchSize,
    select: {
      id: true,
      updatedAt: true,
      lastCheckedRunId: true,
      runs: {
        where: { status: { in: ["completed", "failed", "cancelled"] } },
        orderBy: { completedAt: "desc" },
        take: 1,
        select: { id: true },
      },
    },
  });
  await Promise.all(
    goals.flatMap((goal) => {
      const newest = goal.runs[0];
      return newest && newest.id !== goal.lastCheckedRunId
        ? [jobs.enqueue({ ...goalCheckJob(goal.id, newest.id), keepExisting: true })]
        : [];
    }),
  );
  const last = goals.at(-1);
  return goals.length === batchSize && last ? { at: last.updatedAt, id: last.id } : undefined;
}

/** Prefer the full bot transcript for a run so interim progress is not mistaken for the sole result. */
async function botRunOutcomeText(
  prisma: {
    message: {
      findMany: (args: {
        where: { runId: string; role: "bot" };
        orderBy: { seq: "asc" };
        select: { blocks: true; clientNonce: true };
      }) => Promise<Array<{ blocks: unknown; clientNonce: string | null }>>;
    };
  },
  runId: string,
): Promise<{ text: string; progressOnly: boolean }> {
  const messages = await prisma.message.findMany({
    where: { runId, role: "bot" },
    orderBy: { seq: "asc" },
    select: { blocks: true, clientNonce: true },
  });
  const progressParts: string[] = [];
  const finalParts: string[] = [];
  for (const message of messages) {
    const text = messageText(message.blocks);
    if (!text) continue;
    if (isUserProgressClientNonce(message.clientNonce)) progressParts.push(text);
    else finalParts.push(text);
  }
  // Prefer the latest non-progress reply when present so earlier untagged mid-run
  // publishes (for example pre-takeover narration) do not contaminate the result.
  // Progress-only turns still join progress beats as status.
  if (finalParts.length > 0) {
    return { text: finalParts[finalParts.length - 1]!, progressOnly: false };
  }
  return { text: progressParts.join("\n\n"), progressOnly: progressParts.length > 0 };
}

function messageText(blocks: unknown): string {
  if (!Array.isArray(blocks)) return "";
  return (blocks as MessageBlock[])
    .filter((block): block is Extract<MessageBlock, { kind: "text" }> => block.kind === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}
