import type { Meta, StoryObj } from "@storybook/react-vite";
import { byStakeholderFixture } from "./fixtures";
import { StakeholderCapTable } from "./StakeholderCapTable";

const meta = {
  title: "Cap table/Views/StakeholderCapTable",
  component: StakeholderCapTable,
  args: { table: byStakeholderFixture, fullyDiluted: false },
} satisfies Meta<typeof StakeholderCapTable>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Outstanding: Story = {};
export const FullyDiluted: Story = { args: { fullyDiluted: true } };
export const Empty: Story = {
  args: { table: { ...byStakeholderFixture, rows: [] } },
};
