import type { MailRow } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { InboxDigest } from "./InboxDigest";

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

const row = (id: string, over: Partial<MailRow> = {}): MailRow => ({
  id,
  connectionId: "conn_demo",
  threadId: `thread_${id}`,
  from: "Research Weekly",
  fromAddress: "digest@research.example",
  subject: `Issue ${id}: papers worth reading`,
  snippet: "A short invented preview of the issue.",
  receivedAt: daysAgo(1),
  unread: false,
  inInbox: true,
  needsReply: null,
  priority: null,
  reason: null,
  category: "newsletter",
  feedback: null,
  pile: "newsletters",
  ...over,
});

const rows: MailRow[] = [
  row("n1", {
    reason: "Three papers on sleep and memory, one on tiny models.",
    receivedAt: daysAgo(0.2),
  }),
  row("n4", { subject: "Issue 4: last week's papers", receivedAt: daysAgo(3), unread: true }),
  row("n5", { subject: "Issue 5: reading list", receivedAt: daysAgo(6) }),
  row("n2", {
    from: "Garden Notes",
    fromAddress: "hello@garden.example",
    subject: "October planting list",
    reason: "What to plant before the first frost.",
    receivedAt: daysAgo(2),
  }),
  row("n3", {
    from: "Daily Brief",
    fromAddress: "brief@daily.example",
    subject: "Monday brief",
    receivedAt: daysAgo(5),
  }),
];

const meta = {
  title: "Inbox/InboxDigest",
  component: InboxDigest,
  args: { rows, onOpen: () => undefined, onArchiveAll: () => undefined },
  decorators: [
    (Story) => (
      <div className="@container w-[640px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InboxDigest>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {};

/** An unread issue gets a dot and a heavier look through the same dot the list rows use. */
export const Unread: Story = {
  args: { rows: rows.map((r, i) => (i === 0 ? { ...r, unread: true } : r)) },
};

export const Selected: Story = { args: { selectedId: "n2" } };

export const Loading: Story = { args: { loading: true } };

/** No issue in the window; there is nothing to archive, so the button is gone. */
export const Empty: Story = { args: { rows: [] } };

/** At phone width a long sender name is cut off and the summary stops after two lines. */
export const LongText: Story = {
  decorators: [
    (Story) => (
      <div className="@container w-[340px]">
        <Story />
      </div>
    ),
  ],
  args: {
    rows: [
      row("long", {
        from: "A newsletter with a very long display name that keeps going past the edge",
        subject: "A very long subject line that keeps going past the edge of the card and wraps",
        reason:
          "A long summary that runs over several lines so the card shows how a clamped summary ends after two lines of text.",
      }),
    ],
  },
};
