import { ORPCError } from "@orpc/server";
import { updateScratchpadItemFromUser } from "@rakazo/adapters";
import type { Actor } from "@rakazo/contracts";
import { FIRST_BOT_SPAWN_KEY } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";

const clip = (text: string, max: number) => text.slice(0, max);

/** The caller's cached message, or NOT_FOUND. */
async function ownCachedMessage(prisma: PrismaClient, actor: Actor, messageId: string) {
  const row = await prisma.cachedMailMessage.findFirst({
    where: { id: messageId, spaceId: actor.spaceId, userId: actor.userId },
  });
  if (!row) throw new ORPCError("NOT_FOUND", { message: "Not found" });
  return row;
}

/** The Chief: the bot first-run onboarding creates. */
async function chiefBotId(prisma: PrismaClient, actor: Actor): Promise<string> {
  const bot = await prisma.bot.findFirst({
    where: {
      spaceId: actor.spaceId,
      userId: actor.userId,
      spawnKey: FIRST_BOT_SPAWN_KEY,
      archivedAt: null,
    },
    select: { id: true },
  });
  if (!bot) throw new ORPCError("BAD_REQUEST", { message: "No Chief bot to track this" });
  return bot.id;
}

/** Adds the thread to the Chief's Open work; one open item per thread. */
export async function inboxTrack(prisma: PrismaClient, actor: Actor, messageId: string) {
  const message = await ownCachedMessage(prisma, actor, messageId);
  const botId = await chiefBotId(prisma, actor);
  const where = {
    spaceId: actor.spaceId,
    userId: actor.userId,
    botId,
    status: "open",
    mailConnectionId: message.connectionId,
    mailThreadId: message.threadId,
  };
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`scratchpad:mail:${botId}:${message.connectionId}:${message.threadId}`}, 0))`;
    if (await tx.scratchpadItem.findFirst({ where, select: { id: true } })) return;
    await tx.scratchpadItem.create({
      data: {
        ...where,
        title: clip(message.subject.trim() || message.snippet.trim() || "(no subject)", 200),
        waitingOn: clip(message.fromName?.trim() || message.fromAddress, 200),
        mailMessageId: message.providerMessageId,
      },
    });
  });
  return { ok: true as const };
}

/** Marks the thread's open item done; nothing to do when it is not tracked. */
export async function inboxUntrack(prisma: PrismaClient, actor: Actor, messageId: string) {
  const message = await ownCachedMessage(prisma, actor, messageId);
  const items = await prisma.scratchpadItem.findMany({
    where: {
      spaceId: actor.spaceId,
      userId: actor.userId,
      status: "open",
      mailConnectionId: message.connectionId,
      mailThreadId: message.threadId,
    },
    select: { id: true, botId: true },
  });
  for (const item of items) {
    const result = await updateScratchpadItemFromUser(
      { prisma },
      {
        spaceId: actor.spaceId,
        userId: actor.userId,
        botId: item.botId,
        itemId: item.id,
        status: "done",
        resolvedReason: "Stopped tracking from Inbox",
      },
    );
    if ("error" in result) throw new ORPCError("BAD_REQUEST", { message: result.error });
  }
  return { ok: true as const };
}

/** The thread keys (connection and thread) with an open tracked item, in one query. */
export async function trackedThreads(
  prisma: PrismaClient,
  actor: Actor,
  rows: { connectionId: string; threadId: string }[],
): Promise<Set<string>> {
  if (rows.length === 0) return new Set();
  const items = await prisma.scratchpadItem.findMany({
    where: {
      spaceId: actor.spaceId,
      userId: actor.userId,
      status: "open",
      mailConnectionId: { in: [...new Set(rows.map((r) => r.connectionId))] },
      mailThreadId: { in: rows.map((r) => r.threadId) },
    },
    select: { mailConnectionId: true, mailThreadId: true },
  });
  return new Set(items.map((i) => `${i.mailConnectionId}:${i.mailThreadId}`));
}
