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
