import type { EquityPlanPool } from "@rakazo/contracts";
import { csvCell } from "./option-grants-csv";

/** The columns the export writes, in order. */
export const PLANS_CSV_HEADER = [
  "Plan name",
  "Status",
  "Reserved",
  "Granted",
  "Outstanding",
  "Exercised",
  "Returned",
  "Issued",
  "Available",
] as const;

/**
 * The pools as a CSV document with a header row and CRLF line endings.
 * Quantities stay integer strings; the table does the formatting.
 */
export function plansCsv(pools: readonly EquityPlanPool[]): string {
  const rows = pools.map((pool) =>
    [
      pool.name,
      pool.status,
      pool.reservedShares,
      pool.grantedShares,
      pool.outstandingShares,
      pool.exercisedShares,
      pool.returnedShares,
      pool.issuedShares,
      pool.availableShares,
    ]
      .map(csvCell)
      .join(","),
  );
  return [PLANS_CSV_HEADER.join(","), ...rows].join("\r\n");
}
