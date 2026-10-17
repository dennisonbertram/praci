import type {
  FinanceAccount,
  FinanceBill,
  FinanceCard,
  FinanceTransaction,
  MessageBlock,
  RunwayCryptoScope,
  StatementReminder,
} from "@rakazo/contracts";
import {
  CRYPTO_CHAINS,
  FinanceProviderSchema,
  FinanceRecordProviderSchema,
  financeProviderForEndpoint,
  isCartaAgentSpawnKey,
  isCryptoEndpoint,
  isFinanceAgentSpawnKey,
  RunwayCryptoScopeSchema,
} from "@rakazo/contracts";
import {
  breakdown,
  cashSummary,
  categorySlug,
  countedCash,
  countsTowardTotals,
  detectRecurring,
  exchangeParts,
  monthlyBurn,
  runway,
  spendTotals,
  statementReminders,
  subscriptions,
  summarizeCrypto,
  upcoming,
} from "@rakazo/core";
import type { Prisma, PrismaClient } from "@rakazo/db";
import { mailToolsAllowed } from "./mail-tools.js";

export const FINANCE_TOOL_NAMES = new Set([
  "finance_overview",
  "finance_breakdown",
  "finance_transactions",
  "finance_recurring",
  "finance_crypto",
]);

/** Only the Finance agent, on a run its owner started (a direct message or their own routine). */
const OWNER_INITIATED_TRIGGERS = new Set(["user", "follow_up", "routine"]);
export function financeToolsAllowed(
  options: Parameters<typeof mailToolsAllowed>[0] & {
    botSpawnKey: string | null | undefined;
    trigger: string;
  },
): boolean {
  return (
    (isFinanceAgentSpawnKey(options.botSpawnKey) || isCartaAgentSpawnKey(options.botSpawnKey)) &&
    OWNER_INITIATED_TRIGGERS.has(options.trigger) &&
    mailToolsAllowed(options)
  );
}

/** Drop the finance tools when the run may not use them. */
export function selectFinanceTools<T extends { name: string }>(
  tools: T[],
  financeEnabled: boolean,
): T[] {
  return financeEnabled ? tools : tools.filter((tool) => !FINANCE_TOOL_NAMES.has(tool.name));
}

type Scope = { spaceId: string; userId: string };

export type FinanceToolDeps = {
  prisma: Pick<
    PrismaClient,
    | "financeAccount"
    | "financeTransaction"
    | "financeBill"
    | "financeSyncState"
    | "financeWallet"
    | "financeCryptoHolding"
    | "financeExchangeConnection"
    | "financeExchangeBalance"
    | "financePreference"
    | "financeStatement"
  >;
  /** From the run (the bot owner), never from model input. */
  scope: Scope;
  /** Puts a preview card in the run's thread. Without it the tools still return data. */
  publish?: (blocks: MessageBlock[]) => Promise<unknown>;
  now?: () => Date;
};

/** True when the user has an enabled Mercury, Brex or Blockscout (crypto) MCP server, or a statement account. */
export async function hasFinanceSource(
  prisma: Pick<PrismaClient, "mcpServer" | "financeAccount">,
  scope: Scope,
): Promise<boolean> {
  if (
    await prisma.financeAccount.findFirst({
      where: { ...scope, provider: "statement" },
      select: { id: true },
    })
  )
    return true;
  const servers = await prisma.mcpServer.findMany({
    where: { spaceId: scope.spaceId, userId: scope.userId, enabled: true },
    select: { endpoint: true },
  });
  return servers.some(
    (server) =>
      financeProviderForEndpoint(server.endpoint) !== null || isCryptoEndpoint(server.endpoint),
  );
}

/** Statement accounts whose newest imported statement is getting old (shared by the Finance page and the agent). */
export async function loadStatementReminders(
  prisma: Pick<PrismaClient, "financeAccount" | "financeStatement">,
  scope: Scope,
  today: string,
): Promise<StatementReminder[]> {
  const accounts = await prisma.financeAccount.findMany({
    where: { ...scope, provider: "statement" },
    select: { id: true, name: true, lastFour: true },
  });
  if (accounts.length === 0) return [];
  const covered = await prisma.financeStatement.groupBy({
    by: ["accountId"],
    where: { ...scope, status: "imported", accountId: { in: accounts.map((a) => a.id) } },
    _max: { periodEnd: true },
  });
  const through = new Map(covered.map((c) => [c.accountId, c._max.periodEnd]));
  return statementReminders(
    accounts.map((a) => ({
      accountId: a.id,
      accountName: a.lastFour ? `${a.name} ••${a.lastFour}` : a.name,
      coveredThrough: through.get(a.id) ?? null,
    })),
    today,
  );
}

