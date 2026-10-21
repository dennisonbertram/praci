import { BOT_SHARE_DECLINED_MESSAGE, BOT_SHARE_EFFECT_KIND, MessageBlock } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { appendEventInTransaction } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import type { MessageBotOptions } from "./bot-messages.js";
import { messageBot } from "./bot-messages.js";
import type { ExecutorDeps } from "./executor.js";

type ShareDeps = Pick<ExecutorDeps, "prisma" | "events" | "jobs">;

/** The held-share effect a card belongs to, or null when the card is anything else. */
export async function findBotShareEffect(
  prisma: PrismaClient,
  scope: { spaceId: string; userId: string; threadId: string },
  input: { runId: string; messageId: string },
) {
  const message = await prisma.message.findFirst({
    where: {
      id: input.messageId,
      threadId: scope.threadId,
      runId: input.runId,
      role: "bot",
      thread: { spaceId: scope.spaceId, userId: scope.userId },
    },
    select: { id: true, blocks: true },
  });
  const parsed = MessageBlock.array().safeParse(message?.blocks);
  if (!message || !parsed.success) return null;
  const ask = parsed.data.find((block) => block.kind === "ask" && block.share === true);
  if (ask?.kind !== "ask" || !ask.approvalEffectId) return null;
  const effect = await prisma.externalEffect.findFirst({
    where: {
      id: ask.approvalEffectId,
      spaceId: scope.spaceId,
      runId: input.runId,
      kind: BOT_SHARE_EFFECT_KIND,
    },
  });
  if (!effect) return null;
  return { message: { id: message.id, blocks: parsed.data }, effect };
}

type ShareRequest = {
  fromBotId: string;
  toBotId: string;
  text: string;
  intent: "request" | "result" | "question" | "status" | "fyi";
  deliveryKey?: string | null;
  replay: {
    allowTerminalSource: boolean;
    forceUnread: boolean;
    ownerAgentsOnly: boolean;
    ownerOrigin: boolean;
    externalChain: { name?: string } | null;
  };
};

/** A claimed share that has not finished within this long is taken to be stranded by a crash. */
const STRANDED_AFTER_MS = 30_000;

/**
 * The owner's answer to a held message. "allow" delivers the text stored with the effect, exactly
 * and once: the claim moves intended to executing in one update, and the message itself carries
 * the original call's delivery key, so a replay (even after a crash between the claim and the
 * completion) finds it delivered. The card stays pending until delivery succeeded, so a stranded
 * share can be answered again. The client sends no text, so nothing can be edited in. "deny"
 * delivers nothing but a fixed server-written reply. Returns false when the card is no longer
 * answerable (already answered, replayed, or not this owner's).
 */
