import type { EquityCertificate } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { withPageBehind } from "../../../stories/decorators";
import { BulkCertificateDialog } from "./BulkCertificateDialog";

const rows = [
  { id: "c1", label: "CS-12", quantity: "250000" },
  { id: "c2", label: "CS-13", quantity: "125000" },
] as EquityCertificate[];

const meta = {
  title: "Cap table/Securities/BulkCertificateDialog",
  component: BulkCertificateDialog,
  decorators: [withPageBehind()],
  args: { action: "cancel", certificates: rows, onOpenChange: () => {}, onDone: () => {} },
  beforeEach: () =>
    mockRpc({
      "equity.shareClasses.list": {
        items: [{ id: "sc-a", name: "Series A Preferred" }],
        total: 1,
        page: 1,
        pageSize: 500,
      },
    }),
} satisfies Meta<typeof BulkCertificateDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Cancel: Story = {};
export const Convert: Story = { args: { action: "convert" } };
