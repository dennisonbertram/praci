import type {
  FinanceBurnOutput,
  FinanceMonthOutput,
  FinanceRunwayOutput,
  FinanceTransaction,
} from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { FinanceChromeProvider } from "../../components/finance/ui";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { FinanceBurnPage, FinanceMonthPage, FinanceRunwayPage } from "./FinanceBurn";

type Account = FinanceBurnOutput["byAccount"][number]["account"];

const checking: Account = {
  id: "acct_1",
  provider: "mercury",
  externalId: "ext_1",
  name: "Demo Checking",
  lastFour: "1111",
  kind: "checking",
  balanceCents: 120_000_00,
  currency: "USD",
};
const card: Account = {
  id: "acct_2",
  provider: "brex",
  externalId: "ext_2",
  name: "Demo Card",
  lastFour: "2222",
  kind: "card",
  balanceCents: 8_000_00,
  currency: "USD",
};

const months = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];
const burn: FinanceBurnOutput = {
  monthlyCents: 14_000_00,
  series: months.map((month, i) => ({
    month,
    outCents: (20 + i * 2) * 1_000_00,
    revenueCents: i % 2 ? 10_000_00 : 0,
    financingCents: i === 0 ? 40_000_00 : 0,
    partial: i === months.length - 1,
  })),
  windowMonths: ["2026-06", "2026-07", "2026-08"],
  whereItWent: [
    { key: "payroll", label: "Payroll", cents: 24_000_00 },
    { key: "software", label: "Software", cents: 9_000_00 },
    { key: "travel", label: "Travel", cents: 4_500_00 },
  ],
  byAccount: [
    { account: checking, cents: 30_000_00 },
    { account: card, cents: 7_500_00 },
  ],
};

const transaction = (id: string, over: Partial<FinanceTransaction>): FinanceTransaction => ({
  id,
  provider: "mercury",
  externalId: `ext_${id}`,
  accountExternalId: "ext_1",
  postedAt: "2026-09-12T10:00:00.000Z",
  purchasedAt: null,
  amountCents: -1_200_00,
  currency: "USD",
  counterparty: "Sample Vendor",
  vendorKey: "sample-vendor",
  category: "software",
  status: "posted",
  kind: "debit",
  classification: "spend",
  cardLastFour: null,
  cardholder: null,
  memo: null,
  hasReceipt: false,
  dashboardUrl: null,
  ...over,
});

const month: FinanceMonthOutput = {
  month: "2026-09",
  partial: true,
  outCents: 26_000_00,
  inCents: 10_000_00,
  netCents: -16_000_00,
  categories: burn.whereItWent,
  transactions: [
    transaction("t1", {}),
    transaction("t2", {
      counterparty: "Demo Payroll",
      category: "payroll",
      amountCents: -9_000_00,
    }),
    transaction("t3", {
      counterparty: "Example Client",
      category: null,
      amountCents: 10_000_00,
      classification: "revenue",
    }),
    transaction("t4", { counterparty: "Pending Vendor", status: "pending", amountCents: -80_00 }),
  ],
};

const runway: FinanceRunwayOutput = {
  runwayCrypto: "stablecoins",
  cashCents: 145_000_00,
  breakdown: { bankCents: 120_000_00, stablecoinCents: 25_000_00, otherCryptoCents: 10_000_00 },
  monthlyBurnCents: 14_000_00,
  runway: { months: 10.4, runOutDate: "2027-08-15" },
  history: months.map((m, i) => ({ month: m, balanceCents: (200 - i * 12) * 1_000_00 })),
  projection: ["2026-09", "2026-10", "2026-11", "2026-12", "2027-01"].map((m, i) => ({
    month: m,
    balanceCents: (140 - i * 14) * 1_000_00,
  })),
};

const never = () => new Promise(() => undefined);
const failing = () => {
  throw new Error("The finance data could not be loaded.");
};

