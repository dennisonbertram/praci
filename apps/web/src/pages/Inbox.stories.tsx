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

/** Triage on, a named filter chosen, and the Ask button: every header action at phone width. */
export const CrowdedHeaderPhone375: Story = {
  args: { onShowAgent: () => undefined },
  parameters: { initialEntries: ["/?filter=unread"] },
  beforeEach: () =>
    mockRpc({
      "inbox.list": { ...list, enabled: true, triageBlocked: null },
      "inbox.todos.list": { enabled: true, todos },
    }),
  decorators: [
    (Story) => (
      <div className="w-[375px]">
        <Story />
      </div>
    ),
  ],
};

/** Triage on and enough rows to scroll: at a phone viewport the search leaves with the list, the title and tabs stay. */
export const LongListPhone: Story = {
  args: { onShowAgent: () => undefined },
  beforeEach: () =>
    mockRpc({
      "inbox.list": {
        ...list,
        enabled: true,
        triageBlocked: null,
        rows: Array.from({ length: 24 }, (_, index) => ({
          ...rows[0],
          id: `long-${index}`,
          threadId: `long-t-${index}`,
          subject: `Sample message ${index + 1}`,
        })) as MailRow[],
      },
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

/** Consent is asked before the first sync finishes: the card shows alone, with no blank bars beside it. */
export const NeedsConsentSyncing: Story = {
  beforeEach: () =>
    mockRpc({
      "inbox.list": {
        ...list,
        rows: [],
        syncedAt: null,
        enabled: false,
        triageBlocked: {
          reason: "needs_consent",
          recipient: { key: "demo-model", name: "Demo model provider" },
        },
      },
      "inbox.refresh": { syncing: true },
    }),
};

/** The first sort after Allow: grey bars for 15 s, then the unsorted rows dimmed until it lands. */
export const SortingFirstTime: Story = {
  beforeEach: () =>
    mockRpc({
      "inbox.list": {
        ...list,
        enabled: true,
        triageBlocked: null,
        triagePending: true,
        rows: rows.map((r) => ({
          ...r,
          needsReply: null,
          priority: null,
          category: null,
          reason: null,
        })),
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

/** The busiest first screen: two accounts and several to-dos. */
export const TwoAccountsTodos: Story = {
  beforeEach: () =>
    mockRpc({
      "inbox.list": {
        ...list,
        accounts: [
          { connectionId: "conn_1", label: "demo@example.com" },
          { connectionId: "conn_2", label: "work@example.com" },
        ],
        enabled: true,
        triageBlocked: null,
      },
      "inbox.todos.list": {
        enabled: true,
        todos: ["Reply about the demo invoice", "Send the sample deck", "Book the offsite"].map(
          (text, n) => ({ ...todos[0], id: `t${n + 1}`, text, messageId: null }) as InboxTodo,
        ),
      },
    }),
};

export const Loading: Story = {
  beforeEach: () => mockRpc({ "inbox.list": () => new Promise(() => undefined) }),
};

export const Empty: Story = {
  beforeEach: () => mockRpc({ "inbox.list": { ...list, rows: [] } }),
};

/** No Gmail connection: Connect mail shows while the slow list is still loading. */
export const NoMailBeforeListLoads: Story = {
  beforeEach: () =>
    mockRpc({ "connections.list": [], "inbox.list": () => new Promise(() => undefined) }),
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

const pileCounts = { important: 5, updates: 6, newsletters: 4, spam: 0 };
const pileRow = (
  id: string,
  from: string,
  address: string,
  subject: string,
  reason: string,
  pile: "updates" | "newsletters" | "spam",
  extra: Partial<MailRow> = {},
): MailRow =>
  row(id, from, subject, {
    fromAddress: address,
    reason,
    pile,
    receivedAt: ago(0, Number(id.replace(/\D/g, "")) * 4),
    ...extra,
  });

const updateRows: MailRow[] = [
  pileRow(
    "u1",
    "Demo Store",
    "orders@store.example",
    "Order 1042 shipped",
    "Arrives Thursday",
    "updates",
    {
      unread: true,
      category: "receipt",
    },
  ),
  pileRow(
    "u2",
    "Demo Store",
    "orders@store.example",
    "Order 1041 delivered",
    "Left at the front desk",
    "updates",
    { category: "receipt" },
  ),
  pileRow(
    "u3",
    "Demo Store",
    "orders@store.example",
    "Receipt for order 1040",
    "Total paid, no action needed",
    "updates",
    { category: "receipt" },
  ),
  pileRow(
    "u4",
    "Sample Calendar",
    "calendar@example.com",
    "Invitation: design review",
    "Design review on Friday at 10:00",
    "updates",
    { category: "scheduling" },
  ),
  pileRow(
    "u5",
    "Example Bank",
    "alerts@bank.example",
    "New sign-in to your account",
    "Sign-in from a new laptop",
    "updates",
    { category: "security" },
  ),
  pileRow(
    "u6",
    "Example Bank",
    "alerts@bank.example",
    "Statement is ready",
    "October statement is available",
    "updates",
    { category: "notification" },
  ),
];

const newsletterRows: MailRow[] = [
  pileRow(
    "n1",
    "Example Weekly",
    "digest@weekly.example",
    "Issue 214",
    "Weekly digest of new Postgres releases",
    "newsletters",
    { unread: true, category: "newsletter" },
  ),
  pileRow(
    "n2",
    "Example Weekly",
    "digest@weekly.example",
    "Issue 213",
    "Why indexes get bloated",
    "newsletters",
    { category: "newsletter" },
  ),
  pileRow(
    "n3",
    "Demo Outfitters",
    "sale@outfit.example",
    "Fall sale: 30% off",
    "Sample promotion for fall coats",
    "newsletters",
    { category: "bulk" },
  ),
  pileRow(
    "n4",
    "Test Digest",
    "hello@digest.example",
    "Five links worth your time",
    "Five links on sample tooling",
    "newsletters",
    { category: "newsletter" },
  ),
];

const spamRows: MailRow[] = [
  pileRow(
    "x1",
    "Prize Desk",
    "win@prizes.example",
    "You won a sample prize",
    "Asks for a card number",
    "spam",
    { inInbox: false, category: "spam" },
  ),
  pileRow(
    "x2",
    "Unknown Sender",
    "help@lookalike.example",
    "Verify your account now",
    "Looks like a sign-in phishing attempt",
    "spam",
    { category: "suspicious" },
  ),
];

const byPile = (input: unknown): InboxListOutput => {
  const pile = (input as { pile?: string } | undefined)?.pile;
  const withCounts = {
    ...list,
    enabled: true,
    triageBlocked: null,
    pileCounts: { ...pileCounts, spam: spamRows.length },
  };
  if (pile === "updates") return { ...withCounts, rows: updateRows };
  if (pile === "newsletters") return { ...withCounts, rows: newsletterRows };
  if (pile === "spam") return { ...withCounts, rows: spamRows };
  return { ...withCounts, rows };
};

/** Archiving answers with every id done, so the stories can be tried by hand. */
const bulkMocks = {
  "inbox.archiveMany": (input: unknown) => ({
    done: (input as { messageIds: string[] }).messageIds,
    failed: [],
  }),
  "inbox.unarchiveMany": (input: unknown) => ({
    done: (input as { messageIds: string[] }).messageIds,
    failed: [],
  }),
};

/** Updates: one row per sender with the count and the newest summary; the sender with one message is a plain row. */
export const UpdatesGrouped: Story = {
  parameters: { initialEntries: ["/?pile=updates"] },
  beforeEach: () => mockRpc({ "inbox.list": byPile, ...bulkMocks }),
};

export const NewslettersGrouped: Story = {
  parameters: { initialEntries: ["/?pile=newsletters"] },
  beforeEach: () => mockRpc({ "inbox.list": byPile, ...bulkMocks }),
};

export const NewslettersDigest: Story = {
  parameters: { initialEntries: ["/?pile=newsletters&digest=1"] },
  beforeEach: () => mockRpc({ "inbox.list": byPile, ...bulkMocks }),
};

/** The pile has mail, but all of it is older than the digest's 7 days. */
export const NewslettersDigestOlderThanAWeek: Story = {
  parameters: { initialEntries: ["/?pile=newsletters&digest=1"] },
  beforeEach: () =>
    mockRpc({
      "inbox.list": (input: unknown) => {
        const out = byPile(input);
        return {
          ...out,
          rows: out.rows.map((r) => ({ ...r, receivedAt: ago(9) })),
        };
      },
      ...bulkMocks,
    }),
};

/** A filter: the Filter button keeps its width (Cleanup does not move); the filter's name is in the results bar. */
export const FilteredUnread: Story = {
  parameters: { initialEntries: ["/?filter=unread"] },
  beforeEach: () => mockRpc({ "inbox.list": byPile, ...bulkMocks }),
};

/** Search results: no pile tabs, one Clear (the X in the box). */
export const SearchResults: Story = {
  parameters: { initialEntries: ["/?q=invoice"] },
  beforeEach: () => mockRpc({ "inbox.list": byPile, ...bulkMocks }),
};

/** Spam is a flat list behind a count; Gmail's own spam is not in the inbox, so it has no Archived badge. */
export const SpamView: Story = {
  parameters: { initialEntries: ["/?pile=spam"] },
  beforeEach: () => mockRpc({ "inbox.list": byPile, ...bulkMocks }),
};

/** No model or consent: the piles still sort mail with the free rules, and rows show the preview. */
export const PilesWithoutTriage: Story = {
  parameters: { initialEntries: ["/?pile=updates"] },
  beforeEach: () =>
    mockRpc({
      "inbox.list": (input: unknown) => ({
        ...byPile(input),
        enabled: false,
        triageBlocked: { reason: "no_model" },
        rows: byPile(input).rows.map((r) => ({ ...r, reason: null, category: null })),
      }),
    }),
};

export const PileEmpty: Story = {
  parameters: { initialEntries: ["/?pile=newsletters"] },
  beforeEach: () =>
    mockRpc({ "inbox.list": () => ({ ...byPile({ pile: "important" }), rows: [] }) }),
};

export const PileLoading: Story = {
  parameters: { initialEntries: ["/?pile=updates"] },
  beforeEach: () => mockRpc({ "inbox.list": () => new Promise(() => undefined) }),
};

export const PileLoadError: Story = {
  parameters: { initialEntries: ["/?pile=updates"] },
  beforeEach: () =>
    mockRpc({
      "inbox.list": () => {
        throw new Error("Could not load mail");
      },
    }),
};
