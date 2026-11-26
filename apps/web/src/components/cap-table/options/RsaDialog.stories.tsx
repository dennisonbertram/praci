import type { EquityCertificate } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { withPageBehind } from "../../../stories/decorators";
import { RsaDialog } from "./RsaDialog";

const certificate: EquityCertificate = {
  id: "cert-1",
  label: "CS-1",
  stakeholderId: "sh-1",
  stakeholderName: "Avery Chen",
  shareClassId: "sc-common",
  shareClassName: "Common",
  planId: "plan-1",
  status: "outstanding",
  acceptanceStatus: "accepted",
  paperStatus: "electronic",
  quantity: "50000",
  pricePerShare: "0.001",
  pricePaidPerShare: "0.001",
  cashPaidCents: "5000",
  debtCanceledCents: "0",
  ipTransferredCents: "0",
  otherConsiderationCents: "0",
  transactionValueCents: "5000",
  costBasisCents: "5000",
  issueDate: "2026-02-01",
  canceledOn: null,
  originalAcquisitionDate: null,
  issuedBy: null,
  boardApprovedOn: null,
  rule144Date: null,
  federalExemption: null,
  stateExemption: null,
  stateOfResidency: null,
  legend: null,
  personnel: null,
  collateralized: false,
  vestingScheduleId: null,
  parentId: null,
  roundId: null,
  adminNotes: null,
  createdAt: "2026-02-01T00:00:00.000Z",
  updatedAt: "2026-02-01T00:00:00.000Z",
};

const plans = [
  { id: "plan-1", name: "2026 Stock Plan" },
  { id: "plan-2", name: "2022 Stock Plan" },
];

const meta = {
  title: "Cap table/Options/RsaDialog",
  component: RsaDialog,
  decorators: [withPageBehind()],
  args: { mode: "issue", plans, onClose: () => {}, onDone: () => {} },
  beforeEach: () =>
    mockRpc({
      "equity.stakeholders.list": {
        items: [
          { id: "sh-1", name: "Avery Chen" },
          { id: "sh-2", name: "Riley Okafor" },
        ],
        total: 2,
        page: 1,
        pageSize: 500,
      },
      "equity.plans.get": {
        id: "plan-1",
        name: "2026 Stock Plan",
        shareClassId: "sc-common",
      },
      "equity.certificates.create": certificate,
      "equity.certificates.update": { ...certificate, status: "canceled" },
    }),
} satisfies Meta<typeof RsaDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Issue: Story = {};
export const Cancel: Story = {
  args: { mode: "cancel", certificate },
};
