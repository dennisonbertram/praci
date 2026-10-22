import { plural, t } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import type {
  AgentSkillCatalogEntry,
  Bot,
  BotSection,
  ComputerReleaseReason,
  ComputerStatus,
  DataRoomApiItem,
  Group,
  MailEdits,
  Me,
  MessageReaction,
  ProductEvent,
  Routine,
  SidebarSnapshot,
  Space,
  SpaceMemoryConfig,
  TaughtSkill,
  ThinkingLevel,
  ThreadMessage,
  ThreadSnapshot,
  VoiceStatus,
} from "@rakazo/contracts";
import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MAX_COUNT,
  DATA_ROOM_METADATA_ORDINAL,
  DEFAULT_AVATAR_STYLE,
  FIRST_BOT_SPAWN_KEY,
  isGtmAgentSpawnKey,
  isIntegrationAgentSpawnKey,
  isMailThreadAgentSpawnKey,
  LEGAL_CONSENT_REQUIRED_MESSAGE,
  NOTIFICATION_KINDS,
  RunPhaseSchema,
} from "@rakazo/contracts";
import type { ComposerMention } from "@rakazo/core";
import {
  attachmentsForThread,
  buildComposerMentionOptions,
  cronFromPreset,
  DEFAULT_BOT_COLOR,
  inferAttachmentMimeType,
  isActive,
  isApprovalAskBlock,
  isRunTerminalEvent,
  latestAnswerableAskMessageId,
  matchesArtifactQuery,
  nestRosterByParent,
  newClientId,
  planSidebarMove,
  resolveComposerSendPlan,
  runThreadSubscription,
  searchHitThreadTarget,
  speechFromBlocks,
  userVisibleMessages,
  withLiveStreamingProgress,
} from "@rakazo/core";
import { botAccentHex, botAccentStyle } from "@rakazo/ui-tokens";
import type { GroupAvatarMember } from "@rakazo/ui-web";
import {
  AvatarStyleProvider,
  BotAvatar,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  GroupAvatar,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
  Skeleton,
  Spinner,
} from "@rakazo/ui-web";
import {
  ArrowLeft,
  BookUser,
  ChartColumn,
  ChevronDown,
  CircleAlert,
  Clock,
  CodeXml,
  Compass,
  Files,
  FileText,
  FolderOpen,
  FolderPlus,
  HandCoins,
  History,
  LayoutGrid,
  ListTodo,
  Lock,
  LogOut,
  Mail,
  Maximize2,
  Megaphone,
  Menu,
  MessageSquare,
  Monitor,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  Pencil,
  PieChart,
  Plus,
  Scale,
  Search,
  Settings,
  SquareKanban,
  Trash2,
  Users,
  WandSparkles,
  X,
} from "lucide-react";
import type { DragEvent, KeyboardEventHandler, MutableRefObject } from "react";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  Link,
  useLocation,
  useMatch,
  useNavigate,
  useNavigationType,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { AgentPanelIntro } from "../components/AgentPanelIntro";
import { BotAudienceTag } from "../components/BotAudienceTag";
import type { BotToolControls, ComposerDraft } from "../components/BotToolControls";
import { BotToolControlsContext } from "../components/BotToolControls";
import { ComposeEmail, NEW_MESSAGE } from "../components/ComposeEmail";
import { ComputerMaintenanceActions } from "../components/ComputerMaintenanceActions";
import {
  ComputersUnavailableHint,
  computersAreUnavailable,
} from "../components/ComputersUnavailableHint";
import { ComputerUpdateProgress } from "../components/ComputerUpdateProgress";
import { ConnectAppsButton } from "../components/ConnectAppsButton";
import { CallCard } from "../components/call/CallCard";
import { ComputerWorkspace } from "../components/computer/ComputerWorkspace";
import type { SendTarget } from "../components/data-room/SendToAgent";
import { ErrorBoundary, lazyOverlay, SectionLoadFailed } from "../components/ErrorBoundary";
import { HideAmountsMenuItem } from "../components/HideAmountsToggle";
import { AgentAvatar } from "../components/integrations/AgentAvatar";
import { DevinConnectDialog } from "../components/integrations/DevinConnectDialog";
import { PageAgentIntro, pageAgentKind } from "../components/PageAgentIntro";
import { PageAgentsRow } from "../components/PageAgentsRow";
import { PageNavContext } from "../components/PageHeader";
import { RowsSkeleton } from "../components/RowsSkeleton";
import { canOfferHostComputer } from "../components/RunsOnPicker";
import { OpeningSpace, ThreadSkeleton } from "../components/ShellSkeleton";
import { RailTip, SidebarPageLink } from "../components/SidebarPageLink";
import { SidebarPages } from "../components/SidebarPages";
import { SidebarPagesGroup } from "../components/SidebarPagesGroup";
import { MAIN_CONTENT_ID, SkipToContent } from "../components/SkipToContent";
import type { DropResult, SidebarLayout } from "../components/sidebar-folders/drop-target";
import { itemDragId, ROOT_CONTAINER } from "../components/sidebar-folders/drop-target";
import { FolderHeader } from "../components/sidebar-folders/FolderHeader";
import {
  RootEnd,
  SidebarDnd,
  SortableList,
  SortableRow,
} from "../components/sidebar-folders/SidebarDnd";
import { SidebarUndoNotice } from "../components/sidebar-folders/SidebarUndoNotice";
import { glanceBadge, StatusMark } from "../components/sidebar-glance";
import { TeachCaptureOverlay } from "../components/teach/TeachCaptureOverlay";
import { TeachComputerOverlayControl } from "../components/teach/TeachComputerOverlay";
import { TeachRecordingChrome, TeachStopButton } from "../components/teach/TeachRecordingChrome";
import { connectCardsOpen, focusQuestionOpen } from "../components/tour/connect-cards";
import { FirstRunTour } from "../components/tour/FirstRunTour";
import { clearTourStep, tourInProgress } from "../components/tour/TourPopover";
import { clearAgentAppCache, useAgentApp } from "../lib/agent-app";
import { dismissApprovalToasts } from "../lib/approval-toasts";
import { artifactDisplayName } from "../lib/artifact-name";
import type { ArtifactTarget } from "../lib/artifact-open";
import { authClient } from "../lib/auth";
import { takeInitialBootstrap } from "../lib/bootstrap";
import {
  getBotsSidebarDensity,
  subscribeBotsSidebarDensity,
} from "../lib/bots-sidebar-density-pref";
import {
  BOTS_SIDEBAR_EDGE_DRAG_PX,
  readBotsSidebarCollapsed,
  readCartaAgentCollapsed,
  readInboxAgentCollapsed,
  writeBotsSidebarCollapsed,
  writeCartaAgentCollapsed,
  writeInboxAgentCollapsed,
} from "../lib/bots-sidebar-pref";
import { requestBrowserNotificationPermission } from "../lib/browser-notifications";
import { startCall, useCallSession } from "../lib/call-session";
import {
  cartaPanelState,
  findCartaAgent,
  listedInSidebar,
  useAutoCreateCartaAgent,
  useOnPhoneWidth,
} from "../lib/carta-agent";
import { recoverComposerDraft } from "../lib/composer-accounts";
import {
  embeddableScreenUrl,
  loadComputerScreen,
  screenIframeSandbox,
} from "../lib/computer-screen";
import { publishComputerCommand } from "../lib/computer-workspace";
import { fetchDataRoomBlob } from "../lib/data-room";
import { dataRoomAgentSuggestions, findDataRoomAgent } from "../lib/data-room-agent";
import { pendingDelegateAgents } from "../lib/delegate-wait";
import { desktopBridge } from "../lib/desktop";
import { setDockedAgentBotId } from "../lib/docked-agent";
import { financeAgentSuggestions, findFinanceAgent } from "../lib/finance-agent";
import { findGtmAgent } from "../lib/gtm-agent";
import {
  maskCurrencyWhenHidden,
  setHideAmounts,
  setHideAmountsUser,
  useHideAmounts,
} from "../lib/hide-amounts-preference";
import { findInboxAgent } from "../lib/inbox-agent";
import { appPath } from "../lib/integrations";
import { findInvestorsAgent, investorsAgentSuggestions } from "../lib/investors-agent";
import { findLegalAgent } from "../lib/legal-agent";
import { accountTimezone, markTimezoneReported, timezoneToReport } from "../lib/local-timezone";
import { parseModelOptionKey } from "../lib/model-catalog";
import { createAgentSendWatch } from "../lib/outbox";
import {
  isUnclaimedFileDrag,
  readFileAsBase64,
  revokePendingAttachmentPreviews,
} from "../lib/pending-attachments";
import { markAfterPaint, markOnce } from "../lib/performance";
import { getResponseStreamingEnabled, subscribeResponseStreaming } from "../lib/response-streaming";
import type { Panel, RightPanelState } from "../lib/right-panel-state";
import {
  readRightPanelState,
  rightPanelStorageKey,
  writeRightPanelState,
} from "../lib/right-panel-state";
import {
  compactRosterStatusLabel,
  needsAnswerLabel,
  rosterHasUndismissedRunError,
  rosterHeldFor,
  rosterStatusChanged,
  rosterWorkStatusLabel,
  waitingForApprovalLabel,
} from "../lib/roster-status";
import { formatRosterTime } from "../lib/roster-time";
import type { MissingBotSeen } from "../lib/route-bot";
import { resolveRouteBot, shouldClearMissingBot, useGiveUpOnMissingBot } from "../lib/route-bot";
import { clearSpaceSelection, rpc, selectedSpaceId, selectSpace } from "../lib/rpc";
import { readSeenRunErrorIds, rememberSeenRunErrorId } from "../lib/run-error-storage";
import type { DataRoomRef } from "../lib/send-to-agent";
import { planSendToAgent, sendTargets } from "../lib/send-to-agent";
import { sharedInflight } from "../lib/shared-inflight";
import {
  PANEL_DOCKED_QUERY,
  SIDEBAR_DOCKED_QUERY,
  showHeaderWindowChrome,
  sidebarInert,
  sidebarRail,
  useDrawerFocus,
  useSidebarDocked,
} from "../lib/shell-layout";
import { rememberThread } from "../lib/thread-cache";
import {
  activeThreadRuns,
  applyThreadSendReceipt,
  clearActiveThreadRuns,
  composerShowsStop,
  computerPanelAutoBoot,
  computerPanelAutoUsesBoot,
  computerPanelNeedsMaintenance,
  computerTakeoverBlocked,
  dismissedThreadRunError,
  isComputerStatusEvent,
  isThreadSnapshotEvent,
  prependThreadMessagePage,
  reconcileRefreshedThread,
  reduceComputerStatus,
  reduceThreadSnapshot,
  threadRunError,
  userHoldsComputerControl,
} from "../lib/thread-events";
import { threadReadInput } from "../lib/thread-read";
import { getToolActivityEnabled, subscribeToolActivity } from "../lib/tool-activity-preference";
import { transcriptCanSnapAfterFrame, transcriptIsNearEnd } from "../lib/transcript-scroll";
import { speaker } from "../lib/tts";
import { useRememberedMessages } from "../lib/use-remembered-messages";
import { useRunResumedAt } from "../lib/use-run-resumed-at";
import { useSidebarGlance } from "../lib/use-sidebar-glance";
import { errorText } from "../lib/user-error";
import { workingActivity } from "../lib/working-activity";
import { ActivityList } from "./ActivityList";
import type { ContextMenuPosition } from "./BotContextMenu";
import { ContactsPage } from "./Contacts";
import { DataRoomPage } from "./DataRoom";
import { DevinPage } from "./Devin";
import { FinancePage } from "./Finance";
import { FundraisingPage } from "./Fundraising";
import { CreateGroupForm, GroupSettings, memberName } from "./GroupPanel";
import { GtmPage } from "./Gtm";
import { InboxPage } from "./Inbox";
import { IntegrationsPage } from "./Integrations";
import { InvestorsPage } from "./Investors";
import { UpdateEditor } from "./investors/UpdateEditor";
import { LegalPage } from "./Legal";
import { NotFoundPage } from "./NotFound";
import { ResizableSidePanel } from "./ResizableSidePanel";
import type { RoutineDraftState } from "./RoutineEditor";
import {
  draftFromRoutine,
  emptyRoutineDraft,
  RoutineEditor,
  RoutineListHeader,
  RoutineListRow,
  routineNeedsOneShotArm,
} from "./RoutineEditor";
import type { SettingsSection } from "./SettingsOverlay";
import type { PageRemoteUpdate } from "./shell/bot-page-panel";
import { BotPagePanel } from "./shell/bot-page-panel";
import { BotSettings } from "./shell/bot-panel";
import { BotCreatePicker, pickerInitialFocus } from "./shell/bot-picker";
import { PinsList, PinsStrip, useBotPins } from "./shell/bot-pins";
import type { PaletteEntry } from "./shell/command-palette";
import { CommandPalette, isCommandPaletteHotkey, plainSnippet } from "./shell/command-palette";
import type { PendingAttachment } from "./shell/composer";
import { Composer } from "./shell/composer";
import { isStalePendingAskError } from "./shell/composer-error";
import {
  ClearConversationDialog,
  DeleteBotDialog,
  DeleteItemDialog,
  NewBotSectionDialog,
  NewSpaceDialog,
  PickerInfoDialog,
  RenameBotSectionDialog,
  RenameSpaceDialog,
} from "./shell/dialogs";
import { GroupIntro } from "./shell/GroupIntro";
import { moveRosterFocus, rosterRowId, syncRosterTabStops } from "./shell/roster-tab-stops";
import { SidebarHeaderRow, TOP_BAR_HEIGHT } from "./shell/sidebar-header-row";
import {
  activeSpaceFirst,
  commitSpaceRename,
  sidebarGroupsForSpaces,
  spaceHoldingChat,
} from "./shell/space-sidebar";
import { AppNavigateContext, Transcript, UnreadDivider } from "./shell/transcript";
import { endOnWholeRow } from "./shell/whole-rows";
import { WindowChrome } from "./WindowChrome";

const ArtifactsPage = lazy(() =>
  import("./Artifacts").then((module) => ({ default: module.ArtifactsPage })),
);
const BoardPage = lazy(() => import("./Board").then((module) => ({ default: module.BoardPage })));
const BotContextMenu = lazyOverlay(() =>
  import("./BotContextMenu").then((module) => module.BotContextMenu),
);
const MessagingSettingsOverlay = lazyOverlay(() =>
  import("./MessagingSettingsOverlay").then((module) => module.MessagingSettingsOverlay),
);
const SettingsOverlay = lazyOverlay(() =>
  import("./SettingsOverlay").then((module) => module.SettingsOverlay),
);
const PeerMessagesOverlay = lazyOverlay(() =>
  import("./PeerMessagesOverlay").then((module) => module.PeerMessagesOverlay),
);

export type { PendingAttachment };
export { Composer, Transcript, UnreadDivider };

/** Safety-net refresh of the sidebar list; events and tab focus keep it current in between. */
/**
 * Stops a slow run, then resends only if the stop succeeded and the person is still in the
 * chat they clicked in (the resend reads the current chat, so it must not follow a navigation).
 */
export async function retryAfterStop({
  stop,
  destination,
  resend,
}: {
  stop: () => Promise<boolean>;
  destination: () => string | null;
  resend: () => void;
}) {
  const origin = destination();
  if (!(await stop()) || destination() !== origin) return;
  resend();
}

export const BOTS_POLL_MS = 90_000;
const THREAD_SNAPSHOT_TIMEOUT_MS = 2_000;
/** Bound Settings leave so a hung voice status refresh cannot block dismissal. */
const VOICE_STATUS_REFRESH_TIMEOUT_MS = 10_000;
const MOBILE_SIDEBAR_SWIPE_EDGE_PX = 32;
const MOBILE_SIDEBAR_SWIPE_DISTANCE_PX = 56;

/** Phones get page agents collapsed by default: there the side panel covers the page. */
const wideScreen = () => window.matchMedia(PANEL_DOCKED_QUERY).matches;
/** How long "Sent to <group> · Open" stays under the composer after an @group message. */
const FORWARDED_NOTICE_MS = 8000;

const maskOptional = (text: string | null) => (text ? maskCurrencyWhenHidden(text) : null);

function threadSnapshotSignal(parent: AbortSignal): AbortSignal {
  return AbortSignal.any([parent, AbortSignal.timeout(THREAD_SNAPSHOT_TIMEOUT_MS)]);
}

function voiceStatusRefreshTimeout(): Promise<never> {
  return new Promise((_, reject) => {
    AbortSignal.timeout(VOICE_STATUS_REFRESH_TIMEOUT_MS).addEventListener("abort", () => {
      reject(new DOMException("Voice status refresh timed out", "TimeoutError"));
    });
  });
}

function collapsedSidebarSectionsStorageKey(userId: string | null | undefined): string | null {
  if (!userId) return null;
  return `rakazo:collapsed-sidebar-sections:${userId}`;
}

function collapsedRosterParentsStorageKey(userId: string | null | undefined): string | null {
  if (!userId) return null;
  return `rakazo:collapsed-roster-parents:${userId}`;
}

function readCollapsedIdSet(storageKey: string | null): Set<string> {
  if (!storageKey) return new Set();
  try {
    const value = window.localStorage.getItem(storageKey);
    const keys: unknown = value ? JSON.parse(value) : [];
    return new Set(
      Array.isArray(keys) ? keys.filter((key): key is string => typeof key === "string") : [],
    );
  } catch {
    return new Set();
  }
}

function toggleCollapsedIdSet(
  previous: ReadonlySet<string>,
  id: string,
  storageKey: string | null,
): Set<string> {
  const next = new Set(previous);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  if (storageKey) {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify([...next]));
    } catch {
      // Keep the UI usable when storage is unavailable.
    }
  }
  return next;
}

function readCollapsedSidebarSections(userId: string | null | undefined): Set<string> {
  return readCollapsedIdSet(collapsedSidebarSectionsStorageKey(userId));
}

function readCollapsedRosterParents(userId: string | null | undefined): Set<string> {
  return readCollapsedIdSet(collapsedRosterParentsStorageKey(userId));
}

/** A non-chat search result: a Data room document, artifact or contact. */
type SearchLink = { id: string; label: string; detail?: string };

/** Data room files (by name and content) and artifacts matching a search; a failure only hides that group. */
export async function findDocumentsAndArtifacts(query: string) {
  const [documents, artifacts] = await Promise.all([
    Promise.all([
      rpc.dataRoom.search({ query, limit: 5 }),
      // Only for the folder line; a failure just leaves it off.
      rpc.dataRoom.folders().catch(() => []),
    ])
      .then(([result, folders]): SearchLink[] => {
        const byId = new Map(folders.map((folder) => [folder.id, folder]));
        const folderPath = (id: string | null) => {
          const names: string[] = [];
          let at = id ? byId.get(id) : undefined;
          while (at && names.length < 8) {
            names.unshift(at.name);
            at = at.parentId ? byId.get(at.parentId) : undefined;
          }
          return names.join(" / ");
        };
        return result.results.map(({ item, ordinal, snippet }) => ({
          id: item.id,
          label: item.name,
          // A match inside the file shows the matching text; a name match shows the folder.
          detail:
            ordinal === DATA_ROOM_METADATA_ORDINAL
              ? folderPath(item.folderId) || undefined
              : (maskOptional(
                  snippet.replaceAll("\u0001", "").replaceAll("\u0002", "").trim() || null,
                ) ?? undefined),
        }));
      })
      .catch((): SearchLink[] => []),
    // ponytail: matches the 60 newest artifacts by name and description; a server query when spaces hold more.
    rpc.artifacts
      .listSpace({ limit: 60 })
      .then((result): SearchLink[] =>
        result.items
          .filter((item) => matchesArtifactQuery(item, query))
          .slice(0, 5)
          .map((item) => ({
            id: item.id,
            label: artifactDisplayName(item.name),
            // A description hit shows why the artifact matched.
            detail: item.name.toLowerCase().includes(query.toLowerCase())
              ? undefined
              : (maskOptional(item.description ?? null) ?? undefined),
          })),
      )
      .catch((): SearchLink[] => []),
  ]);
  return { documents, artifacts };
}

/** Contacts whose name, email or organization contain the text. */
function findContacts(query: string): Promise<SearchLink[]> {
  const needle = query.toLowerCase();
  return rpc.contacts
    .list({})
    .then((list) =>
      list
        .filter((c) =>
          [c.name, c.email, c.organization].some((v) => v?.toLowerCase().includes(needle)),
        )
        .sort(
          (a, b) =>
            Number(b.name.toLowerCase().includes(needle)) -
            Number(a.name.toLowerCase().includes(needle)),
        )
        .slice(0, 5)
        .map((c) => ({
          id: c.name,
          label: c.name,
          // The field that matched, so a hit on "halcyon" shows why; else the usual second line.
          detail:
            [c.organization, c.email].find((v) => v?.toLowerCase().includes(needle)) ??
            c.organization ??
            c.email ??
            undefined,
        })),
    )
    .catch((): SearchLink[] => []);
}

/** Chats with a matching message, once per chat: the newest match and its date. */
function findChats(query: string) {
  return rpc.search
    .query({ q: query })
    .then(({ hits }) => {
      const seen = new Set<string>();
      const entries: PaletteEntry[] = [];
      for (const hit of hits) {
        const chatId = hit.groupId ?? hit.botId;
        const name = hit.groupName ?? hit.botName ?? hit.title;
        if (!chatId || seen.has(chatId)) continue;
        seen.add(chatId);
        const params = new URLSearchParams();
        if (hit.messageId) params.set("m", hit.messageId);
        if (hit.routineId) params.set("routine", hit.routineId);
        const search = params.toString();
        const isChatText = hit.kind === "conversation" || hit.kind === "message";
        entries.push({
          id: `${hit.groupId ? `/app/g/${chatId}` : `/app/${chatId}`}${search ? `?${search}` : ""}`,
          label: name,
          detail: isChatText ? plainSnippet(hit.snippet) : hit.title,
          date: hit.createdAt
            ? new Date(hit.createdAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })
            : undefined,
        });
      }
      return entries.slice(0, 5);
    })
    .catch((): PaletteEntry[] => []);
}

