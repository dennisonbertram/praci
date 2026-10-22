import type { Contact } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Pipeline } from "./Pipeline";

const prospect = (id: string, name: string, extra: Partial<Contact> = {}): Contact => ({
  id,
  name,
  email: null,
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

const meta = {
  title: "Fundraising/Pipeline",
  component: Pipeline,
  args: { onEdit: () => {}, onMove: () => {}, prospects: [] },
  decorators: [
    (Story) => (
      <div className="max-w-3xl p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Pipeline>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Grouped: Story = {
  args: {
    prospects: [
      prospect("p1", "Example Ventures", { stage: "intro", nextStep: "Send the deck" }),
      prospect("p2", "Sample Capital", {
        stage: "meeting",
        checkSizeCents: 10_000_000,
        nextStep: "Partner meeting Thursday",
      }),
      prospect("p3", "Placeholder Partners", { stage: "committed", checkSizeCents: 25_000_000 }),
      prospect("p4", "Old Example Fund", { stage: "passed" }),
    ],
  },
};

export const JustSaved: Story = {
  args: { ...Grouped.args, savedId: "p2" },
};

/** Nothing renders when there are no prospects; the page shows its own empty state. */
export const Empty: Story = {};

/** Committed rows offer Send SAFE: filled with an open round, outline without one. */
export const WithSendSafe: Story = {
  args: { ...Grouped.args, filledSend: true, onSendSafe: () => {} },
};

/** Waiting for Mercury: no Send SAFE, the date in the sub-line, and a menu of Open Mercury, Not sent, Passed and Edit prospect. */
export const WaitingForMercury: Story = {
  args: {
    filledSend: true,
    onSendSafe: () => {},
    onOpenMercury: () => {},
    onNotSent: () => {},
    prospects: [
      prospect("p1", "Example Ventures", {
        stage: "committed",
        checkSizeCents: 25_000_000,
        mercurySentAt: "2026-10-20T00:00:00.000Z",
      }),
      prospect("p2", "Sample Capital", { stage: "committed", checkSizeCents: 10_000_000 }),
    ],
  },
};
