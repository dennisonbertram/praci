import type {
  CashPoint,
  FinanceAccountOutput,
  FinanceCryptoOutput,
  FinanceOverview,
  FinanceRunwayOutput,
  FinanceTransaction,
  FinanceTransactionOutput,
  FinanceVendorOutput,
  SpendTotals,
} from "@rakazo/contracts";

// Synthetic data only: invented vendors, amounts and ids.

const totals = (period: SpendTotals["period"], current: number, previous: number): SpendTotals => ({
  period,
  currentCents: current,
  previousCents: previous,
  changePct: previous ? ((current - previous) / previous) * 100 : null,
  start: "2026-10-01",
  end: "2026-10-15",
  previousStart: "2026-09-01",
  previousEnd: "2026-09-15",
});

const out = [8000, 9500, 7200, 10400, 8800, 9100, 7600, 11000, 8300, 9700, 8900, 3600];
const revenue = [0, 0, 6000, 0, 0, 5000, 0, 0, 7000, 0, 0, 0];
const financing = [0, 0, 0, 0, 0, 0, 25000, 0, 0, 0, 0, 0];

// Invented bar values for the Burn chart: the newest day is Wed 2026-10-14, the newest week starts Mon 2026-10-12.
const DAY_MS = 86_400_000;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const TODAY_MS = Date.UTC(2026, 9, 14);
const point = (i: number, count: number, start: number, end: number): CashPoint => ({
  start: isoDay(start),
  end: isoDay(end),
  outCents: (60 + ((i * 37) % 90)) * 10_000,
  revenueCents: i % 4 === 1 ? 45 * 10_000 : 0,
  financingCents: 0,
  partial: i === count - 1,
});
const dailyPoints = (count: number): CashPoint[] =>
  Array.from({ length: count }, (_, i) => {
    const day = TODAY_MS - (count - 1 - i) * DAY_MS;
    return point(i, count, day, day);
  });
const weeklyPoints = (count: number): CashPoint[] =>
  Array.from({ length: count }, (_, i) => {
    const start = Date.UTC(2026, 9, 12) - (count - 1 - i) * 7 * DAY_MS;
    return point(i, count, start, start + 6 * DAY_MS);
  });

const brexCard = { provider: "brex", kind: "card", name: "Card", lastFour: "0001" } as const;
const checking = {
  provider: "mercury",
  kind: "account",
  name: "Mercury Checking",
  lastFour: "0002",
} as const;

const subs = [
  ["acme-hosting", "Acme Hosting", 62000, [50000, 56000, 62000], "2026-10-01", [brexCard], null],
  [
    "globex-compute",
    "Globex Compute",
    41000,
    [30000, 36000, 41000],
    "2026-10-03",
    [brexCard],
    null,
  ],
  ["initech-ai", "Initech AI", 22000, [9000, 15000, 22000], "2026-10-06", [brexCard], "ai-models"],
  [
    "umbrella-ai",
    "Umbrella AI",
    35000,
    [41000, 38000, 35000],
    "2026-10-04",
    [brexCard, checking],
    "ai-models",
  ],
  ["hooli-mail", "Hooli Mail", 3000, [3000, 3000, 3000], "2026-10-01", [checking], null],
] as const;

