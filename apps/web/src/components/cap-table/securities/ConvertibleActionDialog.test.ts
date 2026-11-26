import { expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({ t: (parts: TemplateStringsArray) => parts.join("") }));
vi.mock("../../../lib/rpc", () => ({ rpc: {} }));

import { dollarsToCents } from "../views/money";

it("reads dollar amounts as whole cents without floats", () => {
  expect(dollarsToCents("8,000,000")).toBe("800000000");
  expect(dollarsToCents("$1500.5")).toBe("150050");
  expect(dollarsToCents("0.07")).toBe("7");
  expect(dollarsToCents("12.345")).toBeNull();
  expect(dollarsToCents("2m")).toBeNull();
});
