import type { CashPoint, FinanceOverview, SpendTotals } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ReactNode, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { userEvent, within } from "storybook/test";
import { mockRpc } from "../lib/__mocks__/rpc";
import { FinancePage } from "./Finance";

/** The preview already provides a router at "/", so move it to the Finance route instead of nesting one. */
function AtFinance({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  useEffect(() => {
    if (pathname !== "/app/finance") navigate("/app/finance", { replace: true });
  }, [pathname, navigate]);
  return pathname === "/app/finance" ? children : null;
}

const DAY_MS = 86_400_000;
const day = (offset: number) =>
  new Date(Date.UTC(2026, 9, 15) + offset * DAY_MS).toISOString().slice(0, 10);

function series(count: number, step: number): CashPoint[] {
  return Array.from({ length: count }, (_, i) => {
    const end = count - 1 - i;
    return {
      start: day(-end * step - (step - 1)),
      end: day(-end * step),
      outCents: 120_000 + ((i * 37_000) % 90_000),
      revenueCents: i % 3 === 0 ? 150_000 : 40_000,
      financingCents: i === 2 ? 500_000 : 0,
      partial: i === count - 1,
    };
  });
}

function totals(
  period: SpendTotals["period"],
  current: number,
  previous: number | null,
): SpendTotals {
  return {
    period,
    currentCents: current,
    previousCents: previous,
    changePct: previous ? Math.round(((current - previous) / previous) * 1000) / 10 : null,
    start: day(-29),
    end: day(0),
    previousStart: day(-59),
    previousEnd: day(-30),
  };
}

const paidWith = [
  {
    provider: "mercury" as const,
    kind: "account" as const,
    name: "Sample checking",
    lastFour: "1234",
  },
];

const overview: FinanceOverview = {
  sources: [
    {
      provider: "mercury",
      serverId: "srv_m",
      status: "ok",
      lastSyncedAt: "2026-10-15T08:00:00.000Z",
    },
    { provider: "brex", serverId: "srv_b", status: "ok", lastSyncedAt: "2026-10-15T08:00:00.000Z" },
  ],
  agent: { botId: "bot_fin", name: "Finance" },
  cash: {
    cashCents: 48_000_000,
    bankCashCents: 48_000_000,
    checkingCents: 30_000_000,
    savingsCents: 8_000_000,
    treasuryCents: 10_000_000,
    cardOwedCents: 1_200_000,
  },
  hasCashAccounts: true,
  burn: { monthlyCents: 3_400_000, months: ["2026-07", "2026-08", "2026-09"] },
  runway: { months: 14.1, runOutDate: "2027-12-01" },
  spendTotals: {
    week: totals("week", 800_000, 750_000),
    month: totals("month", 3_100_000, 3_400_000),
    quarter: totals("quarter", 9_800_000, 9_000_000),
    year: totals("year", 38_000_000, null),
  },
  cashSeries: {
    week: series(7, 1),
    month: series(30, 1),
    quarter: series(13, 7),
    year: series(12, 30),
  },
  breakdown: {
    category: [
      { key: "software", label: "Software", cents: 1_200_000 },
      { key: "payroll", label: "Payroll", cents: 900_000 },
      { key: "travel", label: "Travel", cents: 400_000 },
      { key: "meals", label: "Meals", cents: 250_000 },
      { key: "office", label: "Office", cents: 200_000 },
      { key: "legal", label: "Legal", cents: 150_000 },
      { key: "ads", label: "Advertising", cents: 120_000 },
      { key: "misc", label: "Miscellaneous", cents: 80_000 },
    ],
    vendor: [
      { key: "acme", label: "Acme Cloud", cents: 700_000 },
      { key: "globex", label: "Globex Tools", cents: 400_000 },
      { key: "initech", label: "Initech", cents: 300_000 },
    ],
  },
  upcoming: {
    items: [
      {
        key: "acme",
        kind: "recurring",
        name: "Acme Cloud",
        dates: [day(3), day(18)],
        amountCents: 120_000,
      },
      {
        key: "bill_1",
        kind: "bill",
        name: "Initech",
        dates: [day(9)],
        amountCents: 300_000,
        billStatus: "APPROVED",
        dueAt: day(9),
      },
      // A card bill paid from the bank: tagged "card bill", not "recurring".
      {
        key: "brex",
        kind: "recurring",
        name: "Brex",
        dates: [day(12)],
        amountCents: 1_120_000,
        cardBill: true,
      },
    ],
    totalCents: 1_660_000,
  },
  subscriptions: {
    items: [
      {
        key: "acme",
        name: "Acme Cloud",
        monthlyCents: 120_000,
        trendCents: [110_000, 118_000, 120_000],
        lastChargeAt: "2026-10-01T00:00:00.000Z",
        overlapGroup: null,
        paidWith,
      },
      {
        key: "globex",
        name: "Globex Tools",
        monthlyCents: 45_000,
        trendCents: [45_000, 45_000, 45_000],
        lastChargeAt: "2026-10-03T00:00:00.000Z",
        overlapGroup: "tools",
        paidWith: [],
      },
    ],
    totalMonthlyCents: 165_000,
  },
  treasuryYieldLastMonth: { month: "2026-09", netCents: 31_000 },
  lastSyncedAt: "2026-10-15T08:00:00.000Z",
  excludedNonUsdCount: 2,
  crypto: null,
  statementReminders: [],
};

const meta = {
  title: "Finance/FinancePage",
  component: FinancePage,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Also shows: Dashboard, EmptyState, DashboardSkeleton, SourceChip, Overview, ShowAll, HoverRow, Legend, UpcomingRow, SubscriptionsTable",
      },
    },
  },
  decorators: [
    (Story) => (
      <AtFinance>
        <div className="flex h-[900px]">
          <Story />
        </div>
      </AtFinance>
    ),
  ],
} satisfies Meta<typeof FinancePage>;
export default meta;
type Story = StoryObj<typeof meta>;

