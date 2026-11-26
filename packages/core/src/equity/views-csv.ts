// CSV for the cap table views and reports: RFC 4180 quoting, CRLF line ends, and cells that a
// spreadsheet would run as a formula are prefixed with a single quote.

export type CsvColumn = { key: string; label: string };
export type CsvCell = string | bigint | number | null | undefined;

const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;
const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (FORMULA_START.test(text) && !PLAIN_NUMBER.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** The rows as CSV under a header row of the column labels, in column order. */
export function toCsv(
  columns: readonly CsvColumn[],
  rows: readonly Record<string, CsvCell>[],
): string {
  const lines = [columns.map((column) => cell(column.label))];
  for (const row of rows) lines.push(columns.map((column) => cell(row[column.key])));
  return `${lines.map((line) => line.join(",")).join("\r\n")}\r\n`;
}
