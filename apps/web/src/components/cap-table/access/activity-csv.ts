import type { EquityTransaction } from "@rakazo/contracts";

const HEADER = [
  "recorded",
  "effective_date",
  "kind",
  "security",
  "quantity",
  "value_cents",
  "actor",
  "note",
  "before",
  "after",
] as const;

/** One CSV cell: RFC 4180 quoting, and a leading quote so a spreadsheet never runs a formula. */
export function csvCell(value: string | null | undefined): string {
  let text = value ?? "";
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const json = (value: unknown) => (value == null ? "" : JSON.stringify(value));

/** The activity log as CSV, one row per ledger change. */
export function activityCsv(rows: readonly EquityTransaction[]): string {
  const lines = [HEADER.join(",")];
  for (const row of rows)
    lines.push(
      [
        row.createdAt,
        row.effectiveDate,
        row.kind,
        row.securityLabel,
        row.quantity,
        row.valueCents,
        row.actorName,
        row.note,
        json(row.before),
        json(row.after),
      ]
        .map(csvCell)
        .join(","),
    );
  return `${lines.join("\r\n")}\r\n`;
}
