import { randomUUID } from "node:crypto";
import type { RealtimeFanout } from "@rakazo/adapter-kit";
import type {
  BotSecretDestination,
  MailApproval,
  MessageBlock,
  ProductEvent,
} from "@rakazo/contracts";
import { MessageBlock as MessageBlockSchema } from "@rakazo/contracts";
import {
  blocksToAgentHistoryText,
  callIdFromClientNonce,
  isApprovalAskBlock,
  isConversationalRun,
  mcpConnectionIdFromNonce,
  newRunExternalTaint,
  newRunUnattended,
  sanitizeJsonValue,
} from "@rakazo/core";
import { getLogger } from "@rakazo/logging";
import { cancelRunsInTransaction } from "./cancel-runs.js";
import type { PrismaClient } from "./client.js";
import { Prisma } from "./client.js";
import { expireComputerExecutionLeases } from "./computers.js";
import {
  CrossSpaceCommunicationBlockedError,
  crossSpaceCommunicationAllowed,
} from "./cross-space-communication.js";
import type { AcceptMailReplyBatchInput, AcceptMailReplyBatchResult } from "./mail-reply-batch.js";
import {
  acceptMailReplyBatch,
  setMailBatchCounts,
  settleMailReplyBatch,
} from "./mail-reply-batch.js";
import {
  assertRunCanWriteHistory,
  assertRunIsCancelled,
  createThreadMessageInTransaction,
  RunHistoryWriteError,
} from "./messages.js";
import type { AcceptPipelineImportResult } from "./pipeline-import.js";
import {
  acceptPipelineImport,
  preparePipelineImportCard,
  settlePipelineImport,
  stagePipelineImportRows,
} from "./pipeline-import.js";
import { finalizeRun } from "./run-finalize.js";
import {
  answerRunInput,
  answerWaitingRunWithTextInTransaction,
  pauseRunForInput,
  pauseRunForTakeover,
  skipWaitingApprovalsInTransaction,
} from "./run-pauses.js";
import { claimSteering } from "./steering.js";
import { clearOpenGoal } from "./thread-goals.js";
import { THREAD_LOCK_TRANSACTION_OPTIONS } from "./thread-lock.js";

export { completedRunBlocks, finalizeRun } from "./run-finalize.js";
export { createPendingSteeringRun, discardAnsweredSteering } from "./steering.js";
export {
  answerRunInput,
  answerWaitingRunWithTextInTransaction,
  claimSteering,
  pauseRunForInput,
  pauseRunForTakeover,
  skipWaitingApprovalsInTransaction,
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
  acceptMailReplyBatch(input: AcceptMailReplyBatchInput): Promise<AcceptMailReplyBatchResult>;
  acceptPipelineImport(
    input: Parameters<typeof acceptPipelineImport>[1],
  ): Promise<AcceptPipelineImportResult>;
  settlePipelineImport(
    input: Parameters<typeof settlePipelineImport>[1],
  ): ReturnType<typeof settlePipelineImport>;
  stagePipelineImportRows(
    scope: Parameters<typeof stagePipelineImportRows>[1],
    input: Parameters<typeof stagePipelineImportRows>[2],
  ): ReturnType<typeof stagePipelineImportRows>;
  preparePipelineImportCard(
    scope: Parameters<typeof preparePipelineImportCard>[1],
    effectId: string,
  ): ReturnType<typeof preparePipelineImportCard>;
  setMailBatchCounts(input: { spaceId: string; userId: string; effectId: string }): Promise<void>;
  settleMailReplyBatch(input: {
    spaceId: string;
    userId: string;
    effectId: string;
  }): Promise<{ settled: boolean; resumeRunId?: string }>;
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
   * The person edited a mail approval and sends it themselves, through the compose path. Only a
   * "deny" by the run's own user on a pending mail approval takes it. It stops the agent's own call
   * from running: the effect is denied only until setMailApprovalOutcome settles it, and the card
   * records "allow". `note` is the agent's result meanwhile, and `mail` is what the card then shows.
   */
  mailDenial?: { note: string; mail: Partial<MailApproval> };
}

export const MAIL_APPROVAL_TOOLS = new Set(["mail_draft", "mail_send", "mail_reply_batch"]);

/** The compose record key of an edited mail approval: one record per approval effect. */
export const mailApprovalComposeClientId = (effectId: string) => `approval_${effectId}`;

/** The compose record of one batch reply: one per row, so only one worker can move it to pending. */
/** A row held because its thread was cleared before a worker took it. */
export const MAIL_REPLY_CLEARED_HOLD = "thread_cleared";
export const MAIL_REPLY_CLIENT_PREFIX = "agent:batch_";
export const mailReplyClientId = (itemId: string) => `${MAIL_REPLY_CLIENT_PREFIX}${itemId}`;