/** The saved choice of what counts as cash for runway; bank only until the user picks one. */
export async function loadRunwayCrypto(
  prisma: Pick<PrismaClient, "financePreference">,
  scope: Scope,
): Promise<RunwayCryptoScope> {
  const row = await prisma.financePreference.findFirst({
    where: { spaceId: scope.spaceId, userId: scope.userId },
    select: { runwayCrypto: true },
  });
  const parsed = RunwayCryptoScopeSchema.safeParse(row?.runwayCrypto);
  return parsed.success ? parsed.data : "bank";
}

// ---- Row mapping (shared with the API's Finance pages) ----

export const toFinanceAccount = (row: Prisma.FinanceAccountGetPayload<object>): FinanceAccount => ({
  id: row.id,
  provider: FinanceRecordProviderSchema.parse(row.provider),
  externalId: row.externalId,
  name: row.name,
  lastFour: row.lastFour,
  kind: row.kind as FinanceAccount["kind"],
  balanceCents: Number(row.balanceCents),
  currency: row.currency,
});

export const toFinanceTransaction = (
  row: Prisma.FinanceTransactionGetPayload<object>,
): FinanceTransaction => ({
  id: row.id,
  provider: FinanceRecordProviderSchema.parse(row.provider),
  externalId: row.externalId,
  accountExternalId: row.accountExternalId,
  postedAt: row.postedAt.toISOString(),
  purchasedAt: row.purchasedAt?.toISOString() ?? null,
  amountCents: Number(row.amountCents),
  currency: row.currency,
  counterparty: row.counterparty,
  vendorKey: row.vendorKey,
  category: row.category,
  status: row.status as FinanceTransaction["status"],
  kind: row.kind,
  classification: row.classification as FinanceTransaction["classification"],
  cardLastFour: row.cardLastFour,
  cardholder: row.cardholder,
  memo: row.memo,
  hasReceipt: row.hasReceipt,
  dashboardUrl: row.dashboardUrl,
});

export const toFinanceBill = (row: Prisma.FinanceBillGetPayload<object>): FinanceBill => ({
  provider: FinanceProviderSchema.parse(row.provider),
  externalId: row.externalId,
  vendorName: row.vendorName,
  vendorKey: row.vendorKey,
  dueAt: row.dueAt.toISOString(),
  amountCents: Number(row.amountCents),
  status: row.status,
});

// ---- Helpers ----

const DAY_MS = 86_400_000;
const DEFAULT_ROWS = 10;
const MAX_ROWS = 50;
const DEFAULT_TXNS = 50;
const MAX_TXNS = 200;
const MAX_LIST = 30;
/** Rows are dropped from the end until the JSON fits, like the mail tools' result budget. */
const MAX_OUTPUT_CHARS = 20_000;

const dayOf = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (day: string, days: number) =>
  dayOf(new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS));
const txnDay = (t: FinanceTransaction) => (t.purchasedAt ?? t.postedAt).slice(0, 10);
const dollars = (cents: number) => Math.round(cents) / 100;
const isDay = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

type TxnWhere = Prisma.FinanceTransactionWhereInput;

const scopeWhere = (deps: FinanceToolDeps) => ({
  spaceId: deps.scope.spaceId,
  userId: deps.scope.userId,
});
const dayStart = (day: string) => new Date(`${day}T00:00:00Z`);

/** Rows whose counting day (purchasedAt, else postedAt) is in [start, end). */
function dayWhere(start?: string, end?: string): TxnWhere {
  if (!start && !end) return {};
  const bounds = {
    ...(start ? { gte: dayStart(start) } : {}),
    ...(end ? { lt: dayStart(end) } : {}),
  };
  return { OR: [{ purchasedAt: bounds }, { purchasedAt: null, postedAt: bounds }] };
}

async function loadTxns(deps: FinanceToolDeps, start?: string, end?: string) {
  const rows = await deps.prisma.financeTransaction.findMany({
    where: { ...scopeWhere(deps), ...dayWhere(start, end) },
    orderBy: { postedAt: "desc" },
  });
  return rows.map(toFinanceTransaction);
}

