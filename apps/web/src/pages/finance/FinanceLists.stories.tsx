import type { Subscription, UpcomingItem } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { FinanceSubscriptionsPage, FinanceUpcomingPage } from "./FinanceLists";

const names = [
  "Anchor Labs",
  "Birch Cloud",
  "Cedar Mail",
  "Delta Docs",
  "Ember Design",
  "Fjord Pay",
];
const upcoming: UpcomingItem[] = names.map((name, i) => ({
  key: name.toLowerCase().replace(" ", "-"),
  kind: i === 0 ? "bill" : i === 1 ? "pending" : "recurring",
  name,
  dates: [`2026-11-${String(5 + i * 4).padStart(2, "0")}`],
  amountCents: 4_900 + i * 12_500,
}));
const subscriptions: Subscription[] = names.map((name, i) => ({
  key: name.toLowerCase().replace(" ", "-"),
  name,
  monthlyCents: 2_900 + i * 7_700,
  trendCents: [2_900, 2_900, 2_900, 2_900 + i * 7_700],
  lastChargeAt: `2026-10-${String(3 + i * 4).padStart(2, "0")}T00:00:00.000Z`,
  overlapGroup: null,
  paidWith: [{ provider: "brex", kind: "card", name: "Card", lastFour: i % 2 ? "1111" : "2222" }],
}));

const meta = { title: "Finance/FinanceLists" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const load = () =>
  mockRpc({
    "finance.overview": {
      upcoming: { items: upcoming, totalCents: 0 },
      subscriptions: { items: subscriptions, totalMonthlyCents: 0 },
    },
  });

export const Upcoming: Story = { render: () => <FinanceUpcomingPage />, beforeEach: load };
export const Subscriptions: Story = {
  render: () => <FinanceSubscriptionsPage />,
  beforeEach: load,
};
