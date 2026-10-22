import { BOT_COLORS } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { userEvent, within } from "storybook/test";
import { mockRpc } from "../lib/__mocks__/rpc";
import { makeBot, mockBots, mockSections } from "../stories/fixtures";
import { ShellPage } from "./Shell";

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

const STAMP = "2026-01-01T00:00:00.000Z";
const folderSection = (id: string, name: string, position: number, collapsed = false) => ({
  id,
  name,
  position,
  collapsed,
  createdAt: STAMP,
  updatedAt: STAMP,
});
const agent = (
  id: string,
  name: string,
  color: string,
  over: Partial<ReturnType<typeof makeBot>> = {},
) => makeBot({ id, name, title: "", color, threadId: `thread_${id}`, ...over });
const folderBots = [
  agent("bot_chief", "Chief", "#6366f1", { position: 0, pinned: true }),
  agent("bot_ledger", "Ledger agent", BOT_COLORS[2], {
    sectionId: "folder_workspace",
    position: 0,
    spawnKey: "finance-agent:user_demo",
  }),
  agent("bot_counsel", "Counsel agent", BOT_COLORS[3], {
    sectionId: "folder_workspace",
    position: 1,
    spawnKey: "legal-agent:user_demo",
    unread: true,
  }),
  agent("bot_relay", "Relay agent", BOT_COLORS[5], {
    sectionId: "folder_apps",
    position: 0,
    spawnKey: "integration-agent:server_relay",
  }),
  agent("bot_atlas", "Atlas agent", BOT_COLORS[1], {
    sectionId: "folder_apps",
    position: 1,
    spawnKey: "integration-agent:server_atlas",
  }),
  agent("bot_scout", "Scout", BOT_COLORS[0], { position: 1 }),
];
const operationsGroup = {
  id: "group_operations",
  spaceId: "space_demo",
  name: "Operations",
  pinned: false,
  sectionId: null,
  position: null,
  archivedAt: null,
  members: [
    { botId: "bot_chief", name: "Chief", color: "#6366f1" },
    { botId: "bot_scout", name: "Scout", color: BOT_COLORS[0] },
    { botId: "bot_ledger", name: "Ledger agent", color: BOT_COLORS[2] },
  ],
  threadId: "thread_group_operations",
  preview: "",
  unread: false,
  updatedAt: STAMP,
  createdAt: STAMP,
};

const demoMe = {
  ticketBoardEnabled: false,
  userId: "user_demo",
  email: "demo@example.com",
  name: "Demo User",
  spaceId: "space_demo",
  isDeploymentOwner: true,
  needsModel: false,
  defaultProvider: null,
  defaultModel: null,
  hostCredentialProvider: null,
  hostCredentialSource: null,
  computerHost: null,
  canChooseHostComputer: false,
  sandboxProvider: "docker",
  avatarStyle: "organic",
  billingEnabled: false,
};

