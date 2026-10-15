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
  TreasuryYieldMonth,
} from "@rakazo/contracts";
import {
  FINANCE_MCP_ENDPOINTS,
  FinanceProviderSchema,
  financeAgentSpawnKey,
  financeProviderForEndpoint,
  RunwayCryptoScopeSchema,
} from "@rakazo/contracts";
import {
  balanceHistory,
  breakdown,
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
import { assignFinanceServers, ensureFinanceAgent } from "./finance-agent.js";
import { loadCryptoSummary, syncCryptoQuietly } from "./finance-crypto.js";
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

const scopeOf = (actor: Actor) => ({ spaceId: actor.spaceId, userId: actor.userId });
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
const newest = (txns: FinanceTransaction[], count: number) =>
  [...txns].sort((a, b) => Date.parse(b.postedAt) - Date.parse(a.postedAt)).slice(0, count);
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
  return Array.from({ length: 12 }, (_, i) => monthOf(now, i - 11)).map((month) => ({
    month,
    balanceCents: countedCash(
      {
        ...(month === currentMonth ? parts : cryptoPartsOn(snapshots, monthEndOf(month))),
        bankCents: bankByMonth.get(month) ?? 0,
      },
      scope,
    ),
  }));
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
    where: scopeOf(actor),
    orderBy: { postedAt: "desc" },
  });
  return rows.map(toTransaction);
}

