import type { Meta, StoryObj } from "@storybook/react-vite";
import { setHideAmounts } from "../lib/hide-amounts-preference";
import { FinanceCards } from "./FinanceCards";

type Card = Parameters<typeof FinanceCards>[0]["block"]["card"];
const block = (card: Card) => ({ block: { kind: "finance", card } }) as const;

const meta = {
  title: "Chat/Finance cards",
  component: FinanceCards,
  parameters: { docs: { description: { component: "Also shows: Header, Preview" } } },
} satisfies Meta<typeof FinanceCards>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  args: block({
    card: "overview",
    cashCents: 12_500_000,
    burnCents: 850_000,
    runwayMonths: 14.7,
    monthSpendCents: 790_000,
  }),
};

/** Hide amounts is on: every dollar figure and the runway read as a fixed mask. */
export const OverviewAmountsHidden: Story = {
  ...Overview,
  beforeEach: () => {
    setHideAmounts(true);
    return () => setHideAmounts(false);
  },
};

export const OverviewNoRunway: Story = {
  args: block({
    card: "overview",
    cashCents: 12_500_000,
    burnCents: 0,
    runwayMonths: null,
    monthSpendCents: 0,
  }),
};

export const BreakdownByCategory: Story = {
  args: block({
    card: "breakdown",
    by: "category",
    range: "Last 90 days",
    totalCents: 2_400_000,
    rows: [
      { key: "software", label: "Software", cents: 1_200_000 },
      { key: "travel", label: "Travel", cents: 600_000 },
      { key: "meals", label: "Meals", cents: 400_000 },
      { key: "other", label: "Other", cents: 200_000 },
    ],
  }),
};

export const BreakdownByVendor: Story = {
  args: block({
    card: "breakdown",
    by: "vendor",
    range: "This month",
    totalCents: 90_000,
    rows: [
      { key: "acme", label: "Acme Cloud", cents: 60_000 },
      { key: "globex", label: "Globex Supplies with a very long vendor name", cents: 30_000 },
    ],
  }),
};

export const Transactions: Story = {
  args: block({
    card: "transactions",
    count: 3,
    totalCents: -45_000,
    rows: [
      { id: "txn_1", day: "2026-01-03", label: "Acme Cloud", cents: -20_000 },
      { id: "txn_2", day: "2026-01-02", label: "Globex Supplies", cents: -15_000 },
      { id: "txn_3", day: "2026-01-01", label: "Initech Travel", cents: -10_000 },
    ],
  }),
};

export const Recurring: Story = {
  args: block({
    card: "recurring",
    monthlyCents: 180_000,
    upcomingCents: 95_000,
    rows: [
      { key: "acme", label: "Acme Cloud", cents: 120_000 },
      { key: "globex", label: "Globex Analytics", cents: 60_000 },
    ],
  }),
};
