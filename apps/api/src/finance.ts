import { ORPCError } from "@orpc/server";
import type { JobPublisher, SecretStore } from "@rakazo/adapter-kit";
import { financeSyncJob } from "@rakazo/adapter-kit";
import type { FinanceSyncDeps, McpOAuthBroker } from "@rakazo/adapters";
import {
  createBrexFinanceSource,
  createMercuryFinanceSource,
  loadRunwayCrypto,
  syncFinanceForUser,
  toFinanceAccount,
  toFinanceBill,
  toFinanceTransaction,
} from "@rakazo/adapters";
import type {
  Actor,
  BalanceRange,
  Bot,
  CryptoBalancePoint,
  FinanceAccount,
  FinanceAccountOutput,
  FinanceAccountsOutput,
  FinanceBurnOutput,
  FinanceCategoryOutput,
  FinanceConnectInput,
  FinanceConnectOutput,
  FinanceMonthOutput,
  FinanceOverview,
  FinancePreferences,
  FinanceReceiptUrlOutput,
  FinanceRecurringOutput,
  FinanceRunwayOutput,
  FinanceSource,
  FinanceSpendInput,
  FinanceSpendOutput,
  FinanceTransaction,
  FinanceTransactionOutput,
  FinanceVendorOutput,
  PaidWithEntry,
  RunwayCryptoScope,
  SpendPeriod,
  TreasuryYieldMonth,
} from "@rakazo/contracts";
import {
  actorScope,
  FINANCE_MCP_ENDPOINTS,
  FinanceProviderSchema,
  financeProviderForEndpoint,
  RunwayCryptoScopeSchema,
} from "@rakazo/contracts";
import {
  accountBalanceHistory,
  averageMonthCents,
  balanceGrid,
  breakdown,
  cashAtDays,
  cashHistory,
  cashSeries,
  cashSummary,
  categorySlug,
  countedCash,
  cryptoHistoryPoints,
  cryptoPartsOn,
  detectRecurring,
  earliestDay,
  excludedNonUsdCount,
  monthlyBurn,
  monthlySeries,
  monthlySpend,
  projectCash,
  runway,
  spendTotals,
  subscriptions,
  upcoming,
} from "@rakazo/core";
import type { createRepos, Prisma, PrismaClient } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import { ensureFinanceAgent, financeAgentWhere } from "./finance-agent.js";
import { loadCryptoSummary, syncCryptoQuietly } from "./finance-crypto.js";
import {
  exchangesDue,
  loadExchangeSnapshotRows,
  syncExchangesQuietly,
} from "./finance-exchange.js";
import type { ParseStatement } from "./finance-statements.js";
import { loadStatementReminders } from "./finance-statements.js";
import { notFound } from "./inbox.js";

export interface FinanceDeps {
  prisma: PrismaClient;
  jobs: JobPublisher;
  repos: Pick<ReturnType<typeof createRepos>, "createBot">;
  /** Tells whether a server holds a working login. */
  mcpOAuth: Pick<McpOAuthBroker, "statusFor">;
  /** The `mcp.oauth.begin` logic (redirect check included), shared with that procedure. */
  beginMcpOAuth(input: {
    serverId: string;
    spaceId: string;
    userId: string;
    redirectUri: string;
    reauthorize?: boolean;
  }): ReturnType<McpOAuthBroker["begin"]>;
  /** Builds the read-tool caller for a server. Unset where finance sync is not wired (tests). */
  callToolFor?: FinanceSyncDeps["callToolFor"];
  /** Stores the optional Blockscout API key like any custom MCP header. */
  secrets: SecretStore;
  /** Crypto sync and ENS lookup, injected from the adapters. Unset where they are not wired (tests). */
  crypto?: FinanceCryptoDeps;
  /** Reads an uploaded bank statement. Unset where the parsers are not wired. */
  parseStatement?: ParseStatement;
  /** Test seam for Coinbase, Kraken and price requests. */
  exchangeFetch?: typeof fetch;
  /** Overrides global fetch for the Alchemy key check (tests). */
  fetch?: typeof fetch;
  now?: () => Date;
}

/** The two crypto adapter calls the handlers need (syncCryptoHoldings and resolveEnsName, read from public EVM RPC). */
export interface FinanceCryptoDeps {
  sync(
    scope: { spaceId: string; userId: string },
    opts: { walletIds?: string[]; force?: boolean; signal?: AbortSignal },
  ): Promise<
    | { ok: true; outcome: "synced" | "skipped"; failedChains: number[] }
    | { ok: false; error: string; message: string }
  >;
  /** A lowercase address, or null when the name does not exist. Throws on transport errors. */
  resolveEns(
    scope: { spaceId: string; userId: string },
    name: string,
    signal?: AbortSignal,
  ): Promise<string | null>;
}

/** A page load starts a background sync when a connected source is older than this. */
const STALE_MS = 15 * 60_000;
const DAY_MS = 86_400_000;
const LIST_LIMIT = 500;

// Every number comes from the pure calculations in @rakazo/core. Handlers load rows (always scoped
// to the actor's space and user), slice them by date and hand them over.

const nowOf = (deps: FinanceDeps) => deps.now?.() ?? new Date();
const dayOf = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (day: string, days: number) =>
  dayOf(new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS));