async function loadAccounts(deps: FinanceDeps, actor: Actor) {
  const rows = await deps.prisma.financeAccount.findMany({
    where: scopeOf(actor),
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
    where: { ...scopeOf(actor), enabled: true },
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
      where: scopeOf(actor),
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
          ...scopeOf(actor),
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
  // An agent that already exists gets the new server, with read tools only, without waiting for the panel.
  const bot = await deps.prisma.bot.findFirst({
    where: { ...scopeOf(actor), spawnKey: financeAgentSpawnKey(actor.userId), archivedAt: null },
    select: { id: true },
  });
  if (bot) await assignFinanceServers(deps.prisma, actor, bot.id);
  // A stored token the vendor refused would otherwise be reused and the sign-in never asked for.
  const state = await deps.prisma.financeSyncState.findFirst({
    where: { mcpServerId: server.id, ...scopeOf(actor) },
    select: { needsReconnect: true },
  });
  const reauthorize =
    input.reconnect === true ||
    state?.needsReconnect === true ||
    (await deps.mcpOAuth.statusFor(server, actor)) === "reconnect";
  try {
    const begun = await deps.beginMcpOAuth({
      serverId: server.id,
      ...scopeOf(actor),
      redirectUri: input.redirectUri,
      ...(reauthorize ? { reauthorize: true } : {}),
    });
    return { ...begun, serverId: server.id };
  } catch (error) {
    throw new ORPCError("BAD_REQUEST", {
      message: error instanceof Error ? error.message : "Could not start sign-in",
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
    scopeOf(actor),
    { force: true, signal },
  );
  await syncCryptoQuietly(deps, actor, { signal });
  return { ok: true };
}

// ---- Overview ----

/** Each provider's connection status, and whether a connected one is due for a background sync. */
async function financeSources(deps: FinanceDeps, actor: Actor, now: Date) {
  const servers = await financeServers(deps, actor);
  const states = await deps.prisma.financeSyncState.findMany({ where: scopeOf(actor) });
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
      deps.prisma.financeBill.findMany({ where: scopeOf(actor), orderBy: { dueAt: "asc" } }),
      deps.prisma.financeTreasuryYield.findMany({ where: scopeOf(actor) }),
      deps.prisma.bot.findFirst({
        where: {
          ...scopeOf(actor),
          spawnKey: financeAgentSpawnKey(actor.userId),
          archivedAt: null,
        },
        select: { id: true, name: true },
      }),
      loadCryptoSummary(deps, actor),
    ]);
  if (syncDue) {
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
  const lastMonth = monthOf(now, -1);
  const lastMonthYields = yields.filter((y) => y.month === lastMonth);
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
    spendTotals: {
      week: spendTotals(txns, "week", now, since),
      month: spendTotals(txns, "month", now, since),
      quarter: spendTotals(txns, "quarter", now, since),
      year: spendTotals(txns, "year", now, since),
    },
    cashSeries: {
      week: cashSeries(txns, { granularity: "day", buckets: 7, now }),
      month: cashSeries(txns, { granularity: "day", buckets: 30, now }),
      quarter: cashSeries(txns, { granularity: "week", buckets: 13, now }),
      year: cashSeries(txns, { granularity: "month", buckets: 12, now }),
    },
    breakdown: {
      category: breakdown(txns, "category", range),
      vendor: breakdown(txns, "vendor", range),
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
    deps.prisma.financeTreasuryYield.findMany({ where: scopeOf(actor) }),
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
    where: { id: input.id, ...scopeOf(actor) },
  });
  if (!found) throw notFound();
  const account = toAccount(found);
  const own = {
    ...scopeOf(actor),
    mcpServerId: found.mcpServerId,
    accountExternalId: account.externalId,
  };
  const [txnRows, yieldRows] = await Promise.all([
    deps.prisma.financeTransaction.findMany({ where: own, orderBy: { postedAt: "desc" } }),
    account.kind === "treasury"
      ? deps.prisma.financeTreasuryYield.findMany({ where: own, orderBy: { month: "desc" } })
      : [],
  ]);
  const txns = txnRows.map(toTransaction);
  const treasuryYield = yieldRows.map(toYield);
  return {
    account: { ...account, annualYieldPct: annualYieldPct(account, treasuryYield, now) },
    history: balanceHistory(account, txns, now),
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
  return {
    monthlyCents: burn.monthlyCents,
    series: monthlySeries(txns, now),
    windowMonths: burn.months,
    whereItWent: window ? breakdown(txns, "category", window) : [],
    // Spend on an account that is no longer synced has no account to show, so it is left out here.
    byAccount: window
      ? breakdown(txns, "account", window).flatMap((row) => {
          const account = byExternalId.get(row.key);
          return account ? [{ account, cents: row.cents }] : [];
        })
      : [],
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

async function loadSnapshots(deps: FinanceDeps, actor: Actor, walletId?: string) {
  const rows = await deps.prisma.financeCryptoSnapshot.findMany({
    where: { ...scopeOf(actor), ...(walletId ? { walletId } : {}) },
  });
  // ponytail: reads every snapshot (wallets x days); bound by a day window if it grows large.
  return rows.map((r) => ({
    walletId: r.walletId,
    day: r.day,
    stablecoinCents: Number(r.stablecoinCents),
    otherCryptoCents: Number(r.otherCryptoCents),
  }));
}

export async function financeCryptoHistory(
  deps: FinanceDeps,
  actor: Actor,
  input: { days: number; walletId?: string },
): Promise<{ points: CryptoBalancePoint[] }> {
  if (input.walletId) {
    const wallet = await deps.prisma.financeWallet.findFirst({
      where: { id: input.walletId, ...scopeOf(actor) },
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
    where: { spaceId_userId: scopeOf(actor) },
    create: { ...scopeOf(actor), runwayCrypto: input.runwayCrypto },
    update: { runwayCrypto: input.runwayCrypto },
  });
  return { runwayCrypto: RunwayCryptoScopeSchema.parse(row.runwayCrypto) };
}

export async function financeSpend(
  deps: FinanceDeps,
  actor: Actor,
  input: FinanceSpendInput,
): Promise<FinanceSpendOutput> {
  const txns = await loadTransactions(deps, actor);
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
  input: { slug: string },
): Promise<FinanceCategoryOutput> {
  const now = nowOf(deps);
  const own = (await loadTransactions(deps, actor)).filter(
    (t) => t.classification === "spend" && categorySlug(t.category) === input.slug,
  );
  const first = own[0];
  if (!first) throw notFound();
  const range = last90(now);
  return {
    slug: input.slug,
    label: first.category?.trim() || "Uncategorized",
    last90Cents: breakdown(own, "category", range)[0]?.cents ?? 0,
    trend: monthlySpend(own, { categorySlug: input.slug }, now, 12),
    vendors: breakdown(own, "vendor", range),
    recent: newest(own, 8),
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
  // Six full months, then the current partial one. The average and the change use full months only.
  const seven = monthlySpend(own, { vendorKey: input.key }, now, 7);
  const full = seven.slice(0, 6);
  const lastFull = full[5]?.cents ?? 0;
  const threeBefore = full[2]?.cents ?? 0;
  const sixMonthsFrom = `${seven[1]?.month ?? monthOf(now, -5)}-01`;
  return {
    key: input.key,
    name: latest.counterparty,
    isSubscription: subscriptions(recurring).items.some((s) => s.key === input.key),
    monthlyAvgCents: Math.round(full.reduce((total, m) => total + m.cents, 0) / 6),
    // Null when the earlier month starts before the first synced data, so it is incomplete.
    changePct:
      lastFull && threeBefore && `${seven[2]?.month}-01` >= (earliestDay(all) ?? "")
        ? Math.round(((lastFull - threeBefore) / threeBefore) * 100)
        : null,
    firstSeenAt: own.reduce((min, t) => (t.postedAt < min ? t.postedAt : min), latest.postedAt),
    paidWith: recurring.find((r) => r.key === input.key)?.paidWith ?? paidWithFor(own, accounts),
    monthly: seven.slice(1),
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
    where: { id: input.id, ...scopeOf(actor) },
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
    where: { id: input.transactionId, ...scopeOf(actor) },
  });
  // Mercury's listing never says whether a row has attachments, so only the vendor lookup can tell.
  if (!row || (!row.hasReceipt && row.provider !== "mercury")) throw notFound();
  const server = await deps.prisma.mcpServer.findFirst({
    where: { id: row.mcpServerId, ...scopeOf(actor), enabled: true },
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
