import * as z from "zod";
import { Id, IsoDate } from "./ids.js";

/** The one place the Finance agent's spawn key is built. */
export const financeAgentSpawnKey = (userId: string) => `finance-agent:${userId}`;

export const isFinanceAgentSpawnKey = (spawnKey: string | null | undefined) =>
  Boolean(spawnKey?.startsWith(financeAgentSpawnKey("")));

export const FinanceProviderSchema = z.enum(["mercury", "brex"]);
export type FinanceProvider = z.infer<typeof FinanceProviderSchema>;

/** The vendors' official remote MCP servers. A server counts as a finance source by its endpoint. */
export const FINANCE_MCP_ENDPOINTS = {
  mercury: "https://mcp.mercury.com/mcp",
  brex: "https://api.brex.com/mcp",
} as const satisfies Record<FinanceProvider, string>;

/** Which finance provider an MCP server endpoint belongs to, matched by https host; null for any other. */
export function financeProviderForEndpoint(
  endpoint: string | null | undefined,
): FinanceProvider | null {
  if (!endpoint) return null;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  for (const provider of FinanceProviderSchema.options) {
    if (new URL(FINANCE_MCP_ENDPOINTS[provider]).host === url.host) return provider;
  }
  return null;
}

/**
 * The read-only tools each provider's agent assignment (BotMcpServer.allowedTools) may use, and the
 * only ones sync calls. Write tools (payments, transfers, card changes, memo edits, receipt uploads)
 * are never listed. Mercury's getCashflowSummary is left out because it counts Treasury transfers as flows.
 */
export const FINANCE_READ_TOOLS = {
  mercury: [
    "getAccounts",
    "getAccount",
    "getAttachment",
    "getCurrentDate",
    "getTransaction",
    "getTransactionById",
    "getTreasury",
    "getTreasuryTransactions",
    "listCategories",
    "listCredit",
    "listMerchants",
    "listTransactions",
  ],
  brex: [
    "list_business_accounts",
    "get_business_account",
    "list_expenses",
    "get_expense_by_id",
    "query_expense_analytics",
    "list_bills",
    "get_bill_by_id",
    "list_banking_transactions",
    "get_banking_transaction",
    "list_cards",
    "get_card_by_id",
    "list_vendors",
    "get_vendor_by_id",
    "list_expense_categories",
    "list_spend_limits",
  ],
} as const satisfies Record<FinanceProvider, readonly string[]>;

/** Money is whole cents in a JS number (safe to about 90 trillion dollars). */
const Cents = z.number().int();
/** YYYY-MM */
const MonthId = z.string().regex(/^\d{4}-\d{2}$/);
/** YYYY-MM-DD */
const DayId = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// ---- Crypto (separate from the Mercury/Brex cash model) ----
//
// Blockscout is NOT a FinanceProvider: that enum drives cash, burn and runway and is iterated
// exhaustively (sources, sync, agent assignment). A separate source keeps crypto out of all of it.

/** Blockscout's hosted MCP server. Read-only; an optional Pro API key goes in `CRYPTO_API_KEY_HEADER`. */
export const CRYPTO_MCP_ENDPOINT = "https://mcp.blockscout.com/mcp";
export const CRYPTO_API_KEY_HEADER = "Blockscout-MCP-Pro-Api-Key";

/** True for a Blockscout MCP endpoint, matched by https host like `financeProviderForEndpoint`. */
export function isCryptoEndpoint(endpoint: string | null | undefined): boolean {
  if (!endpoint) return false;
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && url.host === new URL(CRYPTO_MCP_ENDPOINT).host;
  } catch {
    return false;
  }
}

/** The only Blockscout tools the agent may use and sync calls. `read_contract` is an eth_call view. */
export const CRYPTO_READ_TOOLS = [
  "get_address_info",
  "get_tokens_by_address",
  "get_address_by_ens_name",
  "get_chains_list",
  "read_contract",
  "get_token_transfers_by_address",
  "get_transactions_by_address",
] as const;

