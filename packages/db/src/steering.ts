import type { MessageBlock } from "@rakazo/contracts";
import {
  blocksToAgentHistoryText,
  isConversationalRun,
  messagingChannelId,
  newRunExternalTaint,
  newRunUnattended,
} from "@rakazo/core";
import type { Prisma, PrismaClient } from "./client.js";
import type { ClaimedSteeringMessage, ClaimSteeringInput } from "./events.js";
import { appendEventInTransaction } from "./events.js";
import { THREAD_LOCK_TRANSACTION_OPTIONS } from "./thread-lock.js";

export async function claimSteering(
  prisma: PrismaClient,
  input: ClaimSteeringInput,
): Promise<ClaimedSteeringMessage[]> {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$queryRaw`SELECT id FROM threads WHERE id = ${input.threadId} FOR UPDATE`;
    const run = await tx.run.findFirst({
      where: {
        id: input.runId,
        threadId: input.threadId,
        botId: input.botId,
        status: "running",
        leaseOwner: input.leaseOwner,
        leaseFence: input.leaseFence,
      },
      select: {
        id: true,
        spaceId: true,
        trigger: true,
        sourceMessage: { select: { blocks: true } },
      },
    });
    if (!run || run.trigger === "created") return [];
    const channelId =
      run.trigger === "messaging"
        ? messagingChannelId(run.sourceMessage?.blocks as MessageBlock[] | undefined)
        : undefined;
    const directMessage = run.trigger === "messaging" && !channelId;
    // Pending rows from another chat stay for their own continuation.
    const pendingWhere = directMessage
      ? { runId: null, originTrigger: "messaging" }
      : channelId
        ? { runId: null }
        : { runId: null, originTrigger: null };
    const steering = await tx.steeringMessage.findMany({
      where: {
        botId: input.botId,
        id: input.seenIds.length ? { notIn: input.seenIds } : undefined,
        // A routine or webhook turn only takes steering addressed to it; pending user messages
        // wait for the conversational continuation that starts once it finishes.
        OR: isConversationalRun(run.trigger)
          ? [pendingWhere, { runId: input.runId }]
          : [{ runId: input.runId }],
        message: {
          threadId: input.threadId,
          // A run built without the external mark leaves marked messages for their own run.
          ...(input.excludeExternalOrigin
            ? {
                AND: [
                  {
                    NOT: {
                      blocks: {
                        array_contains: [{ kind: "bot_message_received", externalOrigin: true }],
                      },
                    },
                  },
                ],
              }
            : {}),
          // Private follow-ups remain unclaimed for the existing private continuation.
          ...(channelId
            ? { blocks: { array_contains: [{ kind: "channel_message", channelId }] } }
            : directMessage
              ? { NOT: { blocks: { array_contains: [{ kind: "channel_message" }] } } }
              : {}),
        },
      },
      include: { message: { select: { blocks: true, seq: true } } },
      orderBy: [{ message: { seq: "asc" } }, { id: "asc" }],
    });
    // A held delivery is never read by a running run: it waits for its own continuation, which
    // carries the right taint, unattended flag and connection. Ordinary steering still applies.
    const claimable = steering.filter(
      (item) => item.runId != null || !rowHoldsOutsideDelivery(item),
    );
    if (claimable.length === 0) return [];
    await tx.steeringMessage.updateMany({
      where: { id: { in: claimable.map((item) => item.id) }, claimedAt: null },
      data: { runId: input.runId, claimedAt: new Date() },
    });
    // The thread lock serializes this watermark with message writes. Unlike claim
    // timestamps, it cannot drift from the database clock or tie with a reply.
    const { nextMessageSeq } = await tx.thread.findUniqueOrThrow({
      where: { id: input.threadId },
      select: { nextMessageSeq: true },
    });
    await appendEventInTransaction(tx, {
      threadId: input.threadId,
      spaceId: run.spaceId,
      botId: input.botId,
      runId: input.runId,
      type: "run.steering.claimed",
      payload: { steeringIds: claimable.map((item) => item.id), nextMessageSeq },
    });
    return claimable.map((item) => ({
      id: item.id,
      messageId: item.messageId,
      // A delivery bubble is only a label; the model's full fenced text rides on the row.
      text: item.prompt ?? blocksToAgentHistoryText(item.message.blocks as MessageBlock[]),
      blocks: item.message.blocks as MessageBlock[],
    }));
  }, THREAD_LOCK_TRANSACTION_OPTIONS);
}

