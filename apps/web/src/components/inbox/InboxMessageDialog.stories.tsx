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
