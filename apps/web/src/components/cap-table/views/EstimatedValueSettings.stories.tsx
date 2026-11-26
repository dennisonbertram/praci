import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { EstimatedValueSettings } from "./EstimatedValueSettings";
import { byStakeholderFixture } from "./fixtures";

const meta = {
  title: "Cap table/Views/EstimatedValueSettings",
  component: EstimatedValueSettings,
} satisfies Meta<typeof EstimatedValueSettings>;
export default meta;
type Story = StoryObj<typeof meta>;

export const NotSet: Story = {
  beforeEach: () =>
    mockRpc({
      "equity.views.estimatedValue.get": {
        visibility: "hidden",
        pricePerShare: null,
        effectiveDate: null,
        updatedAt: null,
      },
    }),
};
export const VisibleToHolders: Story = {
  beforeEach: () =>
    mockRpc({
      "equity.views.estimatedValue.get": {
        visibility: "holders",
        pricePerShare: "1.25",
        effectiveDate: "2026-06-30",
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
      "equity.views.capTableByStakeholder": byStakeholderFixture,
    }),
};
export const Loading: Story = {
  beforeEach: () =>
    mockRpc({ "equity.views.estimatedValue.get": () => new Promise<never>(() => undefined) }),
};
