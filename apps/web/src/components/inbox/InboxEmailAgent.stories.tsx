import type { MessageBlock, ThreadMessage } from "@rakazo/contracts";
import { BotAvatar, Button } from "@rakazo/ui-web";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { PanelRightClose } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { createRef } from "react";
import { expect, userEvent, within } from "storybook/test";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { ResizableSidePanel } from "../../pages/ResizableSidePanel";
import { Composer } from "../../pages/shell/composer";
import { Transcript } from "../../pages/shell/transcript";
import { makeBot } from "../../stories/fixtures";
import { InboxMessageDialog } from "./InboxMessageDialog";

/*
 * Mockup for docs/email-assist/README.md: the Ask agent panel beside an open email. Everything
 * shown is an existing component. The only code here is `AgentSidePanel`, which copies the header
 * and layout the Shell gives a page agent's docked chat and puts it above the dialog.
 * The "Phone" story is the same panel at 375px, where ResizableSidePanel already overlays the page.
 */

const agent = makeBot({
  id: "bot_email_agent",
  name: "Email agent",
  color: "#b9501c",
  spawnKey: "mail-thread-agent:demo",
});

const noop = () => undefined;
const asyncNoop = async () => {};

const transcriptProps = {
  scrollRef: createRef<HTMLDivElement>(),
  sentHere: { current: false },
  scrollRequest: null,
  onScrollRequestHandled: noop,
  artifactTarget: { botId: agent.id },
  showToolActivity: true,
  olderCursor: null,
  loadingOlder: false,
  answerableAskMessageId: null,
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
} satisfies Omit<ComponentProps<typeof Transcript>, "messages" | "running">;

const composerProps = {
  activeName: agent.name,
  running: false,
  pendingAttachments: [],
  attachmentNotice: null,
  sendError: null,
  runError: null,
  runErrorId: null,
  onRunErrorPresented: noop,
  onDismissError: noop,
  sending: false,
  fileInputRef: createRef<HTMLInputElement>(),
  onAttachmentPick: () => false,
  onRemoveAttachment: noop,
  onSend: async () => true,
  onStop: asyncNoop,
  artifactTarget: { botId: agent.id },
  draftKey: "email-agent-story",
} satisfies ComponentProps<typeof Composer>;

const emailText =
  "Maya,\n\nThanks for the notice. Two things.\n\n1. For tax purposes I want to close out my position. Either the company buys back my shares and my warrant for a nominal $1, or I abandon them in writing and you acknowledge it.\n\n2. Can you confirm my share count after the recap, and whether existing investors were offered the Seed Prime round? I had 18,400 preferred on Carta.\n\nSam";

const email = {
  from: "Sam Ortiz <sam@harborline.example>",
  to: "Maya Chen (Mock) <mock-founder@northwind.example.test>",
  cc: "",
  date: "2026-10-19T09:12:00.000Z",
  subject: "Re: Notice of Stockholder Action",
  html: null,
  text: emailText,
  attachments: [],
  thread: [
    {
      id: "msg_nsa_1",
      from: "Maya Chen (Mock)",
      receivedAt: "2026-10-16T15:00:00.000Z",
      snippet: "Notice of Stockholder Action: recapitalization and Seed Prime.",
      fromSelf: true,
    },
  ],
};

const message = (
  seq: number,
  role: "user" | "bot",
  blocks: MessageBlock[],
  id = `msg_${seq}`,
): ThreadMessage => ({
  id,
  threadId: "thread_email_agent",
  seq,
  role,
  blocks,
  ...(role === "bot" ? { botId: agent.id } : {}),
  createdAt: `2026-10-19T09:1${seq}:00.000Z`,
});

/** What Ask agent already starts a chat with: the thread as a card, then the owner's request. */
const start: ThreadMessage[] = [
  message(1, "user", [
    {
      kind: "mail_thread",
      subject: email.subject,
      messages: [
        {
          from: email.from,
          to: email.to,
          date: email.date,
          text: emailText,
        },
      ],
    },
    { kind: "text", text: "Help me answer this." },
  ]),
];

const doneSteps: MessageBlock = {
  kind: "steps",
  durationMs: 14_000,
  steps: [
    { label: "mail_get", count: 1, summary: "Read email thread" },
    { label: "fetch", count: 1, summary: "Read Carta · Sam Ortiz holdings" },
    { label: "search_data_room", count: 1, summary: "Searched data room · 4 found" },
    { label: "read_data_room_item", count: 2, summary: "Read 2 data room files" },
    { label: "mail_search", count: 1, summary: "Searched mail · Seed Prime offer · 3 found" },
  ],
};

const working: ThreadMessage[] = [
  ...start,
  message(
    2,
    "bot",
    [
      {
        kind: "steps",
        steps: [
          { label: "mail_get", count: 1, summary: "Read email thread" },
          { label: "fetch", count: 1, summary: "Read Carta · Sam Ortiz holdings" },
          { label: "search_data_room", count: 1, summary: "Searched data room · 4 found" },
          { label: "read_data_room_item", count: 1 },
        ],
      },
    ],
    "progress:run_1",
  ),
];