/** The chains tracked in v1 (Blockscout chain ids). */
export const CRYPTO_CHAINS = [
  { id: 1, name: "Ethereum" },
  { id: 8453, name: "Base" },
  { id: 42161, name: "Arbitrum One" },
  { id: 10, name: "Optimism" },
  { id: 137, name: "Polygon" },
] as const;

export const WalletTypeSchema = z.enum(["personal", "safe", "exchange", "contract"]);

/** Lowercase 0x + 40 hex. */
export const EvmAddress = z.string().regex(/^0x[0-9a-f]{40}$/);

export const FinanceWalletSchema = z.object({
  id: Id,
  address: EvmAddress,
  ensName: z.string().nullable(),
  label: z.string().nullable(),
  type: WalletTypeSchema,
  /** Safe only: lowercase owner addresses; null otherwise or until first sync. */
  safeOwners: z.array(EvmAddress).nullable(),
  safeThreshold: z.number().int().positive().nullable(),
});

/** One token balance of one wallet on one chain. */
export const CryptoHoldingSchema = z.object({
  walletId: Id,
  chainId: z.number().int(),
  /** Lowercase contract address; null for the chain's native coin. */
  tokenAddress: EvmAddress.nullable(),
  symbol: z.string(),
  name: z.string(),
  decimals: z.number().int().nonnegative(),
  /** uint256 as a decimal string, in the token's smallest unit. Never a float. */
  rawBalance: z.string().regex(/^\d+$/),
  /** USD per whole token as a decimal string; null when Blockscout has no price. */
  usdPrice: z.string().nullable(),
  /** Whole USD cents, rounded half up; null when unpriced. */
  usdValueCents: Cents.nullable(),
  syncedAt: IsoDate,
});

/** Priced holdings only, as held. How much counts as cash follows the saved `runwayCrypto` scope; crypto never affects burn. */
export const CryptoSummarySchema = z.object({
  totalCents: Cents,
  /** Priced holdings at the canonical stablecoin contracts; part of `totalCents`. */
  stablecoinCents: Cents.optional(),
  byChain: z.array(z.object({ chainId: z.number().int(), cents: Cents })),
  byWallet: z.array(z.object({ walletId: Id, cents: Cents })),
  /** Oldest holding sync; null with no holdings. */
  lastSyncedAt: IsoDate.nullable(),
  /** Non-zero holdings without a price (often spam); counted here, never in the total. */
  unpricedTokenCount: z.number().int().nonnegative(),
});

export const FinanceWalletsOutputSchema = z.array(FinanceWalletSchema);

/** `addressOrEns`: a 0x address (any case) or an ENS name; the server resolves and lowercases it. */
export const FinanceWalletAddInputSchema = z.object({
  addressOrEns: z.string().trim().min(1).max(255),
  label: z.string().trim().min(1).max(100).optional(),
  type: WalletTypeSchema,
});
export const FinanceWalletUpdateInputSchema = z.object({
  id: Id,
  /** null clears the label. */
  label: z.string().trim().min(1).max(100).nullable().optional(),
  type: WalletTypeSchema.optional(),
});
export const FinanceWalletRemoveInputSchema = z.object({ id: Id });

export const FinanceCryptoOutputSchema = z.object({
  /** Whether the Blockscout McpServer exists and is enabled. */
  connected: z.boolean(),
  /** Whether a Pro API key is stored (never the key itself). */
  hasApiKey: z.boolean(),
  summary: CryptoSummarySchema,
  holdings: z.array(CryptoHoldingSchema),
  wallets: z.array(FinanceWalletSchema),
  /** Short reason the last crypto sync failed; null when fine. */
  lastError: z.string().nullable(),
  /** Whether holdings come from the user's Alchemy key, and why the last sync fell back from it. */
  alchemy: z.object({ connected: z.boolean(), lastError: z.string().nullable() }),
});

/** A balance provider the user can connect with an API key. The key is stored encrypted, never returned. */
export const FinanceCryptoProviderSchema = z.enum(["alchemy"]);
export const FinanceCryptoProviderConnectInputSchema = z.object({
  provider: FinanceCryptoProviderSchema,
  apiKey: z.string().trim().min(1).max(500),
});
export const FinanceCryptoProviderRemoveInputSchema = z.object({
  provider: FinanceCryptoProviderSchema,
});
export type FinanceCryptoProviderConnectInput = z.infer<
  typeof FinanceCryptoProviderConnectInputSchema
