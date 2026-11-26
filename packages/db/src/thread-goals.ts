import type { MessageBlock, ThreadGoal } from "@rakazo/contracts";
import type { GoalCheckRun, GoalEnd, GoalStep, GoalVerdict } from "@rakazo/core";
import {
  blocksToAgentHistoryText,
  goalContinuationPrompt,
  goalEnd,
  goalStep,
  newRunExternalTaint,
  newRunUnattended,
  parseGoalEvidence,
} from "@rakazo/core";
import type { Prisma, PrismaClient } from "./client.js";
import { appendEventInTransaction } from "./events.js";
import { createThreadMessageInTransaction } from "./messages.js";

/** Every goal query is scoped to the Space and the owning user; the thread belongs to a bot. */
export type GoalScope = { spaceId: string; userId: string; threadId: string; botId: string };

type GoalRow = Awaited<ReturnType<Prisma.TransactionClient["threadGoal"]["findFirstOrThrow"]>>;

const OPEN = ["active", "paused"];

/** What clients see: only an open goal; an ended one is null. */
export function threadGoalView(row: GoalRow | null | undefined): ThreadGoal | null {
  if (!row || !OPEN.includes(row.status)) return null;
  const verdict = row.lastVerdict as { reason?: unknown } | null;
  return {
    id: row.id,
    text: row.text,
    status: row.status as ThreadGoal["status"],
    stopReason: row.stopReason as ThreadGoal["stopReason"],
    lastReason: typeof verdict?.reason === "string" ? verdict.reason : null,
    continuations: row.continuations,
    startedAt: row.startedAt.toISOString(),
  };
}

export function findOpenGoal(
  tx: Pick<Prisma.TransactionClient, "threadGoal">,
  scope: Pick<GoalScope, "spaceId" | "userId" | "threadId">,
) {
  return tx.threadGoal.findFirst({
    where: {
      spaceId: scope.spaceId,
      userId: scope.userId,
      threadId: scope.threadId,
      status: { in: OPEN },
    },
  });
}

async function emitGoal(tx: Prisma.TransactionClient, scope: GoalScope, row: GoalRow) {
  const event = await appendEventInTransaction(tx, {
    spaceId: scope.spaceId,
    threadId: scope.threadId,
    botId: scope.botId,
    type: "thread.goal.updated",
    payload: { goal: threadGoalView(row) },
  });
  return event.seq;
}

/** Changes the open goal if it is in one of `from`, and tells clients. Returns the event seq, or null when nothing changed. */
async function changeOpenGoal(
  tx: Prisma.TransactionClient,
  scope: GoalScope,
  from: string[],
  data: Prisma.ThreadGoalUpdateInput,
) {
  const goal = await findOpenGoal(tx, scope);
  if (!goal || !from.includes(goal.status)) return null;
  return emitGoal(tx, scope, await tx.threadGoal.update({ where: { id: goal.id }, data }));
}

export const clearOpenGoal = (tx: Prisma.TransactionClient, scope: GoalScope) =>
  changeOpenGoal(tx, scope, OPEN, { status: "cleared", endedAt: new Date() });

export const pauseActiveGoal = (tx: Prisma.TransactionClient, scope: GoalScope) =>
  changeOpenGoal(tx, scope, ["active"], { status: "paused", stopReason: "owner" });

/** The owner's next message resumes a paused goal with fresh limits. */
export const resumePausedGoal = (tx: Prisma.TransactionClient, scope: GoalScope) =>
  changeOpenGoal(tx, scope, ["paused"], {
    status: "active",
    stopReason: null,
    startedAt: new Date(),
    continuations: 0,
    stalls: 0,
  });

/** Ends any open goal as cleared and opens a new active one. The caller holds the thread lock or runs serializable. */
export async function startGoal(tx: Prisma.TransactionClient, scope: GoalScope, text: string) {
  await tx.threadGoal.updateMany({
    where: {
      spaceId: scope.spaceId,
      userId: scope.userId,
      threadId: scope.threadId,
      status: { in: OPEN },
    },
    data: { status: "cleared", endedAt: new Date() },
  });
  const goal = await tx.threadGoal.create({
    data: {
      spaceId: scope.spaceId,
      userId: scope.userId,
      threadId: scope.threadId,
      botId: scope.botId,
      text,
      status: "active",
    },
  });
  return { goal, seq: await emitGoal(tx, scope, goal) };
}

// ---- The goal check -----------------------------------------------------------------------

const LIVE_RUN_STATUSES = ["queued", "leased", "running", "waiting_input", "waiting_takeover"];

