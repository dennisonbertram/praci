import { createHash } from "node:crypto";
import { runContinueJob } from "@rakazo/adapter-kit";
import type { BotMessageIntent, MessageBlock } from "@rakazo/contracts";
import {
  BOT_SHARE_DECLINED_MESSAGE,
  BOT_SHARE_EFFECT_KIND,
  BOT_SHARE_HELD_MESSAGE,
  isOwnerAgentSpawnKey,
} from "@rakazo/contracts";
import type { PrivateFragments } from "@rakazo/core";
import {
  BOT_MESSAGE_MAX_LENGTH,
  botMessageContext,
  botMessageHopExhausted,
  buildBotMessageWakePrompt,
  checkOutbound,
  clampBotMessage,
  nextBotMessageHop,
  resolveBotAddress,
} from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";
import {
  appendEventInTransaction,
  createThreadMessageInTransaction,
  isUniqueViolation,
  withTransactionRetry,
} from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import type { ExecutorDeps } from "./executor.js";
import { markMeetingTaintOnDelivery } from "./meeting-tools.js";
import { notifyThreadEvent } from "./run-notification.js";

/**
 * The hop the current run sits at, read back from the message that woke this
 * bot. A run a person started carries no bot message, so it starts at 0.
 */
export async function currentBotMessageHop(
  prisma: PrismaClient,
  sourceMessageId: string | null | undefined,
): Promise<number> {
  if (!sourceMessageId) return 0;
  const source = await prisma.message.findUnique({
    where: { id: sourceMessageId },
    select: { blocks: true },
  });
  const blocks = Array.isArray(source?.blocks) ? (source.blocks as MessageBlock[]) : [];
  return botMessageContext(blocks)?.hop ?? 0;
}

export async function loadBotMessageContext(
  prisma: PrismaClient,
  sourceMessageId: string | null | undefined,
) {
  if (!sourceMessageId) return undefined;
  const source = await prisma.message.findUnique({
    where: { id: sourceMessageId },
    select: { blocks: true, replyTo: { select: { blocks: true } } },
  });
  const context = botMessageContext(
    Array.isArray(source?.blocks) ? (source.blocks as MessageBlock[]) : [],
  );
  if (!context) return undefined;
  const replyBlocks = Array.isArray(source?.replyTo?.blocks)
    ? (source.replyTo.blocks as MessageBlock[])
    : [];
  const repliesToRequest =
    (context.intent === "result" || context.intent === "status" || context.intent === "fyi") &&
    replyBlocks.some(
      (block) =>
        block.kind === "bot_message_sent" &&
        block.toBotId === context.fromBotId &&
        (block.intent === undefined || block.intent === "request" || block.intent === "question"),
    );
  return { ...context, repliesToRequest };
}

/** The fixed refusal an external bot gets for any target its owner has not chosen. */
export const EXTERNAL_MESSAGE_REFUSED =
  "You can only message the bots your owner has chosen for you.";

export type MessageBotOptions = {
  allowTerminalSource?: boolean;
  forceUnread?: boolean;
  ownerAgentsOnly?: boolean;
  ownerOrigin?: boolean;
  /** The sending run's own mark (from its history window), which the stored chain may not carry. */
  externalChain?: { name?: string };
  /**
   * What the sending run read from private sources. Needed to send to an external bot: a message
   * to one goes out only if it repeats none of it, and with no snapshot it is held.
   */
  outbound?: () => Promise<PrivateFragments | undefined>;
  /** The owner approved this exact text on a card: skip the outbound check. */
  approvedShare?: boolean;
  /** A fixed server-written message (never model text): skip the outbound check. */
  serverText?: boolean;
  /** The sending run may be in any state (a held message is answered long after its run ended). */
  anyRunState?: boolean;
};

export type MessageBotResult =
  | { ok: false; error: string }
  | {
      ok: true;
      botId: string;
      name: string;
      delivered: string;
      note: string;
      replayed?: true;
      held?: true;
    };

type BotMessageDeps = Pick<ExecutorDeps, "prisma" | "events" | "jobs"> &
  Partial<Pick<ExecutorDeps, "notificationEvents">>;

