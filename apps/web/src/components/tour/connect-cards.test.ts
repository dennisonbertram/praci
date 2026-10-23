import type { MessageBlock } from "@rakazo/contracts";
import { expect, it } from "vitest";
import { focusQuestionOpen } from "./connect-cards";

it("holds the tour only while the first question is unanswered and not dismissed", () => {
  const question = (answerId?: string, text = "What should I work on first?"): MessageBlock => ({
    kind: "choice",
    question: text,
    options: [{ id: "company", letter: "A", label: "Run my company" }],
    ...(answerId ? { answerId } : {}),
  });
  expect(focusQuestionOpen([{ blocks: [question()] }])).toBe(true);
  expect(
    focusQuestionOpen([{ blocks: [question(undefined, "What do you want me on first?")] }]),
  ).toBe(true);
  expect(focusQuestionOpen([{ blocks: [question("company")] }])).toBe(false);
  expect(focusQuestionOpen([{ blocks: [question("_dismissed")] }])).toBe(false);
});
