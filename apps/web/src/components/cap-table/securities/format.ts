import { i18n } from "@lingui/core";

const locale = () => i18n.locale || "en";

/** Share counts arrive as integer strings; BigInt keeps every digit. */
export const formatShares = (value: string) =>
  new Intl.NumberFormat(locale()).format(BigInt(value));

/** Whole cents as dollars and cents, through BigInt so no amount passes through a float. */
export function formatCents(value: string | null | undefined): string {
  if (value == null) return "—";
  const cents = BigInt(value);
  const whole = new Intl.NumberFormat(locale()).format(cents / 100n);
  return `$${whole}.${(cents % 100n).toString().padStart(2, "0")}`;
}

/** A decimal price string as dollars, two places at least, more when the price has them. */
export function formatPrice(value: string | null | undefined, places?: number): string {
  if (value == null) return "—";
  const [whole = "0", fraction = ""] = value.split(".");
  if (places === undefined) {
    const kept = fraction.replace(/0+$/, "").padEnd(2, "0");
    return `$${new Intl.NumberFormat(locale()).format(BigInt(whole))}.${kept}`;
  }
  // Round half up to `places` with BigInt so a long price never passes through a float.
  const scale = 10n ** BigInt(places);
  const digits =
    BigInt(whole) * scale + BigInt((fraction + "0".repeat(places)).slice(0, places) || "0");
  const rounded = digits + (Number(fraction[places] ?? "0") >= 5 ? 1n : 0n);
  const shown = `${rounded % scale}`.padStart(places, "0");
  return `$${new Intl.NumberFormat(locale()).format(rounded / scale)}.${shown}`;
}

/**
 * Decimal places for a price column: what its most precise price needs, at least 2 and at most
 * 4, so every price in the column lines up ("$0.0001" and "$8.5000", or "$0.10" and "$8.50").
 */
export function pricePlaces(values: readonly (string | null | undefined)[]): number {
  let places = 2;
  for (const value of values) {
    const fraction = value?.split(".")[1]?.replace(/0+$/, "") ?? "";
    places = Math.max(places, Math.min(4, fraction.length));
  }
  return places;
}

/** YYYY-MM-DD as a short date, read as a calendar day (no time zone shift). */
export function formatDay(value: string | null | undefined): string {
  if (!value) return "—";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(locale(), {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year!, month! - 1, day!)));
}

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** A CSV document: a header row, then one row per item, every cell quoted when it needs it. */
export function toCsv<T>(
  rows: readonly T[],
  columns: readonly { label: string; value: (row: T) => string }[],
): string {
  const lines = [columns.map((column) => csvCell(column.label)).join(",")];
  for (const row of rows) lines.push(columns.map((column) => csvCell(column.value(row))).join(","));
  return `${lines.join("\r\n")}\r\n`;
}

/** Hands a CSV document to the browser as a download. */
export function downloadCsv(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

/** A decimal percent string as "20%" or "12.5%": trailing zeros go only after the point. */
export function formatPercent(value: string | null | undefined): string {
  if (value == null) return "—";
  const [whole, fraction = ""] = value.split(".");
  const kept = fraction.replace(/0+$/, "");
  return `${whole}${kept ? `.${kept}` : ""}%`;
}