export const connectedOverview: FinanceOverview = {
  sources: [
    {
      provider: "mercury",
      serverId: "11111111-1111-4111-8111-111111111111",
      status: "ok",
      lastSyncedAt: new Date().toISOString(),
    },
    {
      provider: "brex",
      serverId: "22222222-2222-4222-8222-222222222222",
      status: "ok",
      lastSyncedAt: new Date().toISOString(),
    },
  ],
  agent: null,
  cash: {
    cashCents: 7_500_000,
    bankCashCents: 7_500_000,
    stablecoinCents: 0,
    otherCryptoCents: 0,
    checkingCents: 1_200_000,
    savingsCents: 300_000,
    treasuryCents: 6_000_000,
    cardOwedCents: 150_000,
  },
  burn: { monthlyCents: 900_000, months: ["2026-07", "2026-08", "2026-09"] },
  hasCashAccounts: true,
  runway: { months: 8.3, runOutDate: "2027-06-26" },
  spendTotals: {
    week: totals("week", 87_500, 120_000),
    month: totals("month", 360_000, 450_000),
    quarter: totals("quarter", 1_100_000, 1_300_000),
    year: totals("year", 11_725_000, 10_500_000),
  },
  cashSeries: {
    week: dailyPoints(7),
    month: dailyPoints(30),
    quarter: weeklyPoints(13),
    year: out.map((o, i) => {
      const month = `${i < 2 ? 2025 : 2026}-${String(((10 + i) % 12) + 1).padStart(2, "0")}`;
      return {
        start: `${month}-01`,
        end: `${month}-28`,
        outCents: o * 100,
        revenueCents: revenue[i]! * 100,
        financingCents: financing[i]! * 100,
        partial: i === 11,
      };
    }),
  },
  breakdown: {
    category: [
      { key: "payroll", label: "Payroll", cents: 1_200_000 },
      { key: "software", label: "Recurring software", cents: 250_000 },
      { key: "servers-cloud", label: "Servers & cloud", cents: 300_000 },
      { key: "travel", label: "Travel", cents: 120_000 },
      { key: "uncategorized", label: "Uncategorized", cents: 80_000 },
    ],
    vendor: [
      { key: "acme-hosting", label: "Acme Hosting", cents: 150_000 },
      { key: "globex-compute", label: "Globex Compute", cents: 100_000 },
      { key: "initech-ai", label: "Initech AI", cents: 60_000 },
    ],
  },
  upcoming: {
    items: [
      {
        key: "payroll-co",
        kind: "recurring",
        name: "Payroll Co",
        dates: ["2026-10-16", "2026-10-30"],
        amountCents: 300_000,
      },
      {
        key: "acme-hosting",
        kind: "recurring",
        name: "Acme Hosting",
        dates: ["2026-11-01"],
        amountCents: 60_000,
      },
      {
        key: "bill-1",
        kind: "bill",
        name: "Stark Legal LLP",
        dates: ["2026-10-22"],
        amountCents: 90_000,
      },
    ],
    totalCents: 750_000,
  },
  subscriptions: {
    items: subs.map(([key, name, monthly, trend, last, paidWith, group]) => ({
      key,
      name,
      monthlyCents: monthly,
      trendCents: [...trend],
      lastChargeAt: `${last}T00:00:00.000Z`,
      overlapGroup: group,
      paidWith: [...paidWith],
    })),
    totalMonthlyCents: subs.reduce((sum, s) => sum + s[2], 0),
  },
  treasuryYieldLastMonth: { month: "2026-09", netCents: 31_200 },
  lastSyncedAt: new Date().toISOString(),
  excludedNonUsdCount: 0,
};

export const emptyOverview: FinanceOverview = {
  ...connectedOverview,
  sources: [
    { provider: "mercury", serverId: null, status: "not_connected", lastSyncedAt: null },
    { provider: "brex", serverId: null, status: "not_connected", lastSyncedAt: null },
  ],
  cashSeries: { week: [], month: [], quarter: [], year: [] },
  lastSyncedAt: null,
};

export const charges: FinanceTransaction[] = [
  ["acme-use-1001", "2026-10-01T09:00:00.000Z", -47000, "Usage", true],
  ["acme-plan-1001", "2026-10-01T09:00:00.000Z", -15000, "Pro plan", false],
  ["acme-use-0901", "2026-09-01T09:00:00.000Z", -43000, "Usage", true],
  ["acme-plan-0901", "2026-09-01T09:00:00.000Z", -15000, "Pro plan", false],
].map(([id, postedAt, amountCents, memo, hasReceipt], index) => ({
  id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  provider: "brex",
  externalId: String(id),
  accountExternalId: "card-1",
  postedAt: String(postedAt),
  purchasedAt: String(postedAt),
  amountCents: Number(amountCents),
  currency: "USD",
  counterparty: "Acme Hosting",
  vendorKey: "acme-hosting",
  category: "Servers & cloud",
  status: "posted",
  kind: "card",
  classification: "spend",
  cardLastFour: "0001",
  cardholder: "Sam Example",
  memo: String(memo),
  hasReceipt: Boolean(hasReceipt),
  dashboardUrl: "https://dashboard.example.test/expenses/1",
}));

export const vendor: FinanceVendorOutput = {
  key: "acme-hosting",
  name: "Acme Hosting",
  isSubscription: true,
  monthlyAvgCents: 56_000,
  changePct: 40,
  firstSeenAt: "2025-04-02T00:00:00.000Z",
  paidWith: [brexCard],
  monthly: [
    ["2026-05", 520],
    ["2026-06", 540],
    ["2026-07", 560],
    ["2026-08", 600],
    ["2026-09", 580],
    ["2026-10", 620],
  ].map(([month, dollars]) => ({ month: String(month), cents: Number(dollars) * 100 })),
  charges,
};

