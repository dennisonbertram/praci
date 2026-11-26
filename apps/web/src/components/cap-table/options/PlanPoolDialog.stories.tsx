import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { withPageBehind } from "../../../stories/decorators";
import { PlanPoolDialog } from "./PlanPoolDialog";
import { demoPlanPool } from "./plan-pool-fixture";

const pools = [
  demoPlanPool(),
  demoPlanPool({ planId: "plan-2", name: "2022 Stock Plan", availableShares: "80000" }),
];

const meta = {
  title: "Cap table/Options/PlanPoolDialog",
  component: PlanPoolDialog,
  decorators: [withPageBehind()],
  args: { mode: "increase", pools, planId: "plan-1", onClose: () => {}, onDone: () => {} },
  beforeEach: () =>
    mockRpc({ "equity.planPools.increase": pools[0], "equity.planPools.pourOver": {} }),
} satisfies Meta<typeof PlanPoolDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const IncreasePool: Story = {};
export const PourOver: Story = { args: { mode: "pourOver", planId: "plan-2" } };
