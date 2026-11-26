const escapeRegex = (char: string) => char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function separators(locale: string): { group: string; decimal: string } {
  const parts = new Intl.NumberFormat(locale).formatToParts(1234567.5);
  return {
    group: parts.find((part) => part.type === "group")?.value ?? ",",
    decimal: parts.find((part) => part.type === "decimal")?.value ?? ".",
  };
}

/**
 * "1,250,000.50" dollars as "125000050" cents, without passing through a float; null if invalid.
 * The thousands and decimal separators come from `locale` (the browser's by default), so "1,25" is
 * 1.25 in de-DE and "1.250,00" is 1250. Input that uses the separators the wrong way round, such
 * as "1,250" where a comma is the decimal mark, is rejected instead of guessed.
 */
export function dollarsToCents(
  input: string,
  locale = typeof navigator === "undefined" ? "en-US" : navigator.language,
): string | null {
  const { group, decimal } = separators(locale);
  const text = input.replace(/\s/g, "").replace(/^\$/, "");
  const g = escapeRegex(group);
  const match = new RegExp(
    `^(\\d{1,3}(?:${g}\\d{3})+|\\d+)(?:${escapeRegex(decimal)}(\\d{0,2}))?$`,
  ).exec(text);
  if (!match) return null;
  return (
    BigInt(match[1]!.replaceAll(group, "")) * 100n +
    BigInt((match[2] ?? "").padEnd(2, "0") || "0")
  ).toString();
}

/**
 * Cents as a dollars string for an input box, e.g. "125000050" -> "1250000.50" (no thousands
 * separators). It uses the same locale decimal mark as dollarsToCents, so a pre-filled value reads
 * back to the same cents.
 */
export function centsToDollars(
  cents: string | null | undefined,
  locale = typeof navigator === "undefined" ? "en-US" : navigator.language,
): string {
  if (cents == null || cents === "") return "";
  const value = BigInt(cents);
  const rest = (value % 100n).toString().padStart(2, "0");
  return rest === "00"
    ? (value / 100n).toString()
    : `${value / 100n}${separators(locale).decimal}${rest}`;
}