export async function discardAnsweredSteering(
  tx: Prisma.TransactionClient,
  input: { threadId: string; runId: string },
) {
  const lastReply = await tx.message.findFirst({
    where: {
      threadId: input.threadId,
      runId: input.runId,
      role: "bot",
      blocks: { array_contains: [{ kind: "text" }] },
      NOT: ["ask", "computer", "steps", "subagent"].map((kind) => ({
        blocks: { array_contains: [{ kind }] },
      })),
    },
    orderBy: { seq: "desc" },
    select: { seq: true },
  });
  if (!lastReply) return;
  const claims = await tx.event.findMany({
    where: { threadId: input.threadId, runId: input.runId, type: "run.steering.claimed" },
    select: { payload: true },
  });
  const answeredIds = new Set<string>();
  for (const claim of claims) {
    const payload = claim.payload as { steeringIds?: unknown; nextMessageSeq?: unknown } | null;
    if (!payload || !Array.isArray(payload.steeringIds)) continue;
    for (const id of payload.steeringIds) {
      if (typeof id !== "string") continue;
      if (typeof payload.nextMessageSeq === "number" && payload.nextMessageSeq <= lastReply.seq) {
        answeredIds.add(id);
      }
    }
  }
  // Old runs without a durable claim watermark are deliberately replayed.
  if (answeredIds.size === 0) return;
  await tx.steeringMessage.deleteMany({
    where: { runId: input.runId, claimedAt: { not: null }, id: { in: [...answeredIds] } },
  });
}

/** Queue one follow-up when this bot still has unclaimed steering and no live run. */
export async function createPendingSteeringRun(
  tx: Prisma.TransactionClient,
  input: { spaceId: string; threadId: string; botId: string },
): Promise<string | null> {
  const active = await tx.run.findFirst({
    where: {
      threadId: input.threadId,
      botId: input.botId,
      status: { in: ["queued", "leased", "running", "waiting_input", "waiting_takeover"] },
    },
    select: { id: true },
  });
  if (active) return null;
  const pending = await tx.steeringMessage.findMany({
    where: {
      botId: input.botId,
      runId: null,
      message: { threadId: input.threadId },
    },
    include: { message: { select: { id: true, blocks: true, seq: true } } },
    orderBy: [{ message: { seq: "asc" } }, { id: "asc" }],
  });
  if (pending.length === 0) return null;
  // One origin per continuation so a group channel and a direct chat are not answered together.
  const origin = steeringOrigin(pending[0]!);
  // Rows pinned to different connections never share a run; the rest wait for the next one.
  const pinKey = (item: (typeof pending)[number]) =>
    [item.modelProvider, item.modelId, item.modelCredentialId, item.thinkingLevel].join("|");
  const first = pending[0]!;
  const batch = pending.filter(
    (item) =>
      steeringOrigin(item) === origin &&
      (!pending.some((row) => row.modelCredentialId) || pinKey(item) === pinKey(first)),
  );
  const source = batch.at(-1)!;
  const modelPin = continuationModelPin(batch);
  // Queued deliveries that all name one routine hand it to their continuation; a batch with
  // several routines, or a user message beside one, has no single owner.
  const routineIds = new Set(batch.map((item) => item.routineId));
  const sharedRoutineId = routineIds.size === 1 ? batch[0]!.routineId : null;
  const routineId = sharedRoutineId
    ? (
        await tx.routine.findFirst({
          where: { id: sharedRoutineId, botId: input.botId, spaceId: input.spaceId },
          select: { id: true },
        })
      )?.id
    : undefined;
  const task = await tx.task.create({
    data: {
      spaceId: input.spaceId,
      botId: input.botId,
      threadId: input.threadId,
      userId: batch[0]!.userId,
      prompt: "Respond to the user's steering context.",
      status: "queued",
    },
  });
  const trigger = origin === "app" ? "follow_up" : "messaging";
  // The continuation answers what waited, so it keeps their mode: any outside content taints it,
  // and it is unattended only when nobody in the batch has someone present.
  const unattended = newRunUnattended({ trigger }) || batch.every(rowUnattended);
  const externalTaint = newRunExternalTaint({ trigger }) || batch.some(rowExternalTaint);
  const goal = await tx.threadGoal.findFirst({
    where: {
      spaceId: input.spaceId,
      userId: batch[0]!.userId,
      threadId: input.threadId,
      status: "active",
    },
    select: { id: true },
  });
  const run = await tx.run.create({
    data: {
      spaceId: input.spaceId,
      botId: input.botId,
      threadId: input.threadId,
      taskId: task.id,
      userId: batch[0]!.userId,
      status: "queued",
      trigger,
      // The owner typing in the app is attended; a queued inbound keeps the mode it was held with.
      unattended,
      externalTaint,
      sourceMessageId: source.message.id,
      goalId: goal?.id,
      ...(routineId ? { routineId } : {}),
      ...(modelPin ?? {}),
    },
  });
  await tx.steeringMessage.updateMany({
    where: { id: { in: batch.map((item) => item.id) }, runId: null },
    data: { runId: run.id, claimedAt: null },
  });
  return run.id;
}

