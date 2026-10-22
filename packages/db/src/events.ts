import type { RealtimeFanout } from "@rakazo/adapter-kit";
import type {
  BotSecretDestination,
  MailApproval,
  MessageBlock,
  ProductEvent,
} from "@rakazo/contracts";
import { MessageBlock as MessageBlockSchema } from "@rakazo/contracts";
import {
  callIdFromClientNonce,
  isApprovalAskBlock,
  isConversationalRun,
  sanitizeJsonValue,
} from "@rakazo/core";
import { getLogger } from "@rakazo/logging";
import { cancelRunsInTransaction } from "./cancel-runs.js";
import type { Prisma, PrismaClient } from "./client.js";
import { expireComputerExecutionLeases } from "./computers.js";
import {
  assertRunCanWriteHistory,
  assertRunIsCancelled,
  createThreadMessageInTransaction,
} from "./messages.js";
import { finalizeRun } from "./run-finalize.js";
import {
  answerRunInput,
  answerWaitingRunWithTextInTransaction,
  pauseRunForInput,
  pauseRunForTakeover,
} from "./run-pauses.js";
import { claimSteering } from "./steering.js";
import { withTransactionRetry } from "./transaction-retry.js";

export { completedRunBlocks, finalizeRun } from "./run-finalize.js";
export { createPendingSteeringRun } from "./steering.js";
export {
  answerRunInput,
  answerWaitingRunWithTextInTransaction,
  claimSteering,
  pauseRunForInput,
  pauseRunForTakeover,
};

const EVENT_BATCH_SIZE = 200;
const PUSH_CATCH_UP_MS = 30_000;
const POLL_ONLY_CATCH_UP_MS = 400;

export interface AppendEventInput {
  spaceId: string;
  threadId: string;
  botId: string;
  type: ProductEvent["type"];
  payload: Record<string, unknown>;
  runId?: string;
  /** Terminal echo after the run is already cancelled. Every other event stays rejected. */
  allowCancelledRun?: boolean;
}

export interface ThreadEvents {
  answerRunInput(input: AnswerRunInput): Promise<boolean>;
  findMailApprovalForEdit(input: FindMailApprovalInput): Promise<PendingMailApproval | null>;
  setMailApprovalOutcome(input: SetMailApprovalOutcomeInput): Promise<void>;
  setApprovalWaitsFor(input: SetApprovalWaitsForInput): Promise<void>;
  append(input: AppendEventInput): Promise<ProductEvent>;
  claimSteering(input: ClaimSteeringInput): Promise<ClaimedSteeringMessage[]>;
  clearThread(input: ClearThreadInput): Promise<ClearThreadResult>;
  finalizeComputerControlRelease(
    input: FinalizeComputerControlReleaseInput,
  ): Promise<FinalizeComputerControlReleaseResult | false>;
  finalizeRun(input: FinalizeRunInput): Promise<FinalizeRunResult | false>;
  notify(threadId: string, seq: number): Promise<void>;
  pauseRunForInput(input: PauseRunForInput): Promise<boolean>;
  pauseRunForTakeover(input: PauseRunForTakeover): Promise<boolean>;
  sendUserMessage(input: SendUserMessageInput): Promise<SendUserMessageResult>;
  follow(threadId: string, cursor: number, signal?: AbortSignal): AsyncGenerator<ProductEvent>;
}

export interface ClearThreadInput {
  spaceId: string;
  threadId: string;
  /** Event author and the bot-scoped target for one-to-one chats. */
  botId: string;
  groupId?: string;
}

export interface ClearThreadResult {
  event: ProductEvent;
  cancelledRunIds: string[];
  historyCompactionGeneration: number;
}

export interface FinalizeComputerControlReleaseInput {
  spaceId: string;
  computerId: string;
  botId: string;
  runId: string | null;
  leaseId: string;
  holder: "bot" | "none";
  reason: "done" | "expired" | "released" | "skipped";
}

export interface FinalizeComputerControlReleaseResult {
  runId: string | null;
}

