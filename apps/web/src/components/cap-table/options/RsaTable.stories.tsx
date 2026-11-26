import type { EquityCertificate } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { RsaTable } from "./RsaTable";

const certificate = (overrides: Partial<EquityCertificate> = {}): EquityCertificate => ({
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
  ...overrides,
});

const page = <Item,>(items: Item[]) => ({ items, total: items.length, page: 1, pageSize: 500 });

const meta = {
  title: "Cap table/Options/RsaTable",
  component: RsaTable,
  beforeEach: () =>
    mockRpc({
      "equity.planPools.list": [
        {
          planId: "plan-1",
          name: "2026 Stock Plan",
          status: "active",
          reservedShares: "1000000",
          grantedShares: "400000",
          outstandingShares: "300000",
          exercisedShares: "50000",
          returnedShares: "50000",
          issuedShares: "50000",
          availableShares: "650000",
          increases: [],
        },
      ],
      "equity.certificates.list": page([
        certificate(),
        certificate({
          id: "cert-2",
          label: "CS-2",
          stakeholderName: "Riley Okafor",
          quantity: "20000",
          pricePerShare: null,
          status: "canceled",
          canceledOn: "2026-03-01",
        }),
      ]),
      "equity.exercises.list": page([
        {
          id: "ex-1",
          optionGrantId: "grant-1",
          optionGrantLabel: "ISO-1",
          quantity: "1000",
          exerciseDate: "2026-02-10",
          status: "completed",
          paymentCents: 100,
          requestKey: null,
          certificateId: "cert-2",
          createdAt: "2026-02-10T00:00:00.000Z",
          updatedAt: "2026-02-10T00:00:00.000Z",
        },
      ]),
      "equity.stakeholders.list": page([
        { id: "sh-1", name: "Avery Chen" },
        { id: "sh-2", name: "Riley Okafor" },
      ]),
      "equity.plans.get": { id: "plan-1", name: "2026 Stock Plan", shareClassId: "sc-common" },
    }),
} satisfies Meta<typeof RsaTable>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Ledger: Story = {};

export const Empty: Story = {
  beforeEach: () =>
    mockRpc({
      "equity.planPools.list": [],
      "equity.certificates.list": page([]),
      "equity.exercises.list": page([]),
    }),
};
