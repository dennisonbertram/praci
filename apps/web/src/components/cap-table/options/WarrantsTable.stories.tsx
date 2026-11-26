import type { EquityWarrant } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { WarrantsTable } from "./WarrantsTable";

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

const page = (items: EquityWarrant[]) => ({ items, total: items.length, page: 1, pageSize: 100 });
const warrants = [
  demoWarrant(),
  demoWarrant({
    id: "warrant-2",
    label: "W-2",
    stakeholderName: "Grace Example",
    shareClassName: "Preferred",
    status: "canceled",
    canceledOn: "2025-06-01",
    quantity: "12000",
    exercisePrice: "0.40",
    expirationDate: null,
  }),
];

const meta = {
  title: "Cap table/Options/WarrantsTable",
  component: WarrantsTable,
  beforeEach: () => mockRpc({ "equity.warrants.list": page(warrants) }),
} satisfies Meta<typeof WarrantsTable>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Empty: Story = {
  beforeEach: () => mockRpc({ "equity.warrants.list": page([]) }),
};