export interface ClaimSteeringInput {
  threadId: string;
  botId: string;
  runId: string;
  leaseOwner: string;
  leaseFence: number;
  seenIds: string[];
  /** Leave messages that carry the external-chain mark unclaimed. */
  excludeExternalOrigin?: boolean;
}

export interface ClaimedSteeringMessage {
  id: string;
  messageId: string;
  text: string;
  blocks: MessageBlock[];
}

export interface FinalizeRunResult {
  continuationRunId: string | null;
}

interface FinalizeRunBase {
  spaceId: string;
  threadId: string;
  botId: string;
  runId: string;
  taskId: string;
  attemptId: string;
  leaseOwner: string;
  leaseFence: number;
}

export type FinalizeRunInput = FinalizeRunBase &
  (
    | {
        outcome: "completed";
        blocks: MessageBlock[];
        markUnread?: boolean;
      }
    | { outcome: "failed"; error: string }
  );

export interface PauseRunForInput {
  spaceId: string;
  threadId: string;
  botId: string;
  runId: string;
  attemptId: string;
  leaseOwner: string;
  leaseFence: number;
  blocks: MessageBlock[];
  /**
   * Unredacted choice actions for resume. Persisted only on the run checkpoint
   * (not in message blocks) so clients still see redacted labels.
   */
  offeredActions?: Array<{ id: string; label: string }>;
}

export interface PauseRunForTakeover {
  spaceId: string;
  threadId: string;
  botId: string;
  runId: string;
  attemptId: string;
  leaseOwner: string;
  leaseFence: number;
  reason: string;
  /** Computer that should expose the pending takeover to the UI via controlRunId. */
  computerId: string;
}

export interface AnswerRunInput {
  spaceId: string;
  threadId: string;
  runId: string;
  messageId: string;
  answeredByUserId: string;
  answer: string;
  /** Identifies a spoken answer as part of a live voice call. */
  clientNonce?: string;
  /** Only for a login card; `answer` carries its password. */
  username?: string;
  /**
   * The person edited a mail approval and sends it themselves, through the compose path, after
   * this denial. Only a "deny" by the run's own user on a pending mail approval takes it: `note`
   * becomes the denied tool's result, and `mail` is what the card then shows.
   */
  mailDenial?: { note: string; mail: Partial<MailApproval> };
}

export const MAIL_APPROVAL_TOOLS = new Set(["mail_draft", "mail_send"]);

/** The compose record key of an edited mail approval: one record per approval effect. */
export const mailApprovalComposeClientId = (effectId: string) => `approval_${effectId}`;

export interface SendUserMessageInput {
  spaceId: string;
  threadId: string;
  botId: string;
  userId: string;
  blocks: MessageBlock[];
  prompt: string;
  trigger: "user" | "follow_up" | "webhook" | "messaging";
  clientNonce?: string;
  linkMessageToRun?: boolean;
  /** When false, persist the user message without starting a run (team-chat transcript). */
  createRun?: boolean;
  /** When true, start a new run even if the bot is already busy (team-chat delivery). */
  allowParallelRun?: boolean;
  /** Model every routine in an inbound delivery agreed on. */
  modelPin?: {
    modelProvider: string;
    modelId: string;
    thinkingLevel: string | null;
  };
}

export interface SendUserMessageResult {
  messageId: string;
  seq: number;
  taskId: string | null;
  runId: string | null;
}

export interface RunSecretWriter {
  withPrepared?<T>(
    prisma: PrismaClient,
    input: AnswerRunInput,
    commit: (writer: RunSecretWriter) => Promise<T>,
  ): Promise<T>;
  store(input: {
    botId: string;
    credential?: BotSecretDestination;
    runId: string;
    userId: string;
    spaceId: string;
    plaintext: string;
    tx: Prisma.TransactionClient;
  }): Promise<void>;
}

