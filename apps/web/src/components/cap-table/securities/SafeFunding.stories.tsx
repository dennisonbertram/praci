import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { SafeFunding } from "./SafeFunding";

const meta = { title: "Cap table/Securities/SafeFunding", component: SafeFunding } satisfies Meta<
  typeof SafeFunding
>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Approved: Story = {
  beforeEach: () =>
    mockRpc({
      "equity.safeFunding.get": {
        approvedCents: "300000000",
        raisedCents: "125000000",
        remainingCents: "175000000",
      },
    }),
};
export const NotApproved: Story = {
  beforeEach: () =>
    mockRpc({
      "equity.safeFunding.get": {
        approvedCents: null,
        raisedCents: "125000000",
        remainingCents: null,
      },
    }),
};
