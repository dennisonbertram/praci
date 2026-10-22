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

/** Pipeline and SAFEs show before any round; the card offers Start a round. */
export const NoRound: Story = {
  beforeEach: () =>
    mockRpc({
      "fundraising.overview": {
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
