import type { InboxListOutput, InboxTodo, MailRow } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../lib/__mocks__/rpc";
import { InboxPage } from "./Inbox";

const DAY = 86_400_000;
const ago = (days: number, hours = 0) =>
  new Date(Date.now() - days * DAY - hours * 3_600_000).toISOString();

function row(id: string, from: string, subject: string, extra: Partial<MailRow> = {}): MailRow {
  return {
    id,
    connectionId: "conn_1",
    threadId: `thread_${id}`,
    from,
    subject,
    snippet: "A short invented preview of the message body.",
    receivedAt: ago(0, 1),
    unread: false,
    inInbox: true,
    needsReply: null,
    priority: null,
    reason: null,
    category: null,
    feedback: null,
    ...extra,
  };
}

const rows: MailRow[] = [
  row("m1", "Sample Sender", "Question about the demo invoice", {
    unread: true,
    needsReply: true,
    priority: "important",
    category: "reply",
  }),
  row("m2", "Demo Store", "Your sample receipt", { receivedAt: ago(0, 3), category: "receipt" }),
  row("m3", "Example Newsletter", "This week in samples", {
    receivedAt: ago(0, 5),
    unread: true,
    category: "newsletter",
  }),
  row("m4", "Test Person", "Re: planning the sample offsite", { receivedAt: ago(3) }),
  row("m5", "Placeholder Bank", "Statement ready", { receivedAt: ago(6), category: "billing" }),
];

const list: InboxListOutput = {
  accounts: [{ connectionId: "conn_1", label: "demo@example.com" }],
  agent: null,
  rows,
  syncedAt: ago(0),
  failedAccounts: [],
  reconnectAccounts: [],
  enabled: false,
  triageBlocked: { reason: "no_model" },
  triagePending: false,
};

const todos: InboxTodo[] = [
  {
    id: "t1",
    connectionId: "conn_1",
    messageId: "m1",
    text: "Reply about the demo invoice",
    detail: "Asked for a copy",
    from: "Sample Sender",
    priority: "important",
    dueOn: null,
    doneAt: null,
  },
];

const meta = {
  title: "Inbox/InboxPage",
  component: InboxPage,
  parameters: { layout: "fullscreen" },
  args: { onConnectMail: () => undefined, onRefreshed: () => undefined, paused: false },
  beforeEach: () => mockRpc({ "inbox.todos.list": { enabled: false, todos: [] } }),
  decorators: [
    (Story) => (
      <div className="flex h-[760px] flex-col">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InboxPage>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  beforeEach: () => mockRpc({ "inbox.list": list }),
};

export const WithTriage: Story = {
  args: { onShowAgent: () => undefined },
  beforeEach: () =>
    mockRpc({
      "inbox.list": { ...list, enabled: true, triageBlocked: null },
      "inbox.todos.list": { enabled: true, todos },
    }),
};

export const NeedsConsent: Story = {
  beforeEach: () =>
    mockRpc({
      "inbox.list": {
        ...list,
        enabled: false,
        triageBlocked: {
          reason: "needs_consent",
          recipient: { key: "demo-model", name: "Demo model provider" },
        },
      },
    }),
};

export const TwoAccounts: Story = {
  beforeEach: () =>
    mockRpc({
      "inbox.list": {
        ...list,
        accounts: [
          { connectionId: "conn_1", label: "demo@example.com" },
          { connectionId: "conn_2", label: "work@example.com" },
        ],
      },
    }),
};

export const Loading: Story = {
  beforeEach: () => mockRpc({ "inbox.list": () => new Promise(() => undefined) }),
};

export const Empty: Story = {
  beforeEach: () => mockRpc({ "inbox.list": { ...list, rows: [] } }),
};

export const NoMailAccount: Story = {
  args: { spaceName: "Empty space" },
  beforeEach: () => mockRpc({ "inbox.list": { ...list, accounts: [], rows: [] } }),
};

export const SyncFailed: Story = {
  beforeEach: () =>
    mockRpc({
      "inbox.list": { ...list, failedAccounts: ["conn_1"], reconnectAccounts: ["conn_1"] },
    }),
};

export const LoadError: Story = {
  beforeEach: () =>
    mockRpc({
      "inbox.list": () => {
        throw new Error("Could not load mail");
      },
    }),
};

export const NeedsReconnectNoMail: Story = {
  beforeEach: () =>
    mockRpc({
      "inbox.list": {
        ...list,
        rows: [],
        failedAccounts: ["conn_1"],
        reconnectAccounts: ["conn_1"],
      },
    }),
};

export const RateLimitedNoMail: Story = {
  beforeEach: () =>
    mockRpc({
      "inbox.list": {
        ...list,
        rows: [],
        failedAccounts: ["conn_1"],
        reconnectAccounts: [],
        rateLimitedAccounts: ["conn_1"],
      },
    }),
};
