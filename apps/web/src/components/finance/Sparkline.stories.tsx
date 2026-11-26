import type { Meta, StoryObj } from "@storybook/react-vite";
import { withVisibleRoot } from "../../stories/decorators";
import { Sparkline } from "./Sparkline";

const meta = {
  title: "Finance/Sparkline",
  component: Sparkline,
} satisfies Meta<typeof Sparkline>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Up: Story = { args: { values: [100, 102, 101, 105, 108, 107, 112] } };
export const Down: Story = { args: { values: [112, 110, 111, 106, 104, 105, 99] } };
export const Flat: Story = { args: { values: [1, 1.0001, 0.9999, 1, 1.0002, 1, 1] } };
/** Fewer than two values draw nothing. */
export const Empty: Story = {
  args: { values: [] },
  decorators: [withVisibleRoot("No sparkline data")],
};