/** The Personal list: a pinned agent, two folders (Apps closed, its needs-input status still showing), then the unfiled chats under a Chats header. */
export const PersonalFolders: Story = {
  decorators: [at("/app/bot_chief")],
  beforeEach: () => {
    loadedWith(folderBots[0] as ReturnType<typeof makeBot>)();
    const sections = [
      folderSection("folder_workspace", "Workspace", 0),
      folderSection("folder_apps", "Apps", 1, true),
    ];
    mockRpc({
      // Folders live in this list so a refresh after New folder keeps what was added.
      "spaces.list": () => ({
        ...navigation,
        current: {
          ...navigation.current,
          bots: folderBots,
          groups: [operationsGroup],
          botSections: [...sections],
        },
      }),
      bootstrap: {
        me: demoMe,
        bots: folderBots,
        groups: [operationsGroup],
        botSections: [...sections],
        archivedBots: [],
        archivedGroups: [],
        thread: { ...snapshot, botId: "bot_chief" },
        routines: [],
        spaces: [{ ...space, bots: [], groups: [], botSections: [...sections] }],
      },
      "botSections.add": (input: unknown) => {
        const created = folderSection("folder_new", (input as { name: string }).name, 2);
        sections.push(created);
        return created;
      },
      "botSections.update": (input: unknown) => {
        const { sectionId, name } = input as { sectionId: string; name: string };
        const found = sections.find((section) => section.id === sectionId);
        if (found) found.name = name;
        return found;
      },
      "sidebar.autoGroup": {
        placements: [{ item: { kind: "bot", id: "bot_scout" }, folderId: null, position: 1 }],
        createdFolderIds: [],
      },
      "notifications.unseenCounts": { counts: {} },
      "notifications.glance": {
        financeRunwayMonths: null,
        legalDueSoon: 0,
        devinNeedsYou: 0,
        devinConnected: true,
        dataRoomWaiting: 0,
        hasTickets: false,
        botKinds: { bot_relay: "needs_input" },
      },
    });
  },
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

const rootAgents = folderBots.map((bot) => ({ ...bot, sectionId: null }));

/** Activity open above the Pages box, and the page and integration agents folded into one row. */
export const SidebarPageAgents: Story = {
  decorators: [at("/app/bot_chief")],
  beforeEach: () => {
    loadedWith(rootAgents[0] as ReturnType<typeof makeBot>)();
    mockRpc({
      "spaces.list": {
        ...navigation,
        current: { ...navigation.current, bots: rootAgents, groups: [], botSections: [] },
      },
      "runs.list": (input: unknown) =>
        (input as { filter: string }).filter === "active"
          ? {
              runs: [
                {
                  runId: "run_1",
                  botId: "bot_counsel",
                  botName: "Counsel agent",
                  groupId: null,
                  groupName: null,
                  threadId: "thread_1",
                  status: "waiting_input",
                  trigger: "user",
                  notificationsEnabled: false,
                  promptSnippet: "Which contract should I review?",
                  updatedAt: STAMP,
                },
              ],
            }
          : { runs: [] },
      bootstrap: {
        me: demoMe,
        bots: rootAgents,
        groups: [],
        botSections: [],
        archivedBots: [],
        archivedGroups: [],
        thread: { ...snapshot, botId: "bot_chief" },
        routines: [],
        spaces: [{ ...space, bots: [], groups: [], botSections: [] }],
      },
      "notifications.unseenCounts": { counts: {} },
      "notifications.glance": {
        financeRunwayMonths: null,
        legalDueSoon: 0,
        dataRoomWaiting: 0,
        hasTickets: false,
        botKinds: { bot_counsel: "needs_input" },
      },
    });
  },
  // Activity starts closed on every load.
  play: async ({ canvasElement }) => {
    const toggle = await within(canvasElement).findByRole("button", {
      name: "Activity",
    });
    await userEvent.click(toggle);
  },
};

const emailChatBots = [
  agent("bot_chief", "Chief", "#6366f1", { position: 0, pinned: true }),
  agent("bot_scout", "Scout", BOT_COLORS[0], { position: 1 }),
  agent("bot_counsel", "Counsel agent", BOT_COLORS[3], {
    position: 2,
    spawnKey: "legal-agent:user_demo",
  }),
  ...[
    "Q3 board deck",
    "Quick question",
    "Interview feedback",
    "Redlines",
    "Investor update",
    "Lease",
  ].map((subject, i) =>
    agent(`bot_mail_${i}`, subject, BOT_COLORS[i % BOT_COLORS.length] ?? "#6366f1", {
      position: 3 + i,
      spawnKey: `mail-thread:conn_demo:thread_${i}`,
    }),
  ),
];

/** Six Ask-agent chats fold into one "Email chats" row; the lone Legal agent folds into "Page agents". */
export const SidebarEmailChats: Story = {
  // The sidebar only scrolls inside a bounded page, as in the app.
  decorators: [
    (Story) => (
      <div className="h-dvh">
        <Story />
      </div>
    ),
    at("/app/bot_chief"),
  ],
  beforeEach: () => {
    loadedWith(emailChatBots[0] as ReturnType<typeof makeBot>)();
    mockRpc({
      "spaces.list": {
        ...navigation,
        current: { ...navigation.current, bots: emailChatBots, groups: [], botSections: [] },
      },
      bootstrap: {
        me: demoMe,
        bots: emailChatBots,
        groups: [],
        botSections: [],
        archivedBots: [],
        archivedGroups: [],
        thread: { ...snapshot, botId: "bot_chief" },
        routines: [],
        spaces: [{ ...space, bots: [], groups: [], botSections: [] }],
      },
      "notifications.unseenCounts": { counts: {} },
      "notifications.glance": {
        financeRunwayMonths: null,
        legalDueSoon: 0,
        dataRoomWaiting: 3,
        hasTickets: false,
        botKinds: {},
      },
    });
  },
};