const answer = `**1. Closing out.** Carta lists 18,400 Series Seed Preferred and a 2,000-share warrant ([Carta · Sam Ortiz](/app/cap-table)). The warrant can be cancelled with his written consent ([Warrant Agreement.pdf](/app/data-room?item=item_warrant)). I found no repurchase template or board consent. Tax treatment is for your counsel.

**2. After the recap.** Carta's Sep 30 snapshot is before the recap. The 1-for-4 reverse split ([Recap Summary.pdf](/app/data-room?item=item_recap)) gives **4,600 shares (calculated, not read from Carta)**. Seed Prime was offered to all 9 existing investors on Sep 8, including Sam ([Sep 8 offer](/app/inbox)). I found no reply from him.

Draft reply:

> Hi Sam,
>
> Your 18,400 preferred shares become 4,600 after the 1-for-4 reverse split. Seed Prime was offered to all existing investors, including you, on Sep 8.
>
> On closing out: we can do it either way. I will confirm which and send the paperwork this week.
>
> Maya`;

const ready: ThreadMessage[] = [
  ...start,
  message(2, "bot", [doneSteps, { kind: "text", text: answer }]),
];

/** The dialog stays as it is; the panel is the docked page-agent chat, shown above the dialog. */
function AgentSidePanel({ messages, running }: { messages: ThreadMessage[]; running?: boolean }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex justify-end">
      <div className="pointer-events-auto relative flex h-full w-full max-w-[384px] xl:w-auto">
        <ResizableSidePanel open panel="email-agent" botsSidebarCollapsed>
          <div data-testid="email-agent-panel" className="flex h-full min-h-0 w-full flex-col">
            <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-2">
              <span className="flex min-w-0 items-center gap-2">
                <BotAvatar color={agent.color} identity={agent.id} size={22} status="idle" />
                <span className="truncate text-sm font-medium">{agent.name}</span>
              </span>
              <Button variant="ghost" size="icon-sm" aria-label="Close email agent">
                <PanelRightClose aria-hidden="true" />
              </Button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col">
              <Transcript {...transcriptProps} messages={messages} running={Boolean(running)} />
            </div>
            <Composer {...composerProps} running={Boolean(running)} />
          </div>
        </ResizableSidePanel>
      </div>
    </div>
  );
}

function Scene({ messageId, panel }: { messageId: string; panel?: ReactNode }) {
  return (
    <>
      <InboxMessageDialog
        messageId={messageId}
        subject={email.subject}
        unread={false}
        onNavigate={noop}
        onArchive={noop}
        onRead={noop}
        onAskAgent={async () => undefined}
        onClose={noop}
      />
      {panel}
    </>
  );
}

const draftBody =
  "Hi Sam,\n\nYour 18,400 preferred shares become 4,600 after the 1-for-4 reverse split. Seed Prime was offered to all existing investors, including you, on Sep 8.\n\nOn closing out your position: we can do it either way. I will confirm which and send the paperwork this week.\n\nMaya\n\nOn Oct 19, Sam Ortiz wrote:\n> Maya, Thanks for the notice. Two things.";

const meta = {
  title: "Inbox/Email agent panel",
  parameters: { layout: "fullscreen" },
  beforeEach: () => {
    // The narrowest width the panel allows, so it sits beside the 768px dialog on a 1440px screen.
    try {
      localStorage.setItem("rakazo:right-panel-width", "320");
    } catch {
      /* Storage may be disabled. */
    }
    mockRpc({
      "inbox.get": email,
      "inbox.compose.draftSave": { status: "saved" },
      "inbox.compose.prefill": {
        connectionId: "conn_1",
        account: {
          connectionId: "conn_1",
          label: "Work mail",
          address: "mock-founder@northwind.example.test",
        },
        to: "Sam Ortiz <sam@harborline.example>",
        cc: "",
        subject: email.subject,
        body: draftBody,
        replyToMessageId: "msg_email_agent_closed",
        attachments: [],
      },
    });
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Before Ask agent is clicked: the dialog as it is today. */
export const Closed: Story = {
  render: () => <Scene messageId="msg_email_agent_closed" />,
};

/** Ask agent was clicked: the thread card, then lookups in progress for Carta, the data room and mail. */
export const Working: Story = {
  render: () => (
    <Scene
      messageId="msg_email_agent_working"
      panel={<AgentSidePanel messages={working} running />}
    />
  ),
};

/** Answers with sources, a gap, the calculated figure and a draft reply. */
export const Ready: Story = {
  render: () => (
    <Scene messageId="msg_email_agent_ready" panel={<AgentSidePanel messages={ready} />} />
  ),
};

/** Reply opens the existing composer prefilled with the draft; sending is the normal flow. */
export const DraftInComposer: Story = {
  render: () => (
    <Scene messageId="msg_email_agent_draft" panel={<AgentSidePanel messages={ready} />} />
  ),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const dialog = within(await body.findByRole("dialog"));
    await userEvent.click(await dialog.findByRole("button", { name: "Reply" }));
    await expect(
      await body.findByText(/1-for-4 reverse split/, { selector: "p, div" }),
    ).toBeTruthy();
  },
};

/** At 375px the panel is the overlay ResizableSidePanel already uses on small screens. */
export const Phone: Story = {
  render: () => (
    <Scene messageId="msg_email_agent_phone" panel={<AgentSidePanel messages={ready} />} />
  ),
};
