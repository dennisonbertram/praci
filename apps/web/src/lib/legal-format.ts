/**
 * A contract value from its decimal-string minor units ("1234567" is 12,345.67), shown with the
 * currency symbol. The string is split with BigInt and handed to Intl as a decimal string, so a
 * value past 2^53 is never turned into a JS number.
 */
export function contractValue(
  valueCents: string,
  currency: string | null,
  locale?: string,
): string {
  const negative = valueCents.startsWith("-");
  const digits = BigInt(valueCents.replace("-", ""));
  const whole = digits / 100n;
  const cents = digits % 100n;
  const decimal = `${negative ? "-" : ""}${whole}.${String(cents).padStart(2, "0")}`;
  const fraction = cents === 0n ? 0 : 2;
  const options = { minimumFractionDigits: fraction, maximumFractionDigits: 2 };
  try {
    return new Intl.NumberFormat(locale, {
      ...options,
      ...(currency ? { style: "currency", currency } : {}),
    }).format(decimal as unknown as number);
  } catch {
    // An unknown currency code: show the number and the code as written.
    return `${new Intl.NumberFormat(locale, options).format(decimal as unknown as number)}${currency ? ` ${currency}` : ""}`;
  }
}

/** Today's calendar date in the viewer's time zone, as YYYY-MM-DD. */
export function todayIso(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Whole days from `from` to `to` (both YYYY-MM-DD); negative when `to` is earlier. No time zone is involved. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}
