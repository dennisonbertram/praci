import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { makeBot } from "../../stories/fixtures";
import { EmailAgentPanel } from "./EmailAgentPanel";

const bot = makeBot({ id: "bot_email_agent", name: "Notice of Stockholder Action" });

const meta = {
  title: "Inbox/Email agent panel",
  component: EmailAgentPanel,
  parameters: { layout: "fullscreen" },
  args: { bot, onClose: () => undefined, onReplyWithDraft: () => undefined },
  decorators: [
    (Story) => (
      <div className="h-[640px] w-96">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EmailAgentPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

const message = (seq: number, role: "user" | "bot", text: string) => ({
  id: `msg_${seq}`,
  threadId: "thread_email_agent",
  seq,
  role,
  blocks: [{ kind: "text", text }],
  ...(role === "bot" ? { botId: bot.id } : {}),
  createdAt: `2026-01-01T10:0${seq}:00.000Z`,
});

/** The email agent's chat beside an open message, as the Shell shows a page agent's chat. */
export const Answered: Story = {
  beforeEach: () =>
    mockRpc({
      "threads.get": {
        threadId: "thread_email_agent",
        cursor: 2,
        messages: [
          message(1, "user", "Help me answer this."),
          message(2, "bot", "**1. Closing out.** Sample answer with a draft reply."),
        ],
        olderCursor: null,
        botId: bot.id,
        run: null,
      },
    }),
};

export const Empty: Story = {
  beforeEach: () =>
    mockRpc({
      "threads.get": {
        threadId: "thread_email_agent",
        cursor: -1,
        messages: [],
        olderCursor: null,
        botId: bot.id,
        run: null,
      },
    }),
};

/** A plain-text answer to a draft request offers Reply with draft. */
export const DraftAnswered: Story = {
  beforeEach: () =>
    mockRpc({
      "threads.get": {
        threadId: "thread_email_agent",
        cursor: 2,
        messages: [
          message(1, "user", "Draft a reply"),
          message(2, "bot", "Hi Sam, thanks for sending this over. I will sign it today."),
        ],
        olderCursor: null,
        botId: bot.id,
        run: null,
      },
    }),
};

/** A refusal after a draft request is shown as an answer only: no Reply with draft. */
export const DraftRefused: Story = {
  beforeEach: () =>
    mockRpc({
      "threads.get": {
        threadId: "thread_email_agent",
        cursor: 2,
        messages: [
          message(1, "user", "Draft a reply"),
          message(2, "bot", "I can't create the reply because mail_send is not available to me."),
        ],
        olderCursor: null,
        botId: bot.id,
        run: null,
      },
    }),
};
