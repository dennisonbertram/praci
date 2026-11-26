import type { Meta, StoryObj } from "@storybook/react-vite";
import { SelectionBar } from "./SelectionBar";

const meta = {
  title: "DataRoom/SelectionBar",
  component: SelectionBar,
  args: {
    count: 3,
    onMove: () => {},
    onDownload: () => {},
    onSend: () => {},
    onClear: () => {},
    agents: [
      { id: "bot_ada", name: "Ada", color: "#6366f1" },
      { id: "bot_ben", name: "Ben", color: "#10b981" },
    ],
    onSendToAgent: () => {},
  },
} satisfies Meta<typeof SelectionBar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Selected: Story = {};
export const Busy: Story = { args: { busy: true } };
export const PendingSelectAll: Story = {
  args: {
    count: 3,
    total: 12,
    onSelectAll: () => new Promise<void>(() => {}),
  },
};
export const NoMailbox: Story = { args: { onSend: undefined } };
/** At a phone width the bar stays one row of icon buttons with accessible names. */
export const Phone: Story = {
  args: { count: 1, total: 67, onSelectAll: () => {} },
  decorators: [
    (Story) => (
      <div className="@container/bd relative h-24 w-[390px] border">
        <Story />
      </div>
    ),
  ],
};
