import type { MessageBlock } from "@rakazo/contracts";

/**
 * True while the thread has app cards and none is connected yet. The first-run tour waits for
 * this to end, so it does not open on top of the cards; one connected app (or opening another page)
 * ends the wait, so an unconnected Calendar card cannot hold the tour back.
 */
export function connectCardsOpen(messages: readonly { blocks: readonly MessageBlock[] }[]) {
  const cards = messages.flatMap((message) =>
    message.blocks.filter((block) => block.kind === "app_connect"),
  );
  return (
    cards.some((card) => card.status === "pending") &&
    !cards.some((card) => card.status === "connected")
  );
}

/** True while the first-run focus card is neither answered nor dismissed (a dismissed card has an answer id). */
export function focusQuestionOpen(messages: readonly { blocks: readonly MessageBlock[] }[]) {
  return messages.some((message) =>
    message.blocks.some(
      (block) =>
        block.kind === "choice" &&
        block.question === "What should I work on first?" &&
        !block.answerId,
    ),
  );
}