>;
export type FinanceCryptoProviderRemoveInput = z.infer<
  typeof FinanceCryptoProviderRemoveInputSchema
>;

/** Creates or updates the Blockscout McpServer; the key is optional (shared stricter rate limit without it). */
export const FinanceCryptoConnectInputSchema = z.object({
  apiKey: z.string().trim().min(1).max(500).optional(),
});
export const FinanceCryptoConnectOutputSchema = z.object({ serverId: Id, hasApiKey: z.boolean() });

// ---- Exchange connections (Coinbase, Kraken; read-only API keys) ----

export const ExchangeProviderSchema = z.enum(["coinbase", "kraken"]);

export const ExchangeBalanceSchema = z.object({
  asset: z.string(),
  /** Decimal string, never a float. */
  amount: z.string().regex(/^\d+(\.\d+)?$/),
  usdPrice: z.string().nullable(),
  /** Whole USD cents; null when unpriced. */
  usdValueCents: Cents.nullable(),
});

export const FinanceExchangeSchema = z.object({
  id: Id,
  provider: ExchangeProviderSchema,
  /** True after the first successful sync. */
  connected: z.boolean(),
  lastSyncedAt: IsoDate.nullable(),
  /** Short reason the last sync failed; null when fine. */
  lastError: z.string().nullable(),
  totalCents: Cents,
  balances: z.array(ExchangeBalanceSchema),
});

/** Coinbase: `key` is the CDP key name, `secret` the EC private key. Kraken: the API key and its private key. Never returned. */
export const FinanceExchangeConnectInputSchema = z.object({
  provider: ExchangeProviderSchema,
  key: z.string().trim().min(1).max(500),
  secret: z.string().trim().min(1).max(4000),
});
export const FinanceExchangeRemoveInputSchema = z.object({ id: Id });
export const FinanceExchangesOutputSchema = z.array(FinanceExchangeSchema);

// ---- Normalized records (what sync stores and the pure calculations read) ----

export const FinanceAccountKindSchema = z.enum(["checking", "savings", "treasury", "card"]);

/** For a `card` account, `balanceCents` is the balance owed (positive) and is not cash. */
export const FinanceAccountSchema = z.object({
  id: Id,
  provider: FinanceProviderSchema,
  externalId: z.string(),
  name: z.string(),
  lastFour: z.string().nullable(),
  kind: FinanceAccountKindSchema,
  balanceCents: Cents,
  currency: z.string(),
});

export const FinanceTxnStatusSchema = z.enum(["pending", "posted", "other"]);

/**
 * `internal_transfer`: Treasury moves and moves between the user's own accounts.
 * `card_payment`: a Mercury payment to Brex; excluded from spend while Brex is connected.
 */
export const FinanceClassificationSchema = z.enum([
  "spend",
  "revenue",
  "financing",
  "internal_transfer",
  "card_payment",
]);

export const FinanceTransactionSchema = z.object({
  id: Id,
  provider: FinanceProviderSchema,
  externalId: z.string(),
  accountExternalId: z.string(),
  /** ISO datetime. */
  postedAt: IsoDate,
  /** Brex: the purchase date, which is what spend is counted by. */
  purchasedAt: IsoDate.nullable(),
  /** Signed; negative means money out. */
  amountCents: Cents,
  currency: z.string(),
  counterparty: z.string(),
  /** Normalized counterparty (`vendorKey`), the grouping key for vendors, recurring charges and subscriptions. */
  vendorKey: z.string(),
  /** The provider's category as given; null when it has none. Shown as "Uncategorized". */
  category: z.string().nullable(),
  status: FinanceTxnStatusSchema,
  /** The provider's own kind or expense type, unchanged. */
  kind: z.string(),
  classification: FinanceClassificationSchema,
  cardLastFour: z.string().nullable(),
  cardholder: z.string().nullable(),
  memo: z.string().nullable(),
  hasReceipt: z.boolean(),
  dashboardUrl: z.string().nullable(),
});

