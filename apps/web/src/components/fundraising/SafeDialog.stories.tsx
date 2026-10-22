import type { Contact, Safe } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { withPageBehind } from "../../stories/decorators";
import { SafeCoverSummary, SafeDialog } from "./SafeDialog";

const prospect: Contact = {
  id: "p1",
  name: "Harbor Angels",
  email: "harbor@example.test",
  organization: null,
  kind: "prospect",
  notes: null,
  stage: "committed",
  checkSizeCents: 5_000_000,
  nextStep: null,
  roundId: "r1",
  addedBy: null,
  createdAt: "2026-10-15T00:00:00.000Z",
  updatedAt: "2026-10-15T00:00:00.000Z",
};
const round = {
  id: "r1",
  name: "Seed",
  targetCents: 200_000_000,
  capCents: 1_000_000_000,
  closedAt: null,
};
const safe: Safe = {
  id: "s1",
  source: "native",
  contactId: "p1",
  roundId: "r1",
  investorName: "Harbor Angels",
  investorEmail: "harbor@example.test",
  amountCents: 5_000_000,
  valuationType: "post_money_cap",
  capCents: 1_000_000_000,
  discountPercent: null,
  mfn: false,
  proRata: true,
  governingState: "Delaware",
  investmentDate: "2026-10-20T12:00:00.000Z",
  expiresAt: null,
  canceledAt: null,
  sentAt: null,
  signedByOwnerAt: null,
  signedByInvestorAt: null,
  paidAt: null,
  documentUrl: null,
  status: "draft",
  createdAt: "2026-10-20T00:00:00.000Z",
};

const meta = {
  title: "Fundraising/SafeDialog",
  component: SafeDialog,
  args: { prospect, round, onClose: () => {}, onSave: async () => {} },
  decorators: [withPageBehind()],
} satisfies Meta<typeof SafeDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The round's cap is a line; Different terms opens cap, pro rata and governing state. */
export const FromRound: Story = {};

/** With no round the terms are open and the cap is typed in. */
export const NoRound: Story = { args: { round: null } };

export const CoverSummary: StoryObj<typeof SafeCoverSummary> = {
  render: () => <SafeCoverSummary safe={safe} onClose={() => {}} onMarkSent={async () => {}} />,
};

export const CoverSummarySent: StoryObj<typeof SafeCoverSummary> = {
  render: () => (
    <SafeCoverSummary
      safe={{ ...safe, status: "sent", sentAt: "2026-10-20T12:00:00.000Z" }}
      onClose={() => {}}
      onMarkSent={async () => {}}
    />
  ),
};
