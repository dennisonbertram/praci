import { t } from "@lingui/core/macro";
import { dataRoomAgentSpawnKey } from "@rakazo/contracts";

/** The signed-in user's own Data room agent; another member's agent in the same space does not match. */
export function findDataRoomAgent<T extends { spawnKey: string | null }>(
  bots: readonly T[],
  userId: string | null | undefined,
): T | undefined {
  if (!userId) return undefined;
  const key = dataRoomAgentSpawnKey(userId);
  return bots.find((bot) => bot.spawnKey === key);
}

/** The starter questions on an empty thread, in the Data room panel and the agent's own chat. */
export const dataRoomAgentSuggestions = () => [
  t`Find the latest contract`,
  t`Which documents mention renewal?`,
];
