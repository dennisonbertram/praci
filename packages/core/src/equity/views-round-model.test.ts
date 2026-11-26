import { describe, expect, it } from "vitest";
import { divRoundHalfUp, formatFixed, parseFixed } from "./fixed.js";
import { pricedRoundConversion } from "./priced-round.js";
import type { RoundModelInput, RoundModelResult } from "./views-round-model.js";
import { modelPricedRound } from "./views-round-model.js";

const holders = [
  { id: "ada", name: "Ada Founder", shares: 8_000_000n },
  { id: "cy", name: "Cy Engineer", shares: 2_000_000n },
];
const investor = { id: "inv", name: "Northlight Ventures", amountCents: 200_000_000n };

const base: RoundModelInput = {
  holders,
  unallocatedPoolShares: 1_000_000n,
  preMoneyValuationCents: 1_000_000_000n,
  investments: [investor],
  convertibles: [],
};

const sums = (result: RoundModelResult) => ({
  preShares: result.rows.reduce((sum, row) => sum + row.preShares, 0n),
  postShares: result.rows.reduce((sum, row) => sum + row.postShares, 0n),
  prePercent: result.rows.reduce((sum, row) => sum + Number(row.prePercent), 0),
  postPercent: result.rows.reduce((sum, row) => sum + Number(row.postPercent), 0),
});