const load =
  (data: Partial<FinanceOverview> = {}) =>
  () =>
    mockRpc({ "finance.overview": { ...overview, ...data }, "finance.refresh": null });

export const Default: Story = { args: { onAskAgent: () => {} }, beforeEach: load() };

/** With more than one space, the header names the company whose finances these are, as a menu to switch. */
export const NamedSpace: Story = {
  args: {
    onAskAgent: () => {},
    // The switcher leaves off the words every name starts with, so it reads "Northwind Robotics".
    spaces: [
      { id: "s1", name: "MOCK DEMO DATA — Northwind Robotics" },
      { id: "s2", name: "MOCK DEMO DATA — Empty space" },
    ],
    spaceId: "s1",
    onSwitchSpace: () => {},
  },
  beforeEach: load(),
};

export const Loading: Story = {
  beforeEach: () => mockRpc({ "finance.overview": () => new Promise(() => {}) }),
};

export const LoadError: Story = {
  beforeEach: () =>
    mockRpc({
      "finance.overview": () => {
        throw new Error("Could not load Finance");
      },
    }),
};

const notConnected = {
  ...overview,
  sources: overview.sources.map((s) => ({ ...s, status: "not_connected", lastSyncedAt: null })),
  hasCashAccounts: false,
  lastSyncedAt: null,
};

export const NothingConnected: Story = {
  beforeEach: () => {
    mockRpc({ "finance.overview": { ...notConnected, crypto: null } });
  },
};

export const NothingConnectedWithCrypto: Story = {
  beforeEach: () => {
    mockRpc({
      "finance.overview": {
        ...notConnected,
        crypto: {
          totalCents: 500_000,
          byChain: [],
          byWallet: [],
          lastSyncedAt: null,
          unpricedTokenCount: 0,
        },
      },
    });
  },
};

export const FirstSync: Story = {
  beforeEach: () =>
    mockRpc({
      "finance.overview": { ...overview, lastSyncedAt: null },
      "finance.refresh": () => new Promise(() => {}),
    }),
};

export const SyncFailed: Story = {
  beforeEach: () =>
    mockRpc({
      "finance.overview": overview,
      "finance.refresh": () => {
        throw new Error("The bank is not responding");
      },
    }),
};

export const SourceNeedsAttention: Story = {
  beforeEach: load({
    sources: [
      { provider: "mercury", serverId: "srv_m", status: "needs_reconnect", lastSyncedAt: null },
      { provider: "brex", serverId: null, status: "not_connected", lastSyncedAt: null },
    ],
  }),
};

export const SourceError: Story = {
  beforeEach: load({
    sources: [
      { provider: "mercury", serverId: "srv_m", status: "error", lastSyncedAt: null },
      {
        provider: "brex",
        serverId: "srv_b",
        status: "ok",
        lastSyncedAt: "2026-10-15T08:00:00.000Z",
      },
    ],
  }),
};

export const WithCrypto: Story = {
  beforeEach: load({
    cash: {
      ...overview.cash,
      cashCents: 53_000_000,
      stablecoinCents: 3_000_000,
      otherCryptoCents: 2_000_000,
    },
    bankRunway: { months: 12.9, runOutDate: "2027-10-01" },
    crypto: {
      totalCents: 6_000_000,
      stablecoinCents: 3_000_000,
      byChain: [{ chainId: 1, cents: 6_000_000 }],
      byWallet: [{ walletId: "wal_1", cents: 6_000_000 }],
      lastSyncedAt: "2026-10-15T08:00:00.000Z",
      unpricedTokenCount: 3,
    },
  }),
  play: async ({ canvasElement }) => {
    await userEvent.hover(await within(canvasElement).findByText("Cash"));
  },
};

export const StatementReminders: Story = {
  beforeEach: load({
    statementReminders: [
      {
        accountId: "acct_1",
        accountName: "Sample checking",
        coveredThrough: "2026-08-31",
        dueFor: "2026-09-30",
      },
    ],
  }),
};

export const CardOnlyNoBurn: Story = {
  beforeEach: load({
    hasCashAccounts: false,
    burn: { monthlyCents: 0, months: [] },
    runway: { months: null, runOutDate: null },
    treasuryYieldLastMonth: null,
    excludedNonUsdCount: 0,
  }),
};

export const ExpandedLists: Story = {
  beforeEach: load(),
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole("button", { name: /Show all/ }));
  },
};

export const VendorBreakdown: Story = {
  beforeEach: load(),
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole("button", { name: "Vendor" }));
  },
};
