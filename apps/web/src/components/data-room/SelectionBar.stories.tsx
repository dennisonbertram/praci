import type { Meta, StoryObj } from "@storybook/react-vite";
import { SelectionBar } from "./SelectionBar";

const meta = {
  title: "DataRoom/SelectionBar",
  component: SelectionBar,
  args: { count: 3, onDownload: () => {}, onSend: () => {}, onClear: () => {} },
} satisfies Meta<typeof SelectionBar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Selected: Story = {};
export const Busy: Story = { args: { busy: true } };
export const NoMailbox: Story = { args: { onSend: undefined } };