/** First day of the month `offset` months from `date`'s. */
const monthStartOf = (date: Date, offset = 0) =>
  dayOf(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1)));
const monthOf = (date: Date, offset = 0) => monthStartOf(date, offset).slice(0, 7);
/** The day a transaction counts on: the Brex purchase date, else the posted date. */
const txnDay = (t: FinanceTransaction) => (t.purchasedAt ?? t.postedAt).slice(0, 10);
const inRange = (t: FinanceTransaction, start: string, end: string) =>
  txnDay(t) >= start && txnDay(t) < end;
/** Newest first by the day a transaction counts on, the day every page shows. */
const newest = (txns: FinanceTransaction[], count: number) =>
  [...txns]
    .sort(
      (a, b) =>
        txnDay(b).localeCompare(txnDay(a)) || Date.parse(b.postedAt) - Date.parse(a.postedAt),
    )
    .slice(0, count);
/** The last 90 days including today, as a half-open range. */
const last90 = (now: Date) => ({ start: addDays(dayOf(now), -89), end: addDays(dayOf(now), 1) });
/** Bank cash and the crypto held, before the scope picks what counts. */
const cashParts = (
  accounts: FinanceAccount[],
  crypto: { totalCents: number; stablecoinCents?: number } | null,
) => {
  const stablecoinCents = crypto?.stablecoinCents ?? 0;
  return {
    bankCents: cashSummary(accounts).bankCashCents ?? 0,
    stablecoinCents,
    otherCryptoCents: (crypto?.totalCents ?? 0) - stablecoinCents,
  };
};
/**
 * Cash at each of the last 12 month-ends under `scope`: bank history plus counted crypto (daily
 * snapshots for past months, today's holdings for this one). Without bank accounts bank is zero.
 */
/**
 * A balance chart from the last point before the first transaction (or counted crypto snapshot):
 * earlier points would only repeat the opening balance for months nothing was synced.
 */
function fromFirstData<T>(points: T[], at: (point: T) => string, first: string | null): T[] {
  if (!first) return points;
  return points.slice(Math.max(points.findIndex((p) => at(p) >= first) - 1, 0));
}

/** The first day with data a cash chart shows: transactions, plus crypto snapshots when the scope counts crypto. */
function firstDataDay(
  txns: FinanceTransaction[],
  snapshots: readonly { day: string }[],
  scope: RunwayCryptoScope,
): string | null {
  const days = [earliestDay(txns), ...(scope === "bank" ? [] : snapshots.map((s) => s.day))];
  return days.reduce<string | null>((min, d) => (d && (min === null || d < min) ? d : min), null);
}

function scopedCashHistory(
  accounts: FinanceAccount[],
  txns: FinanceTransaction[],
  now: Date,
  parts: ReturnType<typeof cashParts>,
  snapshots: Parameters<typeof cryptoPartsOn>[0],
  scope: RunwayCryptoScope,
) {
  const currentMonth = monthOf(now);
  const bankByMonth = new Map(
    cashHistory(accounts, txns, now).map((p) => [p.month, p.balanceCents]),
  );
  const points = Array.from({ length: 12 }, (_, i) => monthOf(now, i - 11)).map((month) => ({
    month,
    balanceCents: countedCash(
      {
        ...(month === currentMonth ? parts : cryptoPartsOn(snapshots, monthEndOf(month))),
        bankCents: bankByMonth.get(month) ?? 0,
      },
      scope,
    ),
  }));
  const first = firstDataDay(txns, snapshots, scope);
  return fromFirstData(points, (p) => p.month, first ? first.slice(0, 7) : null);
}
/** Last day of a `YYYY-MM` month. */
const monthEndOf = (month: string) =>
  addDays(monthStartOf(new Date(`${month}-01T00:00:00Z`), 1), -1);
const accountKey = (provider: string, externalId: string) => `${provider}:${externalId}`;

// ---- Loading ----

const toAccount = toFinanceAccount;
const toTransaction = toFinanceTransaction;
const toBill = toFinanceBill;

const toYield = (row: Prisma.FinanceTreasuryYieldGetPayload<object>): TreasuryYieldMonth => ({
  accountExternalId: row.accountExternalId,
  month: row.month,
  dividendsCents: Number(row.dividendsCents),
  feeCents: Number(row.feeCents),
  netCents: Number(row.netCents),
});

async function loadTransactions(deps: FinanceDeps, actor: Actor) {
  const rows = await deps.prisma.financeTransaction.findMany({
    where: actorScope(actor),
    orderBy: { postedAt: "desc" },
  });
  return rows.map(toTransaction);
}

async function loadAccounts(deps: FinanceDeps, actor: Actor) {
  const rows = await deps.prisma.financeAccount.findMany({
    where: actorScope(actor),
    orderBy: [{ kind: "asc" }, { name: "asc" }],
  });
  return rows.map(toAccount);
}

/** Who paid, for a vendor that is not a recurring charge (a recurring one's list comes from the calculation). */
function paidWithFor(txns: FinanceTransaction[], accounts: FinanceAccount[]): PaidWithEntry[] {
  const byKey = new Map(accounts.map((a) => [accountKey(a.provider, a.externalId), a]));
  const paid = new Map<string, PaidWithEntry>();
  for (const t of txns) {
    if (t.provider === "brex") {
      paid.set(`brex:${t.cardLastFour ?? ""}`, {
        provider: "brex",
        kind: "card",
        name: "Brex card",
        lastFour: t.cardLastFour,
      });
      continue;
    }
    const key = accountKey(t.provider, t.accountExternalId);
    const account = byKey.get(key);
    paid.set(key, {
      provider: t.provider,
      kind: "account",
      name: account?.name ?? "Mercury",
      lastFour: account?.lastFour ?? null,
    });
  }
  return [...paid.values()];
}

