import { t } from "@lingui/core/macro";
import { findPageAgent } from "@rakazo/contracts";

/** The signed-in user's own Investors agent; another member's agent in the same space does not match. */
export const findInvestorsAgent = <T extends { spawnKey: string | null }>(
  bots: readonly T[],
  userId: string | null | undefined,
): T | undefined => findPageAgent(bots, "investors", userId);

/** The starter questions on an empty thread, in the Investors panel and the agent's own chat. */
export const investorsAgentSuggestions = () => [
  t`Who owns what in the company?`,
  t`Who are our investors?`,
];
