import type { EquityWarrant } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { withPageBehind } from "../../../stories/decorators";
import { WarrantDialog } from "./WarrantDialog";

/** An invented outstanding warrant for stories and tests. */
const demoWarrant = (overrides: Partial<EquityWarrant> = {}): EquityWarrant => ({
  id: "warrant-1",
  label: "W-1",
  stakeholderId: "sh-1",
  stakeholderName: "Ada Example",
  shareClassId: "sc-common",
  shareClassName: "Common",
  quantity: "50000",
  exercisePrice: "0.25",
  issueDate: "2025-03-04",
  expirationDate: "2035-03-04",
  status: "outstanding",
  canceledOn: null,
  adminNotes: null,
  createdAt: "2025-03-04T00:00:00.000Z",
  updatedAt: "2025-03-04T00:00:00.000Z",
  ...overrides,
});

const meta = {
  title: "Cap table/Options/WarrantDialog",
  component: WarrantDialog,
  decorators: [withPageBehind()],
  args: { mode: "issue", onClose: () => {}, onSaved: () => {} },
  beforeEach: () =>
    mockRpc({
      "equity.stakeholders.list": {
        items: [{ id: "sh-1", name: "Ada Example" }],
        total: 1,
        page: 1,
        pageSize: 500,
      },
      "equity.shareClasses.list": {
        items: [{ id: "sc-common", name: "Common" }],
        total: 1,
        page: 1,
        pageSize: 100,
      },
    }),
} satisfies Meta<typeof WarrantDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Issue: Story = {};
export const Cancel: Story = { args: { mode: "cancel", warrant: demoWarrant() } };
