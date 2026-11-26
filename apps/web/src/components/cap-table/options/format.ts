import { i18n } from "@lingui/core";

const locale = () => i18n.locale || "en";

/** Whole shares with thousands separators, from an integer string. */
export const formatShares = (value: string) =>
  new Intl.NumberFormat(locale()).format(BigInt(value));

/** A price per share in dollars with two decimals, from a decimal string (display only). */
export const formatPrice = (value: string) =>
  new Intl.NumberFormat(locale(), {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));

/** "Mar 4, 2025" from YYYY-MM-DD, without a time zone shift. */
export const formatDay = (value: string) =>
  new Date(`${value.slice(0, 10)}T00:00:00Z`).toLocaleDateString(locale(), {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
