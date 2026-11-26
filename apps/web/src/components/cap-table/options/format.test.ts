import { expect, it } from "vitest";
import { formatDay, formatPrice, formatShares } from "./format";

it("formats shares, prices and days like the ledgers", () => {
  expect(formatShares("1234567")).toBe("1,234,567");
  expect(formatPrice("0.1")).toBe("$0.10");
  expect(formatDay("2025-03-04")).toBe("Mar 4, 2025");
});
