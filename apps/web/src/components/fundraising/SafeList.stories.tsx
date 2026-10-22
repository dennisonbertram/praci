import type { Safe } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { MemoryRouter } from "react-router-dom";
import { AttentionStrip, MarkDateDialog, SafeList } from "./SafeList";

const safe = (id: string, investorName: string, extra: Partial<Safe> = {}): Safe => ({
  id,
  source: "native",
  contactId: null,
  roundId: "r1",
  investorName,
  investorEmail: null,
  amountCents: 5_000_000,
  valuationType: "post_money_cap",
  capCents: 1_000_000_000,
  discountPercent: null,
  mfn: false,
  proRata: false,
  governingState: null,
  investmentDate: null,
  expiresAt: null,
  canceledAt: null,
  sentAt: null,
  signedByOwnerAt: null,
  signedByInvestorAt: null,
  paidAt: null,
  documentUrl: null,
  status: "draft",
  createdAt: "2026-10-20T00:00:00.000Z",
  ...extra,
});
const round = {
  id: "r1",
  name: "Seed",
  targetCents: 200_000_000,
  capCents: 1_000_000_000,
  closedAt: null,
};
const signed = {
  status: "signed",
  sentAt: "2026-10-01T00:00:00.000Z",
  signedByOwnerAt: "2026-10-05T00:00:00.000Z",
  signedByInvestorAt: "2026-10-05T00:00:00.000Z",
} as const;

const meta = {
  title: "Fundraising/SafeList",
  component: SafeList,
  args: {
    round,
    safes: [],
    onOpen: () => {},
    onMark: () => {},
    onCancel: () => {},
    onDelete: () => {},
  },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div className="max-w-3xl p-4">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof SafeList>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Funded first, then Signed, Sent and Draft (muted amount); a different cap and a Mercury row say so. */
export const AllStatuses: Story = {
  args: {
    safes: [
      safe("s4", "Cedar Fund", { amountCents: 2_500_000 }),
      safe("s3", "Summit Partners", { status: "sent", sentAt: "2026-10-18T00:00:00.000Z" }),
      safe("s2", "Harbor Angels", signed),
      safe("s1", "Lakeside Capital", {
        ...signed,
        status: "funded",
        paidAt: "2026-10-12T00:00:00.000Z",
        capCents: 800_000_000,
      }),
      safe("s5", "Mercury Fund", {
        source: "mercury",
        status: "sent",
        sentAt: "2026-10-10T00:00:00.000Z",
      }),
      safe("s6", "Pine Ventures", {
        status: "canceled",
        canceledAt: "2026-10-11T00:00:00.000Z",
      }),
    ],
  },
};

export const Attention: StoryObj<typeof AttentionStrip> = {
  render: () => (
    <AttentionStrip
      now={new Date("2026-10-21T12:00:00.000Z")}
      onMark={() => {}}
      safes={[
        safe("s2", "Harbor Angels", signed),
        safe("s3", "Summit Partners", { status: "sent", sentAt: "2026-10-01T00:00:00.000Z" }),
        safe("s4", "Cedar Fund"),
      ]}
    />
  ),
};

export const MarkDate: StoryObj<typeof MarkDateDialog> = {
  render: () => <MarkDateDialog step="funded" onClose={() => {}} onSave={async () => {}} />,
};

/** A Mercury SAFE with no contact offers Assign to contact; an attached one offers Unassign; a deposit links to Finance. */
export const MercuryRows: Story = {
  args: {
    onAssign: () => {},
    onUnassign: () => {},
    safes: [
      safe("m1", "Quill Capital", {
        source: "mercury",
        status: "funded",
        paidAt: "2026-10-12T00:00:00.000Z",
        contactId: "c1",
        financeTransactionId: "tx1",
      }),
      safe("m2", "Harbor Angels", { source: "mercury", status: "sent", roundId: null }),
    ],
  },
};
