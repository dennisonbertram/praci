import type { EquityConvertible } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { withPageBehind } from "../../../stories/decorators";
import { ConvertibleActionDialog } from "./ConvertibleActionDialog";

const safe = {
  id: "cv-1",
  label: "SAFE-1",
  stakeholderName: "Juniper Seed Fund",
  kind: "safe",
  status: "outstanding",
  principalCents: "50000000",
} as EquityConvertible;

const meta = {
  title: "Cap table/Securities/ConvertibleActionDialog",
  component: ConvertibleActionDialog,
  decorators: [withPageBehind()],
  args: { action: "priced-round", convertibles: [safe], onOpenChange: () => {}, onDone: () => {} },
  beforeEach: () =>
    mockRpc({
      "equity.shareClasses.list": {
        items: [{ id: "sc-a", name: "Series A Preferred" }],
        total: 1,
        page: 1,
        pageSize: 500,
      },
      "equity.fundingRounds.list": {
        items: [{ id: "round-seed", name: "Seed" }],
        total: 1,
        page: 1,
        pageSize: 200,
      },
    }),
} satisfies Meta<typeof ConvertibleActionDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const PricedRound: Story = {};
export const Cancel: Story = { args: { action: "cancel" } };
