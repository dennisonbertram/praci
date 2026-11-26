import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { StakeholderProfile } from "./StakeholderProfile";
import { fixtureStakeholder } from "./stakeholder-fixtures";

const noop = () => undefined;
const empty = { items: [], total: 0, page: 1, pageSize: 500 };
const meta = {
  title: "Cap table/Stakeholders/Profile",
  component: StakeholderProfile,
  args: {
    stakeholder: fixtureStakeholder(),
    customProperties: [
      {
        id: "cp-1",
        name: "Office",
        hrisField: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    onBack: noop,
    onEdit: noop,
    onEditProperties: noop,
    onTerminate: noop,
    onDownloadContact: noop,
  },
  beforeEach: () =>
    mockRpc({
      "equity.certificates.list": empty,
      "equity.convertibles.list": empty,
      "equity.optionGrants.list": empty,
    }),
} satisfies Meta<typeof StakeholderProfile>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Employee: Story = {};

export const Investor: Story = {
  args: {
    stakeholder: fixtureStakeholder({
      type: "organization",
      name: "Orchard Seed Fund",
      firstName: null,
      lastName: null,
      relationship: "investor",
      properties: [],
    }),
  },
};

export const Terminated: Story = {
  args: {
    stakeholder: fixtureStakeholder({ terminatedOn: "2026-06-30", relationship: "ex_employee" }),
  },
};