export function createThreadEvents(
  prisma: PrismaClient,
  realtime?: RealtimeFanout,
  options: { catchUpMs?: number; runSecretWriter?: RunSecretWriter } = {},
): ThreadEvents {
  return {
    answerRunInput: (input) => answerRunInput(prisma, input, realtime, options.runSecretWriter),
    findMailApprovalForEdit: (input) => findMailApprovalForEdit(prisma, input),
    setMailApprovalOutcome: (input) => setMailApprovalOutcome(prisma, input, realtime),
    setApprovalWaitsFor: (input) => setApprovalWaitsFor(prisma, input, realtime),
    append: (input) => appendEvent(prisma, input, realtime),
    claimSteering: (input) => claimSteering(prisma, input),
    clearThread: (input) => clearThread(prisma, input, realtime),
    finalizeComputerControlRelease: (input) =>
      finalizeComputerControlRelease(prisma, input, realtime),
    finalizeRun: (input) => finalizeRun(prisma, input, realtime),
    notify: (threadId, seq) => notifyRealtime(realtime, threadId, seq),
    pauseRunForInput: (input) => pauseRunForInput(prisma, input, realtime),
    pauseRunForTakeover: (input) => pauseRunForTakeover(prisma, input, realtime),
    sendUserMessage: (input) => sendUserMessage(prisma, input, realtime),
    follow: (threadId, cursor, signal) =>
      followThreadEvents(prisma, threadId, cursor, realtime, signal, options.catchUpMs),
  };
}

export async function clearThread(
  prisma: PrismaClient,
  input: ClearThreadInput,
  realtime?: RealtimeFanout,
): Promise<ClearThreadResult> {
  const committed = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const thread = await tx.thread.update({
      where: {
        id: input.threadId,
        spaceId: input.spaceId,
        ...(input.groupId ? { groupId: input.groupId } : { botId: input.botId }),
      },
      data: { unread: false },
      select: { nextMessageSeq: true, historyCompactionGeneration: true },
    });
    const activeRuns = await tx.run.findMany({
      where: {
        spaceId: input.spaceId,
        threadId: input.threadId,
        ...(input.groupId ? {} : { botId: input.botId }),
        status: { in: ["queued", "leased", "running", "waiting_input", "waiting_takeover"] },
      },
      select: { id: true, taskId: true },
    });
    const now = new Date();
    const runIds = activeRuns.map((run) => run.id);
    await cancelRunsInTransaction(tx, activeRuns, now);
    // Expire as tombstones so a still-open provider screen claim cannot reset fencing to 1.
    await expireComputerExecutionLeases(tx, { runId: { in: runIds } });
    await tx.computer.updateMany({
      where: { executionRunId: { in: runIds } },
      data: {
        executionRunId: null,
        executionBotId: null,
        executionLeaseExpiresAt: null,
      },
    });
    await tx.message.deleteMany({ where: { threadId: input.threadId } });
    await tx.event.deleteMany({ where: { threadId: input.threadId } });
    if (thread.nextMessageSeq > 0) {
      // nextMessageSeq is not reset, so mark every deleted message as already compacted.
      // Leaving the cursor behind would let compaction re-summarize deleted history (or, reset
      // to null, immediately re-fire on the fresh conversation).
      await tx.thread.update({
        where: { id: input.threadId },
        data: {
          historyCompactedUpToSeq: thread.nextMessageSeq - 1,
          historyCompactionSummary: null,
          historyCompactionGeneration: { increment: 1 },
        },
      });
    } else {
      await tx.thread.update({
        where: { id: input.threadId },
        data: {
          historyCompactionSummary: null,
          historyCompactionGeneration: { increment: 1 },
        },
      });
    }
    if (input.groupId) {
      await tx.chatGroup.update({ where: { id: input.groupId }, data: { updatedAt: now } });
    } else {
      await tx.bot.update({
        where: { id: input.botId, spaceId: input.spaceId },
        data: { updatedAt: now },
      });
    }
    const event = await appendEventInTransaction(tx, {
      ...input,
      type: "thread.cleared",
      payload: {},
    });
    return {
      event,
      cancelledRunIds: runIds,
      historyCompactionGeneration: thread.historyCompactionGeneration,
    };
  });
  await notifyRealtime(realtime, committed.event.threadId, committed.event.seq);
  return {
    event: mapProductEvent(committed.event),
    cancelledRunIds: committed.cancelledRunIds,
    historyCompactionGeneration: committed.historyCompactionGeneration,
  };
}

