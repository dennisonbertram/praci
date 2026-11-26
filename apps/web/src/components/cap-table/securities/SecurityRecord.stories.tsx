import type { EquityCertificate, EquityConvertible } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { withPageBehind } from "../../../stories/decorators";
import { SecurityRecord } from "./SecurityRecord";

const certificate = {
  id: "cert-7",
  label: "CS-7",
  stakeholderId: "sh-1",
  stakeholderName: "Avery Lindqvist",
  shareClassName: "Common",
  status: "outstanding",
  quantity: "400000",
  pricePerShare: "0.0001",
  pricePaidPerShare: "0.0001",
  cashPaidCents: "4000",
  debtCanceledCents: "0",
  ipTransferredCents: "0",
  otherConsiderationCents: "0",
  transactionValueCents: "4000",
  issueDate: "2025-02-01",
  boardApprovedOn: "2025-01-28",
  issuedBy: "Morgan Hale",
  federalExemption: "Section 4(a)(2)",
  stateExemption: null,
  stateOfResidency: "CA",
  rule144Date: null,
  legend: "THESE SECURITIES HAVE NOT BEEN REGISTERED UNDER THE SECURITIES ACT OF 1933.",
  personnel: {
    name: "Avery Lindqvist",
    email: "avery@example.test",
    taxId: "000-00-1234",
    relationship: "Founder",
  },
} as EquityCertificate;

const note = {
  id: "cv-3",
  label: "NOTE-3",
  stakeholderName: "Oak Lane Capital",
  kind: "note",
  status: "outstanding",
  principalCents: "25000000",
  valuationCapCents: "800000000",
  valuationCapType: "pre_money",
  discountPercent: "20.0000000000",
  interestRate: "6.0000000000",
  interestType: "simple",
  interestStartDate: "2024-03-01",
  maturityDate: "2026-03-01",
  interestAccruedCents: "2687671",
  totalCents: "27687671",
  mfn: false,
  proRata: true,
  issueDate: "2024-03-01",
  closedOn: null,
} as EquityConvertible;

const history = {
  items: [
    {
      id: "tx-1",
      kind: "issue",
      effectiveDate: "2025-02-01",
      quantity: "400000",
      reason: null,
      note: null,
    },
  ],
  total: 1,
  page: 1,
  pageSize: 100,
};

const meta = {
  title: "Cap table/Securities/SecurityRecord",
  component: SecurityRecord,
  decorators: [withPageBehind()],
  args: {
    kind: "certificate",
    id: "cert-7",
    onOpenChange: () => {},
    onCertificateAction: () => {},
  },
} satisfies Meta<typeof SecurityRecord>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Certificate: Story = {
  beforeEach: () =>
    mockRpc({ "equity.certificates.get": certificate, "equity.transactions.list": history }),
};
/** No details recorded at issue: Personnel shows the holder as the Stakeholders tab has them. */
export const PersonnelFromStakeholder: Story = {
  beforeEach: () =>
    mockRpc({
      "equity.certificates.get": { ...certificate, personnel: null },
      "equity.transactions.list": history,
      "equity.stakeholders.get": {
        id: "sh-1",
        name: "Avery Lindqvist",
        contactEmail: "avery@example.test",
        relationship: "employee",
      },
    }),
};
export const Note: Story = {
  args: { kind: "convertible", id: "cv-3" },
  beforeEach: () =>
    mockRpc({ "equity.convertibles.get": note, "equity.transactions.list": history }),
};
export const CanceledWithClosureOnly: Story = {
  args: { kind: "convertible", id: "cv-canceled" },
  beforeEach: () =>
    mockRpc({
      "equity.convertibles.get": {
        ...note,
        id: "cv-canceled",
        label: "SAFE-4",
        kind: "safe",
        status: "canceled",
        canceledOn: null,
        cancellationReason: null,
        closedOn: "2024-07-01",
      },
      "equity.transactions.list": history,
    }),
};
export const ConvertedWithClosureOnly: Story = {
  args: { kind: "convertible", id: "cv-converted" },
  beforeEach: () =>
    mockRpc({
      "equity.convertibles.get": {
        ...note,
        id: "cv-converted",
        status: "converted",
        convertedToLabel: null,
        closedOn: "2024-09-01",
      },
      "equity.transactions.list": history,
    }),
};
export const Loading: Story = {
  beforeEach: () => mockRpc({ "equity.certificates.get": () => new Promise(() => {}) }),
};
