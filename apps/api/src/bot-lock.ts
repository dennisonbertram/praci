import type { PrismaClient } from "@rakazo/db";

/**
 * Touches a live bot row so an archive either lands before (false) or after the caller's
 * transaction. Pass the spawn key (or the keys) the bot must carry when the caller owns one.
 */
export async function lockLiveBot(
  tx: Pick<PrismaClient, "bot">,
  scope: { spaceId: string; userId: string },
  botId: string,
  spawnKey?: string | string[] | null,
): Promise<boolean> {
  const { count } = await tx.bot.updateMany({
    where: {
      id: botId,
      spaceId: scope.spaceId,
      userId: scope.userId,
      ...(spawnKey === undefined
        ? {}
        : { spawnKey: Array.isArray(spawnKey) ? { in: spawnKey } : spawnKey }),
      archivedAt: null,
    },
    data: { updatedAt: new Date() },
  });
  return count > 0;
}
