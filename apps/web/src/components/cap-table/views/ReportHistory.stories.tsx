import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { ReportHistory } from "./ReportHistory";

const meta = {
  title: "Cap table/Views/ReportHistory",
  component: ReportHistory,
  args: { onOpen: fn() },
} satisfies Meta<typeof ReportHistory>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WithReports: Story = {
  beforeEach: () =>
    mockRpc({
      "equity.views.reportHistory": [
        {
          id: "run-2",
          kind: "vesting",
          asOf: "2026-10-15",
          groupBy: "share_class",
          fullyDiluted: true,
          includeConvertibles: true,
          createdAt: "2026-10-15T09:30:00.000Z",
        },
        {
          id: "run-1",
          kind: "cap_table",
          asOf: "2026-09-30",
          groupBy: "stakeholder",
          fullyDiluted: false,
          includeConvertibles: true,
          createdAt: "2026-10-01T16:05:00.000Z",
        },
      ],
    }),
};
export const Empty: Story = { beforeEach: () => mockRpc({ "equity.views.reportHistory": [] }) };
