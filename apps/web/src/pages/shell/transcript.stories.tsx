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

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

/** Email cards run the full width of the transcript, the same width as the "New" divider. */
export const UnreadEmailCards: Story = {
  render: () => (
    <div className="h-[640px]">
      <Transcript
        {...baseProps}
        messages={[
          message(1, "user", "Check my inbox."),
          {
            ...message(2, "bot", ""),
            blocks: [
              { kind: "text", text: "Three emails need a reply." },
              {
                kind: "emails",
                emails: [
                  {
                    id: "mail_1",
                    urgency: "today",
                    from: "Sample Vendor",
                    subject: "Invoice due today",
                    snippet:
                      "Your sample invoice is due today. Please review the attached statement.",
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
                ],
              },
            ],
          },
        ]}
        lastReadSeq={1}
      />
    </div>
  ),
};

/** Status card labels, plain tool rows, a peer message row with a chevron, and a monochrome link. */
export const WorkLog: Story = {
  render: () => (
    <div className="h-[640px]">
      <Transcript
        {...baseProps}
        showToolActivity
        messages={[
          message(1, "user", "Where are we on cash?"),
          {
            ...message(2, "bot", ""),
            blocks: [
              {
                kind: "steps",
                steps: [
                  { label: "task_catalog", count: 1 },
                  { label: "legal_unreviewed_documents", count: 1 },
                  { label: "mcp__finance-mercury__requestSendMoney", count: 1 },
                  { label: "mail_search", count: 1 },
                ],
              },
              {
                kind: "bot_message_received",
                fromBotId: "bot_peer",
                fromBotName: "Investors agent",
                text: "Sample text",
              },
              {
                kind: "card",
                lines: [
                  { k: "Cash", v: "$100,000" },
                  { k: "Monthly burn", v: "$10,000" },
                  { k: "Runway", v: "10 months" },
                ],
              },
              {
                kind: "text",
                text: "Write to [sam@example.com](mailto:sam@example.com) for detail.",
              },
            ],
          },
        ]}
      />
    </div>
  ),
};

/** A live run: tool rows keep their full label instead of cutting it to a few characters. */
export const WorkingLog: Story = {
  render: () => (
    <div className="h-[420px] w-[360px]">
      <Transcript
        {...baseProps}
        showToolActivity
        running
        messages={[
          message(1, "user", "Find the invoice and reply."),
          {
            ...message(2, "bot", ""),
            id: "progress:run_demo",
            runId: "run_demo",
            blocks: [
              {
                kind: "steps",
                steps: [
                  { label: "mail_search", count: 1 },
                  { label: "mail_open", count: 1 },
                  { label: "mail_send", count: 1 },
                ],
              },
            ],
          },
        ]}
      />
    </div>
  ),
};