// ---- Agent, connection, sync ----

/** Idempotent: creates the Finance agent (spawn key `financeAgentSpawnKey(userId)`) and assigns the user's finance servers with FINANCE_READ_TOOLS. */
export async function financeAgent(deps: FinanceDeps, actor: Actor): Promise<Bot> {
  return ensureFinanceAgent(deps, actor);
}

async function financeServers(deps: FinanceDeps, actor: Actor) {
  const rows = await deps.prisma.mcpServer.findMany({
    where: { ...actorScope(actor), enabled: true },
    orderBy: { createdAt: "asc" },
  });
  return rows.flatMap((row) => {
    const provider = financeProviderForEndpoint(row.endpoint);
    return provider ? [{ row, provider }] : [];
  });
}

export async function financeConnect(
  deps: FinanceDeps,
  actor: Actor,
  input: FinanceConnectInput,
): Promise<FinanceConnectOutput> {
  // A disabled server is reused (and turned back on), not left to block the fixed slug.
  const forProvider = async () => {
    const rows = await deps.prisma.mcpServer.findMany({
      where: actorScope(actor),
      orderBy: { createdAt: "asc" },
    });
    const own = rows.filter((r) => financeProviderForEndpoint(r.endpoint) === input.provider);
    return own.find((r) => r.enabled) ?? own[0];
  };
  const existing = await forProvider();
  if (existing && !existing.enabled) {
    await deps.prisma.mcpServer.update({
      where: { id: existing.id },
      data: { enabled: true, revision: { increment: 1 } },
    });
  }
  const server =
    existing ??
    (await deps.prisma.mcpServer
      .create({
        data: {
          ...actorScope(actor),
          slug: `finance-${input.provider}`,
          name: input.provider === "mercury" ? "Mercury" : "Brex",
          transport: "streamable_http",
          endpoint: FINANCE_MCP_ENDPOINTS[input.provider],
          enabled: true,
        },
      })
      // A concurrent connect may have created it first; use that one.
      .catch(async (error: unknown) => {
        const raced = await forProvider();
        if (!raced) throw error;
        return raced;
      }));
  // Connecting a bank creates the Finance agent (or gives the new server to the existing one, read
  // tools only). Without it Chief has no teammate to hand finance questions to and says it has no cash figure.
  await ensureFinanceAgent(deps, actor);
  // A stored token the vendor refused would otherwise be reused and the sign-in never asked for.
  const state = await deps.prisma.financeSyncState.findFirst({
    where: { mcpServerId: server.id, ...actorScope(actor) },
    select: { needsReconnect: true },
  });
  const reauthorize =
    input.reconnect === true ||
    state?.needsReconnect === true ||
    (await deps.mcpOAuth.statusFor(server, actor)) === "reconnect";
  try {
    const begun = await deps.beginMcpOAuth({
      serverId: server.id,
      ...actorScope(actor),
      redirectUri: input.redirectUri,
      ...(reauthorize ? { reauthorize: true } : {}),
    });
    return { ...begun, serverId: server.id };
  } catch (error) {
    // The vendor's raw error (hosts, emulator details) is for the log, not the founder.
    getLogger().warn("finance connect could not start sign-in", {
      provider: input.provider,
      error: error instanceof Error ? error.message : String(error),
    });
    const name = input.provider === "mercury" ? "Mercury" : "Brex";
    throw new ORPCError("BAD_REQUEST", {
      message: `Could not connect to ${name}. Try again, or upload a statement instead.`,
    });
  }
}

/** Syncs now (the 15-minute throttle does not apply to an explicit refresh; the claim still does). */
export async function financeRefresh(
  deps: FinanceDeps,
  actor: Actor,
  signal?: AbortSignal,
): Promise<{ ok: true }> {
  if (!deps.callToolFor) {
    throw new ORPCError("SERVICE_UNAVAILABLE", { message: "Finance sync is not available" });
  }
  await syncFinanceForUser(
    { prisma: deps.prisma, callToolFor: deps.callToolFor, now: deps.now },
    actorScope(actor),
    { force: true, signal },
  );
  await syncCryptoQuietly(deps, actor, { signal });
  await syncExchangesQuietly(deps, actor, signal);
  return { ok: true };
}

// ---- Overview ----

