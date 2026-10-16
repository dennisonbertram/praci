import { describe, expect, it } from "vitest";
import { byteLength, truncateUtf8 } from "./text-bytes.js";

describe("text bytes", () => {
  it("counts UTF-8 bytes", () => {
    expect(byteLength("abc")).toBe(3);
    expect(byteLength("é")).toBe(2);
    expect(byteLength("😀")).toBe(4);
  });

  it("truncates ASCII at the byte limit", () => {
    expect(truncateUtf8("hello", 3)).toBe("hel");
    expect(truncateUtf8("hi", 10)).toBe("hi");
  });

  it("never splits multi-byte characters or surrogate pairs", () => {
    expect(truncateUtf8("aé", 2)).toBe("a");
    expect(truncateUtf8("a😀", 4)).toBe("a");
    expect(truncateUtf8("a😀", 5)).toBe("a😀");
  });

  it("returns an empty string for a non-positive limit", () => {
    expect(truncateUtf8("abc", 0)).toBe("");
    expect(truncateUtf8("abc", -1)).toBe("");
  });
});
