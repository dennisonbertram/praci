import type { MailAction } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { CleanupHistory } from "./CleanupHistory";

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const action = (patch: Partial<MailAction>): MailAction => ({
  batchId: "batch_1",
  kind: "archive",
  source: "user",
  createdAt: minutesAgo(2),
  undone: false,
  threadCount: 31,
  senders: ["news@lists.example.test", "deals@shop.example.test"],
  senderCount: 2,
  ...patch,
});

const meta = {
  title: "Inbox/CleanupHistory",
  component: CleanupHistory,
  args: { actions: [action({})], onUndo: () => undefined },
} satisfies Meta<typeof CleanupHistory>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Every kind, latest first: a user's action, an automatic skip-inbox archive, and an undone one. */
export const Mixed: Story = {
  args: {
    actions: [
      action({ batchId: "b1" }),
      action({
        batchId: "b2",
        kind: "skip_inbox",
        source: "auto",
        threadCount: 3,
        senders: ["news@lists.example.test"],
        senderCount: 1,
        createdAt: minutesAgo(600),
      }),
      action({
        batchId: "b3",
        kind: "spam",
        threadCount: 2,
        undone: true,
        createdAt: minutesAgo(3000),
      }),
      action({ batchId: "b4", kind: "trash", threadCount: 5, createdAt: minutesAgo(4000) }),
    ],
  },
};

/** Nothing renders without actions. */
export const Empty: Story = {
  args: { actions: [] },
  decorators: [
    (Story) => (
      <>
        <Story />
        <p className="text-sm text-muted-foreground">No history</p>
      </>
    ),
  ],
};

export const Undoing: Story = { args: { busyBatchId: "batch_1" } };
