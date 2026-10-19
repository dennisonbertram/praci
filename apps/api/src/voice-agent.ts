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
