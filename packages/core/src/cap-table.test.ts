import { describe, expect, it } from "vitest";
import { capTableMath, equityRaisedUsd } from "./cap-table.js";

const holder = (
  name: string,
  shares: number | null,
  amountUsd: number | null = null,
  security = "Common",
) => ({
  name,
  security,
  shares,
  amountUsd,
});

describe("capTableMath", () => {
  it("counts the pool once in the denominator and sums the percent column to 100.0", () => {
    const math = capTableMath({
      fullyDilutedShares: 1000,
      optionPoolAvailable: 100,
      holders: [holder("A", 450), holder("B", 450)],
    });
    expect(math.holders.map((h) => h.percent)).toEqual([45, 45]);
    expect(math.pool?.percent).toBe(10);
    expect(math.reconciles).toBe(true);
    expect(math.totalShares).toBe(1000);
  });

  it("groups the holdings by security, largest first", () => {
    const math = capTableMath({
      fullyDilutedShares: 100,
      optionPoolAvailable: 10,
      holders: [
        holder("A", 30, null, "Common"),
        holder("B", 60, null, "Seed Preferred"),
        holder("C", 0, null, "Common"),
      ],
    });
    expect(math.classes).toEqual([
      { name: "Seed Preferred", shares: 60, percent: 60 },
      { name: "Common", shares: 30, percent: 30 },
    ]);
    expect(math.pool?.percent).toBe(10);
  });

  it("rounds so the column sums to exactly 100.0", () => {
    const math = capTableMath({
      fullyDilutedShares: 3,
      optionPoolAvailable: null,
      holders: [holder("A", 1), holder("B", 1), holder("C", 1)],
    });
    const percents = math.holders.map((h) => h.percent as number);
    expect(percents.reduce((sum, p) => sum + Math.round(p * 10), 0)).toBe(1000);
    expect(percents).toEqual([33.4, 33.3, 33.3]);
  });

  it("keeps a snapshot SAFE outside the 100% and out of Raised", () => {
    const math = capTableMath({
      fullyDilutedShares: 100,
      optionPoolAvailable: null,
      holders: [holder("A", 100, 500), holder("Fund", null, 250, "SAFE")],
    });
    expect(math.holders[0]?.percent).toBe(100);
    expect(math.holders[1]?.percent).toBeNull();
    expect(math.raisedUsd).toBe(500);
  });

  it("keeps null shares and null invested as unknown", () => {
    const math = capTableMath({
      fullyDilutedShares: 100,
      optionPoolAvailable: null,
      holders: [holder("A", 100, null), holder("B", null, null)],
    });
    expect(math.holders[1]?.percent).toBeNull();
    expect(math.raisedUsd).toBe(0);
  });

  it("shows no percentages when the rows do not add up to the source's total", () => {
    const math = capTableMath({
      fullyDilutedShares: 1000,
      optionPoolAvailable: null,
      holders: [holder("A", 400), holder("B", 400)],
    });
    expect(math.reconciles).toBe(false);
    expect(math.holders.every((h) => h.percent === null)).toBe(true);
    expect(math.pool).toBeNull();
  });

  it("handles a table with no money and no shares", () => {
    const math = capTableMath({ fullyDilutedShares: 0, optionPoolAvailable: null, holders: [] });
    expect(math.raisedUsd).toBe(0);
    expect(math.totalShares).toBe(0);
    expect(math.holders).toEqual([]);
  });
});

describe("equityRaisedUsd", () => {
  it("adds only Funded SAFEs to the invested money; Sent, Signed and SAFE rows add nothing", () => {
    const holders = [holder("A", 100, 100_000), holder("Fund", null, 999, "SAFE")];
    const safes = [
      { status: "funded", amountCents: 15_000_000 },
      { status: "sent", amountCents: 5_000_000 },
      { status: "signed", amountCents: 5_000_000 },
    ] as const;
    expect(equityRaisedUsd(holders, safes)).toBe(250_000);
    expect(
      capTableMath({ fullyDilutedShares: 100, optionPoolAvailable: null, holders }).raisedUsd,
    ).toBe(100_000);
  });

  it("ignores the source company total so every page agrees on Funded SAFEs", () => {
    const holders = [holder("A", 100, null), holder("Fund", null, 9, "SAFE")];
    const safes = [{ status: "funded", amountCents: 15_000_000 }] as const;
    expect(equityRaisedUsd(holders, safes)).toBe(150_000);
    expect(equityRaisedUsd([], [])).toBeNull();
  });

  it("is null when nothing is known to add up", () => {
    expect(
      equityRaisedUsd([holder("A", 100, null), holder("Fund", null, 9, "SAFE")], []),
    ).toBeNull();
    expect(equityRaisedUsd([], [{ status: "draft", amountCents: 100 }])).toBeNull();
  });
});