/** The goal and the ended run a check would judge; null when there is nothing to judge. */
export async function loadGoalToCheck(
  prisma: PrismaClient,
  input: { goalId: string; runId: string },
) {
  const goal = await prisma.threadGoal.findFirst({ where: { id: input.goalId, status: "active" } });
  if (!goal || goal.lastCheckedRunId === input.runId) return null;
  // A newer run supersedes this one, so there is nothing left to judge.
  const newest = await prisma.run.findFirst({
    where: { goalId: goal.id, spaceId: goal.spaceId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true },
  });
  if (newest?.id !== input.runId) return null;
  const run = await prisma.run.findFirst({
    where: {
      id: input.runId,
      goalId: goal.id,
      spaceId: goal.spaceId,
      userId: goal.userId,
      threadId: goal.threadId,
    },
  });
  return run ? { goal, run } : null;
}

export async function threadHasLiveRun(
  prisma: Pick<PrismaClient, "run">,
  goal: Pick<GoalRow, "threadId" | "botId">,
) {
  const live = await prisma.run.findFirst({
    where: { threadId: goal.threadId, botId: goal.botId, status: { in: LIVE_RUN_STATUSES } },
    select: { id: true },
  });
  return live !== null;
}

/** What the goal check reads: the goal's last 5 ended runs with their evidence, the work list, the last reply. */
export async function loadGoalCheckInput(prisma: PrismaClient, goal: GoalRow, judgedRunId: string) {
  const [recent, items, reply] = await Promise.all([
    prisma.run.findMany({
      where: {
        goalId: goal.id,
        spaceId: goal.spaceId,
        status: { in: ["completed", "failed", "cancelled"] },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, status: true, error: true, goalEvidence: true },
    }),
    prisma.scratchpadItem.findMany({
      where: { spaceId: goal.spaceId, userId: goal.userId, botId: goal.botId },
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: { title: true, status: true, notes: true },
    }),
    prisma.message.findFirst({
      where: { threadId: goal.threadId, runId: judgedRunId, role: "bot" },
      orderBy: { seq: "desc" },
      select: { blocks: true },
    }),
  ]);
  const runs: Array<GoalCheckRun & { id: string }> = recent.reverse().map((run) => ({
    id: run.id,
    status: run.status,
    error: run.error,
    evidence: parseGoalEvidence(run.goalEvidence),
  }));
  return {
    runs,
    workItems: items,
    lastReply: reply ? blocksToAgentHistoryText(reply.blocks as MessageBlock[]) : "",
  };
}

/**
 * The goal's runs and every run they caused, in the goal's Space: sub-agents (a message in the
 * sub-agent's thread written by the parent run), group handoffs (the run's source message came from
 * the parent run) and bot messages (the received message answers a message the parent run wrote).
 * Bounded at depth 5 and 300 runs.
 */
