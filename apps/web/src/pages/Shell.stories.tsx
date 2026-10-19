import { BOT_COLORS } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { createRef, type ReactNode, useEffect } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { mockRpc } from "../lib/__mocks__/rpc";
import { makeBot, mockBots, mockSections } from "../stories/fixtures";
import { Composer, ShellPage } from "./Shell";

/** The preview already provides a router at "/", so move it to the route instead of nesting one. */
function At({ path, children }: { path: string; children: ReactNode }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  useEffect(() => {
    if (pathname !== path) navigate(path, { replace: true });
  }, [pathname, path, navigate]);
  return pathname === path ? children : null;
}

const at = (path: string) => (Story: () => ReactNode) => (
  <At path={path}>
    <Routes>
      <Route path="/app/finance/*" element={<Story />} />
      <Route path="/app/inbox" element={<Story />} />
      <Route path="/app/:botId" element={<Story />} />
    </Routes>
  </At>
);

const meta = {
  title: "Shell/Shell page",
  component: ShellPage,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Also shows: SidebarPageLink, Transcript, QuoteSelectionButton, MessageHoverActions, ComputerReleaseActions, MessageView, DesktopKindEmptyState",
      },
    },
  },
} satisfies Meta<typeof ShellPage>;
export default meta;
type Story = StoryObj<typeof meta>;

const space = {
  id: "space_demo",
  name: "Demo space",
  isDefault: true,
  hasContent: true,
  bots: [],
  groups: [],
  externalConversations: [],
  botSections: [],
};

const navigation = {
  current: {
    id: "space_demo",
    name: "Demo space",
    bots: mockBots,
    groups: [],
    externalConversations: [],
    botSections: mockSections,
  },
  spaces: [space],
};

const message = (seq: number, role: "user" | "bot", text: string) => ({
  id: `msg_${seq}`,
  threadId: "thread_demo",
  seq,
  role,
  blocks: [{ kind: "text", text }],
  ...(role === "bot" ? { botId: "bot_ada" } : {}),
  createdAt: `2026-01-01T10:0${seq}:00.000Z`,
});

const snapshot = {
  threadId: "thread_demo",
  cursor: 4,
  messages: [
    message(1, "user", "Can you summarize the sample report?"),
    message(
      2,
      "bot",
      "Here is a short summary of the **sample report**:\n\n- Point one\n- Point two",
    ),
    message(3, "user", "Thanks. Draft a reply."),
    message(4, "bot", "Draft: Hello, thanks for sending the sample report."),
  ],
  olderCursor: null,
  botId: "bot_ada",
  run: null,
};

const loadedWith =
  (bot: ReturnType<typeof makeBot>, thread = snapshot) =>
  () =>
    mockRpc({
      "spaces.list": {
        ...navigation,
        current: { ...navigation.current, bots: [bot, ...mockBots] },
      },
      "threads.get": { ...thread, botId: bot.id },
      "threads.head": { threadId: "thread_demo", cursor: thread.cursor },
      "threads.messages": { threadId: "thread_demo", messages: [], olderCursor: null },
      "routines.list": [],
      "skills.list": [],
      "connections.list": [],
      "connections.catalog": [],
      "connections.featured": [],
      "agentSkills.list": [],
      "threads.subscribe": () =>
        (async function* () {
          await new Promise(() => undefined);
        })(),
      usage: null,
    });

const loaded = loadedWith(mockBots[0] as ReturnType<typeof makeBot>);

/** A page agent keeps the fixed colour its Inbox gets. */
export const ConversationPageAgent: Story = {
  decorators: [at("/app/bot_inbox_agent")],
  beforeEach: loadedWith(
    makeBot({
      id: "bot_inbox_agent",
      name: "Inbox agent",
      color: BOT_COLORS[2],
      spawnKey: "inbox-agent:user_demo",
    }),
  ),
};

/** An app agent takes the palette colour nearest its brand (Brex is orange). */
export const ConversationAppAgent: Story = {
  decorators: [at("/app/bot_brex_agent")],
  beforeEach: loadedWith(
    makeBot({
      id: "bot_brex_agent",
      name: "Brex agent",
      color: BOT_COLORS[5],
      spawnKey: "integration-agent:server_demo",
    }),
  ),
};

export const Conversation: Story = {
  decorators: [at("/app/bot_ada")],
  beforeEach: loaded,
};

/** Two replies arrived since the reader last opened the thread: the divider goes before the first. */
export const ConversationUnreadDivider: Story = {
  decorators: [at("/app/bot_ada")],
  beforeEach: loadedWith(
    mockBots[0] as ReturnType<typeof makeBot>,
    {
      ...snapshot,
      cursor: 5,
      lastReadSeq: 3,
      messages: [
        ...snapshot.messages,
        message(5, "bot", "I also attached the figures you asked about."),
      ],
    } as typeof snapshot,
  ),
};

const longReply = (seq: number) =>
  message(
    seq,
    seq % 2 ? "user" : "bot",
    `Message ${seq}. ${"A longer line of invented text that fills the conversation so it needs to scroll. ".repeat(5)}`,
  );

/** A long thread opens at the divider, with the unread messages below it counted in the pill. */
export const ConversationUnreadPill: Story = {
  // The transcript only scrolls inside a bounded page, as in the app.
  decorators: [
    (Story) => (
      <div className="h-dvh">
        <Story />
      </div>
    ),
    at("/app/bot_ada"),
  ],
  beforeEach: loadedWith(
    mockBots[0] as ReturnType<typeof makeBot>,
    {
      ...snapshot,
      cursor: 16,
      lastReadSeq: 5,
      messages: Array.from({ length: 16 }, (_, i) => longReply(i + 1)),
    } as typeof snapshot,
  ),
};

const fileInputRef = createRef<HTMLInputElement>();
const composerProps = {
  artifactTarget: { botId: "bot_ada" },
  activeName: "Ada",
  running: false,
  pendingAttachments: [],
  attachmentNotice: null,
  sendError: null,
  runError: null,
  runErrorId: null,
  onRunErrorPresented: () => undefined,
  onDismissError: () => undefined,
  sending: false,
  fileInputRef,
  onAttachmentPick: () => true,
  onRemoveAttachment: () => undefined,
  onSend: async () => true,
  onStop: async () => undefined,
};
const composer = (over: Partial<Parameters<typeof Composer>[0]> = {}) => (
  <div className="w-[640px] max-w-full p-4">
    <Composer {...composerProps} {...over} />
  </div>
);

export const ComposerDefault: Story = { render: () => composer(), beforeEach: loaded };
export const ComposerVoiceAgent: Story = {
  render: () => composer({ onVoice: () => undefined }),
  beforeEach: loaded,
};
export const ComposerRunning: Story = {
  render: () => composer({ running: true }),
  beforeEach: loaded,
};
export const ComposerDisabled: Story = {
  render: () => composer({ disabled: true }),
  beforeEach: loaded,
};
export const ComposerSendError: Story = {
  render: () => composer({ sendError: "The message could not be sent." }),
  beforeEach: loaded,
};
