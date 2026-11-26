import { i18n } from "@lingui/core";
import { afterEach, expect, it } from "vitest";
import { formatDay, formatPrice, formatShares } from "./format";

afterEach(() => i18n.activate("en"));

it("formats shares, prices and days like the ledgers", () => {
  expect(formatShares("1234567")).toBe("1,234,567");
  expect(formatPrice("0.1")).toBe("$0.10");
  expect(formatDay("2025-03-04")).toBe("Mar 4, 2025");
});

it("masks display prices without changing the default formatter", () => {
  expect(formatPrice("0.1")).toBe("$0.10");
  expect(formatPrice("0.1", true)).toBe("$•••");
});

it("preserves precision for small per-share prices", () => {
  expect(formatPrice("0.001")).toBe("$0.001");
  expect(formatPrice("12.0030")).toBe("$12.003");
});

it("localizes currency placement and separators without rounding the price", () => {
  i18n.activate("de-DE");
  expect(formatPrice("1234.003")).toBe("1.234,003 $");
  expect(formatPrice("0.1", true)).toBe("$•••");
});

it("localizes non-Western digits in prices", () => {
  i18n.activate("ar-EG");
  expect(formatPrice("1234.003")).toBe("‏١٬٢٣٤٫٠٠٣ US$");
});
