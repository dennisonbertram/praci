import type { MessageBlock } from "@rakazo/contracts";

/** The agent this chat last messaged with no answer back yet, or null when nothing is awaited. */
export function delegateWaitTarget(messages: readonly { blocks: readonly MessageBlock[] }[]) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const blocks = messages[i]?.blocks ?? [];
    if (blocks.some((block) => block.kind === "bot_message_received")) return null;
    const sent = blocks.find((block) => block.kind === "bot_message_sent");
    if (sent?.kind === "bot_message_sent") return sent.toBotName;
  }
  return null;
}

/** The agents holding an approval for this chat's requests, once each, in the order they were asked. */
export function pendingDelegateAgents(
  pending: readonly { id: string; name: string }[] | undefined,
) {
  return [...new Map((pending ?? []).map((agent) => [agent.id, agent])).values()].map(
    ({ id, name }) => ({ id, name }),
  );
}
