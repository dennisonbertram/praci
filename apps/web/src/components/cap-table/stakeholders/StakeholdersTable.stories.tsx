import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { StakeholdersTable } from "./StakeholdersTable";
import { fixturePage } from "./stakeholder-fixtures";

const noop = () => undefined;
const meta = {
  title: "Cap table/Stakeholders/Table",
  component: StakeholdersTable,
  args: {
    filters: {},
    onOpen: noop,
    onEdit: noop,
    onEditProperties: noop,
    onTerminate: noop,
    selected: [],
    onSelectedChange: noop,
  },
} satisfies Meta<typeof StakeholdersTable>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Loaded: Story = {
  beforeEach: () => mockRpc({ "equity.stakeholders.list": fixturePage() }),
};

export const Selected: Story = {
  args: { selected: ["sh-1", "sh-3"] },
  beforeEach: () => mockRpc({ "equity.stakeholders.list": fixturePage() }),
};

export const Empty: Story = {
  beforeEach: () => mockRpc({ "equity.stakeholders.list": fixturePage(0) }),
};
