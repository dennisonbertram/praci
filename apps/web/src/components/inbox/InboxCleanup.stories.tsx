import type { CleanupListOutput, CleanupSender, MailAction } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { InboxCleanup } from "./InboxCleanup";

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const sender = (
  address: string,
  name: string,
  patch: Partial<CleanupSender> = {},
): CleanupSender => ({
  connectionId: "conn_demo",
  address,
  name,
  messageCount: 12,
  readCount: 0,
  lastReceivedAt: daysAgo(3),
  inboxThreads: 9,
  preselected: true,
  spamLike: false,
  unsubscribe: "one_click",
  skipInbox: false,
  unsubscribeStatus: null,
  ...patch,
});

const senders: CleanupSender[] = [
  sender("news@lists.example.test", "Northwind Weekly", {
    messageCount: 24,
    readCount: 1,
    inboxThreads: 18,
  }),
  sender("offers@shop.example.test", "Tailwind Deals", {
    messageCount: 18,
    unsubscribe: "link",
    inboxThreads: 14,
  }),
  sender("priya@example.test", "Priya Shah", {
    messageCount: 12,
    readCount: 1,
    preselected: false,
    unsubscribe: "none",
    inboxThreads: 3,
  }),
  sender("win@promo.example.test", "Quick Prize", {
    messageCount: 7,
    preselected: false,
    spamLike: true,
    unsubscribe: "refused",
    inboxThreads: 7,
  }),
  sender("digest@harbor.example.test", "Harbor Digest", {
    messageCount: 6,
    preselected: false,
    skipInbox: true,
    inboxThreads: 2,
  }),
];

const list: CleanupListOutput = {
  accounts: [{ connectionId: "conn_demo", label: "demo@example.test" }],
  senders,
  syncedAt: minutesAgo(3),
};

const history: MailAction[] = [
  {
    batchId: "batch_1",
    kind: "archive",
    source: "user",
    reason: "cleanup",
    createdAt: minutesAgo(5),
    undone: false,
    threadCount: 31,
    senders: ["news@lists.example.test", "offers@shop.example.test"],
    senderCount: 2,
  },
  {
    batchId: "batch_2",
    kind: "skip_inbox",
    source: "auto",
    reason: "skip_inbox",
    createdAt: minutesAgo(900),
    undone: false,
    threadCount: 3,
    senders: ["digest@harbor.example.test"],
    senderCount: 1,
  },
];

const done = { batchId: "batch_9", done: 9, failed: 0, remaining: 0 };

const meta = {
  title: "Inbox/InboxCleanup",
  component: InboxCleanup,
  args: { onBack: () => undefined, onRefreshed: () => undefined },
  decorators: [
    (Story) => (
      <div className="flex h-[720px] w-[760px] flex-col">
        <Story />
      </div>
    ),
  ],
  beforeEach: () =>
    mockRpc({
      "inbox.cleanup.list": list,
      "inbox.actions.list": { actions: [] },
      "inbox.cleanup.archive": done,
      "inbox.unsubscribe": { status: "done", method: "one_click" },
      "inbox.actions.undo": { restored: 9, failed: 0 },
      "inbox.cleanup.forget": { ok: true },
    }),
} satisfies Meta<typeof InboxCleanup>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Bulk, rarely read senders are ticked; spam-like and already skipped ones are not. */
export const Populated: Story = {};

/** The list has not answered yet. */
export const Loading: Story = {
  beforeEach: () => mockRpc({ "inbox.cleanup.list": () => new Promise(() => undefined) }),
};

export const Empty: Story = {
  beforeEach: () => mockRpc({ "inbox.cleanup.list": { ...list, senders: [] } }),
};

/** Try again loads the list once more. */
export const LoadError: Story = {
  beforeEach: () =>
    mockRpc({
      "inbox.cleanup.list": () => {
        throw new Error("Could not reach the server");
      },
    }),
};

/** The latest actions, with Undo. */
export const WithHistory: Story = {
  beforeEach: () => mockRpc({ "inbox.actions.list": { actions: history } }),
};

/** Click Archive: the call never returns, so the bar stays busy. */
export const Applying: Story = {
  beforeEach: () => mockRpc({ "inbox.cleanup.archive": () => new Promise(() => undefined) }),
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole("button", { name: /^Archive/ }));
  },
};

/** An unsubscribe by email waits for the user's OK. */
export const ConfirmEmail: Story = {
  beforeEach: () =>
    mockRpc({
      "inbox.unsubscribe": {
        status: "needs_confirmation",
        method: "mailto",
        mailTo: "unsub@lists.example.test",
      },
    }),
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByRole("button", { name: /^Unsubscribe/ }),
    );
  },
};

/** Gmail refused part of an archive, so the sender is named. */
export const PartialFailure: Story = {
  beforeEach: () =>
    mockRpc({ "inbox.cleanup.archive": { batchId: "batch_9", done: 0, failed: 4, remaining: 4 } }),
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole("button", { name: /^Archive/ }));
  },
};

/** Two accounts: every row names its account. */
export const TwoAccounts: Story = {
  beforeEach: () =>
    mockRpc({
      "inbox.cleanup.list": {
        accounts: [
          { connectionId: "conn_demo", label: "demo@example.test" },
          { connectionId: "conn_work", label: "work@example.test" },
        ],
        senders: [
          ...senders.slice(0, 2),
          sender("alerts@ci.example.test", "Build Alerts", { connectionId: "conn_work" }),
        ],
        syncedAt: minutesAgo(3),
      },
    }),
};
