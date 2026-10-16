import { describe, expect, it } from "vitest";
import { prefillHtml, textToHtml } from "./compose-body";

describe("textToHtml", () => {
  it("keeps the blank lines above a quoted reply and escapes markup", () => {
    expect(textToHtml("\n\nOn Mon, Sam <s@x.test> wrote:\n> hi <b>\n> there\n>\n> bye")).toBe(
      "<p></p><p></p><p>On Mon, Sam &lt;s@x.test&gt; wrote:</p><blockquote><p>hi &lt;b&gt;<br>there</p><p>bye</p></blockquote>",
    );
  });
});

describe("textToHtml links", () => {
  it("links http(s) URLs in the quote, without trailing punctuation, and escapes the rest", () => {
    expect(textToHtml("> see https://x.test/a?b=1&c=2, or <http://y.test>. ok")).toBe(
      '<blockquote><p>see <a href="https://x.test/a?b=1&amp;c=2">https://x.test/a?b=1&amp;c=2</a>, or &lt;<a href="http://y.test">http://y.test</a>&gt;. ok</p></blockquote>',
    );
  });
});

describe("textToHtml forward header", () => {
  it("quotes the forwarded header block up to its blank line", () => {
    expect(
      textToHtml(
        "\n\n---------- Forwarded message ---------\nFrom: A <a@x.test>\nSubject: Hi\n\nBody",
      ),
    ).toBe(
      "<p></p><p></p><blockquote><p>---------- Forwarded message ---------<br>From: A &lt;a@x.test&gt;<br>Subject: Hi</p></blockquote><p></p><p>Body</p>",
    );
  });
});

describe("prefillHtml", () => {
  const body =
    "\n\n---------- Forwarded message ---------\nFrom: A <a@x.test>\nSubject: Hi\n\nplain copy";

  it("keeps the forwarded header quoted and puts the original's HTML below it", () => {
    expect(prefillHtml({ body, quotedHtml: "<p><strong>Hi</strong></p>" })).toBe(
      "<p></p><p></p><blockquote><p>---------- Forwarded message ---------<br>From: A &lt;a@x.test&gt;<br>Subject: Hi</p></blockquote><p></p><p><strong>Hi</strong></p>",
    );
  });

  it("falls back to the plain text without HTML", () => {
    expect(prefillHtml({ body })).toBe(textToHtml(body));
  });
});
