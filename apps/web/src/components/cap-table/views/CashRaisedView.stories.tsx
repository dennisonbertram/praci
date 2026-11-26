import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { CashRaisedView } from "./CashRaisedView";
import { cashRaisedFixture, roundsFixture } from "./fixtures";

const meta = {
  title: "Cap table/Views/CashRaisedView",
  component: CashRaisedView,
  args: { rounds: roundsFixture, onChanged: fn() },
} satisfies Meta<typeof CashRaisedView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WithSecurities: Story = {
  beforeEach: () => mockRpc({ "equity.views.cashRaised": cashRaisedFixture }),
};
export const Loading: Story = {
  beforeEach: () =>
    mockRpc({ "equity.views.cashRaised": () => new Promise<never>(() => undefined) }),
};
