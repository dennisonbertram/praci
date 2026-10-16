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
export const Approved: Story = { args: { status: "answered", answer: "allow" } };
export const NotSent: Story = {
  args: {
    status: "answered",
    answer: "deny",
    mail: { ...mail, connectionId: "connection_1", outcome: "failed" },
    onOpenComposer: () => undefined,
  },
};