export const TreasuryYieldMonthSchema = z.object({
  accountExternalId: z.string(),
  month: MonthId,
  dividendsCents: Cents,
  feeCents: Cents,
  netCents: Cents,
});

/** A Brex bill that is not yet paid. Replaced on every sync; used for Upcoming only. */
export const FinanceBillSchema = z.object({
  provider: FinanceProviderSchema,
  externalId: z.string(),
  vendorName: z.string(),
  vendorKey: z.string(),
  dueAt: IsoDate,
  amountCents: Cents,
  status: z.string(),
});

// ---- Calculation results (packages/core/src/finance/metrics.ts) ----

export const SpendPeriodSchema = z.enum(["week", "month", "quarter", "year"]);

export const CashSummarySchema = z.object({
  /** Bank cash (Mercury checking + savings + Treasury) plus the crypto the saved `runwayCrypto` scope counts. */
  cashCents: Cents,
  /** Bank cash alone, without stablecoins. Absent from older payloads. */
  bankCashCents: Cents.optional(),
  /** Stablecoins counted in `cashCents` (0 under the "bank" scope). Held amounts are in `crypto`. */
  stablecoinCents: Cents.optional(),
  /** Other priced crypto counted in `cashCents`; non-zero only under the "all" scope. Held amounts are in `crypto`. */
  otherCryptoCents: Cents.optional(),
  checkingCents: Cents,
  savingsCents: Cents,
  treasuryCents: Cents,
  /** Brex balance owed; null when no card account is known. Not part of cash. */
  cardOwedCents: Cents.nullable(),
});

/** The current calendar period to date against the same elapsed days at the start of the previous one. */
export const SpendTotalsSchema = z.object({
  period: SpendPeriodSchema,
  currentCents: Cents,
  /** Null when the previous period starts before the earliest synced data, so its total is incomplete. */
  previousCents: Cents.nullable(),
  /** Percent change from previous to current; null when previous is 0 or null. */
  changePct: z.number().nullable(),
  start: DayId,
  end: DayId,
  previousStart: DayId,
  previousEnd: DayId,
});

export const MonthlyPointSchema = z.object({
  month: MonthId,
  outCents: Cents,
  revenueCents: Cents,
  financingCents: Cents,
  /** The current month, counted so far. */
  partial: z.boolean(),
});

/** One chart bucket: a day, a Monday-start week or a calendar month. */
export const CashPointSchema = z.object({
  /** First day of the bucket. */
  start: DayId,
  /** Last day of the bucket, inclusive. */
  end: DayId,
  outCents: Cents,
  revenueCents: Cents,
  financingCents: Cents,
  /** The bucket that holds today, counted so far. */
  partial: z.boolean(),
});

export const MonthlyBurnSchema = z.object({
  /** Average of (cash out - revenue) over the last 3 full months; zero or negative when not burning. */
  monthlyCents: Cents,
  /** The months averaged, oldest first. */
  months: z.array(MonthId),
});

export const RunwaySchema = z.object({
  /** Null when burn is zero or negative. */
  months: z.number().nullable(),
  runOutDate: DayId.nullable(),
});

export const BreakdownModeSchema = z.enum(["category", "vendor", "account"]);

/** `key` is the category slug, the vendorKey or the account's externalId; `label` is for display. */
export const BreakdownRowSchema = z.object({ key: z.string(), label: z.string(), cents: Cents });

export const RecurrenceCadenceSchema = z.enum(["weekly", "biweekly", "monthly", "annual"]);

/** One entry per paying account or card. Brex entries are cards (kind "card"). */
export const PaidWithEntrySchema = z.object({
  provider: FinanceProviderSchema,
  kind: z.enum(["account", "card"]),
  name: z.string(),
  lastFour: z.string().nullable(),
});