export async function sendUserMessage(
  prisma: PrismaClient,
  input: SendUserMessageInput,
  realtime?: RealtimeFanout,
): Promise<SendUserMessageResult> {
  const replay = async (): Promise<SendUserMessageResult | null> => {
    if (!input.clientNonce) return null;
    const message = await prisma.message.findUnique({
      where: {
        threadId_clientNonce: {
          threadId: input.threadId,
          clientNonce: input.clientNonce,
        },
      },
      include: { sourceRuns: { orderBy: { createdAt: "asc" }, take: 1 } },
    });
    if (!message) return null;
    const created = message.sourceRuns[0];
    const run =
      created ??
      (message.runId ? await prisma.run.findUnique({ where: { id: message.runId } }) : null);
    return {
      messageId: message.id,
      seq: message.seq,
      taskId: created?.taskId ?? null,
      runId: run?.id ?? null,
    };
  };
  const existing = await replay();
  if (existing) return existing;

  const commit = () =>
    prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Message first: its thread-row lock serializes the whole send against clearThread, so a
      // concurrent clear either sees the committed run and cancels it, or strictly precedes this
      // transaction. Created in separate transactions, the run could land inside the clear's
      // window and later repopulate the cleared conversation, and a clear could strand the
      // message without its event.
      const message = await createThreadMessageInTransaction(tx, {
        threadId: input.threadId,
        role: "user",
        blocks: input.blocks,
        clientNonce: input.clientNonce,
      });
      const createRun = input.createRun !== false;
      // Include the creation intro. It has no tools, so it must not absorb the message, and a
      // second run would overlap it on a dedicated computer. Pending steering waits for the
      // continuation that starts when the intro finishes.
      const activeRuns =
        createRun && !input.allowParallelRun
          ? await tx.run.findMany({
              where: {
                threadId: input.threadId,
                botId: input.botId,
                status: {
                  in: ["running", "queued", "leased", "waiting_input", "waiting_takeover"],
                },
              },
              select: { id: true, taskId: true, trigger: true },
            })
          : [];
      // Steer a conversational run when there is one; a routine, webhook, or intro turn only holds the queue.
      const busy =
        activeRuns.find((run) => isConversationalRun(run.trigger)) ?? activeRuns[0] ?? null;
      let task = null;
      let run = null;
      if (createRun && !busy) {
        task = await tx.task.create({
          data: {
            spaceId: input.spaceId,
            botId: input.botId,
            threadId: input.threadId,
            userId: input.userId,
            prompt: input.prompt,
            status: "queued",
          },
        });
        run = await tx.run.create({
          data: {
            spaceId: input.spaceId,
            botId: input.botId,
            threadId: input.threadId,
            taskId: task.id,
            userId: input.userId,
            status: "queued",
            trigger: input.trigger,
            clientNonce: input.clientNonce ? `send:${message.id}` : undefined,
            sourceMessageId: message.id,
            ...(input.modelPin
              ? {
                  modelProvider: input.modelPin.modelProvider,
                  modelId: input.modelPin.modelId,
                  thinkingLevel: input.modelPin.thinkingLevel,
                  modelPinned: true,
                }
              : {}),
          },
        });
        if (input.linkMessageToRun) {
          await tx.message.update({ where: { id: message.id }, data: { runId: run.id } });
        }
      } else if (createRun && busy) {
        const held = !isConversationalRun(busy.trigger);
        await tx.steeringMessage.create({
          data: {
            messageId: message.id,
            botId: input.botId,
            userId: input.userId,
            // Keep messaging on the hold so the later run is mirrored back to that app.
            runId: held ? null : busy.id,
            ...(held && input.trigger === "messaging" ? { originTrigger: "messaging" } : {}),
            ...(input.modelPin
              ? {
                  modelProvider: input.modelPin.modelProvider,
                  modelId: input.modelPin.modelId,
                  thinkingLevel: input.modelPin.thinkingLevel,
                }
              : {}),
          },
        });
        await tx.message.update({ where: { id: message.id }, data: { runId: busy.id } });
      }
      const event = await appendEventInTransaction(tx, {
        spaceId: input.spaceId,
        threadId: input.threadId,
        botId: input.botId,
        type: "thread.message.created",
        runId: run?.id ?? busy?.id,
        payload: {
          messageId: message.id,
          role: "user",
          blocks: input.blocks,
          // Carries the call id on the live event so a spoken turn groups into the
          // call card immediately, instead of after a refetch reads the nonce.
          callId: callIdFromClientNonce(message.clientNonce),
        },
      });
      return { message, task, run, busy, event };
    });
  const committed = await commit().catch(async (error) => {
    const winner = await replay();
    if (winner) return { replay: winner } as const;
    throw error;
  });
  if ("replay" in committed) return committed.replay;
  await notifyRealtime(realtime, input.threadId, committed.event.seq).catch((error) => {
    // The event is durable; subscribers recover it from their persisted cursor.
    getLogger().error("user message realtime notification", error);
  });
  return {
    messageId: committed.message.id,
    seq: committed.message.seq,
    taskId: committed.task?.id ?? null,
    runId: committed.run?.id ?? committed.busy?.id ?? null,
  };
}

