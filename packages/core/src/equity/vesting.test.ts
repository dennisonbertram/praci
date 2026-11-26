import { describe, expect, it } from "vitest";
import type { VestingRule } from "./vesting.js";
import { describeVesting, vestedShares, vestingEvents } from "./vesting.js";

const monthly: VestingRule = {
  startDate: "2024-01-01",
  totalMonths: 48,
  cliffMonths: 0,
  frequencyMonths: 1,
};

const TOTAL = 1_000_000n;

describe("vestedShares, even rule", () => {
  it("vests nothing at the start and one period's slice per month", () => {
    expect(vestedShares(monthly, TOTAL, "2023-12-31")).toBe(0n);
    expect(vestedShares(monthly, TOTAL, "2024-01-01")).toBe(0n);
    expect(vestedShares(monthly, TOTAL, "2024-01-31")).toBe(0n);
    expect(vestedShares(monthly, TOTAL, "2024-02-01")).toBe(20_833n);
    expect(vestedShares(monthly, TOTAL, "2025-01-01")).toBe(250_000n);
    expect(vestedShares(monthly, TOTAL, "2028-01-01")).toBe(TOTAL);
    expect(vestedShares(monthly, TOTAL, "2030-01-01")).toBe(TOTAL);
  });

  it("vests nothing before the cliff and the cumulative amount at it", () => {
    const cliff: VestingRule = { ...monthly, cliffMonths: 12 };
    expect(vestedShares(cliff, TOTAL, "2024-06-01")).toBe(0n);
    expect(vestedShares(cliff, TOTAL, "2024-12-01")).toBe(0n);
    expect(vestedShares(cliff, TOTAL, "2025-01-01")).toBe(250_000n);
    expect(vestedShares(cliff, TOTAL, "2025-02-01")).toBe(270_833n);
  });

  it("supports quarterly periods", () => {
    const quarterly: VestingRule = { ...monthly, frequencyMonths: 3 };
    expect(vestedShares(quarterly, TOTAL, "2024-04-01")).toBe(62_500n);
    expect(vestedShares(quarterly, TOTAL, "2025-01-01")).toBe(250_000n);
    expect(vestedShares(quarterly, TOTAL, "2026-01-01")).toBe(500_000n);
    expect(vestedShares(quarterly, TOTAL, "2028-01-01")).toBe(TOTAL);
  });

  it("vests everything at the start when there is no vesting period", () => {
    const immediate: VestingRule = { ...monthly, totalMonths: 0 };
    expect(vestedShares(immediate, TOTAL, "2023-12-31")).toBe(0n);
    expect(vestedShares(immediate, TOTAL, "2024-01-01")).toBe(TOTAL);
  });

  it("clamps calendar months to the end of a shorter month", () => {
    const clamped: VestingRule = {
      startDate: "2023-01-31",
      totalMonths: 12,
      cliffMonths: 0,
      frequencyMonths: 1,
    };
    expect(vestedShares(clamped, 1_200n, "2023-02-27")).toBe(0n);
    expect(vestedShares(clamped, 1_200n, "2023-02-28")).toBe(100n);
    const leap: VestingRule = { ...clamped, startDate: "2024-01-31" };
    expect(vestedShares(leap, 1_200n, "2024-02-28")).toBe(0n);
    expect(vestedShares(leap, 1_200n, "2024-02-29")).toBe(100n);
  });

  it("uses elapsed months and vests the final remainder at total months", () => {
    const rule: VestingRule = { ...monthly, totalMonths: 10, frequencyMonths: 3 };
    expect(vestedShares(rule, 1_000n, "2024-04-01")).toBe(300n);
    expect(vestedShares(rule, 1_000n, "2024-07-01")).toBe(600n);
    expect(vestedShares(rule, 1_000n, "2024-10-01")).toBe(900n);
    expect(vestedShares(rule, 1_000n, "2024-11-01")).toBe(1_000n);
    const events = vestingEvents(rule, 1_000n);
    expect(events.map((event) => event.cumulative)).toEqual([300n, 600n, 900n, 1_000n]);
  });
});

describe("vestedShares, custom tranches", () => {
  it("vests each tranche at its month offset, cumulatively", () => {
    const rule: VestingRule = {
      startDate: "2024-01-01",
      totalMonths: 24,
      cliffMonths: 0,
      frequencyMonths: 1,
      tranches: [
        { monthOffset: 0, percent: 250_000_000_000n },
        { monthOffset: 12, percent: 250_000_000_000n },
        { monthOffset: 24, percent: 600_000_000_000n },
      ],
    };
    expect(vestedShares(rule, 1_000n, "2023-12-31")).toBe(0n);
    expect(vestedShares(rule, 1_000n, "2024-01-01")).toBe(250n);
    expect(vestedShares(rule, 1_000n, "2025-01-01")).toBe(500n);
    expect(vestedShares(rule, 1_000n, "2026-01-01")).toBe(1_000n);
  });

  it("gives the last tranche the rounding remainder", () => {
    const rule: VestingRule = {
      startDate: "2024-01-01",
      totalMonths: 24,
      cliffMonths: 0,
      frequencyMonths: 1,
      tranches: [
        { monthOffset: 0, percent: 333_333_333_333n },
        { monthOffset: 12, percent: 333_333_333_333n },
        { monthOffset: 24, percent: 333_333_333_334n },
      ],
    };
    expect(vestedShares(rule, 1_000n, "2024-01-01")).toBe(333n);
    expect(vestedShares(rule, 1_000n, "2025-01-01")).toBe(666n);
    expect(vestedShares(rule, 1_000n, "2026-01-01")).toBe(1_000n);
  });
});