/** Each provider's connection status, and whether a connected one is due for a background sync. */
async function financeSources(deps: FinanceDeps, actor: Actor, now: Date) {
  const servers = await financeServers(deps, actor);
  const states = await deps.prisma.financeSyncState.findMany({ where: actorScope(actor) });
  const stateOf = new Map(states.map((s) => [s.mcpServerId, s]));
  const sources: FinanceSource[] = [];
  const syncedAt: (Date | null)[] = [];
  let syncDue = false;
  for (const provider of FinanceProviderSchema.options) {
    const found = servers.find((s) => s.provider === provider);
    if (!found) {
      sources.push({ provider, serverId: null, status: "not_connected", lastSyncedAt: null });
      continue;
    }
    const state = stateOf.get(found.row.id);
    const login = await deps.mcpOAuth.statusFor(found.row, actor);
    const synced = state?.lastSyncedAt ?? null;
    let status: FinanceSource["status"] = "ok";
    if (login === "none") status = "not_connected";
    else if (login === "reconnect" || state?.needsReconnect) status = "needs_reconnect";
    else if (state?.lastErrorAt && (!synced || state.lastErrorAt > synced)) status = "error";
    sources.push({
      provider,
      serverId: found.row.id,
      status,
      lastSyncedAt: synced?.toISOString() ?? null,
    });
    if (status !== "ok" && status !== "error") continue;
    syncedAt.push(synced);
    const old = !synced || now.getTime() - synced.getTime() > STALE_MS;
    // A source that just failed is not retried on every page load.
    const failedRecently =
      state?.lastErrorAt && now.getTime() - state.lastErrorAt.getTime() < STALE_MS;
    if (old && !failedRecently) syncDue = true;
  }
  const oldest = syncedAt.every((d) => d !== null)
    ? syncedAt.reduce<Date | null>((min, d) => (!min || (d && d < min) ? d : min), null)
    : null;
  return { sources, syncDue, lastSyncedAt: oldest?.toISOString() ?? null };
}

export async function financeOverview(
  deps: FinanceDeps,
  actor: Actor,
  signal?: AbortSignal,
): Promise<FinanceOverview> {
  signal?.throwIfAborted();
  const now = nowOf(deps);
  const [{ sources, syncDue, lastSyncedAt }, accounts, txns, bills, yields, agent, crypto] =
    await Promise.all([
      financeSources(deps, actor, now),
      loadAccounts(deps, actor),
      loadTransactions(deps, actor),
      deps.prisma.financeBill.findMany({ where: actorScope(actor), orderBy: { dueAt: "asc" } }),
      deps.prisma.financeTreasuryYield.findMany({ where: actorScope(actor) }),
      deps.prisma.bot.findFirst({
        where: financeAgentWhere(actor),
        select: { id: true, name: true },
      }),
      loadCryptoSummary(deps, actor),
    ]);
  if (syncDue || (await exchangesDue(deps, actor))) {
    // The job key merges repeats; a lost enqueue only delays the sync until the next page load.
    await deps.jobs.enqueue(financeSyncJob(actor.userId, actor.spaceId)).catch((error) => {
      getLogger().warn("finance sync enqueue failed", {
        reason: error instanceof Error ? error.name : "error",
      });
    });
  }

  const scope = await loadRunwayCrypto(deps.prisma, actor);
  const parts = cashParts(accounts, crypto);
  // `stablecoinCents` and `otherCryptoCents` are the crypto counted in `cashCents` under the saved
  // scope (zero when it does not count), so cashCents = bankCashCents + stablecoinCents + otherCryptoCents.
  const counted = {
    stablecoinCents: scope === "bank" ? 0 : parts.stablecoinCents,
    otherCryptoCents: scope === "all" ? parts.otherCryptoCents : 0,
  };
  const cash = {
    ...cashSummary(accounts, counted.stablecoinCents),
    cashCents: countedCash(parts, scope),
    ...counted,
  };
  const hasCashAccounts = accounts.some((a) => a.kind !== "card");
  const burn = monthlyBurn(txns, now);
  const since = earliestDay(txns);
  const range = last90(now);
  const recurring = detectRecurring(txns, now, accounts);
  const totals = {
    week: spendTotals(txns, "week", now, since),
    month: spendTotals(txns, "month", now, since),
    quarter: spendTotals(txns, "quarter", now, since),
    year: spendTotals(txns, "year", now, since),
  };
  const breakdownOver = (r: { start: string; end: string }) => ({
    category: breakdown(txns, "category", r),
    vendor: breakdown(txns, "vendor", r),
  });
  const lastMonth = monthOf(now, -1);
  const lastMonthYields = yields.filter((y) => y.month === lastMonth);
  const statementReminders = await loadStatementReminders(deps, actor, dayOf(now));
  return {
    sources,
    agent: agent ? { botId: agent.id, name: agent.name } : null,
    cash,
    hasCashAccounts,
    burn,
    // No cash account (for example Brex only) means no runway, not a runway of zero.
    runway: hasCashAccounts
      ? runway(cash.cashCents, burn.monthlyCents, now)
      : { months: null, runOutDate: null },
    bankRunway: hasCashAccounts
      ? runway(cash.bankCashCents ?? 0, burn.monthlyCents, now)
      : { months: null, runOutDate: null },
    spendTotals: totals,
    // The tab sets the bucket size: weeks, months, quarters, years, each over a recent lookback.
    cashSeries: {
      week: cashSeries(txns, { granularity: "week", buckets: 12, now }),
      month: cashSeries(txns, { granularity: "month", buckets: 12, now }),
      quarter: cashSeries(txns, { granularity: "quarter", buckets: 8, now }),
      // Every year with data, and at least two so a line has something to connect.
      year: cashSeries(txns, {
        granularity: "year",
        buckets: Math.max(2, since ? now.getUTCFullYear() - Number(since.slice(0, 4)) + 1 : 0),
        now,
      }),
    },
    breakdown: breakdownOver(range),
    breakdownByPeriod: {
      week: breakdownOver(totals.week),
      month: breakdownOver(totals.month),
      quarter: breakdownOver(totals.quarter),
      year: breakdownOver(totals.year),
    },
    upcoming: upcoming(
      recurring,
      txns.filter((t) => t.status === "pending"),
      bills.map(toBill),
      now,
    ),
    subscriptions: subscriptions(recurring),
    // Null until a Treasury account has a yield row for last month, rather than a zero that may only mean "not posted yet".
    treasuryYieldLastMonth:
      accounts.some((a) => a.kind === "treasury") && lastMonthYields.length > 0
        ? {
            month: lastMonth,
            netCents: lastMonthYields.reduce((total, y) => total + Number(y.netCents), 0),
          }
        : null,
    lastSyncedAt,
    excludedNonUsdCount: excludedNonUsdCount(txns),
    // Its own card. What counts as cash follows the saved scope.
    crypto,
    ...(statementReminders.length > 0 ? { statementReminders } : {}),
  };
}

