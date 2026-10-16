import type { Meta, StoryObj } from "@storybook/react-vite";
import { createRef, type ReactNode, useEffect } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { mockRpc } from "../lib/__mocks__/rpc";
import { mockBots, mockSections } from "../stories/fixtures";
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

const loaded = () =>
  mockRpc({
    "spaces.list": navigation,
    "threads.get": snapshot,
    "threads.head": { threadId: "thread_demo", cursor: 4 },
    "threads.messages": { threadId: "thread_demo", messages: [], olderCursor: null },
    "routines.list": [],
    "skills.list": [],
    "connections.list": [],
    "connections.catalog": [],
    "agentSkills.list": [],
    "threads.subscribe": () =>
      (async function* () {
        await new Promise(() => undefined);
      })(),
    usage: null,
  });

export const Conversation: Story = {
  decorators: [at("/app/bot_ada")],
  beforeEach: loaded,
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