export async function messageBot(
  deps: BotMessageDeps,
  run: {
    id: string;
    spaceId: string;
    threadId: string;
    botId: string;
    userId: string;
    sourceMessageId?: string | null;
  },
  sender: { id: string; name: string },
  input: {
    bot_id?: string;
    confirm_name?: string;
    message: string;
    intent?: BotMessageIntent;
    deliveryKey?: string;
  },
  options?: MessageBotOptions,
): Promise<MessageBotResult> {
  const message = String(input.message ?? "").trim();
  if (!message) return { ok: false as const, error: "message is required" };
  if (message.length > BOT_MESSAGE_MAX_LENGTH) {
    return {
      ok: false as const,
      error: `message exceeds the ${BOT_MESSAGE_MAX_LENGTH} character limit`,
    };
  }

  const sourceContext = await loadBotMessageContext(deps.prisma, run.sourceMessageId);
  const intent = input.intent ?? "request";
  const hop = nextBotMessageHop(sourceContext?.hop);

  // The sender's audience comes from the database, never from the call. An external bot may
  // message only the internal bots its owner chose, and may answer the bot that asked it.
  const senderRow = await deps.prisma.bot.findFirst({
    where: { id: sender.id, spaceId: run.spaceId, userId: run.userId },
    select: { audience: true, externalMessageTargets: true },
  });
  if (!senderRow) return { ok: false as const, error: "sender not found" };
  const externalSender = senderRow.audience === "external";
  const allowedTargets = new Set(senderRow.externalMessageTargets);
  const allCandidates = await deps.prisma.bot.findMany({
    where: { spaceId: run.spaceId, userId: run.userId, archivedAt: null },
    select: {
      id: true,
      name: true,
      title: true,
      spawnKey: true,
      audience: true,
      externalMessageTargets: true,
      thread: { select: { id: true } },
    },
  });
  const candidates = externalSender
    ? allCandidates.filter(
        (candidate) =>
          (candidate.audience === "internal" && allowedTargets.has(candidate.id)) ||
          // The automatic return reaches its caller only while the caller is still internal.
          (options?.allowTerminalSource === true &&
            candidate.id === sourceContext?.fromBotId &&
            candidate.audience === "internal"),
      )
    : allCandidates;
  const target = resolveBotAddress(candidates, {
    botId: input.bot_id,
    name: input.confirm_name,
  });
  if (!target) {
    return {
      ok: false as const,
      error: externalSender ? EXTERNAL_MESSAGE_REFUSED : "no bot found with that id or name",
    };
  }
  if (target.id === sender.id) return { ok: false as const, error: "a bot cannot message itself" };
  if (!target.thread)
    return { ok: false as const, error: `${target.name} has no chat to deliver to` };
  const returnsToSender =
    options?.allowTerminalSource === true &&
    (intent === "result" || intent === "status") &&
    (sourceContext?.intent === undefined ||
      sourceContext.intent === "request" ||
      sourceContext.intent === "question") &&
    sourceContext?.fromBotId === target.id;
  if (
    externalSender &&
    !returnsToSender &&
    !(allowedTargets.has(target.id) && target.audience === "internal")
  ) {
    return { ok: false as const, error: EXTERNAL_MESSAGE_REFUSED };
  }
  // A result going back to a bot that is now external is delivered only if that bot's owner
  // allowed it to message this sender; the caller's old standing as an internal bot is not enough.
  if (
    returnsToSender &&
    target.audience === "external" &&
    !target.externalMessageTargets.includes(sender.id)
  ) {
    return { ok: false as const, error: EXTERNAL_MESSAGE_REFUSED };
  }
  // A chain that began in a background run stays limited to owner agents, except answering its caller.
  const ownerAgentsOnly =
    options?.ownerAgentsOnly === true || sourceContext?.backgroundOrigin === true;
  if (ownerAgentsOnly && !returnsToSender && !isOwnerAgentSpawnKey(target.spawnKey))
    return {
      ok: false as const,
      error: "a background run can only message an agent that owns an account",
    };
  if (botMessageHopExhausted(hop) && !returnsToSender) {
    return {
      ok: false as const,
      error:
        "bot-to-bot message limit reached for this chain; report back to the user instead of messaging another bot",
    };
  }

  // Anything on its way to an external bot is checked against what this run read from private
  // sources. A flagged message is not sent: the owner sees it on a card and the external bot is
  // told, in fixed words, that it needs approval.
  if (target.audience === "external" && !options?.approvedShare && !options?.serverText) {
    // An earlier delivery under this key (a retried status or result) is replayed, never held again.
    if (input.deliveryKey) {
      const already = await deps.prisma.message.findUnique({
        where: {
          threadId_clientNonce: {
            threadId: target.thread.id,
            clientNonce: `bot-message:${input.deliveryKey}`,
          },
        },
        select: { id: true },
      });
      if (already) {
        return {
          ok: true as const,
          botId: target.id,
          name: target.name,
          delivered: message,
          replayed: true as const,
          note: `Already sent to ${target.name} in this turn; it was not sent again.`,
        };
      }
    }
    const fragments = options?.outbound ? await options.outbound() : undefined;
    // No snapshot means the run's reads are unknown, so the message is held.
    if (!fragments || !checkOutbound({ text: message, fragments }).allow) {
      return holdShare(deps, run, sender, target, message, intent, options, input.deliveryKey);
    }
  }

  const targetThreadId = target.thread.id;

  // A tool call can be re-executed after a lease expiry, so a delivery has to be
  // replayable: without this the recipient is messaged twice and woken twice.
  const deliveryKey = input.deliveryKey ? `bot-message:${input.deliveryKey}` : undefined;
  const replayed = () =>
    ({
      ok: true as const,
      botId: target.id,
      name: target.name,
      delivered: message,
      replayed: true as const,
      note: `Already sent to ${target.name} in this turn; it was not sent again.`,
    }) as const;

  // The mark is only ever added along a chain: it comes from the sender's stored audience or the
  // incoming chain, never from the call or the message text.
  const externalOrigin =
    externalSender ||
    sourceContext?.externalOrigin === true ||
    options?.externalChain !== undefined;
  const externalOriginName = externalOrigin
    ? externalSender
      ? sender.name
      : (sourceContext?.externalOriginName ?? options?.externalChain?.name)
    : undefined;
  const wakePrompt = buildBotMessageWakePrompt({
    from: sender,
    text: message,
    intent,
    externalOrigin,
    externalName: externalOriginName,
  });
  const outboundBlock: MessageBlock = {
    kind: "bot_message_sent",
    toBotId: target.id,
    toBotName: target.name,
    text: message,
    intent,
  };

  let committed:
    | {
        ok: true;
        runId: string;
        targetEventSeq: number;
        senderEventSeq: number;
      }
    | {
        ok: false;
        error: string;
      }
    | {
        ok: true;
        replayed: true;
      };
  try {
    committed = await withTransactionRetry(() =>
      deps.prisma.$transaction(async (tx) => {
        for (const threadId of [run.threadId, targetThreadId].sort()) {
          await tx.$queryRaw`SELECT id FROM threads WHERE id = ${threadId} FOR UPDATE`;
        }
        // Claim the delivery key inside the transaction so a concurrent retry
        // either sees the winner or loses on the unique (threadId, clientNonce).
        if (deliveryKey) {
          const already = await tx.message.findUnique({
            where: { threadId_clientNonce: { threadId: targetThreadId, clientNonce: deliveryKey } },
            select: { id: true },
          });
          if (already) return { ok: true as const, replayed: true as const };
        }

        const senderStillRunning = await tx.run.findFirst({
          where: {
            id: run.id,
            spaceId: run.spaceId,
            threadId: run.threadId,
            botId: run.botId,
            userId: run.userId,
            // A held message is answered whatever the sender's run is doing (paused, queued, done).
            status: options?.anyRunState
              ? undefined
              : options?.allowTerminalSource
                ? { in: ["completed", "failed", "cancelled"] }
                : "running",
          },
          select: { id: true },
        });
        if (!senderStillRunning)
          return { ok: false as const, error: "source run is no longer active" };

        // Re-read the target inside the transaction: it can be archived between
        // resolving it above and committing here.
        const stillAddressable = await tx.bot.findFirst({
          where: {
            id: target.id,
            spaceId: run.spaceId,
            userId: run.userId,
            archivedAt: null,
          },
          select: { id: true },
        });
        if (!stillAddressable)
          return { ok: false as const, error: `${target.name} is no longer available` };

        // Echo into the sender's chat in the same transaction so a failed notify
        // cannot leave one side delivered and the other blank.
        const outbound = await createThreadMessageInTransaction(tx, {
          threadId: run.threadId,
          role: "bot",
          blocks: [outboundBlock],
          botId: run.botId,
          runId: run.id,
          markUnread: options?.forceUnread === true,
          allowCancelledRun: options?.allowTerminalSource === true || options?.anyRunState === true,
        });
        const inboundBlock: MessageBlock = {
          kind: "bot_message_received",
          fromBotId: sender.id,
          fromBotName: sender.name,
          text: message,
          hop,
          intent,
          returnToMessageId: outbound.id,
          ...(ownerAgentsOnly ? { backgroundOrigin: true } : {}),
          ...(externalOrigin
            ? {
                externalOrigin: true,
                ...(externalOriginName ? { externalOriginName } : {}),
              }
            : {}),
          // Answering the chain's caller keeps the chain's own origin.
          ...((options?.ownerOrigin ?? (returnsToSender && sourceContext?.ownerOrigin === true))
            ? { ownerOrigin: true }
            : {}),
        };
        await markMeetingTaintOnDelivery(tx, {
          spaceId: run.spaceId,
          userId: run.userId,
          senderBotId: sender.id,
          sourceThreadId: run.threadId,
          targetThreadId,
        });
        const inbound = await createThreadMessageInTransaction(tx, {
          threadId: targetThreadId,
          role: "user",
          blocks: [inboundBlock],
          replyToMessageId:
            sourceContext?.fromBotId === target.id && intent !== "fyi"
              ? sourceContext.returnToMessageId
              : undefined,
          clientNonce: deliveryKey,
          markUnread: options?.forceUnread === true,
        });
        const task = await tx.task.create({
          data: {
            spaceId: run.spaceId,
            botId: target.id,
            threadId: targetThreadId,
            userId: run.userId,
            prompt: wakePrompt,
            status: "queued",
          },
        });
        const nextRun = await tx.run.create({
          data: {
            spaceId: run.spaceId,
            botId: target.id,
            threadId: targetThreadId,
            taskId: task.id,
            userId: run.userId,
            status: "queued",
            trigger: "bot_message",
            sourceMessageId: inbound.id,
          },
          select: { id: true },
        });
        await tx.message.update({ where: { id: inbound.id }, data: { runId: nextRun.id } });
        const inboundEvent = await appendEventInTransaction(tx, {
          spaceId: run.spaceId,
          threadId: targetThreadId,
          botId: target.id,
          type: "thread.message.created",
          runId: nextRun.id,
          payload: {
            messageId: inbound.id,
            role: "user",
            blocks: [inboundBlock],
            // Lets the receiving thread tell which of its requests this answers.
            ...(sourceContext?.fromBotId === target.id && intent !== "fyi"
              ? { replyToMessageId: sourceContext.returnToMessageId }
              : {}),
          },
        });
        const outboundEvent = await appendEventInTransaction(tx, {
          spaceId: run.spaceId,
          threadId: run.threadId,
          botId: run.botId,
          type: "thread.message.created",
          runId: run.id,
          allowCancelledRun: options?.allowTerminalSource === true || options?.anyRunState === true,
          payload: { messageId: outbound.id, role: "bot", blocks: [outboundBlock] },
        });
        return {
          ok: true as const,
          runId: nextRun.id,
          targetEventSeq: inboundEvent.seq,
          senderEventSeq: outboundEvent.seq,
        };
      }),
    );
  } catch (error) {
    // Two concurrent retries can both miss the in-transaction lookup; the
    // loser hits the unique key. Treat that as a successful replay.
    if (deliveryKey && isUniqueViolation(error)) {
      const winner = await deps.prisma.message.findUnique({
        where: { threadId_clientNonce: { threadId: targetThreadId, clientNonce: deliveryKey } },
        select: { id: true },
      });
      if (winner) return replayed();
    }
    throw error;
  }
  if ("replayed" in committed) return replayed();
  if (!committed.ok) return committed;

  await deps.events.notify(targetThreadId, committed.targetEventSeq).catch((error) => {
    getLogger().error("bot message realtime notification", error);
  });
  await deps.events.notify(run.threadId, committed.senderEventSeq).catch((error) => {
    getLogger().error("bot message sender echo notification", error);
  });
  await deps.jobs.enqueue(runContinueJob(committed.runId)).catch((error) => {
    // The queued run is durable; the job reconciler repairs a missed wake.
    getLogger().error("bot message enqueue", error);
  });
  return {
    ok: true as const,
    botId: target.id,
    name: target.name,
    delivered: message,
    note: `Message delivered to ${target.name}. Delivery is async; a reply wakes you later as a new message. Continue independent work; send another update later only if it adds something new. If you tell the owner that you asked ${target.name} to send, pay or change something, end your reply with [Open ${target.name}](/app/${target.id}): the owner approves it in that chat.`,
  };
}