// ---- Detail pages ----

/** The last 3 full months' net yield, times 4, as a percent of the balance; null without data. */
function annualYieldPct(
  account: FinanceAccount,
  yields: TreasuryYieldMonth[],
  now: Date,
): number | null {
  if (account.kind !== "treasury" || account.balanceCents <= 0) return null;
  const months = new Set([-1, -2, -3].map((offset) => monthOf(now, offset)));
  const own = yields.filter(
    (y) => y.accountExternalId === account.externalId && months.has(y.month),
  );
  if (own.length === 0) return null;
  const net = own.reduce((total, y) => total + y.netCents, 0);
  return Math.round(((net * 4) / account.balanceCents) * 10_000) / 100;
}

export async function financeAccounts(
  deps: FinanceDeps,
  actor: Actor,
): Promise<FinanceAccountsOutput> {
  const now = nowOf(deps);
  const [accounts, txns, yieldRows, crypto, scope, snapshots] = await Promise.all([
    loadAccounts(deps, actor),
    loadTransactions(deps, actor),
    deps.prisma.financeTreasuryYield.findMany({ where: actorScope(actor) }),
    loadCryptoSummary(deps, actor),
    loadRunwayCrypto(deps.prisma, actor),
    loadSnapshots(deps, actor),
  ]);
  const yields = yieldRows.map(toYield);
  const parts = cashParts(accounts, crypto);
  const summary = { ...cashSummary(accounts), cashCents: countedCash(parts, scope) };
  const row = (account: FinanceAccount) => ({
    ...account,
    annualYieldPct: annualYieldPct(account, yields, now),
  });
  return {
    totalCashCents: summary.cashCents,
    cardOwedCents: summary.cardOwedCents,
    history: scopedCashHistory(accounts, txns, now, parts, snapshots, scope),
    cash: accounts.filter((a) => a.kind !== "card").map(row),
    cards: accounts.filter((a) => a.kind === "card").map(row),
  };
}

export async function financeAccountDetail(
  deps: FinanceDeps,
  actor: Actor,
  input: { id: string },
): Promise<FinanceAccountOutput> {
  const now = nowOf(deps);
  const found = await deps.prisma.financeAccount.findFirst({
    where: { id: input.id, ...actorScope(actor) },
  });
  if (!found) throw notFound();
  const account = toAccount(found);
  const own = {
    ...actorScope(actor),
    mcpServerId: found.mcpServerId,
    accountExternalId: account.externalId,
  };
  const [txnRows, yieldRows] = await Promise.all([
    deps.prisma.financeTransaction.findMany({ where: own, orderBy: { postedAt: "desc" } }),
    // Statement accounts have no server and no Treasury yield.
    account.kind === "treasury" && found.mcpServerId
      ? deps.prisma.financeTreasuryYield.findMany({
          where: { ...own, mcpServerId: found.mcpServerId },
          orderBy: { month: "desc" },
        })
      : [],
  ]);
  const txns = txnRows.map(toTransaction);
  const treasuryYield = yieldRows.map(toYield);
  return {
    account: { ...account, annualYieldPct: annualYieldPct(account, treasuryYield, now) },
    history: accountBalanceHistory(account, txns, now),
    treasuryYield,
    transactions: newest(txns, 20),
  };
}

export async function financeBurn(deps: FinanceDeps, actor: Actor): Promise<FinanceBurnOutput> {
  const now = nowOf(deps);
  const [accounts, txns] = await Promise.all([
    loadAccounts(deps, actor),
    loadTransactions(deps, actor),
  ]);
  const burn = monthlyBurn(txns, now);
  const first = burn.months[0];
  const last = burn.months[burn.months.length - 1];
  const window =
    first && last
      ? { start: `${first}-01`, end: monthStartOf(new Date(`${last}-01T00:00:00Z`), 1) }
      : null;
  const byExternalId = new Map(accounts.map((a) => [a.externalId, a]));
  const accountRows = window ? breakdown(txns, "account", window) : [];
  return {
    monthlyCents: burn.monthlyCents,
    series: monthlySeries(txns, now),
    windowMonths: burn.months,
    whereItWent: window ? breakdown(txns, "category", window) : [],
    // Spend on an account that is no longer synced has no account to show, so it is left out here.
    byAccount: accountRows.flatMap((row) => {
      const account = byExternalId.get(row.key);
      return account ? [{ account, cents: row.cents }] : [];
    }),
    // Brex expenses sit on synthetic per-type ids (`brex-card`, ...), not on an account row.
    brexCents: accountRows
      .filter((row) => !byExternalId.has(row.key) && row.key.startsWith("brex-"))
      .reduce((sum, row) => sum + row.cents, 0),
  };
}

