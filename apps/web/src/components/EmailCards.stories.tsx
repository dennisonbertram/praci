import type { EmailCard, MessageBlock } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { EmailCards } from "./EmailCards";

type Block = Extract<MessageBlock, { kind: "emails" }>;

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const emails: EmailCard[] = [
  {
    id: "mail_1",
    urgency: "today",
    from: "Sample Vendor",
    subject: "Invoice due today",
    snippet: "Your sample invoice is due today. Please review the attached statement.",
    receivedAt: ago(20),
    attachments: 2,
  },
  {
    id: "mail_2",
    urgency: "within_3_days",
    from: "Demo Teammate",
    subject: "Draft agenda for Thursday",
    snippet: "Attached is a first pass at the agenda. Tell me what to cut.",
    receivedAt: ago(300),
  },
  {
    id: "mail_3",
    urgency: "this_week",
    from: "Example Co",
    subject: "Renewal reminder",
    snippet: "Your demo plan renews at the end of the week.",
    receivedAt: ago(60 * 30),
  },
  {
    id: "mail_4",
    urgency: "later",
    from: "Newsletter Sample",
    subject: "This month's roundup",
    snippet: "A summary of the month.",
    receivedAt: ago(60 * 24 * 4),
    attachments: 1,
  },
  {
    id: "mail_5",
    urgency: "later",
    from: "Another Sender",
    subject: "Welcome to the demo service",
    snippet: "Thanks for signing up.",
    receivedAt: ago(60 * 24 * 12),
  },
];

const block = (list: EmailCard[]): Block => ({ kind: "emails", emails: list });

const meta = { title: "Chat/EmailCards", component: EmailCards } satisfies Meta<typeof EmailCards>;
export default meta;
type Story = StoryObj<typeof meta>;

export const AllUrgencies: Story = { args: { block: block(emails) } };

export const SingleUrgent: Story = { args: { block: block(emails.slice(0, 1)) } };

export const LaterOnly: Story = { args: { block: block(emails.slice(3)) } };

export const LongContent: Story = {
  args: {
    block: block([
      {
        id: "mail_long",
        urgency: "today",
        from: "A sender with a very long display name that cannot fit on one line of the card",
        subject: "A very long subject line that keeps going well past the width of the card itself",
        snippet:
          "A long preview that runs over several lines so the card has to cut it off after two lines of text, which is the limit for the preview.",
        receivedAt: ago(5),
        attachments: 12,
      },
    ]),
  },
};