export interface FindMailApprovalInput {
  spaceId: string;
  threadId: string;
  runId: string;
  messageId: string;
  answeredByUserId: string;
}

export interface PendingMailApproval {
  effectId: string;
  kind: "mail_draft" | "mail_send";
  request: Record<string, unknown>;
}

/**
 * The pending mail_draft or mail_send approval on this message, when the person answering owns
 * the run and the effect is still waiting. A read: the approval is spent by `answerRunInput`.
 */
export async function findMailApprovalForEdit(
  prisma: PrismaClient,
  input: FindMailApprovalInput,
): Promise<PendingMailApproval | null> {
  const run = await prisma.run.findFirst({
    where: {
      id: input.runId,
      spaceId: input.spaceId,
      threadId: input.threadId,
      userId: input.answeredByUserId,
      status: "waiting_input",
    },
    select: { id: true },
  });
  if (!run) return null;
  const message = await prisma.message.findFirst({
    where: { id: input.messageId, threadId: input.threadId, runId: input.runId, role: "bot" },
  });
  const parsed = MessageBlockSchema.array().safeParse(message?.blocks);
  if (!parsed.success) return null;
  const ask = parsed.data.find((block) => block.kind === "ask" && block.status !== "answered");
  if (ask?.kind !== "ask" || !ask.mail || !isApprovalAskBlock(ask)) return null;
  const effect = await prisma.externalEffect.findFirst({
    where: {
      id: ask.approvalEffectId,
      spaceId: input.spaceId,
      runId: input.runId,
      status: "intended",
    },
  });
  if (!effect || !MAIL_APPROVAL_TOOLS.has(effect.kind)) return null;
  const request = effect.request;
  if (!request || typeof request !== "object" || Array.isArray(request)) return null;
  return {
    effectId: effect.id,
    kind: effect.kind as PendingMailApproval["kind"],
    request: request as Record<string, unknown>,
  };
}

export interface SetMailApprovalOutcomeInput {
  spaceId: string;
  threadId: string;
  /** Omitted when the card is gone (a cleared thread): only the agent's note is updated. */
  messageId?: string;
  effectId: string;
  outcome: NonNullable<MailApproval["outcome"]>;
  /** Replaces the note the agent reads when it resumes, so it matches how the send ended. */
  note?: string;
  /** With a failed outcome: the reason the card shows. */
  error?: string;
  /** With a failed outcome: the account the send used, so the card can reopen the draft in the composer. */
  connectionId?: string;
  account?: string;
  /**
   * For a recovery write: apply only while the approval is still unsettled (the effect still has
   * this note) and the compose record is in this state (null: there is none). Checked under the
   * same thread lock, so a send that finished meanwhile is never overwritten.
   */
  onlyIf?: { note: string; compose: { userId: string; clientId: string; state: string | null } };
}

