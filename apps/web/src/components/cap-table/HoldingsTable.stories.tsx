import type { Meta, StoryObj } from "@storybook/react-vite";
import { HoldingsTable } from "./HoldingsTable";

const meta = {
  title: "Cap table/HoldingsTable",
  component: HoldingsTable,
  decorators: [
    (Story) => (
      <div className="@container w-full max-w-3xl text-foreground">
        <Story />
      </div>
    ),
  ],
  args: {
    onAddContact: () => {},
    onOpenContact: () => {},
    rows: [
      {
        key: "h0",
        name: "Ada Founder",
        security: "Common",
        shares: 6_000_000,
        amountUsd: null,
        percent: 60,
        contact: null,
      },
      {
        key: "h1",
        name: "Example Seed Fund",
        security: "Seed Preferred",
        shares: 3_000_000,
        amountUsd: 1_500_000,
        percent: 30,
        contact: { id: "c1" },
      },
      {
        key: "h2",
        name: "Sample Angel",
        security: "SAFE",
        shares: null,
        amountUsd: 100_000,
        percent: null,
        contact: null,
      },
      {
        key: "pool",
        name: "Unallocated pool",
        security: "Pool",
        shares: 1_000_000,
        amountUsd: null,
        percent: 10,
        pool: true,
        contact: null,
      },
    ],
  },
} satisfies Meta<typeof HoldingsTable>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A holder with a contact offers Open contact; one without offers Add as contact; the pool has no menu. */
export const Default: Story = {};

/** No rows: static skeleton rows keep the table's layout. */
export const Placeholder: Story = { args: { rows: [], placeholderRows: 3 } };
