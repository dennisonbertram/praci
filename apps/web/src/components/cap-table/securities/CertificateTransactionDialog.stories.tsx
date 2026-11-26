import type { EquityCertificate } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { withPageBehind } from "../../../stories/decorators";
import { CertificateTransactionDialog } from "./CertificateTransactionDialog";

const certificate = {
  id: "cert-7",
  label: "CS-7",
  stakeholderId: "sh-1",
  stakeholderName: "Avery Lindqvist",
  shareClassId: "sc-common",
  shareClassName: "Common",
  status: "outstanding",
  acceptanceStatus: "accepted",
  quantity: "400000",
  pricePerShare: "0.0001",
  pricePaidPerShare: "0.0001",
  transactionValueCents: "4000",
  issueDate: "2025-02-01",
} as EquityCertificate;

const page = <T,>(items: T[]) => ({ items, total: items.length, page: 1, pageSize: 500 });

const meta = {
  title: "Cap table/Securities/CertificateTransactionDialog",
  component: CertificateTransactionDialog,
  decorators: [withPageBehind()],
  args: { certificate, action: "transfer", onOpenChange: () => {}, onDone: () => {} },
  beforeEach: () =>
    mockRpc({
      "equity.stakeholders.list": page([
        { id: "sh-2", name: "Brook Ventures I, L.P." },
        { id: "sh-3", name: "Casey Moreau" },
      ]),
      "equity.shareClasses.list": page([{ id: "sc-a", name: "Series A Preferred" }]),
    }),
} satisfies Meta<typeof CertificateTransactionDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Transfer: Story = {};
export const Repurchase: Story = { args: { action: "repurchase" } };
export const Cancel: Story = { args: { action: "cancel" } };
export const Convert: Story = { args: { action: "convert" } };
export const Modify: Story = { args: { action: "modify" } };
