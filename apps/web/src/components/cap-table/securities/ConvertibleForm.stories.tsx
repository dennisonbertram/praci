import type { EquityConvertible } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { withPageBehind } from "../../../stories/decorators";
import { ConvertibleForm } from "./ConvertibleForm";

const note = {
  id: "cv-2",
  label: "NOTE-1",
  stakeholderId: "sh-2",
  stakeholderName: "Juniper Seed Fund",
  kind: "note",
  status: "outstanding",
  blockId: "cb-1",
  principalCents: "250000000",
  issueDate: "2025-03-14",
  interestRate: "8",
  interestType: "simple",
} as EquityConvertible;

const meta = {
  title: "Cap table/Securities/ConvertibleForm",
  component: ConvertibleForm,
  decorators: [withPageBehind()],
  args: { onOpenChange: () => {}, onSaved: () => {} },
  beforeEach: () =>
    mockRpc({
      "equity.stakeholders.list": {
        items: [
          { id: "sh-1", name: "Ada Vale" },
          { id: "sh-2", name: "Juniper Seed Fund" },
        ],
        total: 2,
        page: 1,
        pageSize: 500,
      },
      "equity.convertibleBlocks.list": [
        { id: "cb-1", name: "SAFE round — Summer 2025", kind: "safe" },
      ],
    }),
} satisfies Meta<typeof ConvertibleForm>;
export default meta;
type Story = StoryObj<typeof meta>;

export const NewSafe: Story = { args: { convertible: null } };
export const EditNote: Story = { args: { convertible: note } };
