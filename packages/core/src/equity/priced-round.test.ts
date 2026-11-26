import { describe, expect, it } from "vitest";
import { parseFixed, SCALE } from "./fixed.js";
import { pricedRoundConversion } from "./priced-round.js";

const percent = (value: string) => parseFixed(value);

// A round with $8,000,000 pre-money and 8,000,000 pre-round fully diluted shares gives a
// $1.00 round price before conversions. Converting SAFEs and notes count in the pre-money share
// count, so each converting test shows a lower round price than $1.00.
const round = {
  preMoneyValuationCents: 800_000_000n,
  newMoneyCents: 200_000_000n,
  preRoundFullyDilutedShares: 8_000_000n,
  asOf: "2024-06-30",
};

describe("pricedRoundConversion", () => {
  it("converts a SAFE at its valuation cap", () => {
    const result = pricedRoundConversion({
      ...round,
      convertibles: [
        {
          id: "safe-1",
          kind: "safe",
          principalCents: 100_000_000n, // $1,000,000
          valuationCapCents: 500_000_000n, // $5,000,000 / 8,000,000 shares = $0.625
          capType: "pre_money",
          discountPercent: null,
        },
      ],
    });

    // 1,600,000 converted shares: $8,000,000 / (8,000,000 + 1,600,000) = $0.8333

    expect(result.pricePerShare).toBe("0.8333333333");
    expect(result.newMoneyShares).toBe(2_400_000n);
    expect(result.convertibles).toEqual([
      {
        id: "safe-1",
        // floor(100,000,000 * SCALE / 6,250,000,000) = floor(160,000,000)
        shares: 1_600_000n,
        conversionPrice: "0.6250000000",
        method: "cap",
        amountConvertedCents: 100_000_000n,
      },
    ]);
    expect(result.totalConvertedShares).toBe(1_600_000n);
    // 8,000,000 pre-round + 2,400,000 new money + 1,600,000 converted; at $0.8333 that is $10M,
    // the pre-money valuation plus the new money.
    expect(result.postRoundFullyDilutedShares).toBe(12_000_000n);
  });

  it("converts a SAFE at its discount when that beats the round price", () => {
    const result = pricedRoundConversion({
      ...round,
      convertibles: [
        {
          id: "safe-2",
          kind: "safe",
          principalCents: 50_000_000n, // $500,000
          valuationCapCents: null,
          capType: null,
          discountPercent: percent("20"), // $1.00 * 0.80 = $0.80
        },
      ],
    });

    // Round price $0.921875 (conversions are in the denominator), discount price 80% of that.
    expect(result.pricePerShare).toBe("0.9218750000");

    expect(result.convertibles[0]?.conversionPrice).toBe("0.7375000000");
    expect(result.convertibles[0]?.method).toBe("discount");
    expect(result.convertibles[0]?.shares).toBe(677_966n);
    expect(result.convertibles[0]?.amountConvertedCents).toBe(50_000_000n);
    expect(result.newMoneyShares).toBe(2_169_491n);
    expect(result.postRoundFullyDilutedShares).toBe(8_000_000n + 2_169_491n + 677_966n);
  });

  it("converts a note on principal plus interest to the as-of date", () => {
    const result = pricedRoundConversion({
      ...round,
      asOf: "2024-07-01",
      convertibles: [
        {
          id: "note-1",
          kind: "note",
          principalCents: 50_000_000n, // $500,000
          valuationCapCents: 400_000_000n, // $4,000,000 / 8,000,000 shares = $0.50
          capType: "pre_money",
          discountPercent: null,
          ratePercent: percent("5"),
          startDate: "2023-07-01",
          interestType: "simple",
          dayCount: "30_360",
        },
      ],
    });

    // 30/360 from 2023-07-01 to 2024-07-01 is 360 days, so interest is
    // 50,000,000 * 5% * 360 / 360 = 2,500,000 cents and the amount is 52,500,000 cents.
    expect(result.convertibles[0]?.amountConvertedCents).toBe(52_500_000n);
    expect(result.convertibles[0]?.conversionPrice).toBe("0.5000000000");
    expect(result.convertibles[0]?.method).toBe("cap");
    // floor(52,500,000 * SCALE / 5,000,000,000) = floor(105,000,000)
    expect(result.convertibles[0]?.shares).toBe(1_050_000n);
    expect(result.totalConvertedShares).toBe(1_050_000n);
    expect(result.pricePerShare).toBe("0.8839779006");
    expect(result.newMoneyShares).toBe(2_262_500n);
    expect(result.postRoundFullyDilutedShares).toBe(8_000_000n + 2_262_500n + 1_050_000n);
  });

  it("includes a pre-round pool top-up in the round price", () => {
    const result = pricedRoundConversion({ ...round, poolTopUpShares: 500_000n, convertibles: [] });

    expect(result.convertibles).toEqual([]);
    expect(result.totalConvertedShares).toBe(0n);
    expect(result.pricePerShare).toBe("0.9411764706");
    expect(result.newMoneyShares).toBe(2_125_000n);
    expect(result.postRoundFullyDilutedShares).toBe(10_625_000n);
  });

  it("solves a post-money cap against the base and converting shares, not financing shares", () => {
    const result = pricedRoundConversion({
      preMoneyValuationCents: 10_000_000_000n,
      newMoneyCents: 200_000_000n,
      preRoundFullyDilutedShares: 9_000_000n,
      asOf: "2024-06-30",
      convertibles: [
        {
          id: "post-safe",
          kind: "safe",
          principalCents: 100_000_000n,
          valuationCapCents: 1_000_000_000n,
          capType: "post_money",
          discountPercent: null,
        },
      ],
    });

    expect(result.convertibles[0]?.shares).toBe(1_000_000n);
    expect(result.convertibles[0]?.conversionPrice).toBe("1.0000000000");
    // $100M pre-money over 10,000,000 pre-money shares is $10.00; $2M buys 200,000 shares.
    expect(result.pricePerShare).toBe("10.0000000000");
    expect(result.newMoneyShares).toBe(200_000n);
  });

  it("keeps cap-price fractions exact through the final share floor", () => {
    const result = pricedRoundConversion({
      preMoneyValuationCents: 10_000_000_000n,
      newMoneyCents: 0n,
      preRoundFullyDilutedShares: 21_000_000n,
      asOf: "2024-06-30",
      convertibles: [
        {
          id: "exact-cap",
          kind: "safe",
          principalCents: 100_000_000n,
          valuationCapCents: 300_000_000n,
          capType: "pre_money",
          discountPercent: null,
        },
      ],
    });

    expect(result.convertibles[0]?.conversionPrice).toBe("0.1428571429");
    expect(result.convertibles[0]?.shares).toBe(7_000_000n);
  });

  it("rejects discounts outside [0, 100)", () => {
    const safe = {
      id: "invalid-discount",
      kind: "safe" as const,
      principalCents: 10_000_000n,
      valuationCapCents: null,
      capType: null,
    };
    for (const discountPercent of [-1n, percent("100")]) {
      expect(() =>
        pricedRoundConversion({
          ...round,
          convertibles: [{ ...safe, discountPercent }],
        }),
      ).toThrow(RangeError);
    }
  });

  it("applies accrued note interest before exact round-price share flooring", () => {
    const result = pricedRoundConversion({
      preMoneyValuationCents: 300_000_000n,
      newMoneyCents: 0n,
      preRoundFullyDilutedShares: 21_000_000n,
      asOf: "2024-07-01",
      convertibles: [
        {
          id: "note-interest",
          kind: "note",
          principalCents: 1_000_000n,
          valuationCapCents: null,
          capType: null,
          discountPercent: null,
          ratePercent: percent("10"),
          startDate: "2023-07-01",
          interestType: "simple",
          dayCount: "30_360",
        },
      ],
    });

    // $3,000,000 / (21,000,000 + 77,283 converted shares)

    expect(result.pricePerShare).toBe("0.1423333333");
    expect(result.convertibles[0]?.amountConvertedCents).toBe(1_100_000n);
    expect(result.convertibles[0]?.shares).toBe(77_283n);
  });

  it("handles a round with no convertibles", () => {
    const result = pricedRoundConversion({ ...round, convertibles: [] });

    expect(result.pricePerShare).toBe("1.0000000000");
    expect(result.newMoneyShares).toBe(2_000_000n);
    expect(result.totalConvertedShares).toBe(0n);
    expect(result.postRoundFullyDilutedShares).toBe(10_000_000n);
  });

  it("picks the lowest of cap, discount and round for each convertible", () => {
    const result = pricedRoundConversion({
      ...round,
      convertibles: [
        {
          // cap $0.50, discount $0.80, round $1.00 -> cap
          id: "cap-wins",
          kind: "safe",
          principalCents: 10_000_000n,
          valuationCapCents: 400_000_000n,
          capType: "pre_money",
          discountPercent: percent("20"),
        },
        {
          // cap $0.50, discount $0.40, round $1.00 -> discount
          id: "discount-wins",
          kind: "safe",
          principalCents: 10_000_000n,
          valuationCapCents: 400_000_000n,
          capType: "pre_money",
          discountPercent: percent("60"),
        },
        {
          // no cap, no discount -> round
          id: "round-wins",
          kind: "safe",
          principalCents: 10_000_000n,
          valuationCapCents: null,
          capType: null,
          discountPercent: null,
        },
        {
          // cap $2.00 is worse than the $1.00 round and the $0.90 discount -> discount
          id: "high-cap",
          kind: "safe",
          principalCents: 10_000_000n,
          valuationCapCents: 1_600_000_000n,
          capType: "pre_money",
          discountPercent: percent("10"),
        },
      ],
    });

    expect(result.convertibles.map((item) => item.id)).toEqual([
      "cap-wins",
      "discount-wins",
      "round-wins",
      "high-cap",
    ]);
    expect(result.convertibles.map((item) => item.method)).toEqual([
      "cap",
      "discount",
      "round",
      "discount",
    ]);
    // The round price falls to $0.9193767 because the converted shares count pre-money.
    expect(result.pricePerShare).toBe("0.9193766938");
    expect(result.convertibles.map((item) => item.conversionPrice)).toEqual([
      "0.5000000000",
      "0.3677506775",
      "0.9193766938",
      "0.8274390244",
    ]);
    // $100,000 / price, floored.
    expect(result.convertibles.map((item) => item.shares)).toEqual([
      200_000n,
      271_923n,
      108_769n,
      120_854n,
    ]);
  });

  it("rejects a zero pre-round share count and other invalid input", () => {
    expect(() =>
      pricedRoundConversion({ ...round, preRoundFullyDilutedShares: 0n, convertibles: [] }),
    ).toThrow(RangeError);
    expect(() =>
      pricedRoundConversion({ ...round, preMoneyValuationCents: 0n, convertibles: [] }),
    ).toThrow(RangeError);
    expect(() =>
      pricedRoundConversion({ ...round, preMoneyValuationCents: -1n, convertibles: [] }),
    ).toThrow(RangeError);
    expect(() => pricedRoundConversion({ ...round, newMoneyCents: -1n, convertibles: [] })).toThrow(
      RangeError,
    );
    expect(() =>
      pricedRoundConversion({ ...round, poolTopUpShares: -1n, convertibles: [] }),
    ).toThrow(RangeError);
    expect(() => pricedRoundConversion({ ...round, asOf: "06/30/2024", convertibles: [] })).toThrow(
      RangeError,
    );
  });

  it("rejects a duplicate convertible id", () => {
    const convertible = {
      id: "duplicate",
      kind: "safe",
      principalCents: 10_000_000n,
      valuationCapCents: 400_000_000n,
      capType: "pre_money",
      discountPercent: null,
    } as const;
    expect(() =>
      pricedRoundConversion({ ...round, convertibles: [convertible, convertible] }),
    ).toThrow(RangeError);
  });
});

