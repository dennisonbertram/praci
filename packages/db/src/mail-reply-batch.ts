import type { RealtimeFanout } from "@rakazo/adapter-kit";
import type { MailBatchCounts } from "@rakazo/contracts";
import {
  MAIL_REPLY_BATCH_TOOL,
  MAIL_REPLY_FIREWALL_HOLD,
  MAIL_REPLY_LIMIT_HOLD,
  MessageBlock as MessageBlockSchema,
} from "@rakazo/contracts";
import { mailReplyHash } from "@rakazo/core/node/approval-effect-key";
import type { Prisma, PrismaClient } from "./client.js";
import { appendEventInTransaction, mailReplyClientId, notifyRealtime } from "./events.js";
import { announceDelegatePending } from "./run-pauses.js";

/** A row held because its stored text no longer matches what the owner approved. Never retried. */
export const MAIL_REPLY_HASH_HOLD = "hash";

/**
 * New recipients one mail account may reach through batch cards in any 24 hours: two full cards.
 * Sending to many people who never wrote back is what harms a Gmail account's sender reputation, and
 * a limit far below the provider's own hard caps stops a card from getting near that. A proposal, not
 * a measured threshold: change it here if real accounts show otherwise. Replies to people already in
 * the account's mail do not count.
 */
export const MAX_NEW_RECIPIENT_SENDS_PER_DAY = 40;
const NEW_RECIPIENT_WINDOW_MS = 24 * 60 * 60_000;

/**
 * Takes this row's place in its account's limit, right before its send. The lock makes the count and
 * the claim one step across workers. A row that holds a place from this window keeps it, so a retry or
 * a recovered worker is never counted twice; an older place no longer counts, so it must find room
 * again. False means no room: nothing changed.
 */
