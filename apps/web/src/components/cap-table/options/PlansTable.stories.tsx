import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { PlansTable } from "./PlansTable";
import { demoPlanPool } from "./plan-pool-fixture";

const meta = {
  title: "Cap table/Options/PlansTable",
  component: PlansTable,
  args: { onIncrease: () => {}, onPourOver: () => {} },
  beforeEach: () =>
    mockRpc({
      "equity.planPools.list": [
        demoPlanPool(),
        demoPlanPool({ planId: "plan-2", name: "2022 Stock Plan", status: "inactive" }),
      ],
    }),
} satisfies Meta<typeof PlansTable>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
/** One plan: nothing to pour over into. */
export const OnePlan: Story = {
  beforeEach: () => mockRpc({ "equity.planPools.list": [demoPlanPool()] }),
};
export const Empty: Story = { beforeEach: () => mockRpc({ "equity.planPools.list": [] }) };
