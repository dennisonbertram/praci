import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Layout is not computed in jsdom; the measured alternative is the markdown stories in a browser.
const css = readFileSync(new URL("./markdown.web.css", import.meta.url), "utf8");

describe("docked panel copy button", () => {
  it("keeps the copy button off a quoted line's text", () => {
    expect(css).toMatch(
      /\.rk-chat-markdown-pre-wrap > blockquote \{\s*padding-right: 2\.25em;?\s*\}/,
    );
  });
  it("grows the copy button's hit area to 44px on touch screens", () => {
    expect(css).toMatch(
      /@media \(pointer: coarse\) \{\s*\.rk-chat-markdown-copy::after \{\s*content: "";\s*position: absolute;\s*inset: -8px;\s*\}/,
    );
  });
  it("keeps quoted text clear of the larger touch hit area", () => {
    expect(css).toMatch(
      /@media \(pointer: coarse\) \{[^@]*\.rk-chat-markdown-pre-wrap > blockquote \{\s*padding-right: calc\(2\.25em \+ 8px\);?\s*\}/,
    );
  });
});
