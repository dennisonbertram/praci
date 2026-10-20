import { describe, expect, it } from "vitest";
import { safeEqual } from "./safe-equal.js";

describe("safeEqual", () => {
  it("compares strings of any length without throwing", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "a")).toBe(false);
  });
});
