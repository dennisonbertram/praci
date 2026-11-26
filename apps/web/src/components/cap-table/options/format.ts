import { i18n } from "@lingui/core";

const locale = () => i18n.locale || "en";

/** Whole shares with thousands separators, from an integer string. */
export const formatShares = (value: string) =>
  new Intl.NumberFormat(locale()).format(BigInt(value));

/** A decimal price as dollars, localized without rounding its decimal string. */
export const formatPrice = (value: string, hidden = false) => {
  if (hidden) return "$•••";
  const [whole = "0", fraction = ""] = value.split(".");
  const shown = fraction.replace(/0+$/, "").padEnd(2, "0");
  const currentLocale = locale();
  const currency = new Intl.NumberFormat(currentLocale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const digits = new Intl.NumberFormat(currentLocale, { useGrouping: false });
  const isNegative = whole.startsWith("-");
  const integer = BigInt(whole);
  const negativeZero = isNegative && integer === 0n;
  const localizedFraction = [...shown].map((digit) => digits.format(Number(digit))).join("");
  return currency
    .formatToParts(negativeZero ? -0 : integer)
    .map((part) => (part.type === "fraction" ? localizedFraction : part.value))
    .join("");
};

/** "Mar 4, 2025" from YYYY-MM-DD, without a time zone shift. */
export const formatDay = (value: string) =>
  new Date(`${value.slice(0, 10)}T00:00:00Z`).toLocaleDateString(locale(), {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