export const RecurringChargeSchema = z.object({
  /** The vendorKey. */
  key: z.string(),
  name: z.string(),
  cadence: RecurrenceCadenceSchema,
  /** Median charge amount, positive. */
  amountCents: Cents,
  /** The amount normalized to one month. */
  monthlyCents: Cents,
  /** True for usage-based vendors whose charges vary by more than the similar-amount range. */
  variable: z.boolean(),
  chargeCount: z.number().int(),
  lastChargeAt: IsoDate,
  nextExpectedAt: IsoDate,
  /** Totals for the last 3 full calendar months, oldest first. */
  trendCents: z.array(Cents).length(3),
  /** `spend` for subscriptions and vendors; `card_payment` for the Brex card payment. */
  classification: z.enum(["spend", "card_payment"]),
  paidWith: z.array(PaidWithEntrySchema),
});

export const UpcomingItemSchema = z.object({
  /** A recurring key (vendorKey), a transaction id for `pending`, or a bill's externalId for `bill`. */
  key: z.string(),
  kind: z.enum(["recurring", "pending", "bill"]),
  name: z.string(),
  /** Each expected date inside the window, oldest first. */
  dates: z.array(DayId).min(1),
  /** Per occurrence, positive. */
  amountCents: Cents,
});

export const UpcomingSchema = z.object({
  items: z.array(UpcomingItemSchema),
  /** Sum of amount x occurrences. */
  totalCents: Cents,
});

export const SubscriptionSchema = z.object({
  key: z.string(),
  name: z.string(),
  monthlyCents: Cents,
  trendCents: z.array(Cents).length(3),
  lastChargeAt: IsoDate,
  /** Set when another subscription shares this vendor's group in the static overlap map. */
  overlapGroup: z.string().nullable(),
  paidWith: z.array(PaidWithEntrySchema),
});

export const SubscriptionsSchema = z.object({
  items: z.array(SubscriptionSchema),
  totalMonthlyCents: Cents,
});

export const BalancePointSchema = z.object({ month: MonthId, balanceCents: Cents });
export const MonthCentsSchema = z.object({ month: MonthId, cents: Cents });

// ---- Procedures ----

export const FinanceSourceSchema = z.object({
  provider: FinanceProviderSchema,
  /** The user's McpServer for this provider; null when none exists yet. */
  serverId: Id.nullable(),
  /** `needs_reconnect`: the vendor refused the login; `error`: the last sync failed. */
  status: z.enum(["not_connected", "ok", "needs_reconnect", "error"]),
  lastSyncedAt: IsoDate.nullable(),
});

export const FinanceOverviewSchema = z.object({
  /** Always both providers. Nothing connected means the empty state; every other field is then empty or zero. */
  sources: z.array(FinanceSourceSchema),
  /** The unarchived Finance agent, if any. */
  agent: z.object({ botId: Id, name: z.string() }).nullable(),
  cash: CashSummarySchema,
  /** False with no cash account (for example Brex only); a zero or negative balance is still shown. */
  hasCashAccounts: z.boolean(),
  burn: MonthlyBurnSchema,
  runway: RunwaySchema,
  /** Runway on bank cash alone (no stablecoins). Absent from older payloads. */
  bankRunway: RunwaySchema.optional(),
  spendTotals: z.object({
    week: SpendTotalsSchema,
    month: SpendTotalsSchema,
    quarter: SpendTotalsSchema,
    year: SpendTotalsSchema,
  }),
  /**
   * Burn chart buckets per period, oldest first, the last one partial: week = 7 days, month = 30
   * days, quarter = 13 weeks, year = 12 months.
   */
  cashSeries: z.object({
    week: z.array(CashPointSchema),
    month: z.array(CashPointSchema),
    quarter: z.array(CashPointSchema),
    year: z.array(CashPointSchema),
  }),
  /** Last 90 days, largest first. */
  breakdown: z.object({
    category: z.array(BreakdownRowSchema),
    vendor: z.array(BreakdownRowSchema),
  }),
  upcoming: UpcomingSchema,
  subscriptions: SubscriptionsSchema,
  /** The previous calendar month's net Treasury yield; null without a Treasury account. */
  treasuryYieldLastMonth: z.object({ month: MonthId, netCents: Cents }).nullable(),
  /** Oldest successful sync across the connected sources; null means never synced. */
  lastSyncedAt: IsoDate.nullable(),
  /** Transactions left out of every total because they are not in USD (v1 is USD only). */
  excludedNonUsdCount: z.number().int().nonnegative(),
  /** Crypto holdings as held; null or absent when no wallet is added. Counted in cash per the saved scope; never in burn. */
  crypto: CryptoSummarySchema.nullable().optional(),
});

