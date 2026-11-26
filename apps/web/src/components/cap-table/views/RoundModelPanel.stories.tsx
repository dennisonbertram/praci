import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { roundModelFixture } from "./fixtures";
import { RoundModelPanel } from "./RoundModelPanel";

const meta = {
  title: "Cap table/Views/RoundModelPanel",
  component: RoundModelPanel,
} satisfies Meta<typeof RoundModelPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

const scenario = {
  id: "scn-1",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  name: "Series A at 20M",
  preMoneyValuationCents: "2000000000",
  targetPoolPercent: "10",
  investments: [{ name: "Lead Fund", amountCents: "500000000" }],
  convertibleIds: null,
};

export const NewScenario: Story = {
  beforeEach: () =>
    mockRpc({
      "equity.views.scenarios.list": { items: [], total: 0, page: 1, pageSize: 100 },
      "equity.views.modelRound": roundModelFixture,
      "equity.convertibles.list": {
        items: [
          {
            id: "safe-1",
            label: "SAFE-1",
            stakeholderName: "Dee Angel",
            principalCents: "25000000",
          },
        ],
        total: 1,
        page: 1,
        pageSize: 500,
      },
    }),
};
export const WithSavedScenarios: Story = {
  beforeEach: () =>
    mockRpc({
      "equity.views.scenarios.list": { items: [scenario], total: 1, page: 1, pageSize: 100 },
      "equity.views.modelRound": roundModelFixture,
    }),
};
