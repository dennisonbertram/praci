import type { MessageBlock } from "@rakazo/contracts";

/**
 * True while the thread offers app cards and none is connected yet. The first-run tour waits for
 * this to end, so it does not open on top of the cards; opening another page ends the wait too.
 */
export function connectCardsOpen(messages: readonly { blocks: readonly MessageBlock[] }[]) {
  const cards = messages.flatMap((message) =>
    message.blocks.filter((block) => block.kind === "app_connect"),
  );
  return cards.length > 0 && cards.every((card) => card.status === "pending");
}

/** True while the first-run focus card is neither answered nor dismissed (a dismissed card has an answer id). */
export function focusQuestionOpen(messages: readonly { blocks: readonly MessageBlock[] }[]) {
  return messages.some((message) =>
    message.blocks.some(
      (block) =>
        block.kind === "choice" &&
        block.question === "What do you want me on first?" &&
        !block.answerId,
    ),
  );
}
