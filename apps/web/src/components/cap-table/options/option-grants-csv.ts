import type { EquityOptionGrant } from "@rakazo/contracts";

/** The columns the export writes, in order. */
export const OPTION_GRANTS_CSV_HEADER = [
  "Security",
  "Optionholder",
  "Status",
  "Original quantity",
  "Exercise price",
  "Type",
  "Grant date",
  "Vesting schedule",
] as const;

/** A cell as RFC 4180 wants it: quoted when it holds a comma, a quote or a line break, quotes doubled. */
export function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

const text = (value: string | null | undefined) => value ?? "";

/**
 * The current page of grants as a CSV document with a header row and CRLF line endings.
 * Pure: the toolbar hands the result to a download.
 */
export function optionGrantsCsv(grants: readonly EquityOptionGrant[]): string {
  const rows = grants.map((grant) =>
    [
      grant.label,
      grant.stakeholderName,
      grant.status,
      grant.quantity,
      String(Number(grant.exercisePrice)),
      grant.optionType.toUpperCase(),
      grant.grantDate.slice(0, 10),
      text(grant.vestingSchedule?.description),
    ]
      .map(csvCell)
      .join(","),
  );
  return [OPTION_GRANTS_CSV_HEADER.join(","), ...rows].join("\r\n");
}
