import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../lib/__mocks__/rpc";
import { CompanyPrivacy } from "./CompanyPrivacy";

const sources = [
  {
    sourceKind: "data_room",
    connectionId: null,
    mcpServerId: null,
    label: "Data room",
    evidenceCount: 30,
    blocked: false,
  },
  {
    sourceKind: "gmail",
    connectionId: "synthetic-mail",
    mcpServerId: null,
    label: "Example mail",
    evidenceCount: 0,
    blocked: true,
  },
];
const meta = {
  title: "Company/Privacy",
  component: CompanyPrivacy,
  args: { onClose: () => {}, onChanged: () => {} },
  beforeEach: () =>
    mockRpc({
      "company.privacy": { sources },
      "company.sourceControl": { ok: true },
      "company.erase": { ok: true },
    }),
  render: (args) => (
    <div className="p-6">
      Company privacy
      <CompanyPrivacy {...args} />
    </div>
  ),
} satisfies Meta<typeof CompanyPrivacy>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Sources: Story = {};
export const Empty: Story = { beforeEach: () => mockRpc({ "company.privacy": { sources: [] } }) };
export const ErrorState: Story = {
  beforeEach: () =>
    mockRpc({
      "company.privacy": () => {
        throw new Error("Could not load privacy controls");
      },
    }),
};
