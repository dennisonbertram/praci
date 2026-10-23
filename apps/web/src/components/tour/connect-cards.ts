import type { MessageBlock } from "@rakazo/contracts";

/** The first-run focus question; cards stored before the rewording keep the old text. */
export function isFocusQuestion(question: string) {
  return (
    question === "What should I work on first?" || question === "What do you want me on first?"
  );
}

/** True while the first-run focus card is neither answered nor dismissed (a dismissed card has an answer id). */
export function focusQuestionOpen(messages: readonly { blocks: readonly MessageBlock[] }[]) {
  return messages.some((message) =>
    message.blocks.some(
      (block) => block.kind === "choice" && isFocusQuestion(block.question) && !block.answerId,
    ),
  );
}
