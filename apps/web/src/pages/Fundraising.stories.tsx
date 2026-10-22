import type { Contact } from "@rakazo/contracts";
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
      "fundraising.overview": { round, pendingCents: 25_000_000, prospects },
      "contacts.list": prospects,
    }),
};

export const ClosedRound: Story = {
  beforeEach: () =>
    mockRpc({
      "fundraising.overview": {
        round: { ...round, closedAt: "2026-10-20T00:00:00.000Z" },
        pendingCents: 0,
        prospects,
      },
      "contacts.list": prospects,
    }),
};

/** Pipeline and SAFEs show before any round; the card offers Start a round. */
export const NoRound: Story = {
  beforeEach: () =>
    mockRpc({
      "fundraising.overview": { round: null, pendingCents: 0, prospects: [] },
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