describe("modelPricedRound", () => {
  it("prices a plain round with no convertibles and no pool target", () => {
    const result = modelPricedRound(base);
    expect(formatFixed(result.pricePerShare)).toBe("0.9090909091");
    expect(result.preMoneyFullyDilutedShares).toBe(11_000_000n);
    expect(result.poolIncreaseShares).toBe(0n);
    expect(result.conversionShares).toBe(0n);
    expect(result.newMoneyShares).toBe(2_200_000n);
    expect(result.postMoneyFullyDilutedShares).toBe(13_200_000n);
    expect(result.postMoneyValuationCents).toBe(1_200_000_000n);
    expect(result.rows.map((row) => row.id)).toEqual(["ada", "cy", "__pool", "inv"]);
    expect(result.rows.find((row) => row.id === "inv")).toMatchObject({
      kind: "new_money",
      preShares: 0n,
      postShares: 2_200_000n,
      prePercent: "0.0000",
    });
    const total = sums(result);
    expect(total.preShares).toBe(result.preMoneyFullyDilutedShares);
    expect(total.postShares).toBe(result.postMoneyFullyDilutedShares);
    expect(total.prePercent).toBeCloseTo(100, 2);
    expect(total.postPercent).toBeCloseTo(100, 2);
  });

  it("converts a pre-money capped SAFE at its cap price", () => {
    const result = modelPricedRound({
      ...base,
      convertibles: [
        {
          id: "safe",
          stakeholderId: "ivy",
          name: "Ivy Angel",
          kind: "safe",
          principalCents: 20_000_000n,
          valuationCapCents: 500_000_000n,
          preMoney: true,
        },
      ],
    });
    const safe = result.rows.find((row) => row.id === "safe");
    expect(safe).toMatchObject({ kind: "conversion", postShares: 440_000n });
    // $10,000,000 / (11,000,000 + 440,000 converted shares); the pre-money cap price is set on
    // the 11,000,000 base alone.
    expect(formatFixed(result.pricePerShare)).toBe("0.8741258741");
    expect(result.pricePerShare).toBeGreaterThan(
      divRoundHalfUp(500_000_000n * 10_000_000_000n, 100n * 11_000_000n),
    );
    expect(sums(result).postShares).toBe(result.postMoneyFullyDilutedShares);
  });

  it("rejects a capped convertible without a cap type", () => {
    expect(() =>
      modelPricedRound({
        ...base,
        convertibles: [
          {
            id: "safe",
            stakeholderId: "ivy",
            name: "Ivy Angel",
            kind: "safe",
            principalCents: 20_000_000n,
            valuationCapCents: 500_000_000n,
          },
        ],
      }),
    ).toThrow(/cap type/);
  });

  it("converts a discounted note with stored interest at the discount price", () => {
    const result = modelPricedRound({
      ...base,
      unallocatedPoolShares: 0n,
      convertibles: [
        {
          id: "note",
          stakeholderId: "sol",
          name: "Sol Capital",
          kind: "note",
          principalCents: 10_000_000n,
          interestCents: 500_000n,
          discountPercent: parseFixed("20"),
          preMoney: true,
        },
      ],
    });
    // 80% of the round price (below $1 because converting shares are in the pre-money count),
    // applied to $105,000 of principal plus interest.
    expect(result.rows.find((row) => row.id === "note")?.postShares).toBe(132_995n);
    expect(result.conversionShares).toBe(132_995n);
    expect(result.newMoneyShares).toBe(2_026_599n);
    expect(sums(result).postShares).toBe(result.postMoneyFullyDilutedShares);
    // Price times post-money fully diluted shares is the reported post-money valuation.
    const implied =
      (result.postMoneyFullyDilutedShares * result.pricePerShare * 100n) / 10_000_000_000n;
    expect(implied - result.postMoneyValuationCents).toBeLessThan(1_000n);
    expect(result.postMoneyValuationCents - implied).toBeLessThan(1_000n);
  });

  it("lets convertNote accrue the interest when a note carries its terms", () => {
    const note = {
      id: "note",
      stakeholderId: "sol",
      name: "Sol Capital",
      kind: "note" as const,
      principalCents: 10_000_000n,
      ratePercent: parseFixed("5"),
      startDate: "2024-01-01",
      conversionDate: "2025-01-01",
      interestType: "simple" as const,
      dayCount: "actual_365" as const,
      valuationCapCents: 500_000_000n,
      preMoney: true,
    };
    const accrued = modelPricedRound({ ...base, convertibles: [note] });
    const stored = modelPricedRound({
      ...base,
      convertibles: [{ ...note, interestCents: 501_370n }],
    });
    const withoutInterest = modelPricedRound({
      ...base,
      convertibles: [{ ...note, interestCents: 0n }],
    });
    const shares = (result: RoundModelResult) =>
      result.rows.find((row) => row.id === "note")?.postShares;
    expect(shares(accrued)).toBe(shares(stored));
    expect(shares(accrued)).toBeGreaterThan(shares(withoutInterest) ?? 0n);
    expect(sums(accrued).postShares).toBe(accrued.postMoneyFullyDilutedShares);
  });

  it("shuffles the pool to 10 percent of post-money fully diluted, counted pre-money", () => {
    const result = modelPricedRound({
      ...base,
      unallocatedPoolShares: 0n,
      targetPoolPercentPostMoney: parseFixed("10"),
    });
    const pool = result.rows.find((row) => row.id === "__pool");
    expect(result.poolIncreaseShares).toBe(1_363_636n);
    expect(pool).toMatchObject({
      preShares: 1_363_636n,
      postShares: 1_363_636n,
      postPercent: "10.0000",
    });
    // The shuffle is inside the pre-money denominator, so the price drops below a plain round.
    expect(result.pricePerShare).toBeLessThan(
      (base.preMoneyValuationCents * 10_000_000_000n) / 100n / 11_000_000n,
    );
    expect(sums(result).preShares).toBe(result.preMoneyFullyDilutedShares);
  });

  it("models a round with zero investments", () => {
    const result = modelPricedRound({
      ...base,
      investments: [],
      convertibles: [],
    });
    expect(result.newMoneyShares).toBe(0n);
    expect(result.postMoneyFullyDilutedShares).toBe(result.preMoneyFullyDilutedShares);
    expect(result.postMoneyValuationCents).toBe(1_000_000_000n);
    expect(result.rows.every((row) => row.prePercent === row.postPercent)).toBe(true);
    expect(result.rows.some((row) => row.kind === "new_money")).toBe(false);
  });

  it("keeps every total and percent consistent with a post-money SAFE, a note and a pool target", () => {
    const result = modelPricedRound({
      holders,
      unallocatedPoolShares: 500_000n,
      preMoneyValuationCents: 1_000_000_000n,
      investments: [{ id: "inv", name: "Northlight Ventures", amountCents: 300_000_000n }],
      convertibles: [
        {
          id: "safe",
          stakeholderId: "ivy",
          name: "Ivy Angel",
          kind: "safe",
          principalCents: 50_000_000n,
          valuationCapCents: 500_000_000n,
          preMoney: false,
        },
        {
          id: "note",
          stakeholderId: "sol",
          name: "Sol Capital",
          kind: "note",
          principalCents: 10_000_000n,
          ratePercent: parseFixed("5"),
          startDate: "2024-01-01",
          conversionDate: "2025-01-01",
          interestType: "simple",
          dayCount: "actual_365",
          valuationCapCents: 2_000_000_000n,
          preMoney: true,
        },
      ],
      targetPoolPercentPostMoney: parseFixed("10"),
    });
    const total = sums(result);
    expect(total.postShares).toBe(result.postMoneyFullyDilutedShares);
    expect(total.preShares).toBe(result.preMoneyFullyDilutedShares);
    expect(total.prePercent).toBeCloseTo(100, 2);
    expect(total.postPercent).toBeCloseTo(100, 2);
    expect(result.postMoneyValuationCents).toBe(1_300_000_000n);
    // Post-money caps include conversions but exclude financing shares and the pool increase.
    const safeShares = result.rows.find((row) => row.id === "safe")!.postShares;
    const postCapBase = 10_500_000n + result.conversionShares;
    expect(safeShares * 10n).toBeLessThanOrEqual(postCapBase);
    expect((safeShares + 1n) * 10n).toBeGreaterThan(postCapBase);
    expect(result.rows.find((row) => row.id === "__pool")?.postPercent).toBe("10.0000");
  });

  it("prices a multi-SAFE and note mixture identically in scenario and execution", () => {
    const convertibles = [
      {
        id: "pre-safe",
        stakeholderId: "ivy",
        name: "Ivy Angel",
        kind: "safe" as const,
        principalCents: 20_000_000n,
        valuationCapCents: 500_000_000n,
        preMoney: true,
      },
      {
        id: "post-safe",
        stakeholderId: "sol",
        name: "Sol Capital",
        kind: "safe" as const,
        principalCents: 100_000_000n,
        valuationCapCents: 1_000_000_000n,
        preMoney: false,
      },
      {
        id: "discount-safe",
        stakeholderId: "cy",
        name: "Cy Angel",
        kind: "safe" as const,
        principalCents: 5_000_000n,
        discountPercent: parseFixed("20"),
      },
      {
        id: "note",
        stakeholderId: "ada",
        name: "Ada Capital",
        kind: "note" as const,
        principalCents: 10_000_000n,
        ratePercent: parseFixed("5"),
        startDate: "2024-01-01",
        conversionDate: "2025-01-01",
        interestType: "simple" as const,
        dayCount: "actual_365" as const,
        discountPercent: parseFixed("10"),
      },
    ];
    const scenario = modelPricedRound({ ...base, convertibles });
    const execution = pricedRoundConversion({
      preMoneyValuationCents: base.preMoneyValuationCents,
      newMoneyCents: investor.amountCents,
      preRoundFullyDilutedShares: 11_000_000n,
      asOf: "2025-01-01",
      convertibles: [
        {
          id: "pre-safe",
          kind: "safe",
          principalCents: 20_000_000n,
          valuationCapCents: 500_000_000n,
          capType: "pre_money",
          discountPercent: null,
        },
        {
          id: "post-safe",
          kind: "safe",
          principalCents: 100_000_000n,
          valuationCapCents: 1_000_000_000n,
          capType: "post_money",
          discountPercent: null,
        },
        {
          id: "discount-safe",
          kind: "safe",
          principalCents: 5_000_000n,
          valuationCapCents: null,
          capType: "pre_money",
          discountPercent: parseFixed("20"),
        },
        {
          id: "note",
          kind: "note",
          principalCents: 10_000_000n,
          valuationCapCents: null,
          capType: "pre_money",
          discountPercent: parseFixed("10"),
          ratePercent: parseFixed("5"),
          startDate: "2024-01-01",
          interestType: "simple",
          dayCount: "actual_365",
        },
      ],
    });

    expect(formatFixed(scenario.pricePerShare)).toBe(execution.pricePerShare);
    expect(scenario.newMoneyShares).toBe(execution.newMoneyShares);
    expect(scenario.conversionShares).toBe(execution.totalConvertedShares);
    for (const conversion of execution.convertibles) {
      expect(scenario.rows.find((row) => row.id === conversion.id)?.postShares).toBe(
        conversion.shares,
      );
    }
  });

  it("floors each investor's new-money allocation consistently with execution", () => {
    const investments = [
      { id: "inv-a", name: "Investor A", amountCents: 50n },
      { id: "inv-b", name: "Investor B", amountCents: 50n },
    ];
    const scenario = modelPricedRound({ ...base, investments, convertibles: [] });
    const execution = pricedRoundConversion({
      preMoneyValuationCents: base.preMoneyValuationCents,
      newMoneyCents: 100n,
      investmentAmountsCents: investments.map((investment) => investment.amountCents),
      preRoundFullyDilutedShares: 11_000_000n,
      asOf: "2025-01-01",
      convertibles: [],
    });

    expect(scenario.newMoneyShares).toBe(0n);
    expect(scenario.newMoneyShares).toBe(execution.newMoneyShares);
    expect(
      scenario.rows
        .filter((row) => row.kind === "new_money")
        .reduce((sum, row) => sum + row.postShares, 0n),
    ).toBe(execution.newMoneyShares);
    expect(
      scenario.rows.filter((row) => row.kind === "new_money").map((row) => row.postShares),
    ).toEqual([0n, 0n]);
  });

  it("floors one-cent investors independently at a two-cent price", () => {
    const investments = [
      { id: "inv-a", name: "Investor A", amountCents: 1n },
      { id: "inv-b", name: "Investor B", amountCents: 1n },
    ];
    const scenarioInput: RoundModelInput = {
      holders: [{ id: "founder", name: "Founder", shares: 1n }],
      unallocatedPoolShares: 0n,
      preMoneyValuationCents: 2n,
      investments,
      convertibles: [],
    };
    const scenario = modelPricedRound(scenarioInput);
    const execution = pricedRoundConversion({
      preMoneyValuationCents: 2n,
      newMoneyCents: 2n,
      investmentAmountsCents: investments.map((investment) => investment.amountCents),
      preRoundFullyDilutedShares: 1n,
      asOf: "2025-01-01",
      convertibles: [],
    });

    expect(formatFixed(scenario.pricePerShare)).toBe("0.0200000000");
    expect(scenario.newMoneyShares).toBe(0n);
    expect(scenario.newMoneyShares).toBe(execution.newMoneyShares);
    expect(
      scenario.rows.filter((row) => row.kind === "new_money").map((row) => row.postShares),
    ).toEqual([0n, 0n]);
  });

  it("preserves repeating-decimal per-investor floors in scenario and execution", () => {
    const investments = [
      { id: "inv-a", name: "Investor A", amountCents: 1n },
      { id: "inv-b", name: "Investor B", amountCents: 1n },
      { id: "inv-c", name: "Investor C", amountCents: 1n },
    ];
    const scenario = modelPricedRound({
      holders: [{ id: "founder", name: "Founder", shares: 7n }],
      unallocatedPoolShares: 0n,
      preMoneyValuationCents: 3n,
      investments,
      convertibles: [],
    });
    const execution = pricedRoundConversion({
      preMoneyValuationCents: 3n,
      newMoneyCents: 3n,
      investmentAmountsCents: investments.map((investment) => investment.amountCents),
      preRoundFullyDilutedShares: 7n,
      asOf: "2025-01-01",
      convertibles: [],
    });

    expect(scenario.newMoneyShares).toBe(6n);
    expect(scenario.newMoneyShares).toBe(execution.newMoneyShares);
    expect(
      scenario.rows.filter((row) => row.kind === "new_money").map((row) => row.postShares),
    ).toEqual([2n, 2n, 2n]);
  });

  it("solves a feasible 80 percent target pool and rejects impossible pool and cap ownership", () => {
    const highPool = modelPricedRound({
      ...base,
      unallocatedPoolShares: 0n,
      convertibles: [],
      targetPoolPercentPostMoney: parseFixed("80"),
    });
    expect(highPool.rows.find((row) => row.id === "__pool")?.postPercent).toBe("80.0000");

    expect(() =>
      modelPricedRound({
        ...base,
        unallocatedPoolShares: 0n,
        convertibles: [],
        targetPoolPercentPostMoney: parseFixed("90"),
      }),
    ).toThrow(/pool|converg|feasib/i);
    expect(() =>
      modelPricedRound({ ...base, targetPoolPercentPostMoney: parseFixed("100") }),
    ).toThrow(/pool|100/i);
    expect(() =>
      modelPricedRound({
        ...base,
        investments: [],
        convertibles: [
          {
            id: "full-ownership",
            stakeholderId: "ivy",
            name: "Ivy Angel",
            kind: "safe",
            principalCents: 100_000_000n,
            valuationCapCents: 100_000_000n,
            preMoney: false,
          },
        ],
      }),
    ).toThrow(/ownership|100/i);
  });

  it("does not change its inputs", () => {
    const input: RoundModelInput = {
      ...base,
      convertibles: [
        {
          id: "safe",
          stakeholderId: "ivy",
          name: "Ivy Angel",
          kind: "safe",
          principalCents: 20_000_000n,
          valuationCapCents: 500_000_000n,
          preMoney: true,
        },
      ],
      targetPoolPercentPostMoney: parseFixed("10"),
    };
    const snapshot = JSON.stringify(input, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value,
    );
    modelPricedRound(input);
    expect(
      JSON.stringify(input, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value,
      ),
    ).toBe(snapshot);
  });

  it("rejects a round with no positive valuation or no shares", () => {
    expect(() => modelPricedRound({ ...base, preMoneyValuationCents: 0n })).toThrow(RangeError);
    expect(() => modelPricedRound({ ...base, holders: [], unallocatedPoolShares: 0n })).toThrow(
      RangeError,
    );
  });
});