export interface SetApprovalWaitsForInput {
  spaceId: string;
  threadId: string;
  messageId: string;
  effectId: string;
  /** The service that accepted the submission and must still approve it on its own side. */
  waitsFor: string;
}

/** Marks an approval card as waiting on its service, once the service has accepted the request. */
export async function setApprovalWaitsFor(
  prisma: PrismaClient,
  input: SetApprovalWaitsForInput,
  realtime?: RealtimeFanout,
): Promise<void> {
  const committed = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$queryRaw`SELECT id FROM threads WHERE id = ${input.threadId} FOR UPDATE`;
    const message = await tx.message.findFirst({
      where: { id: input.messageId, threadId: input.threadId, role: "bot" },
    });
    const parsed = MessageBlockSchema.array().safeParse(message?.blocks);
    if (!message?.runId || !parsed.success) return null;
    const run = await tx.run.findUnique({ where: { id: message.runId }, select: { botId: true } });
    if (!run) return null;
    let changed = false;
    const blocks = parsed.data.map((block) => {
      if (block.kind !== "ask" || block.approvalEffectId !== input.effectId) return block;
      changed = true;
      return { ...block, waitsFor: input.waitsFor };
    });
    if (!changed) return null;
    await tx.message.update({ where: { id: message.id }, data: { blocks } });
    const event = await appendEventInTransaction(tx, {
      spaceId: input.spaceId,
      threadId: input.threadId,
      botId: run.botId,
      type: "thread.message.updated",
      runId: message.runId,
      payload: { messageId: message.id, role: "bot", blocks },
    });
    return { threadId: event.threadId, seq: event.seq };
  });
  if (committed) await notifyRealtime(realtime, committed.threadId, committed.seq);
}

/** Records how the person's own send of an edited mail approval ended, for the card to show. */
export async function setMailApprovalOutcome(
  prisma: PrismaClient,
  input: SetMailApprovalOutcomeInput,
  realtime?: RealtimeFanout,
): Promise<void> {
  const committed = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$queryRaw`SELECT id FROM threads WHERE id = ${input.threadId} FOR UPDATE`;
    if (input.onlyIf) {
      const { note, compose } = input.onlyIf;
      const effect = await tx.externalEffect.findFirst({
        where: { id: input.effectId, spaceId: input.spaceId, status: "denied" },
        select: { result: true },
      });
      if ((effect?.result as { note?: unknown } | null)?.note !== note) return null;
      // Locked, so a state change by the inline sender waits for us or is already visible.
      const rows = await tx.$queryRaw<Array<{ state: string }>>`
        SELECT state FROM compose_sends
        WHERE "spaceId" = ${input.spaceId} AND "userId" = ${compose.userId}
          AND "clientId" = ${compose.clientId} FOR UPDATE`;
      if ((rows[0]?.state ?? null) !== compose.state) return null;
    }
    if (input.note) {
      await tx.externalEffect.updateMany({
        where: { id: input.effectId, spaceId: input.spaceId, status: "denied" },
        data: { result: { note: input.note, outcome: input.outcome } },
      });
    }
    if (!input.messageId) return null;
    const message = await tx.message.findFirst({
      where: { id: input.messageId, threadId: input.threadId, role: "bot" },
    });
    const parsed = MessageBlockSchema.array().safeParse(message?.blocks);
    if (!message?.runId || !parsed.success) return null;
    const run = await tx.run.findUnique({ where: { id: message.runId }, select: { botId: true } });
    if (!run) return null;
    let changed = false;
    const blocks = parsed.data.map((block) => {
      if (block.kind !== "ask" || block.approvalEffectId !== input.effectId || !block.mail) {
        return block;
      }
      changed = true;
      return {
        ...block,
        mail: {
          ...block.mail,
          outcome: input.outcome,
          ...(input.error ? { error: input.error.slice(0, 300) } : {}),
          ...(input.connectionId ? { connectionId: input.connectionId } : {}),
          ...(input.account && !block.mail.account ? { account: input.account } : {}),
        },
      };
    });
    if (!changed) return null;
    await tx.message.update({ where: { id: message.id }, data: { blocks } });
    const event = await appendEventInTransaction(tx, {
      spaceId: input.spaceId,
      threadId: input.threadId,
      botId: run.botId,
      type: "thread.message.updated",
      runId: message.runId,
      payload: { messageId: message.id, role: "bot", blocks },
    });
    return { threadId: event.threadId, seq: event.seq };
  });
  if (committed) await notifyRealtime(realtime, committed.threadId, committed.seq);
}

