import type { Contact, Safe } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../lib/__mocks__/rpc";
import { FundraisingPage } from "./Fundraising";

const prospect = (id: string, name: string, extra: Partial<Contact> = {}): Contact => ({
  id,
  name,
  email: `${name.toLowerCase().replaceAll(" ", ".")}@example.test`,
  organization: null,
  kind: "prospect",
  notes: null,
  stage: "target",
  checkSizeCents: null,
  nextStep: null,
  roundId: null,
  addedBy: null,
  createdAt: "2026-10-15T00:00:00.000Z",
  updatedAt: "2026-10-15T00:00:00.000Z",
  ...extra,
});
const round = {
  id: "r1",
  name: "Seed",
  targetCents: 200_000_000,
  capCents: 1_000_000_000,
  closedAt: null,
};
const prospects = [
  prospect("p1", "Example Ventures", { stage: "intro", nextStep: "Send the deck" }),
  prospect("p2", "Sample Capital", { stage: "meeting", checkSizeCents: 10_000_000 }),
  prospect("p3", "Placeholder Partners", {
    stage: "committed",
    checkSizeCents: 25_000_000,
    roundId: "r1",
  }),
  prospect("p4", "Old Example Fund", { stage: "passed" }),
];

const NOT_CONNECTED = { status: "not_connected", lastSyncedAt: null, unreadable: 0 } as const;

const meta = {
  title: "Fundraising/FundraisingPage",
  component: FundraisingPage,
  parameters: { layout: "fullscreen" },
  args: { onShowAgent: () => {} },
  decorators: [
    (Story) => (
      <div className="flex h-[700px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FundraisingPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const OpenRound: Story = {
  beforeEach: () =>
    mockRpc({
      "fundraising.overview": {
        mercury: NOT_CONNECTED,
        round,
        pendingCents: 25_000_000,
        signedCents: 0,
        fundedCents: 0,
        prospects,
        safes: [],
      },
      "contacts.list": prospects,
    }),
};

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

/** SAFEs in every status, with a signed, unpaid one in Attention. */
export const WithSafes: Story = {
  beforeEach: () =>
    mockRpc({
      "fundraising.overview": {
        mercury: NOT_CONNECTED,
        round,
        pendingCents: 7_500_000,
        signedCents: 5_000_000,
        fundedCents: 10_000_000,
        prospects,
        safes: [
          safe("s1", "Lakeside Capital", {
            status: "funded",
            amountCents: 10_000_000,
            sentAt: "2026-09-01T00:00:00.000Z",
            signedByOwnerAt: "2026-09-05T00:00:00.000Z",
            signedByInvestorAt: "2026-09-05T00:00:00.000Z",
            paidAt: "2026-09-12T00:00:00.000Z",
          }),
          safe("s2", "Harbor Angels", {
            status: "signed",
            sentAt: "2026-10-01T00:00:00.000Z",
            signedByOwnerAt: "2026-10-05T00:00:00.000Z",
            signedByInvestorAt: "2026-10-05T00:00:00.000Z",
          }),
          safe("s3", "Summit Partners", {
            status: "sent",
            amountCents: 5_000_000,
            sentAt: "2026-10-18T00:00:00.000Z",
          }),
          safe("s4", "Cedar Fund", { amountCents: 2_500_000 }),
        ],
      },
      "contacts.list": prospects,
    }),
};

export const ClosedRound: Story = {
  beforeEach: () =>
    mockRpc({
      "fundraising.overview": {
        mercury: NOT_CONNECTED,
        round: { ...round, closedAt: "2026-10-20T00:00:00.000Z" },
        pendingCents: 0,
        signedCents: 0,
        fundedCents: 0,
        prospects,
        safes: [],
      },
      "contacts.list": prospects,
    }),
};

/** Nothing yet: one Start a round state, without Pipeline, the SAFEs card or a second Add prospect. */
export const NoRound: Story = {
  beforeEach: () =>
    mockRpc({
      "fundraising.overview": {
        mercury: NOT_CONNECTED,
        round: null,
        pendingCents: 0,
        signedCents: 0,
        fundedCents: 0,
        prospects: [],
        safes: [],
      },
      "contacts.list": [],
    }),
};

export const Loading: Story = {
  beforeEach: () => mockRpc({ "fundraising.overview": () => new Promise(() => {}) }),
};

export const LoadError: Story = {
  beforeEach: () =>
    mockRpc({
      "fundraising.overview": () => {
        throw new Error("Could not load fundraising");
      },
    }),
};

/** Mercury connected: a prospect waiting for its SAFE, an unassigned Mercury SAFE and a matched deposit. */
export const WithMercury: Story = {
  beforeEach: () => {
    const waiting = {
      ...prospects[0],
      stage: "committed" as const,
      mercurySentAt: "2026-10-20T00:00:00.000Z",
    };
    return mockRpc({
      "fundraising.overview": {
        mercury: { status: "ok", lastSyncedAt: new Date().toISOString(), unreadable: 1 },
        round,
        pendingCents: 25_000_000,
        signedCents: 0,
        fundedCents: 5_000_000,
        prospects: [waiting, ...prospects.slice(1)],
        safes: [
          safe("m1", "Quill Capital", {
            source: "mercury",
            status: "funded",
            paidAt: "2026-10-12T00:00:00.000Z",
            financeTransactionId: "tx1",
          }),
          safe("m2", "Harbor Angels", { source: "mercury", status: "sent", roundId: null }),
        ],
      },
      "contacts.list": prospects,
    });
  },
};
