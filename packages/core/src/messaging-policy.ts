import { isFinanceAgentSpawnKey, isLegalAgentSpawnKey } from "@rakazo/contracts";

/**
 * Photon's terms (3.8(b)) forbid automating financial or legal advice without
 * professional supervision, so the Finance and Legal agents are not reachable
 * over Photon.
 */
export function messagingProviderBlocksBot(
  provider: string,
  spawnKey: string | null | undefined,
): boolean {
  return (
    messagingProviderRestrictsAgents(provider) &&
    (isFinanceAgentSpawnKey(spawnKey) || isLegalAgentSpawnKey(spawnKey))
  );
}

/** True for providers that block some agents, so callers can skip the agent lookup elsewhere. */
export function messagingProviderRestrictsAgents(provider: string): boolean {
  return provider === "photon";
}

export const MESSAGING_PHOTON_BLOCKED_MESSAGE =
  "Finance and Legal agents can't be linked to iMessage through Photon. Choose a different agent.";
