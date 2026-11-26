import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { withVisibleRoot } from "../../stories/decorators";
import { FailedChip } from "./FailedChip";

const meta = {
  title: "DataRoom/FailedChip",
  component: FailedChip,
  args: { count: 1, onClick: fn() },
} satisfies Meta<typeof FailedChip>;
export default meta;
type Story = StoryObj<typeof meta>;

export const One: Story = {};
export const Several: Story = { args: { count: 4 } };
/** Nothing failed: the chip is not rendered. */
export const None: Story = {
  args: { count: 0 },
  decorators: [withVisibleRoot("No failed items")],
};
