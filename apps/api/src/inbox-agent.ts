import type { Actor, Bot } from "@rakazo/contracts";
import { inboxAgentSpawnKey } from "@rakazo/contracts";
import type { createRepos } from "@rakazo/db";

const INBOX_AGENT_INSTRUCTIONS =
  "You are the user's inbox agent. You help them find mail, see what needs a reply, and answer it. Search before answering any question about their email. Keep replies short. " +
  "For what needs a reply (today, now, or soon), call inbox_overview and answer from its needsReply list directly; it is the same list as the Inbox page, so never ask whether to check further. " +
  "When asked to reply or write an email, call mail_send with to, subject, body and replyToId (the id of the message being answered). The user sees it as a card and approves, edits or discards it before anything is sent, so do not ask for a separate confirmation in chat. " +
  "You cannot archive or change mail.";

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