async function loadAccounts(deps: FinanceToolDeps) {
  const rows = await deps.prisma.financeAccount.findMany({ where: scopeWhere(deps) });
  return rows.map(toFinanceAccount);
}

/** The earliest day any of the user's transactions counts on, without loading them. */
async function earliestTxnDay(deps: FinanceToolDeps): Promise<string | undefined> {
  const where = scopeWhere(deps);
  const [bought, posted] = await Promise.all([
    deps.prisma.financeTransaction.aggregate({
      where: { ...where, purchasedAt: { not: null } },
      _min: { purchasedAt: true },
    }),
    deps.prisma.financeTransaction.aggregate({
      where: { ...where, purchasedAt: null },
      _min: { postedAt: true },
    }),
  ]);
  const days = [bought._min.purchasedAt, posted._min.postedAt]
    .filter((date): date is Date => Boolean(date))
    .map(dayOf);
  return days.sort()[0];
}

const nowOf = (deps: FinanceToolDeps) => deps.now?.() ?? new Date();

const MAX_CARD_STRING = 80;
const MAX_CARD_CHARS = 4_000;

/** Shortens every string in a card, since names come from provider data. */
const clipStrings = (value: unknown): unknown =>
  typeof value === "string"
    ? value.slice(0, MAX_CARD_STRING)
    : Array.isArray(value)
      ? value.map(clipStrings)
      : value && typeof value === "object"
        ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clipStrings(v)]))
        : value;

async function show(deps: FinanceToolDeps, card: FinanceCard) {
  // A card is a preview; the tool result already holds the data.
  let clipped = clipStrings(card) as FinanceCard;
  while (
    "rows" in clipped &&
    clipped.rows.length > 0 &&
    JSON.stringify(clipped).length > MAX_CARD_CHARS
  ) {
    clipped = { ...clipped, rows: clipped.rows.slice(0, -1) } as FinanceCard;
  }
  await deps.publish?.([{ kind: "finance", card: clipped }]).catch(() => undefined);
}

/** Trims `rows` from the end until the result fits the output budget. */
function withinBudget<T extends Record<string, unknown>>(result: T, key: keyof T): T {
  const rows = result[key];
  if (!Array.isArray(rows)) return result;
  let kept: unknown[] = rows;
  while (kept.length > 0 && JSON.stringify({ ...result, [key]: kept }).length > MAX_OUTPUT_CHARS) {
    kept = kept.slice(0, Math.floor(kept.length * 0.8));
  }
  return kept.length === rows.length ? result : { ...result, [key]: kept, truncated: true };
}

type Range = { start: string; end: string; label: string };

/** "30d" | "90d" | "365d" or {from, to} (inclusive days). Ranges are half-open for the calculations. */
function parseRange(value: unknown, now: Date): Range | { error: string } {
  const today = dayOf(now);
  if (value === undefined || value === null) {
    return { start: addDays(today, -89), end: addDays(today, 1), label: "Last 90 days" };
  }
  if (value === "30d" || value === "90d" || value === "365d") {
    const days = Number.parseInt(value, 10);
    return { start: addDays(today, 1 - days), end: addDays(today, 1), label: `Last ${days} days` };
  }
  const { from, to } = (value ?? {}) as Record<string, unknown>;
  if (typeof value === "object" && isDay(from) && isDay(to) && from <= to) {
    return { start: from, end: addDays(to, 1), label: `${from} to ${to}` };
  }
  return { error: 'range must be "30d", "90d", "365d" or {from, to} as YYYY-MM-DD' };
}

// ---- Activity labels ----

/** A one-line description of a finance tool call for the live activity line, or null for other tools. */
export function describeFinanceActivity(
  name: string,
  args: Record<string, unknown>,
): string | null {
  const rangeText = (value: unknown) => {
    const range = parseRange(value, new Date());
    return "error" in range ? "" : ` · ${range.label.toLowerCase()}`;
  };
  if (name === "finance_overview") return "Looking at cash, burn and runway";
  if (name === "finance_breakdown") {
    return `Reading spend by ${args.by === "vendor" ? "vendor" : "category"}${rangeText(args.range)}`;
  }
  if (name === "finance_transactions") return "Looking through transactions";
  if (name === "finance_recurring") return "Looking at subscriptions";
  if (name === "finance_crypto") return "Looking at crypto holdings";
  return null;
}