describe("vestedShares, stopping and acceleration", () => {
  it("stops vesting on the stop date", () => {
    const rule: VestingRule = { ...monthly, stoppedOn: "2024-07-01" };
    expect(vestedShares(rule, TOTAL, "2024-06-01")).toBe(104_166n);
    expect(vestedShares(rule, TOTAL, "2025-01-01")).toBe(125_000n);
    expect(vestedShares(rule, TOTAL, "2030-01-01")).toBe(125_000n);
  });

  it("adds accelerated shares from the acceleration date and caps at the total", () => {
    const rule: VestingRule = {
      ...monthly,
      cliffMonths: 12,
      acceleratedShares: 100_000n,
      acceleratedOn: "2024-12-01",
    };
    expect(vestedShares(rule, TOTAL, "2024-11-01")).toBe(0n);
    expect(vestedShares(rule, TOTAL, "2024-12-01")).toBe(100_000n);
    expect(vestedShares(rule, TOTAL, "2025-01-01")).toBe(350_000n);
    expect(vestedShares({ ...rule, acceleratedShares: 5_000_000n }, TOTAL, "2025-01-01")).toBe(
      TOTAL,
    );
  });

  it("ignores an acceleration that would happen after vesting stopped", () => {
    const rule: VestingRule = {
      ...monthly,
      stoppedOn: "2024-06-01",
      acceleratedShares: 100_000n,
      acceleratedOn: "2025-01-01",
    };
    expect(vestedShares(rule, TOTAL, "2026-01-01")).toBe(104_166n);
  });

  it("returns nothing for a zero or negative total", () => {
    expect(vestedShares(monthly, 0n, "2030-01-01")).toBe(0n);
    expect(vestedShares(monthly, -5n, "2030-01-01")).toBe(0n);
  });
});

