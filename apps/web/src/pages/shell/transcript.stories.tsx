import type { ThreadMessage } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ComponentProps } from "react";
import { createRef } from "react";
import { Transcript } from "./transcript";

const meta = {
  title: "Shell/Transcript",
  component: Transcript,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Transcript>;
export default meta;

type Story = StoryObj;

const noop = () => undefined;
const asyncNoop = async () => {};

function message(seq: number, role: "user" | "bot", text: string): ThreadMessage {
  return {
    id: `message_${seq}`,
    threadId: "thread_demo",
    seq,
    role,
    blocks: [{ kind: "text", text }],
    ...(role === "bot" ? { botId: "bot_demo" } : {}),
    createdAt: `2026-01-01T10:0${seq}:00.000Z`,
  };
}

const baseProps = {
  scrollRef: createRef<HTMLDivElement>(),
  sentHere: { current: false },
  scrollRequest: null,
  onScrollRequestHandled: noop,
  artifactTarget: { botId: "bot_demo" },
  showToolActivity: false,
  olderCursor: null,
  loadingOlder: false,
  answerableAskMessageId: null,
  running: false,
  workingBots: [],
  onLoadOlder: asyncNoop,
  onOpenBot: noop,
  onAnswer: asyncNoop,
  onReply: noop,
  onQuote: noop,
  onReact: asyncNoop,
  onJumpToMessage: noop,
  onOpenPeerMessages: noop,
  peerBot: () => undefined,
  onRefresh: asyncNoop,
  onBotChanged: asyncNoop,
  onAddRoutine: noop,
  voiceReady: false,
  speakingMessageId: null,
  onSpeak: noop,
  onOpenComputer: noop,
} satisfies Omit<ComponentProps<typeof Transcript>, "messages">;

const conversation = [
  message(1, "user", "Can you summarize the sample report?"),
  message(2, "bot", "I found three highlights in the sample report."),
  message(3, "user", "Thanks. Draft a short reply."),
  message(4, "bot", "Draft: Thanks for sending the sample report."),
];

export const Conversation: Story = {
  render: () => (
    <div className="h-[560px]">
      <Transcript {...baseProps} messages={conversation} />
    </div>
  ),
};

export const Unread: Story = {
  render: () => (
    <div className="h-[560px]">
      <Transcript
        {...baseProps}
        messages={[
          message(1, "user", "Please check the latest sample report."),
          message(2, "bot", "I found a new section that needs your review."),
          message(3, "bot", "The remaining sections look consistent."),
        ]}
        lastReadSeq={1}
      />
    </div>
  ),
};

export const Running: Story = {
  render: () => (
    <div className="h-[560px]">
      <Transcript
        {...baseProps}
        messages={[message(1, "user", "Please prepare the sample report summary.")]}
        running
      />
    </div>
  ),
};
