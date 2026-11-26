import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { OptionsPlansPage } from "./OptionsPlansPage";
import { demoOptionGrant } from "./option-grant-fixture";
import { demoPlanPool } from "./plan-pool-fixture";

const meta = {
  title: "Cap table/Options/OptionsPlansPage",
  component: OptionsPlansPage,
  parameters: { initialEntries: ["/app/cap-table/plans/grants"] },
  beforeEach: () =>
    mockRpc({
      "equity.planPools.list": [
        demoPlanPool(),
        demoPlanPool({ planId: "plan-2", name: "2022 Stock Plan", status: "inactive" }),
      ],
      "equity.optionGrants.list": {
        items: [demoOptionGrant(), demoOptionGrant({ id: "grant-2", label: "ES-41" })],
        total: 2,
        page: 1,
        pageSize: 25,
      },
    }),
} satisfies Meta<typeof OptionsPlansPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const OptionGrants: Story = {};
export const EquityPlans: Story = {
  parameters: { initialEntries: ["/app/cap-table/plans/equity-plans"] },
};
