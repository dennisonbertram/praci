import { describe, expect, it } from "vitest";
import { vestingRuleOf } from "./options-vesting.js";
import { vestedShares, vestingEvents } from "./vesting.js";

describe("vestingRuleOf", () => {
  it("turns a wire schedule into the rule the vesting math uses", () => {
    const rule = vestingRuleOf({
      startDate: "2024-01-01",
      totalMonths: 48,
      cliffMonths: 12,
      frequencyMonths: 1,
      tranches: null,
      acceleratedShares: null,
    });
    expect(vestedShares(rule, 48_000n, "2025-07-01")).toBe(18_000n);
    expect(vestingEvents(rule, 48_000n)).toHaveLength(37);
  });

  it("parses custom tranche percents without floats", () => {
    const rule = vestingRuleOf({
      startDate: "2024-01-01",
      totalMonths: 24,
      cliffMonths: 0,
      frequencyMonths: 1,
      tranches: [
        { monthOffset: 12, percent: "33.33" },
        { monthOffset: 24, percent: "66.67" },
      ],
      acceleratedShares: "100",
      acceleratedOn: "2024-02-01",
    });
    expect(rule.acceleratedShares).toBe(100n);
    expect(
      vestingEvents(rule, 10_000n)
        .map((event) => event.cumulative)
        .at(-1),
    ).toBe(10_000n);
  });
});
