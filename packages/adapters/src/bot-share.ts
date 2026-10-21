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
  replay: {
    allowTerminalSource: boolean;
    forceUnread: boolean;
    ownerAgentsOnly: boolean;
    ownerOrigin: boolean;
    externalChain: { name?: string } | null;
  };
};

/**
 * The owner's answer to a held message. "allow" delivers the text stored with the effect, exactly
 * and once (the claim moves intended to executing in one update, and the delivery key makes the
 * message itself replay-safe); the client sends no text, so nothing can be edited in. "deny"
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

  const claimed = await deps.prisma.externalEffect.updateMany({
    where: { id: effect.id, status: "intended" },
    data: { status: input.answer === "allow" ? "executing" : "denied" },
  });
  if (claimed.count !== 1) return false;

  const sender = { id: run.botId, name: run.bot.name };
  const common: MessageBotOptions = {
    ...request.replay,
    externalChain: request.replay.externalChain ?? undefined,
    anyRunState: true,
    serverText: undefined,
  };
  if (input.answer === "allow") {
    // The stored text, with the stored options of the original call, and no new check.
    const release = () =>
      deps.prisma.externalEffect.updateMany({
        where: { id: effect.id, status: "executing" },
        data: { status: "intended" },
      });
    let sent: Awaited<ReturnType<typeof messageBot>>;
    try {
      sent = await messageBot(
        deps,
        run,
        sender,
        {
          bot_id: request.toBotId,
          message: request.text,
          intent: request.intent,
          deliveryKey: `share:${effect.id}`,
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
  } else {
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
    if (!told.ok) getLogger().error("held share decline notice", new Error(told.error));
  }
  await markCardAnswered(deps, scope, run.botId, input.runId, message, input.answer);
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
