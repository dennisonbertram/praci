import { createUiArtifact, type UiArtifactInput } from "@rakazo/ui-artifact";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { setHideAmounts } from "../lib/hide-amounts-preference";
import { UiArtifactView } from "./UiArtifactView";

// Invented data. The source is built the way the create_ui_artifact tool builds it.
const dashboard: UiArtifactInput = {
  title: "Weekly summary",
  blocks: [
    { type: "heading", text: "Weekly summary", level: 1 },
    { type: "text", text: "Week 42 at a glance. All figures are invented.", muted: true },
    {
      type: "grid",
      columns: 3,
      children: [
        { type: "metric", label: "Revenue", value: "$48,200", delta: "+4.2% vs last week" },
        { type: "metric", label: "New customers", value: "126", delta: "-3 vs last week" },
        { type: "metric", label: "Uptime", value: "99.98%" },
      ],
    },
    {
      type: "card",
      title: "Revenue by day",
      children: [
        {
          type: "chart",
          kind: "bar",
          labels: ["Mon", "Tue", "Wed", "Thu", "Fri"],
          series: [{ name: "Revenue", values: [8200, 9100, 7600, 11200, 12100] }],
          money: true,
        },
      ],
    },
    {
      type: "card",
      title: "Signups",
      children: [
        {
          type: "chart",
          kind: "line",
          labels: ["Mon", "Tue", "Wed", "Thu", "Fri"],
          series: [
            { name: "Web", values: [12, 18, 15, 22, 27] },
            { name: "Mobile", values: [8, 9, 14, 12, 19] },
          ],
        },
      ],
    },
    {
      type: "table",
      columns: ["Plan", "Seats", "Monthly"],
      rows: [
        ["Team", 12, "$1,188"],
        ["Business", 40, "$7,960"],
        ["Enterprise", 250, "$41,000"],
      ],
    },
    { type: "divider" },
    { type: "heading", text: "Follow-ups", level: 2 },
    {
      type: "list",
      items: ["Renew the Business contract", "Review the churn list"],
      ordered: true,
    },
    { type: "badge", text: "On track", tone: "success" },
  ],
};

function source(input: UiArtifactInput): string {
  const created = createUiArtifact(input);
  if (!created.ok) throw new Error(created.errors.join("; "));
  return created.source;
}

const meta = {
  title: "Files/UiArtifactView",
  component: UiArtifactView,
  args: { source: source(dashboard) },
  decorators: [
    (Story) => (
      <div className="h-[1150px] max-w-[1100px] overflow-hidden rounded-2xl border border-border">
        <Story />
      </div>
    ),
  ],
  beforeEach: () => setHideAmounts(false),
} satisfies Meta<typeof UiArtifactView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Every block type: heading, text, metrics in a grid, bar and line charts in cards, a table, a list and a badge. */
export const Default: Story = {};

/** With Hide money on, amounts in text and numeric table cells are masked, and a chart marked as money is hidden. */
export const AmountsHidden: Story = {
  beforeEach: () => {
    setHideAmounts(true);
    return () => setHideAmounts(false);
  },
};

/** Markup in a string shows as text; a component or prop outside the vocabulary is dropped and noted. */
export const UnknownAndMarkup: Story = {
  args: {
    source: [
      'root = Stack([Heading("<img src=x onerror=alert(1)>", 2), Text("**not bold** [not a link](https://example.com)"), Button("Go"), Image("https://example.com/a.png"), Divider()])',
    ].join("\n"),
  },
};

export const Empty: Story = { args: { source: "" } };