describe("pricedRoundConversion share counts", () => {
  it("floors the new-money shares when the price does not divide evenly", () => {
    const result = pricedRoundConversion({
      preMoneyValuationCents: 1_000_000_001n, // price is just under $1.00
      newMoneyCents: 100_000_000n,
      preRoundFullyDilutedShares: 10_000_000n,
      asOf: "2024-06-30",
      convertibles: [],
    });

    // $10,000,000.01 / 10,000,000 shares = $1.000000001 per share, so 100,000,000 new-money cents
    // buy floor(100,000,000 * SCALE / 10,000,000,010)  / 100 = 999,999 shares.
    expect(result.pricePerShare).toBe("1.0000000010");
    expect(result.newMoneyShares).toBe(999_999n);
  });

  it("treats aggregate new money as one investment when allocations are omitted", () => {
    const result = pricedRoundConversion({
      preMoneyValuationCents: 2n,
      newMoneyCents: 2n,
      preRoundFullyDilutedShares: 1n,
      asOf: "2024-06-30",
      convertibles: [],
    });
    expect(result.pricePerShare).toBe("0.0200000000");
    expect(result.newMoneyShares).toBe(1n);
  });

  it("validates explicit per-investor amounts", () => {
    expect(() =>
      pricedRoundConversion({
        ...round,
        newMoneyCents: 100n,
        investmentAmountsCents: [50n, 40n],
        convertibles: [],
      }),
    ).toThrow(/sum to newMoneyCents/);
    expect(() =>
      pricedRoundConversion({
        ...round,
        newMoneyCents: 100n,
        investmentAmountsCents: [101n, -1n],
        convertibles: [],
      }),
    ).toThrow(/must not be negative/);
  });
});

