import type { EquityOverview } from "@rakazo/contracts";

/**
 * Fully diluted, split into parts that add up to the total: issued shares per class, options
 * granted and still outstanding, the pool left to grant, and anything else counted (warrants and
 * the like). The overview and the cap table report both read this, so they always agree.
 */
export function fullyDilutedParts(overview: EquityOverview) {
  const total = BigInt(overview.totals.fullyDilutedShares);
  const classes = overview.classes.map((row) => ({
    id: row.shareClassId,
    name: row.name,
    classType: row.classType,
    shares: BigInt(row.outstandingShares),
  }));
  const options = overview.plans.reduce((sum, plan) => sum + BigInt(plan.outstandingShares), 0n);
  const pool = BigInt(overview.totals.availablePlanShares);
  const counted = classes.reduce((sum, row) => sum + row.shares, 0n) + options + pool;
  const other = total > counted ? total - counted : 0n;
  return { total, classes, options, pool, other };
}
