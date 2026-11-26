import { i18n } from "@lingui/core";
import { percentFigure } from "../../../lib/finance-format";

const locale = () => i18n.locale || "en";

/** Share counts arrive as integer strings: BigInt keeps the digits, the formatter adds separators. */
export const formatShares = (value: string) =>
  new Intl.NumberFormat(locale()).format(BigInt(value));

/** Cents as whole dollars, through BigInt so no sum passes through a float. */
export const formatDollars = (value: string) =>
  `$${new Intl.NumberFormat(locale()).format(BigInt(value) / 100n)}`;

export const formatPercent = (value: string) => percentFigure(Number(value), 2);

/**
 * A decimal price with two to four places, rounded half up, e.g. "8.5" -> "$8.50",
 * "0.0001" -> "$0.0001", "2.070007659" -> "$2.07". Integer arithmetic only.
 */
export const formatPrice = (value: string) => {
  const [whole, fraction = ""] = value.split(".");
  const digits = fraction.padEnd(5, "0");
  let units = BigInt(whole || "0") * 10_000n + BigInt(digits.slice(0, 4));
  if (Number(digits[4]) >= 5) units += 1n;
  const kept = (units % 10_000n).toString().padStart(4, "0").replace(/0+$/, "").padEnd(2, "0");
  return `$${new Intl.NumberFormat(locale()).format(units / 10_000n)}.${kept}`;
};
