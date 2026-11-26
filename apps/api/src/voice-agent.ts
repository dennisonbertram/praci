import type { Actor, Bot } from "@rakazo/contracts";
import { voiceAgentSpawnKey } from "@rakazo/contracts";
import { VOICE_AGENT_INSTRUCTIONS } from "@rakazo/core";
import type { createRepos } from "@rakazo/db";
import type { BuiltInAgent } from "./page-agent-ensure.js";
import { ensurePageAgent } from "./page-agent-ensure.js";

/** Not in BUILT_IN_AGENTS: its text is code-owned and read live, so a stored copy is never upgraded. */
const VOICE_AGENT: BuiltInAgent = {
  kind: "voice",
  spawnKey: voiceAgentSpawnKey,
  name: "Elio",
  title: "Voice agent",
  description: "Answers questions about your workspace and coordinates your agents.",
  instructions: VOICE_AGENT_INSTRUCTIONS,
};

export function ensureVoiceAgent(
  repos: Pick<ReturnType<typeof createRepos>, "createBot" | "replaceBotInstructions">,
  actor: Actor,
): Promise<Bot> {
  return ensurePageAgent({ repos }, actor, VOICE_AGENT);
}
