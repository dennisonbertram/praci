import { describe, expect, it } from "vitest";
import { xCount } from "./x-count";

describe("X weighted count", () => {
  it("counts each URL as 23, leaving surrounding punctuation outside the URL", () => {
    expect(xCount("https://example.com/a/very/long/path")).toBe(23);
    expect(xCount("Read https://example.com/a, then www.example.org.")).toBe(5 + 23 + 7 + 23 + 1);
    expect(xCount("(https://example.com/a_(b)).")).toBe(1 + 23 + 2);
    expect(xCount("example.com")).toBe(23);
    expect(xCount("user@example.com")).toBe(16);
    expect(xCount("first.last@example.com")).toBe(22);
  });

  it("weights emoji and CJK code points by two and normalises to NFC", () => {
    expect(xCount("A😀中文")).toBe(7);
    expect(xCount("e\u0301")).toBe(1);
    expect(xCount("\u200d\u200e\u2010\u2032\u2038")).toBe(7);
  });

  it("distinguishes 280 from 281", () => {
    expect(xCount("a".repeat(280))).toBe(280);
    expect(xCount("a".repeat(281))).toBe(281);
    expect(xCount("中".repeat(140))).toBe(280);
    expect(xCount(`${"a".repeat(256)} https://example.com/long`)).toBe(280);
  });
});
