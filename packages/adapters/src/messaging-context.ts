import type { MessagingSurface } from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";
import type { IMessageSurface } from "./imessage-tools.js";

/**
 * Executor dep answering "does this bot belong to a messaging identity?" —
 * one indexed query per run, and none when the messaging surface is absent.
 * It also carries the surface the iMessage line tools read and send through.
 */
export function createMessagingContextLoader(prisma: PrismaClient, surface?: MessagingSurface) {
  return {
    hasIdentity: async (botId: string): Promise<boolean> =>
      Boolean(
        await prisma.messagingIdentity.findUnique({ where: { botId }, select: { id: true } }),
      ),
    ...(surface ? { imessage: surface satisfies IMessageSurface } : {}),
  };
}
