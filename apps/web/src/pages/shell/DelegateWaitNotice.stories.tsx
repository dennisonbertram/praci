import type { Meta, StoryObj } from "@storybook/react-vite";
import { DelegateWaitNotice } from "./DelegateWaitNotice";

const sentMinutesAgo = (minutes: number) => [
  {
    createdAt: new Date(Date.now() - minutes * 60_000).toISOString(),
    blocks: [
      {
        kind: "bot_message_sent" as const,
        toBotId: "bot_inbox",
        toBotName: "Inbox agent",
        text: "Email Jana the update.",
      },
    ],
  },
];

const meta = {
  title: "Shell/Delegate wait notice",
  component: DelegateWaitNotice,
  args: { messages: sentMinutesAgo(2), onRetry: () => undefined },
} satisfies Meta<typeof DelegateWaitNotice>;
export default meta;

type Story = StoryObj<typeof meta>;

/** Quiet for a minute, no notice yet. */
export const FirstMinute: Story = { args: { messages: sentMinutesAgo(0.2) } };

export const Waiting: Story = {};

export const Unanswered: Story = { args: { messages: sentMinutesAgo(6) } };