export async function reserveNewRecipientSends(
  prisma: PrismaClient,
  input: Scope & { itemId: string; connectionId: string; count: number; now?: Date },
): Promise<boolean> {
  const now = input.now ?? new Date();
  const scope = { spaceId: input.spaceId, userId: input.userId };
  return prisma.$transaction(async (tx: Tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`mail-new-recipients:${input.connectionId}`}))`;
    const row = await tx.mailReplyItem.findFirstOrThrow({
      where: { ...scope, id: input.itemId },
      select: { newRecipientAt: true },
    });
    const windowStart = new Date(now.getTime() - NEW_RECIPIENT_WINDOW_MS);
    if (row.newRecipientAt && row.newRecipientAt >= windowStart) return true;
    const used = await tx.mailReplyItem.aggregate({
      where: {
        ...scope,
        connectionId: input.connectionId,
        newRecipientAt: { gte: windowStart },
      },
      _sum: { newRecipientCount: true },
    });
    if ((used._sum.newRecipientCount ?? 0) + input.count > MAX_NEW_RECIPIENT_SENDS_PER_DAY) {
      return false;
    }
    await tx.mailReplyItem.update({
      where: { id: input.itemId },
      data: { newRecipientCount: input.count, newRecipientAt: now },
    });
    return true;
  });
}

/** Gives the place back when the provider refused the row, so an outage does not use up the day. */
export const releaseNewRecipientSends = (prisma: PrismaClient, scope: Scope, itemId: string) =>
  prisma.mailReplyItem.updateMany({
    where: { ...scope, id: itemId },
    data: { newRecipientCount: 0, newRecipientAt: null },
  });

type Scope = { spaceId: string; userId: string };
type Tx = Prisma.TransactionClient;

/** How one row stands for the owner and the agent. */
export type MailReplyState =
  | "reviewing"
  | "sending"
  | "sent"
  | "not_sent"
  | "unknown"
  | "skipped"
  | "composer";

export function mailReplyState(
  row: { dispatch: string },
  composeState: string | null | undefined,
): MailReplyState {
  if (row.dispatch === "reviewing") return "reviewing";
  if (row.dispatch === "skipped") return "skipped";
  if (row.dispatch === "composer") return "composer";
  if (row.dispatch === "held") return "not_sent";
  if (row.dispatch === "queued") return "sending";
  // Claimed: the compose record holds the send state.
  if (composeState === "sent") return "sent";
  if (composeState === "unknown") return "unknown";
  if (composeState === "failed" || composeState === "abandoned") return "not_sent";
  return "sending";
}

async function rowStates(
  db: Pick<Tx, "mailReplyItem" | "composeSend">,
  { spaceId, userId }: Scope,
  effectId: string,
) {
  const scope = { spaceId, userId };
  const rows = await db.mailReplyItem.findMany({
    where: { ...scope, effectId },
    orderBy: { position: "asc" },
    select: { id: true, replyToId: true, to: true, dispatch: true, error: true },
  });
  const records = await db.composeSend.findMany({
    where: { ...scope, clientId: { in: rows.map((row) => mailReplyClientId(row.id)) } },
    select: { clientId: true, state: true },
  });
  return rows.map((row) => ({
    ...row,
    state: mailReplyState(
      row,
      records.find((record) => record.clientId === mailReplyClientId(row.id))?.state,
    ),
  }));
}

const countsOf = (rows: { state: MailReplyState }[]): MailBatchCounts => ({
  count: rows.length,
  sent: rows.filter((row) => row.state === "sent").length,
  failed: rows.filter((row) => row.state === "not_sent").length,
  unknown: rows.filter((row) => row.state === "unknown").length,
});

/** Writes the counts on the card, when there still is one (a cleared thread has none). */
async function writeCardCounts(
  tx: Tx,
  input: { spaceId: string; threadId: string; botId: string; runId: string; effectId: string },
  mailBatch: MailBatchCounts,
) {
  const messages = await tx.message.findMany({
    where: { threadId: input.threadId, runId: input.runId, role: "bot" },
    orderBy: { seq: "desc" },
    take: 50,
    select: { id: true, blocks: true },
  });
  for (const message of messages) {
    const parsed = MessageBlockSchema.array().safeParse(message.blocks);
    if (!parsed.success) continue;
    const card = parsed.data.find(
      (block) => block.kind === "ask" && block.approvalEffectId === input.effectId,
    );
    if (card?.kind !== "ask") continue;
    if (JSON.stringify(card.mailBatch) === JSON.stringify(mailBatch)) return null;
    const blocks = parsed.data.map((block) => (block === card ? { ...block, mailBatch } : block));
    await tx.message.update({ where: { id: message.id }, data: { blocks } });
    return appendEventInTransaction(tx, {
      spaceId: input.spaceId,
      threadId: input.threadId,
      botId: input.botId,
      type: "thread.message.updated",
      runId: input.runId,
      // A stop does not stop an approved row, so a stopped run's card still shows its results.
      allowCancelledRun: true,
      payload: { messageId: message.id, role: "bot", blocks },
    });
  }
  return null;
}

export interface AcceptMailReplyBatchInput {
  spaceId: string;
  threadId: string;
  runId: string;
  messageId: string;
  answeredByUserId: string;
  /** The ticked rows, already validated as they will be sent. */
  rows: {
    itemId: string;
    /** The hash the client saw, of the stored row. */
    hash: string;
    seenMessageId: string | null;
    final: {
      to: string[];
      cc: string[];
      bcc: string[];
      subject: string;
      body: string;
    };
  }[];
}

export type AcceptMailReplyBatchResult =
  /** Nobody is waiting on this card any more; nothing changed. */
  | { status: "closed" }
  /** A row changed since the client read it; nothing changed. */
  | { status: "changed" }
  | { status: "accepted"; effectId: string };

/**
 * The press. In one transaction: compares each hash with the stored row, stores the approved text,
 * marks unticked rows skipped, moves the effect to executing and marks the card answered. The run
 * stays in waiting_input until the batch settles, so it cannot resume in the middle of the sends.
 * A second press finds no intended effect.
 */
export async function acceptMailReplyBatch(
  prisma: PrismaClient,
  input: AcceptMailReplyBatchInput,
  realtime?: RealtimeFanout,
): Promise<AcceptMailReplyBatchResult> {
  const committed = await prisma.$transaction(
    async (tx: Tx): Promise<AcceptMailReplyBatchResult & { seq?: number }> => {
      // Thread row first, then run rows: the same order as clearThread and finalizeRun.
      await tx.$queryRaw`SELECT id FROM threads WHERE id = ${input.threadId} FOR UPDATE`;
      const scope = { spaceId: input.spaceId, userId: input.answeredByUserId };
      const run = await tx.run.findFirst({
        where: {
          id: input.runId,
          spaceId: input.spaceId,
          threadId: input.threadId,
          userId: input.answeredByUserId,
          status: "waiting_input",
        },
        select: { botId: true },
      });
      if (!run) return { status: "closed" };
      const message = await tx.message.findFirst({
        where: { id: input.messageId, threadId: input.threadId, runId: input.runId, role: "bot" },
      });
      const parsed = MessageBlockSchema.array().safeParse(message?.blocks);
      if (!message || !parsed.success) return { status: "closed" };
      const card = parsed.data.find(
        (block) => block.kind === "ask" && block.mailBatch && block.status !== "answered",
      );
      if (card?.kind !== "ask" || !card.approvalEffectId) return { status: "closed" };
      const effectId = card.approvalEffectId;
      const effect = await tx.externalEffect.findFirst({
        where: {
          id: effectId,
          spaceId: input.spaceId,
          runId: input.runId,
          kind: MAIL_REPLY_BATCH_TOOL,
          status: "intended",
        },
        select: { id: true },
      });
      if (!effect) return { status: "closed" };
      const stored = await tx.mailReplyItem.findMany({ where: { ...scope, effectId } });
      for (const posted of input.rows) {
        const row = stored.find((candidate) => candidate.id === posted.itemId);
        if (row?.dispatch !== "reviewing" || mailReplyHash(row) !== posted.hash) {
          return { status: "changed" };
        }
      }
      const claimed = await tx.externalEffect.updateMany({
        where: { id: effectId, status: "intended" },
        data: { status: "executing" },
      });
      if (claimed.count !== 1) return { status: "closed" };
      for (const { itemId, seenMessageId, final } of input.rows) {
        const row = stored.find((candidate) => candidate.id === itemId)!;
        await tx.mailReplyItem.update({
          where: { id: itemId },
          data: {
            ...final,
            seenMessageId,
            dispatch: "queued",
            approvedHash: mailReplyHash({ ...row, ...final }),
          },
        });
      }
      await tx.mailReplyItem.updateMany({
        where: { ...scope, effectId, id: { notIn: input.rows.map((row) => row.itemId) } },
        data: { dispatch: "skipped" },
      });
      const blocks = parsed.data.map((block) =>
        block === card ? { ...block, status: "answered" as const, answer: "send" } : block,
      );
      await tx.message.update({ where: { id: message.id }, data: { blocks } });
      const event = await appendEventInTransaction(tx, {
        spaceId: input.spaceId,
        threadId: input.threadId,
        botId: run.botId,
        type: "thread.message.updated",
        runId: input.runId,
        payload: { messageId: message.id, role: "bot", blocks },
      });
      return { status: "accepted", effectId, seq: event.seq };
    },
  );
  if (committed.status !== "accepted") return committed;
  await notifyRealtime(realtime, input.threadId, committed.seq as number);
  return { status: "accepted", effectId: committed.effectId };
}

/** Puts the current counts on the card as rows finish. The card is a view; a failure is harmless. */
export async function setMailBatchCounts(
  prisma: PrismaClient,
  input: Scope & { effectId: string },
  realtime?: RealtimeFanout,
): Promise<void> {
  const effect = await prisma.externalEffect.findFirst({
    where: { id: input.effectId, spaceId: input.spaceId, kind: MAIL_REPLY_BATCH_TOOL },
    select: { runId: true, status: true, run: { select: { threadId: true, botId: true } } },
  });
  if (!effect) return;
  const { threadId, botId } = effect.run;
  const event = await prisma.$transaction(async (tx: Tx) => {
    await tx.$queryRaw`SELECT id FROM threads WHERE id = ${threadId} FOR UPDATE`;
    const rows = await rowStates(tx, input, input.effectId);
    return writeCardCounts(
      tx,
      { spaceId: input.spaceId, threadId, botId, runId: effect.runId, effectId: input.effectId },
      { ...countsOf(rows), ...(effect.status === "completed" ? { settled: true } : {}) },
    );
  });
  if (event) await notifyRealtime(realtime, event.threadId, event.seq);
}

const AGENT_NOTE =
  "The user sees each reply's result on the card. Do not list them; answer in a sentence.";
const LIMIT_NOTE =
  " Some new emails were not sent because this account reached its daily limit for new recipients. Say so, and do not propose them again today.";
const HOLD_REASONS: readonly (string | null)[] = [MAIL_REPLY_LIMIT_HOLD, MAIL_REPLY_FIREWALL_HOLD];

/**
 * Ends the waiting call once nothing is left to send: the effect moves from executing to completed
 * with the per-row outcomes as its result, and a run still waiting is queued to read it. Conditional
 * on executing, so it is safe to repeat. Returns whether this call queued the run.
 */
export async function settleMailReplyBatch(
  prisma: PrismaClient,
  input: Scope & { effectId: string },
  realtime?: RealtimeFanout,
): Promise<{ settled: boolean; resumeRunId?: string }> {
  const found = await prisma.externalEffect.findFirst({
    where: {
      id: input.effectId,
      spaceId: input.spaceId,
      kind: MAIL_REPLY_BATCH_TOOL,
      status: "executing",
    },
    select: { runId: true, run: { select: { threadId: true, botId: true } } },
  });
  if (!found) return { settled: false };
  const { runId } = found;
  const { threadId, botId } = found.run;
  const committed = await prisma.$transaction(async (tx: Tx) => {
    await tx.$queryRaw`SELECT id FROM threads WHERE id = ${threadId} FOR UPDATE`;
    const rows = await rowStates(tx, input, input.effectId);
    if (rows.some((row) => row.state === "sending" || row.state === "reviewing")) return null;
    const outcome = (state: MailReplyState) => (state === "not_sent" ? "failed" : state);
    const counts = countsOf(rows);
    const claimed = await tx.externalEffect.updateMany({
      where: { id: input.effectId, status: "executing" },
      data: {
        status: "completed",
        result: {
          ...counts,
          replies: rows.map((row) => ({
            replyToId: row.replyToId,
            ...(row.replyToId ? {} : { to: row.to }),
            outcome: outcome(row.state),
            ...(row.dispatch === "held" && HOLD_REASONS.includes(row.error)
              ? { reason: row.error }
              : {}),
          })),
          note: rows.some((row) => row.dispatch === "held" && row.error === MAIL_REPLY_LIMIT_HOLD)
            ? AGENT_NOTE + LIMIT_NOTE
            : AGENT_NOTE,
        },
      },
    });
    if (claimed.count !== 1) return null;
    const resumed = await tx.run.updateMany({
      where: { id: runId, spaceId: input.spaceId, threadId, status: "waiting_input" },
      data: { status: "queued" },
    });
    const event = await writeCardCounts(
      tx,
      { spaceId: input.spaceId, threadId, botId, runId, effectId: input.effectId },
      { ...counts, settled: true },
    );
    return { resumed: resumed.count === 1, seq: event?.seq };
  });
  if (!committed) return { settled: false };
  if (committed.seq !== undefined) await notifyRealtime(realtime, threadId, committed.seq);
  await announceDelegatePending(prisma, realtime, runId).catch(() => undefined);
  return { settled: true, ...(committed.resumed ? { resumeRunId: runId } : {}) };
}

class RetryLostRace extends Error {}

export interface RetryMailReplyBatchInput extends Scope {
  effectId: string;
  /** The rows to retry, each with the newest message the owner acknowledged. */
  rows: { itemId: string; seenMessageId: string | null }[];
}

/**
 * Retry failed. The only way a failed record becomes sendable again: in one transaction each failed
 * compose record goes back to draft and each failed or held row back to queued. Only after
 * settlement. A row held on a hash difference, an unknown, sent or skipped row, and one the owner
 * took to the composer are left alone. The stored result and the run do not change.
 */
export async function retryMailReplyBatch(
  prisma: PrismaClient,
  input: RetryMailReplyBatchInput,
): Promise<{ status: "closed" } | { status: "queued"; count: number }> {
  const scope = { spaceId: input.spaceId, userId: input.userId };
  try {
    return await prisma.$transaction(async (tx: Tx) => {
      const effect = await tx.externalEffect.findFirst({
        where: {
          id: input.effectId,
          spaceId: input.spaceId,
          kind: MAIL_REPLY_BATCH_TOOL,
          status: "completed",
        },
        select: { id: true },
      });
      if (!effect) return { status: "closed" as const };
      const rows = await tx.mailReplyItem.findMany({
        where: {
          ...scope,
          effectId: input.effectId,
          id: { in: input.rows.map((row) => row.itemId) },
        },
        select: { id: true, dispatch: true, error: true, updatedAt: true },
      });
      let count = 0;
      for (const row of rows) {
        if (row.dispatch !== "claimed" && row.dispatch !== "held") continue;
        if (row.dispatch === "held" && row.error === MAIL_REPLY_HASH_HOLD) continue;
        const key = { ...scope, clientId: mailReplyClientId(row.id) };
        const record = await tx.composeSend.findUnique({
          where: { spaceId_userId_clientId: key },
          select: { state: true },
        });
        // A claimed row is retried only from a failed record. Anything else may have gone out.
        if (row.dispatch === "claimed" && record?.state !== "failed") continue;
        if (row.dispatch === "held" && record && !["draft", "failed"].includes(record.state)) {
          continue;
        }
        // What was read above may be stale: another retry and its send can finish in between. The
        // row moves first, so a retry that lost it never touches the record.
        const moved = await tx.mailReplyItem.updateMany({
          where: { id: row.id, dispatch: row.dispatch, updatedAt: row.updatedAt },
          data: {
            dispatch: "queued",
            error: null,
            seenMessageId: input.rows.find((posted) => posted.itemId === row.id)?.seenMessageId,
          },
        });
        if (moved.count !== 1) continue;
        if (record?.state === "failed") {
          const reset = await tx.composeSend.updateMany({
            where: { ...key, state: "failed" },
            data: { state: "draft" },
          });
          if (reset.count !== 1) throw new RetryLostRace();
        }
        count += 1;
      }
      return { status: "queued" as const, count };
    });
  } catch (error) {
    // The whole press rolled back, so a row that moved cannot wait on a record that did not.
    if (error instanceof RetryLostRace) return { status: "queued", count: 0 };
    throw error;
  }
}

/**
 * Takes a row that did not go out to the composer. Conditional on the row being unchanged, so it
 * cannot cross with a Retry. Returns the row, or null when it may not move.
 */
export async function moveMailReplyRowToComposer(
  prisma: PrismaClient,
  input: Scope & { effectId: string; itemId: string },
) {
  const scope = { spaceId: input.spaceId, userId: input.userId };
  return prisma.$transaction(async (tx: Tx) => {
    const effect = await tx.externalEffect.findFirst({
      where: {
        id: input.effectId,
        spaceId: input.spaceId,
        kind: MAIL_REPLY_BATCH_TOOL,
        status: "completed",
      },
      select: { id: true },
    });
    if (!effect) return null;
    const row = await tx.mailReplyItem.findFirst({
      where: { ...scope, effectId: input.effectId, id: input.itemId },
    });
    // Already moved: the first response may have been lost, so the same row comes back.
    if (row?.dispatch === "composer") return row;
    if (!row || (row.dispatch !== "claimed" && row.dispatch !== "held")) return null;
    if (row.error === MAIL_REPLY_HASH_HOLD) return null;
    const record = await tx.composeSend.findUnique({
      where: { spaceId_userId_clientId: { ...scope, clientId: mailReplyClientId(row.id) } },
      select: { state: true },
    });
    const notSent =
      row.dispatch === "claimed"
        ? record?.state === "failed"
        : !record || record.state === "draft" || record.state === "failed";
    if (!notSent) return null;
    const moved = await tx.mailReplyItem.updateMany({
      where: { id: row.id, dispatch: row.dispatch, updatedAt: row.updatedAt },
      data: { dispatch: "composer" },
    });
    return moved.count === 1 ? row : null;
  });
}
