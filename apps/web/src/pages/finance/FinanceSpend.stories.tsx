import type {
  FinanceCategoryOutput,
  FinanceRecurringOutput,
  FinanceSpendOutput,
  FinanceVendorOutput,
} from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../lib/__mocks__/rpc";
import {
  FinanceCategoryPage,
  FinanceRecurringPage,
  FinanceSpendPage,
  FinanceVendorPage,
} from "./FinanceSpend";

const txn = (id: string, day: number, amountCents: number, counterparty: string, receipt = false) =>
  ({
    id,
    provider: "mercury",
    externalId: `ext_${id}`,
    accountExternalId: "acct_demo",
    postedAt: `2026-03-${String(day).padStart(2, "0")}T12:00:00.000Z`,
    purchasedAt: null,
    amountCents,
    currency: "USD",
    counterparty,
    vendorKey: counterparty.toLowerCase().replace(/\W+/g, "-"),
    category: "Software",
    status: "posted",
    kind: "card",
    classification: "spend",
    cardLastFour: "4242",
    cardholder: "Sam Example",
    memo: null,
    hasReceipt: receipt,
    dashboardUrl: null,
  }) satisfies FinanceSpendOutput["transactions"][number];

const transactions = [
  txn("t1", 12, -4900, "Acme Hosting", true),
  txn("t2", 9, -1250, "Demo Analytics"),
  txn("t3", 3, -32000, "Sample Design Co"),
];

const spend: FinanceSpendOutput = {
  period: "month",
  range: null,
  category: null,
  totalCents: 38150,
  categories: [
    { key: "software", label: "Software", cents: 6150 },
    { key: "contractors", label: "Contractors", cents: 32000 },
  ],
  transactions,
};

const category: FinanceCategoryOutput = {
  slug: "software",
  label: "Software",
  last90Cents: 18450,
  trend: Array.from({ length: 12 }, (_, i) => ({
    month: `2025-${String(i + 1).padStart(2, "0")}`,
    cents: 3000 + ((i * 1700) % 5000),
  })),
  vendors: [
    { key: "acme-hosting", label: "Acme Hosting", cents: 14700 },
    { key: "demo-analytics", label: "Demo Analytics", cents: 3750 },
  ],
  recent: transactions,
};

const recurring: FinanceRecurringOutput = {
  recurring: {
    key: "acme-hosting",
    name: "Acme Hosting",
    cadence: "monthly",
    amountCents: 4900,
    monthlyCents: 4900,
    variable: false,
    chargeCount: 8,
    lastChargeAt: "2026-03-12T12:00:00.000Z",
    nextExpectedAt: "2026-04-12T12:00:00.000Z",
    trendCents: [4900, 4900, 4900, 4900],
    classification: "spend",
    paidWith: [{ provider: "mercury", kind: "card", name: "Demo card", lastFour: "4242" }],
  },
  pastCharges: transactions,
};

const vendor: FinanceVendorOutput = {
  key: "acme-hosting",
  name: "Acme Hosting",
  isSubscription: true,
  monthlyAvgCents: 4900,
  changePct: 12.5,
  firstSeenAt: "2025-06-02T12:00:00.000Z",
  paidWith: [{ provider: "mercury", kind: "card", name: "Demo card", lastFour: "4242" }],
  monthly: ["2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03"].map((month, i) => ({
    month,
    cents: 4000 + i * 180,
  })),
  charges: transactions,
};

const never = () => new Promise(() => undefined);
const fails = () => Promise.reject(new Error("Could not load this page"));

const meta = {
  title: "Finance/FinanceSpend",
  parameters: {
    docs: { description: { component: "Spend, category, recurring and vendor pages." } },
  },
} satisfies Meta;
export default meta;
type Story = StoryObj;

export const Spend: Story = {
  render: () => <FinanceSpendPage period="month" category={null} range={null} />,
  beforeEach: () => mockRpc({ "finance.spend": spend }),
};

export const SpendFilteredToRange: Story = {
  render: () => (
    <FinanceSpendPage
      period="month"
      category="software"
      range={{ from: "2026-03-01", to: "2026-03-15" }}
    />
  ),
  beforeEach: () => mockRpc({ "finance.spend": { ...spend, category: "software" } }),
};

export const SpendFilteredToBrex: Story = {
  name: "Spend, Brex only (opened from Burn)",
  render: () => (
    <FinanceSpendPage
      period="month"
      category={null}
      range={{ from: "2026-07-01", to: "2026-09-30" }}
      source="brex"
    />
  ),
  beforeEach: () => mockRpc({ "finance.spend": spend }),
};

