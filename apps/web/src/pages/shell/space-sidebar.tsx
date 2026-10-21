import { plural } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import type { Bot, Group, Me, SearchHit, ThreadSnapshot } from "@rakazo/contracts";
import { NOTIFICATION_KINDS } from "@rakazo/contracts";
import { nestRosterByParent, sidebarSections } from "@rakazo/core";
import {
  BotAvatar,
  Button,
  GroupAvatar,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
} from "@rakazo/ui-web";
import {
  BookUser,
  ChartColumn,
  ChevronDown,
  CircleAlert,
  Compass,
  Files,
  FolderOpen,
  History,
  Lock,
  LogOut,
  Mail,
  MoreHorizontal,
  PanelLeftClose,
  PieChart,
  Scale,
  Search,
  Settings,
  SquareKanban,
  X,
} from "lucide-react";
import type {
  Dispatch,
  DragEvent,
  KeyboardEventHandler,
  ReactNode,
  RefObject,
  SetStateAction,
} from "react";
import type { NavigateFunction } from "react-router-dom";
import { ConnectAppsButton } from "../../components/ConnectAppsButton";
import { HideAmountsMenuItem } from "../../components/HideAmountsToggle";
import { AgentAvatar } from "../../components/integrations/AgentAvatar";
import { RailTip, SidebarPageLink } from "../../components/SidebarPageLink";
import { SidebarPages } from "../../components/SidebarPages";
import { SidebarPagesGroup } from "../../components/SidebarPagesGroup";
import type { DropResult, SidebarLayout } from "../../components/sidebar-folders/drop-target";
import { itemDragId } from "../../components/sidebar-folders/drop-target";
import { FolderHeader } from "../../components/sidebar-folders/FolderHeader";
import {
  RootEnd,
  SidebarDnd,
  SortableList,
  SortableRow,
} from "../../components/sidebar-folders/SidebarDnd";
import { glanceBadge, runwayGlance, StatusMark } from "../../components/sidebar-glance";
import { FirstRunTour } from "../../components/tour/FirstRunTour";
import type { AgentApp } from "../../lib/agent-app";
import { clearAgentAppCache } from "../../lib/agent-app";
import { authClient } from "../../lib/auth";
import { maskCurrencyWhenHidden } from "../../lib/hide-amounts-preference";
import { isUnclaimedFileDrag } from "../../lib/pending-attachments";
import type { Panel } from "../../lib/right-panel-state";
import {
  compactRosterStatusLabel,
  rosterHasUndismissedRunError,
  rosterWorkStatusLabel,
} from "../../lib/roster-status";
import { formatRosterTime } from "../../lib/roster-time";
import { clearSpaceSelection, rpc } from "../../lib/rpc";
import { sidebarInert } from "../../lib/shell-layout";
import { ActivityList } from "../ActivityList";
import type { ContextMenuPosition } from "../BotContextMenu";
import type { SettingsSection } from "../SettingsOverlay";
import type { SearchLink } from "../SpaceSearch";
import { SpaceSearchResults } from "../SpaceSearch";
import { BotCreatePicker } from "./bot-picker";
import { SidebarHeaderRow } from "./sidebar-header-row";

type SidebarChat = {
  id: string;
  name: string;
  title?: string | null;
  preview?: string | null;
  pinned: boolean;
  sectionId: string | null;
  position?: number | null;
  parentBotId?: string | null;
};

type SidebarSpace<TBot extends SidebarChat, TGroup extends SidebarChat> = {
  id: string;
  name: string;
  canRename?: boolean;
  canDelete?: boolean;
  bots: readonly TBot[];
  groups: readonly TGroup[];
  botSections: readonly { id: string; name: string; collapsed?: boolean }[];
};

function spaceHeaderMenu(space: { canRename?: boolean; canDelete?: boolean }, hostsMenu: boolean) {
  return {
    canRenameSpace: hostsMenu && space.canRename === true,
    canDeleteSpace: hostsMenu && space.canDelete === true,
  };
}

export async function commitSpaceRename(input: {
  rename: () => Promise<void>;
  apply: () => void;
  refresh: () => Promise<void>;
}): Promise<void> {
  await input.rename();
  input.apply();
  await input.refresh().catch(() => undefined);
}

/**
 * The space the app is showing comes first, so the chats at the top of the sidebar belong to the
 * company on screen (Finance switches spaces too); the others keep their order below it.
 */
export function activeSpaceFirst<T extends { id: string }>(
  spaces: readonly T[],
  activeId: string | null | undefined,
): T[] {
  const active = spaces.filter((space) => space.id === activeId);
  return [...active, ...spaces.filter((space) => space.id !== activeId)];
}

/** The id of another space that holds this bot or group, so a link pasted from there can switch to it. */
export function spaceHoldingChat(
  spaces: readonly {
    id: string;
    bots: readonly { id: string }[];
    groups: readonly { id: string }[];
  }[],
  currentSpaceId: string,
  chatId: string,
): string | null {
  const holder = spaces.find(
    (space) =>
      space.id !== currentSpaceId &&
      (space.bots.some((bot) => bot.id === chatId) ||
        space.groups.some((group) => group.id === chatId)),
  );
  return holder?.id ?? null;
}

/** What a block of the list is: the whole space, its heading alone, pinned, a folder or the rest. */
export type SidebarBlockKind = "space" | "head" | "pinned" | "folder" | "root";

