import { ChatMarkdown } from "@rakazo/chat-ui/web";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";

/**
 * The table card lives in packages/chat-ui/src/markdown-table.tsx. That package has no Storybook
 * setup, so these stories render it through ChatMarkdown, the way chat does.
 */
const meta = {
  title: "Chat/Markdown table",
  component: ChatMarkdown,
  decorators: [
    (Story) => (
      <div className="w-[640px] max-w-full">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Also shows: TableCard, TableView, SortableColumnHeader, SortIndicator, DownloadIcon, ExpandIcon, CloseIcon, ChevronUpIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon",
      },
    },
  },
} satisfies Meta<typeof ChatMarkdown>;
export default meta;
type Story = StoryObj<typeof meta>;

const small = `| Plan | Seats | Price |
| :--- | ---: | ---: |
| Starter | 3 | $12.00 |
| Team | 10 | $48.50 |
| Business | 40 | $190.00 |`;

const manyRows = [
  "| Item | Quantity | Note |",
  "| --- | ---: | --- |",
  ...Array.from(
    { length: 24 },
    (_, i) => `| Sample item ${i + 1} | ${(i * 7) % 31} | Row ${i + 1} |`,
  ),
].join("\n");

const inline = `| Name | Link | Status |
| --- | --- | --- |
| **Demo report** | [Open](https://example.com/report) | \`ready\` |
| _Draft notes_ | [Open](https://example.com/notes) | \`draft\` |`;

const wide = `| A very long column heading about the quarterly sample figures | Another long heading for the second sample column | Third |
| --- | --- | --- |
| A long cell value that goes on for quite a while so the column has to scroll or truncate | Another long value used to check overflow | x |`;

export const Default: Story = { args: { children: small } };

export const Paginated: Story = { args: { children: manyRows } };

export const InlineMarkup: Story = { args: { children: inline } };

export const WideContent: Story = { args: { children: wide } };

/** Sorting a column shows the indicator in the header. */
export const Sorted: Story = {
  args: { children: small },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByLabelText("Sort by Price"));
  },
};

/** The expand button opens the table in a dialog (shows the close icon). */
export const Expanded: Story = {
  args: { children: small },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByLabelText("Expand table"));
    await expect(within(document.body).getByLabelText("Close table")).toBeTruthy();
  },
};