/** `redirectUri` is the web app's /mcp/oauth/callback, as for `mcp.oauth.begin`. */
export const FinanceConnectInputSchema = z.object({
  provider: FinanceProviderSchema,
  redirectUri: z.string().url(),
  /** Sign in again although a token is stored (the Reconnect chip). The server also does this itself when the source needs a reconnect. */
  reconnect: z.boolean().optional(),
});

/** Creates the provider's McpServer if the user has none, then starts OAuth on it. */
export const FinanceConnectOutputSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("authorization_required"),
    serverId: Id,
    sessionId: Id,
    authorizationUrl: z.string().url(),
  }),
  z.object({
    status: z.enum(["already_connected", "authorization_not_requested"]),
    serverId: Id,
  }),
]);

const AccountRowSchema = FinanceAccountSchema.extend({
  /** Treasury only: last 3 months' net yield, annualized, in percent. */
  annualYieldPct: z.number().nullable(),
});

export const FinanceAccountsOutputSchema = z.object({
  totalCashCents: Cents,
  cardOwedCents: Cents.nullable(),
  /** Total cash at each month end, reconstructed backwards from today's balances. 12 months. */
  history: z.array(BalancePointSchema),
  cash: z.array(AccountRowSchema),
  cards: z.array(AccountRowSchema),
});

export const FinanceAccountOutputSchema = z.object({
  account: AccountRowSchema,
  history: z.array(BalancePointSchema),
  /** Treasury only, newest first; [] otherwise. */
  treasuryYield: z.array(TreasuryYieldMonthSchema),
  /** Newest 20. */
  transactions: z.array(FinanceTransactionSchema),
});

export const FinanceBurnOutputSchema = z.object({
  monthlyCents: Cents,
  series: z.array(MonthlyPointSchema),
  /** The 3 months the burn averages, with their spend by category, largest first. */
  windowMonths: z.array(MonthId),
  whereItWent: z.array(BreakdownRowSchema),
  byAccount: z.array(z.object({ account: FinanceAccountSchema, cents: Cents })),
});

export const FinanceMonthOutputSchema = z.object({
  month: MonthId,
  partial: z.boolean(),
  outCents: Cents,
  /** Revenue + financing. */
  inCents: Cents,
  netCents: Cents,
  categories: z.array(BreakdownRowSchema),
  /** Internal transfers and card payments left out; newest first, at most 500. */
  transactions: z.array(FinanceTransactionSchema),
});

/**
 * What counts as cash for runway, the accounts total and the dashboard: bank only (the default),
 * bank plus stablecoins, or bank plus all priced crypto at current prices.
 */
export const RunwayCryptoScopeSchema = z.enum(["bank", "stablecoins", "all"]);
export type RunwayCryptoScope = z.infer<typeof RunwayCryptoScopeSchema>;

export const FinancePreferencesSchema = z.object({ runwayCrypto: RunwayCryptoScopeSchema });
export type FinancePreferences = z.infer<typeof FinancePreferencesSchema>;

/** End-of-day crypto value from stored daily snapshots; days before the first snapshot are absent. */
export const CryptoBalancePointSchema = z.object({
  day: DayId,
  stablecoinCents: Cents,
  otherCryptoCents: Cents,
});
export type CryptoBalancePoint = z.infer<typeof CryptoBalancePointSchema>;

export const FinanceCryptoHistoryInputSchema = z.object({
  days: z.number().int().min(7).max(366).default(90),
  /** One wallet; all wallets when absent. */
  walletId: Id.optional(),
});

export const FinanceCryptoHistoryOutputSchema = z.object({
  points: z.array(CryptoBalancePointSchema),
});