/**
 * Hold a message for the owner instead of sending it. One durable effect per (run, recipient,
 * exact text) and a card in the sender's own chat; both are written without a live run, so the
 * automatic result return, which runs after the model has stopped, can hold too. The external bot
 * gets a fixed server-written message so it can tell the person. Nothing the model wrote reaches
 * it until the owner approves this exact text (see answerBotShare).
 */
async function holdShare(
  deps: BotMessageDeps,
  run: {
    id: string;
    spaceId: string;
    threadId: string;
    botId: string;
    userId: string;
    sourceMessageId?: string | null;
  },
  sender: { id: string; name: string },
  target: { id: string; name: string },
  message: string,
  intent: BotMessageIntent,
  options?: MessageBotOptions,
  deliveryKey?: string,
): Promise<MessageBotResult> {
  // One hold per delivery key when the call has one (a retried status or result must not make a
  // second card, whatever its text), otherwise per exact text.
  const idempotencyKey = `bot-share:${run.id}:${
    deliveryKey ??
    createHash("sha256").update(`${target.id}\0${message}`).digest("hex").slice(0, 40)
  }`;
  const heldResult = {
    ok: true as const,
    botId: target.id,
    name: target.name,
    held: true as const,
    delivered: BOT_SHARE_HELD_MESSAGE,
    note: `This needs the owner's approval before it can be shared with ${target.name}. ${target.name} was told so and nothing else was sent.`,
  };
  const terminal = options?.allowTerminalSource === true || options?.anyRunState === true;
  let created: { effectId: string; seq: number } | undefined;
  try {
    created = await withTransactionRetry(() =>
      deps.prisma.$transaction(async (tx) => {
        const existing = await tx.externalEffect.findUnique({ where: { idempotencyKey } });
        if (existing) return undefined;
        const effect = await tx.externalEffect.create({
          data: {
            spaceId: run.spaceId,
            runId: run.id,
            kind: BOT_SHARE_EFFECT_KIND,
            idempotencyKey,
            status: "intended",
            request: {
              fromBotId: sender.id,
              toBotId: target.id,
              text: message,
              intent,
              // Approval delivers under the original key, so a later retry of the same status or
              // result finds it delivered instead of sending it twice.
              deliveryKey: deliveryKey ?? null,
              replay: {
                allowTerminalSource: options?.allowTerminalSource === true,
                forceUnread: options?.forceUnread === true,
                ownerAgentsOnly: options?.ownerAgentsOnly === true,
                ownerOrigin: options?.ownerOrigin === true,
                externalChain: options?.externalChain ?? null,
              },
            },
          },
        });
        const blocks: MessageBlock[] = [
          {
            kind: "ask",
            approvalEffectId: effect.id,
            share: true,
            text: `Share with ${target.name}?`,
            detail: message,
            status: "pending",
            actions: [
              { id: "allow", label: "Share" },
              { id: "deny", label: "Don't share" },
            ],
          },
        ];
        const card = await createThreadMessageInTransaction(tx, {
          threadId: run.threadId,
          role: "bot",
          blocks,
          botId: run.botId,
          runId: run.id,
          markUnread: true,
          allowCancelledRun: terminal,
        });
        const event = await appendEventInTransaction(tx, {
          spaceId: run.spaceId,
          threadId: run.threadId,
          botId: run.botId,
          type: "thread.message.created",
          runId: run.id,
          allowCancelledRun: terminal,
          payload: { messageId: card.id, role: "bot", blocks },
        });
        return { effectId: effect.id, seq: event.seq };
      }),
    );
  } catch (error) {
    // A concurrent retry created it first: the card already exists.
    if (!isUniqueViolation(error)) throw error;
  }
  const existing = created
    ? undefined
    : await deps.prisma.externalEffect.findUnique({ where: { idempotencyKey } });
  const effectId = created?.effectId ?? existing?.id;
  if (!effectId) return heldResult;
  // Already shared: nothing to hold or tell.
  if (existing?.status === "completed") {
    return { ...heldResult, held: undefined, note: `Already sent to ${target.name}.` };
  }
  // Once the owner has answered (or an approval is in flight) "needs approval" is stale: a retry
  // sends nothing. A decline reaches the external bot through its own idempotent notice.
  if (existing && existing.status !== "intended") {
    return {
      ...heldResult,
      held: undefined,
      delivered: existing.status === "denied" ? BOT_SHARE_DECLINED_MESSAGE : heldResult.delivered,
      note:
        existing.status === "denied"
          ? `The owner declined to share this with ${target.name}.`
          : `The owner approved this; it is being sent to ${target.name}.`,
    };
  }
  if (created) {
    await deps.events.notify(run.threadId, created.seq).catch((error) => {
      getLogger().error("held share realtime notification", error);
    });
    // Tell the owner; the body names the recipient only, never the held text.
    try {
      await notifyThreadEvent(
        deps.prisma,
        deps.notificationEvents,
        { ...run, botId: run.botId },
        {
          kind: "help",
          title: `${sender.name} needs approval`,
          body: `Share with ${target.name}?`,
          botId: run.botId,
          threadId: run.threadId,
        },
        `${effectId}\nshare`,
      );
    } catch (error) {
      getLogger().error("held share notification", error);
    }
  }
  // The fixed notice is attempted on every pass, created or retried: its delivery key makes it
  // replay-safe, and a retry after a lost notice sends it.
  const told = await messageBot(
    deps,
    run,
    sender,
    {
      bot_id: target.id,
      message: BOT_SHARE_HELD_MESSAGE,
      intent,
      deliveryKey: `share-held:${effectId}`,
    },
    { ...options, serverText: true, outbound: undefined },
  );
  if (!told.ok) return told;
  return heldResult;
}

