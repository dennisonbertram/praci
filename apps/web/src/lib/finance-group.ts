import type { FinanceTransaction } from "@rakazo/contracts";

export type VendorGroup = {
  key: string;
  /** The most frequent counterparty spelling in the group (the first seen on a tie). */
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

/** One group per `vendorKey` (or, when a row has none, the trimmed lowercase counterparty) and currency, so a vendor paid in two currencies gets two rows. Largest total first by magnitude. Keeps row order inside a group. */
export function groupByVendor(rows: readonly FinanceTransaction[]): VendorGroup[] {
  const groups = new Map<string, VendorGroup>();
  const spellings = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const vendorKey = row.vendorKey?.trim();
    const key = `${row.currency}|${vendorKey ? `k:${vendorKey}` : `n:${row.counterparty.trim().toLowerCase()}`}`;
    const names = spellings.get(key) ?? new Map<string, number>();
    const spelling = row.counterparty.trim();
    names.set(spelling, (names.get(spelling) ?? 0) + 1);
    spellings.set(key, names);
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
  for (const group of groups.values()) {
    let best = 0;
    for (const [spelling, count] of spellings.get(group.key) ?? []) {
      if (count > best) {
        best = count;
        group.name = spelling;
      }
    }
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