describe("pricedRoundConversion pre-money share count", () => {
  const mixed = [
    {
      id: "pre-cap",
      kind: "safe" as const,
      principalCents: 50_000_000n,
      valuationCapCents: 400_000_000n,
      capType: "pre_money" as const,
      discountPercent: null,
    },
    {
      id: "post-cap",
      kind: "safe" as const,
      principalCents: 100_000_000n,
      valuationCapCents: 500_000_000n,
      capType: "post_money" as const,
      discountPercent: null,
    },
    {
      id: "discount",
      kind: "safe" as const,
      principalCents: 30_000_000n,
      valuationCapCents: null,
      capType: null,
      discountPercent: percent("15"),
    },
    {
      id: "round",
      kind: "safe" as const,
      principalCents: 20_000_000n,
      valuationCapCents: null,
      capType: null,
      discountPercent: null,
    },
  ];

  it("makes price times post-money fully diluted shares equal pre-money plus new money", () => {
    const result = pricedRoundConversion({
      ...round,
      poolTopUpShares: 400_000n,
      investmentAmountsCents: [120_000_000n, 80_000_000n],
      convertibles: mixed,
    });
    const impliedPostMoneyCents =
      (result.postRoundFullyDilutedShares * parseFixed(result.pricePerShare) * 100n) / SCALE;
    const expected = round.preMoneyValuationCents + round.newMoneyCents;
    const gap =
      impliedPostMoneyCents > expected
        ? impliedPostMoneyCents - expected
        : expected - impliedPostMoneyCents;
    // Only the per-holder share floors and the rounded display price separate the two.
    expect(gap * 100_000n).toBeLessThan(expected);
    expect(result.convertibles.map((item) => item.method)).toEqual([
      "cap",
      "cap",
      "discount",
      "round",
    ]);
    // Worked by hand, not taken from the code. Price base = 8,000,000 + 400,000 pool = 8,400,000.
    //   pre-money cap:  $4,000,000 / 8,400,000 = $0.47619, so $500,000 buys exactly 1,050,000.
    //   post-money cap: $1,000,000 / $5,000,000 = 20% of (8,000,000 + C).
    //   discount note:  $300,000 / (8,000,000 * 0.85) = 0.0441176 of the price base plus C.
    //   round SAFE:     $200,000 / 8,000,000 = 0.025 of the price base plus C.
    // C = 1,050,000 + 0.2 * (8,000,000 + C) + 0.0691176 * (8,400,000 + C)
    //   => C = 3,230,588.2 / 0.7308824 = 4,420,120.72 converting shares.
    // Price = $8,000,000 / (8,400,000 + C) = $0.62401908. Each share count is floored.
    expect(result.pricePerShare).toBe("0.6240190847");
    expect(result.convertibles.map((item) => item.shares)).toEqual([
      1_050_000n,
      2_484_024n,
      565_593n,
      320_503n,
    ]);
    // Investors pay $1,200,000 and $800,000: 1,923,018.4 and 1,282,012.2 shares before flooring.
    expect(result.newMoneyShares).toBe(1_923_018n + 1_282_012n);
    // The post-money SAFE holds 20% of 8,000,000 + C (C = 4,420,120.72): 2,484,024.1 shares.
    expect(result.convertibles[1]!.shares * 5n).toBeLessThanOrEqual(8_000_000n + 4_420_121n);
    expect(result.convertibles[1]!.shares * 5n).toBeGreaterThan(8_000_000n + 4_420_120n - 5n);
  });

  // For each kind of convertible, the round price times the post-round fully diluted shares is the
  // pre-money valuation plus new money, apart from the shares lost to flooring (under one share's
  // price per holder) and the half-up rounding of the displayed 10-digit price.
  const priceTimesShares = (result: ReturnType<typeof pricedRoundConversion>) =>
    result.postRoundFullyDilutedShares * parseFixed(result.pricePerShare) * 100n;
  const gapWithinFlooring = (
    result: ReturnType<typeof pricedRoundConversion>,
    expectedCents: bigint,
    holders: bigint,
  ) => {
    const implied = priceTimesShares(result);
    const gap =
      implied > expectedCents * SCALE
        ? implied - expectedCents * SCALE
        : expectedCents * SCALE - implied;
    // holders * one share's price, in the same scaled cents, plus one cent for display rounding.
    expect(gap).toBeLessThanOrEqual(holders * parseFixed(result.pricePerShare) * 100n + SCALE);
  };

  it("holds for a pre-money cap SAFE: $8M pre-money, $1M SAFE at a $5M cap", () => {
    // C = $1,000,000 / ($5,000,000 / 8,000,000) = 1,600,000 shares, price $8,000,000 / 9,600,000
    // = $0.83333, new money $2,000,000 / price = 2,400,000, post-round 12,000,000 shares and
    // 12,000,000 * 0.83333 = $10,000,000. Every count is a whole number, so nothing is floored.
    const result = pricedRoundConversion({
      ...round,
      convertibles: [
        {
          id: "pre-cap",
          kind: "safe",
          principalCents: 100_000_000n,
          valuationCapCents: 500_000_000n,
          capType: "pre_money",
          discountPercent: null,
        },
      ],
    });
    expect(result.postRoundFullyDilutedShares).toBe(12_000_000n);
    gapWithinFlooring(result, 1_000_000_000n, 0n);
  });

  it("holds for a post-money cap SAFE: 9M shares, $1M SAFE at a $10M post-money cap", () => {
    // The SAFE owns 10% of (9,000,000 + C), so C = 1,000,000. Price = $100,000,000 /
    // 10,000,000 = $10.00; new money $2,000,000 buys 200,000 shares; post-round 10,200,000
    // shares * $10.00 = $102,000,000. Every count is a whole number.
    const result = pricedRoundConversion({
      preMoneyValuationCents: 10_000_000_000n,
      newMoneyCents: 200_000_000n,
      preRoundFullyDilutedShares: 9_000_000n,
      asOf: "2024-06-30",
      convertibles: [
        {
          id: "post-cap",
          kind: "safe",
          principalCents: 100_000_000n,
          valuationCapCents: 1_000_000_000n,
          capType: "post_money",
          discountPercent: null,
        },
      ],
    });
    expect(result.convertibles[0]!.shares).toBe(1_000_000n);
    expect(result.postRoundFullyDilutedShares).toBe(10_200_000n);
    gapWithinFlooring(result, 10_200_000_000n, 0n);
  });

  it("holds for a note with accrued interest: $3M pre-money, 21M shares, $10k at 10% for a year", () => {
    // 30/360 simple interest for one year is $1,000, so $11,000 converts at the round price:
    // C = 11,000 / (3,000,000 / (21,000,000 + C)) => C = 231,000,000 / 2,989 = 77,283.37 shares,
    // price = $3,000,000 / 21,077,283.37 = $0.1423333. C is floored to 77,283.
    const result = pricedRoundConversion({
      preMoneyValuationCents: 300_000_000n,
      newMoneyCents: 0n,
      preRoundFullyDilutedShares: 21_000_000n,
      asOf: "2024-07-01",
      convertibles: [
        {
          id: "note",
          kind: "note",
          principalCents: 1_000_000n,
          valuationCapCents: null,
          capType: null,
          discountPercent: null,
          ratePercent: percent("10"),
          startDate: "2023-07-01",
          interestType: "simple",
          dayCount: "30_360",
        },
      ],
    });
    expect(result.convertibles[0]!.amountConvertedCents).toBe(1_100_000n);
    expect(result.convertibles[0]!.shares).toBe(77_283n);
    expect(result.postRoundFullyDilutedShares).toBe(21_077_283n);
    gapWithinFlooring(result, 300_000_000n, 1n);
  });

  it("rejects a capped convertible without a cap type instead of assuming pre-money", () => {
    expect(() =>
      pricedRoundConversion({
        ...round,
        convertibles: [{ ...mixed[0]!, capType: null }],
      }),
    ).toThrow(/cap type/);
  });

  it("rejects post-money caps that cannot all be honored", () => {
    expect(() =>
      pricedRoundConversion({
        ...round,
        convertibles: [
          {
            ...mixed[1]!,
            id: "a",
            principalCents: 60_000_000n,
            valuationCapCents: 100_000_000n,
          },
          {
            ...mixed[1]!,
            id: "b",
            principalCents: 60_000_000n,
            valuationCapCents: 100_000_000n,
          },
        ],
      }),
    ).toThrow(/100 percent/);
  });
});

