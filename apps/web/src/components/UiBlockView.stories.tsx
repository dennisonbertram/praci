import type { UiBlock } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { setHideAmounts } from "../lib/hide-amounts-preference";
import { UiBlockView } from "./UiBlockView";

const meta = { title: "Chat/UiBlockView", component: UiBlockView } satisfies Meta<
  typeof UiBlockView
>;
export default meta;
type Story = StoryObj<typeof meta>;

const story = (block: UiBlock): Story => ({ args: { block } });

const spending: UiBlock = {
  type: "table",
  title: "Spend by category, last month",
  columns: [
    { label: "Category" },
    { label: "Transactions", align: "right" },
    { label: "Total", align: "right" },
  ],
  rows: [
    ["Software", 14, "$4,210.00"],
    ["Travel", 6, "$1,980.50"],
    ["Meals", 22, "$865.25"],
    ["Office", 3, "$310.00"],
  ],
};

export const Table: Story = story(spending);

export const TableAmountsHidden: Story = {
  ...story(spending),
  beforeEach: () => {
    setHideAmounts(true);
    return () => setHideAmounts(false);
  },
};

/** 8 columns and 50 rows, the largest a table can be: it scrolls inside the bubble. */
export const LongTable: Story = story({
  type: "table",
  title: "Sample ledger",
  columns: Array.from({ length: 8 }, (_, c) => ({
    label: `Column ${c + 1}`,
    align: c > 3 ? ("right" as const) : undefined,
  })),
  rows: Array.from({ length: 50 }, (_, r) =>
    Array.from({ length: 8 }, (_, c) =>
      c > 3 ? (r + 1) * (c + 1) * 17 : `Row ${r + 1} value ${c + 1}`,
    ),
  ),
});

export const Sections: Story = story({
  type: "sections",
  sections: [
    { heading: "What happened", body: "Three invoices were paid late. **Two** were under $500." },
    { heading: "Why", body: "- The card on file expired\n- A vendor changed its bank details" },
    { heading: "Next step", body: "Update the card, then retry the failed payments." },
  ],
});

export const Summary: Story = story({
  type: "summary",
  title: "Acme Co renewal",
  items: [
    { label: "Plan", value: "Team, annual" },
    { label: "Renews", value: "March 3" },
    { label: "Amount", value: "$2,400.00" },
    { label: "Owner", value: "Demo Teammate" },
  ],
});

export const Stats: Story = story({
  type: "stats",
  stats: [
    { label: "Cash", value: "$125,000", hint: "+$4,200 this month" },
    { label: "Burn", value: "$8,500", hint: "per month" },
    { label: "Runway", value: "14.7 mo" },
    { label: "Open invoices", value: "9" },
  ],
});

export const Cards: Story = story({
  type: "cards",
  cards: [
    {
      title: "Quarterly planning",
      subtitle: "Thursday 10:00",
      body: "Review **goals** and [staffing](/app/calendar).",
      badge: "Today",
      href: "/app/calendar",
    },
    {
      title: "Release notes",
      subtitle: "Docs",
      body: "Draft is ready for review.",
      href: "https://example.com/notes",
    },
    { title: "Vendor contract", badge: "Needs review" },
  ],
});

export const CalloutTones: Story = {
  args: { block: { type: "callout", tone: "info", body: "Heads up" } },
  render: () => (
    <div className="flex flex-col gap-2">
      <UiBlockView
        block={{
          type: "callout",
          tone: "info",
          title: "Heads up",
          body: "Numbers are as of this morning.",
        }}
      />
      <UiBlockView
        block={{ type: "callout", tone: "success", body: "All three payments went through." }}
      />
      <UiBlockView
        block={{
          type: "callout",
          tone: "warning",
          title: "Card expires soon",
          body: "Update it before **March 1** to avoid failed payments.",
        }}
      />
      <UiBlockView
        block={{
          type: "callout",
          tone: "danger",
          title: "Payment failed",
          body: "The bank declined the transfer.",
        }}
      />
    </div>
  ),
};

/** Narrow phone width: tiles stack in two columns and the table scrolls sideways. */
export const Narrow: Story = {
  args: { block: spending },
  render: () => (
    <div className="flex w-[320px] flex-col gap-2">
      <UiBlockView block={spending} />
      <UiBlockView
        block={{
          type: "stats",
          stats: [
            { label: "Cash", value: "$125,000" },
            { label: "Burn", value: "$8,500" },
          ],
        }}
      />
    </div>
  ),
};
