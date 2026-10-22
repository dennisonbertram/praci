import type { MessageBlock } from "@rakazo/contracts";
import { expect, it } from "vitest";
import { connectCardsOpen, focusQuestionOpen } from "./connect-cards";

const card = (status: "pending" | "connected"): MessageBlock => ({
  kind: "app_connect",
  provider: "gmail",
  name: "Gmail",
  description: "",
  logo: null,
  status,
});
const text: MessageBlock = { kind: "text", text: "hi" };

it("waits while any card is still waiting to be connected", () => {
  expect(connectCardsOpen([{ blocks: [text] }])).toBe(false);
  expect(connectCardsOpen([{ blocks: [text, card("pending"), card("pending")] }])).toBe(true);
  // One connected app releases the tour; an unconnected Calendar card must not hold it.
  expect(connectCardsOpen([{ blocks: [card("pending"), card("connected")] }])).toBe(false);
  expect(connectCardsOpen([{ blocks: [card("connected"), card("connected")] }])).toBe(false);
});

it("holds the tour only while the first question is unanswered and not dismissed", () => {
  const question = (answerId?: string): MessageBlock => ({
    kind: "choice",
    question: "What do you want me on first?",
    options: [{ id: "company", letter: "A", label: "Run my company" }],
    ...(answerId ? { answerId } : {}),
  });
  expect(focusQuestionOpen([{ blocks: [question()] }])).toBe(true);
  expect(focusQuestionOpen([{ blocks: [question("company")] }])).toBe(false);
  expect(focusQuestionOpen([{ blocks: [question("_dismissed")] }])).toBe(false);
});
