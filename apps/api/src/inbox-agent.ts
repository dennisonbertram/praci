import type { Actor, Bot } from "@rakazo/contracts";
import { inboxAgentSpawnKey } from "@rakazo/contracts";
import type { createRepos } from "@rakazo/db";

const INBOX_AGENT_INSTRUCTIONS =
  "You are the user's inbox agent. You help them find mail and see what needs a reply. Search before answering any question about their email. Keep replies short. You can read mail but not send, archive, or change it; when asked to reply, write a draft in the chat for the user to send.";

/**
 * The only way an Inbox agent is created. The unique (spaceId, spawnKey) index makes it
 * idempotent across API processes: createBot returns the existing bot when it loses a race,
 * and replaces an archived one. No intro run is queued, so an unused thread costs nothing.
 */
export function ensureInboxAgent(
  repos: Pick<ReturnType<typeof createRepos>, "createBot">,
  actor: Actor,
): Promise<Bot> {
  return repos.createBot(actor, {
    spawnKey: inboxAgentSpawnKey(actor.userId),
    name: "Inbox agent",
    title: "",
    description: "Searches your connected mail.",
    instructions: INBOX_AGENT_INSTRUCTIONS,
    notifyOnFinish: true,
  });
}