export async function financeMonth(
  deps: FinanceDeps,
  actor: Actor,
  input: { month: string },
): Promise<FinanceMonthOutput> {
  const now = nowOf(deps);
  const txns = await loadTransactions(deps, actor);
  // The page opens from the 12-month chart, so a month outside the chart does not exist.
  const point = monthlySeries(txns, now).find((p) => p.month === input.month);
  if (!point) throw notFound();
  const start = `${input.month}-01`;
  const end = monthStartOf(new Date(`${start}T00:00:00Z`), 1);
  const inCents = point.revenueCents + point.financingCents;
  return {
    month: input.month,
    partial: point.partial,
    outCents: point.outCents,
    inCents,
    netCents: inCents - point.outCents,
    categories: breakdown(txns, "category", { start, end }),
    transactions: newest(
      txns.filter(
        (t) =>
          inRange(t, start, end) &&
          t.classification !== "internal_transfer" &&
          t.classification !== "card_payment",
      ),
      LIST_LIMIT,
    ),
  };
}

/** The Finance page's runway in months (null without a cash account or burn), without the rest of the overview. */
export async function financeRunwayMonths(deps: FinanceDeps, actor: Actor): Promise<number | null> {
  const now = nowOf(deps);
  // monthlyBurn averages the three calendar months before this one, so only those rows are read.
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 3, 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const inWindow = { gte: from, lt: to };
  const [accounts, rows, crypto, scope] = await Promise.all([
    loadAccounts(deps, actor),
    deps.prisma.financeTransaction.findMany({
      where: {
        ...actorScope(actor),
        classification: { in: ["spend", "revenue"] },
        OR: [{ purchasedAt: inWindow }, { purchasedAt: null, postedAt: inWindow }],
      },
      select: {
        postedAt: true,
        purchasedAt: true,
        amountCents: true,
        currency: true,
        status: true,
        classification: true,
      },
    }),
    loadCryptoSummary(deps, actor),
    loadRunwayCrypto(deps.prisma, actor),
  ]);
  if (!accounts.some((a) => a.kind !== "card")) return null;
  // Only the fields the burn calculation reads.
  const txns = rows.map((row) => ({
    postedAt: row.postedAt.toISOString(),
    purchasedAt: row.purchasedAt?.toISOString() ?? null,
    amountCents: Number(row.amountCents),
    currency: row.currency,
    status: row.status,
    classification: row.classification,
  })) as FinanceTransaction[];
  const cashCents = countedCash(cashParts(accounts, crypto), scope);
  return runway(cashCents, monthlyBurn(txns, now).monthlyCents, now).months;
}

export async function financeRunway(deps: FinanceDeps, actor: Actor): Promise<FinanceRunwayOutput> {
  const now = nowOf(deps);
  const [accounts, txns, crypto, scope, snapshots] = await Promise.all([
    loadAccounts(deps, actor),
    loadTransactions(deps, actor),
    loadCryptoSummary(deps, actor),
    loadRunwayCrypto(deps.prisma, actor),
    loadSnapshots(deps, actor),
  ]);
  const parts = cashParts(accounts, crypto);
  const cashCents = countedCash(parts, scope);
  const { monthlyCents } = monthlyBurn(txns, now);
  return {
    runwayCrypto: scope,
    cashCents,
    breakdown: {
      bankCents: parts.bankCents,
      stablecoinCents: parts.stablecoinCents,
      otherCryptoCents: parts.otherCryptoCents,
    },
    monthlyBurnCents: monthlyCents,
    runway: runway(cashCents, monthlyCents, now),
    history: scopedCashHistory(accounts, txns, now, parts, snapshots, scope),
    projection: projectCash(cashCents, monthlyCents, now),
  };
}

/** Total cash on each day of the range's grid: bank at that day's end plus crypto counted under the saved scope. */
export async function financeBalanceSeries(
  deps: FinanceDeps,
  actor: Actor,
  input: { range: BalanceRange },
): Promise<{ range: BalanceRange; points: { day: string; balanceCents: number }[] }> {
  const now = nowOf(deps);
  const [accounts, txns, crypto, scope, snapshots] = await Promise.all([
    loadAccounts(deps, actor),
    loadTransactions(deps, actor),
    loadCryptoSummary(deps, actor),
    loadRunwayCrypto(deps.prisma, actor),
    loadSnapshots(deps, actor),
  ]);
  const parts = cashParts(accounts, crypto);
  const today = dayOf(now);
  const days = balanceGrid(input.range, now);
  const bank = cashAtDays(accounts, txns, days, now);
  const points = days.map((day, i) => ({
    day,
    balanceCents: countedCash(
      { ...(day === today ? parts : cryptoPartsOn(snapshots, day)), bankCents: bank[i] ?? 0 },
      scope,
    ),
  }));
  return {
    range: input.range,
    points: fromFirstData(points, (p) => p.day, firstDataDay(txns, snapshots, scope)),
  };
}

