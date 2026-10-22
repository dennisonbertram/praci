import type { FinanceTransaction, PaidWithEntry } from "@rakazo/contracts";
import { getHideAmounts } from "./hide-amounts-preference";

/** Fixed mask: shows neither magnitude nor digit count. */
export const MASK = "•••";

const dollars = (locale?: string, currency = "USD") =>
  new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
const exact = (locale?: string, currency = "USD") =>
  new Intl.NumberFormat(locale, { style: "currency", currency });

/** Whole dollars, no sign. Money is cents in a JS number. */
export const money = (cents: number, locale?: string, currency?: string) =>
  getHideAmounts() ? `$${MASK}` : dollars(locale, currency).format(Math.abs(cents) / 100);

/** Dollars and cents, no sign. */
export const moneyExact = (cents: number, locale?: string, currency?: string) =>
  getHideAmounts() ? `$${MASK}` : exact(locale, currency).format(Math.abs(cents) / 100);

/** A transaction amount: money in gets a plus sign, money out has none (the page shows what left). */
export const transactionAmount = (cents: number, locale?: string, currency?: string) =>
  cents > 0 ? `+${moneyExact(cents, locale, currency)}` : moneyExact(cents, locale, currency);

/** A transaction amount in a list, in whole dollars like every other figure on a list page: `+$1,200`, `$88`. A single transaction's page shows the cents. */
export const listAmount = (cents: number, locale?: string, currency?: string) =>
  cents > 0 ? `+${money(cents, locale, currency)}` : money(cents, locale, currency);

/** Axis labels: `$1.5M`, `$1.5k`, `$40k`, `$800`. */
export function axisMoney(cents: number): string {
  if (getHideAmounts()) return `$${MASK}`;
  const d = Math.round(Math.abs(cents) / 100);
  const sign = cents < 0 && d > 0 ? "−" : "";
  if (d >= 999_500) return `${sign}$${+(d / 1_000_000).toFixed(1)}M`;
  return d >= 1000 ? `${sign}$${+(d / 1000).toFixed(1)}k` : `${sign}$${d}`;
}

const dayDate = (day: string) => new Date(`${day.slice(0, 10)}T00:00:00Z`);

/** `Oct 16`, with the year when it is not `now`'s year. Reads the date part of a day or ISO datetime. */
export function shortDay(day: string, now = new Date(), locale?: string): string {
  const date = dayDate(day);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    ...(date.getUTCFullYear() === now.getUTCFullYear() ? {} : { year: "numeric" }),
    timeZone: "UTC",
  });
}

/** `Oct 1 – 14` or `Sep 29 – Oct 14`; one day is `Oct 14`. The year shows when `start` is not in `now`'s year. `end` is inclusive. */
export function dayRange(start: string, end: string, now = new Date(), locale?: string): string {
  const a = dayDate(start);
  const b = dayDate(end);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    ...(a.getUTCFullYear() === now.getUTCFullYear() ? {} : { year: "numeric" }),
    timeZone: "UTC",
  }).formatRange(a, b);
}

/** `Mon`. */
export const weekdayShort = (day: string, locale?: string) =>
  dayDate(day).toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" });

/** `Oct 6`, never with a year (chart axes). */
export const dayMonth = (day: string, locale?: string) =>
  dayDate(day).toLocaleDateString(locale, { month: "short", day: "numeric", timeZone: "UTC" });

