import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChatMarkdown } from "./markdown.web";
import { MarkdownTable } from "./markdown-table";

const small = `| Fruit | Count | Note |
| --- | ---: | --- |
| Apple | 12 | **crisp** |
| Pear | 7 | \`ripe\` |
| Plum | 31 | |`;

const many = [
  "| Item | Quantity |",
  "| --- | ---: |",
  ...Array.from({ length: 40 }, (_, i) => `| Item ${i + 1} | ${(i * 7) % 50} |`),
].join("\n");

const empty = "| Name | Value |\n| --- | --- |";

// MarkdownTable renders only through the markdown renderer, which supplies the parsed table node.
const meta = {
  title: "Chat/MarkdownTable",
  component: MarkdownTable,
  decorators: [
    (Story) => (
      <div className="w-[560px] max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MarkdownTable>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <ChatMarkdown>{small}</ChatMarkdown> };
export const Paginated: Story = { render: () => <ChatMarkdown>{many}</ChatMarkdown> };
export const NoRows: Story = { render: () => <ChatMarkdown>{empty}</ChatMarkdown> };

const wide = `| Merchant | Date | Category | Amount |
| --- | --- | --- | ---: |
| Amazon Web Services | Oct 3 | Software | $4,210.00 |
| Rivet Legal LLP | Oct 9 | Legal | $12,500.00 |
| Blue Bottle Coffee | Oct 12 | Meals | $86.40 |`;

const vendors = `| Vendor | Category | Amount | Share |
| --- | --- | ---: | ---: |
| Amazon Web Services | Software | $4,210.00 | 31% |
| Rivet Legal LLP | Legal | $12,500.00 | 48% |
| Blue Bottle Coffee | Meals | $86.40 | 1% |
| Gusto | Payroll | $3,900.00 | 15% |
| Notion Labs | Software | $240.00 | 5% |`;

/** The docked Ask panel is about 263 px wide: no row numbers, text columns keep a readable width, the rest scrolls sideways with an edge fade. */
export const NarrowPanel: Story = {
  decorators: [
    (Story) => (
      <div className="rk-docked-chat" style={{ width: 263 }}>
        <Story />
      </div>
    ),
  ],
  render: () => <ChatMarkdown>{wide}</ChatMarkdown>,
};

export const NarrowPanelVendors: Story = {
  decorators: NarrowPanel.decorators,
  render: () => <ChatMarkdown>{vendors}</ChatMarkdown>,
};
