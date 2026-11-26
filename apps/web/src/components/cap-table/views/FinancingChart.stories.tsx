import type { Meta, StoryObj } from "@storybook/react-vite";
import { FinancingChart } from "./FinancingChart";

const meta = {
  title: "Cap table/Views/FinancingChart",
  component: FinancingChart,
  args: {
    bars: [
      { id: "r1", label: "Pre-seed", cents: "50000000" },
      { id: "r2", label: "Seed", cents: "200000000" },
      { id: "r3", label: "Series A", cents: "800000000" },
    ],
  },
} satisfies Meta<typeof FinancingChart>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Rounds: Story = {};
export const OneRound: Story = {
  args: { bars: [{ id: "r1", label: "Seed", cents: "150000000" }] },
};
export const NothingRaised: Story = {
  args: { bars: [{ id: "r1", label: "Founding", cents: "0" }] },
};
