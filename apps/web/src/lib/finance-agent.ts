import { t } from "@lingui/core/macro";
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

/** The starter questions the Finance agent offers on an empty thread, in its panel or its own chat. */
export const financeAgentSuggestions = () => [
  t`What is our runway?`,
  t`Where did spend go up this month?`,
];

/**
 * Starter questions for a bot's own chat: the user's Finance agent with an empty thread gets the
 * same ones as its Finance panel; any other bot, or a thread with messages, gets none.
 */
export function chatStarterQuestions(
  bot: { spawnKey: string | null } | undefined,
  userId: string | null | undefined,
  emptyThread: boolean,
): string[] | null {
  if (!bot || !emptyThread || !findFinanceAgent([bot], userId)) return null;
  return financeAgentSuggestions();
}