export async function finalizeComputerControlRelease(
  prisma: PrismaClient,
  input: FinalizeComputerControlReleaseInput,
  realtime?: RealtimeFanout,
): Promise<FinalizeComputerControlReleaseResult | false> {
  const committed = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const cleared = await tx.computer.updateMany({
      where: {
        id: input.computerId,
        spaceId: input.spaceId,
        controlBotId: input.botId,
        controlLeaseId: input.leaseId,
        controlRunId: input.runId,
      },
      data: {
        controlHolder: input.holder,
        controlLeaseId: null,
        controlLeaseExpiresAt: null,
        controlBotId: null,
        controlRunId: null,
      },
    });
    if (cleared.count !== 1) return null;

    const checkpoint =
      input.reason === "skipped" || input.reason === "expired" ? "takeover-skipped" : "takeover";
    const resumed = input.runId
      ? await tx.run.updateMany({
          where: {
            id: input.runId,
            spaceId: input.spaceId,
            botId: input.botId,
            status: "waiting_takeover",
          },
          data: {
            status: "queued",
            checkpoint,
          },
        })
      : { count: 0 };
    // A steered continue may already hold the run as leased/running. Stamp the
    // checkpoint without stealing the lease so the worker can restore tools.
    const stamped =
      input.runId && resumed.count !== 1
        ? await tx.run.updateMany({
            where: {
              id: input.runId,
              spaceId: input.spaceId,
              botId: input.botId,
              status: { in: ["leased", "running"] },
            },
            data: { checkpoint },
          })
        : { count: 0 };
    const runId = resumed.count === 1 || stamped.count === 1 ? input.runId : null;

    const bot = await tx.bot.findFirst({
      where: { id: input.botId, spaceId: input.spaceId },
      select: { thread: { select: { id: true } } },
    });
    if (!bot?.thread) return { threadId: null, seq: null, runId };
    const event = await appendEventInTransaction(tx, {
      spaceId: input.spaceId,
      threadId: bot.thread.id,
      botId: input.botId,
      runId: runId ?? undefined,
      type: "computer.takeover.released",
      payload: {
        holder: input.holder,
        leaseId: input.leaseId,
        reason: input.reason,
      },
    });
    return { threadId: event.threadId, seq: event.seq, runId };
  });

  if (!committed) return false;
  if (committed.threadId && committed.seq !== null) {
    await notifyRealtime(realtime, committed.threadId, committed.seq);
  }
  return { runId: committed.runId };
}

export async function appendEvent(
  prisma: PrismaClient,
  input: AppendEventInput,
  realtime?: RealtimeFanout,
): Promise<ProductEvent> {
  // Concurrent writers in one thread (group members, bot messages) can deadlock on the thread row.
  const event = await withTransactionRetry(() =>
    prisma.$transaction((tx: Prisma.TransactionClient) => appendEventInTransaction(tx, input)),
  );
  const productEvent = mapProductEvent(event);
  await notifyRealtime(realtime, event.threadId, event.seq);
  return productEvent;
}

