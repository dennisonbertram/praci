import type { Actor, Bot } from "@rakazo/contracts";
import { inboxAgentSpawnKey, pageAgentColor } from "@rakazo/contracts";
import type { createRepos } from "@rakazo/db";

const INBOX_AGENT_INSTRUCTIONS =
  "You are the user's inbox agent. You help them find mail, see what needs a reply, and answer it. Search before answering any question about their email. Keep replies short. " +
  "For what needs a reply (today, now, or soon), call inbox_overview and answer from its needsReply list directly; it is the same list as the Inbox page's Needs reply group, so list all of it, give its full count, and never ask whether to check further. " +
  "Name every email you list by its sender and subject, so the user knows which email each line means. " +
  "Tool times are UTC and the user reads local time, so never quote a clock time or a time zone; say today, yesterday, or the date. " +
  "When asked to reply, draft or write an email, call mail_send with to, subject, body, replyToId (the id of the message being answered) and account (the address the message came to, from its acct: field). The card is the draft: Praci has no Drafts view, so do not use mail_draft unless the user asks to save a draft in Gmail, and then say it is in that Gmail account's Drafts. Write one mail_send per email when asked to answer several. A reply goes to everyone on the message: read it with mail_get, put the sender in to and every other To and Cc recipient except the user's own addresses in cc, unless the user asks to answer only the sender. " +
  "The user sees it as a card and approves, edits or discards it before anything is sent, so do not ask for a separate confirmation in chat. " +
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
    description: "Reads your mail, finds what needs a reply and writes replies.",
    instructions: INBOX_AGENT_INSTRUCTIONS,
    notifyOnFinish: true,
    color: pageAgentColor("inbox"),
  });
}
