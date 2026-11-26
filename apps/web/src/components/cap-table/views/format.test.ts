import { expect, it, vi } from "vitest";

vi.mock("@lingui/core", () => ({ i18n: { locale: "en" } }));

import { formatDollars, formatPrice, formatShares } from "./format";

it("rounds whole dollars from cents to the nearest dollar", () => {
  expect(formatDollars("3429201250")).toBe("$34,292,013");
  expect(formatDollars("21601250")).toBe("$216,013");
});

it("masks money without masking share counts", () => {
  expect(formatDollars("25000000", true)).toBe("$•••");
  expect(formatPrice("8.50", true)).toBe("$•••");
  expect(formatShares("12000000")).toBe("12,000,000");
});

it("shows a price with two to four places, rounded", () => {
  expect(formatPrice("8.5")).toBe("$8.50");
  expect(formatPrice("0.0001")).toBe("$0.0001");
  expect(formatPrice("2.070007659")).toBe("$2.07");
  expect(formatPrice("1.24205")).toBe("$1.2421");
  expect(formatPrice("1200")).toBe("$1,200.00");
  expect(formatPrice("0.99996")).toBe("$1.00");
});
