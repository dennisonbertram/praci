import type { MailRow } from "@rakazo/contracts";
import type { SenderGroup } from "@rakazo/core";
import { groupBySender } from "@rakazo/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { InboxSenderGroup, senderGroupId } from "./InboxSenderGroup";

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

const row = (id: string, over: Partial<MailRow> = {}): MailRow => ({
  id,
  connectionId: "conn_demo",
  threadId: `thread_${id}`,
  from: "Demo Store",
  fromAddress: "orders@store.example",
  subject: `Order update ${id}`,
  snippet: "A short invented preview of the message.",
  receivedAt: hoursAgo(1),
  unread: false,
  inInbox: true,
  needsReply: null,
  priority: null,
  reason: null,
  category: "receipt",
  feedback: null,
  pile: "updates",
  ...over,
});

const rows: MailRow[] = [
  row("g1", { reason: "Sample order 1042 shipped, arrives Thursday", receivedAt: hoursAgo(1) }),
  row("g2", { reason: "Sample order 1041 delivered", receivedAt: hoursAgo(30) }),
  row("g3", { reason: "Receipt for sample order 1040", receivedAt: hoursAgo(80) }),
];
const unreadRows = rows.map((r, i) => (i < 2 ? { ...r, unread: true } : r));

const group = (list: MailRow[]) => groupBySender(list)[0] as SenderGroup<MailRow>;
const noop = () => undefined;

const meta = {
  title: "Inbox/InboxSenderGroup",
  component: InboxSenderGroup,
  args: {
    group: group(rows),
    expanded: false,
    onToggle: noop,
    onOpen: noop,
    onMark: undefined,
    onArchive: noop,
    onRead: noop,
    onArchiveGroup: noop,
    onPickGroup: noop,
    onPick: noop,
    pickedIds: new Set<string>(),
  },
  decorators: [
    (Story) => (
      <div className="@container w-[760px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InboxSenderGroup>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Collapsed: Story = {};

/** Expanding lists the sender's messages, newest first, each with its own summary. */
export const Expanded: Story = { args: { expanded: true } };

export const Unread: Story = { args: { group: group(unreadRows) } };

/** The focused header, as the keyboard leaves it. */
export const Selected: Story = { args: { selectedId: senderGroupId("orders@store.example") } };

/** Every message of the group is checked. */
export const AllChecked: Story = {
  args: { expanded: true, pickedIds: new Set(rows.map((r) => r.id)) },
};

/** Some of the messages are checked, so the group checkbox is mixed. */
export const PartlySelected: Story = {
  args: { expanded: true, pickedIds: new Set(["g2"]) },
};

export const LongSummary: Story = {
  args: {
    group: group([
      row("long1", {
        from: "A sender with a very long display name that keeps going",
        subject: "A very long subject line that keeps going past the edge of the row",
        reason: "A long summary of the newest message that also runs past the edge of the row",
      }),
      row("long2"),
    ]),
  },
};

/** A sender with one message shows as an ordinary row, with no header to open. */
export const SingleMessage: Story = { args: { group: group([rows[0] as MailRow]) } };

/** At phone width the sender, count and time share one line and the summary wraps under it. */
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="@container w-[360px]">
        <Story />
      </div>
    ),
  ],
};
