// @vitest-environment jsdom

import { Editor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { expect, it } from "vitest";
import { caretAboveQuote } from "./caret";

const make = (content: string) => new Editor({ extensions: [StarterKit], content });
const quote = "<p>On Mon, Sam wrote:</p><blockquote><p>quoted</p></blockquote>";

it("lands at the end of the person's text, above the attribution", () => {
  const editor = make(`<p>Hello there</p><p></p>${quote}`);
  const at = caretAboveQuote(editor, true) as number;
  expect(editor.state.doc.textBetween(1, at)).toBe("Hello there");
});

it("lands at the top when nothing was written", () => {
  expect(caretAboveQuote(make(`<p></p><p></p>${quote}`), true)).toBe(1);
});

it("keeps text typed right above a forwarded block", () => {
  const editor = make(
    "<p></p><p>See below</p><blockquote><p>---- Forwarded message ----</p></blockquote>",
  );
  const at = caretAboveQuote(editor, false) as number;
  expect(editor.state.doc.textBetween(1, at, "|")).toBe("|See below");
});

it("has no answer for a message without a quote", () => {
  expect(caretAboveQuote(make("<p>Just text</p>"), true)).toBeNull();
});