describe("vestingEvents", () => {
  it("lists every monthly event and sums exactly to the total", () => {
    const events = vestingEvents(monthly, TOTAL);
    expect(events).toHaveLength(48);
    expect(events[0]).toEqual({ date: "2024-02-01", shares: 20_833n, cumulative: 20_833n });
    expect(events[11]).toEqual({ date: "2025-01-01", shares: 20_834n, cumulative: 250_000n });
    expect(events[47]).toEqual({ date: "2028-01-01", shares: 20_834n, cumulative: TOTAL });
    expect(events.reduce((sum, event) => sum + event.shares, 0n)).toBe(TOTAL);
  });

  it("has nothing before the cliff and the cumulative amount at it", () => {
    const events = vestingEvents({ ...monthly, cliffMonths: 12 }, TOTAL);
    expect(events).toHaveLength(37);
    expect(events[0]).toEqual({ date: "2025-01-01", shares: 250_000n, cumulative: 250_000n });
    expect(events.at(-1)?.cumulative).toBe(TOTAL);
  });

  it("has one event per quarter", () => {
    const events = vestingEvents({ ...monthly, frequencyMonths: 3 }, TOTAL);
    expect(events).toHaveLength(16);
    expect(events[0]?.cumulative).toBe(62_500n);
    expect(events.at(-1)?.date).toBe("2028-01-01");
  });

  it("uses elapsed months and vests a non-divisible final period", () => {
    const rule: VestingRule = {
      ...monthly,
      totalMonths: 10,
      cliffMonths: 0,
      frequencyMonths: 3,
    };
    const events = vestingEvents(rule, 1_000n);
    expect(events.map(({ date, cumulative }) => [date, cumulative])).toEqual([
      ["2024-04-01", 300n],
      ["2024-07-01", 600n],
      ["2024-10-01", 900n],
      ["2024-11-01", 1_000n],
    ]);
    expect(events.map(({ date }) => vestedShares(rule, 1_000n, date))).toEqual([
      300n,
      600n,
      900n,
      1_000n,
    ]);
  });

  it("honors an off-frequency cliff before quarterly milestones", () => {
    const rule: VestingRule = {
      ...monthly,
      totalMonths: 10,
      cliffMonths: 4,
      frequencyMonths: 3,
    };
    const events = vestingEvents(rule, 1_000n);
    expect(events.map(({ date, cumulative }) => [date, cumulative])).toEqual([
      ["2024-05-01", 400n],
      ["2024-07-01", 600n],
      ["2024-10-01", 900n],
      ["2024-11-01", 1_000n],
    ]);
    expect(events.map(({ date }) => vestedShares(rule, 1_000n, date))).toEqual([
      400n,
      600n,
      900n,
      1_000n,
    ]);
  });

  it("includes acceleration in the dated timeline without duplicating later shares", () => {
    const rule: VestingRule = {
      startDate: "2024-01-01",
      totalMonths: 4,
      cliffMonths: 0,
      frequencyMonths: 2,
      acceleratedShares: 300n,
      acceleratedOn: "2024-02-01",
    };
    const events = vestingEvents(rule, 1_000n);
    expect(events).toEqual([
      { date: "2024-02-01", shares: 300n, cumulative: 300n },
      { date: "2024-03-01", shares: 500n, cumulative: 800n },
      { date: "2024-05-01", shares: 200n, cumulative: 1_000n },
    ]);
    expect(events.reduce((sum, event) => sum + event.shares, 0n)).toBe(1_000n);
    expect(events.map(({ date }) => vestedShares(rule, 1_000n, date))).toEqual([
      300n,
      800n,
      1_000n,
    ]);
  });

  it("includes the stop date and acceleration on that date", () => {
    const rule: VestingRule = {
      startDate: "2024-01-01",
      totalMonths: 4,
      cliffMonths: 0,
      frequencyMonths: 2,
      acceleratedShares: 300n,
      acceleratedOn: "2024-02-01",
      stoppedOn: "2024-02-01",
    };
    expect(vestingEvents(rule, 1_000n)).toEqual([
      { date: "2024-02-01", shares: 300n, cumulative: 300n },
    ]);
    expect(vestedShares(rule, 1_000n, "2024-02-01")).toBe(300n);
    expect(vestedShares(rule, 1_000n, "2024-06-01")).toBe(300n);
  });

  it("vests everything at once when the period is zero", () => {
    expect(vestingEvents({ ...monthly, totalMonths: 0 }, TOTAL)).toEqual([
      { date: "2024-01-01", shares: TOTAL, cumulative: TOTAL },
    ]);
  });

  it("lists custom tranches", () => {
    const events = vestingEvents(
      {
        startDate: "2024-01-01",
        totalMonths: 12,
        cliffMonths: 0,
        frequencyMonths: 1,
        tranches: [
          { monthOffset: 12, percent: 500_000_000_000n },
          { monthOffset: 0, percent: 500_000_000_000n },
        ],
      },
      1_000n,
    );
    expect(events).toEqual([
      { date: "2024-01-01", shares: 500n, cumulative: 500n },
      { date: "2025-01-01", shares: 500n, cumulative: 1_000n },
    ]);
  });

  it("drops events after vesting stopped", () => {
    const events = vestingEvents({ ...monthly, stoppedOn: "2024-07-01" }, TOTAL);
    expect(events).toHaveLength(6);
    expect(events.at(-1)?.date).toBe("2024-07-01");
  });

  it("returns nothing for a zero total", () => {
    expect(vestingEvents(monthly, 0n)).toEqual([]);
  });
});

describe("describeVesting", () => {
  it("describes the even rule and its cliff", () => {
    expect(describeVesting({ ...monthly, cliffMonths: 12 })).toBe("1/48 monthly, 1 year cliff");
    expect(describeVesting({ ...monthly, frequencyMonths: 3 })).toBe("1/16 quarterly");
    expect(describeVesting({ ...monthly, frequencyMonths: 6 })).toBe("1/8 semi-annually");
    expect(describeVesting({ ...monthly, frequencyMonths: 2 })).toBe("1/24 every 2 months");
    expect(describeVesting({ ...monthly, frequencyMonths: 12, cliffMonths: 18 })).toBe(
      "1/4 annually, 18 month cliff",
    );
    expect(describeVesting({ ...monthly, cliffMonths: 6 })).toBe("1/48 monthly, 6 month cliff");
  });

  it("describes custom tranches and immediate vesting", () => {
    expect(
      describeVesting({
        ...monthly,
        tranches: [
          { monthOffset: 0, percent: 250_000_000_000n },
          { monthOffset: 12, percent: 250_000_000_000n },
          { monthOffset: 24, percent: 250_000_000_000n },
          { monthOffset: 36, percent: 250_000_000_000n },
        ],
      }),
    ).toBe("Custom (4 tranches)");
    expect(describeVesting({ ...monthly, totalMonths: 0 })).toBe("Immediate");
  });

  it("does not describe a partial final period as an equal quarterly tranche", () => {
    expect(
      describeVesting({
        ...monthly,
        totalMonths: 10,
        cliffMonths: 4,
        frequencyMonths: 3,
      }),
    ).toBe("quarterly, final 1 month, 4 month cliff");
  });
});
