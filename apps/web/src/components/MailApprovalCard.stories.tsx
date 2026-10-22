import type { MailApproval } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { MailApprovalCard } from "./MailApprovalCard";

const mail: MailApproval = {
  tool: "mail_send",
  account: "me@example.test",
  to: ["Sam Rivera <sam@example.test>"],
  cc: [],
  bcc: [],
  subject: "Offsite dates",
  body: "The 14th works for us.\nSee you then.",
};

const meta = {
  title: "Chat/MailApprovalCard",
  component: MailApprovalCard,
  args: {
    mail,
    status: "pending",
    canAnswer: true,
    botName: "Inbox agent",
    onAnswer: async () => undefined,
    onDisableTool: async () => undefined,
  },
} satisfies Meta<typeof MailApprovalCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Pending: Story = {};
export const WithCc: Story = {
  args: { mail: { ...mail, cc: ["lee@example.test"], bcc: ["pat@example.test"] } },
};
export const Draft: Story = { args: { mail: { ...mail, tool: "mail_draft" } } };
export const ReplacesSavedDraft: Story = {
  args: { mail: { ...mail, tool: "mail_draft", locked: true } },
};
export const Sent: Story = {
  args: {
    status: "answered",
    answer: "deny",
    mail: { ...mail, connectionId: "connection_1", outcome: "sent" },
  },
};
/** The server closed this card (a newer one replaced it): it reads Not sent, never Sending. */
export const Superseded: Story = { args: { status: "answered", answer: "superseded" } };
export const Approved: Story = { args: { status: "answered", answer: "allow" } };
export const NotSent: Story = {
  args: {
    status: "answered",
    answer: "deny",
    mail: { ...mail, connectionId: "connection_1", outcome: "failed" },
    onOpenComposer: () => undefined,
  },
};
export const SentSavedDraft: Story = {
  args: { mail: { ...mail, to: [], subject: "", body: "", locked: true } },
};
export const FailedDraft: Story = {
  args: {
    status: "answered",
    answer: "deny",
    mail: { ...mail, tool: "mail_draft", connectionId: "connection_1", outcome: "failed" },
    onOpenComposer: () => undefined,
  },
};
export const Unknown: Story = {
  args: {
    status: "answered",
    answer: "deny",
    mail: { ...mail, connectionId: "connection_1", outcome: "unknown" },
  },
};
/** The agent's own send failed after approval: the card says why. */
export const AgentSendFailed: Story = {
  args: {
    status: "answered",
    answer: "allow",
    mail: { ...mail, outcome: "failed", error: "No connected mail account sales@example.test" },
  },
};
export const NotWaiting: Story = { args: { canAnswer: false } };
