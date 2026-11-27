import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { AppSafes } from "./AppSafes";

const meta = {
  title: "Cap table/Securities/AppSafes",
  component: AppSafes,
  args: { onAdded: () => {} },
} satisfies Meta<typeof AppSafes>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  beforeEach: () =>
    mockRpc({
      "equity.appSafes.list": [
        {
          id: "safe-1",
          investorName: "Juniper Seed Fund",
          investorEmail: null,
          principalCents: "25000000",
          valuationCapCents: "1000000000",
          discountPercent: null,
          mfn: false,
          proRata: true,
          issueDate: "2026-04-02",
        },
        {
          id: "safe-2",
          investorName: "Mara Quint",
          investorEmail: "mara@example.test",
          principalCents: "5000000",
          valuationCapCents: null,
          discountPercent: "20.0000",
          mfn: true,
          proRata: false,
          issueDate: "2026-05-19",
        },
      ],
    }),
};

export const Narrow: Story = {
  ...Default,
  render: (args) => (
    <div className="w-[390px]">
      <AppSafes {...args} />
    </div>
  ),
};
