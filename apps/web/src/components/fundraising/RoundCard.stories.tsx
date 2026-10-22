import type { Meta, StoryObj } from "@storybook/react-vite";
import { RoundCard, RoundDialog } from "./RoundCard";

const round = {
  id: "r1",
  name: "Seed",
  targetCents: 200_000_000,
  capCents: 1_000_000_000,
  closedAt: null,
};

const meta = {
  title: "Fundraising/RoundCard",
  component: RoundCard,
  args: {
    round,
    pendingCents: 35_000_000,
    onStart: () => {},
    onEdit: () => {},
    onClose: () => {},
    onReopen: () => {},
  },
  decorators: [
    (Story) => (
      <div className="@container/bd p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RoundCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {};
export const Closed: Story = {
  args: { round: { ...round, closedAt: "2026-10-20T00:00:00.000Z" }, pendingCents: 0 },
};
/** Only Start a round. */
export const NoRound: Story = { args: { round: null, pendingCents: 0 } };
/** The bar scales to the larger of target and total. */
export const OverTarget: Story = { args: { pendingCents: 250_000_000 } };

export const StartDialog: StoryObj<typeof RoundDialog> = {
  render: () => <RoundDialog round={null} onClose={() => {}} onSave={async () => {}} />,
};
export const EditDialog: StoryObj<typeof RoundDialog> = {
  render: () => <RoundDialog round={round} onClose={() => {}} onSave={async () => {}} />,
};