export async function appendEventInTransaction(
  tx: Prisma.TransactionClient,
  input: AppendEventInput,
) {
  const thread = await tx.thread.update({
    where: { id: input.threadId },
    data: { nextEventSeq: { increment: 1 } },
    select: { nextEventSeq: true },
  });
  // run.cancelled is appended after the run row already reads cancelled, so it
  // asserts the terminal status where every other event needs a writable run.
  if (input.type === "run.cancelled") {
    await assertRunIsCancelled(tx, input.runId);
  } else {
    await assertRunCanWriteHistory(tx, input.runId, { allowCancelled: input.allowCancelledRun });
  }
  // Unpaired UTF-16 surrogates (e.g. a split emoji high half) are invalid JSON for Postgres.
  const payload = sanitizeJsonValue(input.payload);
  return tx.event.create({
    data: {
      spaceId: input.spaceId,
      threadId: input.threadId,
      botId: input.botId,
      seq: thread.nextEventSeq - 1,
      type: input.type,
      payload: payload as Prisma.InputJsonValue,
      runId: input.runId,
    },
  });
}

export async function notifyRealtime(
  realtime: RealtimeFanout | undefined,
  threadId: string,
  cursor: number,
): Promise<void> {
  await realtime?.publish(threadTopic(threadId), JSON.stringify({ cursor })).catch(() => undefined);
}

export async function eventsAfter(
  prisma: PrismaClient,
  threadId: string,
  cursor: number,
  limit?: number,
) {
  return prisma.event.findMany({
    where: { threadId, seq: { gt: cursor } },
    orderBy: { seq: "asc" },
    ...(limit ? { take: limit } : {}),
  });
}

export async function* followThreadEvents(
  prisma: PrismaClient,
  threadId: string,
  cursor: number,
  realtime?: RealtimeFanout,
  signal?: AbortSignal,
  catchUpMs = realtime ? PUSH_CATCH_UP_MS : POLL_ONLY_CATCH_UP_MS,
): AsyncGenerator<ProductEvent> {
  let seq = cursor;
  const latch = new ChangeLatch();
  const unsubscribe = realtime
    ? await realtime
        .subscribe(threadTopic(threadId), () => latch.notify())
        .catch(() => async () => {})
    : async () => {};
  try {
    while (!signal?.aborted) {
      const observedGeneration = latch.generation;
      let batchSize = 0;
      do {
        const events = await eventsAfter(prisma, threadId, seq, EVENT_BATCH_SIZE);
        batchSize = events.length;
        for (const event of events) {
          seq = event.seq;
          yield mapProductEvent(event);
        }
      } while (batchSize === EVENT_BATCH_SIZE && !signal?.aborted);
      if (signal?.aborted) break;
      await latch.waitForChange(observedGeneration, catchUpMs, signal);
    }
  } finally {
    await unsubscribe();
  }
}

function threadTopic(threadId: string): string {
  return `thread:${threadId}`;
}

function mapProductEvent(event: {
  id: string;
  spaceId: string;
  threadId: string;
  botId: string;
  seq: number;
  type: string;
  payload: unknown;
  runId: string | null;
  createdAt: Date;
}): ProductEvent {
  return {
    id: event.id,
    spaceId: event.spaceId,
    threadId: event.threadId,
    botId: event.botId,
    seq: event.seq,
    type: event.type as ProductEvent["type"],
    runId: event.runId ?? undefined,
    createdAt: event.createdAt.toISOString(),
    payload: event.payload as Record<string, unknown>,
  };
}

class ChangeLatch {
  generation = 0;
  private wake: (() => void) | undefined;

  notify(): void {
    this.generation += 1;
    this.wake?.();
  }

  async waitForChange(expected: number, timeoutMs: number, signal?: AbortSignal): Promise<void> {
    if (this.generation !== expected || signal?.aborted) return;
    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener("abort", finish);
        if (this.wake === finish) this.wake = undefined;
        resolve();
      };
      const timer = setTimeout(finish, timeoutMs);
      this.wake = finish;
      signal?.addEventListener("abort", finish, { once: true });
      if (this.generation !== expected || signal?.aborted) finish();
    });
  }
}
