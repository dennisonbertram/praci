import { financeAgentSpawnKey } from "@rakazo/contracts";

/** The signed-in user's own Finance agent; another member's agent in the same space does not match. */
export function findFinanceAgent<T extends { spawnKey: string | null }>(
  bots: readonly T[],
  userId: string | null | undefined,
): T | undefined {
  if (!userId) return undefined;
  const key = financeAgentSpawnKey(userId);
  return bots.find((bot) => bot.spawnKey === key);
}