async function goalRunTreeIds(prisma: Pick<PrismaClient, "$queryRaw">, goal: GoalRow) {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    WITH RECURSIVE tree(id, depth) AS (
      SELECT r.id, 0 FROM runs r WHERE r."goalId" = ${goal.id} AND r."spaceId" = ${goal.spaceId}
      UNION
      SELECT child.id, tree.depth + 1
      FROM tree
      JOIN LATERAL (
        SELECT r.id FROM runs r JOIN messages m ON m.id = r."sourceMessageId"
          WHERE m."runId" = tree.id AND r."spaceId" = ${goal.spaceId}
        UNION
        SELECT r.id FROM messages o
          JOIN messages i ON i.blocks @> jsonb_build_array(jsonb_build_object('returnToMessageId', o.id))
          JOIN runs r ON r."sourceMessageId" = i.id
          WHERE o."runId" = tree.id AND r."spaceId" = ${goal.spaceId}
        UNION
        SELECT r.id FROM runs r JOIN messages m ON m."threadId" = r."threadId"
          WHERE r.trigger = 'spawn' AND m."runId" = tree.id AND m.role = 'user'
            AND r."spaceId" = ${goal.spaceId}
      ) child ON true
      WHERE tree.depth < 5
    )
    SELECT DISTINCT id FROM tree LIMIT 300`;
  return rows.map((row) => row.id);
}

/** Cost of the goal's runs and the runs they caused since it last started, plus the goal checks recorded against them. A null cost counts as 0. */
export async function goalSpendUsd(prisma: PrismaClient, goal: GoalRow): Promise<number> {
  const ids = await goalRunTreeIds(prisma, goal);
  if (ids.length === 0) return 0;
  const total = await prisma.usageRecord.aggregate({
    _sum: { costUsd: true },
    where: {
      spaceId: goal.spaceId,
      userId: goal.userId,
      createdAt: { gte: goal.startedAt },
      OR: [{ runId: { in: ids } }, { parentRunId: { in: ids } }],
    },
  });
  return total._sum.costUsd ?? 0;
}

const lockThread = (tx: Prisma.TransactionClient, threadId: string) =>
  tx.$queryRaw`SELECT id FROM threads WHERE id = ${threadId} FOR UPDATE`;

/**
 * Under the thread lock that send, finalize and stop use: the goal is still active at the version
 * the check read, the judged run is the newest run of the goal (and not judged yet), and no run is
 * live. Anything else means a newer run, the owner or another worker got there first, and the
 * check's result is dropped.
 */
async function checkStillOpen(
  tx: Prisma.TransactionClient,
  input: { goalId: string; runId: string; threadId: string; version: Date },
) {
  await lockThread(tx, input.threadId);
  const goal = await tx.threadGoal.findFirst({ where: { id: input.goalId, status: "active" } });
  if (!goal || goal.lastCheckedRunId === input.runId) return null;
  if (goal.updatedAt.getTime() !== input.version.getTime()) return null;
  const newest = await tx.run.findFirst({
    where: { goalId: goal.id, spaceId: goal.spaceId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true },
  });
  if (newest?.id !== input.runId) return null;
  if (await threadHasLiveRun(tx, goal)) return null;
  return goal;
}

/** Pauses an active goal without a verdict: its last run was cancelled, or the check cannot run. */
export async function pauseGoalAfterCheck(
  prisma: PrismaClient,
  input: {
    goalId: string;
    runId: string;
    /** The goal's `updatedAt` as the check read it. */
    version: Date;
    stopReason: "owner" | "check_failed" | "model_error";
    /**
     * Runs inside the pause's transaction: a write here commits with the pause, or not at all. It may
     * return a thunk, which runs only once the pause is committed, for side effects that observers
     * must not see before the row they describe.
     */
    inside?: (tx: Prisma.TransactionClient) => Promise<(() => Promise<void>) | null | void>;
  },
) {
  const found = await prisma.threadGoal.findUnique({
    where: { id: input.goalId },
    select: { threadId: true },
  });
  if (!found) return null;
  const after: (() => Promise<void>)[] = [];
  const paused = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const goal = await checkStillOpen(tx, { ...input, threadId: found.threadId });
    if (!goal) return null;
    const row = await tx.threadGoal.update({
      where: { id: goal.id },
      data: { status: "paused", stopReason: input.stopReason, lastCheckedRunId: input.runId },
    });
    const deferred = await input.inside?.(tx);
    if (deferred) after.push(deferred);
    return { threadId: goal.threadId, seq: await emitGoal(tx, goal, row) };
  });
  // Only after the commit: a signal sent earlier reaches subscribers before the row they fetch.
  if (paused) for (const deferred of after) await deferred();
  return paused;
}

export type GoalCheckOutcome =
  | { kind: "skipped" }
  | { kind: "continued"; threadId: string; seq: number; runId: string }
  | { kind: "ended"; threadId: string; seq: number; end: GoalEnd };

/**
 * Writes a verdict. In one transaction under the thread lock it re-checks that the goal is open,
 * then either creates the continuation run (trigger `goal`, the mode of a run the owner's message
 * starts) or ends the goal with one `goal` message. The caller enqueues `run.continue` and tells
 * realtime after the commit.
 */
export async function commitGoalVerdict(
  prisma: PrismaClient,
  input: {
    goalId: string;
    judged: { id: string; failed: boolean; madeProgress: boolean };
    /** The goal's `updatedAt` as the check read it; a changed goal drops the verdict. */
    version: Date;
    /** The runs whose evidence the check read; the continuation inherits their restrictions. */
    readRunIds?: string[];
    verdict: GoalVerdict;
    /** The judged run failed because the model connection cannot run: the goal ends, whatever the verdict. */
    modelError?: boolean;
    spendUsd: number;
    now: Date;
    /** What the cited evidence said, for the end block. */
    evidenceText: Record<string, string>;
  },
): Promise<GoalCheckOutcome> {
  const found = await prisma.threadGoal.findUnique({
    where: { id: input.goalId },
    select: { threadId: true },
  });
  if (!found) return { kind: "skipped" };
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const goal = await checkStillOpen(tx, {
      goalId: input.goalId,
      runId: input.judged.id,
      threadId: found.threadId,
      version: input.version,
    });
    if (!goal) return { kind: "skipped" } as const;
    const step: GoalStep = input.modelError
      ? { kind: "stopped", stalls: goal.stalls + 1, limit: "model_error" }
      : goalStep({
          verdict: input.verdict.verdict,
          runFailed: input.judged.failed,
          madeProgress: input.judged.madeProgress,
          continuations: goal.continuations,
          stalls: goal.stalls,
          startedAt: goal.startedAt,
          now: input.now,
          spendUsd: input.spendUsd,
        });
    const verdictJson = { ...input.verdict } as Prisma.InputJsonObject;
    const common = {
      lastCheckedRunId: input.judged.id,
      lastVerdict: verdictJson,
      stalls: step.stalls,
    };

    if (step.kind === "continue") {
      const judged = await tx.run.findUniqueOrThrow({
        where: { id: input.judged.id },
        select: {
          modelPinned: true,
          modelProvider: true,
          modelId: true,
          modelCredentialId: true,
          thinkingLevel: true,
        },
      });
      // The check read these runs' tool results, which outside content can shape, so the
      // continuation keeps the strictest restriction of any of them. Whether a run read
      // outside content is the run's readOutsideContent column, written when it was set, not
      // inferred from the capped tool log, which trims.
      const read = await tx.run.findMany({
        where: {
          id: { in: [input.judged.id, ...(input.readRunIds ?? [])] },
          goalId: goal.id,
          spaceId: goal.spaceId,
        },
        select: {
          unattended: true,
          externalTaint: true,
          readOutsideContent: true,
          readDesktop: true,
        },
      });
      const sawOutsideContent = read.some(
        (run) => run.externalTaint || run.readOutsideContent || run.readDesktop,
      );
      const row = await tx.threadGoal.update({
        where: { id: goal.id },
        data: { ...common, continuations: { increment: 1 } },
      });
      const task = await tx.task.create({
        data: {
          spaceId: goal.spaceId,
          botId: goal.botId,
          threadId: goal.threadId,
          userId: goal.userId,
          prompt: goalContinuationPrompt({ reason: input.verdict.reason, text: goal.text }),
          status: "queued",
        },
      });
      const run = await tx.run.create({
        data: {
          spaceId: goal.spaceId,
          botId: goal.botId,
          threadId: goal.threadId,
          taskId: task.id,
          userId: goal.userId,
          status: "queued",
          trigger: "goal",
          unattended: newRunUnattended({ trigger: "goal" }) || read.some((run) => run.unattended),
          externalTaint: newRunExternalTaint({ trigger: "goal" }) || sawOutsideContent,
          goalId: goal.id,
          // A model the owner pinned for the run stays pinned; otherwise the bot's own connection is resolved when it runs, as for a message.
          ...(judged.modelPinned
            ? {
                modelProvider: judged.modelProvider,
                modelId: judged.modelId,
                modelCredentialId: judged.modelCredentialId,
                thinkingLevel: judged.thinkingLevel,
                modelPinned: true,
              }
            : {}),
        },
      });
      return {
        kind: "continued",
        threadId: goal.threadId,
        seq: await emitGoal(tx, goal, row),
        runId: run.id,
      } as const;
    }

    const end = goalEnd(step, input.verdict);
    const status = end.outcome;
    const row = await tx.threadGoal.update({
      where: { id: goal.id },
      data: {
        ...common,
        status,
        endedAt: input.now,
        stopReason:
          step.kind === "stopped"
            ? step.limit
            : step.kind === "blocked" && step.stalled
              ? "stalled"
              : null,
      },
    });
    const evidence =
      end.outcome === "met"
        ? input.verdict.evidence.map((id) => ({ id, text: input.evidenceText[id] ?? "" }))
        : undefined;
    const blocks: MessageBlock[] = [
      {
        kind: "goal",
        outcome: end.outcome,
        reason: end.reason,
        ...(evidence ? { evidence } : {}),
        text: end.text,
      },
    ];
    const message = await createThreadMessageInTransaction(tx, {
      threadId: goal.threadId,
      role: "bot",
      blocks,
      botId: goal.botId,
    });
    await appendEventInTransaction(tx, {
      spaceId: goal.spaceId,
      threadId: goal.threadId,
      botId: goal.botId,
      type: "thread.message.created",
      payload: { messageId: message.id, role: "bot", blocks },
    });
    return {
      kind: "ended",
      threadId: goal.threadId,
      seq: await emitGoal(tx, goal, row),
      end,
    } as const;
  });
}