// ---- Tools ----

export async function financeToolFromTool(
  name: string,
  deps: FinanceToolDeps,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  try {
    if (name === "finance_overview") return await financeOverview(deps);
    if (name === "finance_breakdown") return await financeBreakdown(deps, args);
    if (name === "finance_transactions") return await financeTransactions(deps, args);
    if (name === "finance_recurring") return await financeRecurring(deps);
    if (name === "finance_crypto") return await financeCrypto(deps);
    return { error: `Unknown finance tool ${name}` };
  } catch {
    return { error: "Finance tool failed" };
  }
}

const COUNTED_CRYPTO: Record<RunwayCryptoScope, string> = {
  bank: "no crypto",
  stablecoins: "stablecoins (USDC, USDT, DAI at their canonical contracts, at synced prices)",
  all: "all priced crypto at current prices",
};

async function financeOverview(deps: FinanceToolDeps) {
  const now = nowOf(deps);
  // The metrics reach back to the start of last year (year-over-year spend) at most.
  const windowStart = `${Number(dayOf(now).slice(0, 4)) - 1}-01-01`;
  const [accounts, txns, since, states, holdingRows, exchangeRows, scope] = await Promise.all([
    loadAccounts(deps),
    loadTxns(deps, windowStart),
    earliestTxnDay(deps),
    deps.prisma.financeSyncState.findMany({
      where: { spaceId: deps.scope.spaceId, userId: deps.scope.userId },
    }),
    deps.prisma.financeCryptoHolding.findMany({ where: scopeWhere(deps) }),
    deps.prisma.financeExchangeBalance.findMany({ where: scopeWhere(deps) }),
    loadRunwayCrypto(deps.prisma, deps.scope),
  ]);
  const crypto = summarizeCrypto(holdingRows.map(toHolding));
  // Exchange balances are classified by asset code (see core exchange.ts) and join the same parts.
  const exchange = exchangeParts(exchangeRows);
  const walletStablecoinCents = crypto.stablecoinCents ?? 0;
  const stablecoinCents = walletStablecoinCents + Number(exchange.stablecoinCents);
  const otherCryptoCents =
    crypto.totalCents - walletStablecoinCents + Number(exchange.otherCryptoCents);
  const bank = cashSummary(accounts, stablecoinCents);
  const cash = {
    ...bank,
    cashCents: countedCash(
      { bankCents: bank.bankCashCents ?? 0, stablecoinCents, otherCryptoCents },
      scope,
    ),
  };
  const burn = monthlyBurn(txns, now);
  const rw = runway(cash.cashCents, burn.monthlyCents, now);
  const bankRunway = runway(cash.bankCashCents ?? 0, burn.monthlyCents, now);
  const totals = (["week", "month", "quarter", "year"] as const).map((period) => {
    const t = spendTotals(txns, period, now, since);
    return {
      period,
      from: t.start,
      previousFrom: t.previousStart,
      previousTo: addDays(t.previousEnd, -1),
      spend: dollars(t.currentCents),
      previous: t.previousCents === null ? null : dollars(t.previousCents),
      changePct: t.changePct,
    };
  });
  const synced = states.map((state) => state.lastSyncedAt);
  const lastSyncedAt =
    synced.length > 0 && synced.every(Boolean)
      ? new Date(Math.min(...synced.map((d) => (d as Date).getTime()))).toISOString()
      : null;
  const statementsDue = await loadStatementReminders(deps.prisma, deps.scope, dayOf(now));
  await show(deps, {
    card: "overview",
    cashCents: cash.cashCents,
    burnCents: burn.monthlyCents,
    runwayMonths: rw.months,
    monthSpendCents: spendTotals(txns, "month", now, since).currentCents,
  });
  return {
    asOf: dayOf(now),
    lastSyncedAt,
    // Accounts fed by uploaded statements whose next monthly statement is overdue.
    ...(statementsDue.length > 0
      ? {
          statementsDue: statementsDue.map((r) => ({ account: r.accountName, monthEnd: r.dueFor })),
        }
      : {}),
    cash: {
      total: dollars(cash.cashCents),
      checking: dollars(cash.checkingCents),
      savings: dollars(cash.savingsCents),
      treasury: dollars(cash.treasuryCents),
      cardOwed: cash.cardOwedCents === null ? null : dollars(cash.cardOwedCents),
      bankOnly: dollars(cash.bankCashCents ?? 0),
      stablecoins: dollars(stablecoinCents),
      otherCrypto: dollars(otherCryptoCents),
      totalInclOtherCrypto: dollars((cash.bankCashCents ?? 0) + stablecoinCents + otherCryptoCents),
      runwayCrypto: scope,
      note: `total and runway are bank cash plus ${COUNTED_CRYPTO[scope]}, as the user chose.`,
    },
    monthlyBurn: dollars(burn.monthlyCents),
    burnMonths: burn.months,
    runwayMonths: rw.months,
    runwayMonthsBankOnly: bankRunway.months,
    runOutDate: rw.runOutDate,
    spend: totals,
  };
}

