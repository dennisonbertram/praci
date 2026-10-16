import type { MailRow } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { InboxGroup, InboxRow } from "./InboxRow";

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

const base: MailRow = {
  id: "mail_base",
  connectionId: "conn_demo",
  threadId: "thread_base",
  from: "Sample Sender",
  subject: "Quarterly review",
  snippet: "Here are the sample notes from the review.",
  receivedAt: hoursAgo(1),
  unread: false,
  inInbox: true,
  needsReply: null,
  priority: null,
  reason: null,
  category: null,
  feedback: null,
};

const row = (id: string, over: Partial<MailRow>): MailRow => ({
  ...base,
  id,
  threadId: `thread_${id}`,
  ...over,
});

const rows: MailRow[] = [
  row("r1", {
    from: "Demo Teammate",
    subject: "Can you reply today?",
    unread: true,
    needsReply: true,
    priority: "important",
    category: "reply",
    reason: "Asks a direct question.",
  }),
  row("r2", {
    from: "Newsletter Sample",
    subject: "This week in demos",
    category: "newsletter",
    receivedAt: hoursAgo(5),
  }),
  row("r3", {
    from: "Unknown Sender",
    subject: "You won a sample prize",
    snippet: "Click the link below",
    category: "suspicious",
    receivedAt: hoursAgo(30),
  }),
  row("r4", {
    from: "Junk Sample",
    subject: "Limited offer",
    category: "spam",
    receivedAt: hoursAgo(50),
  }),
  row("r5", {
    from: "Quiet Sender",
    subject: "FYI only",
    unread: true,
    feedback: "noise",
    category: "fyi",
    receivedAt: hoursAgo(24 * 400),
  }),
];

const noop = () => undefined;

const meta = {
  title: "Inbox/InboxRow",
  component: InboxRow,
  args: { row: rows[0] as MailRow, onOpen: noop, onMark: undefined },
  decorators: [
    (Story) => (
      <div className="@container w-[760px]">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: { description: { component: "Also shows: formatMailTime (the time column)." } },
  },
} satisfies Meta<typeof InboxRow>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Unread: Story = {};

export const Read: Story = { args: { row: base } };

export const Selected: Story = {
  args: { row: rows[0] as MailRow, selected: true, onMark: noop, onArchive: noop, onRead: noop },
};

export const Suspicious: Story = { args: { row: rows[2] as MailRow } };

export const WithTriageMarks: Story = {
  args: { row: rows[4] as MailRow, selected: true, onMark: noop, onArchive: noop, onRead: noop },
};

export const HiddenAttention: Story = {
  args: { row: rows[0] as MailRow, hideAttention: true },
};

export const LongContent: Story = {
  args: {
    row: row("long", {
      from: "A sender with a very long display name",
      subject: "A very long subject line that keeps going and going past the edge of the row",
      snippet: "and a long preview of the body that also runs past the edge",
      unread: true,
    }),
  },
};

/** At phone width the actions move into the More menu. */
export const NarrowWithMenu: Story = {
  args: { row: rows[0] as MailRow, onMark: noop, onArchive: noop, onRead: noop },
  decorators: [
    (Story) => (
      <div className="@container w-[360px]">
        <Story />
      </div>
    ),
  ],
};

export const Group: StoryObj = {
  render: () => (
    <InboxGroup
      title="Today"
      rows={rows}
      onOpen={noop}
      onMark={noop}
      onArchive={noop}
      onRead={noop}
      selectedId="r2"
    />
  ),
};

export const GroupWithoutTitle: StoryObj = {
  render: () => <InboxGroup rows={rows.slice(0, 2)} onOpen={noop} onMark={undefined} />,
};
