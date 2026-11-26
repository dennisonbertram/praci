import { describe, expect, it } from "vitest";
import type { DayCount } from "./convertibles.js";
import { accruedInterestCents, convertNote, convertSafe } from "./convertibles.js";
import { parseFixed, SCALE } from "./fixed.js";

const dollars = (value: string) => parseFixed(value);
const percent = (value: string) => parseFixed(value);

describe("accruedInterestCents, simple interest", () => {
  it("accrues over a year on each day-count convention", () => {
    const base = {
      principalCents: 1_000_000n,
      ratePercent: percent("5"),
      startDate: "2023-01-01",
      asOf: "2024-01-01",
      interestType: "simple" as const,
    };
    expect(accruedInterestCents({ ...base, dayCount: "actual_365" })).toBe(50_000n);
    expect(accruedInterestCents({ ...base, dayCount: "actual_360" })).toBe(50_694n);
  });

  it("counts 30/360 months as 30 days", () => {
    const base = {
      principalCents: 1_000_000n,
      ratePercent: percent("5"),
      startDate: "2024-01-30",
      asOf: "2024-03-31",
      interestType: "simple" as const,
    };
    expect(accruedInterestCents({ ...base, dayCount: "30_360" })).toBe(8_333n);
    expect(accruedInterestCents({ ...base, dayCount: "actual_360" })).toBe(8_472n);
    expect(
      accruedInterestCents({
        ...base,
        startDate: "2024-01-31",
        asOf: "2024-04-30",
        dayCount: "30_360",
      }),
    ).toBe(12_500n);
  });

  it("rounds half-up and returns nothing for a zero or negative span", () => {
    expect(
      accruedInterestCents({
        principalCents: 1_000_000n,
        ratePercent: percent("5"),
        startDate: "2024-01-01",
        asOf: "2024-01-02",
        interestType: "simple",
        dayCount: "actual_365",
      }),
    ).toBe(137n);
    const base = {
      principalCents: 1_000_000n,
      ratePercent: percent("5"),
      startDate: "2024-01-01",
      asOf: "2024-01-01",
      interestType: "simple" as const,
      dayCount: "actual_365" as const,
    };
    expect(accruedInterestCents(base)).toBe(0n);
    expect(accruedInterestCents({ ...base, asOf: "2023-12-01" })).toBe(0n);
    expect(accruedInterestCents({ ...base, principalCents: 0n })).toBe(0n);
    expect(accruedInterestCents({ ...base, ratePercent: 0n })).toBe(0n);
  });
});

describe("accruedInterestCents, compound interest", () => {
  it("compounds annually over whole years", () => {
    expect(
      accruedInterestCents({
        principalCents: 1_000_000n,
        ratePercent: percent("10"),
        startDate: "2023-01-01",
        asOf: "2024-01-01",
        interestType: "compound",
        dayCount: "actual_365",
      }),
    ).toBe(100_000n);
    expect(
      accruedInterestCents({
        principalCents: 1_000_000n,
        ratePercent: percent("10"),
        startDate: "2024-01-01",
        asOf: "2025-01-01",
        interestType: "compound",
        dayCount: "actual_365",
      }),
    ).toBe(100_000n); // a leap year is still one calendar-year period
    expect(
      accruedInterestCents({
        principalCents: 1_000_000n,
        ratePercent: percent("10"),
        startDate: "2024-01-01",
        asOf: "2026-01-01",
        interestType: "compound",
        dayCount: "actual_365",
      }),
    ).toBe(210_000n);
  });

  it("compounds monthly", () => {
    expect(
      accruedInterestCents({
        principalCents: 1_000_000n,
        ratePercent: percent("12"),
        startDate: "2024-01-01",
        asOf: "2024-12-31",
        interestType: "compound",
        dayCount: "30_360",
        compounding: "monthly",
      }),
    ).toBe(126_825n);
    expect(
      accruedInterestCents({
        principalCents: 1_000_000n,
        ratePercent: percent("12"),
        startDate: "2024-01-01",
        asOf: "2024-03-31",
        interestType: "compound",
        dayCount: "30_360",
        compounding: "monthly",
      }),
    ).toBe(30_301n);
  });
});

describe("accruedInterestCents, calendar-month periods", () => {
  const monthly = {
    principalCents: 1_000_000n,
    ratePercent: percent("12"),
    interestType: "compound" as const,
    dayCount: "actual_365" as const,
    compounding: "monthly" as const,
  };

  it("counts Jan 1 to Feb 1 as exactly one period, in a leap and a common year", () => {
    expect(accruedInterestCents({ ...monthly, startDate: "2024-01-01", asOf: "2024-02-01" })).toBe(
      10_000n,
    );
    expect(accruedInterestCents({ ...monthly, startDate: "2025-02-01", asOf: "2025-03-01" })).toBe(
      10_000n,
    );
  });

  it("compounds twelve calendar months to exactly 1.01^12", () => {
    expect(accruedInterestCents({ ...monthly, startDate: "2024-01-15", asOf: "2025-01-15" })).toBe(
      126_825n,
    );
  });

  it("charges a part period by its share of that month's days", () => {
    // 15 of 31 days of one percent of 1,000,000 cents.
    expect(accruedInterestCents({ ...monthly, startDate: "2024-01-01", asOf: "2024-01-16" })).toBe(
      4_839n,
    );
  });
});

