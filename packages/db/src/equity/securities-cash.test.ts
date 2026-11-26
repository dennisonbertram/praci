import { expect, it } from "vitest";
import { cashFor } from "./securities.js";

it("assumes shares times the price paid, in cents, when no consideration is given", () => {
  expect(cashFor(10_000n, "0.10")).toBe(100_000n);
  expect(cashFor(3n, "0.3333")).toBe(100n);
  expect(cashFor(1n, "0.005")).toBe(1n);
  expect(cashFor(6_000_000n, "0.0001")).toBe(60_000n);
  expect(cashFor(500n, "8")).toBe(400_000n);
  expect(cashFor(500n, null)).toBe(0n);
});