export interface SendUserMessageInput {
  spaceId: string;
  threadId: string;
  botId: string;
  userId: string;
  blocks: MessageBlock[];
  prompt: string;
  trigger: "user" | "follow_up" | "webhook" | "messaging" | "mcp";
  clientNonce?: string;
  linkMessageToRun?: boolean;
  /**
   * The run that caused this message, when there is one (for example a run forwarding to another
   * bot). Its mode is copied. Without it the mode comes from the trigger: user and follow_up are
   * the owner typing, webhook and messaging are unattended and carry outside content.
   */
  sourceRun?: { unattended: boolean; externalTaint: boolean } | null;

  /** Internal bot sender: enforce both bots' cross-space policy in the write transaction. */
  crossSpaceSenderBotId?: string;
  /** When false, persist the user message without starting a run (team-chat transcript). */
  createRun?: boolean;
  /** When true, start a new run even if the bot is already busy (team-chat delivery). */
  allowParallelRun?: boolean;
  /**
   * The routine this message belongs to, when an inbound delivery matched exactly one. Checked
   * against the bot and space below before it reaches the run.
   */
  routineId?: string;
  /** Model every routine in an inbound delivery agreed on. */
  modelPin?: {
    modelProvider: string;
    modelId: string;
    modelCredentialId?: string | null;
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
    acceptMailReplyBatch: (input) => acceptMailReplyBatch(prisma, input, realtime),
    acceptPipelineImport: (input) => acceptPipelineImport(prisma, input, realtime),
    settlePipelineImport: (input) => settlePipelineImport(prisma, input, realtime),
    stagePipelineImportRows: (scope, input) =>
      stagePipelineImportRows(prisma, scope, input, realtime),
    preparePipelineImportCard: (scope, effectId) =>
      preparePipelineImportCard(prisma, scope, effectId, realtime),
    setMailBatchCounts: (input) => setMailBatchCounts(prisma, input, realtime),
    settleMailReplyBatch: (input) => settleMailReplyBatch(prisma, input, realtime),
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
    // Group before thread, the order every group writer uses (see lockOwnedGroup).
    if (input.groupId) {
      await tx.$queryRaw`
        SELECT id FROM chat_groups
        WHERE id = ${input.groupId} AND "spaceId" = ${input.spaceId}
        FOR NO KEY UPDATE`;
    }
    const thread = await tx.thread.update({
      where: {
        id: input.threadId,
        spaceId: input.spaceId,
        ...(input.groupId ? { groupId: input.groupId } : { botId: input.botId }),
      },
      data: { unread: false, meetingTaintedAt: null },
      select: { nextMessageSeq: true, historyCompactionGeneration: true, userId: true },
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
    // Clearing is a strong signal, and the card with its Retry is gone: replies not yet claimed stop.
    await tx.mailReplyItem.updateMany({
      where: {
        spaceId: input.spaceId,
        dispatch: "queued",
        effect: { run: { threadId: input.threadId } },
      },
      data: { dispatch: "held", error: MAIL_REPLY_CLEARED_HOLD },
    });
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
    // The log survives with the cleared event, so clients learn the goal ended after it.
    const goalSeq = input.groupId
      ? null
      : await clearOpenGoal(tx, {
          spaceId: input.spaceId,
          userId: thread.userId,
          threadId: input.threadId,
          botId: input.botId,
        });
    return {
      event,
      notifySeq: goalSeq ?? event.seq,
      cancelledRunIds: runIds,
      historyCompactionGeneration: thread.historyCompactionGeneration,
    };
  }, THREAD_LOCK_TRANSACTION_OPTIONS);
  await notifyRealtime(realtime, committed.event.threadId, committed.notifySeq);
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
    });
    if (!message) return null;
    const created = await prisma.run.findFirst({
      where: { sourceMessageId: message.id },
      orderBy: { createdAt: "asc" },
    });
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
      if (
        input.crossSpaceSenderBotId &&
        !(await crossSpaceCommunicationAllowed(tx, input.crossSpaceSenderBotId, input.botId))
      ) {
        throw new CrossSpaceCommunicationBlockedError();
      }
      // Only a routine the run's own bot and space own may label it; a stray id is dropped
      // rather than failing the delivery. A queued delivery remembers it for its continuation.
      const routineId = input.routineId
        ? (
            await tx.routine.findFirst({
              where: { id: input.routineId, botId: input.botId, spaceId: input.spaceId },
              select: { id: true },
            })
          )?.id
        : undefined;
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
              select: {
                id: true,
                taskId: true,
                trigger: true,
                modelPinned: true,
                modelCredentialId: true,
              },
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
            ...(routineId ? { routineId } : {}),
            unattended: newRunUnattended({ trigger: input.trigger, source: input.sourceRun }),
            externalTaint: newRunExternalTaint({ trigger: input.trigger, source: input.sourceRun }),
            clientNonce: input.clientNonce ? `send:${message.id}` : undefined,
            sourceMessageId: message.id,
            ...(input.modelPin
              ? {
                  modelProvider: input.modelPin.modelProvider,
                  modelId: input.modelPin.modelId,
                  ...(input.modelPin.modelCredentialId
                    ? { modelCredentialId: input.modelPin.modelCredentialId }
                    : {}),
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
        // A message on a different connection than the live run's cannot ride along: the run
        // would answer it on the wrong connection, so it waits and runs on its own pin.
        const botPin =
          input.modelPin || busy.modelPinned
            ? ((
                await tx.bot.findUnique({
                  where: { id: input.botId },
                  select: { modelCredentialId: true },
                })
              )?.modelCredentialId ?? null)
            : null;
        const messagePin = input.modelPin ? (input.modelPin.modelCredentialId ?? null) : botPin;
        const runPin = busy.modelPinned ? (busy.modelCredentialId ?? null) : botPin;
        // Outside content waits for its own continuation even on the same connection: the busy
        // run was built clean and its executor holds that mode, so steering it could not taint it.
        const outsideDelivery =
          newRunExternalTaint({ trigger: input.trigger, source: input.sourceRun }) ||
          Boolean(input.prompt && input.prompt !== blocksToAgentHistoryText(input.blocks));
        const held = outsideDelivery || !isConversationalRun(busy.trigger) || messagePin !== runPin;
        await tx.steeringMessage.create({
          data: {
            messageId: message.id,
            botId: input.botId,
            userId: input.userId,
            // The bubble may be only a label; model-only text rides here so claiming it still
            // works. A plain message reads the same from its bubble, which keeps this a delivery
            // marker for the claim path.
            prompt:
              input.prompt && input.prompt !== blocksToAgentHistoryText(input.blocks)
                ? input.prompt
                : undefined,
            ...(routineId ? { routineId } : {}),
            // A held delivery keeps the mode its own trigger implies. The continuation it starts
            // is a follow_up, which alone would read the outside payload as attended.
            unattended: newRunUnattended({ trigger: input.trigger, source: input.sourceRun }),
            externalTaint: newRunExternalTaint({ trigger: input.trigger, source: input.sourceRun }),
            // Keep messaging on the hold so the later run is mirrored back to that app.
            runId: held ? null : busy.id,
            ...(held && input.trigger === "messaging" ? { originTrigger: "messaging" } : {}),
            ...(input.modelPin
              ? {
                  modelProvider: input.modelPin.modelProvider,
                  modelId: input.modelPin.modelId,
                  ...(input.modelPin.modelCredentialId
                    ? { modelCredentialId: input.modelPin.modelCredentialId }
                    : {}),
                  thinkingLevel: input.modelPin.thinkingLevel,
                }
              : {}),
          },
        });
        await tx.message.update({ where: { id: message.id }, data: { runId: busy.id } });
      }
      // An outside MCP client's label rides on the live event, as it does on a loaded thread.
      const connectionId = mcpConnectionIdFromNonce(message.clientNonce);
      const via = connectionId
        ? (
            await tx.mcpConnection.findFirst({
              where: { id: connectionId, spaceId: input.spaceId },
              select: { label: true },
            })
          )?.label
        : undefined;
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
          ...(via ? { via } : {}),
          // Carries the call id on the live event so a spoken turn groups into the
          // call card immediately, instead of after a refetch reads the nonce.
          callId: callIdFromClientNonce(message.clientNonce),
        },
      });
      return { message, task, run, busy, event };
    }, THREAD_LOCK_TRANSACTION_OPTIONS);
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
  /** Changes what the card describes, e.g. a saved draft that was then sent. */
  tool?: MailApproval["tool"];
  /** Replaces the note the agent reads when it resumes, so it matches how the send ended. */
  note?: string;
  /** With a failed outcome: the reason the card shows. */
  error?: string;
  /** With a failed outcome: the account the send used, so the card can reopen the draft in the composer. */
  connectionId?: string;
  account?: string;
  /** Provider ids of the sent or saved mail, for the card's link into the mail app. */
  providerIds?: { threadId?: string; messageId?: string; draftId?: string };
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
  }, THREAD_LOCK_TRANSACTION_OPTIONS);
  if (committed) await notifyRealtime(realtime, committed.threadId, committed.seq);
}