async function loadSnapshots(deps: FinanceDeps, actor: Actor, walletId?: string) {
  const rows = await deps.prisma.financeCryptoSnapshot.findMany({
    where: { ...actorScope(actor), ...(walletId ? { walletId } : {}) },
  });
  // ponytail: reads every snapshot (wallets x days); bound by a day window if it grows large.
  const wallets = rows.map((r) => ({
    walletId: r.walletId,
    day: r.day,
    stablecoinCents: Number(r.stablecoinCents),
    otherCryptoCents: Number(r.otherCryptoCents),
  }));
  // Exchange connections are sources like wallets; a wallet filter excludes them.
  return walletId ? wallets : [...wallets, ...(await loadExchangeSnapshotRows(deps, actor))];
}

export async function financeCryptoHistory(
  deps: FinanceDeps,
  actor: Actor,
  input: { days: number; walletId?: string },
): Promise<{ points: CryptoBalancePoint[] }> {
  if (input.walletId) {
    const wallet = await deps.prisma.financeWallet.findFirst({
      where: { id: input.walletId, ...actorScope(actor) },
      select: { id: true },
    });
    if (!wallet) throw notFound();
  }
  const today = dayOf(nowOf(deps));
  const rows = await loadSnapshots(deps, actor, input.walletId);
  return { points: cryptoHistoryPoints(rows, addDays(today, 1 - input.days), today) };
}

export async function financePreferences(
  deps: FinanceDeps,
  actor: Actor,
): Promise<FinancePreferences> {
  return { runwayCrypto: await loadRunwayCrypto(deps.prisma, actor) };
}

export async function financeSetPreferences(
  deps: FinanceDeps,
  actor: Actor,
  input: FinancePreferences,
): Promise<FinancePreferences> {
  const row = await deps.prisma.financePreference.upsert({
    where: { spaceId_userId: actorScope(actor) },
    create: { ...actorScope(actor), runwayCrypto: input.runwayCrypto },
    update: { runwayCrypto: input.runwayCrypto },
  });
  return { runwayCrypto: RunwayCryptoScopeSchema.parse(row.runwayCrypto) };
}

export async function financeSpend(
  deps: FinanceDeps,
  actor: Actor,
  input: FinanceSpendInput,
): Promise<FinanceSpendOutput> {
  const all = await loadTransactions(deps, actor);
  const txns = input.source ? all.filter((t) => t.provider === input.source) : all;
  const totals = spendTotals(txns, input.period, nowOf(deps), earliestDay(txns));
  const customRange =
    input.from !== undefined && input.to !== undefined && input.from <= input.to
      ? { from: input.from, to: input.to }
      : null;
  // The range is inclusive of `to`; the helpers take a half-open end.
  const start = customRange?.from ?? totals.start;
  const end = customRange ? addDays(customRange.to, 1) : totals.end;
  const categories = breakdown(txns, "category", { start, end });
  const category = input.category ?? null;
  return {
    period: input.period,
    range: customRange,
    start,
    end,
    category,
    totalCents: category
      ? (categories.find((row) => row.key === category)?.cents ?? 0)
      : customRange
        ? categories.reduce((sum, row) => sum + row.cents, 0)
        : totals.currentCents,
    categories,
    transactions: newest(
      txns.filter(
        (t) =>
          t.classification === "spend" &&
          inRange(t, start, end) &&
          (!category || categorySlug(t.category) === category),
      ),
      LIST_LIMIT,
    ),
  };
}

export async function financeCategory(
  deps: FinanceDeps,
  actor: Actor,
  input: { slug: string; period?: SpendPeriod; month?: string },
): Promise<FinanceCategoryOutput> {
  const now = nowOf(deps);
  const own = (await loadTransactions(deps, actor)).filter(
    (t) => t.classification === "spend" && categorySlug(t.category) === input.slug,
  );
  const first = own[0];
  if (!first) throw notFound();
  // The window the page was opened from, so its total matches the row that was clicked; the
  // vendor list and the transactions cover that same window.
  const range = input.month
    ? { start: `${input.month}-01`, end: monthStartOf(new Date(`${input.month}-01T00:00:00Z`), 1) }
    : input.period
      ? spendTotals(own, input.period, now)
      : last90(now);
  const inRange = own.filter((t) => txnDay(t) >= range.start && txnDay(t) < range.end);
  return {
    slug: input.slug,
    label: first.category?.trim() || "Uncategorized",
    last90Cents: breakdown(own, "category", range)[0]?.cents ?? 0,
    start: range.start,
    end: range.end,
    trend: monthlySpend(own, { categorySlug: input.slug }, now, 12),
    vendors: breakdown(own, "vendor", range),
    recent: newest(inRange, 100),
  };
}

export async function financeRecurring(
  deps: FinanceDeps,
  actor: Actor,
  input: { key: string },
): Promise<FinanceRecurringOutput> {
  const [accounts, txns] = await Promise.all([
    loadAccounts(deps, actor),
    loadTransactions(deps, actor),
  ]);
  const recurring = detectRecurring(txns, nowOf(deps), accounts).find((r) => r.key === input.key);
  if (!recurring) throw notFound();
  return {
    recurring,
    pastCharges: newest(
      txns.filter(
        (t) => t.vendorKey === input.key && t.classification === recurring.classification,
      ),
      6,
    ),
  };
}

