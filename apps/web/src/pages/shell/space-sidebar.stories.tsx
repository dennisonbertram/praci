import type { Group } from "@rakazo/contracts";
import { Button } from "@rakazo/ui-web";
import type { Meta, StoryObj } from "@storybook/react-vite";
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
  gtmMode = false,
  gtmNeedsYou = 0,
  devinMode = false,
  devinConnected = false,
  devinNeedsYou = 0,
  investorsMode = false,
  fundraisingMode = false,
  tourOpen = false,
  onTourSkip = () => undefined,
  onTourEnd = () => undefined,
  pageAgents = false,
  singlePageAgent = false,
  emailChats = false,
  activePageAgent = false,
  activeEmailChat = false,
}: {
  mode: Mode;
  gtmMode?: boolean;
  gtmNeedsYou?: number;
  devinMode?: boolean;
  devinConnected?: boolean;
  devinNeedsYou?: number;
  investorsMode?: boolean;
  fundraisingMode?: boolean;
  tourOpen?: boolean;
  onTourSkip?: () => void;
  onTourEnd?: () => void;
  pageAgents?: boolean;
  singlePageAgent?: boolean;
  emailChats?: boolean;
  activePageAgent?: boolean;
  activeEmailChat?: boolean;
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
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [fileDropBotId, setFileDropBotId] = useState<string | null>(null);
  const [, setFocusComposerBotId] = useState<string | null>(null);
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
    ...(pageAgents ? (singlePageAgent ? pageAgentBots.slice(0, 1) : pageAgentBots) : []),
    ...(emailChats ? emailChatBots : []),
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
    activityMode: false,
    toggleActivityMode: () => undefined,
    setMobileSidebarOpen,
    createMenuOpen,
    setCreateMenuOpen,
    bots: fixtureBots,
    initialBotsLoaded: true,
    createBot: async () => undefined,
    navigate,
    setPanel: () => undefined,
    setNewSpaceOpen,
    canCreateSpace: true,
    setPickerInfoTopic,
    sidebarScrollRef,
    collapsedSidebarSections: new Set<string>(),
    toggleSidebarSection: () => undefined,
    inboxMode: false,
    unseen: {},
    inboxUnread: 0,
    financeMode: false,
    glance: {
      hasTickets: false,
      devinConnected,
      devinNeedsYou,
      gtmNeedsYou,
      legalDueSoon: 0,
      dataRoomWaiting: 0,
      botKinds: {},
    },
    legalMode: false,
    gtmMode,
    devinMode,
    investorsMode,
    fundraisingMode,
    contactsMode: false,
    dataRoomMode: false,
    artifactsMode: false,
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
    moveSidebarItem: async () => undefined,
    botMenuAnchor,
    setBotMenu,
    agentAppFor: () => undefined,
    activeSnapshot: null,
    botMenu,
    archivedBots: [],
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
    openSettings: () => undefined,
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
  render: () => <SidebarFixture mode="expanded" devinMode devinConnected devinNeedsYou={2} />,
};

export const Fundraising: Story = {
  render: () => <SidebarFixture mode="expanded" fundraisingMode />,
};