function cardSendSettled(outcome: SetMailApprovalOutcomeInput["outcome"], note: string) {
  if (outcome === "sent" || outcome === "saved") {
    return { status: "completed", result: { ok: true, note, outcome } };
  }
  if (outcome === "unknown") {
    return { status: "uncertain", result: { error: note, note, outcome, uncertain: true } };
  }
  return { status: "completed", result: { error: note, note, outcome } };
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
        // The card send has ended, so the effect stops being a denial and says what happened: this
        // status and result are what the agent reads, here and when it resumes from a checkpoint.
        data: cardSendSettled(input.outcome, input.note),
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
          ...(input.tool ? { tool: input.tool } : {}),
          ...(input.error ? { error: input.error.slice(0, 300) } : {}),
          ...(input.connectionId ? { connectionId: input.connectionId } : {}),
          ...(input.outcome === "sent" || input.outcome === "saved" ? input.providerIds : {}),
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
  }, THREAD_LOCK_TRANSACTION_OPTIONS);
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
  }, THREAD_LOCK_TRANSACTION_OPTIONS);

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
  const event = await insertEventAlone(prisma, input);
  await notifyRealtime(realtime, event.threadId, event.seq);
  return mapProductEvent(event);
}

/**
 * appendEventInTransaction as one autocommit statement. Readers trust that events commit in seq
 * order, which the thread row lock taken with the seq guarantees, so that lock is held only while
 * Postgres runs this statement instead of across an interactive transaction's round trips.
 * The run is locked after the thread, as everywhere else, and FOR SHARE checks its newest
 * version, so a run cancelled while this waited for the thread writes nothing. A rejected write
 * still uses its seq; readers already skip gaps left by deleted events.
 */
