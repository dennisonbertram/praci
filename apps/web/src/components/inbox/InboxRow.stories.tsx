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

/** An archived email found by search. */
export const Archived: Story = { args: { row: { ...base, inInbox: false } } };

export const Selected: Story = {
  args: { row: rows[0] as MailRow, selected: true, onMark: noop, onArchive: noop, onRead: noop },
};

/** The sender is always foreground colour: semibold when unread, regular when read. The preview is one step dimmer than the subject. */
export const ReadAndUnread: StoryObj = {
  render: () => (
    <div>
      <InboxRow row={rows[0] as MailRow} onOpen={noop} onMark={undefined} />
      <InboxRow row={base} onOpen={noop} onMark={undefined} />
      <InboxRow row={base} selected onOpen={noop} onMark={undefined} />
    </div>
  ),
};

/** The wide pane widens the sender column (200px from the @3xl container width). */
export const WidePane: StoryObj = {
  decorators: [
    (Story) => (
      <div className="@container w-[1100px]">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <InboxGroup title="Today" rows={rows} onOpen={noop} onMark={noop} selectedId="r2" />
  ),
};

/** The user's own sent message, as a search result shows it. */
export const SentByYou: Story = {
  args: { row: { ...base, from: "me@example.test", fromSelf: true, inInbox: false } },
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

/** In a narrow pane each label shrinks to a dot before the subject: hollow Newsletter, solid Needs attention, solid warning Spam, warning ring Junk. */
export const NarrowLabels: StoryObj = {
  render: () => (
    <div className="@container w-[320px]">
      {(["attention", "newsletter", "spam", "bulk"] as const).map((kind) => (
        <InboxRow
          key={kind}
          row={row(`label_${kind}`, {
            category: kind === "attention" ? "action" : kind,
            needsReply: kind === "attention" ? true : null,
            from: "Sample Sender",
            subject: `A ${kind} message`,
          })}
          onOpen={noop}
          onMark={undefined}
        />
      ))}
    </div>
  ),
};

/** Mail that wants an answer says Needs reply; other urgent mail says why: Urgent, Important or Action. */
export const UrgentReasons: StoryObj = {
  render: () => (
    <div className="@container w-[760px]">
      {(
        [
          { needsReply: true, priority: "normal", category: "reply" },
          { needsReply: false, priority: "critical", category: "billing" },
          { needsReply: false, priority: "important", category: "personal" },
          { needsReply: false, priority: "normal", category: "action" },
        ] as const
      ).map((extra) => (
        <InboxRow
          key={`${extra.priority}_${extra.category}`}
          row={row(`reason_${extra.priority}_${extra.category}`, {
            ...extra,
            from: "Sample Sender",
            subject: `${extra.priority} ${extra.category}`,
          })}
          onOpen={noop}
          onMark={undefined}
        />
      ))}
    </div>
  ),
};

/** A Needs reply row whose mail has an open to-do says so; the To do card leaves it out. */
export const WithTodo: StoryObj = {
  render: () => (
    <InboxGroup
      title="Needs reply"
      hideAttention
      rows={rows.slice(0, 2)}
      todoIds={new Set([rows[0]?.id ?? ""])}
      onOpen={noop}
      onMark={noop}
      onArchive={noop}
      onRead={noop}
    />
  ),
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

/** The model's one-line summary shows after the subject in place of the preview. */
export const WithSummary: Story = {
  args: {
    row: row("summary", {
      from: "Demo Store",
      subject: "Your sample order shipped",
      reason: "Sample order 1042 shipped, arrives Thursday",
      category: "receipt",
    }),
  },
};

/** A search result marks the matched words and shows the snippet around the match. */
export const SearchMatch: Story = {
  args: {
    query: "pilot",
    row: row("search", {
      from: "Sample Sender",
      subject: "Re: Q3 numbers",
      snippet:
        "Thanks for sending these over, the sample figures look right. For the pilot customers we can share them next week.",
    }),
  },
};

/** The checkbox takes the place of the unread dot once the row is checked. */
export const Picked: Story = {
  args: { row: rows[0] as MailRow, picked: true, anyPicked: true, onPick: noop },
};

/** Once any row is checked, every row shows its checkbox. */
export const AnyPicked: StoryObj = {
  render: () => (
    <div>
      <InboxRow
        row={rows[0] as MailRow}
        onOpen={noop}
        onMark={undefined}
        picked
        anyPicked
        onPick={noop}
      />
      <InboxRow row={base} onOpen={noop} onMark={undefined} anyPicked onPick={noop} />
    </div>
  ),
};

/** Gmail's spam is not in the inbox, so the Spam pile leaves the Archived badge off. */
export const SpamNoArchivedBadge: Story = {
  args: {
    row: row("spam_gmail", { from: "Junk Sample", subject: "Limited offer", inInbox: false }),
    showArchived: false,
    onPick: noop,
  },
};

/** With a move handler, the More menu also offers Spam and Trash for inbox mail (open the menu to see them). */
export const WithSpamAndTrash: Story = {
  args: { row: rows[0] as MailRow, selected: true, onArchive: noop, onRead: noop, onMove: noop },
};

/** Mail in the Spam pile offers Not spam in the More menu instead of Spam. */
export const InSpamPile: Story = {
  args: {
    row: { ...(rows[3] as MailRow), inInbox: false, pile: "spam" },
    selected: true,
    onRead: noop,
    onMove: noop,
    showArchived: false,
  },
};
