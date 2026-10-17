import { describe, expect, it } from "vitest";
import { contractValue, daysBetween, todayIso } from "./legal-format";

describe("contractValue", () => {
  it("formats cents from a decimal string", () => {
    expect(contractValue("1234567", "USD", "en")).toBe("$12,345.67");
    expect(contractValue("5000000", "USD", "en")).toBe("$50,000");
    expect(contractValue("5", "USD", "en")).toBe("$0.05");
  });
  it("keeps every digit of a value past 2^53", () => {
    expect(contractValue("900719925474099312345", "USD", "en")).toBe(
      "$9,007,199,254,740,993,123.45",
    );
  });
  it("handles negatives, no currency, and an unknown currency", () => {
    expect(contractValue("-150000", "USD", "en")).toBe("-$1,500");
    expect(contractValue("150000", null, "en")).toBe("1,500");
    expect(contractValue("150000", "XXXXX", "en")).toBe("1,500 XXXXX");
  });
});

describe("dates", () => {
  it("counts calendar days without time zones", () => {
    expect(daysBetween("2026-10-16", "2026-10-20")).toBe(4);
    expect(daysBetween("2026-10-16", "2026-10-10")).toBe(-6);
    expect(daysBetween("2026-03-01", "2026-04-01")).toBe(31);
  });
  it("reads today from the local calendar", () => {
    expect(todayIso(new Date(2026, 9, 5, 23, 59))).toBe("2026-10-05");
  });
});
