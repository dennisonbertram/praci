import type { FinanceTransaction } from "@rakazo/contracts";

export type VendorGroup = {
  key: string;
  /** The first counterparty spelling seen for this key. */
  name: string;
  rows: FinanceTransaction[];
  currency: string;
  /** Signed sum in cents (negative is money out), exact beyond Number.MAX_SAFE_INTEGER. */
  totalCents: bigint;
  /** The first row's category; only meaningful when `mixed` is false. */
  category: string | null;
  /** True when the rows do not share one category. */
  mixed: boolean;
};

/** One group per counterparty (trimmed, case-insensitive) and currency, so a vendor paid in two currencies gets two rows. Largest total first by magnitude. Keeps row order inside a group. */
export function groupByVendor(rows: readonly FinanceTransaction[]): VendorGroup[] {
  const groups = new Map<string, VendorGroup>();
  for (const row of rows) {
    const key = `${row.currency}|${row.counterparty.trim().toLowerCase()}`;
    const group = groups.get(key);
    if (!group) {
      groups.set(key, {
        key,
        name: row.counterparty.trim(),
        rows: [row],
        currency: row.currency,
        totalCents: BigInt(row.amountCents),
        category: row.category,
        mixed: false,
      });
      continue;
    }
    group.rows.push(row);
    group.totalCents += BigInt(row.amountCents);
    if (group.category !== row.category) group.mixed = true;
  }
  const abs = (n: bigint) => (n < 0n ? -n : n);
  return [...groups.values()].sort((a, b) => {
    const diff = abs(b.totalCents) - abs(a.totalCents);
    return diff > 0n ? 1 : diff < 0n ? -1 : a.name.localeCompare(b.name);
  });
}

const STORAGE_KEY = "rakazo:finance-transactions-grouped";

export function readGroupedPref(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeGroupedPref(grouped: boolean): void {
  try {
    if (grouped) window.localStorage.setItem(STORAGE_KEY, "1");
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private mode or quota: the choice still applies for this visit.
  }
}
