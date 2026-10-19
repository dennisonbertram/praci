import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { withPageBehind } from "../../stories/decorators";
import { InboxMessageDialog } from "./InboxMessageDialog";

// The message cache is module-level, so every story uses its own message id.
const message = {
  from: "Sample Sender <sender@example.test>",
  to: "me@example.test",
  cc: "",
  date: "2026-03-04T15:30:00.000Z",
  subject: "Quarterly planning notes",
  html: null,
  text: "Hello,\n\nHere are the planning notes for next quarter.\n\n- Ship the demo\n- Review the sample budget\n\nThanks",
  attachments: [],
};

const meta = {
  title: "Inbox/Message dialog",
  component: InboxMessageDialog,
  parameters: {
    docs: {
      description: {
        component:
          "Also shows: InboxMessage, AttachmentIcon, InboxAttachments, EarlierMessages, EarlierMessage",
      },
    },
  },
  args: { messageId: "msg_text", subject: "Quarterly planning notes", onClose: () => undefined },
  decorators: [withPageBehind()],
} satisfies Meta<typeof InboxMessageDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const PlainText: Story = {
  beforeEach: () => mockRpc({ "inbox.get": message }),
};

export const HtmlBody: Story = {
  args: { messageId: "msg_html" },
  beforeEach: () =>
    mockRpc({
      "inbox.get": {
        ...message,
        cc: "copy@example.test",
        html: "<h2>Planning</h2><p>Rich <b>HTML</b> body from a sample newsletter.</p>",
      },
    }),
};

/** The user's own reply, found by search: named "You", and its plain HTML reads as text in the app's style. */
export const OwnSentReply: Story = {
  args: { messageId: "msg_own" },
  beforeEach: () =>
    mockRpc({
      "inbox.get": {
        ...message,
        from: "me@example.test",
        fromSelf: true,
        to: "Sample Sender <sender@example.test>",
        html: "<div><p>Thanks, the <b>planning notes</b> look good to me.</p></div>",
        text: "Thanks, the planning notes look good to me.",
      },
    }),
};

export const WithAttachments: Story = {
  name: "With attachments (image, archive, document)",
  args: { messageId: "msg_files" },
  beforeEach: () =>
    mockRpc({
      "inbox.get": {
        ...message,
        attachments: [
          { id: "a1", filename: "diagram.png", mimeType: "image/png", size: 245_000 },
          { id: "a2", filename: "export.zip", mimeType: "application/zip", size: 4_800_000 },
          { id: "a3", filename: "notes.pdf", mimeType: "application/pdf", size: 640 },
          {
            id: "a4",
            filename: "a-very-long-attachment-file-name-that-has-to-truncate-in-the-chip.docx",
            mimeType: "application/msword",
            size: 12_300,
          },
        ],
      },
    }),
};

export const WithInboxActions: Story = {
  name: "With navigation, archive and mark read",
  args: {
    messageId: "msg_actions",
    previousId: "msg_prev",
    nextId: "msg_next",
    unread: true,
    onNavigate: () => undefined,
    onArchive: () => undefined,
    onRead: () => undefined,
    notice: <span className="rounded-md bg-muted px-3 py-1 text-xs">Archived. Undo</span>,
  },
  beforeEach: () => mockRpc({ "inbox.get": message }),
};

export const Conversation: Story = {
  name: "Conversation with earlier messages",
  args: { messageId: "msg_thread", subject: "Re: Quarterly planning notes" },
  beforeEach: () =>
    mockRpc({
      "inbox.get": ({ messageId }: { messageId: string }) =>
        messageId === "msg_thread"
          ? {
              ...message,
              subject: "Re: Quarterly planning notes",
              text: "Sounds good. Can we meet Thursday?",
              thread: [
                {
                  id: "msg_thread_1",
                  from: "Sample Sender",
                  receivedAt: "2026-03-02T09:00:00.000Z",
                  snippet: "Here are the planning notes for next quarter.",
                },
                {
                  id: "msg_thread_2",
                  from: "Me",
                  receivedAt: "2026-03-03T11:00:00.000Z",
                  snippet: "Thanks, I added two items to the sample budget.",
                },
              ],
            }
          : { ...message, text: "Here are the planning notes for next quarter." },
    }),
};

/** The user's own reply came after the open message: it is listed below the body, as You. */
/** An earlier message the user sent shows the green Sent flag and edge; the other sender's does not. */
export const ConversationWithOwnEarlierMessage: Story = {
  args: { messageId: "msg_own_earlier", subject: "Re: Quarterly planning notes" },
  beforeEach: () =>
    mockRpc({
      "inbox.get": {
        ...message,
        subject: "Re: Quarterly planning notes",
        text: "Thursday works.",
        thread: [
          {
            id: "msg_own_earlier_1",
            from: "Sample Sender",
            receivedAt: "2026-03-02T09:00:00.000Z",
            snippet: "Here are the planning notes for next quarter.",
          },
          {
            id: "msg_own_earlier_2",
            from: "me@example.test",
            receivedAt: "2026-03-02T11:00:00.000Z",
            snippet: "Can we meet Thursday?",
            fromSelf: true,
          },
        ],
      },
    }),
};

export const ConversationWithLaterReply: Story = {
  name: "Conversation with a later reply",
  args: { messageId: "msg_later", subject: "Re: Quarterly planning notes" },
  beforeEach: () =>
    mockRpc({
      "inbox.get": {
        ...message,
        subject: "Re: Quarterly planning notes",
        text: "Can we meet Thursday?",
        thread: [
          {
            id: "msg_later_1",
            from: "Sample Sender",
            receivedAt: "2026-03-02T09:00:00.000Z",
            snippet: "Here are the planning notes for next quarter.",
          },
        ],
        later: [
          {
            id: "msg_later_2",
            from: "me@example.test",
            receivedAt: "2026-03-04T10:27:00.000Z",
            snippet: "Thursday works. See you then.",
            fromSelf: true,
          },
        ],
      },
    }),
};

/** Opened from an agent card: the read state and Archive come from the loaded message. */
export const FromAgentCard: Story = {
  args: { messageId: "msg_card", onArchive: () => undefined, onRead: () => undefined },
  beforeEach: () => mockRpc({ "inbox.get": { ...message, unread: true, inInbox: true } }),
};

export const Loading: Story = {
  args: { messageId: "msg_loading" },
  beforeEach: () => mockRpc({ "inbox.get": () => new Promise(() => undefined) }),
};

export const LoadFailed: Story = {
  args: { messageId: "msg_error" },
  beforeEach: () =>
    mockRpc({
      "inbox.get": () => Promise.reject(new Error("Could not load this message.")),
    }),
};

/** A stale ?mail= link: the email was deleted or moved. */
export const NoLongerInMail: Story = {
  args: { messageId: "msg_gone" },
  beforeEach: () =>
    mockRpc({
      "inbox.get": () =>
        Promise.reject(Object.assign(new Error("Not found"), { code: "NOT_FOUND" })),
    }),
};

/** An archived email opened from search: Move to Inbox instead of Archive. */
export const ArchivedMessage: Story = {
  args: { messageId: "msg_archived", onArchive: () => undefined, onMoveToInbox: () => undefined },
  beforeEach: () => mockRpc({ "inbox.get": { ...message, inInbox: false } }),
};
