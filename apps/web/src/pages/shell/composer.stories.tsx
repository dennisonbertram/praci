import type { Meta, StoryObj } from "@storybook/react-vite";
import { createRef } from "react";
import { mockRpc } from "../../lib/__mocks__/rpc";
import type { makeBot } from "../../stories/fixtures";
import { mockBots, mockSections } from "../../stories/fixtures";
import { Composer } from "./composer";

const meta = {
  title: "Shell/Composer",
  component: Composer,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Composer>;
export default meta;
type Story = StoryObj;

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
      "threads.remembered": { messageIds: ["msg_2"] },
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
/** After Skip tour: one suggested question, one tap. */
export const ComposerQuickAsk: Story = {
  render: () => composer({ quickAsk: { label: "Ask Chief", onAsk: () => undefined } }),
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
