import type { Meta, StoryObj } from "@storybook/react-vite";
import { IssueDateFilter } from "./IssueDateFilter";

const meta = {
  title: "Cap table/Securities/IssueDateFilter",
  component: IssueDateFilter,
  args: { from: undefined, to: undefined, onChange: () => {} },
} satisfies Meta<typeof IssueDateFilter>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Unset: Story = {};
export const Range: Story = { args: { from: "2025-01-01", to: "2025-06-30" } };
