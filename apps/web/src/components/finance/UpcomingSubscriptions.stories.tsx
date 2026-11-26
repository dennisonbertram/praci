import type { Subscription, UpcomingItem } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { SubscriptionsTable, UpcomingRow } from "./UpcomingSubscriptions";

const items: UpcomingItem[] = [
  {
    key: "anchor",
    kind: "recurring",
    name: "Anchor Labs",
    dates: ["2026-11-05"],
    amountCents: 4_900,
  },
  {
    key: "birch",
    kind: "pending",
    name: "Birch Cloud",
    dates: ["2026-11-09"],
    amountCents: 12_900,
  },
  {
    key: "cedar",
    kind: "bill",
    name: "Cedar Mail",
    dates: ["2026-11-14"],
    amountCents: 250_000,
    billStatus: "APPROVED",
    dueAt: "2026-11-14",
  },
];
const subs: Subscription[] = items.map((item, i) => ({
  key: item.key,
  name: item.name,
  monthlyCents: item.amountCents,
  trendCents: [item.amountCents, item.amountCents, item.amountCents, item.amountCents + i * 500],
  lastChargeAt: "2026-10-05T00:00:00.000Z",
  overlapGroup: null,
  paidWith: [{ provider: "brex", kind: "card", name: "Card", lastFour: "1111" }],
}));

const meta = { title: "Finance/UpcomingSubscriptions" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Upcoming: Story = {
  render: () => (
    <div className="@container max-w-xl">
      {items.map((item) => (
        <UpcomingRow key={item.key} item={item} />
      ))}
    </div>
  ),
};

export const Subscriptions: Story = {
  render: () => (
    <div className="@container max-w-xl">
      <SubscriptionsTable subs={{ items: subs, totalMonthlyCents: 0 }} rows={subs} />
    </div>
  ),
};
