import { inboxAgentSpawnKey } from "@rakazo/contracts";

/** The signed-in user's own Inbox agent; another member's agent in the same space does not match. */
export function findInboxAgent<T extends { spawnKey: string | null }>(
  bots: readonly T[],
  userId: string | null | undefined,
): T | undefined {
  if (!userId) return undefined;
  const key = inboxAgentSpawnKey(userId);
  return bots.find((bot) => bot.spawnKey === key);
}
