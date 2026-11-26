import type { Bot, Group } from "@rakazo/contracts";
import { Button } from "@rakazo/ui-web";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { SetStateAction } from "react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ROOT_CONTAINER } from "../../components/sidebar-folders/drop-target";
import { makeBot } from "../../stories/fixtures";
import type { SpaceSidebarProps } from "./space-sidebar";
import { SpaceSidebar, sidebarGroupsForSpaces } from "./space-sidebar";

const meta = {
  title: "Shell/Space sidebar",
  parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const sections = [
  {
    id: "folder_workspace",
    name: "Workspace",
    position: 0,
    collapsed: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];
const bots = [
  makeBot({
    id: "bot_ada",
    name: "Ada",
    title: "Research helper",
    preview: "Reviewing the sample report",
    updatedAt: "2026-01-01T00:00:00.000Z",
    pinned: true,
  }),
  makeBot({
    id: "bot_bram",
    name: "Bram",
    title: "Operations helper",
    sectionId: "folder_workspace",
    preview: "Running the sample checklist",
    status: "running",
    updatedAt: "2026-01-01T00:01:00.000Z",
  }),
  makeBot({
    id: "bot_cleo",
    name: "Cleo",
    title: "Finance helper",
    sectionId: "folder_workspace",
    unread: true,
    updatedAt: "2026-01-01T00:02:00.000Z",
  }),
];
const pageAgentBots = [
  makeBot({
    id: "bot_page_inbox",
    name: "Inbox agent",
    spawnKey: "inbox-agent:user_demo",
    updatedAt: "2026-01-01T00:03:00.000Z",
  }),
  makeBot({
    id: "bot_page_finance",
    name: "Finance agent",
    spawnKey: "finance-agent:user_demo",
    updatedAt: "2026-01-01T00:04:00.000Z",
  }),
  makeBot({
    id: "bot_page_devin",
    name: "Devin agent",
    spawnKey: "devin-agent:user_demo",
    updatedAt: "2026-01-01T00:05:00.000Z",
  }),
  makeBot({
    id: "bot_page_box",
    name: "Box agent",
    spawnKey: "box-agent:user_demo",
    updatedAt: "2026-01-01T00:06:00.000Z",
  }),
  makeBot({
    id: "bot_page_carta",
    name: "Carta agent",
    spawnKey: "carta-agent:user_demo",
    updatedAt: "2026-01-01T00:07:00.000Z",
  }),
  makeBot({
    id: "bot_page_brex",
    name: "Brex agent",
    spawnKey: "brex-agent:user_demo",
    updatedAt: "2026-01-01T00:08:00.000Z",
  }),
  makeBot({
    id: "bot_page_mercury",
    name: "Mercury agent",
    spawnKey: "mercury-agent:user_demo",
    updatedAt: "2026-01-01T00:09:00.000Z",
  }),
];
const emailChatBots = [
  makeBot({
    id: "bot_email_thread",
    name: "Client email",
    spawnKey: "mail-thread:conn_demo:thread_demo",
    updatedAt: "2026-01-01T00:05:00.000Z",
  }),
];
const operationsGroup: Group = {
  id: "group_operations",
  spaceId: "space_demo",
  name: "Operations",
  pinned: false,
  sectionId: null,
  position: null,
  archivedAt: null,
  members: [
    { botId: "bot_ada", name: "Ada", color: "#6366f1" },
    { botId: "bot_bram", name: "Bram", color: "#10b981" },
  ],
  threadId: "thread_group_operations",
  preview: "",
  unread: false,
  updatedAt: "2026-01-01T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
};

type Mode = "expanded" | "rail" | "search-trigger" | "folder-roster";

export function SidebarFixture({
  mode,
  currentPage = null,
  gtmNeedsYou = 0,
  devinConnected = false,
  devinNeedsYou = 0,
  brexConnected = false,
  tourOpen = false,
  onTourSkip = () => undefined,
  onTourEnd = () => undefined,
  pageAgents = false,
  crowded = false,
  singlePageAgent = false,
  emailChats = false,
  customPage = false,
  activePageAgent = false,
  activeEmailChat = false,
  activityMode = false,
  toggleActivityMode = () => undefined,
  onFocusComposer,
  archivedBots = [],
  archivedOpenInitially = false,
  openSettings = () => undefined,
}: {
  mode: Mode;
  openSettings?: () => void;
  /** The page key the route shows. */
  currentPage?: string | null;
  gtmNeedsYou?: number;
  devinConnected?: boolean;
  devinNeedsYou?: number;
  brexConnected?: boolean;
  tourOpen?: boolean;
  onTourSkip?: () => void;
  onTourEnd?: () => void;
  pageAgents?: boolean;
  /** Page agents that have been used, so all of them are listed. */
  crowded?: boolean;
  singlePageAgent?: boolean;
  emailChats?: boolean;
  /** An idle page agent the person made with New page. */
  customPage?: boolean;
  activePageAgent?: boolean;
  activeEmailChat?: boolean;
  activityMode?: boolean;
  toggleActivityMode?: () => void;
  /** Called when a row click asks for the message box to take focus. */
  onFocusComposer?: (botId: string | null) => void;
  archivedBots?: Bot[];
  archivedOpenInitially?: boolean;
}) {
  const navigate = useNavigate();
  const sidebarRef = useRef<HTMLElement>(null);
  const sidebarScrollRef = useRef<HTMLDivElement>(null);
  const spaceMenuAnchor = useRef<HTMLElement>(null);
  const botMenuAnchor = useRef<HTMLElement>(null);
  const keepNoticeFor = useRef<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [archivedOpen, setArchivedOpen] = useState(archivedOpenInitially);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [fileDropBotId, setFileDropBotId] = useState<string | null>(null);
  const [, setFocusComposerBotIdState] = useState<string | null>(null);
  const setFocusComposerBotId = (value: SetStateAction<string | null>) => {
    if (typeof value !== "function") onFocusComposer?.(value);
    setFocusComposerBotIdState(value);
  };
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(true);
  const [, setNewSpaceOpen] = useState(false);
  const [, setPickerInfoTopic] = useState<"group" | "space" | null>(null);
  const [, setSpaceMenu] = useState<{
    id: string;
    position: { x: number; y: number };
  } | null>(null);
  const [botMenu, setBotMenu] = useState<{
    kind: "bot" | "group";
    id: string;
    position: { x: number; y: number };
  } | null>(null);
  const fixtureBots = [
    ...bots,
    ...(pageAgents
      ? (singlePageAgent ? pageAgentBots.slice(0, 1) : pageAgentBots).map((bot) =>
          crowded ? { ...bot, preview: "Ready" } : bot,
        )
      : []),
    ...(emailChats ? [...emailChatBots, makeBot({ id: "bot_plain", name: "Plain chat" })] : []),
    ...(customPage
      ? [makeBot({ id: "bot_custom_page", name: "New page", spawnKey: "custom-page:demo" })]
      : []),
  ];
  const [, setDeleteTarget] = useState<ReturnType<typeof makeBot> | null>(null);
  const [, setDeleteGroupTarget] = useState<typeof operationsGroup | null>(null);
  const rail = mode === "rail";
  const sidebarGroups = sidebarGroupsForSpaces(
    [
      {
        id: "space_demo",
        name: "Demo space",
        canRename: true,
        canDelete: true,
        bots: fixtureBots,
        groups: [operationsGroup],
        botSections: sections,
      },
    ],
    "",
    "space_demo",
    "Personal",
  );
  const props: SpaceSidebarProps = {
    sidebarRef,
    botsSidebarDensity: "comfortable",
    botsSidebarCollapsed: rail,
    rail,
    sidebarDocked: true,
    mobileSidebarOpen,
    setBotsSidebarCollapsedPref: () => undefined,
    onOpenSearch: () => setSearchOpen(true),
    activityMode,
    toggleActivityMode,
    setMobileSidebarOpen,
    createMenuOpen,
    setCreateMenuOpen,
    bots: fixtureBots,
    initialBotsLoaded: true,
    createBot: async () => undefined,
    createPage: async () => undefined,
    markBotsRead: async () => undefined,
    askArchiveBots: () => undefined,
    navigate,
    setPanel: () => undefined,
    setNewSpaceOpen,
    canCreateSpace: true,
    setPickerInfoTopic,
    sidebarScrollRef,
    collapsedSidebarSections: new Set<string>(),
    toggleSidebarSection: () => undefined,
    currentPage,
    unseen: {},
    inboxUnread: 0,
    glance: {
      hasTickets: false,
      devinConnected,
      brexConnected,
      devinNeedsYou,
      gtmNeedsYou,
      legalDueSoon: 0,
      dataRoomWaiting: 0,
      botKinds: {},
    },
    sidebarLayout: { folders: ["folder_workspace"], containers: { [ROOT_CONTAINER]: [] } },
    sidebarDragLabel: () => "",
    dropSidebarItem: () => undefined,
    sidebarDragOverlay: () => null,
    sidebarGroups,
    botSections: sections,
    bootstrapMe: null,
    setBootstrapMe: () => undefined,
    chiefId: fixtureBots[0]?.id,
    tourOpen,
    onTourAsk: () => undefined,
    onTourSkip,
    onTourEnd,
    setTourRestart: () => undefined,
    hiddenPages: [],
    addedPages: [],
    toggleHiddenPage: async () => undefined,
    setAddedPages: () => undefined,
    collapsedRosterParents: new Set<string>(),
    editingFolderId,
    toggleFolder: async () => undefined,
    setEditingFolderId,
    renameFolder: async () => undefined,
    deleteFolder: async () => undefined,
    openSpaceChat: () => undefined,
    spaceMenuAnchor,
    setSpaceMenu,
    inGroup: false,
    pageMode: false,
    active: activeEmailChat
      ? emailChatBots[0]
      : activePageAgent
        ? pageAgentBots[0]
        : fixtureBots[0],
    activeGroup: undefined,
    dismissedRunErrorIds: new Set<string>(),
    displayedRunError: null,
    toggleRosterParent: () => undefined,
    fileDropBotId,
    rowFileDrag: () => false,
    setFileDropBotId,
    keepNoticeFor,
    onAttachmentPick: () => false,
    setFocusComposerBotId,
    openBot: async () => undefined,
    openBotSettings: () => undefined,
    moveSidebarItem: async () => undefined,
    botMenuAnchor,
    setBotMenu,
    agentAppFor: () => undefined,
    activeSnapshot: null,
    botMenu,
    archivedBots,
    archivedGroups: [],
    archivedOpen,
    setArchivedOpen,
    refreshBots: async () => undefined,
    setDeleteTarget,
    setDeleteGroupTarget,
    integrationsMode: false,
    menuOpen,
    setMenuOpen,
    userName: "Demo User",
    initials: "DU",
    openSettings,
  };

  return (
    <div className="relative h-dvh w-full bg-background">
      {!mobileSidebarOpen ? (
        <Button className="m-2 lg:hidden" onClick={() => setMobileSidebarOpen(true)}>
          Open navigation
        </Button>
      ) : null}
      <SpaceSidebar {...props} />
      {searchOpen ? <output data-testid="search-open">Command palette open</output> : null}
    </div>
  );
}

export const Expanded: Story = {
  render: () => <SidebarFixture mode="expanded" />,
};

export const Rail: Story = {
  render: () => <SidebarFixture mode="rail" />,
};

export const SearchTrigger: Story = {
  render: () => <SidebarFixture mode="search-trigger" />,
};

export const FolderAndRoster: Story = {
  render: () => <SidebarFixture mode="folder-roster" />,
};

export const DevinNeedsYou: Story = {
  render: () => (
    <SidebarFixture mode="expanded" currentPage="devin" devinConnected devinNeedsYou={2} />
  ),
};

/** Open "Page agents" and scroll: its header stays pinned at the top. */
export const PageAgents: Story = {
  render: () => <SidebarFixture mode="expanded" pageAgents />,
};

export const Fundraising: Story = {
  render: () => <SidebarFixture mode="expanded" currentPage="fundraising" />,
};