describe("pricedRoundConversion post-money cap guard", () => {
  // The guard runs on the SAFEs that convert at their cap. A SAFE that does not convert at its cap
  // gets a lower price than the cap price, so it owns more than principal / cap. If the cap
  // ownerships of all post-money SAFEs reach 100 percent, the real ownership is at least as high,
  // and no share count is consistent (C = ownership * (base + C) has no finite solution). An
  // upfront sum over every post-money SAFE therefore rejects only rounds that are unsolvable
  // anyway, and this test pins that adding a discount does not rescue them.
  it("still rejects post-money caps summing past 100 percent when one SAFE also has a discount", () => {
    const safe = {
      kind: "safe" as const,
      principalCents: 60_000_000n, // $600,000
      valuationCapCents: 100_000_000n, // $1,000,000 post-money cap: 60 percent each
      capType: "post_money" as const,
    };
    expect(() =>
      pricedRoundConversion({
        ...round,
        convertibles: [
          { ...safe, id: "cap", discountPercent: null },
          { ...safe, id: "discount", discountPercent: percent("90") },
        ],
      }),
    ).toThrow(RangeError);
  });
});

describe("pricedRoundConversion zero cap", () => {
  it("rejects a zero valuation cap instead of treating it as no cap", () => {
    expect(() =>
      pricedRoundConversion({
        ...round,
        convertibles: [
          {
            id: "zero-cap",
            kind: "safe",
            principalCents: 10_000_000n,
            valuationCapCents: 0n,
            capType: "pre_money",
            discountPercent: null,
          },
        ],
      }),
    ).toThrow(/valuationCapCents must be positive/);
  });
});
