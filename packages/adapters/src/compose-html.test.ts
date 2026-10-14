import { describe, expect, it } from "vitest";
import { htmlToText, sanitizeComposeHtml } from "./compose-html.js";

describe("sanitizeComposeHtml", () => {
  it("keeps the formatting the editor produces", () => {
    const html =
      "<p>Hi <strong>you</strong> <em>x</em> <u>y</u></p><ul><li>a</li></ul><ol><li>b</li></ol><blockquote><p>q</p></blockquote>";
    expect(sanitizeComposeHtml(html)).toBe(html);
  });

  it("drops scripts, event handlers, styles and unsafe links but keeps text", () => {
    const out = sanitizeComposeHtml(
      '<p onclick="x()" style="color:red">a<script>alert(1)</script><img src=x onerror=y> <a href="javascript:alert(1)">bad</a> <a href="https://e.test/p?a=1" target="_blank" onclick="z">ok</a> <span>s</span></p>',
    );
    expect(out).toBe('<p>a bad <a href="https://e.test/p?a=1">ok</a> s</p>');
  });

  it("allows mailto links", () => {
    expect(sanitizeComposeHtml('<a href="mailto:a@b.test">m</a>')).toBe(
      '<a href="mailto:a@b.test">m</a>',
    );
  });
});

describe("htmlToText", () => {
  it("writes paragraphs, lists, links and quotes as plain text", () => {
    const text = htmlToText(
      '<p>Hello <b>there</b></p><p>Line<br>two</p><ul><li>a</li><li>b</li></ul><ol><li>c</li></ol><p><a href="https://e.test">site</a> <a href="https://f.test">https://f.test</a></p><blockquote><p>old</p><p>text</p></blockquote>',
    );
    expect(text).toBe(
      "Hello there\n\nLine\ntwo\n\n- a\n- b\n\n1. c\n\nsite (https://e.test) https://f.test\n\n> old\n>\n> text",
    );
  });
});
