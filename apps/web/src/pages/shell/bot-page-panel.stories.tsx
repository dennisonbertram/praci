import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { BotPagePanel } from "./bot-page-panel";

const chart = {
  name: "Weekly sample",
  spec: { marks: [{ type: "line", options: { x: "week", y: "value" } }] },
  data: [
    { week: 1, value: 4 },
    { week: 2, value: 7 },
    { week: 3, value: 5 },
    { week: 4, value: 9 },
  ],
};

const content = `# Weekly notes

Sample intro text.

- First item
- Second item

\`\`\`chart
${JSON.stringify(chart)}
\`\`\`

After the chart.`;

const page = (revision: number, text = content) => ({
  botId: "bot_demo",
  content: text,
  revision,
  updatedBy: "bot" as const,
  updatedAt: "2026-01-01T00:00:00.000Z",
});

const meta = {
  title: "Shell/Bot page panel",
  component: BotPagePanel,
  parameters: {
    layout: "padded",
    docs: { description: { component: "Also shows: ChartView" } },
  },
  args: { botId: "bot_demo", remote: null },
  decorators: [
    (Story) => (
      <div className="w-[384px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BotPagePanel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WithChart: Story = {
  beforeEach: () => mockRpc({ "pages.get": page(1) }),
};

export const TextOnly: Story = {
  beforeEach: () => mockRpc({ "pages.get": page(1, "# Notes\n\nJust a short page.") }),
};

export const Empty: Story = {
  beforeEach: () => mockRpc({ "pages.get": page(1, "") }),
};

export const NeverWritten: Story = {
  beforeEach: () => mockRpc({ "pages.get": null }),
};

export const LoadError: Story = {
  beforeEach: () =>
    mockRpc({
      "pages.get": () => {
        throw new Error("Could not load the page.");
      },
    }),
};
