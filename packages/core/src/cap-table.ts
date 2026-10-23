import type { SafeStatus } from "@rakazo/contracts";
import { countedSafes } from "./safes.js";

/** A cap table holder as the math sees it. */
export type CapTableMathHolder = {
  security: string;
  shares: number | null;
  amountUsd: number | null;
};

export type CapTableMathInput<H extends CapTableMathHolder> = {
  fullyDilutedShares: number;
  optionPoolAvailable: number | null;
  holders: readonly H[];
};

/** A snapshot SAFE has money and no place in the share count. */
export const isSafeSecurity = (security: string) => /safe/i.test(security);

/**
 * Fully diluted math, shared by every source and page. The holdings are the holders with a known
 * share count (SAFEs excluded) plus the unallocated pool; they are 100%. A percent is null when
 * the holder is outside the holdings, or for every row when the rows do not add up to the source's
 * own fully diluted total, so the column never shows numbers that do not reconcile.
 * Rounded to one decimal, largest remainder, so the column sums to exactly 100.0.
 */
export function capTableMath<H extends CapTableMathHolder>(input: CapTableMathInput<H>) {
  const pool =
    input.optionPoolAvailable && input.optionPoolAvailable > 0 ? input.optionPoolAvailable : 0;
  const counted = input.holders.map((h) => h.shares != null && !isSafeSecurity(h.security));
  const totalShares =
    input.holders.reduce((sum, h, i) => sum + (counted[i] ? (h.shares as number) : 0), 0) + pool;
  const reconciles = totalShares > 0 && totalShares === input.fullyDilutedShares;

  const shares = [
    ...input.holders.map((h, i) => (counted[i] ? (h.shares as number) : null)),
    pool || null,
  ];
  const tenths = shares.map((s) => (reconciles && s != null ? (s * 1000) / totalShares : null));
  const floors: (number | null)[] = tenths.map((t) => (t == null ? null : Math.floor(t)));
  let left = reconciles ? 1000 - floors.reduce<number>((sum, f) => sum + (f ?? 0), 0) : 0;
  const byRemainder = tenths
    .map((t, i) => ({ i, rest: t == null ? -1 : t - (floors[i] as number) }))
    .sort((a, b) => b.rest - a.rest || a.i - b.i);
  for (const { i, rest } of byRemainder) {
    if (left <= 0 || rest < 0) break;
    floors[i] = (floors[i] ?? 0) + 1;
    left--;
  }
  const percents = floors.map((f) => (f == null ? null : f / 10));

  // The bar and legend: one entry per security, largest first, from the same rounded rows.
  const classes = new Map<string, { name: string; shares: number; tenths: number }>();
  input.holders.forEach((h, i) => {
    if (!counted[i] || percents[i] == null) return;
    const entry = classes.get(h.security) ?? { name: h.security, shares: 0, tenths: 0 };
    entry.shares += h.shares as number;
    entry.tenths += Math.round((percents[i] as number) * 10);
    classes.set(h.security, entry);
  });

  return {
    classes: [...classes.values()]
      .sort((a, b) => b.shares - a.shares)
      .map(({ name, shares, tenths }) => ({ name, shares, percent: tenths / 10 })),
    holders: input.holders.map((holder, i) => ({ holder, percent: percents[i] ?? null })),
    pool: pool ? { shares: pool, percent: percents[input.holders.length] ?? null } : null,
    totalShares,
    reconciles,
    /** Equity raised: the Invested column; SAFE money is never in it. */
    raisedUsd: investedUsd(input.holders),
  };
}

const investedUsd = (holders: readonly CapTableMathHolder[]) =>
  holders.reduce((sum, h) => sum + (isSafeSecurity(h.security) ? 0 : (h.amountUsd ?? 0)), 0);

/**
 * Equity raised, the one figure the Investors page and the agents' cap_table_read both show: the
 * table's invested money plus Funded SAFEs. Sent and Signed SAFEs are promises, not raised money.
 * Null when nothing is known to add up (no counted SAFE and no invested amount).
 * The source's own company total is never used, so Investors, Fundraising and Finance agree.
 */
export const equityRaisedUsd = (
  holders: readonly CapTableMathHolder[],
  safes: readonly { status: SafeStatus; amountCents: number }[],
) => {
  const counted = countedSafes(safes);
  const hasHolderAmount = holders.some((h) => h.amountUsd != null && !isSafeSecurity(h.security));
  if (!counted.length && !hasHolderAmount) return null;
  return (
    investedUsd(holders) +
    counted.filter((s) => s.status === "funded").reduce((sum, s) => sum + s.amountCents / 100, 0)
  );
};
