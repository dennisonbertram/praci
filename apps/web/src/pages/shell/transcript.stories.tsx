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
  onMarkUnread: noop,
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

/** A routine's message names the routine on one line above the bubble. */
export const FromRoutine: Story = {
  render: () => (
    <div className="h-[560px]">
      <Transcript
        {...baseProps}
        messages={[
          {
            ...message(1, "bot", "Nothing needs your attention today."),
            routineName: "Daily check-in",
          },
        ]}
      />
    </div>
  ),
};

/** A message sent by an outside MCP client names its connection above the bubble. */
export const ViaClient: Story = {
  render: () => (
    <div className="h-[560px]">
      <Transcript
        {...baseProps}
        messages={[{ ...message(1, "user", "What is on my plate today?"), via: "Claude Code" }]}
      />
    </div>
  ),
};

/** A message with a file: its More menu offers Send to agent, which opens the chosen agent with the file attached. */
export const FileSendToAgent: Story = {
  render: () => (
    <div className="h-[560px]">
      <Transcript
        {...baseProps}
        sendTargets={[
          { id: "bot_legal", name: "Legal agent", color: "#336699" },
          { id: "bot_finance", name: "Finance agent", color: "#996633" },
        ]}
        onSendFiles={noop}
        messages={[
          {
            ...message(1, "bot", ""),
            blocks: [
              {
                kind: "file",
                artifactId: "artifact_demo",
                name: "Sample call - transcript.md",
                mimeType: "text/markdown",
                size: 7300,
              },
            ],
          },
        ]}
      />
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

/** A mail approval card is wide, so its hover actions sit under it instead of beside it. */
export const MailApproval: Story = {
  render: () => (
    <div className="h-[420px] w-[760px]">
      <Transcript
        {...baseProps}
        messages={[
          message(1, "user", "Send Sam the sample update."),
          {
            ...message(2, "bot", ""),
            blocks: [
              {
                kind: "ask",
                text: "Send this email?",
                mail: {
                  tool: "mail_send",
                  to: ["sam@example.test"],
                  cc: [],
                  bcc: [],
                  subject: "Sample update",
                  body: "Hi Sam, here is the sample update.",
                },
              },
            ],
          },
        ]}
        lastReadSeq={2}
      />
    </div>
  ),
};

/** Hovering a wide mail approval keeps the actions under it, clear of the next message. */
export const MailApprovalThenMessage: Story = {
  render: () => (
    <div className="h-[420px] w-[760px]">
      <Transcript
        {...baseProps}
        messages={[
          {
            ...message(1, "bot", ""),
            blocks: [
              {
                kind: "ask",
                text: "Send this email?",
                mail: {
                  tool: "mail_send",
                  to: ["sam@example.test"],
                  cc: [],
                  bcc: [],
                  subject: "Sample update",
                  body: "Hi Sam, here is the sample update.",
                },
              },
            ],
          },
          message(2, "user", "Thanks, that looks right."),
        ]}
        lastReadSeq={2}
      />
    </div>
  ),
};

const sentMailMessage = (): ThreadMessage => ({
  ...message(1, "bot", ""),
  blocks: [
    {
      kind: "ask",
      text: "Send this email?",
      status: "answered",
      answer: "allow",
      mail: {
        tool: "mail_send",
        account: "me@example.test",
        to: ["sam@example.test"],
        cc: [],
        bcc: [],
        subject: "Re: Sample update",
        body: "Hi Sam, here is the sample update.",
        outcome: "sent",
      },
    },
  ],
});

const SentMailThenWorking = ({ width }: { width: number }) => (
  <div className="h-[420px]" style={{ width }}>
    <Transcript
      {...baseProps}
      running
      workingBots={[{ botId: "bot_demo", name: "Ada", color: "#888888" }]}
      messages={[sentMailMessage()]}
      lastReadSeq={1}
    />
  </div>
);

/** Hovering a sent mail card: its rail ends above the bot's working row. */
export const SentMailThenWorkingWide: Story = { render: () => <SentMailThenWorking width={760} /> };

/** The same in a narrow transcript, such as the Inbox agent panel. */
export const SentMailThenWorkingNarrow: Story = {
  render: () => <SentMailThenWorking width={360} />,
};
