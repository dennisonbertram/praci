import { gtmAgentSpawnKey } from "@rakazo/contracts";

export function findGtmAgent<T extends { spawnKey: string | null }>(
  bots: readonly T[],
  userId: string | null | undefined,
): T | undefined {
  if (!userId) return undefined;
  return bots.find((bot) => bot.spawnKey === gtmAgentSpawnKey(userId));
}
