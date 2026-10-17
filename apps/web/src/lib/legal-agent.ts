import { legalAgentSpawnKey } from "@rakazo/contracts";

/** The signed-in user's own Legal agent; another member's agent in the same space does not match. */
export function findLegalAgent<T extends { spawnKey: string | null }>(
  bots: readonly T[],
  userId: string | null | undefined,
): T | undefined {
  if (!userId) return undefined;
  const key = legalAgentSpawnKey(userId);
  return bots.find((bot) => bot.spawnKey === key);
}