async function financeBreakdown(deps: FinanceToolDeps, args: Record<string, unknown>) {
  const by = args.by === "vendor" ? "vendor" : args.by === "category" ? "category" : null;
  if (!by) return { error: 'by must be "category" or "vendor"' };
  const range = parseRange(args.range, nowOf(deps));
  if ("error" in range) return range;
  const limit = Math.min(
    MAX_ROWS,
    Math.max(1, typeof args.limit === "number" ? Math.floor(args.limit) : DEFAULT_ROWS),
  );
  const txns = await loadTxns(deps, range.start, range.end);
  const rows = breakdown(txns, by, { start: range.start, end: range.end });
  const totalCents = rows.reduce((sum, row) => sum + row.cents, 0);
  const top = rows.slice(0, limit);
  const rest = rows.slice(limit).reduce((sum, row) => sum + row.cents, 0);
  await show(deps, {
    card: "breakdown",
    by,
    range: range.label,
    totalCents,
    rows: rows.slice(0, 5),
  });
  return withinBudget(
    {
      by,
      range: { from: range.start, to: addDays(range.end, -1), label: range.label },
      total: dollars(totalCents),
      rows: top.map((row) => ({
        name: row.label,
        key: row.key,
        amount: dollars(row.cents),
        sharePct: totalCents > 0 ? Math.round((row.cents / totalCents) * 1000) / 10 : 0,
      })),
      ...(rows.length > limit
        ? { otherCount: rows.length - limit, otherAmount: dollars(rest) }
        : {}),
    },
    "rows",
  );
}

async function financeTransactions(deps: FinanceToolDeps, args: Record<string, unknown>) {
  const from = isDay(args.from) ? args.from : undefined;
  const to = isDay(args.to) ? args.to : undefined;
  const vendor = typeof args.vendor === "string" ? args.vendor.trim().toLowerCase() : "";
  const category = typeof args.category === "string" ? args.category.trim().toLowerCase() : "";
  const minAmountCents =
    typeof args.minAmount === "number" ? Math.round(Math.abs(args.minAmount) * 100) : 0;
  const classification = typeof args.classification === "string" ? args.classification : undefined;
  const limit = Math.min(
    MAX_TXNS,
    Math.max(1, typeof args.limit === "number" ? Math.floor(args.limit) : DEFAULT_TXNS),
  );
  const conditions: TxnWhere[] = [dayWhere(from, to && addDays(to, 1))];
  if (vendor) {
    conditions.push({
      OR: [
        { counterparty: { contains: vendor, mode: "insensitive" } },
        { vendorKey: { contains: vendor } },
      ],
    });
  }
  if (category) {
    const known = await deps.prisma.financeTransaction.findMany({
      where: scopeWhere(deps),
      select: { category: true },
      distinct: ["category"],
    });
    const names = known
      .map((row) => row.category)
      .filter((name): name is string => name !== null)
      .filter((name) => categorySlug(name) === category || name.toLowerCase().includes(category));
    const nullMatches = "uncategorized".includes(category);
    conditions.push({
      OR: [{ category: { in: names } }, ...(nullMatches ? [{ category: null }] : [])],
    });
  }
  if (minAmountCents > 0) {
    conditions.push({
      OR: [
        { amountCents: { gte: BigInt(minAmountCents) } },
        { amountCents: { lte: -BigInt(minAmountCents) } },
      ],
    });
  }
  if (classification) conditions.push({ classification });
  const where: TxnWhere = { ...scopeWhere(deps), AND: conditions };
  // The counting day is purchasedAt, else postedAt: take the newest `limit` of each kind, then merge.
  const newest = (purchased: boolean) =>
    deps.prisma.financeTransaction.findMany({
      where: { ...where, purchasedAt: purchased ? { not: null } : null },
      orderBy: [{ [purchased ? "purchasedAt" : "postedAt"]: "desc" }, { id: "asc" }],
      take: limit,
    });
  // Same rule as the dashboard: USD and not failed or reversed. Other rows are listed but not summed.
  const [boughtRows, postedRows, matchCount, eligible] = await Promise.all([
    newest(true),
    newest(false),
    deps.prisma.financeTransaction.count({ where }),
    deps.prisma.financeTransaction.aggregate({
      where: { ...where, status: { not: "other" }, currency: "USD" },
      _count: { _all: true },
      _sum: { amountCents: true },
    }),
  ]);
  const shown = [...boughtRows, ...postedRows]
    .map(toFinanceTransaction)
    .sort((a, b) => txnDay(b).localeCompare(txnDay(a)) || a.id.localeCompare(b.id))
    .slice(0, limit);
  const eligibleCount = eligible._count._all;
  const totalCents = Number(eligible._sum.amountCents ?? 0n);
  await show(deps, {
    card: "transactions",
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    count: eligibleCount,
    totalCents,
    rows: shown.slice(0, 5).map((t) => ({
      id: t.id,
      day: txnDay(t),
      label: t.counterparty,
      cents: t.amountCents,
    })),
  });
  return withinBudget(
    {
      count: eligibleCount,
      ...(matchCount > eligibleCount ? { excludedCount: matchCount - eligibleCount } : {}),
      total: dollars(totalCents),
      transactions: shown.map((t) => ({
        id: t.id,
        date: txnDay(t),
        vendor: t.counterparty,
        amount: dollars(t.amountCents),
        currency: t.currency,
        ...(countsTowardTotals(t) ? {} : { excludedFromTotal: true }),
        category: t.category,
        status: t.status,
        class: t.classification,
        ...(t.cardLastFour ? { card: t.cardLastFour } : {}),
      })),
    },
    "transactions",
  );
}