export function sidebarGroupsForSpaces<TBot extends SidebarChat, TGroup extends SidebarChat>(
  spaces: readonly SidebarSpace<TBot, TGroup>[],
  query: string,
  /** The space the app is showing; its headers are marked when several spaces are listed. */
  currentSpaceId?: string,
  /** Header label for the only space, which needs no name to tell it from others. */
  soleSpaceTitle?: string,
) {
  const needle = query.toLowerCase();
  const showSpaceNames = spaces.length > 1;
  return spaces.flatMap((space) => {
    const spaceLabel = showSpaceNames ? space.name : (soleSpaceTitle ?? space.name);
    const visibleBots = space.bots.filter((bot) =>
      `${bot.name} ${bot.title ?? ""} ${bot.preview ?? ""}`.toLowerCase().includes(needle),
    );
    const visibleGroups = space.groups.filter((group) =>
      `${group.name} ${group.preview ?? ""}`.toLowerCase().includes(needle),
    );
    // Bots then groups, as the lists load.
    const placed = [
      ...visibleBots.map((chat) => ({ kind: "bot" as const, chat })),
      ...visibleGroups.map((chat) => ({ kind: "group" as const, chat })),
    ].map((item) => ({
      ...item,
      id: item.chat.id,
      parentBotId: item.kind === "bot" ? (item.chat.parentBotId ?? null) : null,
      pinned: item.chat.pinned,
      position: item.chat.position,
      sectionId: item.chat.sectionId,
    }));
    const { pinned, root, ...rest } = sidebarSections(placed, space.botSections);
    const folders = rest.folders
      .map(({ section, items }) => ({ section, bots: items }))
      // A search shows only the folders it found something in.
      .filter(({ bots }) => !needle || bots.length > 0);
    const key = (base: string) => (showSpaceNames ? `space:${space.id}:${base}` : base);
    const shared = {
      relabeled: false,
      showLock: false,
      emptySpaceId: undefined as string | undefined,
      current: false,
      spaceId: space.id,
      spaceName: space.name,
      canRenameSpace: false,
      canDeleteSpace: false,
      sectionId: null as string | null,
      collapsed: false,
      parentKey: null as string | null,
    };
    // The heading carries the space's name, lock, current marker and actions menu.
    const heading = (index: number) => ({
      ...shared,
      title: spaceLabel as string | null,
      relabeled: !showSpaceNames && soleSpaceTitle !== undefined && soleSpaceTitle !== space.name,
      showLock: showSpaceNames,
      current: showSpaceNames && space.id === currentSpaceId,
      ...spaceHeaderMenu(space, index === 0),
    });
    const sections = [];
    if (pinned.length === 0 && folders.length === 0) {
      if (root.length > 0) {
        sections.push({
          ...heading(0),
          kind: "space" as SidebarBlockKind,
          key: key("unassigned"),
          bots: root,
        });
      }
    } else {
      const headKey = key("unassigned");
      const child = { ...shared, parentKey: headKey };
      sections.push({
        ...heading(0),
        kind: "head" as SidebarBlockKind,
        key: headKey,
        bots: [] as typeof root,
      });
      if (pinned.length > 0) {
        sections.push({
          ...child,
          kind: "pinned" as SidebarBlockKind,
          key: key("pinned"),
          title: "Pinned" as string | null,
          bots: pinned,
        });
      }
      for (const { section, bots } of folders) {
        sections.push({
          ...child,
          kind: "folder" as SidebarBlockKind,
          key: key(`section:${section.id}`),
          title: section.name as string | null,
          sectionId: section.id,
          collapsed: section.collapsed === true,
          bots,
        });
      }
      sections.push({
        ...child,
        kind: "root" as SidebarBlockKind,
        key: key("root"),
        title: null as string | null,
        bots: root,
      });
    }
    if (sections.length > 0) return sections;
    // Keep empty spaces selectable; chat clicks are the only switch control.
    if (needle && (space.bots.length > 0 || space.groups.length > 0)) return [];
    if (!showSpaceNames && space.canRename !== true && space.canDelete !== true) return [];
    return [
      {
        ...shared,
        ...spaceHeaderMenu(space, true),
        kind: "space" as SidebarBlockKind,
        key: showSpaceNames ? `space:${space.id}:empty` : `space:${space.id}:actions`,
        title: (showSpaceNames ? space.name : null) as string | null,
        bots: [] as typeof root,
        showLock: showSpaceNames,
        emptySpaceId: showSpaceNames ? space.id : undefined,
        current: showSpaceNames && space.id === currentSpaceId,
      },
    ];
  });
}

type SearchPage = {
  id: string;
  label: string;
  icon: ReactNode;
  keywords?: string;
};

const maskOptional = (text: string | null) => (text ? maskCurrencyWhenHidden(text) : null);

type SidebarBotChat = SidebarChat &
  Pick<Bot, "spaceId" | "color" | "unread" | "status" | "runPhase" | "runErrorId" | "updatedAt"> & {
    preview: string;
  };
type SidebarGroupChat = SidebarChat &
  Pick<Group, "spaceId" | "members" | "unread" | "updatedAt"> & {
    preview: string;
  };
type SidebarGroup = ReturnType<
  typeof sidebarGroupsForSpaces<SidebarBotChat, SidebarGroupChat>
>[number];

export type SpaceSidebarProps = {
  sidebarRef: RefObject<HTMLElement | null>;
  botsSidebarDensity: string;
  botsSidebarCollapsed: boolean;
  rail: boolean;
  sidebarDocked: boolean;
  mobileSidebarOpen: boolean;
  focusSearchOnExpand: RefObject<boolean>;
  setBotsSidebarCollapsedPref: (collapsed: boolean) => void;
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
  activityMode: boolean;
  toggleActivityMode: () => void;
  setMobileSidebarOpen: Dispatch<SetStateAction<boolean>>;
  createMenuOpen: boolean;
  setCreateMenuOpen: Dispatch<SetStateAction<boolean>>;
  bots: Bot[];
  createBot: () => Promise<void>;
  navigate: NavigateFunction;
  setPanel: (next: Panel | ((current: Panel) => Panel)) => void;
  setNewSpaceOpen: Dispatch<SetStateAction<boolean>>;
  setPickerInfoTopic: Dispatch<SetStateAction<"group" | "space" | null>>;
  sidebarScrollRef: RefObject<HTMLDivElement | null>;
  showSpaceSearch: boolean;
  collapsedSidebarSections: ReadonlySet<string>;
  toggleSidebarSection: (key: string) => void;
  inboxMode: boolean;
  unseen: Record<string, number>;
  inboxUnread: number;
  financeMode: boolean;
  glance: {
    financeRunwayMonths: number | null;
    legalDueSoon: number;
    dataRoomWaiting: number;
    botKinds: Record<string, (typeof NOTIFICATION_KINDS)[number]>;
  };
  hideAmounts: boolean;
  legalMode: boolean;
  capTableMode: boolean;
  contactsMode: boolean;
  dataRoomMode: boolean;
  artifactsMode: boolean;
  spaceQuery: string;
  searchHits: SearchHit[];
  searchLoading: boolean;
  searchPages: SearchPage[];
  searchDocuments: SearchLink[];
  searchArtifacts: SearchLink[];
  openSearchResult: (path: string) => void;
  jumpToSearchHit: (hit: SearchHit) => Promise<void>;
  openAppPage: (id: string) => void;
  sidebarLayout: SidebarLayout;
  sidebarDragLabel: (dragId: string) => string;
  dropSidebarItem: (result: DropResult) => void;
  sidebarDragOverlay: (dragId: string) => ReactNode;
  sidebarGroups: SidebarGroup[];
  botSections: readonly { name: string }[];
  bootstrapMe: Me | null | undefined;
  setBootstrapMe: Dispatch<SetStateAction<Me | null | undefined>>;
  tourOpen: boolean;
  onTourAsk: () => void;
  setTourRestart: Dispatch<SetStateAction<boolean>>;
  hiddenPages: string[];
  addedPages: { key: string; label: string }[];
  toggleHiddenPage: (key: string) => Promise<void>;
  setAddedPages: Dispatch<SetStateAction<{ key: string; label: string }[]>>;
  collapsedRosterParents: ReadonlySet<string>;
  editingFolderId: string | null;
  toggleFolder: (sectionId: string, collapsed: boolean) => Promise<void>;
  setEditingFolderId: Dispatch<SetStateAction<string | null>>;
  renameFolder: (sectionId: string, name: string) => Promise<void>;
  deleteFolder: (sectionId: string) => Promise<void>;
  openSpaceChat: (spaceId: string, path: string) => void;
  spaceMenuAnchor: RefObject<HTMLElement | null>;
  setSpaceMenu: Dispatch<SetStateAction<{ id: string; position: ContextMenuPosition } | null>>;
  inGroup: boolean;
  pageMode: boolean;
  active: Bot | undefined;
  activeGroup: Group | undefined;
  dismissedRunErrorIds: ReadonlySet<string>;
  displayedRunError: string | null;
  toggleRosterParent: (botId: string) => void;
  fileDropBotId: string | null;
  rowFileDrag: (event: DragEvent<HTMLElement>, bot: { id: string; spaceId?: string }) => boolean;
  setFileDropBotId: Dispatch<SetStateAction<string | null>>;
  keepNoticeFor: RefObject<string | null>;
  onAttachmentPick: (files: ArrayLike<File> | null, targetThreadKey?: string) => boolean;
  setFocusComposerBotId: Dispatch<SetStateAction<string | null>>;
  openBot: (id: string) => void | Promise<void>;
  moveSidebarItem: (
    item: { kind: "bot" | "group"; id: string },
    folderId: string | null,
    beforeItem: { kind: "bot" | "group"; id: string } | null,
  ) => Promise<void>;
  botMenuAnchor: RefObject<HTMLElement | null>;
  setBotMenu: Dispatch<
    SetStateAction<{
      kind: "bot" | "group";
      id: string;
      position: ContextMenuPosition;
    } | null>
  >;
  agentAppFor: (botId: string, spaceId: string) => AgentApp | undefined;
  activeSnapshot: ThreadSnapshot | null;
  botMenu: { kind: "bot" | "group"; id: string; position: ContextMenuPosition } | null;
  archivedBots: Bot[];
  archivedGroups: Group[];
  archivedOpen: boolean;
  setArchivedOpen: Dispatch<SetStateAction<boolean>>;
  refreshBots: (includeArchived?: boolean, replaceBotOrder?: boolean) => Promise<void>;
  setDeleteTarget: Dispatch<SetStateAction<Bot | null>>;
  setDeleteGroupTarget: Dispatch<SetStateAction<Group | null>>;
  integrationsMode: boolean;
  menuOpen: boolean;
  setMenuOpen: Dispatch<SetStateAction<boolean>>;
  userName: string;
  initials: string;
  openSettings: (section?: SettingsSection, modelProvider?: string) => void;
};