export const SpendEmpty: Story = {
  render: () => <FinanceSpendPage period="week" category={null} range={null} />,
  beforeEach: () =>
    mockRpc({
      "finance.spend": { ...spend, totalCents: 0, categories: [], transactions: [] },
    }),
};

export const SpendLoading: Story = {
  render: () => <FinanceSpendPage period="month" category={null} range={null} />,
  beforeEach: () => mockRpc({ "finance.spend": never }),
};

export const SpendError: Story = {
  render: () => <FinanceSpendPage period="month" category={null} range={null} />,
  beforeEach: () => mockRpc({ "finance.spend": fails }),
};

export const Category: Story = {
  render: () => <FinanceCategoryPage slug="software" />,
  beforeEach: () => mockRpc({ "finance.category": category }),
};

export const Recurring: Story = {
  render: () => <FinanceRecurringPage keyName="acme-hosting" />,
  beforeEach: () => mockRpc({ "finance.recurring": recurring }),
};

export const Vendor: Story = {
  render: () => <FinanceVendorPage keyName="acme-hosting" />,
  beforeEach: () => mockRpc({ "finance.vendor": vendor }),
};

/** A vendor newer than three months compares with its first full month. */
export const VendorComparedWithFirstMonth: Story = {
  render: () => <FinanceVendorPage keyName="acme-hosting" />,
  beforeEach: () =>
    mockRpc({
      "finance.vendor": {
        ...vendor,
        firstSeenAt: "2025-12-08T12:00:00.000Z",
        monthly: vendor.monthly.map((m) => ({ ...m, cents: m.month >= "2025-12" ? 4900 : 0 })),
        monthlyAvgMonths: 3,
        changePct: 0,
        changeFromMonth: "2025-12",
      },
    }),
};

/** The chart and the change stop at the last full month; the month under way is said under the chart. */
export const VendorMonthSoFar: Story = {
  render: () => <FinanceVendorPage keyName="acme-hosting" />,
  beforeEach: () =>
    mockRpc({
      "finance.vendor": {
        ...vendor,
        charges: [
          { ...txn("t9", 16, -240_000, "Acme Hosting"), postedAt: "2026-04-16T12:00:00.000Z" },
          ...transactions,
        ],
      },
    }),
};

export const VendorWithoutChange: Story = {
  render: () => <FinanceVendorPage keyName="acme-hosting" />,
  beforeEach: () =>
    mockRpc({
      "finance.vendor": { ...vendor, changePct: null, isSubscription: false, paidWith: [] },
    }),
};

export const SpendOneDayFromChart: Story = {
  name: "Spend for one day from the chart",
  render: () => (
    <FinanceSpendPage
      period="month"
      category={null}
      range={{ from: "2026-03-08", to: "2026-03-08" }}
    />
  ),
  beforeEach: () =>
    mockRpc({
      "finance.spend": {
        ...spend,
        range: { from: "2026-03-08", to: "2026-03-08" },
        start: "2026-03-08",
        end: "2026-03-09",
      },
    }),
};

export const SpendWithPeriodDays: Story = {
  name: "Spend with the days it counts",
  render: () => <FinanceSpendPage period="month" category={null} range={null} />,
  beforeEach: () =>
    mockRpc({ "finance.spend": { ...spend, start: "2026-03-01", end: "2026-03-17" } }),
};

export const VendorNewThisQuarter: Story = {
  name: "Vendor first seen three months ago",
  render: () => <FinanceVendorPage keyName="acme-hosting" />,
  beforeEach: () => mockRpc({ "finance.vendor": { ...vendor, monthlyAvgMonths: 3 } }),
};

/** A subscription shows the same per-month figure as its row in the Subscriptions list. */
export const VendorSubscription: Story = {
  render: () => <FinanceVendorPage keyName="acme-hosting" />,
  beforeEach: () =>
    mockRpc({ "finance.vendor": { ...vendor, isSubscription: true, monthlyUsual: true } }),
};

export const VendorNotFound: Story = {
  render: () => <FinanceVendorPage keyName="missing" />,
  beforeEach: () =>
    mockRpc({
      "finance.vendor": () =>
        Promise.reject(Object.assign(new Error("Not found"), { code: "NOT_FOUND" })),
    }),
};
