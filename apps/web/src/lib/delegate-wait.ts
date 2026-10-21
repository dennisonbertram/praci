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
