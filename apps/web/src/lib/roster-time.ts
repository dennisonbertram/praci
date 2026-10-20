import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** A roster row's time: the time today, Yesterday, the weekday within 6 calendar days, else the date. */
export function formatRosterTime(isoDate?: string | null): string {
  if (!isoDate) return "";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";
  const locale = i18n.locale || "en";
  // Whole calendar days, so the cutoff does not move with the time of day.
  const days = Math.round((startOfDay(new Date()).getTime() - startOfDay(date).getTime()) / 864e5);
  if (days === 0) return date.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
  if (days === 1) return t`Yesterday`;
  if (days > 1 && days < 7) return date.toLocaleDateString(locale, { weekday: "short" });
  return date.toLocaleDateString(locale, { month: "short", day: "numeric" });
}