describe("accruedInterestCents, compound calendar periods", () => {
  const monthly = (startDate: string, asOf: string, dayCount: DayCount) =>
    accruedInterestCents({
      principalCents: 1_000_000n,
      ratePercent: percent("12"),
      startDate,
      asOf,
      interestType: "compound",
      dayCount,
      compounding: "monthly",
    });

  it("charges exactly one period for each whole calendar month, whatever its length", () => {
    // 1% of $10,000 is 10,000 cents.
    expect(monthly("2024-01-01", "2024-02-01", "actual_365")).toBe(10_000n);
    expect(monthly("2024-02-01", "2024-03-01", "actual_365")).toBe(10_000n);
    expect(monthly("2023-02-01", "2023-03-01", "actual_360")).toBe(10_000n);
    // Compounding twice: 1,000,000 * 1.01^2 = 1,020,100.
    expect(monthly("2024-01-01", "2024-03-01", "actual_365")).toBe(20_100n);
  });

  it("clamps month ends and counts a partial period by elapsed days", () => {
    // Jan 31 -> Feb 29 is one whole month in a leap year.
    expect(monthly("2024-01-31", "2024-02-29", "actual_365")).toBe(10_000n);
    // Half of a 30-day period (Apr 1 -> Apr 16 of Apr 1 -> May 1) earns half a month's interest.
    expect(monthly("2024-04-01", "2024-04-16", "actual_365")).toBe(5_000n);
  });
});

describe("convertSafe", () => {
  const base = {
    amountCents: 10_000_000n,
    capType: "pre_money" as const,
    roundPricePerShare: dollars("10"),
    companyCapitalization: 1_000_000n,
  };

  it("uses the round price when there is no cap or discount", () => {
    expect(convertSafe(base)).toEqual({
      pricePerShare: dollars("10"),
      shares: 10_000n,
      method: "round",
    });
  });

  it("uses the lowest of the cap price, the discount price and the round price", () => {
    expect(
      convertSafe({ ...base, valuationCapCents: 500_000_000n, discountPercent: percent("20") }),
    ).toEqual({ pricePerShare: dollars("5"), shares: 20_000n, method: "cap" });
    expect(convertSafe({ ...base, discountPercent: percent("20") })).toEqual({
      pricePerShare: dollars("8"),
      shares: 12_500n,
      method: "discount",
    });
    expect(convertSafe({ ...base, valuationCapCents: 2_000_000_000n })).toEqual({
      pricePerShare: dollars("10"),
      shares: 10_000n,
      method: "round",
    });
  });

  it("prefers the cap when the two prices tie", () => {
    expect(
      convertSafe({
        ...base,
        valuationCapCents: 800_000_000n,
        discountPercent: percent("20"),
      }),
    ).toEqual({ pricePerShare: dollars("8"), shares: 12_500n, method: "cap" });
  });

  it("skips a cap with no capitalization", () => {
    expect(
      convertSafe({ ...base, companyCapitalization: 0n, valuationCapCents: 500_000_000n }),
    ).toEqual({ pricePerShare: dollars("10"), shares: 10_000n, method: "round" });
  });

  it("rejects discounts outside [0, 100)", () => {
    for (const discountPercent of [-1n, 100n * SCALE, 150n * SCALE]) {
      expect(() => convertSafe({ ...base, discountPercent })).toThrow(RangeError);
    }
  });

  it("floors shares and rejects a non-positive round price", () => {
    expect(
      convertSafe({
        ...base,
        amountCents: 1_000_001n,
        companyCapitalization: 1_000_000n,
        valuationCapCents: 500_000_000n,
      }).shares,
    ).toBe(2_000n);
    expect(() => convertSafe({ ...base, roundPricePerShare: 0n })).toThrow(RangeError);
  });
});

describe("convertNote", () => {
  it("converts principal plus accrued interest at the conversion date", () => {
    const result = convertNote({
      principalCents: 1_000_000n,
      ratePercent: percent("5"),
      startDate: "2024-01-01",
      conversionDate: "2025-01-01",
      interestType: "simple",
      dayCount: "actual_365",
      capType: "pre_money",
      roundPricePerShare: dollars("10"),
      companyCapitalization: 1_000_000n,
    });
    expect(result.interestCents).toBe(50_137n);
    expect(result.amountCents).toBe(1_050_137n);
    expect(result.pricePerShare).toBe(dollars("10"));
    expect(result.shares).toBe(1_050n);
    expect(result.method).toBe("round");
  });

  it("applies a cap to the note's total", () => {
    const result = convertNote({
      principalCents: 1_000_000n,
      ratePercent: percent("5"),
      startDate: "2024-01-01",
      conversionDate: "2025-01-01",
      interestType: "simple",
      dayCount: "actual_365",
      capType: "pre_money",
      valuationCapCents: 500_000_000n,
      roundPricePerShare: dollars("10"),
      companyCapitalization: 1_000_000n,
    });
    expect(result.amountCents).toBe(1_050_137n);
    expect(result.pricePerShare).toBe(dollars("5"));
    expect(result.shares).toBe(2_100n);
    expect(result.method).toBe("cap");
  });
});
