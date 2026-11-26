import { expect, it, vi } from "vitest";

vi.mock("@lingui/core", () => ({ i18n: { locale: "en" } }));

import { formatPrice } from "./format";

it("shows a price with two to four places, rounded", () => {
  expect(formatPrice("8.5")).toBe("$8.50");
  expect(formatPrice("0.0001")).toBe("$0.0001");
  expect(formatPrice("2.070007659")).toBe("$2.07");
  expect(formatPrice("1.24205")).toBe("$1.2421");
  expect(formatPrice("1200")).toBe("$1,200.00");
  expect(formatPrice("0.99996")).toBe("$1.00");
});
