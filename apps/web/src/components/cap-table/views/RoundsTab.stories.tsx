import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { cashRaisedFixture, roundsFixture } from "./fixtures";
import { RoundsTab } from "./RoundsTab";

const meta = { title: "Cap table/Views/RoundsTab", component: RoundsTab } satisfies Meta<
  typeof RoundsTab
>;
export default meta;
type Story = StoryObj<typeof meta>;

const page = (items: unknown[]) => ({ items, total: items.length, page: 1, pageSize: 200 });
export const WithRounds: Story = {
  beforeEach: () =>
    mockRpc({
      "equity.fundingRounds.list": page(roundsFixture),
      "equity.views.cashRaised": cashRaisedFixture,
    }),
};
export const Empty: Story = {
  beforeEach: () => mockRpc({ "equity.fundingRounds.list": page([]) }),
};
export const Loading: Story = {
  beforeEach: () =>
    mockRpc({ "equity.fundingRounds.list": () => new Promise<never>(() => undefined) }),
};