const INBOUND_PAYLOAD_FENCE = "<untrusted_delivery_payload";

type SteeringRow = {
  prompt?: string | null;
  unattended?: boolean | null;
  externalTaint?: boolean | null;
  message: { blocks: unknown };
};

/** Rows queued before the mode was stored still carry an inbound payload in their text. */
function rowCarriesInboundPayload(item: SteeringRow): boolean {
  const text = item.prompt ?? JSON.stringify(item.message.blocks);
  return text.includes(INBOUND_PAYLOAD_FENCE);
}

/**
 * A row that holds a delivery for the model. It keeps its own continuation rather than joining a
 * running run, so no active run can read outside content without the delivery's mode.
 */
function rowHoldsOutsideDelivery(item: SteeringRow): boolean {
  return item.prompt != null || rowExternalTaint(item);
}

/** Outside content taints the run that reads it; an unmarked legacy row is judged by its text. */
function rowExternalTaint(item: SteeringRow): boolean {
  return (
    item.externalTaint === true || (item.externalTaint == null && rowCarriesInboundPayload(item))
  );
}

/** Nobody is present for outside content; a legacy row with the fence counts the same way. */
function rowUnattended(item: SteeringRow): boolean {
  return item.unattended === true || (item.unattended == null && rowCarriesInboundPayload(item));
}

function continuationModelPin(
  batch: ReadonlyArray<{
    modelProvider?: string | null;
    modelId?: string | null;
    modelCredentialId?: string | null;
    thinkingLevel?: string | null;
  }>,
) {
  const first = batch[0];
  if (!first?.modelProvider || !first.modelId) return null;
  const agreed = batch.every(
    (item) =>
      item.modelProvider === first.modelProvider &&
      item.modelId === first.modelId &&
      (item.modelCredentialId ?? null) === (first.modelCredentialId ?? null) &&
      (item.thinkingLevel ?? null) === (first.thinkingLevel ?? null),
  );
  if (!agreed) return null;
  return {
    modelProvider: first.modelProvider,
    modelId: first.modelId,
    modelCredentialId: first.modelCredentialId ?? null,
    thinkingLevel: first.thinkingLevel ?? null,
    modelPinned: true,
  };
}

function steeringOrigin(item: {
  originTrigger: string | null;
  message: { blocks: unknown };
}): string {
  if (item.originTrigger !== "messaging") return "app";
  const channelId = messagingChannelId(item.message.blocks as MessageBlock[] | undefined);
  return channelId ? `channel:${channelId}` : "dm";
}
