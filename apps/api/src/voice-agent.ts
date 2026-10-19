import type { Actor, Bot } from "@rakazo/contracts";
import { voiceAgentSpawnKey } from "@rakazo/contracts";
import { VOICE_AGENT_INSTRUCTIONS } from "@rakazo/core";
import type { createRepos } from "@rakazo/db";

export function ensureVoiceAgent(
  repos: Pick<ReturnType<typeof createRepos>, "createBot">,
  actor: Actor,
): Promise<Bot> {
  return repos.createBot(actor, {
    spawnKey: voiceAgentSpawnKey(actor.userId),
    name: "Elio",
    title: "Voice agent",
    description: "Answers questions about your workspace and coordinates your agents.",
    instructions: VOICE_AGENT_INSTRUCTIONS,
    notifyOnFinish: true,
  });
}

/**
 * A replaced Elio lost its spawn key but kept Elio's instructions. Restoring it would give those
 * instructions ordinary tools, so it stays archived.
 */
export const isReplacedVoiceAgent = (bot: { spawnKey?: string | null; instructions: string }) =>
  !bot.spawnKey && bot.instructions === VOICE_AGENT_INSTRUCTIONS;
