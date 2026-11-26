import { describe, expect, it } from "vitest";
import { mapFundraisingSafeTerms } from "./fundraising-safe-terms.js";
import { EquityInputError } from "./ledger.js";

const safe = (overrides: Record<string, unknown> = {}) => ({
  amountCents: 1_000n,
  valuationType: "post_money_cap",
  capCents: 2_000n,
  discountPercent: 20,
  mfn: true,
  proRata: true,
  investmentDate: new Date("2024-03-01T00:00:00.000Z"),
  ...overrides,
});

describe("Fundraising SAFE convertible terms", () => {
  it.each([
    ["pre_money_cap", 2_000n, "pre_money"],
    ["post_money_cap", 2_000n, "post_money"],
    ["no_valuation", null, null],
  ] as const)("maps %s explicitly", (valuationType, capCents, valuationCapType) => {
    const terms = mapFundraisingSafeTerms(
      safe({ valuationType, capCents }) as Parameters<typeof mapFundraisingSafeTerms>[0],
    );
    expect(terms).toMatchObject({
      principalCents: "1000",
      valuationCapCents: capCents === null ? null : "2000",
      valuationCapType,
      discountPercent: "20.0000000000",
      mfn: true,
      proRata: true,
      issueDate: "2024-03-01",
    });
  });

  it.each([
    [12.345678, "12.3456780000"],
    [99.999999, "99.9999990000"],
  ])("preserves discount %s exactly to database scale", (discountPercent, expected) => {
    const terms = mapFundraisingSafeTerms(
      safe({ discountPercent }) as Parameters<typeof mapFundraisingSafeTerms>[0],
    );
    expect(terms.discountPercent).toBe(expected);
  });

  it("preserves a missing investment date instead of inventing one", () => {
    expect(
      mapFundraisingSafeTerms(
        safe({ investmentDate: null }) as Parameters<typeof mapFundraisingSafeTerms>[0],
      ).issueDate,
    ).toBeNull();
  });

  it.each([
    ["unknown valuation", { valuationType: "unknown" }],
    ["capless pre-money valuation", { valuationType: "pre_money_cap", capCents: null }],
    ["capless post-money valuation", { valuationType: "post_money_cap", capCents: null }],
    ["cap on no-valuation SAFE", { valuationType: "no_valuation", capCents: 2_000n }],
    ["nonpositive cap", { capCents: 0n }],
    ["nonpositive principal", { amountCents: 0n }],
    ["negative discount", { discountPercent: -0.01 }],
    ["100 percent discount", { discountPercent: 100 }],
    ["discount exceeding database scale", { discountPercent: 12.12345678901 }],
    ["NaN discount", { discountPercent: Number.NaN }],
    ["infinite discount", { discountPercent: Number.POSITIVE_INFINITY }],
  ])("rejects %s", (_name, overrides) => {
    expect(() =>
      mapFundraisingSafeTerms(safe(overrides) as Parameters<typeof mapFundraisingSafeTerms>[0]),
    ).toThrow(EquityInputError);
  });
});
