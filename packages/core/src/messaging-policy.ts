import {
  isFinanceAgentSpawnKey,
  isInvestorsAgentSpawnKey,
  isLegalAgentSpawnKey,
} from "@rakazo/contracts";

/**
 * Photon's terms (3.8(b)) forbid automating financial or legal advice without
 * professional supervision, so the Finance, Legal and Investors agents (which read
 * cap table and financial data) are not reachable over Photon.
 */
export function messagingProviderBlocksBot(
  provider: string,
  spawnKey: string | null | undefined,
): boolean {
  return (
    messagingProviderRestrictsAgents(provider) &&
    (isFinanceAgentSpawnKey(spawnKey) ||
      isLegalAgentSpawnKey(spawnKey) ||
      isInvestorsAgentSpawnKey(spawnKey))
  );
}

/** True for providers that block some agents, so callers can skip the agent lookup elsewhere. */
export function messagingProviderRestrictsAgents(provider: string): boolean {
  return provider === "photon";
}

export const MESSAGING_PHOTON_BLOCKED_MESSAGE =
  "Finance, Legal and Investors agents can't be linked to iMessage through Photon. Choose a different agent.";
