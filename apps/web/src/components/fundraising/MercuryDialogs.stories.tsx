import type { Contact } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { AssignSafeDialog, InvestorEmailDialog } from "./MercuryDialogs";

const contact = (id: string, name: string, kind: Contact["kind"]): Contact => ({
  id,
  name,
  email: null,
  organization: null,
  kind,
  notes: null,
  stage: kind === "prospect" ? "committed" : null,
  checkSizeCents: null,
  nextStep: null,
  roundId: null,
  addedBy: null,
  createdAt: "2026-10-15T00:00:00.000Z",
  updatedAt: "2026-10-15T00:00:00.000Z",
});

const meta = {
  title: "Fundraising/MercuryDialogs",
  component: AssignSafeDialog,
  args: {
    contacts: [
      contact("c1", "Example Ventures", "prospect"),
      contact("c2", "Priya Investor", "investor"),
      contact("c3", "Cy Customer", "customer"),
    ],
    onClose: () => {},
    onAssign: async () => {},
  },
} satisfies Meta<typeof AssignSafeDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Only prospects and investors can be picked. */
export const AssignToContact: Story = {};

export const InvestorEmail: StoryObj<typeof InvestorEmailDialog> = {
  render: () => <InvestorEmailDialog onClose={() => {}} onSave={async () => {}} />,
};
