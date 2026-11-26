import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { NonUsdNotice } from "./NonUsdNotice";

const rows = [
  {
    id: "eu-1",
    provider: "mercury",
    externalId: "eu-1",
    accountExternalId: "acct-eu",
    postedAt: "2026-10-05T00:00:00.000Z",
    purchasedAt: null,
    amountCents: -98_765,
    currency: "EUR",
    counterparty: "Berlin Café",
    vendorKey: "berlin-cafe",
    category: "Travel",
    status: "posted",
    kind: "other",
    classification: "spend",
    cardLastFour: null,
    cardholder: null,
    memo: null,
    hasReceipt: false,
    dashboardUrl: null,
  },
  {
    id: "gbp-1",
    provider: "mercury",
    externalId: "gbp-1",
    accountExternalId: "acct-eu",
    postedAt: "2026-09-21T00:00:00.000Z",
    purchasedAt: null,
    amountCents: -42_000,
    currency: "GBP",
    counterparty: "London Office",
    vendorKey: "london-office",
    category: "Rent",
    status: "posted",
    kind: "other",
    classification: "spend",
    cardLastFour: null,
    cardholder: null,
    memo: null,
    hasReceipt: false,
    dashboardUrl: null,
  },
] as const;

const meta = {
  title: "Finance/Non-USD notice",
  component: NonUsdNotice,
  args: { rows: [...rows], count: 2 },
} satisfies Meta<typeof NonUsdNotice>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {};
export const Open: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button"));
  },
};
export const OneTransaction: Story = { args: { rows: [rows[0]], count: 1 } };
