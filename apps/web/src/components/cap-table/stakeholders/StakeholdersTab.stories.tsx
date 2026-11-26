import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { StakeholdersTab } from "./StakeholdersTab";
import { fixturePage } from "./stakeholder-fixtures";

const meta = {
  title: "Cap table/Stakeholders/Tab",
  component: StakeholdersTab,
  beforeEach: () =>
    mockRpc({ "equity.stakeholders.list": fixturePage(), "equity.customProperties.list": [] }),
} satisfies Meta<typeof StakeholdersTab>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Directory: Story = {};
