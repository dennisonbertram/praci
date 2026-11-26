import type { MailBatch, MessageBlock } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../lib/__mocks__/rpc";
import { MailReplyBatchCard } from "./MailReplyBatchCard";

type Row = MailBatch["rows"][number];

// Every name and address is invented.
const row = (name: string, extra: Partial<Row> = {}): Row => ({
  itemId: name,
  replyToId: `m-${name}`,
  to: [`${name}@customer.example.test`],
  cc: [],
  bcc: [],
  subject: "Re: Export stops at 90%",
  body: `Hi ${name},\n\nThe export stopped because of a fault on our side. It is fixed now, so running it again will finish.\n\nThanks for your patience.`,
  hash: name.padEnd(64, "0"),
  seenMessageId: `m-${name}`,
  flags: [],
  startsUnticked: false,
  state: "reviewing",
  error: null,
  retryable: false,
  ...extra,
});

const newEmail = (name: string, extra: Partial<Row> = {}) =>
  row(name, {
    replyToId: null,
    seenMessageId: null,
    to: [`${name}@prospect.example.test`],
    subject: `Hello ${name}`,
    body: `Hi ${name},\n\nI read your note about export times and wrote this one for you.`,
    flags: ["new_recipient"],
    ...extra,
  });

const review = [
  row("sam", {
    cc: ["billing@other.example.test"],
    flags: ["not_on_thread"],
    startsUnticked: true,
  }),
  row("lee", { flags: ["new_message"], startsUnticked: true }),
  row("pat"),
  row("robin", { flags: ["has_link"] }),
  row("alex"),
  row("jo"),
];
const many = Array.from({ length: 18 }, (_, i) => row(`customer${i + 1}`));
const results = [
  row("pat", { state: "sent" }),
  row("robin", { state: "sent" }),
  row("alex", { state: "not_sent", retryable: true }),
  row("jo", { state: "unknown" }),
  row("sam", { state: "skipped" }),
  row("dana", { state: "not_sent", error: "new_message", retryable: true }),
];

const batch =
  (rows: Row[], effectStatus = "intended") =>
  () => ({
    account: "support@example.test",
    effectStatus,
    rows,
  });

const card = (
  count: number,
  extra: Partial<Extract<MessageBlock, { kind: "ask" }>> = {},
): Extract<MessageBlock, { kind: "ask" }> => ({
  kind: "ask",
  text: `${count} replies`,
  approvalEffectId: "effect-1",
  approvalReason: "Firewall",
  status: "pending",
  mailBatch: { count, sent: 0, failed: 0, unknown: 0 },
  actions: [{ id: "deny", label: "Discard" }],
  ...extra,
});

const meta = {
  title: "Chat/MailReplyBatchCard",
  component: MailReplyBatchCard,
  args: {
    block: card(6),
    botId: "bot-1",
    message: { id: "message-1", runId: "run-1" },
    canAnswer: true,
    onAnswer: async () => undefined,
    onOpenComposer: () => undefined,
    fallback: null,
  },
} satisfies Meta<typeof MailReplyBatchCard>;
export default meta;
type Story = StoryObj<typeof meta>;

const withRows = (rows: Row[], effectStatus?: string) => () =>
  mockRpc({ "threads.mailBatch": batch(rows, effectStatus) });

/** Rows a check flagged come first and start unticked. */
export const Review: Story = { beforeEach: withRows(review) };
/** Opening a row shows the whole reply in the real mail card, without its header or buttons. */
export const RowOpen: Story = { args: { initialOpen: "pat" }, beforeEach: withRows(review) };
export const RowEditing: Story = {
  args: { initialOpen: "pat", initialEditing: true },
  beforeEach: withRows(review),
};
/** Send cannot go out while ticked rows are hidden: the button opens the list first. */
export const LargeBatch: Story = {
  args: { block: card(18) },
  beforeEach: withRows(many),
};
/** A run that read outside content leaves every row unticked; Select all skips the repeat-send rows and any row flagged for the owner to look at. */
export const SelectAll: Story = {
  args: { block: card(18) },
  beforeEach: withRows([
    ...many.slice(0, 16).map((r) => ({ ...r, startsUnticked: true })),
    row("repeat1", { flags: ["already_sent"], startsUnticked: true }),
    row("repeat2", { flags: ["duplicate_email"], startsUnticked: true }),
  ]),
};
export const Sending: Story = {
  args: { block: card(3, { status: "answered", answer: "send" }) },
  beforeEach: withRows(
    [
      row("pat", { state: "sent" }),
      row("robin", { state: "sending" }),
      row("alex", { state: "sending" }),
    ],
    "executing",
  ),
};
/** One failure does not stop the rest, and only failed rows retry. */
export const PartlySent: Story = {
  args: {
    block: card(6, {
      status: "answered",
      answer: "send",
      mailBatch: { count: 6, sent: 2, failed: 2, unknown: 1 },
    }),
  },
  beforeEach: withRows(results, "completed"),
};
export const Discarded: Story = {
  args: { block: card(3, { status: "answered", answer: "deny" }) },
  beforeEach: withRows([row("pat"), row("robin"), row("alex")], "denied"),
};
/** New emails sit beside replies. One from a run that read outside content starts unticked. */
export const NewEmails: Story = {
  args: { block: card(4, { text: "3 new emails · 1 reply" }) },
  beforeEach: withRows([
    row("pat"),
    newEmail("sasha", { startsUnticked: true }),
    newEmail("noor"),
    newEmail("kai", {
      subject: "Hello noor",
      flags: ["duplicate_email", "new_recipient"],
      startsUnticked: true,
    }),
  ]),
};
/** Over the daily limit: the row says why, and Retry failed can try it again later. */
export const NewEmailsOverLimit: Story = {
  args: {
    block: card(3, {
      text: "3 new emails",
      status: "answered",
      answer: "send",
      mailBatch: { count: 3, sent: 1, failed: 2, unknown: 0, settled: true },
    }),
  },
  beforeEach: withRows(
    [
      newEmail("sasha", { state: "sent" }),
      newEmail("noor", { state: "not_sent", error: "daily_limit", retryable: true }),
      newEmail("kai", { state: "not_sent", error: "daily_limit", retryable: true }),
    ],
    "completed",
  ),
};
/** Phone width, the same card. */
export const Phone: Story = {
  beforeEach: withRows(review),
  decorators: [
    (Story) => (
      <div className="w-[390px]">
        <Story />
      </div>
    ),
  ],
};
