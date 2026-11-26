import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { healthFindingsFixture, reportFixture } from "./fixtures";
import { ReportsTab } from "./ReportsTab";

const meta = { title: "Cap table/Views/ReportsTab", component: ReportsTab } satisfies Meta<
  typeof ReportsTab
>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  beforeEach: () =>
    mockRpc({
      "equity.views.report": reportFixture,
      "equity.healthFindings.list": {
        items: healthFindingsFixture,
        total: 2,
        page: 1,
        pageSize: 200,
      },
      "equity.views.estimatedValue.get": {
        visibility: "hidden",
        pricePerShare: null,
        effectiveDate: null,
        updatedAt: null,
      },
    }),
};

export const HealthChecksEntry: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole("tab", { name: "Health checks" }));
  },
};
