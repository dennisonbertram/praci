import type { MessageBlock } from "@rakazo/contracts";

/** Show the wait once the other agent has been silent this long. */
export const DELEGATE_WAIT_SHOWN_AFTER_MS = 60_000;
/** After this long the wait is reported as unanswered. */
export const DELEGATE_WAIT_FAILED_AFTER_MS = 5 * 60_000;
/** Older unanswered messages are history (the answer may have come another way), not a wait. */
const DELEGATE_WAIT_FORGOTTEN_AFTER_MS = 60 * 60_000;

/** The agent this chat last messaged with no answer back yet, and when, or null when nothing is awaited. */
export function delegateWait(
  messages: readonly { blocks: readonly MessageBlock[]; createdAt?: string }[],
) {
  const answered = new Set<string>();
  for (let i = messages.length - 1; i >= 0; i--) {
    const blocks = messages[i]?.blocks ?? [];
    for (const block of blocks) {
      if (block.kind === "bot_message_received") answered.add(block.fromBotId);
    }
    const sent = blocks.find((block) => block.kind === "bot_message_sent");
    if (sent?.kind !== "bot_message_sent") continue;
    // Only a request or question (a missing intent means request) waits for an answer; a result,
    // status or FYI sent back does not, and a request ends only when that same agent answers.
    const intent = sent.intent ?? "request";
    if (intent !== "request" && intent !== "question") continue;
    if (answered.has(sent.toBotId)) continue;
    return { name: sent.toBotName, at: Date.parse(messages[i]?.createdAt ?? "") };
  }
  return null;
}

/** The agent this chat last messaged with no answer back yet, or null when nothing is awaited. */
export function delegateWaitTarget(messages: readonly { blocks: readonly MessageBlock[] }[]) {
  return delegateWait(messages)?.name ?? null;
}

/** Whether to show a quiet wait, or an unanswered request, for an idle chat at `now`. */
export function delegateWaitState(
  messages: readonly { blocks: readonly MessageBlock[]; createdAt?: string }[],
  now: number,
): { name: string; state: "waiting" | "unanswered" } | null {
  const wait = delegateWait(messages);
  if (!wait || !Number.isFinite(wait.at)) return null;
  const age = now - wait.at;
  if (age < DELEGATE_WAIT_SHOWN_AFTER_MS || age >= DELEGATE_WAIT_FORGOTTEN_AFTER_MS) return null;
  return {
    name: wait.name,
    state: age >= DELEGATE_WAIT_FAILED_AFTER_MS ? "unanswered" : "waiting",
  };
}

/** The agents holding an approval for this chat's requests, once each, in the order they were asked. */
export function pendingDelegateAgents(
  pending: readonly { id: string; name: string }[] | undefined,
) {
  return [...new Map((pending ?? []).map((agent) => [agent.id, agent])).values()].map(
    ({ id, name }) => ({ id, name }),
  );
}