export const FinanceRunwayOutputSchema = z.object({
  /** The scope the figures below were computed with (the saved preference). */
  runwayCrypto: RunwayCryptoScopeSchema,
  /** Cash under `runwayCrypto`. */
  cashCents: Cents,
  /** Every part, whether or not it counts under `runwayCrypto`. */
  breakdown: z.object({
    bankCents: Cents,
    stablecoinCents: Cents,
    otherCryptoCents: Cents,
  }),
  monthlyBurnCents: Cents,
  runway: RunwaySchema,
  /** Past cash under `runwayCrypto`, 12 months; crypto from daily snapshots, so months before the first snapshot are bank only. */
  history: z.array(BalancePointSchema),
  /** From this month forward, one point a month, until cash reaches zero or 24 months; [] when not burning. */
  projection: z.array(BalancePointSchema),
});

export const FinanceSpendInputSchema = z.object({
  period: SpendPeriodSchema,
  /** A category slug to filter by. */
  category: z.string().min(1).max(200).optional(),
  /** Inclusive days; with both, they replace the period's range (a chart bar's days). */
  from: DayId.optional(),
  to: DayId.optional(),
});

export const FinanceSpendOutputSchema = z.object({
  period: SpendPeriodSchema,
  /** The inclusive days counted when the input had a from/to range; otherwise null. */
  range: z.object({ from: DayId, to: DayId }).nullable(),
  category: z.string().nullable(),
  totalCents: Cents,
  /** Category chips: the categories that have spend in the period, largest first. */
  categories: z.array(BreakdownRowSchema),
  /** Spend only, newest first, at most 500. */
  transactions: z.array(FinanceTransactionSchema),
});

export const FinanceCategoryOutputSchema = z.object({
  slug: z.string(),
  label: z.string(),
  last90Cents: Cents,
  /** Spend per month, 12 months oldest first. */
  trend: z.array(MonthCentsSchema),
  /** Last 90 days; sums to `last90Cents`. */
  vendors: z.array(BreakdownRowSchema),
  /** Newest 8. */
  recent: z.array(FinanceTransactionSchema),
});

export const FinanceRecurringOutputSchema = z.object({
  recurring: RecurringChargeSchema,
  /** Newest 6. */
  pastCharges: z.array(FinanceTransactionSchema),
});

export const FinanceVendorOutputSchema = z.object({
  key: z.string(),
  name: z.string(),
  /** True when the vendor is in the subscriptions list. */
  isSubscription: z.boolean(),
  /** Average over the last 6 months, counting months with no charge as zero. */
  monthlyAvgCents: Cents,
  /** Last full month against 3 months before it; null when either is 0. */
  changePct: z.number().nullable(),
  firstSeenAt: IsoDate,
  paidWith: z.array(PaidWithEntrySchema),
  /** 6 months, oldest first. */
  monthly: z.array(MonthCentsSchema),
  /** Charges in the last 6 months, newest first. */
  charges: z.array(FinanceTransactionSchema),
});

export const FinanceTransactionOutputSchema = z.object({
  transaction: FinanceTransactionSchema,
  vendorName: z.string(),
  /** The account the money moved through; null if it is no longer synced. */
  account: FinanceAccountSchema.nullable(),
  /** The vendor is in the subscriptions list (decides the breadcrumb). */
  vendorIsSubscription: z.boolean(),
});

export const FinanceReceiptUrlOutputSchema = z.object({
  /** A short-lived vendor link, fetched on demand. */
  url: z.string().url(),
  mimeType: z.string().nullable(),
});

