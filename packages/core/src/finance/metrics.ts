// Pure finance calculations. Every dashboard and detail number comes from here, on synthetic-testable
// inputs; nothing reads the database or the clock (callers pass `now`). All dates are UTC calendar days.
// Money is whole cents. Transactions with status "other" (failed, cancelled, reversed) never count.
import type { BalanceRange } from "@rakazo/contracts";
import type {
  BalancePoint,
  BreakdownMode,
  BreakdownRow,
  CashPoint,
  CashSummary,
  ClassifyContext,
  DayRange,
  FinanceAccount,
  FinanceBill,
  FinanceClassification,
  FinanceRawTxn,
  FinanceTransaction,
  MonthCents,
  MonthlyBurn,
  MonthlyPoint,
  PaidWithEntry,
  RecurrenceCadence,
  RecurringCharge,
  Runway,
  SpendFilter,
  SpendPeriod,
  SpendTotals,
  Subscriptions,
  Upcoming,
  UpcomingItem,
} from "./types.js";
import { categorySlug, vendorKey } from "./vendor.js";

/**
 * Static vendor groups for the "overlaps" tag: vendorKeys that do the same job. A subscription is
 * tagged when at least two subscriptions share a group. ponytail: static map; let the agent judge
 * overlap beyond it.
 */
export const OVERLAP_GROUPS: Record<string, readonly string[]> = {
  "ai-models": [
    "openai",
    "chatgpt",
    "anthropic",
    "claude",
    "openrouter",
    "perplexity",
    "cursor",
    "devin",
    "cognition",
    "moonshot",
    "cerebras",
    "replit",
    "together",
    "groq",
  ],
};

/** Vendors billed by usage: their recurring charges may vary a lot and are flagged `variable`. */
const USAGE_BASED = [
  "openai",
  "anthropic",
  "openrouter",
  "claude",
  "baseten",
  "fireworks",
  "together",
  "groq",
  "cerebras",
  "moonshot",
  "modal",
  "e2b",
  "vercel",
  "railway",
  "cloudflare",
  "twilio",
  "aws",
  "amazon-web-services",
  "google-cloud",
  "gcp",
  "azure",
  "datadog",
  "sentry",
];

// ---- UTC day and month helpers ----

const MS_DAY = 86_400_000;
type Day = string; // YYYY-MM-DD
type Month = string; // YYYY-MM

const dayOf = (iso: string): Day => new Date(iso).toISOString().slice(0, 10);
const dayNum = (day: Day): number => Date.parse(`${day}T00:00:00Z`) / MS_DAY;
const addDays = (day: Day, n: number): Day =>
  new Date((dayNum(day) + n) * MS_DAY).toISOString().slice(0, 10);
const monthOf = (day: Day): Month => day.slice(0, 7);
const addMonths = (month: Month, n: number): Month => {
  const total = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
};
/** Same day of month `n` months on, clamped to the month's last day. */
const addMonthsToDay = (day: Day, n: number): Day => {
  const month = addMonths(monthOf(day), n);
  const last = new Date(
    Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0),
  ).getUTCDate();
  return `${month}-${String(Math.min(Number(day.slice(8, 10)), last)).padStart(2, "0")}`;
};
/** Month ids ending with `now`'s month, oldest first. */
const lastMonths = (now: Date, count: number): Month[] =>
  Array.from({ length: count }, (_, i) =>
    addMonths(monthOf(dayOf(now.toISOString())), i - count + 1),
  );

/** The earliest day any transaction counts on; undefined with none. */
export const earliestDay = (txns: FinanceTransaction[]): Day | undefined =>
  txns.reduce<Day | undefined>((min, t) => {
    const day = txnDay(t);
    return min === undefined || day < min ? day : min;
  }, undefined);