async function insertEventAlone(prisma: PrismaClient, input: AppendEventInput) {
  const { runId } = input;
  if (input.type === "run.cancelled" && !runId) throw new RunHistoryWriteError();
  // Unpaired UTF-16 surrogates (e.g. a split emoji high half) are invalid JSON for Postgres.
  const payload = sanitizeJsonValue(input.payload) as Record<string, unknown>;
  const id = randomUUID();
  // run.cancelled is appended after the run row already reads cancelled, so it asserts the
  // terminal status where every other event needs a writable run.
  const runWritable =
    input.type === "run.cancelled"
      ? Prisma.sql`r.status = 'cancelled'`
      : input.allowCancelledRun
        ? Prisma.sql`TRUE`
        : Prisma.sql`r.status <> 'cancelled'`;
  const [event] = await prisma.$queryRaw<
    Array<{ seq: number; createdAt: Date; runId: string | null }>
  >`
    WITH next AS (
      UPDATE threads SET "nextEventSeq" = "nextEventSeq" + 1
      WHERE id = ${input.threadId}
      RETURNING "nextEventSeq" - 1 AS seq
    ),
    run AS (
      SELECT r.id FROM runs r CROSS JOIN next
      WHERE r.id = ${runId ?? null} AND ${runWritable}
      FOR SHARE OF r
    )
    INSERT INTO events (id, "spaceId", "threadId", "botId", seq, type, payload, "runId")
    SELECT ${id}, ${input.spaceId}, ${input.threadId}, ${input.botId}, next.seq,
      ${input.type}, ${JSON.stringify(payload)}::jsonb, ${runId ?? null}
    FROM next
    WHERE ${runId ? Prisma.sql`EXISTS (SELECT 1 FROM run)` : Prisma.sql`TRUE`}
    RETURNING seq, "createdAt", "runId"`;
  if (!event) {
    // Deleting the bot or space cascades the thread and its runs away under in-flight work;
    // that run has no history left to write to.
    if (runId) throw new RunHistoryWriteError();
    throw new Error("Thread not found");
  }
  return {
    id,
    spaceId: input.spaceId,
    threadId: input.threadId,
    botId: input.botId,
    type: input.type,
    payload,
    ...event,
  };
}

export async function appendEventInTransaction(
  tx: Prisma.TransactionClient,
  input: AppendEventInput,
) {
  const thread = await tx.thread
    .update({
      where: { id: input.threadId },
      data: { nextEventSeq: { increment: 1 } },
      select: { nextEventSeq: true },
    })
    .catch((error: unknown) => {
      // Deleting the bot or space cascades the thread and its runs away under
      // in-flight work; that run has no history left to write to.
      if (input.runId && isRecordNotFound(error)) throw new RunHistoryWriteError();
      throw error;
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

function isRecordNotFound(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2025");
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