async function financeRecurring(deps: FinanceToolDeps) {
  const now = nowOf(deps);
  // ponytail: three years covers monthly and annual rhythms; older annual charges no longer count.
  const [accounts, txns, bills] = await Promise.all([
    loadAccounts(deps),
    loadTxns(deps, addDays(dayOf(now), -1100)),
    deps.prisma.financeBill.findMany({
      where: { spaceId: deps.scope.spaceId, userId: deps.scope.userId },
      orderBy: { dueAt: "asc" },
    }),
  ]);
  const recurring = detectRecurring(txns, now, accounts);
  const subs = subscriptions(recurring);
  const soon = upcoming(
    recurring,
    txns.filter((t) => t.status === "pending"),
    bills.map(toFinanceBill),
    now,
  );
  const byKey = new Map(recurring.map((r) => [r.key, r]));
  await show(deps, {
    card: "recurring",
    monthlyCents: subs.totalMonthlyCents,
    upcomingCents: soon.totalCents,
    rows: subs.items.slice(0, 5).map((s) => ({ key: s.key, label: s.name, cents: s.monthlyCents })),
  });
  return withinBudget(
    withinBudget(
      {
        monthlyTotal: dollars(subs.totalMonthlyCents),
        subscriptions: subs.items.slice(0, MAX_LIST).map((s) => ({
          name: s.name,
          key: s.key,
          monthly: dollars(s.monthlyCents),
          cadence: byKey.get(s.key)?.cadence,
          lastCharge: s.lastChargeAt.slice(0, 10),
          next: byKey.get(s.key)?.nextExpectedAt.slice(0, 10),
          ...(s.overlapGroup ? { overlap: s.overlapGroup } : {}),
        })),
        upcoming30Total: dollars(soon.totalCents),
        upcoming30: soon.items.slice(0, MAX_LIST).map((item) => ({
          name: item.name,
          kind: item.kind,
          dates: item.dates,
          amount: dollars(item.amountCents),
        })),
      },
      "subscriptions",
    ),
    "upcoming30",
  );
}

const MAX_WALLET_HOLDINGS = 20;
const chainName = (id: number) => CRYPTO_CHAINS.find((c) => c.id === id)?.name ?? `Chain ${id}`;