export function ShellPage() {
  const { t } = useLingui();
  const { botId, groupId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // Mirrors searchParams for effects that only need to read it once on run,
  // not re-run on every unrelated query-param change (e.g. the SSE subscribe
  // effect below, which should only restart when the active bot changes).
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;
  const session = authClient.useSession();
  const userId = session.data?.user.id;
  const [groups, setGroups] = useState<Group[]>([]);
  const [bots, setBots] = useState<Bot[]>([]);
  const sendToAgentTargets = useMemo(() => sendTargets(bots), [bots]);
  const botsRef = useRef(bots);
  botsRef.current = bots;
  const voiceCallStarting = useRef(false);
  const voiceCallMounted = useRef(true);
  useEffect(() => {
    voiceCallMounted.current = true;
    return () => {
      voiceCallMounted.current = false;
    };
  }, []);
  const botOrderEpochRef = useRef(0);
  const savingBotOrderRef = useRef(0);
  const [botSections, setBotSections] = useState<BotSection[]>([]);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [folderUndo, setFolderUndo] = useState<SidebarSnapshot | null>(null);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [archivedBots, setArchivedBots] = useState<Bot[]>([]);
  const [archivedGroups, setArchivedGroups] = useState<Group[]>([]);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [pageAgentsOpen, setPageAgentsOpen] = useState(false);
  const [emailChatsOpen, setEmailChatsOpen] = useState(false);
  const [collapsedSidebarSections, setCollapsedSidebarSections] = useState(() => new Set<string>());
  const [collapsedRosterParents, setCollapsedRosterParents] = useState(() => new Set<string>());

  useEffect(() => {
    setHideAmountsUser(userId ?? null);
  }, [userId]);
  useEffect(() => {
    setCollapsedSidebarSections(readCollapsedSidebarSections(userId));
    setCollapsedRosterParents(readCollapsedRosterParents(userId));
  }, [userId]);
  useEffect(() => {
    setBotsSidebarCollapsed(readBotsSidebarCollapsed(userId));
  }, [userId]);
  // Closed until Ask opens it, like the other pages' agents; an explicit open is remembered on wide screens.
  const [inboxAgentCollapsed, setInboxAgentCollapsed] = useState(true);
  // With no Inbox agent the panel only holds a Create button, so it stays closed until asked for.
  const [showEmptyInboxAgent, setShowEmptyInboxAgent] = useState(false);
  const [creatingInboxAgent, setCreatingInboxAgent] = useState(false);
  const [inboxAgentError, setInboxAgentError] = useState("");
  // The Finance agent panel starts closed on every visit; "Ask agent" opens it.
  const [financeAgentOpen, setFinanceAgentOpen] = useState(false);
  const [creatingFinanceAgent, setCreatingFinanceAgent] = useState(false);
  const [financeAgentError, setFinanceAgentError] = useState("");
  const [dataRoomAgentOpen, setDataRoomAgentOpen] = useState(false);
  const [creatingDataRoomAgent, setCreatingDataRoomAgent] = useState(false);
  const [dataRoomAgentError, setDataRoomAgentError] = useState("");
  const [legalAgentOpen, setLegalAgentOpen] = useState(false);
  const [creatingLegalAgent, setCreatingLegalAgent] = useState(false);
  const [legalAgentError, setLegalAgentError] = useState("");
  const [gtmAgentOpen, setGtmAgentOpen] = useState(false);
  const [creatingGtmAgent, setCreatingGtmAgent] = useState(false);
  const [gtmAgentError, setGtmAgentError] = useState("");
  // The Legal page reports whether it still lacks consent; its Allow is the only one, so the agent waits for it.
  const [legalConsentMissing, setLegalConsentMissing] = useState(false);
  const [devinAgentOpen, setDevinAgentOpen] = useState(false);
  const [creatingDevinAgent, setCreatingDevinAgent] = useState(false);
  const [devinAgentError, setDevinAgentError] = useState("");
  /** The connector's Devin agent: undefined until asked, null for everyone else. */
  const [devinAgentId, setDevinAgentId] = useState<string | null | undefined>(undefined);
  const [devinDialog, setDevinDialog] = useState<"connect" | "replace" | null>(null);
  /** Remounts the Devin page after a key is accepted, so it shows the new connection at once. */
  const [devinPageKey, setDevinPageKey] = useState(0);
  // The Carta agent panel starts closed, like the other pages' agents, and remembers an explicit open.
  const [cartaAgentCollapsed, setCartaAgentCollapsed] = useState(true);
  const [creatingCartaAgent, setCreatingCartaAgent] = useState(false);
  // Reported by the Cap Table page. Without Carta the agent has nothing to read, so its panel stays shut.
  const [cartaConnected, setCartaConnected] = useState(false);
  const [cartaAgentError, setCartaAgentError] = useState("");
  const [creatingInvestorsAgent, setCreatingInvestorsAgent] = useState(false);
  const [investorsAgentError, setInvestorsAgentError] = useState("");
  useEffect(() => {
    const phone = !wideScreen();
    setInboxAgentCollapsed(readInboxAgentCollapsed(userId) || phone);
    setCartaAgentCollapsed(readCartaAgentCollapsed(userId) || phone);
  }, [userId]);
  const [snapshot, setSnapshot] = useState<ThreadSnapshot | null>(null);
  const snapshotRef = useRef<ThreadSnapshot | null>(null);
  const streamResponses = useSyncExternalStore(
    subscribeResponseStreaming,
    getResponseStreamingEnabled,
    () => false,
  );
  const streamResponsesRef = useRef(streamResponses);
  streamResponsesRef.current = streamResponses;
  useHideAmounts();
  const showToolActivity = useSyncExternalStore(
    subscribeToolActivity,
    getToolActivityEnabled,
    () => true,
  );
  const botsSidebarDensity = useSyncExternalStore(
    subscribeBotsSidebarDensity,
    getBotsSidebarDensity,
    () => "comfortable",
  );
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [pendingItems, setPendingItems] = useState<DataRoomRef[]>([]);
  const [replyTarget, setReplyTarget] = useState<ThreadMessage | null>(null);
  const [replyQuote, setReplyQuote] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [attachmentNotice, setAttachmentNotice] = useState<string | null>(null);
  // A message that @mentioned a group went to that group; the person stays where they wrote it.
  const [forwarded, setForwarded] = useState<{ groupId: string; threadKey: string } | null>(null);
  function showForwarded(groupId: string, threadKey: string | undefined) {
    if (threadKey) setForwarded({ groupId, threadKey });
  }
  // The notice is a confirmation, not a status: it goes away on its own.
  useEffect(() => {
    if (!forwarded) return;
    const timer = window.setTimeout(() => setForwarded(null), FORWARDED_NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [forwarded]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [panel, setPanelState] = useState<Panel>(null);
  // The bot whose page exists (the Page control shows only then), and its latest page.updated event.
  const [pageBotId, setPageBotId] = useState<string | null>(null);
  const [pageRemote, setPageRemote] = useState<PageRemoteUpdate | null>(null);
  const [pinsSeq, setPinsSeq] = useState(0);
  const [restoredPanelKey, setRestoredPanelKey] = useState<string | null>(null);
  const panelStorageKeyRef = useRef<string | null>(null);
  const observedPanelKey = useRef<string | null>(null);
  const explicitPanelTarget = useRef<string | null>(null);
  const pendingPanelRestore = useRef<RightPanelState | null>(null);
  const pendingExplicitPanel = useRef(false);
  const panelSearch = useRef({ searchParams, setSearchParams });
  panelSearch.current = { searchParams, setSearchParams };
  const setPanel = useCallback((next: Panel | ((current: Panel) => Panel)) => {
    // A user navigation wins over a saved routine still waiting for its list.
    pendingPanelRestore.current = null;
    pendingExplicitPanel.current = panelStorageKeyRef.current === null;
    setRestoredPanelKey(panelStorageKeyRef.current);
    setPanelState(next);
    const currentSearch = panelSearch.current;
    if (currentSearch.searchParams.has("routine")) {
      const params = new URLSearchParams(currentSearch.searchParams);
      params.delete("routine");
      currentSearch.setSearchParams(params, { replace: true });
    }
  }, []);
  const [peerConversation, setPeerConversation] = useState<{
    peerBotId: string;
    peerBotName: string;
  } | null>(null);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [routinesBotId, setRoutinesBotId] = useState<string | null>(null);
  const [taughtSkills, setTaughtSkills] = useState<TaughtSkill[]>([]);
  const [taughtSkillsBotId, setTaughtSkillsBotId] = useState<string | null>(null);
  const [agentSkills, setAgentSkills] = useState<AgentSkillCatalogEntry[]>([]);
  // Bumped when a run ends, so the Skills settings list picks up a skill the agent just created.
  const [skillsRefreshKey, setSkillsRefreshKey] = useState(0);
  const [mentionRoutines, setMentionRoutines] = useState<Array<Routine & { botName?: string }>>([]);
  const [mentionConnectors, setMentionConnectors] = useState<
    Array<{
      id: string;
      name: string;
      authStatus: "connected" | "needs_auth";
      connectionId?: string;
    }>
  >([]);
  const [teachBusy, setTeachBusy] = useState(false);
  const [computer, setComputer] = useState<ComputerStatus | null>(null);
  const computerRef = useRef<ComputerStatus | null>(null);
  const threadRefreshEpoch = useRef(0);
  const groupRefreshEpoch = useRef(0);
  const botsRefreshEpoch = useRef(0);
  const botsRefreshApplied = useRef(0);
  // Request number of the newest refresh whose bot list was actually stored (a reorder can drop it).
  const botsListApplied = useRef(0);
  // The route bot id and the refresh epoch when the route changed; set in a layout effect so no
  // refresh already in flight can redirect away from a bot it never had the chance to see.
  const routeBotStart = useRef<{ id: string | undefined; epoch: number } | null>(null);
  const missingBotSeen = useRef<MissingBotSeen | null>(null);
  const [, rerenderAfterMissingBot] = useReducer((n: number) => n + 1, 0);
  const archivedBotsRefreshEpoch = useRef(0);
  const botsRefreshInFlight = useRef(0);
  // A very fast run can finish over SSE while its threads.send response is still
  // returning. Do not let that late receipt resurrect terminal work as queued.
  const terminalRunReceipts = useRef(new Set<string>());
  // Last-known computer/screen per bot, so switching back to an already-seen
  // bot paints its computer pane instantly instead of blanking it while the
  // thread + screen RPCs round-trip again (see refreshThread / refreshComputerScreen).
  // Last thread per bot: returning to a chat shows its messages while the fresh copy loads.
  const threadCacheRef = useRef(new Map<string, ThreadSnapshot>());
  const computerCacheRef = useRef(
    new Map<string, { computer: ComputerStatus | null; screenUrl: string | null }>(),
  );
  // Caps computerCacheRef so a long session that opens many distinct bots
  // over time doesn't accumulate one entry per bot forever. Re-inserting on
  // every update keeps Map iteration order as least-recently-used first, so
  // eviction drops the bot that's been out of view longest.
  const COMPUTER_CACHE_LIMIT = 20;

  function cacheComputerFor(
    botId: string,
    patch: Partial<{ computer: ComputerStatus | null; screenUrl: string | null }>,
  ) {
    const cache = computerCacheRef.current;
    const prev = cache.get(botId) ?? { computer: null, screenUrl: null };
    cache.delete(botId);
    cache.set(botId, { ...prev, ...patch });
    if (cache.size > COMPUTER_CACHE_LIMIT) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
  }

  function commitSnapshot(next: ThreadSnapshot | null) {
    snapshotRef.current = next;
    rememberThread(threadCacheRef.current, next, 8);
    setSnapshot(withLiveStreamingProgress(next, streamResponsesRef.current));
  }

  useEffect(() => {
    setSnapshot(withLiveStreamingProgress(snapshotRef.current, streamResponses));
  }, [streamResponses]);

  function commitComputer(next: ComputerStatus | null) {
    computerRef.current = next;
    setComputer(next);
  }

  function updateSnapshot(update: (prev: ThreadSnapshot | null) => ThreadSnapshot | null) {
    commitSnapshot(update(snapshotRef.current));
  }
  const [inboxUnread, setInboxUnread] = useState(0);
  const refreshInboxUnread = useCallback(() => {
    void rpc.inbox
      .unreadCount()
      .then((result) => setInboxUnread(result.count))
      .catch(() => undefined);
  }, []);
  useEffect(refreshInboxUnread, [refreshInboxUnread]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { pathname } = useLocation();
  const { counts: unseen, glance } = useSidebarGlance(
    pathname,
    snapshot ? { botId: snapshot.botId ?? null, threadId: snapshot.threadId } : null,
  );
  const [missingPath, setMissingPath] = useState<string | null>(null);
  const missingPathRef = useRef<string | null>(null);
  const markMissing = useCallback((path: string) => {
    missingPathRef.current = path;
    setMissingPath(path);
  }, []);
  // Only Back/Forward closes Settings. Nothing inside the dialog links to a page, and a route that
  // is still loading pushes or replaces its own path, which must not close a dialog just opened.
  const navigationType = useNavigationType();
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a new pathname closes Settings
  useEffect(() => {
    if (navigationType === "POP") setSettingsOpen(false);
  }, [pathname]);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("general");
  const [settingsModelProvider, setSettingsModelProvider] = useState<string | undefined>();
  /** Why Settings opened, shown at the top of its pane (Call Elio without a voice provider). */
  const [settingsNotice, setSettingsNotice] = useState<string | undefined>();
  const [messagingSettingsOpen, setMessagingSettingsOpen] = useState(false);
  const [messagingSurfaceEnabled, setMessagingSurfaceEnabled] = useState(false);
  const [messagingProviders, setMessagingProviders] = useState<string[]>([]);
  const [memoryProviderConfig, setMemoryProviderConfig] = useState<
    SpaceMemoryConfig | null | undefined
  >(undefined);
  const memoryProviderConfigRevision = useRef(0);
  const call = useCallSession();
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus | null>(null);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [dismissedRunErrorIds, setDismissedRunErrorIds] =
    useState<ReadonlySet<string>>(readSeenRunErrorIds);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  // A page header with its own menu button replaces the shell's phone band above it.
  const [headerMenus, setHeaderMenus] = useState(0);
  const pageNav = useMemo(
    () => ({
      open: () => setMobileSidebarOpen(true),
      claim: () => {
        setHeaderMenus((n) => n + 1);
        return () => setHeaderMenus((n) => n - 1);
      },
    }),
    [],
  );
  const sidebarDocked = useSidebarDocked();
  const sidebarRef = useRef<HTMLElement>(null);
  const sidebarScrollRef = useRef<HTMLDivElement>(null);
  const sidebarPaneRef = useRef<HTMLDivElement>(null);
  const rosterStopId = useRef<string | null>(null);
  // After every render, since rows come and go: keeps the chat list to one tab stop.
  useEffect(() => syncRosterTabStops(sidebarRef.current, rosterStopId.current));
  // Keeps the chat list from ending on a half-cut row, as rows come and go and the window resizes.
  useEffect(() => {
    const list = sidebarScrollRef.current;
    if (!list) return;
    let frame = 0;
    const trim = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => endOnWholeRow(list));
    };
    trim();
    const resize = new ResizeObserver(trim);
    resize.observe(list);
    const mutate = new MutationObserver(trim);
    mutate.observe(list, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutate.disconnect();
    };
  }, [mobileSidebarOpen]);
  // The drawer keeps its scroll offset while closed; open it on Pages, not where the chats were left.
  useEffect(() => {
    if (mobileSidebarOpen) sidebarPaneRef.current?.scrollTo({ top: 0 });
  }, [mobileSidebarOpen]);
  const closeMobileSidebar = useCallback(() => setMobileSidebarOpen(false), []);
  useDrawerFocus(mobileSidebarOpen, closeMobileSidebar, sidebarRef);
  const mobileSidebarSwipeRef = useRef<{ startX: number; startY: number } | null>(null);
  const [paneDraggingFiles, setPaneDraggingFiles] = useState(false);
  const keepNoticeFor = useRef<string | null>(null);
  const [fileDropBotId, setFileDropBotId] = useState<string | null>(null);
  const [focusComposerBotId, setFocusComposerBotId] = useState<string | null>(null);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [botsSidebarCollapsed, setBotsSidebarCollapsed] = useState(false);
  // Collapsed on a docked sidebar is the icon rail; below the dock width the drawer is unchanged.
  const rail = sidebarRail(botsSidebarCollapsed, sidebarDocked);
  // The rail starts at the top, not where the expanded list was scrolled to.
  useEffect(() => {
    if (rail) sidebarScrollRef.current?.scrollTo({ top: 0 });
  }, [rail]);
  const botsSidebarEdgeDragRef = useRef<{ startX: number; mode: "expand" | "collapse" } | null>(
    null,
  );
  const [newSpaceOpen, setNewSpaceOpen] = useState(false);
  const [pickerInfoTopic, setPickerInfoTopic] = useState<"group" | "space" | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  // The bot just made with "New bot", whose settings open with its name selected.
  const [namingBotId, setNamingBotId] = useState<string | null>(null);

  useEffect(() => {
    const desktop = window.matchMedia(SIDEBAR_DOCKED_QUERY);
    function closeMobileSidebar() {
      if (desktop.matches) setMobileSidebarOpen(false);
    }
    closeMobileSidebar();
    desktop.addEventListener("change", closeMobileSidebar);
    return () => desktop.removeEventListener("change", closeMobileSidebar);
  }, []);
  // Phones open the drawer on the chat list; Activity there is one tap away.
  // Activity is a quick look, not a place: it closes when you go somewhere and a reload starts closed.
  const [activityMode, setActivityMode] = useState(false);
  // While Activity is open it lists these bots' work, so their chat rows are not repeated below.
  const [activityBotIds, setActivityBotIds] = useState<ReadonlySet<string>>(new Set());
  const toggleActivityMode = useCallback(() => setActivityMode((on) => !on), []);
  // Activity sits above the chats: show it from its top, not from the row the list had settled on.
  useEffect(() => {
    if (activityMode) sidebarScrollRef.current?.scrollTo({ top: 0 });
  }, [activityMode]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: close on every navigation
  useEffect(() => setActivityMode(false), [pathname]);
  const [botMenu, setBotMenu] = useState<{
    kind: "bot" | "group";
    id: string;
    position: ContextMenuPosition;
  } | null>(null);
  // The context menu anchors to the pointer, so return focus to the row that opened it.
  const botMenuAnchor = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (botMenu || !botMenuAnchor.current) return;
    botMenuAnchor.current.focus();
    botMenuAnchor.current = null;
  }, [botMenu]);
  const [deleteTarget, setDeleteTarget] = useState<Bot | null>(null);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<Group | null>(null);
  const [deleteSpaceTarget, setDeleteSpaceTarget] = useState<Space | null>(null);
  const [renameSpaceTarget, setRenameSpaceTarget] = useState<Space | null>(null);
  const [spaceMenu, setSpaceMenu] = useState<{
    id: string;
    position: ContextMenuPosition;
  } | null>(null);
  const spaceMenuAnchor = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (spaceMenu || !spaceMenuAnchor.current) return;
    spaceMenuAnchor.current.focus();
    spaceMenuAnchor.current = null;
  }, [spaceMenu]);
  const closeSpaceMenu = useCallback(() => setSpaceMenu(null), []);
  const spaceMenuTarget = spaceMenu
    ? (spaces.find((space) => space.id === spaceMenu.id) ?? null)
    : null;
  const [clearTarget, setClearTarget] = useState<
    { kind: "bot"; chat: Bot } | { kind: "group"; chat: Group } | null
  >(null);
  const [newSectionTarget, setNewSectionTarget] = useState<
    { kind: "bot"; chat: Bot } | { kind: "group"; chat: Group } | null
  >(null);
  const [renameSectionTarget, setRenameSectionTarget] = useState<{
    section: BotSection;
    spaceId: string;
  } | null>(null);
  const [booting, setBooting] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [initialBotsLoaded, setInitialBotsLoaded] = useState(false);
  const [bootstrapMe, setBootstrapMe] = useState<Me | null>();
  const [tourRestart, setTourRestart] = useState(false);
  const tourQuestion = useRef(false);
  // A reload part-way through a tour reopens it, even a retake of a tour already seen.
  useEffect(() => {
    if (userId && tourInProgress(userId)) setTourRestart(true);
  }, [userId]);
  // Once the tour ends, a late profile response that still says unseen cannot restart it.
  const [tourEnded, setTourEnded] = useState(false);
  // After Skip tour the first question stays one tap away in Chief's composer.
  const [askChiefChip, setAskChiefChip] = useState(false);
  // The tour waits for the first-run focus question, so its popovers never cover the choices.
  const firstQuestionOpen = focusQuestionOpen(snapshot?.messages ?? []);
  const activeSpaceId = bootstrapMe?.spaceId;
  const agentAppFor = useAgentApp(
    userId,
    spaces.length > 0 ? spaces.map((space) => space.id) : activeSpaceId ? [activeSpaceId] : [],
  );
  const [keepComputerRecovery, setKeepComputerRecovery] = useState(false);
  const recoveryHoldTimer = useRef<number | undefined>(undefined);
  const showComputerRecoveryHint =
    computersAreUnavailable(bootstrapMe?.sandboxProvider) || keepComputerRecovery;
  const releaseComputerRecovery = useCallback(() => {
    window.clearTimeout(recoveryHoldTimer.current);
    recoveryHoldTimer.current = undefined;
    setKeepComputerRecovery(false);
  }, []);
  const holdComputerRecovery = useCallback(() => {
    setKeepComputerRecovery(true);
    window.clearTimeout(recoveryHoldTimer.current);
    recoveryHoldTimer.current = window.setTimeout(() => {
      recoveryHoldTimer.current = undefined;
      setKeepComputerRecovery(false);
    }, 4000);
  }, []);
  useEffect(() => {
    if (panel !== "computer") releaseComputerRecovery();
  }, [panel, releaseComputerRecovery]);
  useEffect(() => () => window.clearTimeout(recoveryHoldTimer.current), []);
  const [routineDraft, setRoutineDraft] = useState<RoutineDraftState>(emptyRoutineDraft());
  const [routineWebhookSecret, setRoutineWebhookSecret] = useState<string | null>(null);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [deleteRoutineTarget, setDeleteRoutineTarget] = useState<Routine | null>(null);
  const [savingRoutine, setSavingRoutine] = useState(false);
  const [runningRoutine, setRunningRoutine] = useState(false);
  const [routineError, setRoutineError] = useState<string | null>(null);
  const [screenUrl, setScreenUrl] = useState<string | null>(null);
  const [computerOpen, setComputerOpen] = useState(false);
  const [computerBotId, setComputerBotId] = useState<string | undefined>();
  const computerOpenRef = useRef(false);
  const computerBotIdRef = useRef<string | undefined>(undefined);
  const computerBootEpoch = useRef(0);
  const openComputerRef = useRef<(botId?: string) => Promise<boolean>>(async () => false);
  const [computerViewport, setComputerViewport] = useState<{
    height: number;
    offsetTop: number;
  } | null>(null);
  const [computerError, setComputerError] = useState<string | null>(null);
  // Screen-load failures can sit beside a still-valid embed URL; boot and
  // takeover failures must stay visible even when a URL remains.
  const [computerErrorFromScreen, setComputerErrorFromScreen] = useState(false);
  useEffect(() => {
    if (!computerOpen) {
      setComputerViewport(null);
      return;
    }
    const viewport = window.visualViewport;
    if (!viewport) return;
    const sync = () => {
      setComputerViewport({ height: viewport.height, offsetTop: viewport.offsetTop });
    };
    sync();
    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync);
    return () => {
      viewport.removeEventListener("resize", sync);
      viewport.removeEventListener("scroll", sync);
    };
  }, [computerOpen]);
  useEffect(() => {
    if (!session.data?.user) return;
    let cancelled = false;
    void rpc.messaging
      .status()
      .then((status) => {
        if (!cancelled) {
          setMessagingSurfaceEnabled(status.enabled);
          setMessagingProviders(status.providers);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [session.data?.user]);
  const [usage, setUsage] = useState<{
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens?: number | null;
    runs: number;
  } | null>(null);
  const refreshUsage = useCallback(() => {
    void rpc.usage
      .summary()
      .then(setUsage)
      .catch(() => undefined);
  }, []);
  const autoBooted = useRef<string | null>(null);
  const routineSavePending = useRef(false);
  const webhookSecretProvisionRef = useRef(new Map<string, Promise<string>>());
  const ensureWebhookSecret = (botId: string) =>
    sharedInflight(webhookSecretProvisionRef.current, botId, async () => {
      const result = await rpc.bots.rotateWebhookSecret({ botId });
      setRoutineWebhookSecret(result.secret);
      setBots((current) =>
        current.map((bot) => (bot.id === botId ? { ...bot, webhookConfigured: true } : bot)),
      );
      return result.secret;
    });
  const routineSaveRequest = useRef(0);
  const routineRunPending = useRef(false);
  const bootstrappedThread = useRef<ThreadSnapshot | null>(null);
  const expandedHistoryThread = useRef<string | null>(null);
  const historyEpoch = useRef(0);
  const jumpGeneration = useRef(0);
  const [scrollRequest, setScrollRequest] = useState<{
    messageId: string;
    nonce: number;
  } | null>(null);
  const clearScrollRequest = useCallback(() => setScrollRequest(null), []);
  const initiallyScrolledThread = useRef<string | null>(null);
  const messageScroll = useRef<HTMLDivElement>(null);
  const pinnedAroundRef = useRef<{
    botId?: string;
    groupId?: string;
    messageId: string;
    threadId: string;
    messages: ThreadMessage[];
    olderCursor: number | null;
  } | null>(null);
  const manuallyUnread = useRef(new Set<string>());
  const computerVisible = useRef(false);
  computerVisible.current = panel === "computer" || computerOpen;
  const autoSpoken = useRef<string | null>(null);
  const autoSpokenBotId = useRef<string | null>(null);

  const inGroup = Boolean(groupId);
  const inboxMode = useMatch("/app/inbox") != null;
  const integrationsMode = useMatch("/app/integrations/*") != null;
  const financeMode = useMatch("/app/finance/*") != null;
  const dataRoomMode = useMatch("/app/data-room") != null;
  const legalMode = useMatch("/app/legal") != null;
  const gtmMode = useMatch("/app/gtm") != null;
  const devinMode = useMatch("/app/devin") != null;
  const artifactsMode = useMatch("/app/artifacts/*") != null;
  // The route exists only while bootstrap enables the board (see App).
  const boardMode = useMatch("/app/board") != null;
  const investorsMode = useMatch("/app/investors/*") != null;
  const investorUpdateMatch = useMatch("/app/investors/updates/:id");
  const fundraisingMode = useMatch("/app/fundraising") != null;
  const contactsMode = useMatch("/app/contacts") != null;
  // Inbox, Finance, Legal, Data room, Cap Table and Integrations are pages of their own: no bot
  // route. Inbox, Finance, Legal and Cap Table keep their agent in a side panel.
  const pageMode =
    inboxMode ||
    financeMode ||
    legalMode ||
    gtmMode ||
    devinMode ||
    investorsMode ||
    fundraisingMode ||
    integrationsMode ||
    dataRoomMode ||
    artifactsMode ||
    contactsMode ||
    boardMode;
  useEffect(() => {
    if (!financeMode) setFinanceAgentOpen(false);
  }, [financeMode]);
  useEffect(() => {
    if (!dataRoomMode) setDataRoomAgentOpen(false);
  }, [dataRoomMode]);
  useEffect(() => {
    if (!legalMode) setLegalAgentOpen(false);
  }, [legalMode]);
  useEffect(() => {
    setGtmAgentOpen(gtmMode && window.matchMedia("(min-width: 768px)").matches);
  }, [gtmMode]);
  useEffect(() => {
    if (!devinMode) setDevinAgentOpen(false);
  }, [devinMode]);
  // Pages that name the workspace beside their title show it only when the user has several.
  const pageSpaceName =
    spaces.length > 1 ? spaces.find((space) => space.id === bootstrapMe?.spaceId)?.name : undefined;
  const routeBot = resolveRouteBot({
    bots,
    botId,
    loaded: initialBotsLoaded,
    seen: missingBotSeen.current,
    applied: botsListApplied.current,
  });
  const active =
    inGroup || integrationsMode || artifactsMode || contactsMode || boardMode
      ? undefined
      : inboxMode
        ? findInboxAgent(bots, userId)
        : financeMode
          ? findFinanceAgent(bots, userId)
          : dataRoomMode
            ? findDataRoomAgent(bots, userId)
            : legalMode
              ? findLegalAgent(bots, userId)
              : gtmMode
                ? findGtmAgent(bots, userId)
                : devinMode
                  ? bots.find((bot) => bot.id === devinAgentId)
                  : investorsMode || fundraisingMode
                    ? findInvestorsAgent(bots, userId)
                    : routeBot.bot;
  // A bot made with "New bot" opens with only its name until it has answered a message.
  useEffect(() => {
    // The snapshot can still be the previous thread's for a render after the bot opens.
    if (!namingBotId || active?.id !== namingBotId || snapshot?.botId !== namingBotId) return;
    const messages = snapshot.messages;
    const firstUser = messages.findIndex((message) => message.role === "user");
    if (firstUser >= 0 && messages.slice(firstUser + 1).some((m) => m.role === "bot")) {
      setNamingBotId(null);
    }
  }, [namingBotId, active?.id, snapshot]);
  /** The open bot's colour. A group or a missing bot has no `active`, so its thread stays monochrome. */
  const threadAccent = botAccentHex(active?.color);
  const [botPins, setBotPins] = useBotPins(active?.id, pinsSeq);
  const inboxAgentHidden = inboxAgentCollapsed || (!active && !showEmptyInboxAgent);
  const computerBot =
    (computerBotId ? bots.find((bot) => bot.id === computerBotId) : undefined) ?? active;
  computerOpenRef.current = computerOpen;
  computerBotIdRef.current = computerBotId ?? active?.id;
  const activeGroup = groups.find((group) => group.id === groupId);
  // An approval in the chat that is open (a bot, a page agent or a group) is already on screen.
  const openChatHref =
    inGroup && groupId ? `/app/g/${groupId}` : active ? `/app/${active.id}` : undefined;
  useEffect(() => {
    if (openChatHref)
      dismissApprovalToasts({ href: openChatHref, botId: inGroup ? undefined : active?.id });
  }, [openChatHref, inGroup, active?.id]);
  const opening = chatIsOpening({
    hasChat: Boolean(active || activeGroup),
    botsLoaded: initialBotsLoaded,
    routeWaiting: routeBot.waiting,
  });
  const forwardedName = forwarded
    ? (groups.find((group) => group.id === forwarded.groupId)?.name ?? t`the group`)
    : "";
  const activeDataRoomItems = useMemo(
    () => pendingItems.filter((ref) => ref.threadKey === (inGroup ? groupId : active?.id)),
    [active?.id, groupId, inGroup, pendingItems],
  );
  const activePendingAttachments = useMemo(
    () => attachmentsForThread(pendingAttachments, inGroup ? groupId : active?.id),
    [active?.id, groupId, inGroup, pendingAttachments],
  );
  const activeRoutines = !inGroup && routinesBotId === active?.id ? routines : [];
  const panelTarget = inGroup ? activeGroup?.id : active?.id;
  const panelStorageKey =
    // A page agent panel is not a saved bot panel: never restore or write one for it.
    userId && bootstrapMe?.spaceId && panelTarget && !pageMode
      ? rightPanelStorageKey(userId, bootstrapMe.spaceId, inGroup ? "group" : "bot", panelTarget)
      : null;
  panelStorageKeyRef.current = panelStorageKey;
  const activeTaughtSkills = taughtSkillsBotId === active?.id ? taughtSkills : [];
  const recordingSkill = activeTaughtSkills.find((skill) => skill.status === "recording") ?? null;
  const routePageMode = useRef(pageMode);
  routePageMode.current = pageMode;
  const routeBotId = useRef<string | undefined>(botId);
  routeBotId.current = botId;
  const routeGroupId = useRef<string | undefined>(groupId);
  routeGroupId.current = groupId;
  const activeBotId = useRef<string | undefined>(inGroup ? undefined : active?.id);
  activeBotId.current = inGroup ? undefined : active?.id;
  const activeGroupId = useRef<string | undefined>(groupId);
  activeGroupId.current = groupId;
  const screenRequest = useRef(0);
  const contextBot =
    botMenu?.kind === "bot" ? bots.find((bot) => bot.id === botMenu.id) : undefined;
  const contextGroup =
    botMenu?.kind === "group" ? groups.find((group) => group.id === botMenu.id) : undefined;
  const contextChat = contextBot ?? contextGroup;
  const closeBotMenu = useCallback(() => setBotMenu(null), []);
  const updateBotUnread = useCallback((id: string, unread: boolean) => {
    setBots((current) => {
      const bot = current.find((candidate) => candidate.id === id);
      if (!bot || bot.unread === unread) return current;
      return current.map((candidate) =>
        candidate.id === id ? { ...candidate, unread } : candidate,
      );
    });
  }, []);
  const markBotRead = useCallback(
    async (id: string) => {
      await rpc.threads.markRead({ botId: id });
      manuallyUnread.current.delete(id);
      updateBotUnread(id, false);
    },
    [updateBotUnread],
  );
  const markBotUnread = useCallback(
    async (id: string) => {
      manuallyUnread.current.add(id);
      try {
        await rpc.threads.markUnread({ botId: id });
      } catch (err) {
        manuallyUnread.current.delete(id);
        throw err;
      }
      updateBotUnread(id, true);
    },
    [updateBotUnread],
  );

  const refreshBots = useCallback(
    async (includeArchived = false, replaceBotOrder = false) => {
      markOnce("rk:renderer:bots-request-start");
      const request = ++botsRefreshEpoch.current;
      const botOrderEpoch = botOrderEpochRef.current;
      const archivedRequest = includeArchived ? ++archivedBotsRefreshEpoch.current : null;
      botsRefreshInFlight.current += 1;
      try {
        const [navigation, archived, archivedGroupList] = await Promise.all([
          rpc.spaces.list(),
          includeArchived ? rpc.bots.listArchived() : Promise.resolve(null),
          includeArchived ? rpc.groups.listArchived() : Promise.resolve(null),
        ]);
        const { bots: list, botSections: sections, groups: groupList } = navigation.current;
        markOnce("rk:renderer:bots-response");
        const botsFresh = request === botsRefreshEpoch.current;
        const archivedFresh =
          archivedRequest != null && archivedRequest === archivedBotsRefreshEpoch.current;
        // A newer non-archived refresh can win the bots epoch while an older
        // includeArchived request still owns archivedBotsRefreshEpoch — apply
        // whichever slices are still current.
        if (!botsFresh && !archivedFresh) return;
        if (archivedFresh && archived) setArchivedBots(archived);
        if (archivedFresh && archivedGroupList) setArchivedGroups(archivedGroupList);
        if (!botsFresh) return;
        let listApplied = false;
        // While a move is saving, a list loaded before it would put the old order back.
        const orderCurrent =
          botOrderEpoch === botOrderEpochRef.current && savingBotOrderRef.current === 0;
        if (orderCurrent || (replaceBotOrder && botOrderEpoch === botOrderEpochRef.current)) {
          setBots(list);
          botsListApplied.current = request;
          listApplied = true;
          setBotSections(sections);
          setGroups(groupList);
        }
        setSpaces(navigation.spaces);
        setInitialBotsLoaded(true);
        botsRefreshApplied.current = request;
        if (
          includeArchived &&
          list.length === 0 &&
          archived?.length === 0 &&
          groupList.length === 0 &&
          archivedGroupList?.length === 0 &&
          !navigation.spaces.some((space) => space.hasContent)
        ) {
          // Only the very first bot everywhere needs onboarding. An empty
          // current space with content elsewhere stays in the app so the
          // space can be switched to or deleted instead of trapping the user.
          navigate("/onboarding", { replace: true });
          return;
        }
        // A chat given up on while this refresh was slow is real after all.
        if (
          listApplied &&
          shouldClearMissingBot(
            missingPathRef.current,
            window.location.pathname,
            list,
            routeBotId.current,
          )
        ) {
          missingPathRef.current = null;
          setMissingPath(null);
        }
        // An unknown address keeps showing Page not found instead of jumping to a chat.
        if (missingPathRef.current === window.location.pathname) return;
        const currentGroupId = routeGroupId.current;
        if (currentGroupId) {
          if (!groupList.some((group) => group.id === currentGroupId)) {
            navigate(firstThreadRoute(list, groupList), { replace: true });
          }
          return;
        }
        // /app/inbox and /app/finance have no bot id by design; creating their agent refreshes the roster here.
        if (routePageMode.current) return;
        const currentBotId = routeBotId.current;
        if (!currentBotId || !list.some((bot) => bot.id === currentBotId)) {
          // Leave the route's bot only on a list that was stored, from a refresh that started after
          // the route changed; any other response may not know about it yet.
          if (currentBotId) {
            const start = routeBotStart.current;
            if (!listApplied || (start && start.id === currentBotId && request <= start.epoch)) {
              return;
            }
          }
          navigate(firstThreadRoute(list, groupList), { replace: true });
        }
      } finally {
        botsRefreshInFlight.current -= 1;
      }
    },
    [navigate],
  );
  useLayoutEffect(() => {
    routeBotStart.current = { id: botId, epoch: botsRefreshEpoch.current };
  }, [botId]);

  useGiveUpOnMissingBot(routeBot.waiting, botId, () => markMissing(window.location.pathname));
  // A route bot the list does not know yet (created on another page) gets one refresh before the
  // chat falls back to the first bot; the chat area keeps its loading state meanwhile.
  useEffect(() => {
    if (!routeBot.needsRefresh || !botId) return;
    const seen = { id: botId, epoch: botsRefreshEpoch.current };
    missingBotSeen.current = seen;
    refreshBots().catch(() => {
      // Do not wait forever on a failed refresh.
      seen.epoch = -1;
      rerenderAfterMissingBot();
    });
  }, [routeBot.needsRefresh, botId, refreshBots]);

  function snapTranscriptToEndAfterFrame() {
    const queuedElement = messageScroll.current;
    if (!queuedElement) return;
    const queuedScrollTop = queuedElement.scrollTop;
    window.requestAnimationFrame(() => {
      const element = messageScroll.current;
      if (transcriptCanSnapAfterFrame(element, queuedElement, queuedScrollTop)) {
        queuedElement.scrollTop = queuedElement.scrollHeight;
      }
    });
  }

  async function refreshGroupThread(id: string, signal?: AbortSignal) {
    const scrollElement = messageScroll.current;
    const stickToEnd = !scrollElement || transcriptIsNearEnd(scrollElement);
    markOnce("rk:renderer:thread-request-start");
    const request = ++groupRefreshEpoch.current;
    const snap = await rpc.threads.get({ groupId: id }, signal ? { signal } : undefined);
    markOnce("rk:renderer:thread-response");
    if (activeGroupId.current !== id || request !== groupRefreshEpoch.current) return snap;
    const reconciled = reconcileRefreshedThread(
      snapshotRef.current,
      snap,
      computerRef.current,
      expandedHistoryThread.current === snap.threadId,
    );
    commitSnapshot(reconciled.snapshot);
    if (!computerOpenRef.current) commitComputer(null);
    setRoutines([]);
    setRoutinesBotId(null);
    // Keep the search-jump viewport; expandedHistoryThread merge still accepts live messages.
    if (
      stickToEnd &&
      (!scrollElement || transcriptIsNearEnd(scrollElement)) &&
      expandedHistoryThread.current !== snap.threadId
    ) {
      snapTranscriptToEndAfterFrame();
    }
    return snap;
  }

  async function refreshThread(id: string, signal?: AbortSignal) {
    const scrollElement = messageScroll.current;
    const stickToEnd = !scrollElement || transcriptIsNearEnd(scrollElement);
    markOnce("rk:renderer:thread-request-start");
    const epoch = historyEpoch.current;
    const request = ++threadRefreshEpoch.current;
    // Apply threads.get as soon as it returns so stop/takeover status is not held behind
    // routines/skills/screen fetches (progress can advance the cursor meanwhile).
    const snap = await rpc.threads.get({ botId: id }, signal ? { signal } : undefined);
    markOnce("rk:renderer:thread-response");
    if (
      activeBotId.current !== id ||
      epoch !== historyEpoch.current ||
      request !== threadRefreshEpoch.current
    ) {
      return snap;
    }
    const reconciled = reconcileRefreshedThread(
      snapshotRef.current,
      snap,
      computerRef.current,
      expandedHistoryThread.current === snap.threadId,
    );
    commitSnapshot(reconciled.snapshot);
    commitComputer(reconciled.computer);
    cacheComputerFor(id, { computer: reconciled.computer });
    if (
      stickToEnd &&
      (!scrollElement || transcriptIsNearEnd(scrollElement)) &&
      expandedHistoryThread.current !== snap.threadId
    ) {
      snapTranscriptToEndAfterFrame();
    }
    void Promise.all([
      rpc.routines.list({ botId: id }).catch(() => null),
      rpc.skills.list({ botId: id }).catch(() => null),
      refreshComputerScreen(id).catch(() => null),
    ]).then(([routines, skills]) => {
      if (
        activeBotId.current !== id ||
        epoch !== historyEpoch.current ||
        request !== threadRefreshEpoch.current
      ) {
        return;
      }
      if (routines) {
        setRoutines(routines);
        setRoutinesBotId(id);
      }
      if (skills) {
        setTaughtSkills(skills);
        setTaughtSkillsBotId(id);
      }
    });
    return snap;
  }

  async function refreshComputerScreen(id: string) {
    if (!computerVisible.current) return null;
    const request = ++screenRequest.current;
    return loadComputerScreen({
      load: () => rpc.computer.screenUrl({ botId: id }),
      isCurrent: () =>
        request === screenRequest.current &&
        (activeBotId.current === id || computerBotIdRef.current === id) &&
        computerVisible.current,
      commit: (screen) => {
        setScreenUrl(screen.url);
        setComputerError(screen.error);
        setComputerErrorFromScreen(Boolean(screen.error));
        cacheComputerFor(id, { screenUrl: screen.url });
      },
      fallbackError: t`Could not connect to the computer screen`,
    });
  }

  async function loadOlderMessages() {
    const targetBotId = inGroup ? undefined : active?.id;
    const targetGroupId = inGroup ? groupId : undefined;
    const snapshotMatchesTarget = targetGroupId
      ? snapshot?.groupId === targetGroupId
      : snapshot?.botId === targetBotId;
    if (
      (!targetBotId && !targetGroupId) ||
      !snapshotMatchesTarget ||
      snapshot?.olderCursor == null ||
      loadingOlder
    )
      return;
    pinnedAroundRef.current = null;
    const scrollElement = messageScroll.current;
    const previousHeight = scrollElement?.scrollHeight ?? 0;
    const epoch = historyEpoch.current;
    const before = snapshot.olderCursor;
    setLoadingOlder(true);
    try {
      const page = await rpc.threads.messages({
        ...(targetGroupId ? { groupId: targetGroupId } : { botId: targetBotId! }),
        before,
      });
      if (
        epoch !== historyEpoch.current ||
        activeBotId.current !== targetBotId ||
        activeGroupId.current !== targetGroupId
      )
        return;
      expandedHistoryThread.current = page.threadId;
      updateSnapshot((prev) => prependThreadMessagePage(prev, page));
      window.requestAnimationFrame(() => {
        const element = messageScroll.current;
        if (element) element.scrollTop += element.scrollHeight - previousHeight;
      });
    } finally {
      setLoadingOlder(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const providerConfigRevision = memoryProviderConfigRevision.current;
    void rpc.memory
      .providerConfig()
      .then((providerConfig) => {
        if (!cancelled && memoryProviderConfigRevision.current === providerConfigRevision) {
          setMemoryProviderConfig(providerConfig);
        }
      })
      .catch(() => {
        if (!cancelled && memoryProviderConfigRevision.current === providerConfigRevision) {
          setMemoryProviderConfig(null);
        }
      });
    const appliedAtStart = botsRefreshApplied.current;
    void takeInitialBootstrap(botId)
      .then((bootstrap) => {
        if (cancelled) return;
        const groupList = bootstrap.groups;
        setBootstrapMe(bootstrap.me);
        // The saved choice belongs to the signed-in user; it replaces the last person's.
        setHideAmounts(bootstrap.me.hideAmounts ?? false);
        // Agents and new schedules use the user's zone; follow the browser without asking.
        const zone = timezoneToReport(bootstrap.me);
        if (zone) {
          void rpc.preferences
            .update({ timezone: zone })
            .then((nextMe) => {
              markTimezoneReported(nextMe.userId, zone);
              if (!cancelled) setBootstrapMe(nextMe);
            })
            .catch(() => undefined);
        } else markTimezoneReported(bootstrap.me.userId);
        // Skip list/route writes only if a later refreshBots() successfully
        // committed (failed refreshes bump epoch but not botsRefreshApplied).
        const applyBotLists = appliedAtStart === botsRefreshApplied.current;
        if (applyBotLists) {
          setBots(bootstrap.bots);
          setBotSections(bootstrap.botSections);
          setArchivedBots(bootstrap.archivedBots);
          setArchivedGroups(bootstrap.archivedGroups);
          setGroups(groupList);
          setSpaces(bootstrap.spaces);
          setInitialBotsLoaded(true);
        }
        if (!groupId && bootstrap.thread) {
          bootstrappedThread.current = bootstrap.thread;
          commitSnapshot(bootstrap.thread);
          commitComputer(bootstrap.thread.computer ?? null);
          setRoutines(bootstrap.routines);
          setRoutinesBotId(bootstrap.thread.botId ?? null);
          markOnce("rk:renderer:bots-response");
          markOnce("rk:renderer:thread-response");
        }
        if (!applyBotLists) return;
        if (
          bootstrap.bots.length === 0 &&
          bootstrap.archivedBots.length === 0 &&
          groupList.length === 0 &&
          bootstrap.archivedGroups.length === 0 &&
          !bootstrap.spaces.some((space) => space.hasContent)
        ) {
          navigate("/onboarding", { replace: true });
          return;
        }
        // A link from another of the person's spaces switches to that space and reloads.
        const otherSpaceId = spaceHoldingChat(
          bootstrap.spaces,
          bootstrap.me.spaceId,
          groupId ?? botId ?? "",
        );
        if (otherSpaceId && selectSpace(otherSpaceId)) {
          window.location.assign(window.location.pathname);
          return;
        }
        if (groupId) {
          if (!groupList.some((group) => group.id === groupId)) {
            markMissing(window.location.pathname);
          }
          return;
        }
        if (botId && !pageMode && !knownBotId(botId, bootstrap.bots, bootstrap.archivedBots)) {
          // Keep the address the person typed; only the page says it is not found.
          markMissing(window.location.pathname);
          return;
        }
        const selectedBotId = bootstrap.thread?.botId ?? bootstrap.bots[0]?.id;
        if (selectedBotId && selectedBotId !== botId && !pageMode) {
          navigate(`/app/${selectedBotId}`, { replace: true });
        }
      })
      .catch(() => {
        if (cancelled) return;
        setBootstrapMe(null);
        void refreshBots(true);
      });
    let refreshTimer: number | undefined;
    const refreshVisibleBots = () => {
      if (document.visibilityState !== "visible") return;
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => void refreshBots().catch(() => undefined), 50);
    };
    window.addEventListener("focus", refreshVisibleBots);
    document.addEventListener("visibilitychange", refreshVisibleBots);
    // Poll skips while a refresh is in flight; focus/visibility and event-driven
    // callers still bump botsRefreshEpoch so only the latest response applies.
    const poll = window.setInterval(() => {
      if (botsRefreshInFlight.current > 0) return;
      refreshVisibleBots();
    }, BOTS_POLL_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(refreshTimer);
      window.clearInterval(poll);
      window.removeEventListener("focus", refreshVisibleBots);
      document.removeEventListener("visibilitychange", refreshVisibleBots);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void rpc.agentSkills
      .list()
      .then((skills) => {
        if (!cancelled) setAgentSkills(skills);
      })
      .catch(() => {
        if (!cancelled) setAgentSkills([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const slashBotId = active?.id;
  const refreshAgentSkills = useCallback(() => {
    // The slash menu offers only the skills switched on for this bot.
    const skills = slashBotId
      ? rpc.agentSkills
          .forBot({ botId: slashBotId })
          .then((list) => list.filter((skill) => skill.enabled))
      : rpc.agentSkills.list();
    void skills.then(setAgentSkills).catch(() => undefined);
  }, [slashBotId]);

  // The routine form's skill picker lists this bot's enabled skills.
  useEffect(() => {
    if (panel === "routine") refreshAgentSkills();
  }, [panel, refreshAgentSkills]);

  useEffect(() => {
    void rpc.voice
      .status()
      .then(setVoiceStatus)
      .catch(() => undefined);
    const unsubSpeech = speaker.subscribe((state) => {
      setSpeakingMessageId(state.status === "idle" ? null : (state.messageId ?? null));
    });
    return () => {
      unsubSpeech();
    };
  }, []);

  useEffect(() => {
    if (!active || !snapshot || snapshot.botId !== active.id) return;
    const lastBot = [...snapshot.messages].reverse().find((message) => message.role === "bot");
    if (autoSpokenBotId.current !== active.id) {
      autoSpokenBotId.current = active.id;
      autoSpoken.current = lastBot?.id ?? null;
      return;
    }
    if (call?.botId === active.id || !active.autoSpeak) {
      autoSpoken.current = lastBot?.id ?? null;
      return;
    }
    if (snapshot.run && ["running", "queued", "leased"].includes(snapshot.run.status)) return;
    if (!lastBot || lastBot.id === autoSpoken.current) return;
    const text = speechFromBlocks(lastBot.blocks);
    if (!text) return;
    autoSpoken.current = lastBot.id;
    void speaker.speak(text, { botId: active.id, messageId: lastBot.id });
  }, [
    snapshot?.messages,
    snapshot?.run?.status,
    snapshot?.botId,
    active?.autoSpeak,
    active?.id,
    call?.botId,
  ]);

  useEffect(() => {
    if (!active) return;
    // Opening a bot clears the manual unread flag so it can auto-read again.
    manuallyUnread.current.delete(active.id);
  }, [active?.id]);

  useEffect(() => {
    if (!active) return;
    const pendingJump = searchParamsRef.current.get("m");
    if (!pendingJump) {
      pinnedAroundRef.current = null;
    }
    screenRequest.current += 1;
    setComputerError(null);
    setComputerErrorFromScreen(false);
    const cached = computerCacheRef.current.get(active.id);
    if (cached) {
      // Paint the last-known computer instantly; refreshThread/refreshComputerScreen
      // below still run and reconcile with fresh data in the background.
      setScreenUrl(cached.screenUrl);
      commitComputer(cached.computer);
    } else {
      setScreenUrl(null);
    }
    const cachedThread = threadCacheRef.current.get(active.id);
    if (cachedThread && snapshotRef.current?.botId !== active.id) commitSnapshot(cachedThread);
    expandedHistoryThread.current = null;
    historyEpoch.current += 1;
    const abort = new AbortController();
    void runThreadSubscription({
      signal: abort.signal,
      loadInitial: async () => {
        const primed = bootstrappedThread.current;
        bootstrappedThread.current = null;
        // Pending search jumps load the around-page separately; avoid replacing it with latest.
        return primed?.botId === active.id
          ? primed
          : pendingJump
            ? rpc.threads.get({ botId: active.id }, { signal: threadSnapshotSignal(abort.signal) })
            : refreshThread(active.id, threadSnapshotSignal(abort.signal));
      },
      loadHead: () =>
        rpc.threads.head({ botId: active.id }, { signal: threadSnapshotSignal(abort.signal) }),
      refresh: () => refreshThread(active.id, threadSnapshotSignal(abort.signal)),
      currentSnapshot: () => snapshotRef.current,
      subscribe: (cursor) =>
        rpc.threads.subscribe({ botId: active.id, cursor }, { signal: abort.signal }),
      beforeEvent: (event) => {
        if (isRunTerminalEvent(event) && event.runId) {
          terminalRunReceipts.current.add(event.runId);
          if (terminalRunReceipts.current.size > 100) {
            const oldest = terminalRunReceipts.current.values().next().value;
            if (oldest !== undefined) terminalRunReceipts.current.delete(oldest);
          }
        }
      },
      applyEvent: (event) =>
        applyThreadEvent(event, commitSnapshot, commitComputer, snapshotRef, computerRef),
      onEvent: (event, _initial) => {
        if (event.type === "page.updated") {
          const { revision, updatedBy } = event.payload as PageRemoteUpdate;
          setPageBotId(active.id);
          setPageRemote({ revision, updatedBy, seq: event.seq });
        }
        if (event.type === "pins.updated") setPinsSeq(event.seq);
        if (event.type === "thread.cleared") {
          expandedHistoryThread.current = null;
          pinnedAroundRef.current = null;
          historyEpoch.current += 1;
        }
        if (event.type === "run.phase") {
          // A phase changes often; patch the sidebar row instead of reloading the whole list.
          const runPhase = RunPhaseSchema.safeParse(event.payload).data;
          if (runPhase) {
            setBots((current) =>
              current.map((bot) => (bot.id === event.botId ? { ...bot, runPhase } : bot)),
            );
          }
        }
        if (event.type === "bot.archived") {
          void refreshBots(true).catch(() => undefined);
        } else if (
          event.type === "bot.spawned" ||
          event.type === "bot.deleted" ||
          rosterStatusChanged(event) ||
          event.type === "thread.cleared"
        ) {
          void refreshBots().catch(() => undefined);
        }
        if (event.type === "thread.message.created") {
          const blocks = (event.payload.blocks as Array<{ kind?: string }>) ?? [];
          if (blocks.some((block) => block.kind === "child_bot")) {
            void refreshBots().catch(() => undefined);
          }
        }
        if (
          isRunTerminalEvent(event) ||
          event.type === "run.waiting_input" ||
          event.type === "skill.teaching.stopped"
        ) {
          // waiting_input: reconcile ask cards if a stale post-send refresh raced SSE.
          void refreshThread(active.id).catch(() => undefined);
          setSkillsRefreshKey((key) => key + 1);
        } else if (isComputerStatusEvent(event)) {
          void refreshComputerScreen(active.id).catch(() => undefined);
        }
      },
    });
    return () => {
      abort.abort();
    };
  }, [active?.id]);

  useEffect(() => {
    setPageBotId(null);
    setPageRemote(null);
    if (!active?.id) return;
    const botId = active.id;
    let live = true;
    void rpc.pages
      .get({ botId })
      .then((page) => live && page && setPageBotId(botId))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [active?.id]);

  useEffect(() => {
    if (!groupId || !activeGroup) return;
    manuallyUnread.current.delete(activeGroup.id);
    const pendingJump = searchParamsRef.current.get("m");
    if (!pendingJump) {
      pinnedAroundRef.current = null;
      expandedHistoryThread.current = null;
    }
    historyEpoch.current += 1;
    const abort = new AbortController();
    void runThreadSubscription({
      signal: abort.signal,
      loadInitial: () =>
        pendingJump
          ? rpc.threads.get({ groupId }, { signal: threadSnapshotSignal(abort.signal) })
          : refreshGroupThread(groupId, threadSnapshotSignal(abort.signal)),
      loadHead: () => rpc.threads.head({ groupId }, { signal: threadSnapshotSignal(abort.signal) }),
      refresh: () => refreshGroupThread(groupId, threadSnapshotSignal(abort.signal)),
      currentSnapshot: () => snapshotRef.current,
      subscribe: (cursor) => rpc.threads.subscribe({ groupId, cursor }, { signal: abort.signal }),
      applyEvent: (event) =>
        applyThreadEvent(
          event,
          commitSnapshot,
          (next) => {
            if (isComputerStatusEvent(event) && event.botId !== computerBotIdRef.current) return;
            commitComputer(next);
          },
          snapshotRef,
          computerRef,
        ),
      onEvent: (event, _initial) => {
        if (rosterStatusChanged(event)) {
          void refreshBots().catch(() => undefined);
        }
        if (isRunTerminalEvent(event) || event.type === "run.waiting_input") {
          // waiting_input: reconcile ask cards if a stale post-send refresh raced SSE.
          void refreshGroupThread(groupId).catch(() => undefined);
        }
      },
    });
    return () => {
      abort.abort();
    };
  }, [activeGroup?.id, groupId]);

  const listedBots = useMemo(
    () => bots.filter((bot) => listedInSidebar(bot, botId)),
    [bots, botId],
  );
  const sidebarGroups = useMemo(() => {
    const sidebarSpaces =
      spaces.length > 0
        ? activeSpaceFirst(spaces, bootstrapMe?.spaceId).map((space) =>
            space.id === bootstrapMe?.spaceId
              ? { ...space, bots: listedBots, groups, botSections }
              : space,
          )
        : bootstrapMe
          ? [
              {
                id: bootstrapMe.spaceId,
                name: "Personal",
                isDefault: true,
                hasContent: true,
                canRename: false,
                canDelete: false,
                bots: listedBots,
                groups,
                botSections,
              },
            ]
          : [];
    // Only a space of one person goes without a heading; a shared space keeps its name and menu.
    const alone = spaces.length === 1 && spaces[0]?.memberCount === 1;
    return sidebarGroupsForSpaces(
      sidebarSpaces,
      "",
      bootstrapMe?.spaceId,
      alone ? null : t`Personal`,
    );
  }, [bootstrapMe, botSections, listedBots, groups, spaces, t]);
  // What the list shows now, so a drop can be turned into a move.
  const sidebarLayout = useMemo<SidebarLayout>(() => {
    const folders: string[] = [];
    const containers: Record<string, { kind: "bot" | "group"; id: string }[]> = {};
    for (const group of sidebarGroups) {
      if (group.spaceId !== bootstrapMe?.spaceId) continue;
      const visible = group.collapsed
        ? []
        : nestRosterByParent(group.bots, collapsedRosterParents).map(({ item }) => ({
            kind: item.kind,
            id: item.chat.id,
          }));
      if (group.kind === "folder" && group.sectionId) {
        folders.push(group.sectionId);
        containers[group.sectionId] = visible;
      } else if (group.kind === "root" || group.kind === "space") {
        containers[ROOT_CONTAINER] = visible;
      }
    }
    return { folders, containers };
  }, [sidebarGroups, bootstrapMe?.spaceId, collapsedRosterParents]);
  const sidebarDragLabel = useCallback(
    (dragId: string) => {
      const [kind, ...rest] = dragId.split(":");
      const id = rest.join(":");
      if (kind === "folder") return botSections.find((section) => section.id === id)?.name ?? "";
      if (kind === "bot") return bots.find((bot) => bot.id === id)?.name ?? "";
      if (kind === "group") return groups.find((group) => group.id === id)?.name ?? "";
      return dragId === "root-end" ? t`Personal` : "";
    },
    [bots, groups, botSections, t],
  );
  const sidebarDragOverlay = useCallback(
    (dragId: string) => {
      const [kind, ...rest] = dragId.split(":");
      const id = rest.join(":");
      const bot = kind === "bot" ? bots.find((candidate) => candidate.id === id) : undefined;
      const group = kind === "group" ? groups.find((candidate) => candidate.id === id) : undefined;
      return (
        <div className="flex w-fit max-w-full items-center gap-2.5 rounded-xl bg-sidebar-accent px-2.5 py-2 text-[14.5px] shadow-lg ring-1 ring-border">
          {bot ? (
            <AgentAvatar
              app={agentAppFor(bot.id, bot.spaceId)}
              color={bot.color}
              identity={bot.id}
              size={28}
              status={bot.status}
            />
          ) : group ? (
            <GroupAvatar members={group.members} size={28} />
          ) : null}
          <span dir="auto" className="truncate">
            {sidebarDragLabel(dragId)}
          </span>
        </div>
      );
    },
    [bots, groups, agentAppFor, sidebarDragLabel],
  );
  // After a space switch its header may sit below the fold; bring it into view.
  useEffect(() => {
    if (!bootstrapMe?.spaceId) return;
    document.querySelector("[data-sidebar-current]")?.scrollIntoView?.({ block: "nearest" });
  }, [bootstrapMe?.spaceId]);

  const openSpaceChat = useCallback(
    (spaceId: string, path: string) => {
      setMobileSidebarOpen(false);
      const previousSpaceId = selectedSpaceId();
      // Persist the active space (including primary) so voice/RPC headers match the chat.
      const selectionStored = selectSpace(spaceId);
      if (!selectionStored) return;
      const previousEffective = previousSpaceId ?? bootstrapMe?.spaceId;
      const boundaryChanged = previousEffective !== spaceId;
      // Soft-navigate within the same space; reload only when the auth boundary changes
      // so bootstrapped bots/groups match the request header.
      if (boundaryChanged) {
        window.location.assign(path);
        return;
      }
      navigate(path);
    },
    [bootstrapMe?.spaceId, navigate],
  );
  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  /**
   * Moves a chat into a folder (or the root) before another chat, showing the result at once and
   * loading the server's list again if it refuses.
   */
  const moveSidebarItem = useCallback(
    async (
      item: { kind: "bot" | "group"; id: string },
      folderId: string | null,
      beforeItem: { kind: "bot" | "group"; id: string } | null,
    ) => {
      const placed = [
        ...botsRef.current.map((bot) => ({ ...bot, kind: "bot" as const })),
        ...groupsRef.current.map((group) => ({ ...group, kind: "group" as const })),
      ];
      const plan = planSidebarMove(placed, { item, folderId, beforeItem });
      if (!plan) return;
      const placement = new Map(
        plan.map(({ item: moved, ...rest }) => [`${moved.kind}:${moved.id}`, rest] as const),
      );
      const apply = <T extends { id: string }>(list: T[], kind: "bot" | "group") =>
        list.map((entry) => {
          const next = placement.get(`${kind}:${entry.id}`);
          return next ? { ...entry, sectionId: next.sectionId, position: next.position } : entry;
        });
      botOrderEpochRef.current += 1;
      botsRef.current = apply(botsRef.current, "bot");
      groupsRef.current = apply(groupsRef.current, "group");
      setBots(botsRef.current);
      setGroups(groupsRef.current);
      savingBotOrderRef.current += 1;
      let saved = true;
      try {
        await rpc.sidebar.move({ item, folderId, beforeItem });
      } catch {
        saved = false;
      } finally {
        savingBotOrderRef.current -= 1;
      }
      // A refused move is undone by loading what the server has.
      if (!saved) await refreshBots(false, true).catch(() => undefined);
    },
    [refreshBots],
  );
  /** Runs a folder change with the result on screen first; the old folders come back on error. */
  const changeFolders = useCallback(
    async (apply: (sections: BotSection[]) => BotSection[], save: () => Promise<unknown>) => {
      const before = botSections;
      setBotSections(apply);
      try {
        await save();
      } catch {
        setBotSections(before);
      }
    },
    [botSections],
  );
  const dropSidebarItem = useCallback(
    (result: DropResult) => {
      if (result.type === "item") {
        void moveSidebarItem(result.item, result.folderId, result.beforeItem);
        return;
      }
      void changeFolders(
        (sections) => {
          const moving = sections.find((section) => section.id === result.folderId);
          if (!moving) return sections;
          const rest = sections.filter((section) => section !== moving);
          const at = result.beforeFolderId
            ? rest.findIndex((section) => section.id === result.beforeFolderId)
            : rest.length;
          return [...rest.slice(0, at), moving, ...rest.slice(at)].map((section, position) => ({
            ...section,
            position,
          }));
        },
        () =>
          rpc.sidebar.moveFolder({
            folderId: result.folderId,
            beforeFolderId: result.beforeFolderId,
          }),
      );
    },
    [moveSidebarItem, changeFolders],
  );
  const toggleFolder = useCallback(
    (sectionId: string, collapsed: boolean) =>
      changeFolders(
        (sections) =>
          sections.map((item) => (item.id === sectionId ? { ...item, collapsed } : item)),
        () => rpc.botSections.setCollapsed({ sectionId, collapsed }),
      ),
    [changeFolders],
  );
  const createFolder = useCallback(async () => {
    const taken = new Set(botSections.map((section) => section.name));
    const base = t`Untitled folder`;
    let name = base;
    for (let n = 2; taken.has(name); n += 1) name = `${base} ${n}`;
    try {
      const created = await rpc.botSections.add({ name });
      setBotSections((sections) => [...sections, created]);
      setEditingFolderId(created.id);
    } catch {
      await refreshBots().catch(() => undefined);
    }
  }, [botSections, refreshBots, t]);
  const renameFolder = useCallback(
    async (sectionId: string, name: string) => {
      setEditingFolderId(null);
      await changeFolders(
        (sections) => sections.map((item) => (item.id === sectionId ? { ...item, name } : item)),
        () => rpc.botSections.update({ sectionId, name }),
      );
    },
    [changeFolders],
  );
  const deleteFolder = useCallback(
    async (sectionId: string) => {
      try {
        await rpc.botSections.remove({ sectionId });
      } finally {
        await refreshBots().catch(() => undefined);
      }
    },
    [refreshBots],
  );
  const autoGroupSidebar = useCallback(async () => {
    try {
      const snapshot = await rpc.sidebar.autoGroup();
      if (snapshot.placements.length > 0) setFolderUndo(snapshot);
    } finally {
      await refreshBots(false, true).catch(() => undefined);
    }
  }, [refreshBots]);
  const undoAutoGroup = useCallback(async () => {
    const snapshot = folderUndo;
    setFolderUndo(null);
    if (!snapshot) return;
    try {
      await rpc.sidebar.restore(snapshot);
    } finally {
      await refreshBots(false, true).catch(() => undefined);
    }
  }, [folderUndo, refreshBots]);
  const hiddenPages = bootstrapMe?.hiddenPages ?? [];
  const [addedPages, setAddedPages] = useState<{ key: string; label: string }[]>([]);
  const toggleHiddenPage = useCallback(
    async (key: string) => {
      const before = bootstrapMe;
      if (!before) return;
      const current = before.hiddenPages ?? [];
      const hiddenPages = current.includes(key)
        ? current.filter((hidden) => hidden !== key)
        : [...current, key];
      setBootstrapMe({ ...before, hiddenPages });
      try {
        await rpc.preferences.update({ hiddenPages });
      } catch {
        setBootstrapMe(before);
      }
    },
    [bootstrapMe],
  );
  const toggleSidebarSection = useCallback(
    (key: string) => {
      setCollapsedSidebarSections((previous) =>
        toggleCollapsedIdSet(previous, key, collapsedSidebarSectionsStorageKey(userId)),
      );
    },
    [userId],
  );
  const toggleRosterParent = useCallback(
    (botId: string) => {
      setCollapsedRosterParents((previous) =>
        toggleCollapsedIdSet(previous, botId, collapsedRosterParentsStorageKey(userId)),
      );
    },
    [userId],
  );

  // App pages that search and the command palette can open (route under /app/).
  const appPages = useMemo(() => {
    const icon = { size: 15, strokeWidth: 1.8, "aria-hidden": true } as const;
    return [
      { id: "inbox", label: t`Inbox`, icon: <Mail {...icon} /> },
      { id: "finance", label: t`Finance`, icon: <ChartColumn {...icon} /> },
      {
        id: "legal",
        label: t`Legal`,
        keywords: t`contracts, NDA, deadlines`,
        icon: <Scale {...icon} />,
      },
      { id: "gtm", label: t`GTM`, icon: <Megaphone {...icon} /> },
      // Only once Devin is connected; before that its Integrations card is the way in.
      ...(glance.devinConnected
        ? [{ id: "devin", label: t`Devin`, icon: <CodeXml {...icon} /> }]
        : []),
      {
        id: "investors",
        label: t`Investors`,
        // Words a founder may type for this page; matched along with the label.
        keywords: t`cap table, equity, ownership, Carta`,
        icon: <PieChart {...icon} />,
      },
      {
        id: "fundraising",
        label: t`Fundraising`,
        keywords: t`safe, round, raise`,
        icon: <HandCoins {...icon} />,
      },
      { id: "contacts", label: t`Contacts`, icon: <BookUser {...icon} /> },
      { id: "data-room", label: t`Data room`, icon: <FolderOpen {...icon} /> },
      { id: "artifacts", label: t`Artifacts`, icon: <Files {...icon} /> },
      ...(bootstrapMe?.ticketBoardEnabled && glance.hasTickets
        ? [
            {
              id: "board",
              label: t`Task board`,
              keywords: t`tasks, tickets`,
              icon: <SquareKanban {...icon} />,
            },
          ]
        : []),
      {
        id: "integrations",
        label: t`Integrations`,
        keywords: t`apps, connections`,
        icon: <LayoutGrid {...icon} />,
      },
      { id: "settings", label: t`Settings`, icon: <Settings {...icon} /> },
    ];
  }, [t, bootstrapMe?.ticketBoardEnabled, glance.hasTickets, glance.devinConnected]);
  // A page hidden in Page options stays out of search and the command palette too.
  const visiblePages = useMemo(
    () => appPages.filter((page) => !hiddenPages.includes(page.id)),
    [appPages, hiddenPages],
  );
  const searchPaletteLinks = useCallback(
    async (q: string) => {
      const [found, contacts, chats] = await Promise.all([
        findDocumentsAndArtifacts(q),
        findContacts(q),
        findChats(q),
      ]);
      return [
        {
          heading: t`Contacts`,
          icon: <BookUser size={16} strokeWidth={1.75} />,
          entries: contacts.map((c) => ({
            id: `/app/contacts?q=${encodeURIComponent(c.id)}`,
            label: c.label,
            detail: c.detail,
          })),
        },
        {
          heading: t`Documents`,
          icon: <FileText size={16} strokeWidth={1.75} />,
          entries: found.documents.map((doc) => ({
            id: `/app/data-room?item=${encodeURIComponent(doc.id)}`,
            label: doc.label,
            detail: doc.detail,
          })),
        },
        { heading: t`Chats`, icon: <MessageSquare size={16} strokeWidth={1.75} />, entries: chats },
        {
          heading: t`Artifacts`,
          icon: <Files size={16} strokeWidth={1.75} />,
          entries: found.artifacts.map((item) => ({
            id: `/app/artifacts/${encodeURIComponent(item.id)}`,
            label: item.label,
            detail: item.detail,
          })),
        },
        {
          heading: t`Mail`,
          fallback: true,
          icon: <Search size={16} strokeWidth={1.75} />,
          entries: [
            { id: `/app/inbox?q=${encodeURIComponent(q)}`, label: t`Search mail for “${q}”` },
          ],
        },
      ];
    },
    [t],
  );

  function openSearchResult(path: string) {
    setMobileSidebarOpen(false);
    navigate(path);
  }

  /** Opens an entry of appPages; Settings is a dialog, not a route. */
  function openAppPage(id: string) {
    setMobileSidebarOpen(false);
    if (id === "settings") openSettings("general");
    else navigate(`/app/${id}`);
  }

  async function jumpToMessage(target: { botId?: string; groupId?: string; messageId: string }) {
    const threadTarget = searchHitThreadTarget(target);
    const epoch = historyEpoch.current;
    jumpGeneration.current += 1;
    const jumpId = jumpGeneration.current;
    const [snap, page] = await Promise.all([
      rpc.threads.get(threadTarget),
      rpc.threads.messages({ ...threadTarget, around: { messageId: target.messageId } }),
    ]);
    // The epoch check drops a jump that raced a conversation clear (or a bot switch): applying
    // the fetched page would pin deleted messages that every later refresh keeps restoring.
    // jumpId drops an older jump that finished after a newer click.
    if (epoch !== historyEpoch.current || jumpId !== jumpGeneration.current) return;
    if (target.groupId && activeGroupId.current !== target.groupId) return;
    if (target.botId && activeBotId.current !== target.botId) return;
    const targetInPage = userVisibleMessages(page.messages, { includePeerReceipts: true }).some(
      (message) => message.id === target.messageId,
    );
    expandedHistoryThread.current = targetInPage ? page.threadId : null;
    pinnedAroundRef.current = targetInPage
      ? {
          ...threadTarget,
          messageId: target.messageId,
          threadId: page.threadId,
          messages: page.messages,
          olderCursor: page.olderCursor,
        }
      : null;
    if (targetInPage) initiallyScrolledThread.current = page.threadId;
    commitSnapshot({
      ...snap,
      messages: targetInPage ? page.messages : snap.messages,
      olderCursor: targetInPage ? page.olderCursor : snap.olderCursor,
    });
    if (threadTarget.botId) {
      commitComputer(snap.computer ?? null);
      // Don't block parent-scroll on routines metadata; a list failure must not abort the jump.
      void rpc.routines
        .list({ botId: threadTarget.botId })
        .then((routines) => {
          if (epoch !== historyEpoch.current || jumpId !== jumpGeneration.current) return;
          if (activeBotId.current !== threadTarget.botId) return;
          setRoutines(routines);
          setRoutinesBotId(threadTarget.botId);
        })
        .catch(() => undefined);
    } else {
      commitComputer(null);
      setRoutines([]);
      setRoutinesBotId(null);
    }
    if (targetInPage) {
      // The transcript owns the scroll: it retries until the pinned row is
      // mounted and unfollows the tail, so live commits cannot cancel it.
      setScrollRequest({ messageId: target.messageId, nonce: jumpId });
    } else {
      window.requestAnimationFrame(() => {
        if (epoch !== historyEpoch.current || jumpId !== jumpGeneration.current) return;
        const element = messageScroll.current;
        if (element) {
          element.scrollTop = element.scrollHeight;
          initiallyScrolledThread.current = page.threadId;
        }
      });
    }
  }

  // The routine panel copies a routine's data into local draft state at click time
  // rather than deriving it from `active`, so it goes stale across a bot switch —
  // without this, Save on bot B could silently update bot A's routine.
  useEffect(() => {
    setEditingRoutine(null);
    setDeleteRoutineTarget(null);
    setPanelState((current) => (current === "routine" ? null : current));
  }, [active?.id]);

  // A link to /app?settings=privacy (agent replies use it for a missing AI consent) opens that switch.
  useEffect(() => {
    if (searchParams.get("settings") !== "privacy") return;
    openSettings("privacy");
    const next = new URLSearchParams(searchParams);
    next.delete("settings");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const messageId = searchParams.get("m");
    const routineId = searchParams.get("routine");
    if (inGroup && groupId && messageId) {
      void jumpToMessage({ groupId, messageId }).finally(() => {
        // Keep expandedHistoryThread; only strip the jump URL so refresh does not remount.
        const next = new URLSearchParams(searchParams);
        next.delete("m");
        setSearchParams(next, { replace: true });
      });
      return;
    }
    if (!active) return;
    if (routineId && routinesBotId === active.id) {
      const routine = routines.find((item) => item.id === routineId);
      if (routine) {
        setRoutineDraft(draftFromRoutine(routine));
        setRoutineWebhookSecret(null);
        setEditingRoutine(routine);
        setPanel("routine");
      } else {
        setPanel("computer");
      }
      const next = new URLSearchParams(searchParams);
      next.delete("routine");
      setSearchParams(next, { replace: true });
    }
    if (messageId) {
      void jumpToMessage({ botId: active.id, messageId }).finally(() => {
        const next = new URLSearchParams(searchParams);
        next.delete("m");
        setSearchParams(next, { replace: true });
      });
    }
  }, [active?.id, groupId, inGroup, routines, routinesBotId, searchParams, setSearchParams]);
  const activeSnapshot = inGroup
    ? snapshot?.groupId === groupId
      ? snapshot
      : null
    : snapshot?.botId === active?.id
      ? snapshot
      : null;
  // The transcript reports the last message the reader saw. Rows built from live events carry
  // event seqs, so the boundary is named by message id and resolved on the server.
  const readThreadUpTo = (messageId: string, toEnd: boolean) => {
    const id = inGroup ? groupId : active?.id;
    if (!id) return;
    const input = threadReadInput({
      target: inGroup ? { groupId: id } : { botId: id },
      pinned: pinnedAroundRef.current != null,
      manuallyUnread: manuallyUnread.current.has(id),
      messageId,
      toEnd,
    });
    if (!input) return;
    return rpc.threads.markRead(input).then(() => {
      if (!toEnd) return;
      if (!inGroup) {
        updateBotUnread(id, false);
        return;
      }
      setGroups((current) =>
        current.map((group) => (group.id === id ? { ...group, unread: false } : group)),
      );
    });
  };
  const sentHistory = useMemo(
    () =>
      (activeSnapshot?.messages ?? [])
        .filter((message) => message.role === "user" && !message.callId)
        .map((message) =>
          message.blocks
            .map((block) => (block.kind === "text" ? block.text : ""))
            .join("\n")
            .trim(),
        )
        .filter(Boolean),
    [activeSnapshot?.messages],
  );
  // Keep the armed reply even when its parent leaves the loaded page: the
  // server resolves a paged-out target and degrades a deleted one to a plain
  // reply instead of failing the send.
  const activeReplyTarget = replyTarget;
  const activeReplyQuote = replyTarget ? replyQuote : null;
  const clearReply = useCallback(() => {
    setReplyTarget(null);
    setReplyQuote(null);
  }, []);
  const currentRuns = activeThreadRuns(activeSnapshot);
  const answerableAskMessageId = latestAnswerableAskMessageId(activeSnapshot);
  const waitingOnApproval = Boolean(
    activeSnapshot?.delegatePending?.length ||
      (answerableAskMessageId &&
        activeSnapshot?.messages
          .find((message) => message.id === answerableAskMessageId)
          ?.blocks.some((block) => block.kind === "ask" && isApprovalAskBlock(block))),
  );
  const workingRuns = currentRuns.filter((run) =>
    ["running", "queued", "leased"].includes(run.status),
  );
  const transcriptRunning = workingRuns.length > 0;
  const soleWorkingRun = workingRuns.length === 1 ? workingRuns[0] : undefined;
  const soleWorkingActivity = soleWorkingRun
    ? workingActivity(soleWorkingRun, activeSnapshot?.messages ?? [])
    : undefined;
  const runResumedAt = useRunResumedAt(currentRuns);
  const workingStartedAt = soleWorkingRun
    ? (runResumedAt(soleWorkingRun.id) ??
      Date.parse(soleWorkingRun.startedAt ?? soleWorkingRun.createdAt))
    : undefined;
  const composerRunning = currentRuns.some((run) => isActive(run.status));
  const runError = threadRunError(activeSnapshot, dismissedRunErrorIds);
  const displayedRunError = !sendError ? runError : null;
  const displayedRunErrorId = displayedRunError ? (activeSnapshot?.run?.id ?? null) : null;
  const dismissedRunError = dismissedThreadRunError(activeSnapshot, dismissedRunErrorIds);
  const handleRunErrorPresented = useCallback((runId: string) => {
    rememberSeenRunErrorId(runId);
  }, []);
  const transcriptMessages = useMemo(
    () =>
      userVisibleMessages(activeSnapshot?.messages ?? [], {
        includePeerReceipts: true,
        collapseHandoffs: true,
      }),
    [activeSnapshot?.messages],
  );
  const transcriptArtifactTarget = useMemo<ArtifactTarget>(
    () => (inGroup ? { groupId: groupId ?? "" } : { botId: active?.id ?? "" }),
    [active?.id, groupId, inGroup],
  );
  const transcriptMembers = activeSnapshot?.members ?? activeGroup?.members;
  const resolveTranscriptBot = useCallback(
    (botId: string) => {
      const bot = bots.find((candidate) => candidate.id === botId);
      if (bot) return bot;
      return transcriptMembers?.find((member) => member.botId === botId);
    },
    [bots, transcriptMembers],
  );
  const workingBots: GroupAvatarMember[] = workingRuns.map((run) => {
    const bot = resolveTranscriptBot(run.botId);
    return {
      botId: run.botId,
      color: bot?.color ?? DEFAULT_BOT_COLOR,
      name: bot?.name,
      status: run.status,
    };
  });
  const resolveTranscriptMemberName = useCallback(
    (botId: string | undefined) => memberName(transcriptMembers, botId),
    [transcriptMembers],
  );
  const replyTargetName = activeReplyTarget
    ? activeReplyTarget.role === "user"
      ? t`You`
      : (resolveTranscriptMemberName(activeReplyTarget.botId) ?? active?.name ?? t`Bot`)
    : undefined;
  const composerMentionTargets = useMemo(
    () =>
      buildComposerMentionOptions({
        query: "",
        includeEveryone: inGroup,
        currentGroupId: groupId,
        currentBotId: inGroup ? null : active?.id,
        bots: bots.map((bot) => ({ id: bot.id, name: bot.name, color: bot.color })),
        groups: groups.map((group) => ({ id: group.id, name: group.name })),
        routines: mentionRoutines.map((routine) => ({
          id: routine.id,
          name: routine.name,
          crons: routine.crons,
          botId: routine.botId,
          botName: routine.botName,
        })),
        connectors: mentionConnectors,
      }),
    [active?.id, bots, groupId, groups, inGroup, mentionConnectors, mentionRoutines],
  );
  const shellReady =
    initialBotsLoaded &&
    (inGroup
      ? Boolean(activeGroup && activeSnapshot)
      : bots.length === 0 || pageMode || Boolean(active && activeSnapshot));
  const refreshThreadRef = useRef(refreshThread);
  refreshThreadRef.current = refreshThread;
  const refreshGroupThreadRef = useRef(refreshGroupThread);
  refreshGroupThreadRef.current = refreshGroupThread;
  const loadOlderMessagesRef = useRef(loadOlderMessages);
  loadOlderMessagesRef.current = loadOlderMessages;
  const jumpToMessageRef = useRef(jumpToMessage);
  jumpToMessageRef.current = jumpToMessage;

  const mentionBotsKey = useMemo(
    () => bots.map((bot) => `${bot.id}:${bot.name}`).join(","),
    [bots],
  );
  const botsForMentionsRef = useRef(bots);
  botsForMentionsRef.current = bots;

  const loadMentionConnectors = useCallback(() => {
    void Promise.all([
      rpc.connections.list().catch(() => []),
      rpc.connections.catalog({}).catch(() => []),
    ]).then(([connections, catalog]) => {
      const connected = connections.filter((row) => row.status === "connected");
      const options: Array<{
        id: string;
        name: string;
        authStatus: "connected" | "needs_auth";
        connectionId?: string;
      }> = connected.map((row) => ({
        id: row.id,
        name: row.displayName,
        authStatus: "connected" as const,
        connectionId: row.id,
      }));
      for (const item of catalog) {
        if (item.connected || item.noAuth) continue;
        if (
          connected.some(
            (row) =>
              row.provider.toLowerCase() === item.slug.toLowerCase() ||
              row.displayName.toLowerCase() === item.name.toLowerCase(),
          )
        ) {
          continue;
        }
        options.push({
          id: `catalog:${item.connectorId}:${item.slug}`,
          name: item.name,
          authStatus: "needs_auth" as const,
        });
      }
      setMentionConnectors(options);
    });
  }, []);

  useEffect(() => {
    const bots = botsForMentionsRef.current;
    if (!initialBotsLoaded || bots.length === 0) {
      setMentionRoutines([]);
      setMentionConnectors([]);
      return;
    }
    let cancelled = false;
    const botNameById = new Map(bots.map((bot) => [bot.id, bot.name]));
    void Promise.all(
      bots.map((bot) =>
        rpc.routines
          .list({ botId: bot.id })
          .then((rows) =>
            rows.map((routine) => ({
              ...routine,
              botName: botNameById.get(bot.id) ?? bot.name,
            })),
          )
          .catch(() => [] as Array<Routine & { botName?: string }>),
      ),
    ).then((lists) => {
      if (!cancelled) setMentionRoutines(lists.flat());
    });
    return () => {
      cancelled = true;
    };
  }, [initialBotsLoaded, mentionBotsKey]);

  useLayoutEffect(() => {
    if (initialBotsLoaded) {
      markOnce("rk:renderer:bots-committed");
      markAfterPaint("rk:renderer:bots-painted");
    }
    if (active && snapshot?.botId === active.id) {
      markOnce("rk:renderer:thread-committed");
      markAfterPaint("rk:renderer:thread-painted");
    }
    if (shellReady) {
      markOnce("rk:renderer:shell-ready");
      markAfterPaint("rk:renderer:shell-painted");
    }
  }, [active, initialBotsLoaded, shellReady, snapshot?.botId]);

  useLayoutEffect(() => {
    const pin = pinnedAroundRef.current;
    if (inGroup) {
      if (!groupId || !snapshot || snapshot.groupId !== groupId) return;
      if (initiallyScrolledThread.current === snapshot.threadId) return;
      if (expandedHistoryThread.current === snapshot.threadId) return;
      if (pin?.groupId === groupId) return;
    } else {
      if (!active || !snapshot || snapshot.botId !== active.id) return;
      if (initiallyScrolledThread.current === snapshot.threadId) return;
      if (expandedHistoryThread.current === snapshot.threadId) return;
      if (pin?.botId === active.id) return;
    }
    const element = messageScroll.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
    initiallyScrolledThread.current = snapshot.threadId;
  }, [active, groupId, inGroup, snapshot?.botId, snapshot?.groupId, snapshot?.threadId]);

  const openBot = useCallback((id: string) => navigate(`/app/${id}`), [navigate]);
  // Contacts and Artifacts have no agent of their own: their Ask opens Chief, the first bot.
  const chiefId = bots.find((bot) => bot.spawnKey === FIRST_BOT_SPAWN_KEY && !bot.archivedAt)?.id;
  // Chief's app cards come first; the tour starts once one is connected or another page is open.
  const connectCardsWaiting =
    active?.id === chiefId &&
    snapshot?.botId === chiefId &&
    connectCardsOpen(snapshot?.messages ?? []);
  const tourOpen =
    tourRestart ||
    (bootstrapMe?.tourSeen === false &&
      !tourEnded &&
      bots.length > 0 &&
      !firstQuestionOpen &&
      !connectCardsWaiting);
  // On a phone the tour points into the sidebar drawer, so open it while the tour runs. On a
  // docked sidebar the tour card is as wide as the sidebar, so a collapsed rail is expanded
  // (for this session only; the saved preference is unchanged).
  useEffect(() => {
    if (!tourOpen) return;
    if (window.matchMedia("(min-width: 1024px)").matches) setBotsSidebarCollapsed(false);
    else setMobileSidebarOpen(true);
  }, [tourOpen]);
  const askChief = chiefId ? () => openBot(chiefId) : undefined;

  async function startElioCall() {
    if (voiceCallStarting.current) return;
    if (!voiceStatus?.ready) {
      openSettings("voice");
      setSettingsNotice(t`Connect a voice provider to call Elio.`);
      return;
    }
    const originBotId = activeBotId.current;
    const originSpaceId = selectedSpaceId();
    voiceCallStarting.current = true;
    try {
      const elio = await rpc.voice.agent();
      if (
        !voiceCallMounted.current ||
        activeBotId.current !== originBotId ||
        selectedSpaceId() !== originSpaceId
      )
        return;
      setBots((current) =>
        current.some((bot) => bot.id === elio.id) ? current : [...current, elio],
      );
      openBot(elio.id);
      startCall({
        botId: elio.id,
        botName: elio.name,
        botColor: elio.color,
        transcribe: Boolean(voiceStatus.transcribe),
      });
    } catch (error) {
      if (
        voiceCallMounted.current &&
        activeBotId.current === originBotId &&
        selectedSpaceId() === originSpaceId
      ) {
        setSendError(errorText(error, t`Could not start the call`));
      }
    } finally {
      voiceCallStarting.current = false;
    }
  }
  const loadOlder = useCallback(() => loadOlderMessagesRef.current(), []);
  const jumpToReplyMessage = useCallback((messageId: string) => {
    const existing = document.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`);
    if (existing) {
      // Cancel any in-flight around-fetch so it cannot overwrite this scroll.
      jumpGeneration.current += 1;
      setScrollRequest({ messageId, nonce: jumpGeneration.current });
      return;
    }
    const groupId = activeGroupId.current;
    if (groupId) {
      void jumpToMessageRef.current({ groupId, messageId }).catch(() => undefined);
      return;
    }
    const botId = activeBotId.current;
    if (botId) void jumpToMessageRef.current({ botId, messageId }).catch(() => undefined);
  }, []);
  const sentHere = useRef(false);
  const agentSendWatch = useRef(createAgentSendWatch());
  useEffect(() => agentSendWatch.current.running(transcriptRunning), [transcriptRunning]);
  const answerMessage = useCallback(
    async (message: ThreadMessage, text: string, username?: string, mail?: MailEdits) => {
      const botId = activeBotId.current;
      const groupId = activeGroupId.current;
      if (!botId && !groupId) return;
      if (
        text === "allow" &&
        message.blocks.some((block) => block.kind === "ask" && block.mail?.tool === "mail_send")
      )
        agentSendWatch.current.sendApproved();
      await rpc.threads.answer({
        ...(groupId ? { groupId } : { botId: botId! }),
        runId: message.runId ?? "",
        messageId: message.id,
        answer: text,
        ...(username ? { username } : {}),
        ...(mail ? { mail } : {}),
      });
      dismissApprovalToasts(
        groupId ? { href: `/app/g/${groupId}` } : { href: `/app/${botId}`, botId },
      );
      if (groupId && activeGroupId.current === groupId) {
        await refreshGroupThreadRef.current(groupId);
      } else if (botId && activeBotId.current === botId) {
        await refreshThreadRef.current(botId);
      }
    },
    [],
  );
  const [composerDraft, setComposerDraft] = useState<ComposerDraft | null>(null);
  // The Space the open composer was started in, kept for its save and send calls.
  const [composerSpaceId, setComposerSpaceId] = useState<string | null>(null);
  // The From choices when a failed send named none: the composer shows a picker for them.
  const [composerAccounts, setComposerAccounts] = useState<
    Awaited<ReturnType<typeof rpc.inbox.list>>["accounts"] | null
  >(null);
  const composerScopeRef = useRef({ userId, spaceId: bootstrapMe?.spaceId });
  composerScopeRef.current = { userId, spaceId: bootstrapMe?.spaceId };
  const botToolControls = useMemo<BotToolControls>(
    () => ({
      openComposer: (draft) => {
        setComposerAccounts(null);
        // Pinned to the Space of the thread the failed send is in, not the shared selection.
        const botId = activeBotId.current;
        const groupId = activeGroupId.current;
        const threadSpace = groupId
          ? groupsRef.current.find((group) => group.id === groupId)?.spaceId
          : botsRef.current.find((bot) => bot.id === botId)?.spaceId;
        const origin = {
          userId: composerScopeRef.current.userId,
          spaceId: composerScopeRef.current.spaceId,
          selected: selectedSpaceId(),
        };
        const spaceId = threadSpace ?? origin.spaceId ?? null;
        setComposerSpaceId(spaceId);
        if (draft.connectionId) return setComposerDraft(draft);
        void recoverComposerDraft(
          draft,
          spaceId,
          (space) => rpc.inbox.list({}, { context: { spaceId: space } }),
          () =>
            composerScopeRef.current.userId === origin.userId &&
            composerScopeRef.current.spaceId === origin.spaceId &&
            selectedSpaceId() === origin.selected,
        ).then((recovered) => {
          if (!recovered) return;
          setComposerAccounts(recovered.accounts);
          setComposerDraft(recovered.draft);
        });
      },
      editableBotName: (botId) => botsRef.current.find((bot) => bot.id === botId)?.name,
      disableTool: async (botId, tool) => {
        const bot = botsRef.current.find((item) => item.id === botId);
        if (!bot) return;
        const disabledBuiltinTools = bot.disabledBuiltinTools.includes(tool)
          ? bot.disabledBuiltinTools
          : [...bot.disabledBuiltinTools, tool];
        const updated = await rpc.bots.update({ botId, disabledBuiltinTools });
        setBots((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      },
    }),
    [],
  );
  const reactToMessage = useCallback(
    async (message: ThreadMessage, reaction: MessageReaction) => {
      const botId = activeBotId.current;
      const groupId = activeGroupId.current;
      if (!botId && !groupId) return;
      try {
        await rpc.threads.react({
          ...(groupId ? { groupId } : { botId: botId! }),
          messageId: message.id,
          reaction,
          clientNonce: newClientId(),
        });
      } catch (error) {
        const stillHere = groupId
          ? activeGroupId.current === groupId
          : activeBotId.current === botId;
        if (!stillHere) return;
        setSendError(errorText(error, t`Could not update reaction`));
      }
    },
    [t],
  );
  const remember = useRememberedMessages(
    { botId: inGroup ? undefined : active?.id, groupId },
    useCallback((error: unknown) => setSendError(errorText(error, t`Could not remember`)), [t]),
  );
  const onAttachmentPick = useCallback(
    (files: ArrayLike<File> | null, targetThreadKey?: string) => {
      const threadKey = targetThreadKey ?? activeGroupId.current ?? activeBotId.current;
      if (!threadKey || !files?.length) return false;
      const existing = attachmentsForThread(pendingAttachments, threadKey);
      const next: PendingAttachment[] = [];
      const skipped: string[] = [];
      for (const file of Array.from(files)) {
        if (existing.length + next.length >= ATTACHMENT_MAX_COUNT) {
          skipped.push(t`${file.name} (max ${ATTACHMENT_MAX_COUNT} attachments)`);
          continue;
        }
        if (file.size > ATTACHMENT_MAX_BYTES) {
          skipped.push(t`${file.name} (over 10 MB)`);
          continue;
        }
        const mimeType = inferAttachmentMimeType(file.name, file.type);
        if (!mimeType) {
          skipped.push(file.name);
          continue;
        }
        next.push({
          id: `${file.name}-${file.size}-${file.lastModified}-${next.length}`,
          threadKey,
          file,
          previewUrl: mimeType.startsWith("image/") ? URL.createObjectURL(file) : undefined,
        });
      }
      if (next.length) setPendingAttachments((current) => [...current, ...next]);
      setAttachmentNotice(skipped.length ? t`Skipped ${skipped.join(", ")}` : null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return next.length > 0;
    },
    [pendingAttachments, t],
  );
  const removeAttachment = useCallback((attachment: PendingAttachment) => {
    revokePendingAttachmentPreviews([attachment]);
    setPendingAttachments((current) => current.filter((item) => item.id !== attachment.id));
  }, []);
  const sendFilesToAgent = useCallback(
    async (items: DataRoomApiItem[], agent: SendTarget) => {
      const bot = botsRef.current.find((candidate) => candidate.id === agent.id);
      if (!bot) return;
      const { refs, copies } = planSendToAgent(bot, items);
      if (refs.length) {
        setPendingItems((current) => [
          ...current.filter(
            (ref) => ref.threadKey !== bot.id || !refs.some((item) => item.id === ref.id),
          ),
          ...refs.map(({ id, name, mimeType }) => ({ id, name, mimeType, threadKey: bot.id })),
        ]);
      }
      // The attachment notice belongs to the thread that opens next.
      keepNoticeFor.current = bot.id;
      navigate(`/app/${bot.id}`);
      if (!copies.length) return;
      const files: File[] = [];
      const failed: string[] = [];
      for (const item of copies) {
        try {
          files.push(new File([await fetchDataRoomBlob(item)], item.name, { type: item.mimeType }));
        } catch {
          failed.push(item.name);
        }
      }
      onAttachmentPick(files, bot.id);
      if (failed.length) setAttachmentNotice(t`Skipped ${failed.join(", ")}`);
    },
    [navigate, onAttachmentPick, t],
  );
  const removeDataRoomItem = useCallback((ref: DataRoomRef) => {
    setPendingItems((current) => current.filter((item) => item !== ref));
  }, []);
  const sendMessage = useCallback(
    async (text: string, mentions: ComposerMention[], clientNonce: string) => {
      const initialBotTarget = activeBotId.current;
      const initialGroupTarget = activeGroupId.current;
      if ((!initialBotTarget && !initialGroupTarget) || sending) return false;
      const originThreadKey = initialGroupTarget ?? initialBotTarget;
      const attachments = attachmentsForThread(pendingAttachments, originThreadKey);
      const dataRoomItems = pendingItems.filter((ref) => ref.threadKey === originThreadKey);
      const plan = resolveComposerSendPlan({
        text,
        mentions,
        hasAttachments: attachments.length > 0 || dataRoomItems.length > 0,
      });
      if (plan.isNoOp) return false;
      const reroutedToGroup = Boolean(
        plan.rerouteGroupId && plan.rerouteGroupId !== initialGroupTarget,
      );
      const groupTarget = plan.rerouteGroupId ?? initialGroupTarget;
      const botTarget = reroutedToGroup ? undefined : initialBotTarget;
      if (
        plan.shouldSend &&
        (groupTarget || botsRef.current.find((bot) => bot.id === botTarget)?.notifyOnFinish)
      ) {
        void requestBrowserNotificationPermission();
      }
      const trimmed = plan.trimmed;
      sendingRef.current = true;
      setSending(true);
      setSendError(null);
      setForwarded(null);
      // Keep the draft cleared once any part of the submission is confirmed accepted.
      let accepted = false;
      try {
        if (plan.shouldRunRoutines) {
          // Settle every run first so one that was accepted is never repeated.
          const runs = await Promise.allSettled(
            plan.routineIds.map((routineId) =>
              rpc.routines.testRun({
                routineId,
                clientNonce: `routine-mention:${clientNonce}:${routineId}`,
              }),
            ),
          );
          accepted = runs.some((run) => run.status === "fulfilled");
          for (const run of runs) if (run.status === "rejected") throw run.reason;
        }
        if (!plan.shouldSend) {
          clearReply();
          revokePendingAttachmentPreviews(attachments);
          setPendingAttachments((current) =>
            current.filter((attachment) => attachment.threadKey !== originThreadKey),
          );
          setPendingItems((current) => current.filter((ref) => ref.threadKey !== originThreadKey));
          setAttachmentNotice(null);
          if (reroutedToGroup && groupTarget) {
            showForwarded(groupTarget, originThreadKey);
            return true;
          }
          if (groupTarget && activeGroupId.current === groupTarget) {
            await refreshGroupThreadRef.current(groupTarget);
          } else if (botTarget && activeBotId.current === botTarget) {
            await refreshThreadRef.current(botTarget);
          }
          return true;
        }
        const artifactIds: string[] = [];
        for (const pending of attachments) {
          const mimeType = inferAttachmentMimeType(pending.file.name, pending.file.type);
          if (!mimeType) {
            throw new Error(t`Unsupported file type: ${pending.file.name}`);
          }
          const contentBase64 = await readFileAsBase64(pending.file);
          const artifact = await rpc.artifacts.create(
            groupTarget
              ? { groupId: groupTarget, name: pending.file.name, mimeType, contentBase64 }
              : { botId: botTarget!, name: pending.file.name, mimeType, contentBase64 },
          );
          artifactIds.push(artifact.id);
        }
        // The transcript follows the message this composer sends, not one that arrives from elsewhere.
        sentHere.current = true;
        if (groupTarget) {
          await rpc.threads.send({
            groupId: groupTarget,
            clientNonce,
            text: trimmed || undefined,
            mentions: plan.mentionPayload.length ? plan.mentionPayload : undefined,
            artifactIds: artifactIds.length ? artifactIds : undefined,
            replyToMessageId: reroutedToGroup ? undefined : activeReplyTarget?.id,
            replyQuote: reroutedToGroup ? undefined : (activeReplyQuote ?? undefined),
          });
          accepted = true;
        } else if (botTarget) {
          const sent = await rpc.threads.send({
            botId: botTarget,
            clientNonce,
            text: trimmed || undefined,
            mentions: plan.mentionPayload.length ? plan.mentionPayload : undefined,
            artifactIds: artifactIds.length ? artifactIds : undefined,
            dataRoomItemIds: dataRoomItems.length ? dataRoomItems.map((ref) => ref.id) : undefined,
            replyToMessageId: activeReplyTarget?.id,
            replyQuote: activeReplyQuote ?? undefined,
          });
          accepted = true;
          if (activeBotId.current === botTarget) {
            updateSnapshot((current) =>
              applyThreadSendReceipt(
                current,
                {
                  botId: botTarget,
                  runId: sent.runId,
                  taskId: sent.taskId,
                },
                terminalRunReceipts.current,
              ),
            );
          }
        }
        clearReply();
        revokePendingAttachmentPreviews(attachments);
        setPendingAttachments((current) =>
          current.filter((attachment) => attachment.threadKey !== originThreadKey),
        );
        setPendingItems((current) => current.filter((ref) => ref.threadKey !== originThreadKey));
        void refreshBots().catch(() => undefined);
        if (reroutedToGroup && groupTarget) {
          showForwarded(groupTarget, originThreadKey);
          return true;
        }
        if (groupTarget && activeGroupId.current === groupTarget) setAttachmentNotice(null);
        if (botTarget && activeBotId.current === botTarget) setAttachmentNotice(null);
        if (groupTarget) void refreshGroupThreadRef.current(groupTarget).catch(() => undefined);
        else if (botTarget) void refreshThreadRef.current(botTarget).catch(() => undefined);
        return true;
      } catch (error) {
        sentHere.current = false;
        if (reroutedToGroup && groupTarget) {
          setSendError(errorText(error, t`Failed to send message`));
        } else if (groupTarget && activeGroupId.current === groupTarget) {
          setSendError(errorText(error, t`Failed to send message`));
        } else if (botTarget && activeBotId.current === botTarget) {
          setSendError(errorText(error, t`Failed to send message`));
        }
        return accepted;
      } finally {
        sendingRef.current = false;
        setSending(false);
      }
    },
    [
      activeReplyTarget?.id,
      activeReplyQuote,
      clearReply,
      navigate,
      pendingAttachments,
      pendingItems,
      sending,
      t,
    ],
  );
  const stopRun = useCallback(async (): Promise<boolean> => {
    if (sending) return false;
    sendingRef.current = true;
    setSending(true);
    try {
      const botTarget = activeBotId.current;
      const groupTarget = activeGroupId.current;
      if (groupTarget) {
        setSendError(null);
        try {
          await rpc.threads.stop({ groupId: groupTarget });
        } catch (error) {
          if (activeGroupId.current === groupTarget) {
            setSendError(errorText(error, t`Failed to stop`));
          }
          return false;
        }
        // Clear run UI ahead of the run.cancelled event so refresh races with in-flight gets.
        if (activeGroupId.current === groupTarget) {
          updateSnapshot((prev) =>
            prev && prev.groupId === groupTarget ? clearActiveThreadRuns(prev) : prev,
          );
        }
        await refreshGroupThreadRef.current(groupTarget).catch(() => undefined);
        return true;
      }
      if (!botTarget) return false;
      setSendError(null);
      try {
        await rpc.threads.stop({ botId: botTarget });
      } catch (error) {
        if (activeBotId.current === botTarget) {
          setSendError(errorText(error, t`Failed to stop`));
        }
        return false;
      }
      // Clear local run/busy immediately rather than waiting for run.cancelled so a
      // superseded in-flight refresh (older cursor) cannot leave Stop enabled / Take control
      // blocked while the API is already idle.
      if (activeBotId.current === botTarget) {
        updateSnapshot((prev) =>
          !prev || (prev.botId !== botTarget && prev.botId) ? prev : clearActiveThreadRuns(prev),
        );
        const currentComputer = computerRef.current;
        if (currentComputer?.busyBotName) {
          commitComputer({ ...currentComputer, busyBotName: null });
        }
      }
      await refreshThreadRef.current(botTarget).catch(() => undefined);
      return true;
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }, [sending, t]);
  const stopTeaching = useCallback(async () => {
    const id = activeBotId.current;
    if (!id || teachBusy) return;
    const recording = taughtSkills.find(
      (skill) => skill.status === "recording" && taughtSkillsBotId === id,
    );
    if (!recording) return;
    setTeachBusy(true);
    try {
      await rpc.skills.stop({ skillId: recording.id });
      await refreshThreadRef.current(id);
      setComputerOpen(false);
    } finally {
      setTeachBusy(false);
    }
  }, [teachBusy, taughtSkills, taughtSkillsBotId]);
  // Transcript and MessageView are memoized; these must stay referentially stable or every
  // Shell state change re-renders the whole transcript.
  const refreshActiveThread = useCallback(async () => {
    const groupId = activeGroupId.current;
    if (groupId) {
      await refreshGroupThreadRef.current(groupId);
      return;
    }
    const id = activeBotId.current;
    if (!id) return;
    await refreshThreadRef.current(id);
  }, []);
  // Teach chrome needs skills applied before this resolves — refreshThread only
  // kicks skills.list off in the background, so Stop teaching would never mount
  // if that background call failed or lagged behind local recovery.
  const refreshActiveTeaching = useCallback(async () => {
    const id = activeBotId.current;
    if (!id) return;
    await refreshThreadRef.current(id);
    const skills = await rpc.skills.list({ botId: id });
    if (activeBotId.current !== id) return;
    setTaughtSkills(skills);
    setTaughtSkillsBotId(id);
  }, []);
  const addSkillRoutine = useCallback((name: string, prompt: string) => {
    setRoutineDraft({ ...emptyRoutineDraft(), name, prompt });
    setRoutineWebhookSecret(null);
    setEditingRoutine(null);
    setPanel("routine");
  }, []);
  const speakingMessageIdRef = useRef(speakingMessageId);
  speakingMessageIdRef.current = speakingMessageId;
  const speakMessage = useCallback((message: ThreadMessage) => {
    if (speakingMessageIdRef.current === message.id) {
      speaker.stop();
      return;
    }
    const text = speechFromBlocks(message.blocks);
    const id = message.botId ?? activeBotId.current;
    if (text && id) void speaker.speak(text, { botId: id, messageId: message.id });
  }, []);

  async function createGroup(input: { name: string; botIds: string[] }) {
    const group = await rpc.groups.create(input);
    setGroups((current) =>
      current.some((item) => item.id === group.id) ? current : [group, ...current],
    );
    navigate(`/app/g/${group.id}`);
    setPanel(null);
    await refreshBots().catch(() => undefined);
  }

  function setInboxAgentCollapsedPref(collapsed: boolean) {
    setInboxAgentCollapsed(collapsed);
    writeInboxAgentCollapsed(userId, collapsed);
  }

  function setCartaAgentCollapsedPref(collapsed: boolean) {
    setCartaAgentCollapsed(collapsed);
    writeCartaAgentCollapsed(userId, collapsed);
  }

  async function createFinanceAgent() {
    setCreatingFinanceAgent(true);
    setFinanceAgentError("");
    try {
      await rpc.finance.agent();
      await refreshBots();
    } catch (error) {
      setFinanceAgentError(errorText(error, t`Could not create the Finance agent`));
    } finally {
      setCreatingFinanceAgent(false);
    }
  }

  async function createDataRoomAgent() {
    setCreatingDataRoomAgent(true);
    setDataRoomAgentError("");
    try {
      await rpc.dataRoom.agent();
      await refreshBots();
    } catch (error) {
      setDataRoomAgentError(errorText(error, t`Could not create the Data room agent`));
    } finally {
      setCreatingDataRoomAgent(false);
    }
  }

  function askDataRoomAgent() {
    setDataRoomAgentOpen(true);
    if (!active && !creatingDataRoomAgent) void createDataRoomAgent();
  }

  async function createLegalAgent() {
    setCreatingLegalAgent(true);
    setLegalAgentError("");
    try {
      await rpc.legal.agent();
      await refreshBots();
    } catch (error) {
      setLegalAgentError(errorText(error, t`Could not create the Legal agent`));
    } finally {
      setCreatingLegalAgent(false);
    }
  }

  async function createDevinAgent() {
    setCreatingDevinAgent(true);
    setDevinAgentError("");
    try {
      const agent = await rpc.devin.agent();
      setDevinAgentId(agent?.bot.id ?? null);
      await refreshBots();
    } catch (error) {
      setDevinAgentError(errorText(error, t`Could not create the Devin agent`));
    } finally {
      setCreatingDevinAgent(false);
    }
  }

  function askDevinAgent() {
    setDevinAgentOpen(true);
    if (!active && !creatingDevinAgent) void createDevinAgent();
  }

  function askLegalAgent() {
    setLegalAgentOpen(true);
    if (!active && !creatingLegalAgent) void createLegalAgent();
  }

  async function createGtmAgent() {
    setCreatingGtmAgent(true);
    setGtmAgentError("");
    try {
      await rpc.gtm.agent();
      await refreshBots();
    } catch (error) {
      setGtmAgentError(errorText(error, t`Could not create the GTM agent`));
    } finally {
      setCreatingGtmAgent(false);
    }
  }

  function askGtmAgent() {
    setGtmAgentOpen(true);
    if (!active && !creatingGtmAgent) void createGtmAgent();
  }

  const gtmAgentAsked = useRef<string | null>(null);
  const gtmAgentScope =
    gtmMode && initialBotsLoaded && userId ? `${bootstrapMe?.spaceId}:${userId}` : null;
  useEffect(() => {
    if (!gtmAgentScope) {
      gtmAgentAsked.current = null;
      return;
    }
    if (active || gtmAgentAsked.current === gtmAgentScope) return;
    gtmAgentAsked.current = gtmAgentScope;
    void createGtmAgent();
  });

  /** A row's Ask agent: opens the panel and sends the question. Before the agent exists it only creates it. */
  function askLegalAgentAbout(question: string) {
    askLegalAgent();
    if (active) void sendMessage(question, [], newClientId());
  }

  async function createCartaAgent() {
    setCreatingCartaAgent(true);
    setCartaAgentError("");
    try {
      await rpc.carta.agent();
      await refreshBots();
    } catch (error) {
      setCartaAgentError(errorText(error, t`Could not create the Carta agent`));
      return false;
    } finally {
      setCreatingCartaAgent(false);
    }
  }

  function askInvestorsAgent() {
    setCartaAgentCollapsedPref(false);
    // The agent may have been archived since the page opened.
    if (!active && !creatingInvestorsAgent) void createInvestorsAgent();
  }

  async function createInvestorsAgent() {
    setCreatingInvestorsAgent(true);
    setInvestorsAgentError("");
    try {
      await rpc.investors.agent();
      await refreshBots();
    } catch (error) {
      setInvestorsAgentError(errorText(error, t`Could not create the Investors agent`));
    } finally {
      setCreatingInvestorsAgent(false);
    }
  }

  function askFinanceAgent() {
    setFinanceAgentOpen(true);
    if (!active && !creatingFinanceAgent) void createFinanceAgent();
  }

  async function createInboxAgent() {
    setCreatingInboxAgent(true);
    setInboxAgentError("");
    try {
      await rpc.inbox.agent();
      await refreshBots();
    } catch (error) {
      setInboxAgentError(errorText(error, t`Could not create the Inbox agent`));
    } finally {
      setCreatingInboxAgent(false);
    }
  }

  // Carta needs no Create click: the agent appears once Carta is connected.
  useAutoCreateCartaAgent(
    investorsMode && cartaConnected && initialBotsLoaded && Boolean(userId),
    findCartaAgent(bots, userId) !== undefined,
    createCartaAgent,
    bots,
  );

  // The Investors agent is made when the page first opens, with or without Carta.
  const investorsAgentAsked = useRef(false);
  // Investors and Fundraising share the one Investors agent and its panel.
  const investorsAgentPage = investorsMode || fundraisingMode;
  const hasInvestorsAgent = findInvestorsAgent(bots, userId) !== undefined;
  useEffect(() => {
    if (!investorsAgentPage || !initialBotsLoaded || !userId || hasInvestorsAgent) return;
    if (investorsAgentAsked.current) return;
    investorsAgentAsked.current = true;
    void createInvestorsAgent();
  });
  useEffect(() => {
    if (!investorsAgentPage) investorsAgentAsked.current = false;
  }, [investorsAgentPage]);
  // One collapsed preference (kept under its original Carta key) serves the Investors panel.
  const investorsPanel = cartaPanelState({
    connected: true,
    collapsed: cartaAgentCollapsed,
    hasAgent: Boolean(active),
    creating: creatingInvestorsAgent,
    error: investorsAgentError,
  });
  // A window dragged down to phone width would leave a remembered-open panel covering the page.
  // Only the view collapses; the saved preference comes back when the window is wide again.
  useOnPhoneWidth(
    () => {
      setCartaAgentCollapsed(true);
      setInboxAgentCollapsed(true);
      setGtmAgentOpen(false);
    },
    () => {
      setCartaAgentCollapsed(readCartaAgentCollapsed(userId));
      setInboxAgentCollapsed(readInboxAgentCollapsed(userId));
    },
  );

  const cartaSuggestions = [t`Who are our investors?`];
  // A bank's own chat starts with two read questions, like the other page agents.
  const bankAgent = active ? agentAppFor(active.id, active.spaceId)?.bank : undefined;
  const bankAgentPage =
    !pageMode &&
    !inGroup &&
    active !== undefined &&
    isIntegrationAgentSpawnKey(active.spawnKey) &&
    bankAgent === true;
  const bankSuggestions = [
    t`What are our account balances?`,
    t`What were the biggest payments this month?`,
  ];
  const cartaAgentIntro = t`The Carta agent reads your cap table from Carta and answers questions about it. Try one:`;
  // The connector's agent is made on first visit, as the plan says; anyone else gets null.
  useEffect(() => {
    if (!devinMode) return;
    let live = true;
    rpc.devin
      .agent()
      .then(async (agent) => {
        if (!live) return;
        setDevinAgentId(agent?.bot.id ?? null);
        if (agent) await refreshBots();
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [devinMode, bootstrapMe?.spaceId, refreshBots]);
  // The agent panel of the current page; null on bot and group routes, which have their own panels.
  const agentPanel = inboxMode
    ? {
        name: "inbox-agent",
        testId: "inbox-agent-panel",
        open: !inboxAgentHidden,
        collapse: () => setInboxAgentCollapsedPref(true),
        collapseLabel: t`Collapse Inbox agent`,
        create: createInboxAgent,
        createLabel: t`Create Inbox agent`,
        creating: creatingInboxAgent,
        error: inboxAgentError,
        // InboxAgentIntro is its empty thread, with its own questions.
        suggestions: [],
      }
    : financeMode
      ? {
          name: "finance-agent",
          testId: "finance-agent-panel",
          open: financeAgentOpen,
          collapse: () => setFinanceAgentOpen(false),
          collapseLabel: t`Collapse Finance agent`,
          create: createFinanceAgent,
          createLabel: t`Create Finance agent`,
          creating: creatingFinanceAgent,
          error: financeAgentError,
          suggestions: financeAgentSuggestions(),
        }
      : dataRoomMode
        ? {
            name: "data-room-agent",
            testId: "data-room-agent-panel",
            open: dataRoomAgentOpen,
            collapse: () => setDataRoomAgentOpen(false),
            collapseLabel: t`Collapse Data room agent`,
            create: createDataRoomAgent,
            createLabel: t`Create Data room agent`,
            creating: creatingDataRoomAgent,
            error: dataRoomAgentError,
            suggestions: dataRoomAgentSuggestions(),
          }
        : devinMode
          ? {
              name: "devin-agent",
              testId: "devin-agent-panel",
              open: devinAgentOpen,
              collapse: () => setDevinAgentOpen(false),
              collapseLabel: t`Collapse Devin agent`,
              create: createDevinAgent,
              createLabel: t`Create Devin agent`,
              creating: creatingDevinAgent,
              error: devinAgentError,
              suggestions: [t`Anything merged today?`, t`What did Devin do this week?`],
            }
          : legalMode
            ? {
                name: "legal-agent",
                testId: "legal-agent-panel",
                open: legalAgentOpen,
                collapse: () => setLegalAgentOpen(false),
                collapseLabel: t`Collapse Legal agent`,
                create: createLegalAgent,
                createLabel: t`Create Legal agent`,
                creating: creatingLegalAgent,
                error: legalAgentError,
              }
            : gtmMode
              ? {
                  name: "gtm-agent",
                  testId: "gtm-agent-panel",
                  open: gtmAgentOpen,
                  collapse: () => setGtmAgentOpen(false),
                  collapseLabel: t`Collapse GTM agent`,
                  create: createGtmAgent,
                  createLabel: t`Create GTM agent`,
                  creating: creatingGtmAgent,
                  error: gtmAgentError,
                  suggestions: [t`Help me find our first 50 design partners`],
                }
              : investorsAgentPage
                ? {
                    name: "investors-agent",
                    testId: "investors-agent-panel",
                    // Never an empty panel: it holds the agent, or the agent being created, or why it failed.
                    open: investorsPanel.open,
                    collapse: () => setCartaAgentCollapsedPref(true),
                    collapseLabel: t`Collapse Investors agent`,
                    // A failed creation is retried from the panel; the agent otherwise appears by itself.
                    create: investorsAgentError ? createInvestorsAgent : undefined,
                    createLabel: t`Try again`,
                    creating: creatingInvestorsAgent,
                    error: investorsAgentError,
                    suggestions: investorsAgentSuggestions(),
                  }
                : null;
  // The toaster skips an approval toast for the agent whose panel is open.
  const dockedAgentId = agentPanel?.open ? active?.id : undefined;
  useEffect(() => {
    setDockedAgentBotId(dockedAgentId);
    return () => setDockedAgentBotId(undefined);
  }, [dockedAgentId]);
  // The Carta agent opened full screen from its panel: same intro, and a way back to Investors.
  const cartaAgentPage =
    !pageMode && !inGroup && active !== undefined && findCartaAgent(bots, userId)?.id === active.id;
  // Without a model a page agent cannot answer, so its panel offers Add a model, not questions.
  const pageAgentNeedsModel =
    bootstrapMe?.needsModel === true && (agentPanel !== null || cartaAgentPage);

  function setBotsSidebarCollapsedPref(collapsed: boolean) {
    setBotsSidebarCollapsed(collapsed);
    writeBotsSidebarCollapsed(userId, collapsed);
  }

  /** `modelProvider` opens Models on that provider with its own-key form open. */
  function openSettings(section: SettingsSection = "general", modelProvider?: string) {
    setSettingsSection(section);
    setSettingsModelProvider(modelProvider);
    setSettingsNotice(undefined);
    setSettingsOpen(true);
  }

  async function createBot() {
    try {
      const bot = await rpc.bots.create({
        name: t`New Bot`,
        title: "",
        description: "",
        instructions: "",
        notifyOnFinish: true,
        computerMode: "team",
      });
      setBots((current) =>
        current.some((item) => item.id === bot.id) ? current : [bot, ...current],
      );
      // Open its settings with the name selected, so the new bot gets a name before anything else.
      const destKey =
        userId && bootstrapMe?.spaceId
          ? rightPanelStorageKey(userId, bootstrapMe.spaceId, "bot", bot.id)
          : null;
      explicitPanelTarget.current = destKey;
      pendingPanelRestore.current = null;
      setNamingBotId(bot.id);
      navigate(`/app/${bot.id}`);
      setPanelState("settings");
      setRestoredPanelKey(destKey);
      await refreshBots().catch(() => undefined);
    } catch (error) {
      setSendError(errorText(error, t`Failed to create bot`));
    }
  }

  async function bootComputer({
    botId: targetBotId,
    takeControl,
    overlay,
    force = false,
  }: {
    botId: string;
    takeControl: boolean;
    overlay: boolean;
    force?: boolean;
  }) {
    const epoch = ++computerBootEpoch.current;
    const stillThisBoot = () => computerBootEpoch.current === epoch;
    const stillThisBot = () =>
      computerBotIdRef.current === targetBotId || activeBotId.current === targetBotId;
    const cached = computerCacheRef.current.get(targetBotId);
    const targetComputer = computer?.botId === targetBotId ? computer : (cached?.computer ?? null);
    const targetScreen = computer?.botId === targetBotId ? screenUrl : (cached?.screenUrl ?? null);
    const needsBoot = force || targetComputer?.state !== "running" || !targetScreen;
    if (overlay && needsBoot) setBooting(true);
    setComputerError(null);
    setComputerErrorFromScreen(false);
    try {
      if (needsBoot) {
        const status = await rpc.computer.boot({ botId: targetBotId });
        if (!stillThisBoot() || !stillThisBot()) return;
        commitComputer(status);
        cacheComputerFor(targetBotId, { computer: status });
      }
      if (takeControl) {
        await rpc.computer.takeover({ botId: targetBotId });
        if (!stillThisBoot() || !stillThisBot()) return;
      }
      await refreshComputerFor(targetBotId);
    } catch (error) {
      if (!stillThisBoot() || !stillThisBot()) return;
      setComputerError(errorText(error, t`Could not take control`));
      setComputerErrorFromScreen(false);
      throw error;
    } finally {
      if (stillThisBoot()) setBooting(false);
    }
  }

  async function refreshComputerFor(targetBotId: string) {
    if (activeBotId.current === targetBotId) {
      await refreshThread(targetBotId);
      return;
    }
    if (computerBotIdRef.current !== targetBotId) return;
    const status = await rpc.computer.status({ botId: targetBotId });
    if (computerBotIdRef.current !== targetBotId) return;
    commitComputer(status);
    cacheComputerFor(targetBotId, { computer: status });
    await refreshComputerScreen(targetBotId);
  }

  useEffect(() => {
    if (panel !== "computer") {
      autoBooted.current = null;
      return;
    }
    if (!active) return;
    const botId = active.id;
    let cancelled = false;
    void (async () => {
      // Refresh from the server first. A stale SSE "booting" snapshot used to
      // skip this effect, so an RPC takeover never showed "You have control".
      const snap = await refreshThread(botId).catch(() => null);
      if (cancelled || activeBotId.current !== botId) return;
      const state = snap?.computer?.state;
      const screen = state === "running" ? await refreshComputerScreen(botId) : null;
      if (cancelled || activeBotId.current !== botId) return;
      const action = computerPanelAutoBoot(state, screen);
      if (action === "wait") {
        if (state === "running") autoBooted.current = botId;
        return;
      }
      if (action === "boot" && autoBooted.current === botId) return;
      autoBooted.current = botId;
      if (!computerPanelAutoUsesBoot(action)) return;
      await bootComputer({
        botId,
        takeControl: false,
        overlay: action === "boot",
        force: true,
      }).catch(() => undefined);
    })();
    return () => {
      cancelled = true;
    };
  }, [panel, active?.id]);

  useEffect(() => {
    setComputerOpen(false);
    setComputerError(null);
    setComputerErrorFromScreen(false);
    setComputerBotId(active?.id);
  }, [active?.id]);

  useEffect(() => {
    if (!computer?.busyBotName) {
      setComputerError(null);
      setComputerErrorFromScreen(false);
    }
  }, [computer?.busyBotName]);

  useEffect(() => {
    if (panel !== "routine") {
      routineSaveRequest.current += 1;
      setRoutineError(null);
    }
  }, [panel]);

  useEffect(() => {
    if (!panelStorageKey) return;
    if (observedPanelKey.current !== panelStorageKey) {
      observedPanelKey.current = panelStorageKey;
      if (pendingExplicitPanel.current || explicitPanelTarget.current === panelStorageKey) {
        pendingExplicitPanel.current = false;
        explicitPanelTarget.current = null;
        pendingPanelRestore.current = null;
        setRestoredPanelKey(panelStorageKey);
        return;
      }
      explicitPanelTarget.current = null;
      // Reload starts with panel=null so storage restores. In-session chat switches used to
      // keep computer/settings open; only routine was cleared (handled above). Carry is
      // session-only — do not write the carried panel onto the destination's saved prefs.
      if (panel === "computer" || panel === "settings" || panel === "group-settings") {
        const carried = panel === "computer" ? "computer" : inGroup ? "group-settings" : "settings";
        pendingPanelRestore.current = null;
        if (carried !== panel) setPanelState(carried);
        setRestoredPanelKey(null);
        return;
      }
      // Below the docked breakpoint the panel would overlay the chat, so it starts closed.
      pendingPanelRestore.current = wideScreen() ? readRightPanelState(panelStorageKey) : null;
    }
    const saved = pendingPanelRestore.current;
    if (!saved) return;
    // Explicit routine links take precedence over a local layout preference.
    if (searchParams.has("routine")) {
      pendingPanelRestore.current = null;
      return;
    }
    if (saved.panel === "routine" && saved.routineId && routinesBotId !== active?.id) return;
    let next = saved.panel;
    if (next === "routine") {
      const routine = saved.routineId
        ? routines.find((item) => item.id === saved.routineId)
        : undefined;
      if (saved.routineId && !routine) next = "computer";
      setEditingRoutine(routine ?? null);
      setRoutineDraft(routine ? draftFromRoutine(routine) : emptyRoutineDraft());
      setRoutineWebhookSecret(null);
    }
    pendingPanelRestore.current = null;
    setPanelState(next);
    setRestoredPanelKey(panelStorageKey);
  }, [panelStorageKey, active?.id, inGroup, panel, routinesBotId, routines, searchParams]);

  useEffect(() => {
    // Do not gate writes on ?routine= staying in the URL — a stuck/failed routine
    // list would freeze layout prefs. Deep-link handling uses setPanelState for the
    // bot-switch close so restoredPanelKey stays unset until an intentional setPanel.
    if (!panelStorageKey || restoredPanelKey !== panelStorageKey || pendingPanelRestore.current)
      return;
    writeRightPanelState(panelStorageKey, panel, editingRoutine?.id);
  }, [panelStorageKey, restoredPanelKey, panel, editingRoutine?.id]);

  useEffect(() => {
    const threadKey = inGroup ? groupId : active?.id;
    setPendingAttachments((current) => {
      const stale = current.filter((attachment) => attachment.threadKey !== threadKey);
      revokePendingAttachmentPreviews(stale);
      return attachmentsForThread(current, threadKey);
    });
    setPendingItems((current) => current.filter((ref) => ref.threadKey === threadKey));
    clearReply();
    if (keepNoticeFor.current === threadKey) keepNoticeFor.current = null;
    else setAttachmentNotice(null);
    setSendError(null);
  }, [active?.id, clearReply, groupId, inGroup]);

  useEffect(() => {
    if (!computerOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setComputerOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [computerOpen]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!isCommandPaletteHotkey(event)) return;
      event.preventDefault();
      setCommandPaletteOpen((open) => !open);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const heartbeatBotId = computerBot?.id ?? active?.id;
    if ((panel !== "computer" && !computerOpen) || !heartbeatBotId || computer?.state !== "running")
      return;
    const ping = () =>
      void rpc.computer.heartbeat({ botId: heartbeatBotId }).catch(() => undefined);
    ping();
    const timer = window.setInterval(ping, 60_000);
    return () => window.clearInterval(timer);
  }, [panel, computerOpen, computerBot?.id, active?.id, computer?.state]);

  /** Open the computer view. Only an explicit Take control asks for the lease. */
  async function openComputer(botId?: string, takeControl = false) {
    const id = botId ?? active?.id;
    if (!id) return false;
    const bot = botsRef.current.find((candidate) => candidate.id === id);
    if (!bot) return false;
    computerBotIdRef.current = id;
    setComputerBotId(id);
    const cached = computerCacheRef.current.get(id);
    const targetComputer = computer?.botId === id ? computer : (cached?.computer ?? null);
    const targetScreen = computer?.botId === id ? screenUrl : (cached?.screenUrl ?? null);
    if (computer?.botId !== id) {
      commitComputer(targetComputer);
      setScreenUrl(targetScreen);
    }
    setComputerOpen(true);
    computerVisible.current = true;
    const needsTakeover = takeControl && !userHoldsComputerControl(targetComputer, id);
    const blocked = computerTakeoverBlocked(targetComputer, snapshot?.run?.status);
    try {
      await bootComputer({
        botId: id,
        takeControl: needsTakeover && !blocked,
        overlay: (needsTakeover && !blocked) || targetComputer?.state !== "running",
        force: targetComputer?.state !== "running",
      });
      return true;
    } catch {
      // computerError already set in bootComputer
      return false;
    }
  }
  openComputerRef.current = openComputer;
  const onOpenComputer = useCallback((botId?: string) => {
    void openComputerRef.current(botId);
  }, []);

  async function releaseComputer(reason?: ComputerReleaseReason) {
    const botId = computerBotIdRef.current ?? activeBotId.current;
    if (!botId) return;
    try {
      await rpc.computer.release({ botId, reason });
      if (computerBotIdRef.current !== botId && activeBotId.current !== botId) return;
      await refreshComputerFor(botId).catch(() => undefined);
      const groupId = activeGroupId.current;
      if (groupId) {
        await refreshGroupThreadRef.current(groupId).catch(() => undefined);
      }
    } catch {
      if (computerBotIdRef.current !== botId && activeBotId.current !== botId) return;
      setComputerError(t`Could not continue`);
      setComputerErrorFromScreen(false);
    }
  }

  function dismissComposerError() {
    // The strip shows one message at a time, so only dismiss the run failure when it is the
    // one on screen; otherwise a live run would be silenced before it has even failed.
    const failedRunId = displayedRunErrorId;
    setSendError(null);
    if (failedRunId) {
      rememberSeenRunErrorId(failedRunId);
      setDismissedRunErrorIds((current) => new Set(current).add(failedRunId));
    }
  }

  function retryFailedRun() {
    const last = activeSnapshot?.messages.findLast((message) => message.role === "user");
    const text = last?.blocks
      .flatMap((block) => (block.kind === "text" ? [block.text] : []))
      .join("\n");
    dismissComposerError();
    if (text?.trim()) void sendMessage(text, [], newClientId());
  }

  const embeddedScreenUrl = embeddableScreenUrl(screenUrl);
  // Without a screen to show (whatever the computer's state), the panel is just the bot's
  // routines: no heading over an empty box.
  const noComputerScreen = isRoutinesOnlyPanel({
    kind: computer?.kind,
    hasScreen: Boolean(embeddedScreenUrl),
    state: computer?.state,
    hasError: Boolean(computerError),
    open: computerOpen,
    showRecoveryHint: showComputerRecoveryHint,
  });
  const hasControl = userHoldsComputerControl(computer, computerBot?.id);
  const hideScreenLoadError = computerErrorFromScreen && Boolean(embeddedScreenUrl);
  const computerScreenError =
    computerError && !hideScreenLoadError ? (
      <div role="alert" className="flex flex-col items-center gap-3 px-6 text-center text-sm">
        <p className="text-destructive">{computerError}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => computerBot && void refreshComputerScreen(computerBot.id)}
        >
          <Trans>Retry screen</Trans>
        </Button>
      </div>
    ) : null;
  const computerPreviewScreen =
    !computerOpen &&
    computer?.kind !== "desktop" &&
    computer?.state === "running" &&
    Boolean(embeddedScreenUrl) &&
    !computerScreenError;
  const showingRecoveryHint =
    !computerOpen &&
    computer?.kind !== "desktop" &&
    !computerPreviewScreen &&
    !computerScreenError &&
    showComputerRecoveryHint;

  const userName = session.data?.user.name ?? t`You`;
  const initials = userName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const pinsList = !inGroup && !pageMode && botPins?.list ? botPins : null;
  const legalWaitsForConsent = legalMode && legalConsentMissing;
  const composerDisabled = Boolean(recordingSkill) || pageAgentNeedsModel || legalWaitsForConsent;
  // A "needs your permission" error from before the page's Allow no longer applies once it is given.
  const staleConsentError =
    !legalWaitsForConsent &&
    (sendError === LEGAL_CONSENT_REQUIRED_MESSAGE ||
      displayedRunError === LEGAL_CONSENT_REQUIRED_MESSAGE);
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the error becomes stale.
  useEffect(() => {
    if (staleConsentError) dismissComposerError();
  }, [staleConsentError]);
  // "Answer the pending ask first" no longer applies once the question is answered.
  const stalePendingAskError =
    isStalePendingAskError(
      sendError,
      activeSnapshot?.messages ?? [],
      activeSnapshot?.run?.status,
    ) ||
    isStalePendingAskError(
      displayedRunError,
      activeSnapshot?.messages ?? [],
      activeSnapshot?.run?.status,
    );
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the error becomes stale.
  useEffect(() => {
    if (stalePendingAskError) dismissComposerError();
  }, [stalePendingAskError]);
  const paneAcceptsFiles = !pageMode && Boolean(active || activeGroup);
  function onPaneFileDrag(event: DragEvent<HTMLElement>) {
    if (!paneAcceptsFiles || !isUnclaimedFileDrag(event)) return setPaneDraggingFiles(false);
    event.preventDefault();
    event.dataTransfer.dropEffect = composerDisabled ? "none" : "copy";
    setPaneDraggingFiles(!composerDisabled);
  }
  // A drop on another space's agent is refused here, not uploaded to the Data room.
  function rowFileDrag(event: DragEvent<HTMLElement>, bot: { id: string; spaceId?: string }) {
    if (!isUnclaimedFileDrag(event)) return false;
    event.preventDefault();
    const ok = bot.spaceId === bootstrapMe?.spaceId;
    event.dataTransfer.dropEffect = ok ? "copy" : "none";
    setFileDropBotId(ok ? bot.id : null);
    return true;
  }
  useEffect(() => {
    if (!focusComposerBotId || active?.id !== focusComposerBotId) return;
    const input = document.querySelector<HTMLTextAreaElement>("textarea[name='chat-message']");
    input?.focus();
    // The tour's last step sends its sample question at once, so it never lands in a draft.
    if (tourQuestion.current) {
      void sendMessage(t`What should I do first this week?`, [], newClientId());
    }
    tourQuestion.current = false;
    setFocusComposerBotId(null);
  }, [active?.id, focusComposerBotId, sendMessage, t]);
  const threadView = (
    <>
      {cartaAgentPage ? (
        <div className="shrink-0 px-4 pt-2 md:px-7">
          <Link
            to="/app/investors"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            <Trans>Back to Investors</Trans>
          </Link>
        </div>
      ) : null}
      {bankAgentPage && transcriptMessages.length === 0 && !transcriptRunning && activeSnapshot ? (
        <AgentPanelIntro
          description=""
          suggestions={bankSuggestions}
          onAddModel={bootstrapMe?.needsModel === true ? () => openSettings("models") : undefined}
          disabled={sending}
          onPick={(text) => void sendMessage(text, [], newClientId())}
        />
      ) : null}
      {cartaAgentPage && transcriptMessages.length === 0 && !transcriptRunning && activeSnapshot ? (
        <AgentPanelIntro
          description={cartaAgentIntro}
          suggestions={cartaSuggestions}
          onAddModel={pageAgentNeedsModel ? () => openSettings("models") : undefined}
          disabled={sending}
          onPick={(text) => void sendMessage(text, [], newClientId())}
        />
      ) : null}
      {!inGroup && !pageMode && botPins ? <PinsStrip pins={botPins} onPins={setBotPins} /> : null}
      <div className="flex min-h-0 flex-1">
        <div
          className={`flex min-h-0 min-w-0 flex-1 flex-col${pageMode ? " rk-docked-chat" : ""}`}
          data-bot-accent={threadAccent ? "" : undefined}
          style={threadAccent ? botAccentStyle(threadAccent) : undefined}
        >
          <BotToolControlsContext.Provider value={botToolControls}>
            {inboxMode &&
            activeSnapshot &&
            transcriptMessages.length === 0 &&
            activeSnapshot.olderCursor == null &&
            !transcriptRunning &&
            !sending ? (
              <PageAgentIntro
                kind="inbox"
                onAsk={(text) => void sendMessage(text, [], newClientId())}
              />
            ) : !inGroup &&
              !pageMode &&
              activeSnapshot &&
              pageAgentKind(active?.spawnKey) &&
              transcriptMessages.length === 0 &&
              activeSnapshot.olderCursor == null &&
              !transcriptRunning &&
              !sending ? (
              <PageAgentIntro
                kind={pageAgentKind(active?.spawnKey) ?? "inbox"}
                onAsk={(text) => void sendMessage(text, [], newClientId())}
              />
            ) : inGroup &&
              activeGroup &&
              activeSnapshot &&
              transcriptMessages.length === 0 &&
              activeSnapshot.olderCursor == null &&
              !transcriptRunning &&
              !sending ? (
              <GroupIntro
                members={activeGroup.members}
                onAsk={(text) => void sendMessage(text, [], newClientId())}
              />
            ) : !activeSnapshot ? (
              <ThreadSkeleton />
            ) : (
              <Transcript
                key={activeSnapshot?.threadId}
                scrollRef={messageScroll}
                sentHere={sentHere}
                scrollRequest={scrollRequest}
                onScrollRequestHandled={clearScrollRequest}
                artifactTarget={transcriptArtifactTarget}
                messages={transcriptMessages}
                showToolActivity={showToolActivity}
                olderCursor={activeSnapshot?.olderCursor ?? null}
                loadingOlder={loadingOlder}
                answerableAskMessageId={answerableAskMessageId}
                running={transcriptRunning}
                workingBots={workingBots}
                workingActivity={soleWorkingActivity}
                workingStartedAt={workingStartedAt}
                onStopRun={() => void stopRun()}
                onRetryRun={
                  // A routine has no message to resend; Stop is the only slow-run action.
                  activeSnapshot?.run?.trigger === "routine"
                    ? undefined
                    : () =>
                        void retryAfterStop({
                          stop: stopRun,
                          destination: () => activeGroupId.current ?? activeBotId.current ?? null,
                          resend: retryFailedRun,
                        })
                }
                failedNote={dismissedRunError}
                failedScheduled={activeSnapshot?.run?.trigger === "routine"}
                onLoadOlder={loadOlder}
                onOpenBot={openBot}
                onAnswer={answerMessage}
                onReply={(message) => {
                  setReplyTarget(message);
                  setReplyQuote(null);
                }}
                onQuote={(message, quote) => {
                  setReplyTarget(message);
                  setReplyQuote(quote);
                }}
                onReact={reactToMessage}
                remember={remember}
                onJumpToMessage={jumpToReplyMessage}
                onOpenPeerMessages={(peer) => {
                  setPeerConversation(peer);
                }}
                memberName={resolveTranscriptMemberName}
                peerBot={resolveTranscriptBot}
                onRefresh={refreshActiveThread}
                onBotChanged={refreshBots}
                onAddRoutine={addSkillRoutine}
                voiceReady={Boolean(voiceStatus?.ready)}
                speakingMessageId={speakingMessageId}
                onSpeak={speakMessage}
                onOpenComputer={onOpenComputer}
                lastReadSeq={activeSnapshot?.lastReadSeq}
                onRead={readThreadUpTo}
                anchorToUnread={!pageMode}
              />
            )}
          </BotToolControlsContext.Provider>
          {composerDraft ? (
            <ComposeEmail
              seed={NEW_MESSAGE}
              accounts={
                composerAccounts ?? [
                  { connectionId: composerDraft.connectionId, label: composerDraft.account },
                ]
              }
              connectionId={composerDraft.connectionId}
              spaceId={composerSpaceId}
              restore={{
                seed: NEW_MESSAGE,
                clientId: crypto.randomUUID().replaceAll("-", ""),
                fields: {
                  connectionId: composerDraft.connectionId,
                  to: composerDraft.to,
                  cc: composerDraft.cc,
                  bcc: composerDraft.bcc,
                  subject: composerDraft.subject,
                  html: "",
                  text: composerDraft.body,
                },
                forwarded: [],
                files: [],
                saved: false,
                accounts: composerAccounts ?? [
                  { connectionId: composerDraft.connectionId, label: composerDraft.account },
                ],
              }}
              onClose={() => setComposerDraft(null)}
            />
          ) : null}
          {forwarded && forwarded.threadKey === (inGroup ? groupId : active?.id) ? (
            <div
              role="status"
              className="flex items-center justify-center gap-2 px-6 pb-2 text-[13px] text-muted-foreground"
            >
              <span>
                <Trans>Sent to {forwardedName}</Trans>
              </span>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={() => {
                  setForwarded(null);
                  navigate(`/app/g/${forwarded.groupId}`);
                }}
              >
                <Trans>Open</Trans>
              </Button>
            </div>
          ) : null}
          {pendingDelegateAgents(activeSnapshot?.delegatePendingAgents).map((agent) => (
            <div key={agent.id} className="px-6 pb-2">
              <Button
                variant="outline"
                className="w-full pointer-coarse:h-11"
                data-testid="delegate-approval-open"
                onClick={() => navigate(`/app/${encodeURIComponent(agent.id)}`)}
              >
                <Trans>Open {agent.name}</Trans>
              </Button>
            </div>
          ))}
          {recordingSkill ? (
            <div className="px-6 pb-2 text-center text-[13px] text-destructive">
              <Trans>Teaching in progress. Stop teaching before sending a new message.</Trans>
            </div>
          ) : null}
          {active || activeGroup ? (
            <Composer
              key={inGroup ? `group:${groupId}` : `bot:${active?.id}`}
              draftKey={inGroup ? `group:${groupId}` : `bot:${active?.id}`}
              activeName={inGroup ? (activeGroup?.name ?? activeSnapshot?.groupName) : active?.name}
              running={composerShowsStop(currentRuns)}
              disabled={composerDisabled}
              disabledPlaceholder={
                legalWaitsForConsent ? t`Allow access on the page to ask` : undefined
              }
              pendingAttachments={activePendingAttachments}
              dataRoomItems={activeDataRoomItems}
              onRemoveDataRoomItem={removeDataRoomItem}
              attachmentNotice={attachmentNotice}
              onDismissAttachmentNotice={() => setAttachmentNotice(null)}
              placeholder={
                activeSnapshot?.delegatePending?.length
                  ? waitingForApprovalLabel()
                  : waitingOnApproval
                    ? needsAnswerLabel()
                    : undefined
              }
              sendError={sendError}
              runError={displayedRunError}
              runErrorId={displayedRunErrorId}
              onRunErrorPresented={handleRunErrorPresented}
              onDismissError={dismissComposerError}
              onRetryRun={retryFailedRun}
              onOpenModelSettings={(provider) =>
                // "" is a rejected key: open the provider the failed run used.
                openSettings("models", provider || (activeSnapshot?.run?.modelProvider ?? ""))
              }
              onNavigate={navigate}
              sending={sending}
              fileInputRef={fileInputRef}
              onAttachmentPick={onAttachmentPick}
              onRemoveAttachment={removeAttachment}
              onSend={sendMessage}
              quickAsk={
                askChiefChip && active?.id === chiefId
                  ? {
                      label: t`What should I do first this week?`,
                      onAsk: () => {
                        setAskChiefChip(false);
                        void sendMessage(t`What should I do first this week?`, [], newClientId());
                      },
                    }
                  : undefined
              }
              onStop={async () => {
                await stopRun();
              }}
              onVoice={!inGroup && active ? () => void startElioCall() : undefined}
              artifactTarget={transcriptArtifactTarget}
              replyTarget={activeReplyTarget}
              replyQuote={activeReplyQuote}
              replyTargetName={replyTargetName}
              onClearReply={clearReply}
              mentionTargets={composerMentionTargets}
              onMentionOpen={loadMentionConnectors}
              agentSkills={agentSkills}
              onSlashOpen={refreshAgentSkills}
              sentHistory={sentHistory}
              onSlashAction={(action) => {
                if (action === "chat-settings") {
                  setPanel(inGroup ? "group-settings" : "settings");
                  // Page modes render no settings panel; they open on the agent's own page.
                  if (pageMode && active) openBot(active.id);
                  return;
                }
                if (action === "settings-general") {
                  openSettings("general");
                  return;
                }
                if (action === "settings-usage") {
                  openSettings("general");
                }
              }}
            />
          ) : null}
        </div>
        {pinsList && panel === null ? (
          // 316px sidebar + 288px column leaves 676px of transcript at 1280px; at lg (1024px) only 420px.
          <aside
            aria-label={t`List`}
            className="rk-scroll hidden w-72 shrink-0 overflow-y-auto border-s border-border px-4 py-3 xl:block"
          >
            <PinsList pins={pinsList} onPins={setBotPins} />
          </aside>
        ) : null}
      </div>
    </>
  );

  const shell = (
    <div
      data-testid="shell-root"
      data-ready={shellReady}
      className="relative flex h-full min-w-0 overflow-clip bg-background text-foreground/90"
      onTouchStartCapture={(event) => {
        if (
          mobileSidebarOpen ||
          event.touches.length !== 1 ||
          window.matchMedia(SIDEBAR_DOCKED_QUERY).matches
        ) {
          mobileSidebarSwipeRef.current = null;
          return;
        }
        const touch = event.touches[0];
        if (!touch) return;
        const rtl = document.documentElement.getAttribute("dir") === "rtl";
        const startsAtEdge = rtl
          ? touch.clientX >= window.innerWidth - MOBILE_SIDEBAR_SWIPE_EDGE_PX
          : touch.clientX <= MOBILE_SIDEBAR_SWIPE_EDGE_PX;
        mobileSidebarSwipeRef.current = startsAtEdge
          ? { startX: touch.clientX, startY: touch.clientY }
          : null;
      }}
      onTouchEndCapture={(event) => {
        const swipe = mobileSidebarSwipeRef.current;
        mobileSidebarSwipeRef.current = null;
        const touch = event.changedTouches[0];
        if (
          !swipe ||
          !touch ||
          mobileSidebarOpen ||
          window.matchMedia(SIDEBAR_DOCKED_QUERY).matches
        ) {
          return;
        }
        const rtl = document.documentElement.getAttribute("dir") === "rtl";
        const horizontal = rtl ? swipe.startX - touch.clientX : touch.clientX - swipe.startX;
        const vertical = Math.abs(touch.clientY - swipe.startY);
        if (horizontal >= MOBILE_SIDEBAR_SWIPE_DISTANCE_PX && horizontal > vertical * 1.25) {
          setMobileSidebarOpen(true);
        }
      }}
      onTouchCancelCapture={() => {
        mobileSidebarSwipeRef.current = null;
      }}
    >
      <SkipToContent />
      <ComputerUpdateProgress
        onCompleted={() => {
          if (active) void refreshThread(active.id);
        }}
      />
      {mobileSidebarOpen ? (
        <button
          type="button"
          aria-label={t`Close navigation`}
          onClick={() => setMobileSidebarOpen(false)}
          className="absolute inset-y-0 end-0 start-[min(calc(100%-48px),316px)] z-30 bg-overlay lg:hidden"
        />
      ) : null}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: key and focus events bubble up from the row buttons inside */}
      <aside
        ref={sidebarRef}
        data-sidebar=""
        data-drawer-open={mobileSidebarOpen ? "" : undefined}
        aria-label={t`Sidebar`}
        onKeyDown={(event) => moveRosterFocus(sidebarRef.current, event)}
        onFocus={(event) => {
          const id = rosterRowId(event.target as HTMLElement);
          if (!id) return;
          rosterStopId.current = id;
          syncRosterTabStops(sidebarRef.current, id);
        }}
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
                  onClick={() => setCommandPaletteOpen(true)}
                  className="app-no-drag mx-auto grid size-9 place-items-center rounded-xl text-muted-foreground hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                >
                  <Search size={16} strokeWidth={1.8} aria-hidden="true" />
                </button>
              </RailTip>
            ) : (
              <InputGroup
                data-testid="sidebar-search"
                data-tour="sidebar-search"
                className="app-no-drag w-auto min-w-0 flex-1 rounded-xl bg-card dark:bg-input border border-border text-muted-foreground has-[[data-slot=input-group-control]:focus-visible]:ring-0"
              >
                <InputGroupAddon>
                  <Search size={16} strokeWidth={1.8} aria-hidden="true" />
                </InputGroupAddon>
                {/* One search surface: the box opens the Cmd+K palette. */}
                <InputGroupInput
                  readOnly
                  value=""
                  onClick={() => {
                    // The box keeps focus until the palette takes it, so closing returns here.
                    setCommandPaletteOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setCommandPaletteOpen(true);
                    }
                  }}
                  placeholder={t`Search`}
                  autoComplete="off"
                  name="sidebar-search"
                  className="cursor-pointer placeholder:text-foreground/70"
                />
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
                      ? "bg-sidebar-accent text-foreground"
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
                  {/* Closes with no animation, so the panel it opens never coexists with the menu. */}
                  <PopoverContent
                    align="end"
                    initialFocus={pickerInitialFocus}
                    className="app-no-drag w-auto gap-0 overflow-hidden p-0 data-closed:animate-none"
                  >
                    <BotCreatePicker
                      onCreateBot={() => {
                        setCreateMenuOpen(false);
                        setMobileSidebarOpen(false);
                        void createBot();
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
                      canCreateSpace={spaces.length > 1}
                      onShowSpaceInfo={() => {
                        setCreateMenuOpen(false);
                        setMobileSidebarOpen(false);
                        setPickerInfoTopic("space");
                      }}
                    />
                  </PopoverContent>
                </Popover>
                <Button
                  variant="ghost"
                  size="icon"
                  className="app-no-drag lg:hidden"
                  aria-label={t`Close menu`}
                  title={t`Close menu`}
                  data-testid="close-mobile-sidebar"
                  data-drawer-focus
                  onClick={() => setMobileSidebarOpen(false)}
                >
                  <X size={16} strokeWidth={1.8} aria-hidden="true" />
                </Button>
              </div>
            )
          }
        />
        {/* A page has no top band in the rail (the desktop app keeps one for its window controls), so the way back to the full sidebar sits here. */}
        {rail && pageMode && !desktopBridge() ? (
          <button
            type="button"
            data-testid="restore-bots-sidebar"
            aria-label={t`Show sidebar`}
            title={t`Show sidebar`}
            onClick={() => setBotsSidebarCollapsedPref(false)}
            className="app-no-drag mx-auto mt-1 grid size-9 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
          >
            <PanelLeftOpen size={16} strokeWidth={1.8} aria-hidden="true" />
          </button>
        ) : null}
        {/* On a phone the pages and the chats scroll together; from lg up each keeps its own scroll. */}
        <div
          ref={sidebarPaneRef}
          className="rk-scroll-fade-bottom flex min-h-0 flex-1 flex-col max-lg:overflow-y-auto lg:contents short:lg:flex short:lg:overflow-y-auto"
        >
          {bootstrapMe === undefined ? null : (
            // Waiting for the account (undefined) keeps pages the user hid from flashing in.
            // Outside the chat scroll area so it stays put; on a short screen it scrolls on its own.
            // On a phone Activity takes its place until it is closed, so the chats stay in view.
            <div
              className={`flex shrink-0 flex-col border-b border-border px-2.5 pb-1 lg:max-h-[50vh] lg:overflow-y-auto short:lg:max-h-none short:lg:overflow-visible ${activityMode && !rail ? "max-lg:hidden" : ""}`}
            >
              <SidebarPagesGroup
                title={t`Pages`}
                collapsed={collapsedSidebarSections.has("pages")}
                rail={rail}
                onToggle={() => toggleSidebarSection("pages")}
                pages={[
                  { key: "inbox", label: t`Inbox` },
                  { key: "finance", label: t`Finance` },
                  { key: "legal", label: t`Legal` },
                  { key: "gtm", label: t`GTM` },
                  ...(glance.devinConnected ? [{ key: "devin", label: t`Devin` }] : []),
                  { key: "investors", label: t`Investors` },
                  { key: "fundraising", label: t`Fundraising` },
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
                    href="/app/inbox"
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
                    href="/app/finance"
                    current={financeMode}
                    icon={<ChartColumn size={15} strokeWidth={1.8} aria-hidden="true" />}
                    label={t`Finance`}
                    rail={rail}
                    onOpen={() => {
                      setMobileSidebarOpen(false);
                      navigate("/app/finance");
                    }}
                    {...glanceBadge({ unseen: unseen.finance ?? 0, rail })}
                  />
                )}
                {hiddenPages.includes("legal") ? null : (
                  <SidebarPageLink
                    testId="sidebar-legal"
                    href="/app/legal"
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
                        one: "# overdue or due in the next 7 days",
                        other: "# overdue or due in the next 7 days",
                      }),
                    })}
                  />
                )}
                {hiddenPages.includes("gtm") ? null : (
                  <SidebarPageLink
                    testId="sidebar-gtm"
                    href="/app/gtm"
                    current={gtmMode}
                    icon={<Megaphone size={15} strokeWidth={1.8} aria-hidden="true" />}
                    label={t`GTM`}
                    rail={rail}
                    onOpen={() => {
                      setMobileSidebarOpen(false);
                      navigate("/app/gtm");
                    }}
                    {...glanceBadge({
                      unseen: 0,
                      rail,
                      value: glance.gtmNeedsYou > 0 ? String(glance.gtmNeedsYou) : undefined,
                      valueLabel: plural(glance.gtmNeedsYou, {
                        one: "# needs you",
                        other: "# need you",
                      }),
                    })}
                  />
                )}
                {hiddenPages.includes("devin") || !glance.devinConnected ? null : (
                  <SidebarPageLink
                    testId="sidebar-devin"
                    href="/app/devin"
                    current={devinMode}
                    icon={<CodeXml size={15} strokeWidth={1.8} aria-hidden="true" />}
                    label={t`Devin`}
                    rail={rail}
                    onOpen={() => {
                      setMobileSidebarOpen(false);
                      navigate("/app/devin");
                    }}
                    // A count, never a dot: the page lists what needs you.
                    {...glanceBadge({
                      unseen: 0,
                      rail,
                      value: glance.devinNeedsYou > 0 ? String(glance.devinNeedsYou) : undefined,
                      valueLabel: plural(glance.devinNeedsYou, {
                        one: "# needs you",
                        other: "# need you",
                      }),
                    })}
                  />
                )}
                {hiddenPages.includes("investors") ? null : (
                  <SidebarPageLink
                    testId="sidebar-investors"
                    href="/app/investors"
                    current={investorsMode}
                    icon={<PieChart size={15} strokeWidth={1.8} aria-hidden="true" />}
                    label={t`Investors`}
                    rail={rail}
                    onOpen={() => {
                      setMobileSidebarOpen(false);
                      navigate("/app/investors");
                    }}
                    {...glanceBadge({ unseen: unseen.investors ?? 0, rail })}
                  />
                )}
                {hiddenPages.includes("fundraising") ? null : (
                  <SidebarPageLink
                    testId="sidebar-fundraising"
                    href="/app/fundraising"
                    current={fundraisingMode}
                    icon={<HandCoins size={15} strokeWidth={1.8} aria-hidden="true" />}
                    label={t`Fundraising`}
                    rail={rail}
                    onOpen={() => {
                      setMobileSidebarOpen(false);
                      navigate("/app/fundraising");
                    }}
                  />
                )}
                {hiddenPages.includes("contacts") ? null : (
                  <SidebarPageLink
                    testId="sidebar-contacts"
                    href="/app/contacts"
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
                    href="/app/data-room"
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
                      value:
                        glance.dataRoomWaiting > 0 ? String(glance.dataRoomWaiting) : undefined,
                      failure: true,
                      // Only the badge opens the failed files; the row opens everything.
                      onValueClick: () => {
                        setMobileSidebarOpen(false);
                        navigate("/app/data-room?status=failed");
                      },
                      // The count is failed files, the only ones a person can retry or remove.
                      valueLabel: plural(glance.dataRoomWaiting, {
                        one: "# file failed",
                        other: "# files failed",
                      }),
                    })}
                  />
                )}
                {hiddenPages.includes("artifacts") ? null : (
                  <SidebarPageLink
                    testId="sidebar-artifacts"
                    href="/app/artifacts"
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
            className="rk-scroll rk-scroll-fade-y flex flex-col gap-0.5 px-2.5 pb-2.5 max-lg:shrink-0 lg:min-h-0 lg:flex-1 lg:snap-y lg:snap-proximity lg:overflow-y-auto short:lg:flex-none short:lg:shrink-0 short:lg:overflow-visible [&_[data-roster-row]]:snap-start [&_[data-roster-fold]]:snap-start"
          >
            <>
              {activityMode && !rail ? (
                <ActivityList
                  onListedBots={setActivityBotIds}
                  onOpenRun={(run) => {
                    setMobileSidebarOpen(false);
                    if (run.groupId) navigate(`/app/g/${run.groupId}`);
                    else navigate(`/app/${run.botId}`);
                  }}
                />
              ) : null}
              {!initialBotsLoaded && bots.length === 0 && !rail ? (
                <div className="space-y-2 px-1 pt-2" aria-hidden="true">
                  {[0, 1, 2, 3].map((row) => (
                    <div key={row} className="flex items-center gap-3 rounded-xl px-2 py-2.5">
                      <Skeleton className="size-9 rounded-full" />
                      <Skeleton className="h-3 w-2/5" />
                    </div>
                  ))}
                </div>
              ) : null}
              <SidebarDnd
                layout={sidebarLayout}
                labelFor={sidebarDragLabel}
                onDrop={dropSidebarItem}
                overlay={sidebarDragOverlay}
              >
                {sidebarGroups.map((group) => {
                  const activeSpace = group.spaceId === bootstrapMe?.spaceId;
                  const folder =
                    group.kind === "folder" && group.sectionId ? group.sectionId : null;
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
                  const dragEnabled = activeSpace && !rail && group.kind !== "pinned";
                  const nestedRows = nestRosterByParent(group.bots, collapsedRosterParents);
                  // Page and integration agents, and the chat made for each email, fold into one row
                  // each; Chief and the person's bots stay listed.
                  const rowKey = (row: (typeof nestedRows)[number]) =>
                    "spawnKey" in row.item.chat ? String(row.item.chat.spawnKey) : null;
                  const isEmailChat = (row: (typeof nestedRows)[number]) =>
                    row.item.kind === "bot" && isMailThreadAgentSpawnKey(rowKey(row));
                  const isPageAgent = (row: (typeof nestedRows)[number]) =>
                    row.item.kind === "bot" &&
                    (pageAgentKind(rowKey(row)) !== null ||
                      isGtmAgentSpawnKey(rowKey(row)) ||
                      isIntegrationAgentSpawnKey(rowKey(row)));
                  const foldable = !rail && !folder && group.kind !== "pinned";
                  // A page makes its agent when opened; it is listed once it has a message or a run.
                  const unusedPageAgent = (row: (typeof nestedRows)[number]) =>
                    row.item.kind === "bot" &&
                    isPageAgent(row) &&
                    !row.item.chat.preview &&
                    row.item.chat.status === "idle" &&
                    row.item.chat.id !== active?.id;
                  const inActivity = (row: (typeof nestedRows)[number]) =>
                    activityMode &&
                    !rail &&
                    row.item.kind === "bot" &&
                    activityBotIds.has(row.item.chat.id) &&
                    row.item.chat.id !== active?.id;
                  const listedRows = (
                    foldable ? nestedRows.filter((row) => !unusedPageAgent(row)) : nestedRows
                  ).filter((row) => !inActivity(row));
                  const pageAgentRows = foldable ? listedRows.filter(isPageAgent) : [];
                  const emailChatRows = foldable ? listedRows.filter(isEmailChat) : [];
                  const holdsActive = (rows: typeof nestedRows) =>
                    rows.some((row) => row.item.kind === "bot" && row.item.chat.id === active?.id);
                  // On a page the group keeps the state the person gave it; the page's own row is highlighted elsewhere.
                  const showPageAgents =
                    pageAgentsOpen || (!pageMode && holdsActive(pageAgentRows));
                  const showEmailChats = emailChatsOpen || holdsActive(emailChatRows);
                  const displayRows: (
                    | (typeof nestedRows)[number]
                    | { foldHeader: "page" | "email" }
                  )[] =
                    pageAgentRows.length || emailChatRows.length
                      ? [
                          ...listedRows.filter((row) => !isPageAgent(row) && !isEmailChat(row)),
                          ...(pageAgentRows.length ? [{ foldHeader: "page" as const }] : []),
                          // Open only because the chat is a page agent: list just that one.
                          ...(showPageAgents
                            ? pageAgentsOpen
                              ? pageAgentRows
                              : pageAgentRows.filter(
                                  (row) =>
                                    row.item.kind === "bot" && row.item.chat.id === active?.id,
                                )
                            : []),
                          ...(emailChatRows.length ? [{ foldHeader: "email" as const }] : []),
                          ...(showEmailChats ? emailChatRows : []),
                        ]
                      : listedRows;
                  const treeActive = nestedRows.some((row) => row.depth > 0 || row.hasChildren);
                  // Reorder among visible siblings so keyboard and drag moves match the tree.
                  const siblingBotIds = (parentId: string | null) =>
                    nestedRows.flatMap((row) =>
                      row.item.kind === "bot" && row.parentId === parentId
                        ? [row.item.chat.id]
                        : [],
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
                          readOnly={!activeSpace}
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
                          data-roster-item={group.key}
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
                              data-roster-row={group.key}
                              data-sidebar-current={group.current ? "" : undefined}
                              title={group.relabeled ? group.spaceName : undefined}
                              className={`flex min-w-0 items-center justify-between gap-2 rounded-lg px-2.5 py-1 text-[11px] font-semibold tracking-wider uppercase ${group.current ? "text-foreground" : "text-foreground/70"} hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring ${hasSpaceActions ? "col-start-1 row-start-1 w-full pe-8" : "flex-1"}`}
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
                              className={`focus-visible:ring-0 focus-visible:outline-solid focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring ${
                                group.title
                                  ? "col-start-1 row-start-1 justify-self-end self-center"
                                  : ""
                              }`}
                              data-roster-actions=""
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
                      {!rail &&
                      group.kind === "root" &&
                      group.parentKey &&
                      group.bots.length > 0 ? (
                        <div className="mt-1 px-2.5 py-1.5 text-[13px] font-medium text-foreground/80">
                          <Trans>Chats</Trans>
                        </div>
                      ) : null}
                      {rail || !collapsed ? (
                        <SortableList
                          ids={displayRows.flatMap((row) =>
                            "item" in row
                              ? [itemDragId({ kind: row.item.kind, id: row.item.chat.id })]
                              : [],
                          )}
                        >
                          {displayRows.map((displayRow) => {
                            if ("foldHeader" in displayRow) {
                              const email = displayRow.foldHeader === "email";
                              const rows = email ? emailChatRows : pageAgentRows;
                              const held = rows.map((row) =>
                                row.item.kind === "bot"
                                  ? rosterHeldFor(row.item.chat.status)
                                  : null,
                              );
                              const heldFor = held.includes("answer")
                                ? "answer"
                                : held.includes("takeover")
                                  ? "takeover"
                                  : null;
                              return (
                                <PageAgentsRow
                                  key={displayRow.foldHeader}
                                  label={email ? t`Email chats` : t`Page agents`}
                                  testId={email ? "sidebar-email-chats" : undefined}
                                  open={email ? showEmailChats : showPageAgents}
                                  count={rows.length}
                                  needsYou={
                                    heldFor !== null ||
                                    rows.some(
                                      (row) =>
                                        row.item.chat.unread || glance.botKinds[row.item.chat.id],
                                    )
                                  }
                                  heldFor={heldFor}
                                  onToggle={() =>
                                    email
                                      ? setEmailChatsOpen((open) => !open)
                                      : setPageAgentsOpen((open) => !open)
                                  }
                                />
                              );
                            }
                            const { item, depth, hasChildren, parentId } = displayRow;
                            const parentCollapsed =
                              hasChildren && collapsedRosterParents.has(item.chat.id);
                            const selected =
                              (item.kind === "bot" &&
                                !inGroup &&
                                !pageMode &&
                                active?.id === item.chat.id) ||
                              (item.kind === "group" &&
                                inGroup &&
                                activeGroup?.id === item.chat.id);
                            const compact = botsSidebarDensity === "compact";
                            const workStatusLabel =
                              item.kind === "bot"
                                ? maskOptional(
                                    rosterWorkStatusLabel(item.chat.status, item.chat.runPhase),
                                  )
                                : null;
                            // Ink for work in progress; only a waiting question uses a status colour.
                            const workTone =
                              item.kind === "bot" && item.chat.status === "waiting_input"
                                ? "text-warning"
                                : "text-foreground";
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
                                      compactRosterStatusLabel(
                                        item.chat.status,
                                        item.chat.runPhase,
                                      ),
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
                                    data-roster-item={item.chat.id}
                                    data-tour={
                                      item.chat.id === chiefId ? "sidebar-chat" : undefined
                                    }
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
                                        data-roster-row={item.chat.id}
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
                                            onAttachmentPick(
                                              event.dataTransfer.files,
                                              item.chat.id,
                                            );
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
                                                  className={`min-w-0 truncate text-[14.5px] leading-[18px] font-normal text-foreground ${
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
                                              <div className="flex shrink-0 items-center gap-1.5 group-hover/row:pointer-fine:opacity-0 pointer-coarse:me-9">
                                                {/* Roomy rows show the status mark on the preview line, so a Working row keeps its height. */}
                                                {compact &&
                                                item.kind === "bot" &&
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
                                                        ? `font-semibold ${workTone}`
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
                                                className={`flex items-center gap-1.5 text-[12px] leading-[18px] ${
                                                  workStatusLabel
                                                    ? `font-semibold ${workTone}`
                                                    : item.chat.unread
                                                      ? "font-medium text-foreground/75"
                                                      : "text-muted-foreground"
                                                }`}
                                              >
                                                {item.kind === "bot" &&
                                                glance.botKinds[item.chat.id] ? (
                                                  <StatusMark
                                                    kind={glance.botKinds[item.chat.id]!}
                                                    botId={item.chat.id}
                                                  />
                                                ) : null}
                                                <span className="min-w-0 truncate">
                                                  {rosterLine}
                                                </span>
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
                                        data-roster-actions=""
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
                                        className={`absolute end-2 top-1.5 size-7 rounded-lg text-muted-foreground opacity-0 hover:bg-background/60 hover:text-foreground focus-visible:opacity-100 focus-visible:ring-0 focus-visible:outline-solid focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring group-hover/row:opacity-100 pointer-coarse:top-0 pointer-coarse:size-11 pointer-coarse:opacity-100 ${
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
                {rail ? null : <RootEnd />}
              </SidebarDnd>
            </>
            {archivedBots.length + archivedGroups.length > 0 && !rail ? (
              <div className="mt-2 border-t border-border pt-2">
                <button
                  type="button"
                  aria-expanded={archivedOpen}
                  onClick={() => setArchivedOpen((open) => !open)}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-[13.5px] text-muted-foreground hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
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
                        <BotAvatar
                          color={bot.color}
                          identity={bot.id}
                          size={28}
                          status={bot.status}
                        />
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
                      <div
                        key={group.id}
                        className="flex items-center gap-2 rounded-lg px-2.5 py-2"
                      >
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
                            void rpc.groups
                              .restore({ groupId: group.id })
                              .then(() => refreshBots(true))
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
          userId={userId}
          onAsk={() => {
            if (!chiefId) return;
            tourQuestion.current = true;
            setFocusComposerBotId(chiefId);
            openBot(chiefId);
          }}
          // The chip waits in Chief's composer; Skip leaves the person on the page they are on.
          onSkip={() => setAskChiefChip(true)}
          onClose={(me, byEscape) => {
            setTourRestart(false);
            setTourEnded(true);
            // Escape ends only the tour; the drawer it opened closes on the next press.
            if (!byEscape) setMobileSidebarOpen(false);
            setBootstrapMe((current) => me ?? (current && { ...current, tourSeen: true }));
          }}
        />
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger
            data-testid="user-menu-trigger"
            data-tour="user-menu"
            aria-label={rail ? userName : undefined}
            className={`flex items-center gap-[11px] rounded-lg py-3.5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring ${
              rail ? "justify-center px-0" : "px-[18px]"
            }`}
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-[12px] text-foreground/75">
              {initials}
            </span>
            {rail ? null : <span className="text-[14.5px] text-foreground/90">{userName}</span>}
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="start"
            alignOffset={11}
            role="menu"
            className="w-[calc(316px-1.5rem)] max-w-[calc(100vw-3rem)] gap-0 p-1 data-closed:animate-none"
          >
            {bootstrapMe?.ticketBoardEnabled && glance.hasTickets ? (
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
                setMobileSidebarOpen(false);
                openSettings("general");
              }}
            >
              <Settings className="text-muted-foreground" strokeWidth={1.75} />
              <Trans>Settings</Trans>
            </Button>
            <Button
              role="menuitem"
              variant="ghost"
              className="w-full justify-start font-normal"
              data-testid="menu-integrations"
              onClick={() => {
                setMenuOpen(false);
                setMobileSidebarOpen(false);
                navigate("/app/integrations");
              }}
            >
              <LayoutGrid className="text-muted-foreground" strokeWidth={1.75} />
              <Trans>Integrations</Trans>
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
                  clearTourStep(userId);
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
        </Popover>
      </aside>

      {/* The full-screen computer covers the sidebar, so its edge must not catch clicks there. */}
      {computerOpen || booting ? null : (
        <button
          type="button"
          data-testid="bots-sidebar-edge"
          aria-label={t`Resize sidebar`}
          tabIndex={-1}
          className={`absolute inset-y-0 z-50 hidden w-2 cursor-ew-resize touch-none border-0 bg-transparent p-0 focus-visible:bg-ring focus-visible:outline-none lg:block ${
            botsSidebarCollapsed ? "start-12" : "start-[308px]"
          }`}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            botsSidebarEdgeDragRef.current = {
              startX: event.clientX,
              mode: botsSidebarCollapsed ? "expand" : "collapse",
            };
          }}
          onPointerMove={(event) => {
            const drag = botsSidebarEdgeDragRef.current;
            if (!drag) return;
            const rtl =
              typeof document !== "undefined" &&
              document.documentElement.getAttribute("dir") === "rtl";
            const delta = rtl ? drag.startX - event.clientX : event.clientX - drag.startX;
            if (drag.mode === "expand" && delta >= BOTS_SIDEBAR_EDGE_DRAG_PX) {
              botsSidebarEdgeDragRef.current = null;
              setBotsSidebarCollapsedPref(false);
            } else if (drag.mode === "collapse" && delta <= -BOTS_SIDEBAR_EDGE_DRAG_PX) {
              botsSidebarEdgeDragRef.current = null;
              setBotsSidebarCollapsedPref(true);
            }
          }}
          onPointerUp={(event) => {
            const drag = botsSidebarEdgeDragRef.current;
            botsSidebarEdgeDragRef.current = null;
            if (!drag) return;
            if (Math.abs(event.clientX - drag.startX) < BOTS_SIDEBAR_EDGE_DRAG_PX) {
              setBotsSidebarCollapsedPref(!botsSidebarCollapsed);
            }
          }}
          onPointerCancel={() => {
            botsSidebarEdgeDragRef.current = null;
          }}
        />
      )}

      {/* Keep the composer's z-index inside the chat so phone overlays like the side panel cover it. */}
      <PageNavContext.Provider value={pageNav}>
        <main
          id={MAIN_CONTENT_ID}
          tabIndex={-1}
          aria-hidden={mobileSidebarOpen || undefined}
          inert={mobileSidebarOpen}
          data-dragging={paneDraggingFiles ? "files" : undefined}
          onDragEnter={onPaneFileDrag}
          onDragOver={onPaneFileDrag}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null))
              setPaneDraggingFiles(false);
          }}
          onDrop={(event) => {
            if (!paneAcceptsFiles || !isUnclaimedFileDrag(event)) return;
            event.preventDefault();
            setPaneDraggingFiles(false);
            if (!composerDisabled) onAttachmentPick(event.dataTransfer.files);
          }}
          className={`isolate flex min-w-0 flex-1 flex-col bg-background outline-none ${
            paneDraggingFiles ? "ring-2 ring-inset ring-ring" : ""
          }`}
        >
          {/* Pages carry their own h1; a chat's title is inside a button, so it is named here. */}
          {pageMode ? null : (
            <h1 className="sr-only">
              {inGroup
                ? (activeGroup?.name ?? activeSnapshot?.groupName ?? t`Group`)
                : (active?.name ?? "")}
            </h1>
          )}
          {/* Inside main so the composer and its menus stay above it. As wide as the
            12px phone gutter only, so it never covers a tappable control; the swipe
            itself is detected on the shell root from a wider edge zone. */}
          {!mobileSidebarOpen ? (
            <div
              data-testid="mobile-sidebar-swipe-edge"
              aria-hidden="true"
              className="absolute bottom-20 start-0 top-16 z-20 w-3 touch-none lg:hidden"
            />
          ) : null}
          {/* Page modes keep only the navigation controls, so phones can still open the sidebar. */}
          <div
            className={`app-drag flex items-center justify-between px-3 lg:px-[22px] ${
              pageMode
                ? `${TOP_BAR_HEIGHT}${botsSidebarCollapsed && desktopBridge() ? "" : " lg:hidden"}${headerMenus > 0 ? " max-lg:hidden" : ""}`
                : `border-b border-sidebar-border ${TOP_BAR_HEIGHT}`
            }`}
          >
            <div className="flex min-w-0 items-center gap-2">
              {/* Collapsed bots sidebar: this header is the leading edge for window chrome. */}
              {showHeaderWindowChrome(botsSidebarCollapsed, sidebarDocked) && desktopBridge() ? (
                <WindowChrome />
              ) : null}
              <button
                type="button"
                aria-label={t`Open navigation`}
                onClick={() => setMobileSidebarOpen(true)}
                className="app-no-drag grid h-8 w-8 shrink-0 place-items-center rounded-lg text-foreground/75 hover:bg-accent lg:hidden"
              >
                <Menu size={19} strokeWidth={1.7} />
              </button>
              {botsSidebarCollapsed && (!pageMode || desktopBridge()) ? (
                <button
                  type="button"
                  data-testid="restore-bots-sidebar"
                  aria-label={t`Show sidebar`}
                  title={t`Show sidebar`}
                  onClick={() => setBotsSidebarCollapsedPref(false)}
                  className="app-no-drag hidden h-8 w-8 shrink-0 place-items-center rounded-lg text-foreground/75 hover:bg-accent lg:grid"
                >
                  <PanelLeftOpen size={19} strokeWidth={1.7} aria-hidden="true" />
                </button>
              ) : null}
              {pageMode ? null : (
                <button
                  type="button"
                  data-testid="bot-settings-trigger"
                  onClick={() => setPanel(inGroup ? "group-settings" : "settings")}
                  className="app-no-drag flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {inGroup ? (
                    <GroupAvatar
                      members={activeSnapshot?.members ?? activeGroup?.members ?? []}
                      size={26}
                    />
                  ) : active ? (
                    <AgentAvatar
                      app={agentAppFor(active.id, active.spaceId)}
                      color={active.color}
                      identity={active.id}
                      size={26}
                      status={active.status}
                    />
                  ) : null}
                  <span className="min-w-0">
                    <span
                      className="block truncate text-[16px] font-medium text-foreground"
                      dir="auto"
                    >
                      {inGroup
                        ? (activeGroup?.name ?? activeSnapshot?.groupName ?? t`Group`)
                        : (active?.name ?? (opening ? "" : t`Select a bot`))}
                    </span>
                  </span>
                  {!inGroup && active?.audience === "external" ? <BotAudienceTag /> : null}
                </button>
              )}
            </div>
            <div className="flex items-center gap-1">
              {inGroup && !pageMode && activeGroup ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  data-testid="group-settings-button"
                  title={t`Members and settings`}
                  aria-label={t`Members and settings`}
                  onClick={() => setPanel(panel === "group-settings" ? null : "group-settings")}
                  data-active={panel === "group-settings" ? "" : undefined}
                  className="app-no-drag data-active:bg-accent"
                >
                  <Users size={18} strokeWidth={1.6} className="text-foreground/75" />
                </Button>
              ) : null}
              {!inGroup && !pageMode && active && pageBotId === active.id ? (
                <button
                  type="button"
                  title={t`Page`}
                  aria-label={t`Page`}
                  onClick={() => setPanel(panel === "page" ? null : "page")}
                  data-active={panel === "page" ? "" : undefined}
                  className="app-no-drag grid h-[30px] w-[34px] place-items-center rounded-[9px] hover:bg-accent data-active:bg-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                >
                  <FileText size={18} strokeWidth={1.6} className="text-foreground/75" />
                </button>
              ) : null}
              {!inGroup && !pageMode && active && botPins?.list ? (
                <button
                  type="button"
                  title={t`List`}
                  aria-label={t`List`}
                  onClick={() => setPanel(panel === "list" ? null : "list")}
                  data-active={panel === "list" ? "" : undefined}
                  className={`app-no-drag grid h-[30px] w-[34px] place-items-center rounded-[9px] hover:bg-accent data-active:bg-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring ${panel === null ? "xl:hidden" : ""}`}
                >
                  <ListTodo size={18} strokeWidth={1.6} className="text-foreground/75" />
                </button>
              ) : null}
              {!inGroup && !pageMode && active ? (
                <button
                  type="button"
                  data-testid="computer-routines-button"
                  title={noComputerScreen ? t`Routines` : t`Computer and routines`}
                  aria-label={noComputerScreen ? t`Routines` : t`Computer and routines`}
                  onClick={() => {
                    const next = panel === "computer" ? null : "computer";
                    setPanel(next);
                    if (next === "computer" && active) {
                      // Refresh run/computer so Take control isn't stuck on a stale busyBotName.
                      void refreshThread(active.id).catch(() => undefined);
                    }
                  }}
                  data-active={panel === "computer" ? "" : undefined}
                  className="app-no-drag grid h-[30px] w-[34px] place-items-center rounded-[9px] hover:bg-accent data-active:bg-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                >
                  {noComputerScreen ? (
                    <Clock size={18} strokeWidth={1.6} className="text-foreground/75" />
                  ) : (
                    <Monitor size={18} strokeWidth={1.6} className="text-foreground/75" />
                  )}
                </button>
              ) : null}
            </div>
          </div>
          {integrationsMode ? (
            <ErrorBoundary fallback={<SectionLoadFailed />}>
              <IntegrationsPage
                activeBotId={activeBotId.current}
                onOpenMessaging={() => setMessagingSettingsOpen(true)}
                onOpenAiDataSharing={() => openSettings("general")}
              />
            </ErrorBoundary>
          ) : dataRoomMode ? (
            <DataRoomPage
              onAskAgent={dataRoomAgentOpen ? undefined : askDataRoomAgent}
              onOpenModelSettings={() => openSettings("models")}
              agents={sendToAgentTargets}
              onSendToAgent={(items, agent) => void sendFilesToAgent(items, agent)}
              spaceName={
                spaces.length > 1
                  ? spaces.find((space) => space.id === bootstrapMe?.spaceId)?.name
                  : undefined
              }
            />
          ) : contactsMode ? (
            <ContactsPage spaceName={pageSpaceName} onAskAgent={askChief} />
          ) : artifactsMode ? (
            <ErrorBoundary fallback={<SectionLoadFailed />}>
              <Suspense fallback={<RowsSkeleton className="p-6" />}>
                <ArtifactsPage spaceName={pageSpaceName} onAskAgent={askChief} />
              </Suspense>
            </ErrorBoundary>
          ) : boardMode ? (
            <ErrorBoundary fallback={<SectionLoadFailed />}>
              <Suspense fallback={<RowsSkeleton className="p-6" />}>
                <BoardPage embedded />
              </Suspense>
            </ErrorBoundary>
          ) : financeMode ? (
            <FinancePage
              onAskAgent={financeAgentOpen ? undefined : askFinanceAgent}
              spaces={spaces}
              spaceId={bootstrapMe?.spaceId}
              onSwitchSpace={(spaceId) => {
                // Like opening another space's chat: the auth boundary changes, so reload. A detail
                // page belongs to this space, so the other space opens on its dashboard.
                if (selectSpace(spaceId)) window.location.assign("/app/finance");
              }}
            />
          ) : legalMode ? (
            <LegalPage
              onAskAgent={legalAgentOpen ? undefined : askLegalAgent}
              onAskAbout={askLegalAgentAbout}
              onConsentChange={setLegalConsentMissing}
              onOpenSettings={() => openSettings("models")}
              settingsOpen={settingsOpen}
              spaces={spaces}
              spaceId={bootstrapMe?.spaceId}
              onSwitchSpace={(spaceId) => {
                // Like Finance: the auth boundary changes, so reload on the other space's Legal page.
                if (selectSpace(spaceId)) window.location.assign("/app/legal");
              }}
            />
          ) : gtmMode ? (
            <GtmPage
              key={bootstrapMe?.spaceId}
              botId={active?.id}
              remote={pageRemote}
              onAskAgent={askGtmAgent}
              agentOpen={gtmAgentOpen}
            />
          ) : devinMode ? (
            <DevinPage
              key={devinPageKey}
              onAskAgent={devinAgentOpen ? undefined : askDevinAgent}
              onConnect={() => setDevinDialog("connect")}
              onReconnect={() => setDevinDialog("replace")}
            />
          ) : investorsMode && investorUpdateMatch?.params.id ? (
            <UpdateEditor
              key={investorUpdateMatch.params.id}
              updateId={investorUpdateMatch.params.id}
            />
          ) : fundraisingMode ? (
            <FundraisingPage
              spaceName={pageSpaceName}
              onShowAgent={investorsPanel.open ? undefined : askInvestorsAgent}
              agentBusy={transcriptRunning}
            />
          ) : investorsMode ? (
            <InvestorsPage
              onShowAgent={investorsPanel.open ? undefined : askInvestorsAgent}
              onCartaStatus={setCartaConnected}
              onOpenModelSettings={() => openSettings("models")}
              needsModel={bootstrapMe?.needsModel === true}
              agentBusy={transcriptRunning}
            />
          ) : inboxMode ? (
            <InboxPage
              paused={false}
              onShowAgent={
                inboxAgentHidden
                  ? () => {
                      setInboxAgentCollapsedPref(false);
                      setShowEmptyInboxAgent(true);
                    }
                  : undefined
              }
              onRefreshed={refreshInboxUnread}
              onOpenAgent={async (bot) => {
                await refreshBots();
                setFocusComposerBotId(bot.id);
                openBot(bot.id);
              }}
              onConnectMail={() =>
                navigate("/app/integrations?connect=gmail&returnTo=/app/inbox", {
                  state: { connectNow: true },
                })
              }
              onReconnectMail={() => navigate("/app/integrations?open=gmail&returnTo=/app/inbox")}
              onAllowMailRules={(connectionId) =>
                navigate(
                  appPath(
                    { connectorId: "google", slug: "gmail" },
                    { reconnect: connectionId, next: "/app/inbox?cleanup=1" },
                  ),
                )
              }
              spaceName={
                spaces.length > 1
                  ? spaces.find((space) => space.id === bootstrapMe?.spaceId)?.name
                  : undefined
              }
            />
          ) : opening ? (
            <OpeningSpace />
          ) : !active && !activeGroup ? (
            <div className="grid flex-1 place-items-center">
              <Button onClick={() => void createBot()}>
                <Plus size={16} aria-hidden="true" />
                <Trans>New bot</Trans>
              </Button>
            </div>
          ) : (
            threadView
          )}
        </main>
      </PageNavContext.Provider>

      <CallCard onSettings={() => openSettings("voice")} />

      <ResizableSidePanel
        botsSidebarCollapsed={botsSidebarCollapsed}
        open={agentPanel ? agentPanel.open : Boolean(panel && (active || activeGroup))}
        panel={agentPanel ? agentPanel.name : (panel ?? "closed")}
      >
        {agentPanel ? (
          agentPanel.open ? (
            <div data-testid={agentPanel.testId} className="flex h-full min-h-0 w-full flex-col">
              <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-2">
                {active ? (
                  <button
                    type="button"
                    aria-label={t`Open ${active.name} full screen`}
                    title={t`Open full screen`}
                    onClick={() => openBot(active.id)}
                    className="-mx-1.5 flex min-w-0 items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                  >
                    <AgentAvatar
                      app={agentAppFor(active.id, active.spaceId)}
                      color={active.color}
                      identity={active.id}
                      size={22}
                      status={active.status}
                    />
                    <span className="truncate text-sm font-medium" dir="auto">
                      {active.name}
                    </span>
                  </button>
                ) : (
                  <span />
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={agentPanel.collapseLabel}
                  onClick={agentPanel.collapse}
                >
                  <PanelRightClose aria-hidden="true" />
                </Button>
              </div>
              {active ? (
                <>
                  {transcriptMessages.length === 0 &&
                  !transcriptRunning &&
                  !inboxMode &&
                  (!investorsMode || activeSnapshot) ? (
                    <AgentPanelIntro
                      description={
                        devinMode
                          ? t`Answers questions about what Devin is working on.`
                          : active.description
                      }
                      suggestions={agentPanel.suggestions ?? []}
                      onAddModel={pageAgentNeedsModel ? () => openSettings("models") : undefined}
                      disabled={sending}
                      onPick={(text) => void sendMessage(text, [], newClientId())}
                    />
                  ) : null}
                  {threadView}
                </>
              ) : (
                <div className="grid flex-1 place-content-center justify-items-center gap-3 px-5">
                  {agentPanel.create ? (
                    <Button
                      disabled={agentPanel.creating}
                      onClick={() => void agentPanel.create?.()}
                    >
                      {agentPanel.createLabel}
                    </Button>
                  ) : agentPanel.creating ? (
                    <Spinner aria-label={t`Loading`} />
                  ) : null}
                  {agentPanel.error ? (
                    <p role="alert" className="text-center text-sm text-destructive">
                      {agentPanel.error}
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          ) : null
        ) : panel && (active || activeGroup) ? (
          <div className="rk-scroll h-full w-full overflow-y-auto px-5 py-[17px]">
            {panel !== "routine" && panel !== "create-group" && panel !== "group-settings" ? (
              <div className="sticky top-[-17px] z-10 -mx-5 -mt-[17px] mb-4 flex items-center justify-between border-b border-border bg-background px-5 pt-[17px] pb-2">
                <span
                  className="min-w-0 truncate text-[13.5px] text-muted-foreground"
                  title={panel === "settings" && active ? t`${active.name} settings` : undefined}
                >
                  {panel === "settings" ? (
                    active ? (
                      t`${active.name} settings`
                    ) : (
                      <Trans>Settings</Trans>
                    )
                  ) : panel === "page" ? (
                    <Trans>Page</Trans>
                  ) : panel === "list" ? (
                    <Trans>List</Trans>
                  ) : active ? (
                    computerScreenError || noComputerScreen ? null : (
                      computerStateLabel(computer?.state)
                    )
                  ) : (
                    <Trans>Group</Trans>
                  )}
                </span>
                <div className="flex shrink-0 gap-1">
                  {active &&
                  panel === "computer" &&
                  !computerOpen &&
                  computerPanelNeedsMaintenance(computer?.state, booting) ? (
                    <ComputerMaintenanceActions
                      botId={active.id}
                      computer={computer}
                      onChanged={async () => {
                        await refreshThread(active.id);
                      }}
                    />
                  ) : null}
                  {/* The Monitor button in the chat header is the way back to the computer. */}
                  {active && panel !== "settings" ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t`Show settings`}
                      onClick={() => setPanel("settings")}
                      className="text-muted-foreground"
                    >
                      <Settings size={16} strokeWidth={1.7} />
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t`Close panel`}
                    onClick={() => setPanel(null)}
                  >
                    <X size={16} strokeWidth={1.8} />
                  </Button>
                </div>
              </div>
            ) : null}
            {panel === "page" && active ? (
              <BotPagePanel key={active.id} botId={active.id} remote={pageRemote} />
            ) : null}
            {panel === "list" && botPins?.list ? (
              <PinsList pins={botPins} onPins={setBotPins} />
            ) : null}
            {panel === "computer" && active ? (
              <div>
                <RoutineListHeader
                  onCreate={() => {
                    setRoutineDraft(emptyRoutineDraft());
                    setRoutineWebhookSecret(null);
                    setEditingRoutine(null);
                    setRoutineError(null);
                    setPanel("routine");
                  }}
                />
                {activeRoutines.map((routine) => {
                  const routineRunning =
                    snapshot?.run?.routineId === routine.id && isActive(snapshot.run.status);
                  return (
                    <RoutineListRow
                      key={routine.id}
                      routine={routine}
                      running={routineRunning}
                      onOpen={() => {
                        setRoutineDraft(draftFromRoutine(routine));
                        setRoutineWebhookSecret(null);
                        setEditingRoutine(routine);
                        setRoutineError(null);
                        setPanel("routine");
                      }}
                      onStop={() => void stopRun()}
                    />
                  );
                })}
                {noComputerScreen ? null : (
                  <>
                    <div
                      data-testid="computer-preview"
                      className={`group relative rounded-[14px] bg-background ${
                        showingRecoveryHint ? "" : "aspect-[16/10] overflow-hidden"
                      }`}
                    >
                      {computerOpen ? (
                        <div className="grid h-full place-items-center text-sm text-muted-foreground/80">
                          <Trans>Open in full window</Trans>
                        </div>
                      ) : computer?.kind === "desktop" ? (
                        <DesktopKindEmptyState className="grid h-full place-items-center px-6 text-center text-sm text-muted-foreground/80" />
                      ) : computer?.state === "running" &&
                        embeddedScreenUrl &&
                        !computerScreenError ? (
                        <iframe
                          title={t`Bot screen preview`}
                          src={embeddedScreenUrl}
                          sandbox={screenIframeSandbox(embeddedScreenUrl)}
                          className="h-full w-full border-0 bg-background"
                          allow="clipboard-read; clipboard-write"
                          style={{ pointerEvents: "none" }}
                        />
                      ) : (
                        <div className="grid h-full place-items-center px-6 text-center text-sm text-muted-foreground/80">
                          {computerScreenError ??
                            (showComputerRecoveryHint ? (
                              <ComputersUnavailableHint
                                sandboxProvider={bootstrapMe?.sandboxProvider}
                                onRecovered={(sandboxProvider) => {
                                  setBootstrapMe((prev) =>
                                    prev ? { ...prev, sandboxProvider } : prev,
                                  );
                                  holdComputerRecovery();
                                }}
                                onRecoveryDismissed={releaseComputerRecovery}
                                onOpenComputerSettings={
                                  bootstrapMe?.isDeploymentOwner === true
                                    ? () => openSettings("computer")
                                    : undefined
                                }
                              />
                            ) : (
                              computerPlaceholder(
                                computer?.state,
                                booting,
                                computerLabel(computer?.mode, active.name),
                              )
                            ))}
                        </div>
                      )}
                      {!computerScreenError && !showingRecoveryHint ? (
                        <button
                          type="button"
                          data-testid="computer-preview-open"
                          className="absolute inset-0 flex cursor-pointer items-center justify-center bg-overlay/40 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                          aria-label={t`Open`}
                          onClick={() => void openComputer()}
                        >
                          <span className="inline-flex items-center gap-2 rounded-full bg-overlay px-3.5 py-2 text-[14px] text-foreground shadow-md">
                            <Maximize2 size={15} strokeWidth={1.9} aria-hidden />
                            <Trans>Open</Trans>
                          </span>
                        </button>
                      ) : null}
                    </div>
                    <p className="mt-2 truncate text-[13.5px] text-muted-foreground" dir="auto">
                      {/s$/i.test(active.name.trim())
                        ? t`${active.name}' computer`
                        : t`${active.name}'s computer`}
                    </p>
                  </>
                )}
              </div>
            ) : null}
            {panel === "create-group" ? (
              <CreateGroupForm
                bots={bots}
                onCancel={() => setPanel(null)}
                onCreate={(input) => createGroup(input)}
              />
            ) : null}
            {panel === "group-settings" && activeGroup ? (
              <GroupSettings
                key={activeGroup.id}
                group={activeGroup}
                bots={bots}
                onSave={async (input) => {
                  const updated = await rpc.groups.update({ groupId: activeGroup.id, ...input });
                  setGroups((current) =>
                    current.map((group) => (group.id === updated.id ? updated : group)),
                  );
                  void Promise.all([refreshBots(), refreshGroupThread(activeGroup.id)]).catch(
                    () => undefined,
                  );
                }}
                onRemove={async () => {
                  await rpc.groups.remove({ groupId: activeGroup.id });
                  const remainingGroups = groups.filter((group) => group.id !== activeGroup.id);
                  setGroups(remainingGroups);
                  setPanel(null);
                  navigate(firstThreadRoute(bots, remainingGroups), { replace: true });
                  await refreshBots().catch(() => undefined);
                }}
                onClose={() => setPanel(null)}
                covered={computerOpen}
              />
            ) : null}
            {panel === "settings" && active ? (
              <BotSettings
                key={active.id}
                bot={active}
                focusName={namingBotId === active.id}
                memoryProviderConfigured={memoryProviderConfig != null}
                hostComputer={
                  canOfferHostComputer(bootstrapMe)
                    ? { defaultHost: bootstrapMe?.computerHost ?? "docker" }
                    : undefined
                }
                messageTargets={bots
                  .filter(
                    (bot) =>
                      bot.id !== active.id &&
                      !bot.archivedAt &&
                      bot.audience === "internal" &&
                      !isMailThreadAgentSpawnKey(bot.spawnKey),
                  )
                  .map(({ id, name }) => ({ id, name }))}
                onSkillsChange={setAgentSkills}
                skillsRefreshKey={skillsRefreshKey}
                onSave={async ({ computerMode, ...patch }) => {
                  if (computerMode !== active.computerMode) {
                    await rpc.bots.setComputer({
                      botId: active.id,
                      mode: computerMode,
                    });
                  }
                  const updated = await rpc.bots.update({ botId: active.id, ...patch });
                  setBots((current) =>
                    current.map((bot) => (bot.id === updated.id ? updated : bot)),
                  );
                  // Persistence succeeded; a failed navigation refresh must not undo the tool edit.
                  await refreshBots().catch(() => undefined);
                }}
                onExport={async () => {
                  const manifest = await rpc.export.bot({ botId: active.id });
                  const blob = new Blob([JSON.stringify(manifest, null, 2)], {
                    type: "application/json",
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${active.name.toLowerCase().replace(/\s+/g, "-")}-export.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                onClear={() => setClearTarget({ kind: "bot", chat: active })}
              />
            ) : null}
            {panel === "routine" && active ? (
              <RoutineEditor
                draft={routineDraft}
                onChange={setRoutineDraft}
                editing={editingRoutine}
                timezone={editingRoutine?.timezone ?? accountTimezone(bootstrapMe)}
                webhook={{
                  path:
                    typeof window !== "undefined"
                      ? `${window.location.origin}/api/v1/bots/${active.id}/webhook`
                      : `/api/v1/bots/${active.id}/webhook`,
                  secret: routineWebhookSecret,
                  configured: active.webhookConfigured || Boolean(routineWebhookSecret),
                }}
                githubPath={
                  typeof window !== "undefined"
                    ? `${window.location.origin}/api/v1/bots/${active.id}/github`
                    : `/api/v1/bots/${active.id}/github`
                }
                messageProviders={messagingProviders}
                skills={agentSkills}
                saving={savingRoutine}
                // Stays on until the run itself finishes, not just until the request returns.
                running={
                  runningRoutine ||
                  Boolean(
                    editingRoutine &&
                      snapshot?.run?.routineId === editingRoutine.id &&
                      isActive(snapshot.run.status),
                  )
                }
                error={routineError}
                onBack={() => setPanel("computer")}
                onClose={() => setPanel(null)}
                onEnsureWebhook={async () => {
                  await ensureWebhookSecret(active.id);
                }}
                onSave={async () => {
                  if (routineSavePending.current) return;
                  const targetBotId = active.id;
                  const targetRoutine = editingRoutine;
                  if (targetRoutine && targetRoutine.botId !== targetBotId) return;
                  if (
                    !routineDraft.schedules.length &&
                    !routineDraft.webhookEnabled &&
                    !routineDraft.githubEnabled &&
                    !routineDraft.messageProvider
                  ) {
                    setRoutineError(t`Add a schedule, webhook, GitHub, or message trigger`);
                    return;
                  }
                  if (!routineDraft.prompt.trim()) {
                    setRoutineError(t`Write what this routine should do each time it runs.`);
                    return;
                  }
                  const saveRequest = ++routineSaveRequest.current;
                  routineSavePending.current = true;
                  setSavingRoutine(true);
                  setRoutineError(null);
                  try {
                    if (
                      (routineDraft.webhookEnabled || routineDraft.githubEnabled) &&
                      !active.webhookConfigured &&
                      !routineWebhookSecret
                    ) {
                      await ensureWebhookSecret(targetBotId);
                    }
                    const crons = routineDraft.schedules.map(cronFromPreset);
                    const model = routineDraft.modelKey
                      ? parseModelOptionKey(routineDraft.modelKey)
                      : null;
                    const routineModel = {
                      modelProvider: model?.provider ?? null,
                      modelId: model?.modelId ?? null,
                      thinkingLevel: (model && routineDraft.thinkingLevel
                        ? routineDraft.thinkingLevel
                        : null) as ThinkingLevel | null,
                    };
                    let saved: Routine;
                    if (targetRoutine) {
                      const armOneShot = routineNeedsOneShotArm(targetRoutine, crons);
                      let runAt: string | undefined;
                      if (armOneShot) {
                        if (!routineDraft.runAtLocal) {
                          setRoutineError(t`Add a run time for this one-shot.`);
                          return;
                        }
                        const parsed = new Date(routineDraft.runAtLocal);
                        if (!Number.isFinite(parsed.getTime()) || parsed.getTime() <= Date.now()) {
                          setRoutineError(t`Run time must be in the future.`);
                          return;
                        }
                        runAt = parsed.toISOString();
                      }
                      saved = await rpc.routines.update({
                        routineId: targetRoutine.id,
                        name: routineDraft.name || t`Routine`,
                        prompt: routineDraft.prompt.trim(),
                        crons,
                        active: armOneShot ? true : routineDraft.active,
                        webhookEnabled: routineDraft.webhookEnabled,
                        githubEnabled: routineDraft.githubEnabled,
                        messageProvider: routineDraft.messageProvider,
                        ...(routineDraft.timezone &&
                        routineDraft.timezone !== targetRoutine.timezone
                          ? { timezone: routineDraft.timezone }
                          : {}),
                        ...(routineModel.modelProvider !== targetRoutine.modelProvider ||
                        routineModel.modelId !== targetRoutine.modelId ||
                        routineModel.thinkingLevel !== targetRoutine.thinkingLevel
                          ? routineModel
                          : {}),
                        ...(runAt ? { runAt } : {}),
                      });
                    } else {
                      saved = await rpc.routines.create({
                        botId: targetBotId,
                        name: routineDraft.name || t`Routine`,
                        prompt: routineDraft.prompt.trim(),
                        crons,
                        timezone: routineDraft.timezone || accountTimezone(bootstrapMe),
                        active: routineDraft.active,
                        notify: true,
                        webhookEnabled: routineDraft.webhookEnabled,
                        githubEnabled: routineDraft.githubEnabled,
                        messageProvider: routineDraft.messageProvider,
                        ...routineModel,
                      });
                    }
                    if (
                      routineSaveRequest.current === saveRequest &&
                      activeBotId.current === targetBotId
                    ) {
                      setEditingRoutine(saved);
                      setRoutineDraft(draftFromRoutine(saved));
                    }
                  } catch (error) {
                    if (
                      routineSaveRequest.current !== saveRequest ||
                      activeBotId.current !== targetBotId
                    ) {
                      return;
                    }
                    setRoutineError(errorText(error, t`Could not save routine`));
                    return;
                  } finally {
                    routineSavePending.current = false;
                    setSavingRoutine(false);
                  }
                  if (
                    routineSaveRequest.current !== saveRequest ||
                    activeBotId.current !== targetBotId
                  ) {
                    return;
                  }
                  await refreshThread(targetBotId).catch(() => undefined);
                }}
                onTestRun={async () => {
                  if (routineRunPending.current) return;
                  const targetBotId = active.id;
                  const targetRoutine = editingRoutine;
                  if (!targetRoutine) return;
                  routineRunPending.current = true;
                  setRunningRoutine(true);
                  setRoutineError(null);
                  try {
                    await rpc.routines.testRun({ routineId: targetRoutine.id });
                    await refreshThread(targetBotId);
                  } catch (error) {
                    if (activeBotId.current === targetBotId) {
                      setRoutineError(errorText(error, t`Could not run routine`));
                    }
                  } finally {
                    routineRunPending.current = false;
                    setRunningRoutine(false);
                  }
                }}
                onDelete={() => {
                  if (editingRoutine) {
                    setDeleteRoutineTarget(editingRoutine);
                    return;
                  }
                  setPanel("computer");
                }}
              />
            ) : null}
          </div>
        ) : null}
      </ResizableSidePanel>

      <Suspense fallback={null}>
        {contextChat && botMenu ? (
          <BotContextMenu
            bot={contextChat}
            position={botMenu.position}
            onClose={closeBotMenu}
            sections={botSections}
            onTogglePinned={() => {
              setBotMenu(null);
              const request = contextBot
                ? rpc.bots.update({ botId: contextBot.id, pinned: !contextBot.pinned })
                : rpc.groups.update({
                    groupId: contextGroup!.id,
                    pinned: !contextGroup!.pinned,
                  });
              void request.then(() => refreshBots());
            }}
            onToggleUnread={() => {
              const unread = !contextChat.unread;
              setBotMenu(null);
              if (contextBot) {
                const request = unread ? markBotUnread(contextBot.id) : markBotRead(contextBot.id);
                void request.catch(() => undefined);
              } else {
                const request = unread
                  ? rpc.threads.markUnread({ groupId: contextGroup!.id })
                  : rpc.threads.markRead({ groupId: contextGroup!.id });
                void request
                  .then(() =>
                    setGroups((current) =>
                      current.map((group) =>
                        group.id === contextGroup!.id ? { ...group, unread } : group,
                      ),
                    ),
                  )
                  .catch(() => undefined);
              }
            }}
            onMoveToSection={(sectionId) => {
              setBotMenu(null);
              if (sectionId === contextChat.sectionId) return;
              const request = contextBot
                ? rpc.bots.update({ botId: contextBot.id, sectionId })
                : rpc.groups.update({ groupId: contextGroup!.id, sectionId });
              void request.then(() => refreshBots());
            }}
            onCreateSection={() => {
              setNewSectionTarget(
                contextBot
                  ? { kind: "bot", chat: contextBot }
                  : { kind: "group", chat: contextGroup! },
              );
              setBotMenu(null);
            }}
            onRenameSection={(sectionId) => {
              const section = botSections.find((item) => item.id === sectionId);
              const spaceId = bootstrapMe?.spaceId;
              if (section && spaceId) setRenameSectionTarget({ section, spaceId });
              setBotMenu(null);
            }}
            isGroup={!contextBot}
            onRoutines={
              contextBot
                ? () => {
                    const destKey =
                      userId && bootstrapMe?.spaceId
                        ? rightPanelStorageKey(userId, bootstrapMe.spaceId, "bot", contextBot.id)
                        : null;
                    explicitPanelTarget.current = destKey;
                    pendingPanelRestore.current = null;
                    navigate(`/app/${contextBot.id}`);
                    // Routines live in the computer panel, under the bot's screen.
                    setPanelState("computer");
                    setRestoredPanelKey(destKey);
                    setBotMenu(null);
                  }
                : undefined
            }
            onEdit={() => {
              const destKey =
                userId && bootstrapMe?.spaceId
                  ? rightPanelStorageKey(
                      userId,
                      bootstrapMe.spaceId,
                      contextBot ? "bot" : "group",
                      contextChat.id,
                    )
                  : null;
              explicitPanelTarget.current = destKey;
              pendingPanelRestore.current = null;
              navigate(contextBot ? `/app/${contextBot.id}` : `/app/g/${contextGroup!.id}`);
              // Mark the destination key restored so we do not write settings onto the source chat.
              setPanelState(contextBot ? "settings" : "group-settings");
              setRestoredPanelKey(destKey);
              setBotMenu(null);
            }}
            onDuplicate={() => {
              setBotMenu(null);
              const request = contextBot
                ? rpc.bots.duplicate({ botId: contextBot.id })
                : rpc.groups.duplicate({ groupId: contextGroup!.id });
              void request.then(async (chat) => {
                await refreshBots();
                navigate(contextBot ? `/app/${chat.id}` : `/app/g/${chat.id}`);
              });
            }}
            onClear={
              contextBot
                ? undefined
                : () => {
                    setClearTarget({ kind: "group", chat: contextGroup! });
                    setBotMenu(null);
                  }
            }
            onArchive={() => {
              setBotMenu(null);
              const request = contextBot
                ? rpc.bots.archive({ botId: contextBot.id })
                : rpc.groups.archive({ groupId: contextGroup!.id });
              void request.then(() => refreshBots(true));
            }}
            onDelete={() => {
              if (contextBot) setDeleteTarget(contextBot);
              else setDeleteGroupTarget(contextGroup!);
              setBotMenu(null);
            }}
          />
        ) : null}

        {spaceMenu ? (
          <DropdownMenu
            open
            onOpenChange={(open) => {
              if (!open) closeSpaceMenu();
            }}
          >
            {/* Invisible anchor at the pointer position, mirroring the bot menu. */}
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  tabIndex={-1}
                  aria-hidden
                  className="fixed size-0 p-0 opacity-0"
                  style={{ left: spaceMenu.position.x, top: spaceMenu.position.y }}
                />
              }
            />
            <DropdownMenuContent
              aria-label={t`Actions for space`}
              align="start"
              sideOffset={0}
              className="w-[220px]"
            >
              {spaceMenu?.id === bootstrapMe?.spaceId ? (
                <>
                  <DropdownMenuItem
                    onClick={() => {
                      setSpaceMenu(null);
                      void createFolder();
                    }}
                  >
                    <FolderPlus />
                    {t`New folder`}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setSpaceMenu(null);
                      void autoGroupSidebar();
                    }}
                  >
                    <WandSparkles />
                    {t`Group chats into folders`}
                  </DropdownMenuItem>
                </>
              ) : null}
              {spaceMenuTarget?.canRename ? (
                <DropdownMenuItem
                  onClick={() => {
                    setRenameSpaceTarget(spaceMenuTarget);
                    setSpaceMenu(null);
                  }}
                >
                  <Pencil />
                  {t`Rename space`}
                </DropdownMenuItem>
              ) : null}
              {spaceMenuTarget?.canDelete ? (
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => {
                    setDeleteSpaceTarget(spaceMenuTarget);
                    setSpaceMenu(null);
                  }}
                >
                  <Trash2 />
                  {t`Delete space`}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

        {deleteTarget ? (
          <DeleteBotDialog
            bot={deleteTarget}
            onCancel={() => setDeleteTarget(null)}
            onConfirm={async (deleteMemories) => {
              await rpc.bots.remove({ botId: deleteTarget.id, deleteMemories });
              // Leave a link to the deleted chat, which no longer exists, before the list reloads.
              if (botId === deleteTarget.id) navigate("/app", { replace: true });
              setDeleteTarget(null);
              setPanel(null);
              await refreshBots(true);
            }}
          />
        ) : null}

        {deleteGroupTarget ? (
          <DeleteItemDialog
            item={deleteGroupTarget}
            noun="group"
            onCancel={() => setDeleteGroupTarget(null)}
            onConfirm={async () => {
              await rpc.groups.remove({ groupId: deleteGroupTarget.id });
              if (groupId === deleteGroupTarget.id) navigate("/app", { replace: true });
              setDeleteGroupTarget(null);
              setPanel(null);
              await refreshBots(true);
            }}
          />
        ) : null}

        {renameSpaceTarget ? (
          <RenameSpaceDialog
            space={renameSpaceTarget}
            onCancel={() => setRenameSpaceTarget(null)}
            onConfirm={async (name) => {
              const spaceId = renameSpaceTarget.id;
              await commitSpaceRename({
                rename: async () => {
                  await rpc.spaces.rename({ spaceId, name });
                },
                apply: () => {
                  setSpaces((current) =>
                    current.map((space) => (space.id === spaceId ? { ...space, name } : space)),
                  );
                },
                refresh: () => refreshBots(),
              });
              setRenameSpaceTarget(null);
            }}
          />
        ) : null}

        {deleteSpaceTarget ? (
          <DeleteItemDialog
            item={deleteSpaceTarget}
            noun="space"
            description={
              <Trans>Only empty spaces can be deleted. Delete its bots and groups first.</Trans>
            }
            onCancel={() => setDeleteSpaceTarget(null)}
            onConfirm={async () => {
              const targetId = deleteSpaceTarget.id;
              const result = await rpc.spaces.remove({ spaceId: targetId });
              setDeleteSpaceTarget(null);
              setPanel(null);
              const effectiveSpaceId = selectedSpaceId() ?? bootstrapMe?.spaceId;
              if (effectiveSpaceId === targetId) {
                // The auth boundary changed, so reload like a space switch.
                if (selectSpace(result.activeSpaceId)) {
                  window.location.assign("/app");
                  return;
                }
              }
              await refreshBots(true);
            }}
          />
        ) : null}

        {newSectionTarget ? (
          <NewBotSectionDialog
            bot={newSectionTarget.chat}
            onCancel={() => setNewSectionTarget(null)}
            onConfirm={async (name) => {
              await rpc.botSections.create(
                newSectionTarget.kind === "bot"
                  ? { botId: newSectionTarget.chat.id, name }
                  : { groupId: newSectionTarget.chat.id, name },
              );
              setNewSectionTarget(null);
              await refreshBots();
            }}
          />
        ) : null}

        {renameSectionTarget ? (
          <RenameBotSectionDialog
            section={renameSectionTarget.section}
            takenNames={(
              spaces.find((space) => space.id === renameSectionTarget.spaceId)?.botSections ?? []
            ).map((section) => section.name)}
            onCancel={() => setRenameSectionTarget(null)}
            onConfirm={async (name) => {
              await rpc.botSections.update(
                {
                  sectionId: renameSectionTarget.section.id,
                  name,
                },
                { context: { spaceId: renameSectionTarget.spaceId } },
              );
              setRenameSectionTarget(null);
              await refreshBots();
            }}
          />
        ) : null}

        {folderUndo ? (
          <SidebarUndoNotice
            message={t`Chats grouped into folders`}
            onUndo={() => void undoAutoGroup()}
            onDismiss={() => setFolderUndo(null)}
          />
        ) : null}

        <CommandPalette
          open={commandPaletteOpen}
          onOpenChange={setCommandPaletteOpen}
          // An email's chat is found once, under Chats.
          bots={bots.filter((bot) => !isMailThreadAgentSpawnKey(bot.spawnKey))}
          onSelectBot={(id) => {
            setMobileSidebarOpen(false);
            navigate(`/app/${id}`);
          }}
          pages={visiblePages}
          groups={groups.map((group) => ({
            id: group.id,
            label: group.name,
            icon: <GroupAvatar members={group.members} size={26} />,
          }))}
          onSelectPage={openAppPage}
          onSelectGroup={(id) => {
            setMobileSidebarOpen(false);
            navigate(`/app/g/${id}`);
          }}
          // Without a space heading, its menu is gone; the palette still reaches this action.
          actions={[
            { label: t`New folder`, run: () => void createFolder() },
            { label: t`Group chats into folders`, run: () => void autoGroupSidebar() },
          ]}
          searchLinks={searchPaletteLinks}
          onOpenPath={openSearchResult}
        />

        {newSpaceOpen ? (
          <NewSpaceDialog
            onCancel={() => setNewSpaceOpen(false)}
            onConfirm={async (name) => {
              const space = await rpc.spaces.create({ name });
              if (!selectSpace(space.id)) {
                setNewSpaceOpen(false);
                await refreshBots();
                return;
              }
              window.location.assign("/onboarding");
            }}
          />
        ) : null}

        {pickerInfoTopic ? (
          <PickerInfoDialog topic={pickerInfoTopic} onClose={() => setPickerInfoTopic(null)} />
        ) : null}

        {clearTarget ? (
          <ClearConversationDialog
            bot={clearTarget.chat}
            onCancel={() => setClearTarget(null)}
            onConfirm={async () => {
              await rpc.threads.clear(
                clearTarget.kind === "bot"
                  ? { botId: clearTarget.chat.id }
                  : { groupId: clearTarget.chat.id },
              );
              if (
                (clearTarget.kind === "bot" && active?.id === clearTarget.chat.id) ||
                (clearTarget.kind === "group" && activeGroup?.id === clearTarget.chat.id)
              ) {
                expandedHistoryThread.current = null;
                pinnedAroundRef.current = null;
                historyEpoch.current += 1;
                updateSnapshot((current) =>
                  current ? { ...current, messages: [], olderCursor: null, run: null } : current,
                );
              }
              setClearTarget(null);
              await refreshBots();
            }}
          />
        ) : null}

        {deleteRoutineTarget ? (
          <DeleteItemDialog
            item={deleteRoutineTarget}
            noun="routine"
            onCancel={() => setDeleteRoutineTarget(null)}
            onConfirm={async () => {
              const target = deleteRoutineTarget;
              await rpc.routines.remove({ routineId: target.id });
              setDeleteRoutineTarget(null);
              setEditingRoutine((current) => (current?.id === target.id ? null : current));
              if (activeBotId.current !== target.botId) return;
              await refreshThread(target.botId);
              if (activeBotId.current === target.botId) setPanel("computer");
            }}
          />
        ) : null}

        {messagingSettingsOpen ? (
          <MessagingSettingsOverlay onClose={() => setMessagingSettingsOpen(false)} />
        ) : null}
      </Suspense>

      <Suspense fallback={null}>
        {devinDialog ? (
          <DevinConnectDialog
            mode={devinDialog}
            onConnected={() => setDevinPageKey((key) => key + 1)}
            onClose={() => setDevinDialog(null)}
          />
        ) : null}
        {settingsOpen ? (
          <SettingsOverlay
            name={userName}
            email={session.data?.user.email}
            usage={usage}
            onUsageOpen={refreshUsage}
            initialSection={settingsSection}
            modelProvider={settingsModelProvider}
            notice={settingsNotice}
            avatarStyle={bootstrapMe?.avatarStyle ?? DEFAULT_AVATAR_STYLE}
            isDeploymentOwner={bootstrapMe?.isDeploymentOwner === true}
            billingEnabled={bootstrapMe?.billingEnabled === true}
            sandboxProvider={bootstrapMe?.sandboxProvider}
            onSandboxProviderChange={(sandboxProvider) =>
              setBootstrapMe((prev) => (prev ? { ...prev, sandboxProvider } : prev))
            }
            messagingEnabled={messagingSurfaceEnabled}
            onOpenMessaging={() => {
              setSettingsOpen(false);
              setMessagingSettingsOpen(true);
            }}
            onAvatarStyleChange={async (avatarStyle) => {
              const nextMe = await rpc.preferences.update({ avatarStyle });
              setBootstrapMe(nextMe);
            }}
            timezone={accountTimezone(bootstrapMe)}
            onTimezoneChange={async (timezone) => {
              setBootstrapMe(await rpc.preferences.update({ timezone }));
            }}
            memoryConfig={memoryProviderConfig}
            onMemoryConfigChange={(config) => {
              memoryProviderConfigRevision.current += 1;
              setMemoryProviderConfig(config);
            }}
            onVoiceStatusMaybeChanged={async () => {
              try {
                setVoiceStatus(
                  await Promise.race([rpc.voice.status(), voiceStatusRefreshTimeout()]),
                );
              } catch {
                // Prefer reopening Voice settings over starting a call with stale readiness.
                setVoiceStatus(null);
              }
            }}
            onClose={() => {
              setSettingsOpen(false);
              setSettingsSection("general");
              // A model may have been added or removed, which pages and agent panels show.
              rpc
                .me()
                .then(setBootstrapMe)
                .catch(() => {});
            }}
          />
        ) : null}
        {peerConversation && active ? (
          <PeerMessagesOverlay
            botId={active.id}
            botName={active.name}
            botColor={active.color}
            peerBotId={peerConversation.peerBotId}
            peerBotName={peerConversation.peerBotName}
            peerBotColor={
              resolveTranscriptBot(peerConversation.peerBotId)?.color ?? DEFAULT_BOT_COLOR
            }
            onClose={() => setPeerConversation(null)}
          />
        ) : null}
      </Suspense>

      {booting ? (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-[22px] bg-background/95">
          <div className="text-[19px] font-medium text-foreground">
            <Trans>Booting up {computerBot?.name ?? active?.name}’s computer</Trans>
          </div>
          <div className="h-[5px] w-[min(420px,70%)] overflow-hidden rounded-full bg-accent">
            <div className="h-full w-2/3 rounded-full bg-primary" />
          </div>
        </div>
      ) : computerOpen && computerBot ? (
        <div className="fixed inset-0 z-30 bg-background">
          <div
            data-testid="computer-viewport"
            className="fixed inset-x-0 top-0 flex flex-col bg-background"
            style={{
              height: computerViewport ? `${computerViewport.height}px` : "100dvh",
              top: computerViewport ? `${computerViewport.offsetTop}px` : undefined,
            }}
          >
            <div
              data-testid="computer-chrome"
              className="flex items-center justify-between gap-4 border-b border-sidebar-border px-[18px] py-3.5"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <BotAvatar
                  color={computerBot.color}
                  identity={computerBot.id}
                  size={28}
                  status={computerBot.status}
                />
                {recordingSkill ? (
                  <TeachRecordingChrome
                    recording={recordingSkill}
                    botId={computerBot.id}
                    busy={teachBusy}
                    onStop={stopTeaching}
                    variant="overlay"
                  />
                ) : (
                  <span className="truncate text-[15.5px] font-medium text-foreground" dir="auto">
                    {computerLabel(computer?.mode, computerBot.name)}
                  </span>
                )}
                {!recordingSkill && hasControl ? (
                  computer?.takeoverRequested ? (
                    <span className="rounded-full bg-warning/15 px-[11px] py-1 text-[13px] text-warning">
                      <Trans>Needs takeover</Trans>
                    </span>
                  ) : (
                    <span className="rounded-full bg-success/15 px-[11px] py-1 text-[13px] text-success">
                      <Trans>You have control</Trans>
                    </span>
                  )
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                {composerRunning ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={t`Stop`}
                    data-testid="computer-overlay-stop"
                    onClick={() => void stopRun()}
                    disabled={sending}
                  >
                    <Trans>Stop</Trans>
                  </Button>
                ) : null}
                {recordingSkill ? (
                  <TeachStopButton busy={teachBusy} onStop={stopTeaching} />
                ) : hasControl ? (
                  <ComputerReleaseActions
                    takeoverRequested={Boolean(computer?.takeoverRequested)}
                    onRelease={releaseComputer}
                  />
                ) : computer?.state === "running" &&
                  !computerTakeoverBlocked(computer, snapshot?.run?.status) ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={booting}
                    onClick={() => void openComputer(computerBot.id, true)}
                  >
                    <Trans>Take control</Trans>
                  </Button>
                ) : null}
                {computerBot && !recordingSkill ? (
                  <TeachComputerOverlayControl
                    key={computerBot.id}
                    botId={computerBot.id}
                    computer={computer}
                    busy={teachBusy}
                    onRefresh={refreshActiveTeaching}
                  />
                ) : null}
                {computerBot && !recordingSkill ? (
                  <ComputerMaintenanceActions
                    botId={computerBot.id}
                    computer={computer}
                    onChanged={async () => {
                      await refreshComputerFor(computerBot.id);
                    }}
                  />
                ) : null}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground"
                  aria-label={t`Close computer`}
                  onClick={() => setComputerOpen(false)}
                >
                  <X size={16} strokeWidth={1.8} />
                </Button>
              </div>
            </div>
            {sendError ? (
              <div
                role="alert"
                className="border-b border-destructive/40 bg-destructive/10 px-[18px] py-2 text-[13px] text-destructive"
              >
                {sendError}
              </div>
            ) : null}
            <div className="relative min-h-0 flex-1 bg-background">
              <ComputerWorkspace
                botId={computerBot.id}
                computer={computer}
                hasControl={hasControl}
                dock={!recordingSkill}
                onTakeControl={
                  computer?.state === "running" &&
                  !hasControl &&
                  !computerTakeoverBlocked(computer, snapshot?.run?.status)
                    ? () => openComputer(computerBot.id, true)
                    : undefined
                }
              >
                {computer?.kind === "desktop" ? (
                  <DesktopKindEmptyState className="grid h-full place-items-center px-8 text-center text-sm text-muted-foreground/80" />
                ) : computer?.state === "running" && embeddedScreenUrl && !computerScreenError ? (
                  <>
                    <iframe
                      title={t`Bot screen`}
                      src={embeddedScreenUrl}
                      sandbox={screenIframeSandbox(embeddedScreenUrl)}
                      className="h-full w-full border-0 bg-black"
                      allow="clipboard-read; clipboard-write; fullscreen"
                      style={{
                        pointerEvents: recordingSkill || !hasControl ? "none" : "auto",
                      }}
                    />
                    {computerBot ? (
                      <TeachCaptureOverlay
                        botId={computerBot.id}
                        skill={recordingSkill}
                        enabled={Boolean(recordingSkill)}
                        screenWidth={computer?.screenWidth}
                        screenHeight={computer?.screenHeight}
                      />
                    ) : null}
                  </>
                ) : (
                  <div className="grid h-full place-items-center text-sm text-muted-foreground/80">
                    {computerScreenError ??
                      (computer?.state === "suspended"
                        ? t`Computer is asleep`
                        : computerLabel(computer?.mode, computerBot.name))}
                  </div>
                )}
              </ComputerWorkspace>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <AvatarStyleProvider value={bootstrapMe?.avatarStyle ?? DEFAULT_AVATAR_STYLE}>
      <AppNavigateContext.Provider value={navigate}>
        {missingPath === pathname ? <NotFoundPage /> : shell}
      </AppNavigateContext.Provider>
    </AvatarStyleProvider>
  );
}

/** Whether the pane is still waiting for its chat: the bot list loads, or the route's bot is not in it yet. */
export function chatIsOpening(input: {
  hasChat: boolean;
  botsLoaded: boolean;
  routeWaiting: boolean;
}): boolean {
  return !input.hasChat && (!input.botsLoaded || input.routeWaiting);
}

/** Whether an `/app/:botId` link still names a chat, live or archived. */
export function knownBotId(
  botId: string,
  bots: readonly Pick<Bot, "id">[],
  archivedBots: readonly Pick<Bot, "id">[],
): boolean {
  return bots.some((bot) => bot.id === botId) || archivedBots.some((bot) => bot.id === botId);
}

function firstThreadRoute(
  bots: readonly Pick<Bot, "id">[],
  groups: readonly Pick<Group, "id">[],
): string {
  if (bots[0]) return `/app/${bots[0].id}`;
  if (groups[0]) return `/app/g/${groups[0].id}`;
  return "/app";
}

function applyThreadEvent(
  event: ProductEvent,
  commitSnapshot: (next: ThreadSnapshot | null) => void,
  commitComputer: (next: ComputerStatus | null) => void,
  snapshotRef: MutableRefObject<ThreadSnapshot | null>,
  computerRef: MutableRefObject<ComputerStatus | null>,
) {
  publishComputerCommand(event);
  if (isThreadSnapshotEvent(event)) {
    const next = reduceThreadSnapshot(snapshotRef.current, event);
    commitSnapshot(next);
  }
  if (isComputerStatusEvent(event)) {
    const next = reduceComputerStatus(computerRef.current, event);
    commitComputer(next);
  }
}

function ComputerReleaseActions({
  takeoverRequested,
  onRelease,
}: {
  takeoverRequested: boolean;
  onRelease: (reason?: ComputerReleaseReason) => Promise<void>;
}) {
  if (!takeoverRequested) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => void onRelease()}>
        <Trans>Release control</Trans>
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={() => void onRelease("skipped")}>
        <Trans>Skip</Trans>
      </Button>
      <Button type="button" size="sm" onClick={() => void onRelease("done")}>
        <Trans>I’m done</Trans>
      </Button>
    </div>
  );
}

function DesktopKindEmptyState({ className }: { className?: string }) {
  return (
    <div className={className}>
      <Trans>
        This bot runs on this computer, not a Linux desktop. Shell and files use your home folder.
      </Trans>
    </div>
  );
}

function computerPlaceholder(
  state: ComputerStatus["state"] | undefined,
  booting: boolean,
  label: string,
) {
  if (state === "booting" || booting) return t`Booting live desktop…`;
  if (state === "running") return label;
  if (state === "suspended") return t`Computer is asleep. Open it to wake.`;
  if (state === "error") return t`Computer failed to boot`;
  return t`Computer is stopped`;
}

/** True when the panel has no computer screen to show, in any computer state: just routines. */
export function isRoutinesOnlyPanel(input: {
  kind: ComputerStatus["kind"] | undefined;
  hasScreen: boolean;
  state?: ComputerStatus["state"];
  hasError: boolean;
  open: boolean;
  showRecoveryHint: boolean;
}) {
  return (
    input.kind !== "desktop" &&
    // A stale screen address with the computer stopped shows nothing; asleep still offers Open.
    !(input.hasScreen && input.state !== "stopped") &&
    !input.hasError &&
    !input.open &&
    !input.showRecoveryHint
  );
}

/** Panel heading for the bot computer, in words rather than the raw state slug. */
function computerStateLabel(state: ComputerStatus["state"] | undefined) {
  // The "Routines" heading below is the title; the header names the computer only when it needs attention.
  if (state === "running" || state === "stopped" || !state) return null;
  if (state === "booting") return t`Computer is starting`;
  if (state === "suspended") return t`Computer is asleep`;
  return t`Computer could not start`;
}

function computerLabel(mode: ComputerStatus["mode"] | undefined, botName: string) {
  return mode === "dedicated" ? t`${botName}’s computer` : t`Team Computer`;
}
