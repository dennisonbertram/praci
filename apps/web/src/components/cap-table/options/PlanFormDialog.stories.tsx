import type { EquityPlan } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { withPageBehind } from "../../../stories/decorators";
import { PlanFormDialog } from "./PlanFormDialog";

const plan: EquityPlan = {
  id: "plan-1",
  name: "2026 Stock Plan",
  status: "active",
  shareClassId: "sc-common",
  reservedShares: "1000000",
  boardApprovedOn: "2026-01-15",
  outstandingShares: "300000",
  issuedShares: "0",
  availableShares: "650000",
  createdAt: "2026-01-15T00:00:00.000Z",
  updatedAt: "2026-01-15T00:00:00.000Z",
};

const meta = {
  title: "Cap table/Options/PlanFormDialog",
  component: PlanFormDialog,
  decorators: [withPageBehind()],
  args: { onClose: () => {}, onSaved: () => {} },
  beforeEach: () =>
    mockRpc({
      "equity.shareClasses.list": {
        items: [{ id: "sc-common", name: "Common" }],
        total: 1,
        page: 1,
        pageSize: 100,
      },
      "equity.plans.create": plan,
      "equity.plans.update": plan,
    }),
} satisfies Meta<typeof PlanFormDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Add: Story = {};
export const Edit: Story = { args: { plan } };