/**
 * Whether text may go to an external bot by a route that cannot hold it for approval (a group
 * handoff, an agent message): only if it repeats nothing the run read. Unknown reads refuse.
 */
export async function mayReachExternalBot(
  text: string,
  outbound?: () => Promise<PrivateFragments | undefined>,
): Promise<boolean> {
  const fragments = outbound ? await outbound() : undefined;
  return fragments !== undefined && checkOutbound({ text, fragments }).allow;
}

/** The fixed refusal for a route that cannot hold a message for the owner. */
export const EXTERNAL_HAND_OFF_REFUSED =
  "This may repeat private information, so it was not sent to an external bot. Tell the owner instead.";

/** Return a delegated run's terminal outcome unless it already sent one explicitly. */
export async function returnBotMessageOutcome(
  deps: BotMessageDeps,
  run: {
    id: string;
    spaceId: string;
    threadId: string;
    botId: string;
    userId: string;
    sourceMessageId?: string | null;
  },
  sender: { id: string; name: string },
  text: string,
  intent: "result" | "status" = "result",
  options?: {
    forceUnread?: boolean;
    externalChain?: { name?: string };
    outbound?: () => Promise<PrivateFragments | undefined>;
    /** Called when the outcome was held for the owner instead of sent. */
    onHeld?: () => void;
  },
) {
  const source = await loadBotMessageContext(deps.prisma, run.sourceMessageId);
  if (!source) {
    await markBotOutcomeReturned(deps.prisma, run.id);
    // Handled: nothing to deliver. Return true so callers do not release a reservation.
    return true;
  }
  const sourceIntent = source.intent ?? "request";
  if (sourceIntent !== "request" && sourceIntent !== "question") {
    await markBotOutcomeReturned(deps.prisma, run.id);
    return true;
  }
  const sent = await deps.prisma.message.findMany({
    where: { threadId: run.threadId, runId: run.id },
    select: { blocks: true },
  });
  // Only an explicit result counts as a terminal outcome. Interim message_bot
  // status updates must not suppress the automatic final return.
  const alreadyReturned = sent.some((message) =>
    (Array.isArray(message.blocks) ? (message.blocks as MessageBlock[]) : []).some(
      (block) =>
        block.kind === "bot_message_sent" &&
        block.toBotId === source.fromBotId &&
        block.intent === "result",
    ),
  );
  if (alreadyReturned) {
    await markBotOutcomeReturned(deps.prisma, run.id);
    return true;
  }
  const outcome = await messageBot(
    deps,
    run,
    sender,
    {
      bot_id: source.fromBotId,
      message: clampBotMessage(text),
      intent,
      // One key per run so status vs result (executor vs reconciler) cannot double-deliver.
      deliveryKey: `auto-outcome:${run.id}`,
    },
    {
      allowTerminalSource: true,
      forceUnread: options?.forceUnread,
      externalChain: options?.externalChain,
      outbound: options?.outbound,
    },
  );
  if (outcome.ok) {
    if (outcome.held) options?.onHeld?.();
    await markBotOutcomeReturned(deps.prisma, run.id);
  }
  return outcome.ok;
}

async function markBotOutcomeReturned(prisma: PrismaClient, runId: string) {
  await prisma.run.updateMany({
    where: {
      id: runId,
      status: { in: ["completed", "failed", "cancelled"] },
      botOutcomeReturnedAt: null,
    },
    data: { botOutcomeReturnedAt: new Date() },
  });
}