/** `Oct 16, 2026`. */
export function fullDay(day: string, locale?: string): string {
  const date = dayDate(day);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

const monthDate = (month: string) => new Date(`${month}-01T00:00:00Z`);
const monthFormat = (
  month: string,
  options: Intl.DateTimeFormatOptions,
  locale?: string,
): string => {
  const date = monthDate(month);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(locale, { ...options, timeZone: "UTC" });
};

/** `Oct` */
export const monthShort = (month: string, locale?: string) =>
  monthFormat(month, { month: "short" }, locale);
const yearTick = (iso: string) => `'${iso.slice(2, 4)}`;

/** Month axis ticks: `Oct`, with the year (`Nov '25`) on the first tick and on every January. */
export const monthAxisLabels = (months: string[], locale?: string): string[] =>
  months.map((month, i) =>
    i === 0 || month.endsWith("-01")
      ? `${monthShort(month, locale)} ${yearTick(month)}`
      : monthShort(month, locale),
  );

/** `Q3 '26`, for the quarter that starts on `day`. */
export const quarterLabel = (day: string): string =>
  `Q${Math.floor((Number(day.slice(5, 7)) - 1) / 3) + 1} ${yearTick(day)}`;

/** Day axis ticks: `Oct 9`, with the year on the first tick and on each new year when the range crosses one. */
export function dayAxisLabels(days: string[], locale?: string): string[] {
  const crosses = days.length > 0 && days[0]?.slice(0, 4) !== days.at(-1)?.slice(0, 4);
  return days.map((day, i) =>
    crosses && (i === 0 || day.slice(0, 4) !== days[i - 1]?.slice(0, 4))
      ? `${dayMonth(day, locale)} ${yearTick(day)}`
      : dayMonth(day, locale),
  );
}

/** `Oct 2026` */
export const monthLabel = (month: string, locale?: string) =>
  monthFormat(month, { month: "short", year: "numeric" }, locale);
/** `October 2026` */
export const monthFull = (month: string, locale?: string) =>
  monthFormat(month, { month: "long", year: "numeric" }, locale);

/** `↓ 53%`, with the arrow showing the direction of the change; `0%` has no arrow; null when there is no comparison. While amounts are hidden the direction is hidden too. */
export function changeText(pct: number | null): string | null {
  if (pct === null || !Number.isFinite(pct)) return null;
  if (getHideAmounts()) return `${MASK}%`;
  const rounded = Math.round(Math.abs(pct));
  if (rounded === 0) return "0%";
  return `${pct < 0 ? "↓" : "↑"} ${rounded}%`;
}

/** The change from the first to the last of a few monthly amounts, as `↑ 12%`; null when flat or without a comparison. */
export function trendText(values: readonly number[]): string | null {
  const first = values[0];
  const last = values.at(-1);
  if (values.length < 2 || first === undefined || last === undefined || first === 0) return null;
  const pct = ((last - first) / Math.abs(first)) * 100;
  // Flat is decided on the number, not the text: while amounts are hidden the text is masked.
  return Math.round(Math.abs(pct)) === 0 ? null : changeText(pct);
}

/** A part's share of a whole, as a whole percent (masked while amounts are hidden, since it follows from them); a small but real part reads "<1%", not "0%". */
export function shareText(part: number, whole: number): string {
  if (whole <= 0) return "—";
  if (getHideAmounts()) return `${MASK}%`;
  const pct = Math.round((part / whole) * 100);
  return pct === 0 && part > 0 ? "<1%" : `${pct}%`;
}

/**
 * The day a transaction counts on and is shown with: the purchase date when there is one (a Brex
 * card charge posts a day or two later), else the posted date. Totals and date filters use the same day.
 */
export const txnDay = (t: Pick<FinanceTransaction, "purchasedAt" | "postedAt">): string =>
  (t.purchasedAt ?? t.postedAt).slice(0, 10);

/** `Checking ••1111`; the digits are not added again when the name already ends with them. */
export function accountLabel(name: string, lastFour: string | null | undefined): string {
  if (!lastFour) return name;
  const tail = `••${lastFour}`;
  return name.trimEnd().endsWith(tail) ? name : `${name} ${tail}`;
}

/** An account's name and its ending apart (`MOCK Checking`, `••1111`), whether or not the name
 * already ends with the digits, so every account shows its ending the same way. */
export function accountParts(
  name: string,
  lastFour: string | null | undefined,
): { name: string; ending: string | null } {
  if (!lastFour) return { name, ending: null };
  const ending = `••${lastFour}`;
  const trimmed = name.trimEnd();
  return {
    name: trimmed.endsWith(ending) ? trimmed.slice(0, -ending.length).trimEnd() || trimmed : name,
    ending,
  };
}

/** The sentence shown on the paid-with pill and the Paid with figure: `Brex ••0003 + Mercury Checking ••1234`. */
export function paidWithLabel(entries: readonly PaidWithEntry[]): string {
  const last = (entry: PaidWithEntry) => (entry.lastFour ? `••${entry.lastFour}` : "");
  const joinName = (name: string, tail: string) => (tail ? `${name} ${tail}` : name);
  const brandName = (provider: PaidWithEntry["provider"]) =>
    provider === "brex" ? "Brex" : "Mercury";
  const parts: string[] = [];
  for (const provider of ["brex", "mercury"] as const) {
    const cards = entries.filter((e) => e.provider === provider && e.kind === "card");
    if (cards.length === 1 && cards[0]) {
      parts.push(joinName(brandName(provider), last(cards[0])));
    } else if (cards.length > 1) {
      parts.push(
        `${brandName(provider)} · ${cards.length} cards: ${cards.map(last).filter(Boolean).join(", ")}`,
      );
    }
  }
  for (const entry of entries) {
    if (entry.kind === "account") parts.push(accountLabel(entry.name, entry.lastFour));
  }
  return parts.join(" + ");
}

/** The day before a half-open range's exclusive end, as `YYYY-MM-DD`. */
export const lastDayOf = (endExclusive: string): string =>
  new Date(Date.parse(`${endExclusive.slice(0, 10)}T00:00:00Z`) - 86_400_000)
    .toISOString()
    .slice(0, 10);

/** A share or unit count, or `—`. Not money, so it stays visible while amounts are hidden. */
export const shareCount = (value: number | null, locale?: string) =>
  value == null ? "—" : value.toLocaleString(locale);

/** A whole or per-share USD figure (`digits` decimals), or `—`. Masked while amounts are hidden. */
export const usdFigure = (value: number | null, digits = 0, locale?: string) =>
  value == null
    ? "—"
    : getHideAmounts()
      ? `$${MASK}`
      : value.toLocaleString(locale, {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        });

/** A percentage with `digits` decimals (ownership, yield), or `—`. Not money, so it stays visible. */
export const percentFigure = (value: number | null, digits = 2) =>
  value == null ? "—" : `${value.toFixed(digits)}%`;

/** Sum of the known percentages, or null when none is known. */
export const totalPercent = (percents: (number | null | undefined)[]): number | null => {
  const known = percents.filter((p): p is number => p != null);
  return known.length ? known.reduce((a, b) => a + b, 0) : null;
};

/**
 * Runway in months (`4.2`), undefined when unknown. A length of time, not money, so it stays
 * visible while amounts are hidden, as it does in bot replies and artifacts.
 */
export const runwayText = (months: number | null | undefined, digits = 1): string | undefined =>
  months == null ? undefined : months.toFixed(digits);

/** Money written as text (a contract value, an exchange balance). Masked while amounts are hidden. */
export const hiddenOr = (text: string): string => (getHideAmounts() ? MASK : text);