export type WalletType = z.infer<typeof WalletTypeSchema>;
export type FinanceWallet = z.infer<typeof FinanceWalletSchema>;
export type CryptoHolding = z.infer<typeof CryptoHoldingSchema>;
export type CryptoSummary = z.infer<typeof CryptoSummarySchema>;
export type FinanceWalletAddInput = z.infer<typeof FinanceWalletAddInputSchema>;
export type FinanceWalletUpdateInput = z.infer<typeof FinanceWalletUpdateInputSchema>;
export type FinanceWalletRemoveInput = z.infer<typeof FinanceWalletRemoveInputSchema>;
export type ExchangeProvider = z.infer<typeof ExchangeProviderSchema>;
export type FinanceExchange = z.infer<typeof FinanceExchangeSchema>;
export type FinanceExchangeConnectInput = z.infer<typeof FinanceExchangeConnectInputSchema>;
export type FinanceCryptoOutput = z.infer<typeof FinanceCryptoOutputSchema>;
export type FinanceCryptoConnectInput = z.infer<typeof FinanceCryptoConnectInputSchema>;
export type FinanceCryptoConnectOutput = z.infer<typeof FinanceCryptoConnectOutputSchema>;
export type FinanceAccount = z.infer<typeof FinanceAccountSchema>;
export type FinanceAccountKind = z.infer<typeof FinanceAccountKindSchema>;
export type FinanceTransaction = z.infer<typeof FinanceTransactionSchema>;
export type FinanceTxnStatus = z.infer<typeof FinanceTxnStatusSchema>;
export type FinanceClassification = z.infer<typeof FinanceClassificationSchema>;
export type TreasuryYieldMonth = z.infer<typeof TreasuryYieldMonthSchema>;
export type FinanceBill = z.infer<typeof FinanceBillSchema>;
export type SpendPeriod = z.infer<typeof SpendPeriodSchema>;
export type CashSummary = z.infer<typeof CashSummarySchema>;
export type SpendTotals = z.infer<typeof SpendTotalsSchema>;
export type CashPoint = z.infer<typeof CashPointSchema>;
export type MonthlyPoint = z.infer<typeof MonthlyPointSchema>;
export type MonthlyBurn = z.infer<typeof MonthlyBurnSchema>;
export type Runway = z.infer<typeof RunwaySchema>;
export type BreakdownMode = z.infer<typeof BreakdownModeSchema>;
export type BreakdownRow = z.infer<typeof BreakdownRowSchema>;
export type RecurrenceCadence = z.infer<typeof RecurrenceCadenceSchema>;
export type PaidWithEntry = z.infer<typeof PaidWithEntrySchema>;
export type RecurringCharge = z.infer<typeof RecurringChargeSchema>;
export type UpcomingItem = z.infer<typeof UpcomingItemSchema>;
export type Upcoming = z.infer<typeof UpcomingSchema>;
export type Subscription = z.infer<typeof SubscriptionSchema>;
export type Subscriptions = z.infer<typeof SubscriptionsSchema>;
export type BalancePoint = z.infer<typeof BalancePointSchema>;
export type MonthCents = z.infer<typeof MonthCentsSchema>;
export type FinanceSource = z.infer<typeof FinanceSourceSchema>;
export type FinanceOverview = z.infer<typeof FinanceOverviewSchema>;
export type FinanceConnectInput = z.infer<typeof FinanceConnectInputSchema>;
export type FinanceConnectOutput = z.infer<typeof FinanceConnectOutputSchema>;
export type FinanceAccountsOutput = z.infer<typeof FinanceAccountsOutputSchema>;
export type FinanceAccountOutput = z.infer<typeof FinanceAccountOutputSchema>;
export type FinanceBurnOutput = z.infer<typeof FinanceBurnOutputSchema>;
export type FinanceMonthOutput = z.infer<typeof FinanceMonthOutputSchema>;
export type FinanceRunwayOutput = z.infer<typeof FinanceRunwayOutputSchema>;
export type FinanceSpendInput = z.infer<typeof FinanceSpendInputSchema>;
export type FinanceSpendOutput = z.infer<typeof FinanceSpendOutputSchema>;
export type FinanceCategoryOutput = z.infer<typeof FinanceCategoryOutputSchema>;
export type FinanceRecurringOutput = z.infer<typeof FinanceRecurringOutputSchema>;
export type FinanceVendorOutput = z.infer<typeof FinanceVendorOutputSchema>;
export type FinanceTransactionOutput = z.infer<typeof FinanceTransactionOutputSchema>;
export type FinanceReceiptUrlOutput = z.infer<typeof FinanceReceiptUrlOutputSchema>;
