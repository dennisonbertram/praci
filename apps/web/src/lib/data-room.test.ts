import { expect, it } from "vitest";
import { splitSnippet } from "./data-room";

it("splits a snippet into text and highlighted parts on the control markers", () => {
  expect(splitSnippet("a \u0001b\u0002 c \u0001d\u0002")).toEqual([
    { text: "a ", mark: false },
    { text: "b", mark: true },
    { text: " c ", mark: false },
    { text: "d", mark: true },
  ]);
});

it("keeps text with no markers whole, and tolerates a missing end marker", () => {
  expect(splitSnippet("plain")).toEqual([{ text: "plain", mark: false }]);
  expect(splitSnippet("x \u0001open")).toEqual([
    { text: "x ", mark: false },
    { text: "open", mark: true },
  ]);
  expect(splitSnippet("")).toEqual([]);
});
