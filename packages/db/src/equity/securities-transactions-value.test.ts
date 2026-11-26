import { expect, it } from "vitest";
import { value } from "./securities-transactions.js";

it("rounds a transaction value half-up like the core price x shares figure", () => {
  // 1 share at $0.0150 is 1.5 cents: half-up gives 2, the old floor gave 1.
  expect(value("0.0150", 1n)).toBe(2n);
  expect(value("0.0149", 1n)).toBe(1n);
  expect(value("2.50", 3n)).toBe(750n);
  expect(value(undefined, 3n)).toBeNull();
});
