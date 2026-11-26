import type { EquityOverview } from "@rakazo/contracts";
import { expect, it } from "vitest";
import { fullyDilutedParts, ownershipLegend, percentsTo100, percentText } from "./fully-diluted";

const overview = {
  totals: { fullyDilutedShares: "12000000", availablePlanShares: "900000" },
  classes: [
    { shareClassId: "common", name: "Common", classType: "common", outstandingShares: "7000000" },
    { shareClassId: "seed", name: "Seed", classType: "preferred", outstandingShares: "3100000" },
  ],
  plans: [{ outstandingShares: "1000000" }],
} as unknown as EquityOverview;

it("splits fully diluted into parts that add up to the total", () => {
  const parts = fullyDilutedParts(overview);
  expect(parts.options).toBe(1_000_000n);
  expect(parts.pool).toBe(900_000n);
  expect(parts.other).toBe(0n);
  const sum = parts.classes.reduce((s, row) => s + row.shares, 0n) + parts.options + parts.pool;
  expect(sum).toBe(parts.total);
});

it("formats percents and makes legend percents add to 100", () => {
  expect(percentText(7_000_000n, 12_000_000n)).toBe("58.3333");
  const legend = percentsTo100([7_000_000n, 3_100_000n, 1_000_000n, 900_000n], 12_000_000n);
  expect(legend).toEqual([58.4, 25.8, 8.3, 7.5]);
  expect(legend.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 10);
});

it("builds a legend that adds to 100 and matches the table's parts", () => {
  const legend = ownershipLegend(fullyDilutedParts(overview), {
    common: "Common",
    preferred: "Preferred",
    options: "Options granted",
    other: "Other",
  });
  expect(legend.classes.map((row) => row.name)).toEqual(["Common", "Preferred", "Options granted"]);
  const total = legend.classes.reduce((sum, row) => sum + row.percent, 0) + legend.pool;
  expect(total).toBeCloseTo(100, 10);
  expect(legend.classes[0]!.percent).toBe(58.4);
});