const meta = {
  title: "Finance/Burn pages",
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="@container mx-auto w-[900px] max-w-full p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta;
export default meta;
type Story = StoryObj;

export const Burn: Story = {
  render: () => <FinanceBurnPage />,
  beforeEach: () => mockRpc({ "finance.burn": burn }),
};
export const BurnLoading: Story = {
  render: () => <FinanceBurnPage />,
  beforeEach: () => mockRpc({ "finance.burn": never }),
};
export const BurnError: Story = {
  render: () => <FinanceBurnPage />,
  beforeEach: () => mockRpc({ "finance.burn": failing }),
};
export const BurnNotBurning: Story = {
  render: () => <FinanceBurnPage />,
  beforeEach: () =>
    mockRpc({
      "finance.burn": {
        ...burn,
        monthlyCents: 0,
        series: burn.series.map((p) => ({ ...p, partial: false })),
      },
    }),
};

export const Month: Story = {
  render: () => <FinanceMonthPage month="2026-09" />,
  beforeEach: () => mockRpc({ "finance.month": month }),
};
export const MonthComplete: Story = {
  render: () => <FinanceMonthPage month="2026-08" />,
  beforeEach: () =>
    mockRpc({
      "finance.month": {
        ...month,
        month: "2026-08",
        partial: false,
        netCents: 4_000_00,
        inCents: 30_000_00,
      },
    }),
};
export const MonthEmpty: Story = {
  render: () => <FinanceMonthPage month="2026-09" />,
  beforeEach: () =>
    mockRpc({
      "finance.month": {
        ...month,
        outCents: 0,
        inCents: 0,
        netCents: 0,
        categories: [],
        transactions: [],
      },
    }),
};
export const MonthLoading: Story = {
  render: () => <FinanceMonthPage month="2026-09" />,
  beforeEach: () => mockRpc({ "finance.month": never }),
};
export const MonthError: Story = {
  render: () => <FinanceMonthPage month="2026-09" />,
  beforeEach: () => mockRpc({ "finance.month": failing }),
};

export const Runway: Story = {
  render: () => <FinanceRunwayPage />,
  beforeEach: () => mockRpc({ "finance.runway": runway }),
};
/** The header a phone shows: Back, the title, the company and Ask on one row. */
export const RunwayWithChrome: Story = {
  render: () => (
    <FinanceChromeProvider
      value={{
        onAskAgent: () => undefined,
        spaceId: "s1",
        spaces: [
          { id: "s1", name: "Northwind Robotics" },
          { id: "s2", name: "Northwind Labs" },
        ],
        onSwitchSpace: () => undefined,
      }}
    >
      <FinanceRunwayPage />
    </FinanceChromeProvider>
  ),
  beforeEach: () => mockRpc({ "finance.runway": runway }),
};
export const RunwayBankOnly: Story = {
  render: () => <FinanceRunwayPage />,
  beforeEach: () =>
    mockRpc({
      "finance.runway": {
        ...runway,
        runwayCrypto: "bank",
        cashCents: 120_000_00,
        breakdown: { bankCents: 120_000_00, stablecoinCents: 0, otherCryptoCents: 0 },
      },
    }),
};
export const RunwayNotBurning: Story = {
  render: () => <FinanceRunwayPage />,
  beforeEach: () =>
    mockRpc({
      "finance.runway": {
        ...runway,
        monthlyBurnCents: 0,
        runway: { months: null, runOutDate: null },
        projection: [],
      },
    }),
};
export const RunwayLoading: Story = {
  render: () => <FinanceRunwayPage />,
  beforeEach: () => mockRpc({ "finance.runway": never }),
};
export const RunwayError: Story = {
  render: () => <FinanceRunwayPage />,
  beforeEach: () => mockRpc({ "finance.runway": failing }),
};

export const BurnWithBrexSpend: Story = {
  name: "Burn with Brex card spend in By account",
  render: () => <FinanceBurnPage />,
  beforeEach: () => mockRpc({ "finance.burn": { ...burn, brexCents: 1_250_000 } }),
};
