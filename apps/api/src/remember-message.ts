import type { MemoryStore } from "@rakazo/adapter-kit";
import type { Actor, MessageBlock } from "@rakazo/contracts";
import { selectableMessageText } from "@rakazo/core";
import { IsolationError, type PrismaClient } from "@rakazo/db";
import type { ThreadTarget } from "./thread-target.js";

const REMEMBERED_PREFIX = "remembered/";
const MAX_REMEMBERED_CHARS = 2000;

const rememberedPath = (messageId: string) => `${REMEMBERED_PREFIX}${messageId}.md`;

/** Message text without markdown syntax, capped so one click cannot flood a bot's memory. */
export function plainMemoryText(text: string): string {
  const plain = text
    .replace(/```[^\n]*\n?([\s\S]*?)```/g, "$1")
    .replace(/!?\[([^\]]*)\]\(([^)]*)\)/g, "$1 ($2)")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/(\*\*|__|~~|`)/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return plain.length > MAX_REMEMBERED_CHARS
    ? `${plain.slice(0, MAX_REMEMBERED_CHARS - 1)}…`
    : plain;
}

function targetBotIds(target: ThreadTarget): string[] {
  return target.kind === "bot" ? [target.botId] : target.memberBotIds;
}

/**
 * Saves an agent's own message into that agent's memory. The client sends only
 * a message id; the text is read here, so a client cannot write arbitrary memory.
 * One document per message keeps a repeat click from adding a duplicate.
 */
export async function rememberThreadMessage(
  deps: { prisma: PrismaClient; memory: MemoryStore },
  actor: Actor,
  target: ThreadTarget,
  messageId: string,
): Promise<void> {
  const message = await deps.prisma.message.findFirst({
    where: { id: messageId, threadId: target.threadId, role: "bot" },
    select: { blocks: true, botId: true },
  });
  const botId = message?.botId ?? (target.kind === "bot" ? target.botId : undefined);
  if (!message || !botId || !targetBotIds(target).includes(botId)) throw new IsolationError();
  const content = plainMemoryText(
    selectableMessageText({ blocks: message.blocks as unknown as MessageBlock[] }),
  );
  if (!content) return;
  const context = {
    operationId: "remember-message",
    traceId: "remember-message",
    spaceId: actor.spaceId,
    userId: actor.userId,
    signal: new AbortController().signal,
  };
  const path = rememberedPath(messageId);
  const existing = await deps.memory.read({ scope: "bot", botId, path }, context);
  if (existing.documents.length) return;
  await deps.memory.commit(
    { scope: "bot", botId, path, content, sourceThreadId: target.threadId },
    context,
  );
}

/** Ids of messages in this thread's bots' memory that were saved with the Remember action. */
export async function rememberedMessageIds(
  deps: { prisma: PrismaClient },
  actor: Actor,
  target: ThreadTarget,
): Promise<string[]> {
  const docs = await deps.prisma.memoryDocument.findMany({
    where: {
      spaceId: actor.spaceId,
      userId: actor.userId,
      scope: "bot",
      botId: { in: targetBotIds(target) },
      path: { startsWith: REMEMBERED_PREFIX },
    },
    select: { path: true },
  });
  return docs.map((doc) => doc.path.slice(REMEMBERED_PREFIX.length, -".md".length));
}