export async function answerBotShare(
  deps: ShareDeps,
  scope: { spaceId: string; userId: string; threadId: string },
  input: { runId: string; messageId: string; answer: string },
): Promise<boolean> {
  if (input.answer !== "allow" && input.answer !== "deny") return false;
  const found = await findBotShareEffect(deps.prisma, scope, input);
  if (!found) return false;
  const { effect, message } = found;
  const cardPending = message.blocks.some(
    (block) => block.kind === "ask" && block.share === true && block.status !== "answered",
  );
  if (!cardPending) return false;
  const run = await deps.prisma.run.findFirst({
    where: {
      id: input.runId,
      spaceId: scope.spaceId,
      userId: scope.userId,
      threadId: scope.threadId,
    },
    select: {
      id: true,
      spaceId: true,
      threadId: true,
      botId: true,
      userId: true,
      sourceMessageId: true,
      bot: { select: { name: true } },
    },
  });
  if (!run) return false;
  const request = effect.request as unknown as ShareRequest;
  // The card belongs to the bot that held the message; the stored request must agree.
  if (request.fromBotId !== run.botId) return false;
  const sender = { id: run.botId, name: run.bot.name };
  const common: MessageBotOptions = {
    ...request.replay,
    externalChain: request.replay.externalChain ?? undefined,
    anyRunState: true,
  };

  if (input.answer === "allow") {
    if (effect.status === "completed") {
      // Delivered, but the card was not marked (a crash between the two): finish the bookkeeping.
      await markCardAnswered(deps, scope, run.botId, input.runId, message, "allow");
      return true;
    }
    const claimed =
      effect.status === "intended"
        ? await deps.prisma.externalEffect.updateMany({
            where: { id: effect.id, status: "intended" },
            data: { status: "executing" },
          })
        : effect.status === "executing"
          ? // Stranded by a crash: take it over. The delivery key makes the resend a replay.
            await deps.prisma.externalEffect.updateMany({
              where: {
                id: effect.id,
                status: "executing",
                updatedAt: { lt: new Date(Date.now() - STRANDED_AFTER_MS) },
              },
              data: { status: "executing" },
            })
          : { count: 0 };
    if (claimed.count !== 1) return false;
    const release = () =>
      deps.prisma.externalEffect.updateMany({
        where: { id: effect.id, status: "executing" },
        data: { status: "intended" },
      });
    let sent: Awaited<ReturnType<typeof messageBot>>;
    try {
      // The stored text, with the stored options and the original delivery key, and no new check.
      sent = await messageBot(
        deps,
        run,
        sender,
        {
          bot_id: request.toBotId,
          message: request.text,
          intent: request.intent,
          deliveryKey: request.deliveryKey ?? `share:${effect.id}`,
        },
        { ...common, approvedShare: true },
      );
    } catch (error) {
      // Nothing was committed: let the owner try again.
      await release();
      throw error;
    }
    if (!sent.ok) {
      await release();
      getLogger().error("held share delivery", new Error(sent.error));
      throw new Error("Could not share this message");
    }
    await deps.prisma.externalEffect.updateMany({
      where: { id: effect.id, status: "executing" },
      data: { status: "completed", result: { delivered: true } },
    });
    await markCardAnswered(deps, scope, run.botId, input.runId, message, "allow");
    return true;
  }

  // Don't share.
  if (effect.status === "intended") {
    const claimed = await deps.prisma.externalEffect.updateMany({
      where: { id: effect.id, status: "intended" },
      data: { status: "denied" },
    });
    if (claimed.count !== 1) return false;
  } else if (effect.status !== "denied") {
    return false;
  }
  // The fixed reply must be delivered before the card reads as answered; if it fails, the card
  // stays pending and the same answer finishes the job.
  const told = await messageBot(
    deps,
    run,
    sender,
    {
      bot_id: request.toBotId,
      message: BOT_SHARE_DECLINED_MESSAGE,
      intent: request.intent,
      deliveryKey: `share-declined:${effect.id}`,
    },
    { ...common, serverText: true },
  );
  if (!told.ok) {
    getLogger().error("held share decline notice", new Error(told.error));
    throw new Error("Could not send the reply");
  }
  await markCardAnswered(deps, scope, run.botId, input.runId, message, "deny");
  return true;
}

async function markCardAnswered(
  deps: ShareDeps,
  scope: { spaceId: string; threadId: string },
  botId: string,
  runId: string,
  message: { id: string; blocks: MessageBlock[] },
  answer: string,
) {
  const blocks = message.blocks.map((block) =>
    block.kind === "ask" && block.share === true
      ? { ...block, status: "answered" as const, answer }
      : block,
  );
  const seq = await deps.prisma.$transaction(async (tx) => {
    await tx.message.update({ where: { id: message.id }, data: { blocks } });
    const event = await appendEventInTransaction(tx, {
      spaceId: scope.spaceId,
      threadId: scope.threadId,
      botId,
      type: "thread.message.updated",
      runId,
      allowCancelledRun: true,
      payload: { messageId: message.id, role: "bot", blocks },
    });
    return event.seq;
  });
  await deps.events.notify(scope.threadId, seq).catch((error) => {
    getLogger().error("held share answer notification", error);
  });
}