export function SpaceSidebar({
  sidebarRef,
  botsSidebarDensity,
  botsSidebarCollapsed,
  rail,
  sidebarDocked,
  mobileSidebarOpen,
  focusSearchOnExpand,
  setBotsSidebarCollapsedPref,
  query,
  setQuery,
  activityMode,
  toggleActivityMode,
  setMobileSidebarOpen,
  createMenuOpen,
  setCreateMenuOpen,
  bots,
  createBot,
  navigate,
  setPanel,
  setNewSpaceOpen,
  setPickerInfoTopic,
  sidebarScrollRef,
  showSpaceSearch,
  collapsedSidebarSections,
  toggleSidebarSection,
  inboxMode,
  unseen,
  inboxUnread,
  financeMode,
  glance,
  hideAmounts,
  legalMode,
  capTableMode,
  contactsMode,
  dataRoomMode,
  artifactsMode,
  spaceQuery,
  searchHits,
  searchLoading,
  searchPages,
  searchDocuments,
  searchArtifacts,
  openSearchResult,
  jumpToSearchHit,
  openAppPage,
  sidebarLayout,
  sidebarDragLabel,
  dropSidebarItem,
  sidebarDragOverlay,
  sidebarGroups,
  botSections,
  bootstrapMe,
  setBootstrapMe,
  tourOpen,
  onTourAsk,
  setTourRestart,
  hiddenPages,
  addedPages,
  toggleHiddenPage,
  setAddedPages,
  collapsedRosterParents,
  editingFolderId,
  toggleFolder,
  setEditingFolderId,
  renameFolder,
  deleteFolder,
  openSpaceChat,
  spaceMenuAnchor,
  setSpaceMenu,
  inGroup,
  pageMode,
  active,
  activeGroup,
  dismissedRunErrorIds,
  displayedRunError,
  toggleRosterParent,
  fileDropBotId,
  rowFileDrag,
  setFileDropBotId,
  keepNoticeFor,
  onAttachmentPick,
  setFocusComposerBotId,
  openBot,
  moveSidebarItem,
  botMenuAnchor,
  setBotMenu,
  agentAppFor,
  activeSnapshot,
  botMenu,
  archivedBots,
  archivedGroups,
  archivedOpen,
  setArchivedOpen,
  refreshBots,
  setDeleteTarget,
  setDeleteGroupTarget,
  integrationsMode,
  menuOpen,
  setMenuOpen,
  userName,
  initials,
  openSettings,
}: SpaceSidebarProps) {
  const { t } = useLingui();
  return (
    <aside
      ref={sidebarRef}
      data-testid="bots-sidebar"
      data-bots-sidebar-density={botsSidebarDensity}
      data-collapsed={botsSidebarCollapsed ? "true" : "false"}
      data-rail={rail ? "true" : "false"}
      inert={sidebarInert(sidebarDocked, mobileSidebarOpen) ? true : undefined}
      className={`absolute inset-y-0 start-0 z-40 flex w-[calc(100%-48px)] max-w-[316px] shrink-0 flex-col border-e border-sidebar-border bg-sidebar transition-[transform,width,opacity] lg:static lg:z-auto lg:translate-x-0 ${
        mobileSidebarOpen ? "translate-x-0" : "-translate-x-full rtl:translate-x-full"
      } ${botsSidebarCollapsed ? "lg:w-14 lg:max-w-14" : "lg:w-[316px]"}`}
    >
      <SidebarHeaderRow
        rail={rail}
        search={
          rail ? (
            <RailTip rail label={t`Search`}>
              <button
                type="button"
                aria-label={t`Search`}
                data-testid="sidebar-search-rail"
                onClick={() => {
                  focusSearchOnExpand.current = true;
                  setBotsSidebarCollapsedPref(false);
                }}
                className="app-no-drag mx-auto grid size-9 place-items-center rounded-xl text-muted-foreground hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
              >
                <Search size={16} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </RailTip>
          ) : (
            <InputGroup
              data-testid="sidebar-search"
              data-tour="sidebar-search"
              className="app-no-drag w-auto min-w-0 flex-1 rounded-xl bg-card dark:bg-input border border-border text-muted-foreground focus-within:border-ring"
            >
              <InputGroupAddon>
                <Search size={16} strokeWidth={1.8} aria-hidden="true" />
              </InputGroupAddon>
              <InputGroupInput
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape" && query) {
                    e.preventDefault();
                    setQuery("");
                  }
                }}
                // Chats, documents and mail, so the box says only "Search".
                placeholder={t`Search`}
                autoComplete="off"
                name="sidebar-search"
              />
              {query ? (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    aria-label={t`Clear search`}
                    onClick={() => setQuery("")}
                  >
                    <X aria-hidden="true" />
                  </InputGroupButton>
                </InputGroupAddon>
              ) : null}
            </InputGroup>
          )
        }
        actions={
          rail ? null : (
            <div className="relative flex shrink-0 items-center gap-1">
              <button
                type="button"
                aria-label={t`Activity`}
                aria-pressed={activityMode}
                title={t`Activity`}
                data-activity-mode={activityMode ? "on" : "off"}
                onClick={toggleActivityMode}
                className={`app-no-drag flex h-8 w-8 items-center justify-center rounded-full ${
                  activityMode
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground/70 hover:text-foreground/75"
                }`}
              >
                {/* A history clock, not a bell: this lists recent bot runs, not notifications. */}
                <History size={15} strokeWidth={1.8} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="app-no-drag hidden h-8 w-8 items-center justify-center rounded-full text-muted-foreground/70 hover:text-foreground/75 lg:inline-flex"
                aria-label={t`Hide sidebar`}
                title={t`Hide sidebar`}
                data-testid="minimize-bots-sidebar"
                onClick={() => setBotsSidebarCollapsedPref(true)}
              >
                <PanelLeftClose size={15} strokeWidth={1.8} aria-hidden="true" />
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="app-no-drag lg:hidden"
                aria-label={t`Close menu`}
                title={t`Close menu`}
                data-testid="close-mobile-sidebar"
                onClick={() => setMobileSidebarOpen(false)}
              >
                <X size={16} strokeWidth={1.8} aria-hidden="true" />
              </Button>
              <Popover open={createMenuOpen} onOpenChange={setCreateMenuOpen}>
                <PopoverTrigger
                  className="app-no-drag flex h-8 w-8 items-center justify-center text-[21px] text-muted-foreground/70 hover:text-foreground/75"
                  title={t`Create`}
                  aria-label={t`Create`}
                  data-testid="create-menu-trigger"
                  data-tour="create-menu"
                >
                  +
                </PopoverTrigger>
                {/* Unmount with the state change so the panel it opens never coexists with the menu. */}
                {createMenuOpen ? (
                  <PopoverContent
                    align="end"
                    className="app-no-drag w-auto gap-0 overflow-hidden p-0 data-closed:animate-none"
                  >
                    <BotCreatePicker
                      bots={bots}
                      onCreateBot={() => {
                        setCreateMenuOpen(false);
                        setMobileSidebarOpen(false);
                        void createBot();
                      }}
                      onOpenBot={(id) => {
                        setCreateMenuOpen(false);
                        setMobileSidebarOpen(false);
                        navigate(`/app/${id}`);
                      }}
                      onCreateGroup={() => {
                        setCreateMenuOpen(false);
                        setMobileSidebarOpen(false);
                        setPanel("create-group");
                      }}
                      onCreateSpace={() => {
                        setCreateMenuOpen(false);
                        setMobileSidebarOpen(false);
                        setNewSpaceOpen(true);
                      }}
                      onShowGroupInfo={() => {
                        setCreateMenuOpen(false);
                        setMobileSidebarOpen(false);
                        setPickerInfoTopic("group");
                      }}
                      onShowSpaceInfo={() => {
                        setCreateMenuOpen(false);
                        setMobileSidebarOpen(false);
                        setPickerInfoTopic("space");
                      }}
                    />
                  </PopoverContent>
                ) : null}
              </Popover>
            </div>
          )
        }
      />
      {/* While searching, matching pages are listed with the results instead. */}
      {(showSpaceSearch && !rail) || bootstrapMe === undefined ? null : (
        // Waiting for the account (undefined) keeps pages the user hid from flashing in.
        // Outside the chat scroll area so it stays put; on a short screen it scrolls on its own.
        <div className="flex max-h-[40vh] shrink-0 flex-col overflow-y-auto px-2.5">
          <SidebarPagesGroup
            title={t`Pages`}
            collapsed={collapsedSidebarSections.has("pages")}
            rail={rail}
            onToggle={() => toggleSidebarSection("pages")}
            pages={[
              { key: "inbox", label: t`Inbox` },
              { key: "finance", label: t`Finance` },
              { key: "legal", label: t`Legal` },
              { key: "cap-table", label: t`Cap table` },
              { key: "contacts", label: t`Contacts` },
              { key: "data-room", label: t`Data room` },
              { key: "artifacts", label: t`Artifacts` },
              ...addedPages,
            ]}
            hidden={hiddenPages}
            onToggleHidden={toggleHiddenPage}
          >
            {hiddenPages.includes("inbox") ? null : (
              <SidebarPageLink
                testId="sidebar-inbox"
                current={inboxMode}
                icon={<Mail size={15} strokeWidth={1.8} aria-hidden="true" />}
                label={t`Inbox`}
                rail={rail}
                onOpen={() => {
                  setMobileSidebarOpen(false);
                  navigate("/app/inbox");
                }}
                {...glanceBadge({
                  unseen: unseen.inbox ?? 0,
                  value: inboxUnread > 0 ? String(inboxUnread) : undefined,
                  valueLabel: plural(inboxUnread, { one: "# unread", other: "# unread" }),
                  rail,
                })}
              />
            )}
            {hiddenPages.includes("finance") ? null : (
              <SidebarPageLink
                testId="sidebar-finance"
                current={financeMode}
                icon={<ChartColumn size={15} strokeWidth={1.8} aria-hidden="true" />}
                label={t`Finance`}
                rail={rail}
                onOpen={() => {
                  setMobileSidebarOpen(false);
                  navigate("/app/finance");
                }}
                {...glanceBadge({
                  unseen: unseen.finance ?? 0,
                  rail,
                  value: runwayGlance(glance.financeRunwayMonths, hideAmounts),
                  valueLabel: t`${runwayGlance(glance.financeRunwayMonths, hideAmounts)} runway`,
                })}
              />
            )}
            {hiddenPages.includes("legal") ? null : (
              <SidebarPageLink
                testId="sidebar-legal"
                current={legalMode}
                icon={<Scale size={15} strokeWidth={1.8} aria-hidden="true" />}
                label={t`Legal`}
                rail={rail}
                onOpen={() => {
                  setMobileSidebarOpen(false);
                  navigate("/app/legal");
                }}
                {...glanceBadge({
                  unseen: unseen.legal ?? 0,
                  rail,
                  value: glance.legalDueSoon > 0 ? String(glance.legalDueSoon) : undefined,
                  valueLabel: plural(glance.legalDueSoon, {
                    one: "# due soon",
                    other: "# due soon",
                  }),
                })}
              />
            )}
            {hiddenPages.includes("cap-table") ? null : (
              <SidebarPageLink
                testId="sidebar-cap-table"
                current={capTableMode}
                icon={<PieChart size={15} strokeWidth={1.8} aria-hidden="true" />}
                label={t`Cap table`}
                rail={rail}
                onOpen={() => {
                  setMobileSidebarOpen(false);
                  navigate("/app/cap-table");
                }}
                {...glanceBadge({ unseen: unseen["cap-table"] ?? 0, rail })}
              />
            )}
            {hiddenPages.includes("contacts") ? null : (
              <SidebarPageLink
                testId="sidebar-contacts"
                current={contactsMode}
                icon={<BookUser size={15} strokeWidth={1.8} aria-hidden="true" />}
                label={t`Contacts`}
                rail={rail}
                onOpen={() => {
                  setMobileSidebarOpen(false);
                  navigate("/app/contacts");
                }}
              />
            )}
            {hiddenPages.includes("data-room") ? null : (
              <SidebarPageLink
                testId="sidebar-data-room"
                current={dataRoomMode}
                icon={<FolderOpen size={15} strokeWidth={1.8} aria-hidden="true" />}
                label={t`Data room`}
                rail={rail}
                onOpen={() => {
                  setMobileSidebarOpen(false);
                  navigate("/app/data-room");
                }}
                {...glanceBadge({
                  unseen: unseen["data-room"] ?? 0,
                  rail,
                  value: glance.dataRoomWaiting > 0 ? String(glance.dataRoomWaiting) : undefined,
                  valueLabel: plural(glance.dataRoomWaiting, {
                    one: "# waiting",
                    other: "# waiting",
                  }),
                })}
              />
            )}
            {hiddenPages.includes("artifacts") ? null : (
              <SidebarPageLink
                testId="sidebar-artifacts"
                current={artifactsMode}
                // Not the Data room's folder icon: these are files bots made.
                icon={<Files size={15} strokeWidth={1.8} aria-hidden="true" />}
                label={t`Artifacts`}
                rail={rail}
                onOpen={() => {
                  setMobileSidebarOpen(false);
                  navigate("/app/artifacts");
                }}
                {...glanceBadge({ unseen: unseen.artifacts ?? 0, rail })}
              />
            )}
            <SidebarPages
              rail={rail}
              hidden={hiddenPages}
              onListed={setAddedPages}
              onOpen={() => setMobileSidebarOpen(false)}
            />
          </SidebarPagesGroup>
        </div>
      )}
      <div
        ref={sidebarScrollRef}
        className="rk-scroll rk-scroll-fade-bottom flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2.5 pb-2.5"
      >
        {showSpaceSearch && !rail ? (
          <SpaceSearchResults
            query={spaceQuery}
            hits={searchHits}
            loading={searchLoading}
            pages={searchPages}
            documents={searchDocuments}
            artifacts={searchArtifacts}
            onSelectArtifact={(id) => openSearchResult(`/app/artifacts/${encodeURIComponent(id)}`)}
            onSelect={(hit) => void jumpToSearchHit(hit)}
            onSelectPage={openAppPage}
            onSelectDocument={(id) =>
              openSearchResult(`/app/data-room?item=${encodeURIComponent(id)}`)
            }
            // A page name is a navigation query, so the mail row would only be a second answer.
            onSearchMail={
              searchPages.length
                ? undefined
                : () => openSearchResult(`/app/inbox?q=${encodeURIComponent(spaceQuery)}`)
            }
          />
        ) : (
          <>
            {activityMode && !rail ? (
              <ActivityList
                onOpenRun={(run) => {
                  setMobileSidebarOpen(false);
                  if (run.groupId) navigate(`/app/g/${run.groupId}`);
                  else navigate(`/app/${run.botId}`);
                }}
              />
            ) : null}
            <SidebarDnd
              layout={sidebarLayout}
              labelFor={sidebarDragLabel}
              onDrop={dropSidebarItem}
              overlay={sidebarDragOverlay}
            >
              {sidebarGroups.map((group) => {
                const activeSpace = group.spaceId === bootstrapMe?.spaceId;
                const folder = group.kind === "folder" && group.sectionId ? group.sectionId : null;
                // Closing the heading hides everything under it.
                if (!rail && group.parentKey && collapsedSidebarSections.has(group.parentKey)) {
                  return null;
                }
                const collapsed = folder
                  ? activeSpace
                    ? group.collapsed
                    : collapsedSidebarSections.has(group.key)
                  : Boolean(group.title) && collapsedSidebarSections.has(group.key);
                // The most urgent status in a folder, so a closed folder hides nothing.
                const folderStatus = folder
                  ? NOTIFICATION_KINDS.find((kind) =>
                      group.bots.some(
                        (item) => item.kind === "bot" && glance.botKinds[item.chat.id] === kind,
                      ),
                    )
                  : undefined;
                const dragEnabled =
                  activeSpace && !rail && !showSpaceSearch && group.kind !== "pinned";
                const nestedRows = nestRosterByParent(group.bots, collapsedRosterParents);
                const treeActive = nestedRows.some((row) => row.depth > 0 || row.hasChildren);
                // Reorder among visible siblings so keyboard and drag moves match the tree.
                const siblingBotIds = (parentId: string | null) =>
                  nestedRows.flatMap((row) =>
                    row.item.kind === "bot" && row.parentId === parentId ? [row.item.chat.id] : [],
                  );
                // The heading's menu: space rename and delete where allowed, and the folder actions.
                const hasSpaceActions =
                  group.canRenameSpace ||
                  group.canDeleteSpace ||
                  (activeSpace && Boolean(group.title) && ["head", "space"].includes(group.kind));
                // "Personal" replaces the lone space's name, so the name stays in the label.
                const sidebarHeader = {
                  name: group.relabeled ? `${group.title} (${group.spaceName})` : group.title,
                };
                return (
                  <div key={group.key} data-sidebar-group={group.key}>
                    {rail ? (
                      <div
                        className={
                          group.title && group.kind !== "head"
                            ? "mx-2 mt-2 mb-1 border-t border-border"
                            : undefined
                        }
                      />
                    ) : null}
                    {!rail && folder ? (
                      <FolderHeader
                        id={folder}
                        name={group.title ?? ""}
                        count={group.bots.length}
                        collapsed={collapsed}
                        status={folderStatus}
                        unread={group.bots.some((item) => item.chat.unread)}
                        editing={editingFolderId === folder}
                        readOnly={!activeSpace || showSpaceSearch}
                        onToggle={() =>
                          activeSpace
                            ? void toggleFolder(folder, !collapsed)
                            : toggleSidebarSection(group.key)
                        }
                        onStartRename={() => setEditingFolderId(folder)}
                        onRename={(name) => void renameFolder(folder, name)}
                        onCancelRename={() => setEditingFolderId(null)}
                        onDelete={() => void deleteFolder(folder)}
                        takenNames={botSections.map((section) => section.name)}
                      />
                    ) : null}
                    {!rail && !folder && (group.title || hasSpaceActions) ? (
                      <div
                        className={
                          group.title && hasSpaceActions
                            ? "grid pt-3 pb-0.5"
                            : `flex items-center pt-3 pb-0.5${group.title ? "" : " justify-end"}`
                        }
                      >
                        {group.title ? (
                          <button
                            type="button"
                            aria-current={group.current ? "true" : undefined}
                            data-sidebar-current={group.current ? "" : undefined}
                            title={group.relabeled ? group.spaceName : undefined}
                            className={`flex min-w-0 items-center justify-between gap-2 rounded-lg px-2.5 py-1 text-[11px] font-semibold tracking-wider uppercase ${group.current ? "text-foreground" : "text-muted-foreground/60"} hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring ${hasSpaceActions ? "col-start-1 row-start-1 w-full pe-8" : "flex-1"}`}
                            onClick={() => {
                              if (group.emptySpaceId) {
                                openSpaceChat(group.emptySpaceId, "/onboarding");
                                return;
                              }
                              toggleSidebarSection(group.key);
                            }}
                            onContextMenu={
                              hasSpaceActions
                                ? (event) => {
                                    event.preventDefault();
                                    spaceMenuAnchor.current = event.currentTarget;
                                    setSpaceMenu({
                                      id: group.spaceId,
                                      position: { x: event.clientX, y: event.clientY },
                                    });
                                  }
                                : undefined
                            }
                            aria-expanded={group.emptySpaceId ? undefined : !collapsed}
                            aria-label={
                              group.emptySpaceId
                                ? t`Open ${group.title}`
                                : collapsed
                                  ? t`Expand ${sidebarHeader.name}`
                                  : t`Collapse ${sidebarHeader.name}`
                            }
                          >
                            <span className="flex min-w-0 items-center gap-1.5">
                              {group.current ? (
                                <span
                                  className="size-1.5 shrink-0 rounded-full bg-primary"
                                  aria-hidden="true"
                                />
                              ) : null}
                              {group.showLock ? (
                                <Lock size={11} strokeWidth={2} aria-hidden="true" />
                              ) : null}
                              {/* Long space names wrap to a second line instead of being cut off. */}
                              <span className="line-clamp-2 text-start break-words">
                                {group.title}
                              </span>
                            </span>
                            {group.emptySpaceId ? null : (
                              <ChevronDown
                                size={14}
                                strokeWidth={1.8}
                                className={
                                  collapsed
                                    ? "-rotate-90 transition-transform"
                                    : "transition-transform"
                                }
                                aria-hidden="true"
                              />
                            )}
                          </button>
                        ) : null}
                        {hasSpaceActions ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className={
                              group.title
                                ? "col-start-1 row-start-1 justify-self-end self-center"
                                : undefined
                            }
                            aria-label={t`Actions for ${group.spaceName}`}
                            onClick={(event) => {
                              const rect = event.currentTarget.getBoundingClientRect();
                              spaceMenuAnchor.current = event.currentTarget;
                              setSpaceMenu({
                                id: group.spaceId,
                                position: { x: rect.left, y: rect.bottom },
                              });
                            }}
                          >
                            <MoreHorizontal size={14} aria-hidden="true" />
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                    {!rail && group.kind === "root" && group.parentKey && group.bots.length > 0 ? (
                      <div className="mt-1 px-2.5 py-1.5 text-[13px] font-medium text-foreground/80">
                        <Trans>Chats</Trans>
                      </div>
                    ) : null}
                    {rail || !collapsed ? (
                      <SortableList
                        ids={nestedRows.map(({ item }) =>
                          itemDragId({ kind: item.kind, id: item.chat.id }),
                        )}
                      >
                        {nestedRows.map(({ item, depth, hasChildren, parentId }) => {
                          const parentCollapsed =
                            hasChildren && collapsedRosterParents.has(item.chat.id);
                          const selected =
                            (item.kind === "bot" &&
                              !inGroup &&
                              !pageMode &&
                              active?.id === item.chat.id) ||
                            (item.kind === "group" && inGroup && activeGroup?.id === item.chat.id);
                          const compact = botsSidebarDensity === "compact";
                          const workStatusLabel =
                            item.kind === "bot"
                              ? maskOptional(
                                  rosterWorkStatusLabel(item.chat.status, item.chat.runPhase),
                                )
                              : null;
                          const rowError =
                            item.kind === "bot" &&
                            (rosterHasUndismissedRunError(
                              item.chat.runErrorId,
                              dismissedRunErrorIds,
                            ) ||
                              (active?.id === item.chat.id && Boolean(displayedRunError)));
                          const compactStatusLabel =
                            compact && item.kind === "bot"
                              ? rowError
                                ? t`Error`
                                : maskOptional(
                                    compactRosterStatusLabel(item.chat.status, item.chat.runPhase),
                                  )
                              : null;
                          const rosterLine = compact
                            ? compactStatusLabel
                            : (workStatusLabel ??
                              (item.kind === "bot"
                                ? maskCurrencyWhenHidden(item.chat.preview) ||
                                  (item.chat.status !== "idle" ? item.chat.status : "")
                                : maskCurrencyWhenHidden(item.chat.preview) ||
                                  item.chat.members.map((member) => member.name).join(", ")));
                          const rowDragEnabled =
                            dragEnabled && item.chat.spaceId === bootstrapMe?.spaceId;
                          return (
                            <SortableRow
                              key={`${item.kind}:${item.chat.id}`}
                              id={itemDragId({ kind: item.kind, id: item.chat.id })}
                              disabled={!rowDragEnabled}
                            >
                              {(row) => (
                                <div
                                  ref={row.setNodeRef}
                                  data-drops-before={row.dropsBefore ? "" : undefined}
                                  data-tour={selected ? "sidebar-chat" : undefined}
                                  className={`group/row relative mb-1 data-drops-before:border-t-2 data-drops-before:border-ring ${
                                    !rail && (folder || group.kind === "pinned") ? "ms-3" : ""
                                  }`}
                                  style={{ ...row.style, opacity: row.isDragging ? 0.4 : 1 }}
                                >
                                  {hasChildren && !rail ? (
                                    <span
                                      className="absolute inset-y-0 z-10 flex w-3.5 items-center justify-center"
                                      style={{ insetInlineStart: `${10 + depth * 14}px` }}
                                    >
                                      <button
                                        type="button"
                                        aria-expanded={!parentCollapsed}
                                        aria-label={
                                          parentCollapsed
                                            ? t`Expand ${item.chat.name}`
                                            : t`Collapse ${item.chat.name}`
                                        }
                                        className="inline-flex size-3.5 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
                                        onClick={() => toggleRosterParent(item.chat.id)}
                                      >
                                        <ChevronDown
                                          size={12}
                                          strokeWidth={2}
                                          className={`transition-transform ${
                                            parentCollapsed ? "-rotate-90" : ""
                                          }`}
                                          aria-hidden="true"
                                        />
                                      </button>
                                    </span>
                                  ) : null}
                                  <RailTip rail={rail} label={item.chat.name}>
                                    <button
                                      type="button"
                                      aria-label={
                                        rail
                                          ? item.chat.unread
                                            ? `${item.chat.name}${t` (unread)`}`
                                            : item.chat.name
                                          : undefined
                                      }
                                      {...row.handleProps}
                                      data-roster-bot-id={
                                        item.kind === "bot" ? item.chat.id : undefined
                                      }
                                      data-roster-unread={item.chat.unread ? "true" : undefined}
                                      data-file-drop={
                                        fileDropBotId === item.chat.id ? "" : undefined
                                      }
                                      data-roster-error={rowError && compact ? "true" : undefined}
                                      data-roster-depth={
                                        item.kind === "bot" && treeActive ? depth : undefined
                                      }
                                      aria-current={selected ? "page" : undefined}
                                      aria-keyshortcuts={
                                        item.kind === "bot"
                                          ? "Alt+ArrowUp Alt+ArrowDown"
                                          : undefined
                                      }
                                      onDragEnter={(event) => {
                                        if (item.kind === "bot") rowFileDrag(event, item.chat);
                                      }}
                                      onDragOver={(event) => {
                                        if (item.kind === "bot") rowFileDrag(event, item.chat);
                                      }}
                                      onDragLeave={(event) => {
                                        if (
                                          !event.currentTarget.contains(
                                            event.relatedTarget as Node | null,
                                          )
                                        )
                                          setFileDropBotId(null);
                                      }}
                                      onDrop={(event) => {
                                        if (item.kind === "bot" && isUnclaimedFileDrag(event)) {
                                          event.preventDefault();
                                          setFileDropBotId(null);
                                          if (item.chat.spaceId !== bootstrapMe?.spaceId) return;
                                          // Keep the "Skipped ..." notice through the thread-change reset.
                                          if (item.chat.id !== active?.id)
                                            keepNoticeFor.current = item.chat.id;
                                          onAttachmentPick(event.dataTransfer.files, item.chat.id);
                                          setFocusComposerBotId(item.chat.id);
                                          setMobileSidebarOpen(false);
                                          openBot(item.chat.id);
                                          return;
                                        }
                                      }}
                                      onKeyDown={(event) => {
                                        if (
                                          item.kind !== "bot" ||
                                          !event.altKey ||
                                          (event.key !== "ArrowUp" && event.key !== "ArrowDown")
                                        ) {
                                          (
                                            row.handleProps.onKeyDown as
                                              | KeyboardEventHandler
                                              | undefined
                                          )?.(event);
                                          return;
                                        }
                                        const siblings = siblingBotIds(parentId);
                                        const index = siblings.indexOf(item.chat.id);
                                        const target =
                                          siblings[index + (event.key === "ArrowUp" ? -1 : 1)];
                                        if (!target) return;
                                        event.preventDefault();
                                        // Up goes before the neighbor; down goes before whatever follows it.
                                        const order = group.bots.map((entry) => entry.chat.id);
                                        const beforeId =
                                          event.key === "ArrowUp"
                                            ? target
                                            : (order[order.indexOf(target) + 1] ?? null);
                                        void moveSidebarItem(
                                          { kind: "bot", id: item.chat.id },
                                          folder,
                                          beforeId === null
                                            ? null
                                            : {
                                                kind: group.bots.find(
                                                  (entry) => entry.chat.id === beforeId,
                                                )!.kind,
                                                id: beforeId,
                                              },
                                        );
                                      }}
                                      onClick={() => {
                                        openSpaceChat(
                                          item.chat.spaceId,
                                          item.kind === "bot"
                                            ? `/app/${item.chat.id}`
                                            : `/app/g/${item.chat.id}`,
                                        );
                                      }}
                                      onContextMenu={(event) => {
                                        if (item.chat.spaceId !== bootstrapMe?.spaceId) return;
                                        event.preventDefault();
                                        botMenuAnchor.current = event.currentTarget;
                                        setBotMenu({
                                          kind: item.kind,
                                          id: item.chat.id,
                                          position: { x: event.clientX, y: event.clientY },
                                        });
                                      }}
                                      className={`relative flex w-full items-center ${
                                        rail
                                          ? "justify-center rounded-xl px-0 py-1"
                                          : compact
                                            ? "gap-2.5 rounded-xl px-2.5 py-1"
                                            : "gap-3 rounded-xl px-2.5 py-2"
                                      } focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring text-start ${
                                        rowDragEnabled ? "cursor-grab active:cursor-grabbing" : ""
                                      } ${
                                        selected
                                          ? "bg-sidebar-accent"
                                          : "group-hover/row:bg-sidebar-accent"
                                      } data-file-drop:ring-2 data-file-drop:ring-inset data-file-drop:ring-ring`}
                                      style={
                                        treeActive && !rail
                                          ? { paddingInlineStart: `${24 + depth * 14}px` }
                                          : undefined
                                      }
                                    >
                                      {item.kind === "bot" ? (
                                        <AgentAvatar
                                          app={agentAppFor(item.chat.id, item.chat.spaceId)}
                                          color={item.chat.color}
                                          identity={item.chat.id}
                                          size={36}
                                          status={item.chat.status}
                                        />
                                      ) : (
                                        <GroupAvatar
                                          members={
                                            item.chat.id === activeSnapshot?.groupId
                                              ? (activeSnapshot.members ?? item.chat.members)
                                              : item.chat.members
                                          }
                                          size={36}
                                        />
                                      )}
                                      {rail && item.chat.unread ? (
                                        <span
                                          data-testid="rail-badge"
                                          aria-hidden="true"
                                          className="absolute end-1 top-0.5 size-2.5 rounded-full border-2 border-sidebar bg-primary"
                                        />
                                      ) : null}
                                      {rail ? null : (
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-start justify-between gap-1.5">
                                            <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
                                              <span
                                                dir="auto"
                                                data-roster-bot-name={
                                                  item.kind === "bot" ? "" : undefined
                                                }
                                                title={item.chat.name}
                                                className={`min-w-0 line-clamp-2 break-words text-[14.5px] leading-[18px] font-normal text-foreground ${
                                                  item.chat.unread ? "font-medium" : ""
                                                }`}
                                              >
                                                {item.chat.name}
                                              </span>
                                              {item.chat.unread ? (
                                                <span className="sr-only">
                                                  <Trans> (unread)</Trans>
                                                </span>
                                              ) : null}
                                            </div>
                                            <div className="flex shrink-0 items-center gap-1.5 group-hover/row:pointer-fine:opacity-0">
                                              {item.kind === "bot" &&
                                              glance.botKinds[item.chat.id] ? (
                                                <StatusMark
                                                  kind={glance.botKinds[item.chat.id]!}
                                                  botId={item.chat.id}
                                                />
                                              ) : null}
                                              {!compact ? (
                                                <span className="text-[12px] leading-[18px] text-muted-foreground tabular-nums">
                                                  {formatRosterTime(item.chat.updatedAt)}
                                                </span>
                                              ) : null}
                                              {item.chat.unread ? (
                                                <span
                                                  aria-hidden="true"
                                                  className="inline-block h-2 w-2 rounded-full bg-foreground"
                                                />
                                              ) : null}
                                            </div>
                                          </div>
                                          {compact ? (
                                            compactStatusLabel ? (
                                              <div
                                                dir="auto"
                                                data-roster-status={
                                                  rowError
                                                    ? "error"
                                                    : item.kind === "bot"
                                                      ? item.chat.status
                                                      : undefined
                                                }
                                                className={`flex items-center gap-1 text-[12px] leading-[18px] ${
                                                  rowError
                                                    ? "font-medium text-destructive"
                                                    : workStatusLabel
                                                      ? "font-semibold text-status-working"
                                                      : "font-medium text-foreground/75"
                                                }`}
                                              >
                                                {rowError ? (
                                                  <CircleAlert size={12} aria-hidden="true" />
                                                ) : null}
                                                <span>{compactStatusLabel}</span>
                                              </div>
                                            ) : null
                                          ) : (
                                            <div
                                              dir="auto"
                                              data-roster-preview={
                                                !workStatusLabel ? "true" : undefined
                                              }
                                              className={`truncate text-[12px] leading-[18px] ${
                                                workStatusLabel
                                                  ? "font-semibold text-status-working"
                                                  : item.chat.unread
                                                    ? "font-medium text-foreground/75"
                                                    : "text-muted-foreground"
                                              }`}
                                            >
                                              {rosterLine}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </button>
                                  </RailTip>
                                  {/* The right-click menu, also reachable on hover or by keyboard. */}
                                  {!rail && item.chat.spaceId === bootstrapMe?.spaceId ? (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      data-testid="roster-row-actions"
                                      aria-label={t`Actions for ${item.chat.name}`}
                                      aria-haspopup="menu"
                                      onClick={(event) => {
                                        const rect = event.currentTarget.getBoundingClientRect();
                                        botMenuAnchor.current = event.currentTarget;
                                        setBotMenu({
                                          kind: item.kind,
                                          id: item.chat.id,
                                          position: { x: rect.left, y: rect.bottom },
                                        });
                                      }}
                                      className={`absolute end-2 top-1.5 size-7 rounded-lg text-muted-foreground opacity-0 hover:bg-background/60 hover:text-foreground focus-visible:opacity-100 group-hover/row:opacity-100 pointer-coarse:hidden ${
                                        botMenu?.id === item.chat.id ? "opacity-100" : ""
                                      }`}
                                    >
                                      <MoreHorizontal
                                        size={15}
                                        strokeWidth={1.7}
                                        aria-hidden="true"
                                      />
                                    </Button>
                                  ) : null}
                                </div>
                              )}
                            </SortableRow>
                          );
                        })}
                      </SortableList>
                    ) : null}
                  </div>
                );
              })}
              {rail || showSpaceSearch ? null : <RootEnd />}
            </SidebarDnd>
          </>
        )}
        {archivedBots.length + archivedGroups.length > 0 && !showSpaceSearch && !rail ? (
          <div className="mt-2 border-t border-border pt-2">
            <button
              type="button"
              aria-expanded={archivedOpen}
              onClick={() => setArchivedOpen((open) => !open)}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-[13.5px] text-muted-foreground hover:bg-sidebar-accent"
            >
              <span>
                <Trans>Archived</Trans>
              </span>
              <span>{archivedBots.length + archivedGroups.length}</span>
            </button>
            {archivedOpen ? (
              <>
                {archivedBots.map((bot) => (
                  <div key={bot.id} className="flex items-center gap-2 rounded-lg px-2.5 py-2">
                    <BotAvatar color={bot.color} identity={bot.id} size={28} status={bot.status} />
                    <span
                      className="min-w-0 flex-1 truncate text-[14px] text-foreground/75"
                      dir="auto"
                    >
                      {bot.name}
                    </span>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() =>
                        void rpc.bots.restore({ botId: bot.id }).then(() => refreshBots(true))
                      }
                    >
                      <Trans>Restore</Trans>
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      className="text-destructive hover:text-destructive"
                      aria-label={t`Delete ${bot.name}`}
                      onClick={() => setDeleteTarget(bot)}
                    >
                      <Trans>Delete</Trans>
                    </Button>
                  </div>
                ))}
                {archivedGroups.map((group) => (
                  <div key={group.id} className="flex items-center gap-2 rounded-lg px-2.5 py-2">
                    <GroupAvatar members={group.members} size={28} />
                    <span
                      className="min-w-0 flex-1 truncate text-[14px] text-foreground/75"
                      dir="auto"
                    >
                      {group.name}
                    </span>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() =>
                        void rpc.groups.restore({ groupId: group.id }).then(() => refreshBots(true))
                      }
                    >
                      <Trans>Restore</Trans>
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      className="text-destructive hover:text-destructive"
                      aria-label={t`Delete ${group.name}`}
                      onClick={() => setDeleteGroupTarget(group)}
                    >
                      <Trans>Delete</Trans>
                    </Button>
                  </div>
                ))}
              </>
            ) : null}
          </div>
        ) : null}
      </div>
      {/* The top border shows that the list above scrolls under this row. */}
      <div className="border-t border-sidebar-border px-2.5 pt-1">
        <ConnectAppsButton
          rail={rail}
          active={integrationsMode}
          onClick={() => {
            setMobileSidebarOpen(false);
            navigate("/app/integrations");
          }}
        />
      </div>
      <FirstRunTour
        open={tourOpen}
        onAsk={onTourAsk}
        onClose={(me) => {
          setTourRestart(false);
          setMobileSidebarOpen(false);
          setBootstrapMe((current) => me ?? (current && { ...current, tourSeen: true }));
        }}
      />
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger
          data-testid="user-menu-trigger"
          data-tour="user-menu"
          aria-label={rail ? userName : undefined}
          className={`flex items-center gap-[11px] rounded-lg py-3.5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
            rail ? "justify-center px-0" : "px-[18px]"
          }`}
        >
          <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-[12px] text-foreground/75">
            {initials}
          </span>
          {rail ? null : <span className="text-[14.5px] text-foreground/90">{userName}</span>}
        </PopoverTrigger>
        {menuOpen ? (
          <PopoverContent
            side="top"
            align="start"
            alignOffset={11}
            role="menu"
            className="w-[calc(316px-1.5rem)] max-w-[calc(100vw-3rem)] gap-0 p-1 data-closed:animate-none"
          >
            {bootstrapMe?.ticketBoardEnabled ? (
              <Button
                role="menuitem"
                variant="ghost"
                className="w-full justify-start font-normal"
                onClick={() => {
                  setMenuOpen(false);
                  setMobileSidebarOpen(false);
                  navigate("/app/board");
                }}
              >
                <SquareKanban className="text-muted-foreground" strokeWidth={1.75} />
                <Trans>Task board</Trans>
              </Button>
            ) : null}
            <Button
              role="menuitem"
              variant="ghost"
              className="w-full justify-start font-normal"
              aria-label={t`Settings`}
              onClick={() => {
                setMenuOpen(false);
                openSettings("general");
              }}
            >
              <Settings className="text-muted-foreground" strokeWidth={1.75} />
              <Trans>Settings</Trans>
            </Button>
            <HideAmountsMenuItem onDone={() => setMenuOpen(false)} />
            <Button
              role="menuitem"
              variant="ghost"
              className="w-full justify-start font-normal"
              data-testid="take-tour"
              onClick={() => {
                setMenuOpen(false);
                setTourRestart(true);
              }}
            >
              <Compass className="text-muted-foreground" strokeWidth={1.75} />
              <Trans>Take the tour</Trans>
            </Button>
            <Separator className="my-1" />
            <Button
              role="menuitem"
              variant="ghost"
              className="w-full justify-start font-normal"
              onClick={() =>
                void authClient.signOut().then(() => {
                  clearAgentAppCache();
                  clearSpaceSelection();
                  navigate("/");
                })
              }
            >
              <LogOut className="text-muted-foreground" strokeWidth={1.75} />
              <Trans>Log out</Trans>
            </Button>
          </PopoverContent>
        ) : null}
      </Popover>
    </aside>
  );
}
