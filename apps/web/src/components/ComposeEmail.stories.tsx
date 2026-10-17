import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../lib/__mocks__/rpc";
import { withPageBehind } from "../stories/decorators";
import { ComposeEmail, type ComposeRestore, NEW_MESSAGE } from "./ComposeEmail";

const accounts = [
  { connectionId: "conn_1", label: "me@example.test" },
  { connectionId: "conn_2", label: "team@example.test" },
];

const prefill = {
  connectionId: "conn_1",
  to: "Sample Sender <sender@example.test>",
  cc: "",
  subject: "Re: Quarterly planning notes",
  body: "\n\nOn Mar 4, Sample Sender wrote:\n> Here are the planning notes.",
  replyToMessageId: "msg_orig",
  attachments: [],
};

// A restored composer skips the prefill request, so each state can be set up directly.
const restored = (patch: Partial<ComposeRestore["fields"]>, extra: Partial<ComposeRestore> = {}) =>
  ({
    seed: NEW_MESSAGE,
    clientId: "client_story_1",
    fields: {
      connectionId: "conn_1",
      to: [],
      cc: [],
      bcc: [],
      subject: "",
      html: "",
      text: "",
      ...patch,
    },
    forwarded: [],
    files: [],
    saved: false,
    accounts,
    ...extra,
  }) satisfies ComposeRestore;

const meta = {
  title: "Inbox/Compose email",
  component: ComposeEmail,
  parameters: {
    docs: { description: { component: "Also shows: Row, RecipientSummary" } },
  },
  args: { seed: NEW_MESSAGE, accounts, onClose: () => undefined },
  decorators: [withPageBehind("Page behind the composer")],
  beforeEach: () => mockRpc({ "inbox.compose.draftSave": { status: "saved" } }),
} satisfies Meta<typeof ComposeEmail>;
export default meta;
type Story = StoryObj<typeof meta>;

export const NewMessage: Story = {};

export const NewMessageSingleAccount: Story = {
  args: { accounts: accounts.slice(0, 1) },
};

export const Reply: Story = {
  args: { seed: { kind: "reply", messageId: "msg_reply" } },
  beforeEach: () => mockRpc({ "inbox.compose.prefill": prefill }),
};

/** A reply to mail that came to a second account names that account's address on the From line. */
export const ReplyFromSecondAccount: Story = {
  args: { seed: { kind: "reply", messageId: "msg_orig" }, accounts: [] },
  beforeEach: () =>
    mockRpc({
      "inbox.compose.prefill": {
        ...prefill,
        connectionId: "conn_2",
        account: { connectionId: "conn_2", label: "Sales mail", address: "sales@example.test" },
      },
    }),
};

export const Forward: Story = {
  args: { seed: { kind: "forward", messageId: "msg_forward" } },
  beforeEach: () =>
    mockRpc({
      "inbox.compose.prefill": {
        ...prefill,
        to: "",
        subject: "Fwd: Quarterly planning notes",
        replyToMessageId: undefined,
        attachments: [{ id: "a1", filename: "diagram.png", mimeType: "image/png", size: 245_000 }],
      },
    }),
};

/** A forward whose video is over the attachment limit: the file that fit stays, the other is named. */
export const ForwardWithFileLeftOut: Story = {
  args: { seed: { kind: "forward", messageId: "msg_forward" } },
  beforeEach: () =>
    mockRpc({
      "inbox.compose.prefill": {
        ...prefill,
        to: "",
        subject: "Fwd: Demo video",
        replyToMessageId: undefined,
        attachments: [
          { id: "a1", filename: "notes.pdf", mimeType: "application/pdf", size: 82_000 },
        ],
        attachmentsTooLarge: true,
        attachmentsLeftOut: [{ filename: "demo.mp4", size: 12_000_000 }],
      },
    }),
};

export const PrefillLoading: Story = {
  args: { seed: { kind: "reply", messageId: "msg_slow" } },
  beforeEach: () => mockRpc({ "inbox.compose.prefill": () => new Promise(() => undefined) }),
};

export const PrefillFailed: Story = {
  args: { seed: { kind: "reply", messageId: "msg_fail" } },
  beforeEach: () =>
    mockRpc({
      "inbox.compose.prefill": () => Promise.reject(new Error("Could not load the message.")),
    }),
};

export const QuoteUnavailable: Story = {
  args: { seed: { kind: "reply", messageId: "msg_busy" } },
  beforeEach: () =>
    mockRpc({ "inbox.compose.prefill": { ...prefill, body: "", quoteUnavailable: true } }),
};

export const ManyRecipientsFolded: Story = {
  name: "Many recipients (summary line)",
  args: {
    restore: restored({
      to: ["ana@example.test", "Ben Sample <ben@example.test>", "cy@example.test"],
      cc: ["dee@example.test", "not-an-address"],
      subject: "Team update",
      text: "Draft body.",
    }),
  },
};

export const WithCcBccAndAttachments: Story = {
  args: {
    restore: restored(
      {
        to: ["ana@example.test"],
        cc: ["ben@example.test"],
        bcc: ["cy@example.test"],
        subject: "Files for review",
        text: "See attached.",
      },
      {
        files: [
          new File(["x".repeat(2048)], "report.pdf", { type: "application/pdf" }),
          new File(["y"], "a-very-long-file-name-that-should-truncate-inside-its-chip.txt"),
        ],
      },
    ),
  },
};

export const SendFailedNotice: Story = {
  args: {
    restore: restored(
      { to: ["ana@example.test"], subject: "Hello", text: "Body." },
      { notice: "Not sent. Couldn't send. Try again." },
    ),
  },
};
