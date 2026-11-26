import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { reportFixture } from "./fixtures";
import { ReportViewer } from "./ReportViewer";

const meta = {
  title: "Cap table/Views/ReportViewer",
  component: ReportViewer,
  args: { kind: "cap_table" },
} satisfies Meta<typeof ReportViewer>;
export default meta;
type Story = StoryObj<typeof meta>;

export const CapTable: Story = {
  beforeEach: () => mockRpc({ "equity.views.report": reportFixture }),
};
export const Empty: Story = {
  args: { kind: "vesting" },
  beforeEach: () =>
    mockRpc({ "equity.views.report": { ...reportFixture, kind: "vesting", rows: [] } }),
};
export const Loading: Story = {
  beforeEach: () => mockRpc({ "equity.views.report": () => new Promise<never>(() => undefined) }),
};
