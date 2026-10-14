import { describe, expect, it } from "vitest";
import { formatBytes, textToHtml } from "./compose-body";

describe("textToHtml", () => {
  it("keeps the blank lines above a quoted reply and escapes markup", () => {
    expect(textToHtml("\n\nOn Mon, Sam <s@x.test> wrote:\n> hi <b>\n> there\n>\n> bye")).toBe(
      "<p></p><p></p><p>On Mon, Sam &lt;s@x.test&gt; wrote:</p><blockquote><p>hi &lt;b&gt;<br>there</p><p>bye</p></blockquote>",
    );
  });
});

describe("formatBytes", () => {
  it("uses B, KB and MB", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(12_345)).toBe("12 KB");
    expect(formatBytes(2_500_000)).toBe("2.5 MB");
  });
});
