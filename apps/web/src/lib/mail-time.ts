import { i18n } from "@lingui/core";

/**
 * When a mail arrived, as every mail list shows it: the time of day for today's mail, the month and
 * day otherwise, and the year for another year.
 */
export function formatMailTime(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const locale = i18n.locale || "en";
  return date.toDateString() === now.toDateString()
    ? date.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString(locale, {
        month: "short",
        day: "numeric",
        ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
      });
}
