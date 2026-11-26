import type { EquityCertificate, EquityCertificateStatus } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { SharesLedger } from "./SharesLedger";

const HOLDERS = ["Avery Lindqvist", "Brook Ventures I, L.P.", "Casey Moreau", "Dana Oyelaran"];
const STATUSES: EquityCertificateStatus[] = [
  "outstanding",
  "outstanding",
  "transferred",
  "canceled",
];

function certificateFixture(
  index: number,
  patch: Partial<EquityCertificate> = {},
): EquityCertificate {
  const preferred = index % 3 === 0;
  return {
    id: `cert-${index}`,
    createdAt: "2026-01-05T10:00:00.000Z",
    updatedAt: "2026-01-05T10:00:00.000Z",
    label: preferred ? `PA-${index}` : `CS-${index}`,
    stakeholderId: `sh-${index % 4}`,
    stakeholderName: HOLDERS[index % 4]!,
    shareClassId: preferred ? "sc-a" : "sc-common",
    shareClassName: preferred ? "Series A Preferred" : "Common",
    planId: null,
    status: STATUSES[index % 4]!,
    acceptanceStatus: index === 2 ? "awaiting_holder_signature" : "accepted",
    paperStatus: "electronic",
    quantity: String(25_000 * (index + 1)),
    pricePerShare: preferred ? "1.2500" : "0.0001",
    pricePaidPerShare: preferred ? "1.2500" : "0.0001",
    cashPaidCents: preferred ? String(25_000 * (index + 1) * 125) : "0",
    debtCanceledCents: "0",
    ipTransferredCents: "0",
    otherConsiderationCents: "0",
    costBasisCents: null,
    issueDate: `2025-0${(index % 9) + 1}-15`,
    originalAcquisitionDate: null,
    issuedBy: null,
    boardApprovedOn: null,
    rule144Date: null,
    federalExemption: "Rule 506(b)",
    stateExemption: null,
    stateOfResidency: "CA",
    legend: null,
    personnel: null,
    collateralized: false,
    vestingScheduleId: null,
    parentId: null,
    roundId: null,
    canceledOn: null,
    adminNotes: null,
    transactionValueCents: preferred ? String(25_000 * (index + 1) * 125) : "0",
    ...patch,
  };
}

const rows = Array.from({ length: 12 }, (_, index) => certificateFixture(index + 1));
const classes = {
  items: [
    { id: "sc-common", name: "Common" },
    { id: "sc-a", name: "Series A Preferred" },
  ],
  total: 2,
  page: 1,
  pageSize: 500,
};

const meta = {
  title: "Cap table/Securities/SharesLedger",
  component: SharesLedger,
  args: { onOpen: () => {}, onAction: () => {} },
} satisfies Meta<typeof SharesLedger>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  beforeEach: () =>
    mockRpc({
      "equity.certificates.list": () => ({
        items: rows,
        total: rows.length,
        page: 1,
        pageSize: 25,
      }),
      "equity.shareClasses.list": () => classes,
      "equity.certificateTotals": { count: rows.length, shares: "1950000" },
    }),
};

export const Empty: Story = {
  beforeEach: () =>
    mockRpc({
      "equity.certificates.list": () => ({ items: [], total: 0, page: 1, pageSize: 25 }),
      "equity.shareClasses.list": () => classes,
    }),
};

export const Loading: Story = {
  beforeEach: () =>
    mockRpc({
      "equity.certificates.list": () => new Promise(() => {}),
      "equity.shareClasses.list": () => classes,
    }),
};