/** The day a transaction counts on: the purchase date when there is one. */
const txnDay = (t: FinanceTransaction): Day => dayOf(t.purchasedAt ?? t.postedAt);
// v1 is USD only: a transaction in another currency never enters a sum (see `excludedNonUsdCount`).
const counts = (t: FinanceTransaction): boolean => t.status !== "other" && t.currency === "USD";
/** True when a transaction enters sums and counts (USD, not failed or reversed). */
export const countsTowardTotals = counts;
const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? (s[mid] ?? 0) : Math.round(((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2);
};
const hasToken = (key: string, entry: string): boolean => `-${key}-`.includes(`-${entry}-`);

// ---- Classification ----

const STATEMENT_REFUND = /\b(refund|reversal|chargeback|returned?)\b/i;
const FINANCING_CATEGORY = /financing|investment|equity|funding|loan-proceeds/;

/**
 * spend: a purchase or bill the business paid.
 * revenue: money in from customers. financing: investment or loan proceeds.
 * internal_transfer: Treasury moves and moves between the user's own accounts.
 * card_payment: a Mercury payment to Brex while Brex is connected.
 * Refunds are `spend` with a positive amount.
 */
export function classify(raw: FinanceRawTxn, ctx: ClassifyContext): FinanceClassification {
  if (raw.provider === "brex") return "spend";
  const kind = raw.kind.toLowerCase();
  const slug = categorySlug(raw.category);
  const vendor = vendorKey(raw.counterparty);

  if (kind.includes("treasury") || kind === "internaltransfer") return "internal_transfer";
  // The owner moving their own money in (an exchange or brokerage transfer) is neither revenue nor spend.
  if (slug === "transfer") return "internal_transfer";
  const own = ctx.ownAccountNames.map(vendorKey);
  if (own.some((name) => vendor === name || vendor.startsWith(`${name}-`))) {
    return "internal_transfer";
  }

  if (
    ctx.brexConnected &&
    vendor === "brex" &&
    (slug === "uncategorized" || slug === "credit-loan-payments")
  ) {
    return "card_payment";
  }
  if (raw.amountCents <= 0) return "spend";

  if (FINANCING_CATEGORY.test(slug)) return "financing";
  if (slug === "revenue" || hasToken(vendor, "stripe") || kind.startsWith("incoming")) {
    return "revenue";
  }
  // A bank statement line carries no category or kind, so a deposit there is money in, unless its
  // description says it is a refund (that nets off spend instead of counting as revenue).
  if (raw.provider === "statement")
    return STATEMENT_REFUND.test(raw.counterparty) ? "spend" : "revenue";
  // Any other credit (a vendor refund, a card credit) is a refund.
  return "spend";
}

/** How many live transactions are left out of every total because they are not in USD. */
export const excludedNonUsdCount = (txns: FinanceTransaction[]): number =>
  txns.filter((t) => t.status !== "other" && t.currency !== "USD").length;

// ---- Cash ----

/**
 * Cash = checking + savings + Treasury + `stablecoinCents` (priced canonical stablecoins).
 * A `card` account's balance owed is reported apart and never cash.
 */
export function cashSummary(accounts: FinanceAccount[], stablecoinCents = 0): CashSummary {
  const sum = (kind: FinanceAccount["kind"]) =>
    accounts.filter((a) => a.kind === kind).reduce((total, a) => total + a.balanceCents, 0);
  const checkingCents = sum("checking");
  const savingsCents = sum("savings");
  const treasuryCents = sum("treasury");
  const bankCashCents = checkingCents + savingsCents + treasuryCents;
  return {
    cashCents: bankCashCents + stablecoinCents,
    bankCashCents,
    stablecoinCents,
    checkingCents,
    savingsCents,
    treasuryCents,
    cardOwedCents: accounts.some((a) => a.kind === "card") ? sum("card") : null,
    cashAccountCount: accounts.filter((a) => a.kind !== "card").length,
  };
}

// ---- Spend and burn ----

const spendCents = (t: FinanceTransaction): number =>
  t.classification === "spend" && counts(t) ? -t.amountCents : 0;

function sumSpend(txns: FinanceTransaction[], start: Day, end: Day): number {
  let total = 0;
  for (const t of txns) {
    const day = txnDay(t);
    if (day >= start && day < end) total += spendCents(t);
  }
  return total;
}

function periodStart(period: SpendPeriod, today: Day): { start: Day; previousStart: Day } {
  const month = monthOf(today);
  const year = today.slice(0, 4);
  switch (period) {
    case "week": {
      const sinceMonday = (dayNum(today) + 3) % 7; // 1970-01-01 was a Thursday
      const start = addDays(today, -sinceMonday);
      return { start, previousStart: addDays(start, -7) };
    }
    case "month":
      return { start: `${month}-01`, previousStart: `${addMonths(month, -1)}-01` };
    case "quarter": {
      const first = addMonths(month, -((Number(month.slice(5, 7)) - 1) % 3));
      return { start: `${first}-01`, previousStart: `${addMonths(first, -3)}-01` };
    }
    case "year":
      return { start: `${year}-01-01`, previousStart: `${Number(year) - 1}-01-01` };
  }
}

/**
 * Spend in the current calendar period up to `now` (week starts Monday) against the same number of
 * elapsed days at the start of the previous period, so a half-finished month is not compared with a
 * whole one. The previous range is clamped to the previous period's length (Mar 31 against February
 * ends Feb 28 or 29). Counts `spend` transactions by `purchasedAt ?? postedAt`, net of refunds; `card_payment`,
 * `internal_transfer`, revenue and financing are excluded. `end` is the day after today and
 * `previousEnd` is the day after the last compared day (ranges are half-open, as `DayRange`). When the previous period starts
 * before `coverageStart` (the earliest synced day) its total is incomplete, so `previousCents` and
 * `changePct` are null.
 */
export function spendTotals(
  txns: FinanceTransaction[],
  period: SpendPeriod,
  now: Date,
  coverageStart?: Day,
): SpendTotals {
  const today = dayOf(now.toISOString());
  const { start, previousStart } = periodStart(period, today);
  const end = addDays(today, 1);
  const currentCents = sumSpend(txns, start, end);
  const covered = coverageStart === undefined || previousStart >= coverageStart;
  const elapsed = dayNum(end) - dayNum(start);
  const sameDays = addDays(previousStart, elapsed);
  const previousEnd = sameDays < start ? sameDays : start;
  const previousCents = covered ? sumSpend(txns, previousStart, previousEnd) : null;
  return {
    period,
    currentCents,
    previousCents,
    changePct:
      previousCents === null || previousCents === 0
        ? null
        : Math.round(((currentCents - previousCents) / Math.abs(previousCents)) * 1000) / 10,
    start,
    end,
    previousStart,
    previousEnd,
  };
}

export type CashGranularity = "day" | "week" | "month" | "quarter" | "year";

/** Monday on or before `day`. */
const weekStart = (day: Day): Day => addDays(day, -((dayNum(day) + 3) % 7)); // 1970-01-01 was a Thursday
const monthIndex = (day: Day) => Number(day.slice(0, 4)) * 12 + Number(day.slice(5, 7));
/** Months per bucket for the month-based granularities. */
const MONTHS = { month: 1, quarter: 3, year: 12 } as const;

/** First day of the bucket holding `day`. */
function bucketStart(granularity: CashGranularity, day: Day): Day {
  if (granularity === "day") return day;
  if (granularity === "week") return weekStart(day);
  const month = monthOf(day);
  return `${addMonths(month, -((Number(month.slice(5, 7)) - 1) % MONTHS[granularity]))}-01`;
}

/** First day of the bucket `n` buckets after the one starting on `start`. */
function bucketAfter(granularity: CashGranularity, start: Day, n: number): Day {
  if (granularity === "day") return addDays(start, n);
  if (granularity === "week") return addDays(start, 7 * n);
  return `${addMonths(monthOf(start), MONTHS[granularity] * n)}-01`;
}

/**
 * Out, revenue and financing per bucket for the last `buckets` days, Monday-start weeks, calendar
 * months, quarters or years ending with the one that holds `now`, oldest first, zero-filled. The
 * last bucket is `partial`. A bucket's `start` and `end` are inclusive UTC days. Classification and
 * day rules match spendTotals. With `from` instead of `buckets`, the buckets run from the one
 * holding `from` and the first one starts on `from`, so the chart covers the same days as
 * `spendTotals` for that period.
 */
export function cashSeries(
  txns: FinanceTransaction[],
  opts: { granularity: CashGranularity; now: Date } & ({ buckets: number } | { from: Day }),
): CashPoint[] {
  const { granularity, now } = opts;
  const today = dayOf(now.toISOString());
  const current = bucketStart(granularity, today);
  const from = "from" in opts ? opts.from : undefined;
  const buckets =
    from === undefined
      ? (opts as { buckets: number }).buckets
      : granularity === "day"
        ? dayNum(today) - dayNum(from) + 1
        : granularity === "week"
          ? (dayNum(current) - dayNum(weekStart(from))) / 7 + 1
          : (monthIndex(current) - monthIndex(bucketStart(granularity, from))) /
              MONTHS[granularity] +
            1;
  const points = new Map<Day, CashPoint>();
  for (let i = buckets - 1; i >= 0; i--) {
    const start = bucketAfter(granularity, current, -i);
    points.set(start, {
      start,
      end: addDays(bucketAfter(granularity, start, 1), -1),
      outCents: 0,
      revenueCents: 0,
      financingCents: 0,
      partial: i === 0,
    });
  }
  const first = points.values().next().value;
  if (first && from !== undefined && from > first.start) first.start = from;
  for (const t of txns) {
    const day = txnDay(t);
    const point = points.get(bucketStart(granularity, day));
    if (!point || !counts(t) || (from !== undefined && day < from)) continue;
    if (t.classification === "spend") point.outCents -= t.amountCents;
    else if (t.classification === "revenue") point.revenueCents += t.amountCents;
    else if (t.classification === "financing") point.financingCents += t.amountCents;
  }
  return [...points.values()];
}

const monthTotals = (txns: FinanceTransaction[], count: number, now: Date) =>
  cashSeries(txns, { granularity: "month", buckets: count, now }).map(
    ({ start, end: _end, ...rest }) => ({ month: start.slice(0, 7), ...rest }),
  );

/** The last 12 calendar months ending with `now`'s, oldest first; the last is `partial`. */
export function monthlySeries(txns: FinanceTransaction[], now: Date): MonthlyPoint[] {
  return monthTotals(txns, 12, now);
}

/** Average of (spend out - revenue) over the 3 full months before `now`'s month; financing and transfers excluded. */
export function monthlyBurn(txns: FinanceTransaction[], now: Date): MonthlyBurn {
  const months = monthTotals(txns, 4, now).slice(0, 3);
  const total = months.reduce((sum, p) => sum + p.outCents - p.revenueCents, 0);
  return { monthlyCents: Math.round(total / 3), months: months.map((p) => p.month) };
}

/** Months of cash left at the burn rate and the day it runs out; both null when `burnCents` <= 0. */
export function runway(cashCents: number, burnCents: number, now: Date): Runway {
  if (burnCents <= 0) return { months: null, runOutDate: null };
  const months = Math.max(cashCents, 0) / burnCents;
  return {
    months: Math.round(months * 10) / 10,
    runOutDate: addDays(dayOf(now.toISOString()), Math.round((months * 365.25) / 12)),
  };
}

/**
 * Total cash for the current month (today's balance) and each month after, `burnCents` lower each
 * month, until it reaches zero (that month is clamped to 0) or 24 months; [] when not burning.
 */
export function projectCash(cashCents: number, burnCents: number, now: Date): BalancePoint[] {
  if (burnCents <= 0) return [];
  const first = monthOf(dayOf(now.toISOString()));
  const points: BalancePoint[] = [];
  for (let i = 0; i < 24; i++) {
    const balanceCents = Math.max(cashCents - i * burnCents, 0);
    points.push({ month: addMonths(first, i), balanceCents });
    if (balanceCents === 0) break;
  }
  return points;
}

// ---- Breakdowns ----

/** Spend within `range` grouped by category slug, vendorKey or account externalId, largest first. */
export function breakdown(
  txns: FinanceTransaction[],
  by: BreakdownMode,
  range: DayRange,
): BreakdownRow[] {
  const rows = new Map<string, { label: string; latest: Day; cents: number }>();
  for (const t of txns) {
    const day = txnDay(t);
    if (t.classification !== "spend" || !counts(t) || day < range.start || day >= range.end) {
      continue;
    }
    const [key, label] =
      by === "category"
        ? [categorySlug(t.category), t.category?.trim() || "Uncategorized"]
        : by === "vendor"
          ? [t.vendorKey, t.counterparty]
          : [t.accountExternalId, t.accountExternalId];
    const row = rows.get(key) ?? { label, latest: day, cents: 0 };
    row.cents -= t.amountCents;
    if (day >= row.latest) Object.assign(row, { label, latest: day });
    rows.set(key, row);
  }
  return [...rows]
    .map(([key, row]) => ({ key, label: row.label, cents: row.cents }))
    .filter((row) => row.cents !== 0)
    .sort((a, b) => b.cents - a.cents || a.label.localeCompare(b.label));
}

/** Spend per calendar month for the last `months` months ending with `now`'s, oldest first, zero-filled. */
export function monthlySpend(
  txns: FinanceTransaction[],
  filter: SpendFilter,
  now: Date,
  months: number,
): MonthCents[] {
  const totals = new Map<Month, number>(lastMonths(now, months).map((m) => [m, 0]));
  for (const t of txns) {
    if (filter.vendorKey !== undefined && t.vendorKey !== filter.vendorKey) continue;
    if (filter.categorySlug !== undefined && categorySlug(t.category) !== filter.categorySlug) {
      continue;
    }
    if (
      filter.accountExternalId !== undefined &&
      t.accountExternalId !== filter.accountExternalId
    ) {
      continue;
    }
    const month = monthOf(txnDay(t));
    const total = totals.get(month);
    if (total !== undefined) totals.set(month, total + spendCents(t));
  }
  return [...totals].map(([month, cents]) => ({ month, cents }));
}

/**
 * Month-end balance of `account` for the last `months` months ending with the current month, built
 * backwards from `account.balanceCents` and the account's transactions (a transaction's amount is
 * undone for every month end after it). The current month's point is the balance today.
 * ponytail: Treasury dividends and Brex payments are not transactions here, so those accounts drift.
 */
export function balanceHistory(
  account: FinanceAccount,
  txns: FinanceTransaction[],
  now: Date,
  months = 12,
): BalancePoint[] {
  // A card's balance is what is owed, so money out raises it.
  const sign = account.kind === "card" ? -1 : 1;
  const own = txns.filter(
    (t) =>
      t.provider === account.provider && t.accountExternalId === account.externalId && counts(t),
  );
  const currentMonth = monthOf(dayOf(now.toISOString()));
  return lastMonths(now, months).map((month) => {
    let after = 0;
    for (const t of own) if (monthOf(dayOf(t.postedAt)) > month) after += t.amountCents;
    return {
      month,
      balanceCents:
        month === currentMonth ? account.balanceCents : account.balanceCents - sign * after,
    };
  });
}

/**
 * One account's chart: `balanceHistory`, starting at the month end before its first transaction.
 * Earlier points would only repeat that opening balance for months nothing was synced or uploaded
 * (a statement account made from September's file would otherwise look flat back to last year).
 */
export function accountBalanceHistory(
  account: FinanceAccount,
  txns: FinanceTransaction[],
  now: Date,
): BalancePoint[] {
  const history = balanceHistory(account, txns, now);
  const first = txns
    .filter((t) => t.provider === account.provider && t.accountExternalId === account.externalId)
    .reduce<string | null>((min, t) => (min === null || t.postedAt < min ? t.postedAt : min), null);
  if (!first) return history;
  const firstMonth = monthOf(dayOf(first));
  const start = Math.max(history.findIndex((p) => p.month >= firstMonth) - 1, 0);
  return history.slice(start);
}

/**
 * Total cash at each month end: the non-card accounts' histories added up. Transfers between the
 * user's own accounts net to zero in the total, and the Treasury side is not fetched, so they are
 * ignored here; otherwise a move to Treasury would be undone on checking only.
 * ponytail: a Treasury account's own history stays flat.
 */
export function cashHistory(
  accounts: FinanceAccount[],
  txns: FinanceTransaction[],
  now: Date,
): BalancePoint[] {
  const totals = new Map<Month, number>();
  const external = txns.filter((t) => t.classification !== "internal_transfer");
  for (const account of accounts) {
    if (account.kind === "card") continue;
    for (const point of balanceHistory(account, external, now, 12)) {
      totals.set(point.month, (totals.get(point.month) ?? 0) + point.balanceCents);
    }
  }
  return [...totals]
    .map(([month, balanceCents]) => ({ month, balanceCents }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Total bank cash at the end of each of `days` (UTC, any order), built like `cashHistory`: from the
 * current balances, undoing every counted transaction posted after that day, internal transfers
 * left out. A day on or after today is the current balance.
 */
export function cashAtDays(
  accounts: FinanceAccount[],
  txns: FinanceTransaction[],
  days: Day[],
  now: Date,
): number[] {
  const today = dayOf(now.toISOString());
  const external = txns.filter((t) => t.classification !== "internal_transfer" && counts(t));
  return days.map((day) => {
    let total = 0;
    for (const account of accounts) {
      if (account.kind === "card") continue;
      let after = 0;
      if (day < today) {
        for (const t of external) {
          if (
            t.provider === account.provider &&
            t.accountExternalId === account.externalId &&
            dayOf(t.postedAt) > day
          ) {
            after += t.amountCents;
          }
        }
      }
      total += account.balanceCents - after;
    }
    return total;
  });
}

/** The days a balance chart plots, oldest first, always ending today: 7 or 30 daily, 13 weekly, or 11 month-ends plus today. */
export function balanceGrid(range: BalanceRange, now: Date): Day[] {
  const today = dayOf(now.toISOString());
  const back = (count: number, step: number) =>
    Array.from({ length: count }, (_, i) => addDays(today, -(count - 1 - i) * step));
  if (range === "week") return back(7, 1);
  if (range === "month") return back(30, 1);
  if (range === "quarter") return back(13, 7);
  const monthEnd = (m: Month) => addDays(`${addMonths(m, 1)}-01`, -1);
  const thisMonth = monthOf(today);
  return [...Array.from({ length: 11 }, (_, i) => monthEnd(addMonths(thisMonth, i - 11))), today];
}

// ---- Recurring charges ----

const CADENCES: { cadence: RecurrenceCadence; days: number }[] = [
  { cadence: "weekly", days: 7 },
  { cadence: "biweekly", days: 14 },
  { cadence: "monthly", days: 30 },
  { cadence: "annual", days: 365 },
];
const DAY_TOLERANCE = 3;
const AMOUNT_TOLERANCE = 0.25;
/** The regular charges must be at least this share of the similar-amount charges. */
const MIN_REGULAR_SHARE = 0.5;
const MAX_OCCURRENCES = 60;
const AVG_MONTH_DAYS = 30.4375;

interface Occurrence {
  day: Day;
  cents: number;
  txns: FinanceTransaction[];
}

/** The largest group of occurrences whose amounts are within 25% of one of them (the latest on ties). */
function amountCluster(occurrences: Occurrence[]): Occurrence[] {
  let best: Occurrence[] = [];
  for (const anchor of occurrences) {
    const members = occurrences.filter(
      (o) => Math.abs(o.cents - anchor.cents) <= anchor.cents * AMOUNT_TOLERANCE,
    );
    if (members.length >= best.length) best = members;
  }
  return best;
}

/** The longest run of occurrences (not necessarily adjacent) whose consecutive gaps are `days` +/- 3. */
function longestChain(occurrences: Occurrence[], days: number): Occurrence[] {
  const chains: Occurrence[][] = [];
  for (const [i, o] of occurrences.entries()) {
    let prev: Occurrence[] = [];
    for (let j = 0; j < i; j++) {
      const gap = dayNum(o.day) - dayNum(occurrences[j]?.day ?? o.day);
      const chain = chains[j] ?? [];
      if (Math.abs(gap - days) <= DAY_TOLERANCE && chain.length > prev.length) prev = chain;
    }
    chains.push([...prev, o]);
  }
  return chains.reduce((best, chain) => (chain.length >= best.length ? chain : best), []);
}

function nextAfter(day: Day, cadence: RecurrenceCadence): Day {
  if (cadence === "weekly") return addDays(day, 7);
  if (cadence === "biweekly") return addDays(day, 14);
  return addMonthsToDay(day, cadence === "monthly" ? 1 : 12);
}

function paidWithOf(txns: FinanceTransaction[], accounts: FinanceAccount[]): PaidWithEntry[] {
  const entries = new Map<string, { entry: PaidWithEntry; n: number }>();
  for (const t of txns) {
    let entry: PaidWithEntry;
    if (t.provider === "brex") {
      entry = { provider: "brex", kind: "card", name: "Brex card", lastFour: t.cardLastFour };
    } else {
      const account = accounts.find(
        (a) => a.provider === t.provider && a.externalId === t.accountExternalId,
      );
      entry = {
        provider: t.provider,
        kind: "account",
        name: account?.name ?? "Mercury",
        lastFour: account?.lastFour ?? null,
      };
    }
    const id = `${entry.provider}|${entry.kind}|${entry.name}|${entry.lastFour}`;
    const seen = entries.get(id);
    if (seen) seen.n++;
    else entries.set(id, { entry, n: 1 });
  }
  return [...entries.values()].sort((a, b) => b.n - a.n).map((e) => e.entry);
}

/**
 * Vendors charged regularly: at least 3 `spend` or `card_payment` charges of similar amount (within
 * 25%) whose gaps are within 3 days of weekly (7), biweekly (14), monthly (30) or annual (365), at
 * least half of the similar-amount charges being on that rhythm. Extra charges from the same vendor
 * (top-ups, one-offs) do not break the pattern. A vendor not charged for 1.5 intervals counts as
 * cancelled. Usage-based vendors (a static list) are billed in irregular top-ups, so they count as
 * monthly when charged in each of the last 3 full months, at the average of those months, and are
 * `variable` when the months differ by more than 25%. `accounts` supply names and last four digits
 * for `paidWith`.
 */
export function detectRecurring(
  txns: FinanceTransaction[],
  now: Date,
  accounts: FinanceAccount[] = [],
): RecurringCharge[] {
  const today = dayOf(now.toISOString());
  // The change figure runs from 3 months before the last full month to that month, the same
  // window the vendor page uses; the usage-based average takes the last 3 full months.
  const changeMonths = lastMonths(now, 5).slice(0, 4);
  const trendMonths = changeMonths.slice(1);
  const byVendor = new Map<string, FinanceTransaction[]>();
  for (const t of txns) {
    if (!counts(t) || t.amountCents >= 0) continue;
    if (t.classification !== "spend" && t.classification !== "card_payment") continue;
    byVendor.set(t.vendorKey, [...(byVendor.get(t.vendorKey) ?? []), t]);
  }

  const found: RecurringCharge[] = [];
  for (const [key, all] of byVendor) {
    all.sort((a, b) => txnDay(a).localeCompare(txnDay(b)) || a.id.localeCompare(b.id));
    // Charges on the same day are one occurrence.
    const days = new Map<Day, FinanceTransaction[]>();
    for (const t of all) days.set(txnDay(t), [...(days.get(txnDay(t)) ?? []), t]);
    const occurrences: Occurrence[] = [...days].slice(-MAX_OCCURRENCES).map(([day, ts]) => ({
      day,
      txns: ts,
      cents: -ts.reduce((sum, t) => sum + t.amountCents, 0),
    }));
    if (occurrences.length < 3) continue;
    const monthTotal = (chain: Occurrence[], month: Month) =>
      chain.filter((o) => monthOf(o.day) === month).reduce((sum, o) => sum + o.cents, 0);

    let chain: Occurrence[];
    let cadence: RecurrenceCadence;
    let amountCents: number;
    let monthlyCents: number;
    let variable = false;
    if (USAGE_BASED.some((vendor) => hasToken(key, vendor))) {
      const totals = trendMonths.map((m) => monthTotal(occurrences, m));
      if (totals.some((total) => total <= 0)) continue;
      chain = occurrences;
      cadence = "monthly";
      amountCents = monthlyCents = Math.round(totals.reduce((a, b) => a + b, 0) / 3);
      variable = totals.some(
        (total) => Math.abs(total - amountCents) > amountCents * AMOUNT_TOLERANCE,
      );
    } else {
      const cluster = amountCluster(occurrences);
      let best: { chain: Occurrence[]; spec: (typeof CADENCES)[number] } | null = null;
      for (const spec of CADENCES) {
        const found = longestChain(cluster, spec.days);
        if (found.length > (best?.chain.length ?? 0)) best = { chain: found, spec };
      }
      if (
        !best ||
        best.chain.length < 3 ||
        best.chain.length < cluster.length * MIN_REGULAR_SHARE
      ) {
        continue;
      }
      chain = best.chain;
      cadence = best.spec.cadence;
      amountCents = median(chain.map((o) => o.cents));
      // Weekly and biweekly use the real rhythm: payroll every 15 days is 2.03 a month, not 2.17.
      const gaps = chain.slice(1).map((o, i) => dayNum(o.day) - dayNum(chain[i]?.day ?? o.day));
      const perMonth =
        cadence === "annual"
          ? 1 / 12
          : cadence === "monthly"
            ? 1
            : AVG_MONTH_DAYS / Math.max(median(gaps), 1);
      monthlyCents = Math.round(amountCents * perMonth);
    }

    const last = chain[chain.length - 1];
    const lastTxn = last?.txns[last.txns.length - 1];
    if (!last || !lastTxn) continue;
    const idleLimit =
      (cadence === "weekly" ? 7 : cadence === "biweekly" ? 14 : cadence === "monthly" ? 30 : 365) *
        1.5 +
      DAY_TOLERANCE;
    if (dayNum(today) - dayNum(last.day) > idleLimit) continue;

    found.push({
      key,
      name: lastTxn.counterparty,
      cadence,
      amountCents,
      monthlyCents,
      variable,
      chargeCount: chain.length,
      lastChargeAt: lastTxn.purchasedAt ?? lastTxn.postedAt,
      nextExpectedAt: `${nextAfter(last.day, cadence)}T00:00:00.000Z`,
      trendCents: changeMonths.map((m) => monthTotal(chain, m)),
      classification: last.txns.every((t) => t.classification === "card_payment")
        ? "card_payment"
        : "spend",
      paidWith: paidWithOf(
        chain.flatMap((o) => o.txns),
        accounts,
      ),
      fixedCost: isFixedCost(key, lastTxn.category),
      ...(categorySlug(lastTxn.category) === "credit-loan-payments" ? { cardBill: true } : {}),
    });
  }
  return found.sort((a, b) => b.monthlyCents - a.monthlyCents || a.key.localeCompare(b.key));
}

// ---- Upcoming and subscriptions ----

// A card bill paid from the bank (while the card itself is not connected) recurs, but it pays for
// many purchases, so it is a fixed cost, not a subscription.
const FIXED_COST_CATEGORY = /(^|-)(payroll|rent|salar(y|ies)|wages)(-|$)|^credit-loan-payments$/;
const FIXED_COST_VENDOR = ["payroll", "landlord"];

/** Payroll and rent recur, but they are fixed costs, not subscriptions a founder can cancel. */
function isFixedCost(key: string, category: string | null): boolean {
  return (
    FIXED_COST_CATEGORY.test(categorySlug(category)) ||
    FIXED_COST_VENDOR.some((token) => hasToken(key, token))
  );
}

/**
 * Expected charges in the next `days` days (today up to but not including today + days): each
 * recurring `spend` charge's predicted dates and unpaid Brex bills due in the window or overdue.
 * Pending charges are left out: spend already counts them, so listing them here too would count
 * them twice. A prediction within 3 days of a pending charge from the same vendor is dropped for
 * the same reason. Recurring Brex card payments are left out because the card purchases behind
 * them are predicted on their own.
 */
export function upcoming(
  recurring: RecurringCharge[],
  pending: FinanceTransaction[],
  bills: FinanceBill[],
  now: Date,
  days = 30,
): Upcoming {
  const today = dayOf(now.toISOString());
  const end = addDays(today, days);
  const pendingTxns = pending.filter(
    (t) => t.status === "pending" && t.classification === "spend" && t.amountCents < 0,
  );
  const items: UpcomingItem[] = [];

  for (const charge of recurring) {
    if (charge.classification !== "spend") continue;
    const dates: Day[] = [];
    let date = dayOf(charge.nextExpectedAt);
    for (let guard = 0; date < end && guard < 400; guard++) {
      const covered = pendingTxns.some(
        (t) =>
          t.vendorKey === charge.key && Math.abs(dayNum(txnDay(t)) - dayNum(date)) <= DAY_TOLERANCE,
      );
      if (date >= today && !covered) dates.push(date);
      date = nextAfter(date, charge.cadence);
    }
    if (dates.length) {
      items.push({
        key: charge.key,
        kind: "recurring",
        name: charge.name,
        dates,
        amountCents: charge.amountCents,
        ...(charge.cardBill ? { cardBill: true } : {}),
      });
    }
  }
  for (const bill of bills) {
    const due = dayOf(bill.dueAt);
    if (due >= end) continue;
    items.push({
      key: bill.externalId,
      kind: "bill",
      name: bill.vendorName,
      dates: [due < today ? today : due],
      amountCents: Math.abs(bill.amountCents),
      billStatus: bill.status,
      dueAt: due,
    });
  }

  items.sort(
    (a, b) =>
      (a.dates[0] ?? "").localeCompare(b.dates[0] ?? "") ||
      b.amountCents - a.amountCents ||
      a.key.localeCompare(b.key),
  );
  return {
    items,
    totalCents: items.reduce((sum, item) => sum + item.amountCents * item.dates.length, 0),
  };
}

/** Recurring `spend` vendors with their monthly cost, largest first; `card_payment` and fixed costs (payroll, rent) are left out. Sets `overlapGroup` from OVERLAP_GROUPS. */
export function subscriptions(recurring: RecurringCharge[]): Subscriptions {
  const spend = recurring.filter((r) => r.classification === "spend" && !r.fixedCost);
  const groupOf = (key: string) =>
    Object.entries(OVERLAP_GROUPS).find(([, vendors]) =>
      vendors.some((v) => hasToken(key, v)),
    )?.[0] ?? null;
  const members = new Map<string, number>();
  for (const r of spend) {
    const group = groupOf(r.key);
    if (group) members.set(group, (members.get(group) ?? 0) + 1);
  }
  const items = spend
    .map((r) => {
      const group = groupOf(r.key);
      return {
        key: r.key,
        name: r.name,
        monthlyCents: r.monthlyCents,
        trendCents: r.trendCents,
        lastChargeAt: r.lastChargeAt,
        overlapGroup: group && (members.get(group) ?? 0) >= 2 ? group : null,
        paidWith: r.paidWith,
      };
    })
    .sort((a, b) => b.monthlyCents - a.monthlyCents || a.key.localeCompare(b.key));
  return { items, totalMonthlyCents: items.reduce((sum, s) => sum + s.monthlyCents, 0) };
}
