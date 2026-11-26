// The ISO $100,000 limit: in each calendar year a holder's ISOs may first become exercisable on
// at most $100,000 of stock value (shares times exercise price, the grant-date fair market value
// stand-in). Anything above that is treated as an NSO. Pure math on the wire shapes.

import { parseFixed, parseShares, sharesTimesPrice } from "./fixed.js";
import type { WireVestingSchedule } from "./options-vesting.js";
import { vestingRuleOf } from "./options-vesting.js";
import { vestingEvents } from "./vesting.js";

/** The annual ISO limit in cents: $100,000. */
export const ISO_100K_LIMIT_CENTS = 10_000_000n;

/** The fields of an option grant the ISO limit needs. */
export type Iso100kGrant = {
  stakeholderId: string;
  stakeholderName: string;
  optionType: "iso" | "nso";
  quantity: string;
  exercisePrice: string;
  grantDate: string;
  earlyExercise: boolean;
  status: string;
  vestingSchedule: WireVestingSchedule | null;
};

/** One holder and calendar year: ISO value first exercisable that year and the part over $100k. */
export type Iso100kRow = {
  stakeholderId: string;
  stakeholderName: string;
  year: number;
  valueCents: bigint;
  overLimitCents: bigint;
};

/** Canceled, forfeited and expired grants never became exercisable, so they count for nothing. */
const INACTIVE_STATUSES = new Set(["canceled", "forfeited", "expired"]);

/** The date each slice of a grant first becomes exercisable. */
function exercisableEvents(grant: Iso100kGrant): { date: string; shares: bigint }[] {
  const total = parseShares(grant.quantity);
  if (total <= 0n) return [];
  // Early exercise makes the whole grant exercisable at grant. A grant with no schedule vests in
  // one piece at grant, which is the only reading of "no schedule" that lets it count at all.
  if (grant.earlyExercise || grant.vestingSchedule == null) {
    return [{ date: grant.grantDate, shares: total }];
  }
  return vestingEvents(vestingRuleOf(grant.vestingSchedule), total).map((event) => ({
    date: event.date,
    shares: event.shares,
  }));
}

/**
 * ISO value first exercisable per holder and calendar year, with the excess over $100,000 that is
 * treated as an NSO. Rows are sorted by holder name and then year; only ISO grants that are not
 * canceled, forfeited or expired count.
 */
export function iso100k(grants: Iso100kGrant[]): Iso100kRow[] {
  const totals = new Map<string, Iso100kRow>();
  for (const grant of grants) {
    if (grant.optionType !== "iso" || INACTIVE_STATUSES.has(grant.status)) continue;
    const price = parseFixed(grant.exercisePrice);
    for (const event of exercisableEvents(grant)) {
      const year = Number(event.date.slice(0, 4));
      if (!Number.isInteger(year)) continue;
      const key = `${grant.stakeholderId}\u0000${year}`;
      const row = totals.get(key) ?? {
        stakeholderId: grant.stakeholderId,
        stakeholderName: grant.stakeholderName,
        year,
        valueCents: 0n,
        overLimitCents: 0n,
      };
      row.valueCents += sharesTimesPrice(event.shares, price);
      totals.set(key, row);
    }
  }

  return [...totals.values()]
    .map((row) => ({
      ...row,
      overLimitCents:
        row.valueCents > ISO_100K_LIMIT_CENTS ? row.valueCents - ISO_100K_LIMIT_CENTS : 0n,
    }))
    .sort((a, b) => a.stakeholderName.localeCompare(b.stakeholderName) || a.year - b.year);
}