export async function financeVendor(
  deps: FinanceDeps,
  actor: Actor,
  input: { key: string },
): Promise<FinanceVendorOutput> {
  const now = nowOf(deps);
  const [accounts, all] = await Promise.all([
    loadAccounts(deps, actor),
    loadTransactions(deps, actor),
  ]);
  const own = all.filter(
    (t) =>
      t.vendorKey === input.key &&
      (t.classification === "spend" || t.classification === "card_payment"),
  );
  const latest = newest(own, 1)[0];
  if (!latest) throw notFound();
  const recurring = detectRecurring(all, now, accounts);
  // Six full months, then the current partial one. The average, the change and the chart use the
  // full months only, so the chart shows exactly what is averaged; charges list from the same start.
  const seven = monthlySpend(own, { vendorKey: input.key }, now, 7);
  const full = seven.slice(0, 6);
  const lastFull = full[5]?.cents ?? 0;
  const sixMonthsFrom = `${full[0]?.month ?? monthOf(now, -6)}-01`;
  const firstSeenAt = own.reduce(
    (min, t) => ((t.purchasedAt ?? t.postedAt) < min ? (t.purchasedAt ?? t.postedAt) : min),
    latest.purchasedAt ?? latest.postedAt,
  );
  // Months before the vendor first charged are not months of zero spend.
  const firstMonth = firstSeenAt.slice(0, 7);
  const average = averageMonthCents(full, firstSeenAt);
  // A subscription shows the figure its row in the list shows.
  const listed = recurring.find((r) => r.key === input.key);
  // The change compares the last full month with 3 months before it, or with the vendor's first
  // full month when it is newer. A month that starts before the first synced data is incomplete.
  const earliest = earliestDay(all) ?? "";
  const base = full
    .slice(2, 5)
    .find((m) => m.month >= firstMonth && `${m.month}-01` >= earliest && m.cents > 0);
  return {
    key: input.key,
    name: latest.counterparty,
    isSubscription: subscriptions(recurring).items.some((s) => s.key === input.key),
    monthlyAvgCents: listed ? listed.monthlyCents : average.cents,
    monthlyAvgMonths: listed ? listed.windowMonths : average.months,
    ...(listed && listed.windowMonths === undefined ? { monthlyUsual: true } : {}),
    changePct: lastFull && base ? Math.round(((lastFull - base.cents) / base.cents) * 100) : null,
    changeFromMonth: lastFull && base ? base.month : null,
    firstSeenAt,
    paidWith: recurring.find((r) => r.key === input.key)?.paidWith ?? paidWithFor(own, accounts),
    monthly: full,
    charges: newest(
      own.filter((t) => txnDay(t) >= sixMonthsFrom),
      LIST_LIMIT,
    ),
  };
}

export async function financeTransaction(
  deps: FinanceDeps,
  actor: Actor,
  input: { id: string },
): Promise<FinanceTransactionOutput> {
  const row = await deps.prisma.financeTransaction.findFirst({
    where: { id: input.id, ...actorScope(actor) },
  });
  if (!row) throw notFound();
  const transaction = toTransaction(row);
  const [accounts, all] = await Promise.all([
    loadAccounts(deps, actor),
    loadTransactions(deps, actor),
  ]);
  return {
    transaction,
    vendorName: transaction.counterparty,
    account:
      accounts.find(
        (a) =>
          a.provider === transaction.provider && a.externalId === transaction.accountExternalId,
      ) ?? null,
    vendorIsSubscription: subscriptions(detectRecurring(all, nowOf(deps), accounts)).items.some(
      (s) => s.key === transaction.vendorKey,
    ),
  };
}

/** Fetches a fresh vendor link on demand through the transaction's source; NOT_FOUND when there is no receipt. */
export async function financeReceiptUrl(
  deps: FinanceDeps,
  actor: Actor,
  input: { transactionId: string },
  signal?: AbortSignal,
): Promise<FinanceReceiptUrlOutput> {
  const row = await deps.prisma.financeTransaction.findFirst({
    where: { id: input.transactionId, ...actorScope(actor) },
  });
  // Mercury's listing never says whether a row has attachments, so only the vendor lookup can tell.
  if (!row?.mcpServerId || (!row.hasReceipt && row.provider !== "mercury")) throw notFound();
  const server = await deps.prisma.mcpServer.findFirst({
    where: { id: row.mcpServerId, ...actorScope(actor), enabled: true },
  });
  const provider = financeProviderForEndpoint(server?.endpoint);
  if (!server?.endpoint || !provider) throw notFound();
  if (!deps.callToolFor) {
    throw new ORPCError("SERVICE_UNAVAILABLE", { message: "Receipts are not available" });
  }
  try {
    const callTool = await deps.callToolFor(
      { id: server.id, provider, endpoint: server.endpoint },
      signal ?? new AbortController().signal,
    );
    const source =
      provider === "mercury"
        ? createMercuryFinanceSource(callTool)
        : createBrexFinanceSource(callTool);
    const link = await source.receiptUrl(row.externalId);
    if (link) return { url: link.url, mimeType: link.mimeType };
  } catch (error) {
    getLogger().warn("finance receipt fetch failed", {
      reason: error instanceof Error ? error.name : "error",
    });
    throw new ORPCError("BAD_GATEWAY", { message: "Could not fetch the receipt" });
  }
  throw notFound();
}