export const withReceipt = charges[0]!;
export const withoutReceipt = charges[1]!;

export const transactionOf = (id: string): FinanceTransactionOutput => ({
  transaction: charges.find((c) => c.id === id) ?? withReceipt,
  vendorName: "Acme Hosting",
  account: null,
  vendorIsSubscription: true,
});

export const treasuryAccount: FinanceAccountOutput["account"] = {
  id: "33333333-3333-4333-8333-333333333333",
  provider: "mercury",
  externalId: "acct-treasury",
  name: "Mercury Treasury",
  lastFour: "0003",
  kind: "treasury",
  balanceCents: 6_000_000,
  currency: "USD",
  annualYieldPct: 4.3,
};

/** A 1x1 PNG, served as the receipt image. */
export const receiptPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
  "base64",
);

// Invented wallets and balances for the crypto page.
const SAFE = "0x1111111111111111111111111111111111111111";
const ALICE = "0x2222222222222222222222222222222222222222";
const holding = (
  walletId: string,
  chainId: number,
  symbol: string,
  rawBalance: string,
  decimals: number,
  usdValueCents: number | null,
) => ({
  walletId,
  chainId,
  tokenAddress: symbol === "ETH" ? null : "0x4444444444444444444444444444444444444444",
  symbol,
  name: symbol,
  decimals,
  rawBalance,
  usdPrice: usdValueCents === null ? null : "1",
  usdValueCents,
  syncedAt: "2026-10-14T10:00:00.000Z",
});
export const cryptoData: FinanceCryptoOutput = {
  connected: true,
  hasApiKey: false,
  lastError: null,
  wallets: [
    {
      id: "00000000-0000-4000-8000-000000000001",
      address: SAFE,
      ensName: null,
      label: "Treasury",
      type: "safe",
      safeOwners: [ALICE, SAFE, "0x3333333333333333333333333333333333333333"],
      safeThreshold: 2,
    },
    {
      id: "00000000-0000-4000-8000-000000000002",
      address: ALICE,
      ensName: "alice.eth",
      label: null,
      type: "personal",
      safeOwners: null,
      safeThreshold: null,
    },
  ],
  holdings: [
    holding("00000000-0000-4000-8000-000000000001", 1, "ETH", "1500000000000000000", 18, 300_000),
    holding("00000000-0000-4000-8000-000000000002", 8453, "USDC", "2500000", 6, 250),
    holding("00000000-0000-4000-8000-000000000002", 137, "SPAM", "9000000000", 6, null),
  ],
  summary: {
    totalCents: 300_250,
    byChain: [
      { chainId: 1, cents: 300_000 },
      { chainId: 8453, cents: 250 },
    ],
    byWallet: [
      { walletId: "00000000-0000-4000-8000-000000000001", cents: 300_000 },
      { walletId: "00000000-0000-4000-8000-000000000002", cents: 250 },
    ],
    lastSyncedAt: "2026-10-14T10:00:00.000Z",
    unpricedTokenCount: 1,
  },
};

// Invented runway figures with crypto, and a short balance history.
export const runwayData: FinanceRunwayOutput = {
  runwayCrypto: "stablecoins",
  cashCents: 9_000_000,
  breakdown: { bankCents: 7_500_000, stablecoinCents: 1_500_000, otherCryptoCents: 800_000 },
  monthlyBurnCents: 900_000,
  runway: { months: 10, runOutDate: "2027-08-15" },
  history: [
    { month: "2026-08", balanceCents: 8_700_000 },
    { month: "2026-09", balanceCents: 8_900_000 },
    { month: "2026-10", balanceCents: 9_000_000 },
  ],
  projection: [
    { month: "2026-11", balanceCents: 8_100_000 },
    { month: "2026-12", balanceCents: 7_200_000 },
  ],
};

export const cryptoHistoryData = {
  points: [
    { day: "2026-10-12", stablecoinCents: 1_400_000, otherCryptoCents: 750_000 },
    { day: "2026-10-13", stablecoinCents: 1_450_000, otherCryptoCents: 780_000 },
    { day: "2026-10-14", stablecoinCents: 1_500_000, otherCryptoCents: 800_000 },
  ],
};
