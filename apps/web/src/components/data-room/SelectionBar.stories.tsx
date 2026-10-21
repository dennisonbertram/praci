import type { Meta, StoryObj } from "@storybook/react-vite";
import { SelectionBar } from "./SelectionBar";

const meta = {
  title: "DataRoom/SelectionBar",
  component: SelectionBar,
  args: {
    count: 3,
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
export const NoMailbox: Story = { args: { onSend: undefined } };