/** raw / 10^decimals as an exact decimal string (BigInt, never a float). */
function tokenAmount(raw: string, decimals: number): string {
  const digits = raw.padStart(decimals + 1, "0");
  const whole = digits.slice(0, digits.length - decimals);
  const fraction = digits.slice(digits.length - decimals).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

function toHolding(row: {
  walletId: string;
  chainId: number;
  tokenAddress: string;
  symbol: string;
  name: string;
  decimals: number;
  rawBalance: string;
  usdPrice: string | null;
  usdValueCents: bigint | null;
  syncedAt: Date;
}) {
  return {
    walletId: row.walletId,
    chainId: row.chainId,
    tokenAddress: row.tokenAddress === "" ? null : row.tokenAddress,
    symbol: row.symbol,
    name: row.name,
    decimals: row.decimals,
    rawBalance: row.rawBalance,
    usdPrice: row.usdPrice,
    usdValueCents: row.usdValueCents === null ? null : Number(row.usdValueCents),
    syncedAt: row.syncedAt.toISOString(),
  };
}

const sumCents = (rows: readonly { usdValueCents: bigint | null }[]) =>
  rows.reduce((total, r) => total + (r.usdValueCents ?? 0n), 0n);

/** Wallet balances at DefiLlama prices. Read-only; what counts as cash and runway is the user's saved choice (see finance_overview). */
async function financeCrypto(deps: FinanceToolDeps) {
  const where = scopeWhere(deps);
  const [walletRows, holdingRows, connections, exchangeBalances] = await Promise.all([
    deps.prisma.financeWallet.findMany({ where, orderBy: { createdAt: "asc" } }),
    deps.prisma.financeCryptoHolding.findMany({ where }),
    deps.prisma.financeExchangeConnection.findMany({ where, orderBy: { createdAt: "asc" } }),
    deps.prisma.financeExchangeBalance.findMany({ where }),
  ]);
  const exchanges = connections.map((c) => {
    const own = exchangeBalances.filter((b) => b.connectionId === c.id);
    return {
      exchange: c.provider,
      totalUsd: dollars(Number(sumCents(own))),
      balances: own
        .sort((a, b) => Number((b.usdValueCents ?? -1n) - (a.usdValueCents ?? -1n)))
        .map((b) => ({
          asset: b.asset,
          amount: b.amount,
          usd: b.usdValueCents === null ? null : dollars(Number(b.usdValueCents)),
        })),
    };
  });
  if (walletRows.length === 0) {
    return exchanges.length
      ? {
          wallets: [],
          exchanges,
          note: "Exchange balances are read-only; usd null means no price.",
        }
      : { wallets: [], note: "No crypto wallets or exchanges are added." };
  }
  const holdings = holdingRows.map(toHolding);
  const summary = summarizeCrypto(holdings);
  const walletCents = new Map(summary.byWallet.map((w) => [w.walletId, w.cents]));
  return withinBudget(
    {
      asOf: dayOf(nowOf(deps)),
      lastSyncedAt: summary.lastSyncedAt,
      totalUsd: dollars(summary.totalCents),
      unpricedTokenCount: summary.unpricedTokenCount,
      byChain: summary.byChain.map((c) => ({
        chain: chainName(c.chainId),
        chainId: c.chainId,
        usd: dollars(c.cents),
      })),
      ...(exchanges.length ? { exchanges } : {}),
      wallets: walletRows.map((wallet) => {
        const own = holdings
          .filter((h) => h.walletId === wallet.id && BigInt(h.rawBalance) > 0n)
          .sort((a, b) => (b.usdValueCents ?? -1) - (a.usdValueCents ?? -1));
        return {
          name: wallet.label ?? wallet.ensName ?? wallet.address,
          address: wallet.address,
          type: wallet.type,
          totalUsd: dollars(walletCents.get(wallet.id) ?? 0),
          holdings: own.slice(0, MAX_WALLET_HOLDINGS).map((h) => ({
            chain: chainName(h.chainId),
            symbol: h.symbol,
            amount: tokenAmount(h.rawBalance, h.decimals),
            usd: h.usdValueCents === null ? null : dollars(h.usdValueCents),
          })),
          ...(own.length > MAX_WALLET_HOLDINGS
            ? { otherHoldings: own.length - MAX_WALLET_HOLDINGS }
            : {}),
        };
      }),
      note: "USD at DefiLlama prices; holdings with usd null have no price and are not in the total. Whether this counts as cash is the user's saved choice (finance_overview cash.runwayCrypto); it never changes burn.",
    },
    "wallets",
  );
}
