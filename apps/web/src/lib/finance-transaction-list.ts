import type { FinanceTransaction } from "@rakazo/contracts";
import { txnDay } from "./finance-format";
import type { VendorGroup } from "./finance-group";
import type { Sort } from "./list-params";
import { sortBy } from "./list-params";

export const TRANSACTION_SORTS = ["date", "counterparty", "category", "amount"] as const;
export type TransactionSort = (typeof TRANSACTION_SORTS)[number];
/** The server lists newest first; that stays the default. */
export const DEFAULT_TRANSACTION_SORT = { field: "date", dir: "desc" } as const;

export type TransactionFilters = { q?: string; category?: string; status?: string };
type Label = (row: Pick<FinanceTransaction, "category" | "classification">) => string;

/** Rows whose counterparty, memo or category label contain the search text and that match every set filter. `label` is the category as shown. */
export function filterTransactions(
  rows: FinanceTransaction[],
  { q, category, status }: TransactionFilters,
  label: Label,
): FinanceTransaction[] {
  const needle = q?.trim().toLowerCase();
  return rows.filter(
    (row) =>
      (!needle ||
        [row.counterparty, row.memo ?? "", label(row)].some((text) =>
          text.toLowerCase().includes(needle),
        )) &&
      (!category || label(row) === category) &&
      (!status || row.status === status),
  );
}

export function sortTransactions(
  rows: FinanceTransaction[],
  { field, dir }: Sort<TransactionSort>,
  label: Label,
): FinanceTransaction[] {
  return sortBy(
    rows,
    (row) =>
      field === "date"
        ? txnDay(row)
        : field === "counterparty"
          ? row.counterparty.trim()
          : field === "category"
            ? label(row)
            : row.amountCents,
    dir,
  );
}

/** Groups sort by their total, name or category. Date has no single value for a group, so it keeps the order they came in (largest total first). */
export function sortTransactionGroups(
  groups: VendorGroup[],
  { field, dir }: Sort<TransactionSort>,
  label: Label,
): VendorGroup[] {
  if (field === "date") return groups;
  return sortBy(
    groups,
    (g) =>
      field === "amount"
        ? Number(g.totalCents)
        : field === "counterparty"
          ? g.name
          : g.mixed
            ? null
            : label(g.rows[0] as FinanceTransaction),
    dir,
  );
}
