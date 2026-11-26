import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { getHideAmounts, setHideAmounts } from "../../lib/hide-amounts-preference";
import { HoldingsTable } from "./HoldingsTable";

function HiddenAmounts({ children }: { children: ReactNode }) {
  useEffect(() => {
    const previous = getHideAmounts();
    setHideAmounts(true);
    return () => setHideAmounts(previous);
  }, []);
  return children;
}

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

/** Phone: shares and the labelled invested amount wrap under the name instead of truncating. */
export const Phone: Story = { globals: { viewport: { value: "mobile1" } } };

/** Filtered to one security with the holder sorted descending. */
export const Sorted: Story = {
  parameters: { initialEntries: ["/?sort=holder&dir=desc&security=Seed%20Preferred"] },
};

/** The global preference masks invested amounts while preserving their sortable values. */
export const AmountsHidden: Story = {
  decorators: [
    (Story) => (
      <HiddenAmounts>
        <Story />
      </HiddenAmounts>
    ),
  ],
};
