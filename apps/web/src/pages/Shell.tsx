import { t } from "@lingui/core/macro";
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
  ATTACHMENT_MAX_COUNT,
  DATA_ROOM_METADATA_ORDINAL,
  DEFAULT_AVATAR_STYLE,
  FIRST_BOT_SPAWN_KEY,
  isGtmAgentSpawnKey,
  isIntegrationAgentSpawnKey,
  isMailThreadAgentSpawnKey,
  LEGAL_CONSENT_REQUIRED_MESSAGE,
  NEW_PAGE_INSTRUCTIONS,
  RunPhaseSchema,
  WatchSpecSchema,
} from "@rakazo/contracts";
import type { ComposerMention } from "@rakazo/core";
import {
  attachmentsForThread,
  buildComposerMentionOptions,
  cronFromPreset,
  DEFAULT_BOT_COLOR,
  inferAttachmentMimeType,
  isActive,
  isGoalWaitingOnOwner,
  isRunTerminalEvent,
  latestAnswerableAskMessageId,
  nestRosterByParent,
  newClientId,
  ownerOnlyCredentialAskMessageIds,
  planSidebarMove,
  resolveComposerSendPlan,
  runErrorAction,
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
  enqueueNotificationToast,
  GroupAvatar,
  Spinner,
} from "@rakazo/ui-web";
import {
  ArrowLeft,
  BookUser,
  CalendarClock,
  Files,
  FileText,
  FolderPlus,
  ListTodo,
  Maximize2,
  Menu,
  MessageSquare,
  PanelLeftOpen,
  PanelRightClose,
  Pencil,
  Plus,
  Search,
  Settings,
  Trash2,
  Users,
  WandSparkles,
  X,
} from "lucide-react";
import type { DragEvent, MutableRefObject, ReactNode } from "react";
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
import { BotFirewallMark } from "../components/BotFirewallMark";
import type { BotToolControls, ComposerDraft } from "../components/BotToolControls";
import { BotToolControlsContext } from "../components/BotToolControls";
import { ComputerMaintenanceActions } from "../components/ComputerMaintenanceActions";
import {
  ComputersUnavailableHint,
  computersAreUnavailable,
} from "../components/ComputersUnavailableHint";
import { ComputerUpdateProgress } from "../components/ComputerUpdateProgress";
import { CallCard } from "../components/call/CallCard";
import { NEW_MESSAGE } from "../components/compose-email-constants";
import { ComputerWorkspace } from "../components/computer/ComputerWorkspace";
import type { SendTarget } from "../components/data-room/SendToAgent";
import { ErrorBoundary, lazyOverlay, SectionLoadFailed } from "../components/ErrorBoundary";
import { InstructionsUpgradeNotice } from "../components/InstructionsUpgradeNotice";
import { AgentAvatar } from "../components/integrations/AgentAvatar";
import { DevinConnectDialog } from "../components/integrations/DevinConnectDialog";
import { RecordingPillHost } from "../components/meeting-capture/RecordingPillHost";
import { PageAgentIntro, pageAgentIntroKind, pageAgentKind } from "../components/PageAgentIntro";
import { PageNavContext } from "../components/PageHeader";
import { RowsSkeleton } from "../components/RowsSkeleton";
import { canOfferHostComputer } from "../components/RunsOnPicker";
import { OpeningSpace } from "../components/ShellSkeleton";
import { MAIN_CONTENT_ID, SkipToContent } from "../components/SkipToContent";
import type { DropResult, SidebarLayout } from "../components/sidebar-folders/drop-target";
import { ROOT_CONTAINER } from "../components/sidebar-folders/drop-target";
import { SidebarUndoNotice } from "../components/sidebar-folders/SidebarUndoNotice";
import { TeachCaptureOverlay } from "../components/teach/TeachCaptureOverlay";
import { TeachComputerOverlayControl } from "../components/teach/TeachComputerOverlay";
import {
  TeachCancelButton,
  TeachRecordingChrome,
  TeachStopButton,
} from "../components/teach/TeachRecordingChrome";
import { focusQuestionOpen } from "../components/tour/connect-cards";
import { tourInProgress } from "../components/tour/TourPopover";
import { useAgentApp } from "../lib/agent-app";
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
import { findCompanyAgent } from "../lib/company-agent";
import { recoverComposerDraft } from "../lib/composer-accounts";
import {
  embeddableScreenUrl,
  loadComputerScreen,
  screenIframeSandbox,
} from "../lib/computer-screen";
import { publishComputerCommand } from "../lib/computer-workspace";
import { fetchDataRoomBlob } from "../lib/data-room";
import { findDataRoomAgent } from "../lib/data-room-agent";
import { delegateWaitTarget, pendingDelegateAgents, pendingSentBlocks } from "../lib/delegate-wait";
import { desktopBridge } from "../lib/desktop";
import { useDeviceSpeech } from "../lib/device-speech";
import { setDockedAgentBotId } from "../lib/docked-agent";
import { findFinanceAgent } from "../lib/finance-agent";
import { deleteFolderWithUndo } from "../lib/folder-delete";
import { findGtmAgent } from "../lib/gtm-agent";
import { useHexSync } from "../lib/hex/useHexSync";
import {
  maskCurrencyWhenHidden,
  setHideAmounts,
  setHideAmountsUser,
  useHideAmounts,
} from "../lib/hide-amounts-preference";
import { findInboxAgent } from "../lib/inbox-agent";
import { appPath } from "../lib/integrations";
import { findInvestorsAgent } from "../lib/investors-agent";
import { findLegalAgent } from "../lib/legal-agent";
import { accountTimezone, markTimezoneReported, timezoneToReport } from "../lib/local-timezone";
import { parseModelOptionKey } from "../lib/model-catalog";
import { createAgentSendWatch, UNDO_SEND_MS } from "../lib/outbox";
import {
  isUnclaimedFileDrag,
  readFileAsBase64,
  revokePendingAttachmentPreviews,
} from "../lib/pending-attachments";
import { markAfterPaint, markOnce } from "../lib/performance";
import { getResponseStreamingEnabled, subscribeResponseStreaming } from "../lib/response-streaming";
import { retryPayload } from "../lib/retry-payload";
import type { Panel, RightPanelState } from "../lib/right-panel-state";
import {
  readRightPanelState,
  rightPanelStorageKey,
  writeRightPanelState,
} from "../lib/right-panel-state";
import { rosterStatusChanged, waitingForApprovalLabel } from "../lib/roster-status";
import type { MissingBotSeen } from "../lib/route-bot";
import { resolveRouteBot, shouldClearMissingBot, useGiveUpOnMissingBot } from "../lib/route-bot";
import { rpc, selectedSpaceId, selectSpace } from "../lib/rpc";
import { readSeenRunErrorIds, rememberSeenRunErrorId } from "../lib/run-error-storage";
import { findScannerAgent } from "../lib/scanner-agent";
import type { DataRoomRef } from "../lib/send-to-agent";
import {
  acceptAttachments,
  fetchMessageFiles,
  planSendToAgent,
  sendTargets,
} from "../lib/send-to-agent";
import { sharedInflight } from "../lib/shared-inflight";
import {
  PANEL_DOCKED_QUERY,
  SIDEBAR_DOCKED_QUERY,
  showHeaderWindowChrome,
  sidebarRail,
  useDrawerFocus,
  useSidebarDocked,
} from "../lib/shell-layout";
import { SIDEBAR_PAGES_CHANGED_EVENT } from "../lib/sidebar-pages-event";
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
import { useNotificationsOff } from "../lib/use-notifications-off";
import { useRefetchWhileOpen } from "../lib/use-refetch-while-open";
import { useRememberedMessages } from "../lib/use-remembered-messages";
import { useRunResumedAt } from "../lib/use-run-resumed-at";
import { useScannerDelivery } from "../lib/use-scanner-delivery";
import { NOTIFICATIONS_CHANGED_EVENT, useSidebarGlance } from "../lib/use-sidebar-glance";
import { errorText } from "../lib/user-error";
import { workingActivity } from "../lib/working-activity";
import type { ContextMenuPosition } from "./BotContextMenu";
import { CreateGroupForm, GroupSettings, memberName } from "./GroupPanel";
import { InboxPage } from "./Inbox";
import { ResizableSidePanel } from "./ResizableSidePanel";
import type { RoutineDraftState } from "./RoutineEditor";
import {
  defaultRoutineName,
  draftFromRoutine,
  emptyRoutineDraft,
  RoutineEditor,
  RoutineListHeader,
  RoutineListRow,
  routineNeedsOneShotArm,
  routineRunAtDate,
} from "./RoutineEditor";
import type { SettingsSection } from "./SettingsOverlay";
import type { PageDataUpdate, PageRemoteUpdate } from "./shell/bot-page-panel";
import { BotSettings } from "./shell/bot-panel";
import { PinsList, PinsStrip, useBotPins } from "./shell/bot-pins";
import type { PaletteEntry } from "./shell/command-palette";
import { CommandPalette, isCommandPaletteHotkey, plainSnippet } from "./shell/command-palette";
import type { PendingAttachment } from "./shell/composer";
import { Composer } from "./shell/composer";
import { isStalePendingAskError } from "./shell/composer-error";
import { DelegateWaitNotice } from "./shell/DelegateWaitNotice";
import {
  ArchiveBotsDialog,
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
import { GoalLine, GoalNotice, isGoalReply, snapshotWithGoal } from "./shell/goal";
import { pagePanelFor } from "./shell/page-agent-panels";
import type { AppPage } from "./shell/pages";
import { matchPage, pagesOnOffer } from "./shell/pages";
import { TOP_BAR_HEIGHT } from "./shell/sidebar-header-row";
import {
  activeSpaceFirst,
  commitSpaceRename,
  SpaceSidebar,
  sidebarGroupsForSpaces,
  spaceHoldingChat,
  spaceSwitchTargets,
} from "./shell/space-sidebar";
import { AppNavigateContext, Transcript, UnreadDivider } from "./shell/transcript";
import { usePageAgent } from "./shell/use-page-agent";
import { WindowChrome } from "./WindowChrome";

const ArtifactsPage = lazy(() =>
  import("./Artifacts").then((module) => ({ default: module.ArtifactsPage })),
);
const BoardPage = lazy(() => import("./Board").then((module) => ({ default: module.BoardPage })));
const BrexPage = lazy(() =>
  import("../components/brex/BrexPage").then((module) => ({ default: module.BrexPage })),
);
const BotPageView = lazy(() =>
  import("./BotPageView").then((module) => ({ default: module.BotPageView })),
);
const CalendarPage = lazy(() =>
  import("./Calendar").then((module) => ({ default: module.CalendarPage })),
);
const CompanyPage = lazy(() =>
  import("./Company").then((module) => ({ default: module.CompanyPage })),
);
const CompanyImportPage = lazy(() =>
  import("./CompanyImport").then((module) => ({ default: module.CompanyImportPage })),
);
const ContactDetailPage = lazy(() =>
  import("./ContactDetail").then((module) => ({ default: module.ContactDetailPage })),
);
const ContactsPage = lazy(() =>
  import("./Contacts").then((module) => ({ default: module.ContactsPage })),
);
const DataRoomPage = lazy(() =>
  import("./DataRoom").then((module) => ({ default: module.DataRoomPage })),
);
const DevinPage = lazy(() => import("./Devin").then((module) => ({ default: module.DevinPage })));
const FinancePage = lazy(() =>
  import("./Finance").then((module) => ({ default: module.FinancePage })),
);
const FundraisingPage = lazy(() =>
  import("./Fundraising").then((module) => ({ default: module.FundraisingPage })),
);
// cap table area: the page and its tabs.
const CapTablePage = lazy(() =>
  import("./cap-table/CapTablePage").then((module) => ({ default: module.CapTablePage })),
);
const GtmPage = lazy(() => import("./Gtm").then((module) => ({ default: module.GtmPage })));
const IntegrationsPage = lazy(() =>
  import("./Integrations").then((module) => ({ default: module.IntegrationsPage })),
);
const InvestorsPage = lazy(() =>
  import("./Investors").then((module) => ({ default: module.InvestorsPage })),
);
const UpdateEditor = lazy(() =>
  import("./investors/UpdateEditor").then((module) => ({ default: module.UpdateEditor })),
);
const LegalPage = lazy(() => import("./Legal").then((module) => ({ default: module.LegalPage })));
const MeetingDetailPage = lazy(() =>
  import("./MeetingDetail").then((module) => ({ default: module.MeetingDetailPage })),
);
const MeetingsPage = lazy(() =>
  import("./Meetings").then((module) => ({ default: module.MeetingsPage })),
);
const NotFoundPage = lazy(() =>
  import("./NotFound").then((module) => ({ default: module.NotFoundPage })),
);
const ScannerPage = lazy(() =>
  import("./Scanner").then((module) => ({ default: module.ScannerPage })),
);
const ComposeEmail = lazy(() =>
  import("../components/ComposeEmail").then((module) => ({ default: module.ComposeEmail })),
);
const BotPagePanel = lazy(() =>
  import("./shell/bot-page-panel").then((module) => ({ default: module.BotPagePanel })),
);
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

/**
 * Submits an approval answer, then refreshes the thread. The refresh never fails a committed
 * answer; when the answer itself fails, one background refresh shows a card the server had
 * already settled, and the original error still reaches the card.
 */
export async function answerThenRefresh({
  answer,
  refresh,
}: {
  answer: () => Promise<unknown>;
  refresh: () => Promise<unknown> | undefined;
}) {
  try {
    await answer();
  } catch (err) {
    void Promise.resolve(refresh()).catch(() => undefined);
    throw err;
  }
  await Promise.resolve(refresh()).catch(() => undefined);
}

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
  const key = collapsedSidebarSectionsStorageKey(userId);
  const saved = readCollapsedIdSet(key);
  // On a phone the nine pages would fill the drawer and leave one chat visible, so Pages starts
  // collapsed until the person has opened or closed any section themselves.
  try {
    if (
      key &&
      window.localStorage.getItem(key) === null &&
      window.matchMedia("(max-width: 1023px)").matches
    ) {
      return new Set(["pages"]);
    }
  } catch {
    // Storage blocked: keep the default.
  }
  return saved;
}

function readCollapsedRosterParents(userId: string | null | undefined): Set<string> {
  return readCollapsedIdSet(collapsedRosterParentsStorageKey(userId));
}

/** The same side inset as the transcript, so full-page content sits in the composer's column. */
const CHAT_COLUMN_INSET = "md:px-[max(1.75rem,calc((100%-900px)/2))]";

const isPageOrIntegrationAgent = (spawnKey: string | null | undefined) =>
  pageAgentKind(spawnKey) !== null || isIntegrationAgentSpawnKey(spawnKey);

/** A non-chat search result: a Data room document, artifact or contact. */
type SearchLink = { id: string; label: string; detail?: string };

const maskOptional = (text: string | null) => (text ? maskCurrencyWhenHidden(text) : null);

/**
 * What one palette search loads once and reuses for the searches that follow: the folder list behind
 * a document's folder line, and the contacts. `null` until first asked for, and again after a failure.
 */
export type PaletteLookupCache = {
  folders: { current: Promise<Awaited<ReturnType<typeof rpc.dataRoom.folders>>> | null };
  contacts: { current: Promise<Awaited<ReturnType<typeof rpc.contacts.list>>> | null };
};

export function createPaletteLookupCache(): PaletteLookupCache {
  return { folders: { current: null }, contacts: { current: null } };
}

/** Opening the palette or switching space starts these lookups over. */
export function resetPaletteLookups(cache: PaletteLookupCache) {
  cache.folders.current = null;
  cache.contacts.current = null;
}

function paletteFolders(cache: PaletteLookupCache) {
  // Only for the folder line; a failure just leaves it off, and the next open tries again.
  cache.folders.current ??= rpc.dataRoom.folders().catch(() => {
    cache.folders.current = null;
    return [];
  });
  return cache.folders.current;
}

function paletteContacts(cache: PaletteLookupCache) {
  cache.contacts.current ??= rpc.contacts.list({}).catch(() => {
    cache.contacts.current = null;
    return [];
  });
  return cache.contacts.current;
}

/** Data room files (by name and content) and artifacts matching a search; a failure only hides that group. */
export async function findDocumentsAndArtifacts(
  query: string,
  lookups: PaletteLookupCache = createPaletteLookupCache(),
) {
  const [documents, artifacts] = await Promise.all([
    Promise.all([rpc.dataRoom.search({ query, limit: 6 }), paletteFolders(lookups)])
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
    // The server searches every artifact in the space, newest first; one more than is listed, so
    // the palette knows whether Artifacts holds more.
    rpc.artifacts
      .listSpace({ q: query, limit: 6 })
      .then((result): SearchLink[] =>
        result.items.slice(0, 6).map((item) => ({
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
export function findContacts(
  query: string,
  lookups: PaletteLookupCache = createPaletteLookupCache(),
): Promise<SearchLink[]> {
  const needle = query.toLowerCase();
  return paletteContacts(lookups)
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
          id: c.id,
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

/**
 * Chats with a matching message, once per chat: the newest match and its date. Routine hits are
 * listed apart, once per routine. A group or a bot found only by its description is not a chat hit:
 * Groups and Bots list those already.
 */
export function findChats(query: string) {
  const needle = query.toLowerCase();
  return rpc.search.query({ q: query }).then(({ hits }) => {
    const seen = new Set<string>();
    const entries: PaletteEntry[] = [];
    const routines: PaletteEntry[] = [];
    for (const hit of hits) {
      if (hit.routineId && hit.botId) {
        const id = `/app/${hit.botId}?routine=${hit.routineId}`;
        if (!routines.some((entry) => entry.id === id)) {
          routines.push({ id, label: hit.title, detail: hit.botName ?? undefined });
        }
        continue;
      }
      if (hit.kind === "conversation") {
        if (hit.groupId || !hit.botName?.toLowerCase().includes(needle)) continue;
      }
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
    return { chats: entries.slice(0, 5), routines: routines.slice(0, 5) };
  });
}

export type ScratchpadFocusRequest = { botId: string; itemId: string; nonce: number };

/** One open-work row to bring into view; `consume` forgets it once the row has been shown. */
export function useScratchpadFocus() {
  const [focus, setFocus] = useState<ScratchpadFocusRequest | null>(null);
  const nonce = useRef(0);
  return {
    focus,
    request(botId: string, itemId: string) {
      nonce.current += 1;
      setFocus({ botId, itemId, nonce: nonce.current });
    },
    clear() {
      setFocus(null);
    },
    consume() {
      setFocus(null);
    },
  };
}

export function catchBotMenuRequest<T>(request: Promise<T>, chatId: string): Promise<void> {
  return request
    .then(() => undefined)
    .catch((error: unknown) => {
      enqueueNotificationToast({ id: `chat-menu-${chatId}`, title: errorText(error) });
    });
}

/** One boundary and loading state for every page, so a page that fails to load leaves the sidebar usable. */
function PageFrame({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary fallback={<SectionLoadFailed />}>
      <Suspense fallback={<RowsSkeleton className="p-6" />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

export function ShellPage() {
  const { t, i18n } = useLingui();
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
  // Pulls Hex meetings in the macOS desktop app once the user connected Hex.
  useHexSync();
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
  const [hideUndo, setHideUndo] = useState<{ id: string; name: string } | null>(null);
  /**
   * The chat just archived, so the notice can put it back. wasOpen says it was the open chat at
   * archive time and landedPath is where the archive's own redirect left the view, so Undo only
   * returns there if the person has not opened something else since. seq names this archive, so
   * a later notice or a pending restore is never confused with another.
   */
  const [archiveUndo, setArchiveUndo] = useState<{
    kind: "bot" | "group";
    id: string;
    name: string;
    wasOpen: boolean;
    landedPath: string;
    seq: number;
    /** A restore is in flight, so the notice stays until it settles. */
    pending?: boolean;
    error?: string;
  } | null>(null);
  /** Only the latest archive may show its notice; a slower earlier one must not replace it. */
  const archiveSequence = useRef(0);
  const [folderUndo, setFolderUndo] = useState<SidebarSnapshot | null>(null);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [archivedBots, setArchivedBots] = useState<Bot[]>([]);
  const [archivedGroups, setArchivedGroups] = useState<Group[]>([]);
  const [archivedOpen, setArchivedOpen] = useState(false);
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
  // The Legal page reports why its agent must wait: no model, or its Allow. Its Allow is the only one.
  const [legalConsentWaitsFor, setLegalConsentWaitsFor] = useState<"consent" | "model" | null>(
    null,
  );
  /** The connector's Devin agent: undefined until asked, null for everyone else. */
  const [devinAgentId, setDevinAgentId] = useState<string | null | undefined>(undefined);
  const [devinDialog, setDevinDialog] = useState<"connect" | "replace" | null>(null);
  /** Remounts the Devin page after a key is accepted, so it shows the new connection at once. */
  const [devinPageKey, setDevinPageKey] = useState(0);
  // The Carta agent panel starts closed, like the other pages' agents, and remembers an explicit open.
  const [cartaAgentCollapsed, setCartaAgentCollapsed] = useState(true);
  // Reported by the Cap Table page. Without Carta the agent has nothing to read, so its panel stays shut.
  const [cartaConnected, setCartaConnected] = useState(false);
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
  // The server's answer to a bare /goal or /goal clear: a status line, not a failure.
  const [goalNotice, setGoalNotice] = useState<string | null>(null);
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
  const [pageDataRemote, setPageDataRemote] = useState<PageDataUpdate | null>(null);
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
  const scratchpadFocus = useScratchpadFocus();
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
  const [memoryProviderConfigLoadFailed, setMemoryProviderConfigLoadFailed] = useState(false);
  const memoryProviderConfigRevision = useRef(0);
  const retryMemoryProviderConfigLoad = useCallback(async () => {
    const revision = memoryProviderConfigRevision.current;
    try {
      const providerConfig = await rpc.memory.providerConfig();
      if (memoryProviderConfigRevision.current === revision) {
        setMemoryProviderConfig(providerConfig);
        setMemoryProviderConfigLoadFailed(false);
      }
    } catch {
      if (memoryProviderConfigRevision.current === revision) {
        setMemoryProviderConfig(undefined);
        setMemoryProviderConfigLoadFailed(true);
      }
    }
  }, []);
  const call = useCallSession();
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus | null>(null);
  const deviceSpeech = useDeviceSpeech();
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
  // Folders and contacts load once per open and space, not once per keystroke.
  const paletteLookupsRef = useRef<PaletteLookupCache>(createPaletteLookupCache());
  // The bot just made with "New bot", whose settings open with its name selected.
  const [namingBotId, setNamingBotId] = useState<string | null>(null);
  // What the user chose for each bot's More settings toggle; survives the panel being rebuilt.
  const [manualFold, setManualFold] = useState<Record<string, boolean>>({});

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
  const toggleActivityMode = useCallback(() => setActivityMode((on) => !on), []);
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
  const [archiveEmailTarget, setArchiveEmailTarget] = useState<string[] | null>(null);
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
  useEffect(() => {
    if (commandPaletteOpen) resetPaletteLookups(paletteLookupsRef.current);
  }, [commandPaletteOpen]);
  // Another space holds other folders and contacts.
  useEffect(() => {
    resetPaletteLookups(paletteLookupsRef.current);
  }, [activeSpaceId]);
  const agentAppFor = useAgentApp(
    userId,
    spaces.length > 0 ? spaces.map((space) => space.id) : activeSpaceId ? [activeSpaceId] : [],
  );
  const [keepComputerRecovery, setKeepComputerRecovery] = useState(false);
  const recoveryHoldTimer = useRef<number | undefined>(undefined);
  const notificationsOff = useNotificationsOff(panel === "settings");
  const computersOff = computersAreUnavailable(bootstrapMe?.sandboxProvider);
  const showComputerRecoveryHint = computersOff || keepComputerRecovery;
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
  const [routineTaughtSkills, setRoutineTaughtSkills] = useState<{ id: string; name: string }[]>(
    [],
  );
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
  const pageKey = matchPage(pathname)?.key;
  const inboxMode = pageKey === "inbox";
  const integrationsMode = pageKey === "integrations";
  const financeMode = pageKey === "finance";
  const brexMode = pageKey === "brex";
  const dataRoomMode = pageKey === "data-room";
  const scannerMode = pageKey === "scanner";
  useScannerDelivery(userId, bootstrapMe?.spaceId);
  const legalMode = pageKey === "legal";
  const gtmMode = pageKey === "gtm";
  const companyMode = pageKey === "company";
  const companyImportMode = useMatch("/app/company/import") != null;
  const devinMode = pageKey === "devin";
  const artifactsMode = pageKey === "artifacts";
  // The route exists only while bootstrap enables the board (see App).
  const boardMode = pageKey === "board";
  const investorsMode = pageKey === "investors";
  const investorUpdateMatch = useMatch("/app/investors/updates/:id");
  const capTableMode = pageKey === "cap-table";
  const fundraisingMode = pageKey === "fundraising";
  const calendarMode = pageKey === "calendar";
  const meetingMatch = useMatch("/app/meetings/:meetingId");
  const meetingsMode = pageKey === "meetings";
  const contactMatch = useMatch("/app/contacts/:contactId");
  const contactsMode = pageKey === "contacts";
  const botPageMatch = useMatch("/app/pages/:botId/:pageId");
  // Inbox, Finance, Legal, Data room, Investors and Integrations are pages of their own: no bot
  // route. Inbox, Finance, Legal and Investors keep their agent in a side panel.
  const pageMode = pageKey !== undefined || botPageMatch != null;
  // Pages that name the workspace beside their title show it only when the user has several.
  const pageSpaceName =
    spaces.length > 1 ? spaces.find((space) => space.id === bootstrapMe?.spaceId)?.name : undefined;
  const routeBot = resolveRouteBot({
    bots,
    botId,
    loaded: initialBotsLoaded,
    seen: missingBotSeen.current,
    applied: botsListApplied.current,
    namedOnly: (bot) => pageAgentKind(bot.spawnKey) !== null,
  });
  const active =
    inGroup ||
    integrationsMode ||
    artifactsMode ||
    contactsMode ||
    meetingsMode ||
    calendarMode ||
    boardMode ||
    botPageMatch != null
      ? undefined
      : companyMode
        ? findCompanyAgent(bots, userId, companyImportMode)
        : inboxMode
          ? findInboxAgent(bots, userId)
          : financeMode
            ? findFinanceAgent(bots, userId)
            : scannerMode
              ? findScannerAgent(bots, userId)
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
  const reloadRoutines = (botId: string) =>
    void rpc.routines
      .list({ botId })
      .then((next) => {
        if (activeBotId.current !== botId) return;
        setRoutines(next);
        setRoutinesBotId(botId);
      })
      .catch(() => undefined);
  useRefetchWhileOpen(!inGroup && Boolean(active?.id), () => {
    if (active?.id) reloadRoutines(active.id);
  });
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
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
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
  const markBotsRead = useCallback(
    async (ids: string[]) => {
      await Promise.all(ids.map((id) => markBotRead(id)));
    },
    [markBotRead],
  );
  const markBotUnread = useCallback(
    async (id: string, messageId?: string) => {
      manuallyUnread.current.add(id);
      try {
        await rpc.threads.markUnread({ botId: id, ...(messageId ? { messageId } : {}) });
      } catch (err) {
        manuallyUnread.current.delete(id);
        throw err;
      }
      updateBotUnread(id, true);
    },
    [updateBotUnread],
  );

  // "Mark as unread" on a message: the chat stays unread until reopened, and the next open puts
  // the New divider at the first reply from that message. The server holds the boundary.
  const markMessageUnread = (message: ThreadMessage) => {
    if (groupId) {
      manuallyUnread.current.add(groupId);
      rpc.threads
        .markUnread({ groupId, messageId: message.id })
        .then(() => {
          setGroups((current) =>
            current.map((group) => (group.id === groupId ? { ...group, unread: true } : group)),
          );
          // The cached thread carries the old boundary; refresh it so the next open reads the new one.
          return refreshActiveThread();
        })
        .catch(() => manuallyUnread.current.delete(groupId));
    } else if (active) {
      void markBotUnread(active.id, message.id)
        .then(() => refreshActiveThread())
        .catch(() => undefined);
    }
  };

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
            navigate(firstThreadRoute(list, groupList, window.location.search), { replace: true });
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
          navigate(firstThreadRoute(list, groupList, window.location.search), { replace: true });
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
    const sideRequests = Promise.all([
      rpc.routines.list({ botId: id }).catch(() => null),
      rpc.skills.list({ botId: id }).catch(() => null),
      refreshComputerScreen(id).catch(() => null),
    ]);
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
    const [routines, skills] = await sideRequests;
    if (
      activeBotId.current !== id ||
      epoch !== historyEpoch.current ||
      request !== threadRefreshEpoch.current
    ) {
      return snap;
    }
    if (routines) {
      setRoutines(routines);
      setRoutinesBotId(id);
    }
    if (skills) {
      setTaughtSkills(skills);
      setTaughtSkillsBotId(id);
    }
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
          setMemoryProviderConfigLoadFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled && memoryProviderConfigRevision.current === providerConfigRevision) {
          setMemoryProviderConfig(undefined);
          setMemoryProviderConfigLoadFailed(true);
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
          window.location.assign(window.location.pathname + window.location.search);
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
        // A page's auto-created agent is only opened when the address names it.
        const threadBotId = bootstrap.thread?.botId;
        const threadIsPageAgent = pageAgentKind(
          bootstrap.bots.find((bot) => bot.id === threadBotId)?.spawnKey,
        );
        const selectedBotId =
          threadBotId && (threadBotId === botId || !threadIsPageAgent)
            ? threadBotId
            : bootstrap.bots.find((bot) => pageAgentKind(bot.spawnKey) === null)?.id;
        if (selectedBotId && selectedBotId !== botId && !pageMode) {
          navigate(
            firstThreadRoute([{ id: selectedBotId, spawnKey: null }], [], window.location.search),
            {
              replace: true,
            },
          );
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
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refreshVisibleBots);
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
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refreshVisibleBots);
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
    if (panel !== "routine" || !slashBotId) return;
    void rpc.taughtSkills
      .list({ botId: slashBotId })
      .then((list) => setRoutineTaughtSkills(list.map(({ id, name }) => ({ id, name }))))
      .catch(() => setRoutineTaughtSkills([]));
  }, [panel, slashBotId]);

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
          const { pageId, revision, updatedBy } = event.payload as PageRemoteUpdate;
          setPageBotId(active.id);
          setPageRemote({ pageId, revision, updatedBy, seq: event.seq });
        }
        if (event.type === "page.data") {
          const { pageId } = event.payload as { pageId?: string };
          setPageBotId(active.id);
          setPageDataRemote({ pageId, seq: event.seq });
        }
        if (event.type === "pins.updated") setPinsSeq(event.seq);
        if (event.type === "thread.goal.updated") {
          updateSnapshot((prev) => snapshotWithGoal(prev, event.payload));
        }
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
        if (
          event.type === "routine.created" ||
          event.type === "routine.updated" ||
          event.type === "routine.fired" ||
          isRunTerminalEvent(event)
        ) {
          reloadRoutines(active.id);
        }
        if (event.type === "thread.message.created") {
          const blocks = (event.payload.blocks as Array<{ kind?: string }>) ?? [];
          if (blocks.some((block) => block.kind === "child_bot")) {
            void refreshBots().catch(() => undefined);
          }
          // An agent-created page is already in the sidebar; the card's message tells it to re-list.
          if (blocks.some((block) => block.kind === "page")) {
            window.dispatchEvent(new Event(SIDEBAR_PAGES_CHANGED_EVENT));
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
  // A space holding only a page's auto-created agent has no chat yet: it shows "No bots yet".
  const noChatBots = !bots.some((bot) => pageAgentKind(bot.spawnKey) === null);
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
      (bot) =>
        (isPageOrIntegrationAgent(bot.spawnKey) || isGtmAgentSpawnKey(bot.spawnKey)) &&
        !bot.preview &&
        bot.status === "idle",
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

  // A bot or group just made or opened from elsewhere can sit under "+N more"; bring its row into view.
  // biome-ignore lint/correctness/useExhaustiveDependencies: also when the row first appears
  useEffect(() => {
    const chatId = botId ?? groupId;
    if (!chatId) return;
    sidebarRef.current
      ?.querySelector(`[data-roster-chat][data-roster-row="${CSS.escape(chatId)}"]`)
      ?.scrollIntoView?.({ block: "nearest" });
  }, [botId, groupId, listedBots.length, groups.length]);

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
    } catch (error) {
      enqueueNotificationToast({
        id: `create-folder-${Date.now()}`,
        title: errorText(error, t`Could not create folder`),
      });
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
    (sectionId: string) => {
      const folder = botSections.find((section) => section.id === sectionId);
      if (!folder) return Promise.resolve();
      const items = [
        ...botsRef.current.map((bot) => ({ ...bot, kind: "bot" as const })),
        ...groupsRef.current.map((group) => ({ ...group, kind: "group" as const })),
      ]
        .filter((entry) => entry.sectionId === sectionId)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map(({ kind, id }) => ({ kind, id }));
      return deleteFolderWithUndo({
        folder,
        items,
        api: {
          remove: rpc.botSections.remove,
          add: rpc.botSections.add,
          setCollapsed: rpc.botSections.setCollapsed,
          move: rpc.sidebar.move,
        },
        hide: () => setBotSections((sections) => sections.filter((item) => item.id !== sectionId)),
        refresh: () => refreshBots(),
        notify: (title, action) =>
          enqueueNotificationToast({
            id: `folder-${Date.now()}`,
            title,
            ...(action ? { action, timeout: UNDO_SEND_MS } : {}),
          }),
        fail: (error) => setSendError(errorText(error, t`Failed to delete folder`)),
      });
    },
    [botSections, refreshBots, t],
  );
  const autoGroupSidebar = useCallback(async () => {
    try {
      const snapshot = await rpc.sidebar.autoGroup();
      if (snapshot.placements.length > 0) {
        // Only one undo notice may be on screen, so this one replaces any other.
        setArchiveUndo(null);
        setHideUndo(null);
        setFolderUndo(snapshot);
      }
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
    const gate = { glance, ticketBoardEnabled: bootstrapMe?.ticketBoardEnabled === true };
    const entry = (page: AppPage) => {
      const Icon = page.paletteIcon ?? page.icon;
      return {
        id: page.key,
        label: i18n._(page.label),
        ...(page.keywords ? { keywords: i18n._(page.keywords) } : {}),
        icon: <Icon {...icon} />,
      };
    };
    const settings = {
      id: "settings",
      label: t`Settings`,
      keywords: t`theme, dark mode, appearance, notifications, time zone`,
      icon: <Settings {...icon} />,
    };
    return [...pagesOnOffer(gate).map(entry), settings];
  }, [
    t,
    i18n,
    bootstrapMe?.ticketBoardEnabled,
    glance.hasTickets,
    glance.devinConnected,
    glance.brexConnected,
  ]);
  // A page hidden in Page options stays out of search and the command palette too.
  const visiblePages = useMemo(
    () => appPages.filter((page) => !hiddenPages.includes(page.id)),
    [appPages, hiddenPages],
  );
  const searchPaletteLinks = useCallback(
    async (q: string) => {
      const [found, contacts, chatResults] = await Promise.all([
        findDocumentsAndArtifacts(q, paletteLookupsRef.current),
        findContacts(q, paletteLookupsRef.current),
        // A failed chat search is shown as one, without losing the other groups or mail search.
        findChats(q).catch(() => null),
      ]);
      return [
        {
          heading: t`Contacts`,
          icon: <BookUser size={16} strokeWidth={1.75} />,
          entries: contacts.map((c) => ({
            id: `/app/contacts/${encodeURIComponent(c.id)}`,
            label: c.label,
            detail: c.detail,
          })),
        },
        {
          heading: t`Documents`,
          icon: <FileText size={16} strokeWidth={1.75} />,
          // The search asks for one more than is listed, to know whether Data room holds more.
          more:
            found.documents.length > 5
              ? { id: `/app/data-room?q=${encodeURIComponent(q)}`, label: t`See all in Data room` }
              : undefined,
          entries: found.documents.slice(0, 5).map((doc) => ({
            id: `/app/data-room?item=${encodeURIComponent(doc.id)}`,
            label: doc.label,
            detail: doc.detail,
          })),
        },
        {
          heading: t`Chats`,
          icon: <MessageSquare size={16} strokeWidth={1.75} />,
          entries: chatResults?.chats ?? [],
          failed: !chatResults,
        },
        {
          heading: t`Routines`,
          icon: <CalendarClock size={16} strokeWidth={1.75} />,
          entries: chatResults?.routines ?? [],
        },
        {
          heading: t`Artifacts`,
          icon: <Files size={16} strokeWidth={1.75} />,
          more:
            found.artifacts.length > 5
              ? { id: `/app/artifacts?q=${encodeURIComponent(q)}`, label: t`See all in Artifacts` }
              : undefined,
          entries: found.artifacts.slice(0, 5).map((item) => ({
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

  const paletteBots = useMemo(
    () =>
      bots.filter(
        (bot) => !isMailThreadAgentSpawnKey(bot.spawnKey) && !isGtmAgentSpawnKey(bot.spawnKey),
      ),
    [bots],
  );
  const [paletteMainBots, paletteSearchOnlyBots] = useMemo(
    () => [
      paletteBots.filter((bot) => !isPageOrIntegrationAgent(bot.spawnKey)),
      paletteBots.filter((bot) => isPageOrIntegrationAgent(bot.spawnKey)),
    ],
    [paletteBots],
  );

  // Settings tabs found only by typing; Computer and Connections are left out (see Integrations).
  const settingsJumps = (
    [
      { label: t`Model settings`, keywords: t`models, providers, API key`, section: "models" },
      { label: t`Voice settings`, keywords: t`voice, speech`, section: "voice" },
      { label: t`Memory settings`, keywords: t`memory`, section: "memory" },
      { label: t`Privacy and approvals`, keywords: t`privacy, approvals`, section: "privacy" },
      ...(bootstrapMe?.billingEnabled === true
        ? [{ label: t`Billing`, section: "billing" as const }]
        : []),
    ] satisfies { label: string; keywords?: string; section: SettingsSection }[]
  ).map(({ label, keywords, section }) => ({
    label,
    keywords,
    run: () => {
      setMobileSidebarOpen(false);
      openSettings(section);
    },
  }));

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

  // A link to /app?settings=privacy (agent replies use it for a missing AI consent) opens that switch;
  // any other value (e.g. /app/settings redirecting to ?settings=general) opens General.
  useEffect(() => {
    const section = settingsSectionFromParam(searchParams.get("settings"));
    if (!section) return;
    openSettings(section);
    // The redirect from /app to the first chat mounts the page again and drops its state, so the
    // query stays until the redirect has happened; the new page then opens Settings from it.
    if (pathname === "/app" && !(initialBotsLoaded && firstThreadRoute(bots, groups) === "/app")) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.delete("settings");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, pathname, initialBotsLoaded, bots, groups]);

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
  const ownerOnlyAskMessageIds = useMemo(
    () => ownerOnlyCredentialAskMessageIds(activeSnapshot, userId),
    [activeSnapshot, userId],
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
  const transcriptDelegateStates = useMemo(
    () => pendingSentBlocks(activeSnapshot?.messages ?? [], Date.now()),
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
      : noChatBots || pageMode || Boolean(active && activeSnapshot));
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

  // Routine mentions need one list call per bot, so they load when the @ menu opens, not on every page load.
  const loadMentionRoutines = useCallback(() => {
    const bots = botsForMentionsRef.current;
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
    ).then((lists) => setMentionRoutines(lists.flat()));
  }, []);

  useEffect(() => {
    if (!initialBotsLoaded || mentionBotsKey === "") {
      setMentionRoutines([]);
      setMentionConnectors([]);
    }
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
  // The tour opens as soon as the first-question card is answered or dismissed, not when apps connect.
  // Not before the account loads: the sidebar pages render only then, and the tour lists its stops once.
  const tourOpen =
    bootstrapMe !== undefined &&
    (tourRestart ||
      (bootstrapMe?.tourSeen === false && !tourEnded && bots.length > 0 && !firstQuestionOpen));
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
      const refresh = () => {
        if (groupId && activeGroupId.current === groupId) {
          return refreshGroupThreadRef.current(groupId);
        }
        if (botId && activeBotId.current === botId) return refreshThreadRef.current(botId);
      };
      await answerThenRefresh({
        answer: async () => {
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
        },
        refresh,
      });
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
      clearConversation: () => {
        const groupId = activeGroupId.current;
        const group = groupId ? groupsRef.current.find((item) => item.id === groupId) : undefined;
        const bot = botsRef.current.find((item) => item.id === activeBotId.current);
        if (group) setClearTarget({ kind: "group", chat: group });
        else if (bot) setClearTarget({ kind: "bot", chat: bot });
      },
      openApprovalSettings: () => openSettings("privacy"),
      editableBotName: (botId) => botsRef.current.find((bot) => bot.id === botId)?.name,
      canSend: (botId) => {
        const bot = botsRef.current.find((item) => item.id === botId);
        return Boolean(bot) && !bot?.disabledBuiltinTools.includes("mail_send");
      },
      sendDraft: async (message) => {
        const botId = activeBotId.current;
        const groupId = activeGroupId.current;
        if (!botId && !groupId) return;
        const result = await rpc.threads.sendDraft({
          ...(groupId ? { groupId } : { botId: botId! }),
          runId: message.runId ?? "",
          messageId: message.id,
        });
        if (result.status !== "sent" && result.status !== "unknown") {
          throw new Error(t`Could not submit this answer`);
        }
        if (groupId && activeGroupId.current === groupId) {
          await refreshGroupThreadRef.current(groupId);
        } else if (botId && activeBotId.current === botId) {
          await refreshThreadRef.current(botId);
        }
      },
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
  const pendingAttachmentsRef = useRef(pendingAttachments);
  pendingAttachmentsRef.current = pendingAttachments;
  const pendingItemsRef = useRef(pendingItems);
  pendingItemsRef.current = pendingItems;
  const onAttachmentPick = useCallback(
    (files: ArrayLike<File> | null, targetThreadKey?: string, priorSkipped: string[] = []) => {
      const threadKey = targetThreadKey ?? activeGroupId.current ?? activeBotId.current;
      if (!threadKey || (!files?.length && !priorSkipped.length)) return false;
      // Read the attachments as they are now: a forward finishes long after it started.
      const existing = attachmentsForThread(pendingAttachmentsRef.current, threadKey);
      const { accepted, skipped } = acceptAttachments(existing.length, files ?? [], {
        count: (name) => t`${name} (max ${ATTACHMENT_MAX_COUNT} attachments)`,
        size: (name) => t`${name} (over 10 MB)`,
      });
      const next: PendingAttachment[] = accepted.map((file, index) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${index}`,
        threadKey,
        file,
        previewUrl: inferAttachmentMimeType(file.name, file.type)?.startsWith("image/")
          ? URL.createObjectURL(file)
          : undefined,
      }));
      if (next.length) setPendingAttachments((current) => [...current, ...next]);
      const notSent = [...priorSkipped, ...skipped];
      setAttachmentNotice(notSent.length ? t`Skipped ${notSent.join(", ")}` : null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return next.length > 0;
    },
    [t],
  );
  const removeAttachment = useCallback((attachment: PendingAttachment) => {
    revokePendingAttachmentPreviews([attachment]);
    setPendingAttachments((current) => current.filter((item) => item.id !== attachment.id));
  }, []);
  // The stored file is fetched through the same scoped artifact read the Download button uses,
  // then attached to the other agent's composer as the owner's own upload.
  const sendMessageFilesToAgent = useCallback(
    async (message: ThreadMessage, agent: SendTarget) => {
      const bot = botsRef.current.find((candidate) => candidate.id === agent.id);
      if (!bot) return;
      // Read the files first and stay in this chat: opening the other one early would let the
      // owner send before the files arrive.
      const { files, failed } = await fetchMessageFiles(transcriptArtifactTarget, message.blocks);
      keepNoticeFor.current = bot.id;
      navigate(`/app/${bot.id}`);
      onAttachmentPick(files, bot.id, failed);
    },
    [navigate, onAttachmentPick, transcriptArtifactTarget],
  );
  const sendFilesToAgent = useCallback(
    async (items: DataRoomApiItem[], agent: SendTarget) => {
      const bot = botsRef.current.find((candidate) => candidate.id === agent.id);
      if (!bot) return;
      const held = pendingItemsRef.current
        .filter((ref) => ref.threadKey === bot.id)
        .map((ref) => ref.id);
      const { refs, copies, skipped } = planSendToAgent(bot, items, held);
      const skippedLabels = skipped.map(
        ({ name }) => t`${name} (max ${ATTACHMENT_MAX_COUNT} attachments)`,
      );
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
      if (!copies.length) {
        if (skippedLabels.length) onAttachmentPick([], bot.id, skippedLabels);
        return;
      }
      const files: File[] = [];
      const failed: string[] = [];
      for (const item of copies) {
        try {
          files.push(new File([await fetchDataRoomBlob(item)], item.name, { type: item.mimeType }));
        } catch {
          failed.push(item.name);
        }
      }
      // One notice for everything that did not arrive, each with its reason.
      onAttachmentPick(files, bot.id, [...failed, ...skippedLabels]);
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
      setGoalNotice(null);
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
        if (isGoalReply(error)) {
          if (botTarget && activeBotId.current === botTarget) {
            setGoalNotice(errorText(error, t`Failed to send message`));
          }
          return true;
        }
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
  const cancelTeaching = useCallback(async () => {
    const id = activeBotId.current;
    if (!id || teachBusy) return;
    const recording = taughtSkills.find(
      (skill) => skill.status === "recording" && taughtSkillsBotId === id,
    );
    if (!recording) return;
    setTeachBusy(true);
    try {
      await rpc.taughtSkills.cancel({ skillId: recording.id });
      await refreshThreadRef.current(id);
      const skills = await rpc.skills.list({ botId: id });
      if (activeBotId.current === id) setTaughtSkills(skills);
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
  const addSkillRoutine = useCallback((skill: { id: string; name: string }) => {
    setRoutineDraft({ ...emptyRoutineDraft(), name: skill.name, taughtSkill: skill });
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

  const pageScope = JSON.stringify([userId, bootstrapMe?.spaceId]);
  const pageAgentContext = { hasAgent: Boolean(active), refreshBots, scope: pageScope };
  const inboxAgent = usePageAgent({
    ...pageAgentContext,
    create: () => rpc.inbox.agent(),
    errorLabel: t`Could not create the Inbox agent`,
    onPage: inboxMode,
  });
  const financeAgent = usePageAgent({
    ...pageAgentContext,
    create: () => rpc.finance.agent(),
    errorLabel: t`Could not create the Finance agent`,
    onPage: financeMode,
  });
  const dataRoomAgent = usePageAgent({
    ...pageAgentContext,
    create: () => rpc.dataRoom.agent(),
    errorLabel: t`Could not create the Data room agent`,
    onPage: dataRoomMode,
  });
  // Scanner's Ask only opens the panel; its agent is made on every visit.
  const scannerAgent = usePageAgent({
    ...pageAgentContext,
    create: () => rpc.scanner.agent(),
    errorLabel: t`Could not create the Scanner agent`,
    onPage: scannerMode,
    createOnAsk: false,
  });
  const scannerCreate = scannerAgent.create;
  const scannerSetOpen = scannerAgent.setOpen;
  useEffect(() => {
    scannerSetOpen(false);
    if (scannerMode && userId && bootstrapMe?.spaceId) void scannerCreate();
  }, [scannerMode, userId, bootstrapMe?.spaceId, scannerCreate, scannerSetOpen]);
  const legalAgent = usePageAgent({
    ...pageAgentContext,
    create: () => rpc.legal.agent(),
    errorLabel: t`Could not create the Legal agent`,
    onPage: legalMode,
  });
  const devinAgent = usePageAgent({
    ...pageAgentContext,
    create: async () => {
      const agent = await rpc.devin.agent();
      setDevinAgentId(agent?.bot.id ?? null);
    },
    errorLabel: t`Could not create the Devin agent`,
    onPage: devinMode,
  });
  const gtmAgent = usePageAgent({
    ...pageAgentContext,
    create: () => rpc.gtm.agent(),
    errorLabel: t`Could not create the GTM agent`,
    onPage: gtmMode,
  });
  const companyAgent = usePageAgent({
    ...pageAgentContext,
    create: () => rpc.company.agent(),
    errorLabel: t`Could not create the Company agent`,
    onPage: companyMode && !companyImportMode,
    clearErrorOnVisit: true,
  });
  const companyImporter = usePageAgent({
    ...pageAgentContext,
    create: () => rpc.companyImport.agent(),
    errorLabel: t`Could not create the Company agent`,
    onPage: companyImportMode,
    clearErrorOnVisit: true,
  });
  const cartaAgent = usePageAgent({
    ...pageAgentContext,
    create: () => rpc.carta.agent(),
    errorLabel: t`Could not create the Carta agent`,
    onPage: investorsMode,
  });
  const investorsAgent = usePageAgent({
    ...pageAgentContext,
    create: () => rpc.investors.agent(),
    errorLabel: t`Could not create the Investors agent`,
    onPage: investorsMode || fundraisingMode,
  });
  const createGtmAgent = gtmAgent.create;
  const createInvestorsAgent = investorsAgent.create;

  /** A row's Ask agent: opens the panel and sends the question. Before the agent exists it only creates it. */
  function askLegalAgentAbout(question: string) {
    legalAgent.ask();
    if (active) void sendMessage(question, [], newClientId());
  }

  function askInvestorsAgent() {
    setCartaAgentCollapsedPref(false);
    // The agent may have been archived since the page opened.
    if (!active && !investorsAgent.creating) void createInvestorsAgent();
  }

  /** A row's Prep outreach: opens the panel and sends the question. Before the agent exists it only creates it. */
  function askInvestorsAgentAbout(question: string) {
    askInvestorsAgent();
    if (active) void sendMessage(question, [], newClientId());
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

  // Carta needs no Create click: the agent appears once Carta is connected.
  useAutoCreateCartaAgent(
    investorsMode && cartaConnected && initialBotsLoaded && Boolean(userId),
    findCartaAgent(bots, userId) !== undefined,
    cartaAgent.create,
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
    creating: investorsAgent.creating,
    error: investorsAgent.error,
  });
  // A window dragged down to phone width would leave a remembered-open panel covering the page.
  // Only the view collapses; the saved preference comes back when the window is wide again.
  useOnPhoneWidth(
    () => {
      setCartaAgentCollapsed(true);
      setInboxAgentCollapsed(true);
      gtmAgent.setOpen(false);
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
  const company = companyImportMode ? companyImporter : companyAgent;
  // The agent panel of the current page; null on bot and group routes, which have their own panels.
  const agentPanel = pagePanelFor({
    kind: companyMode
      ? companyImportMode
        ? "company-importer"
        : "company"
      : inboxMode
        ? "inbox"
        : financeMode
          ? "finance"
          : scannerMode
            ? "scanner"
            : dataRoomMode
              ? "data-room"
              : devinMode
                ? "devin"
                : legalMode
                  ? "legal"
                  : gtmMode
                    ? "gtm"
                    : investorsAgentPage
                      ? "investors"
                      : null,
    agents: {
      inbox: inboxAgent,
      finance: financeAgent,
      scanner: scannerAgent,
      "data-room": dataRoomAgent,
      devin: devinAgent,
      legal: legalAgent,
      gtm: gtmAgent,
      company,
      "company-importer": companyImporter,
      investors: investorsAgent,
    },
    // The Inbox and Investors panels open from their saved collapsed preference, not from the hook.
    inbox: { open: !inboxAgentHidden, collapse: () => setInboxAgentCollapsedPref(true) },
    investors: { open: investorsPanel.open, collapse: () => setCartaAgentCollapsedPref(true) },
  });
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
  /** Opens a bot's settings panel (where Open work is), even on a narrow screen or for the bot already open. */
  function openBotSettings(botId: string, itemId?: string) {
    if (itemId) {
      scratchpadFocus.request(botId, itemId);
      // The row sits under More settings, so a folded panel would hide it.
      setManualFold((current) =>
        current[botId] === false ? current : { ...current, [botId]: false },
      );
    } else {
      scratchpadFocus.clear();
    }
    const destKey =
      userId && bootstrapMe?.spaceId
        ? rightPanelStorageKey(userId, bootstrapMe.spaceId, "bot", botId)
        : null;
    explicitPanelTarget.current = destKey;
    pendingPanelRestore.current = null;
    navigate(`/app/${botId}`);
    setPanelState("settings");
    setRestoredPanelKey(destKey);
    closeMobileSidebar();
  }

  function openSettings(section: SettingsSection = "general", modelProvider?: string) {
    setSettingsSection(section);
    setSettingsModelProvider(modelProvider);
    setSettingsNotice(undefined);
    setSettingsOpen(true);
  }

  async function createBot() {
    try {
      const bot = await rpc.bots.create({
        name: uniqueBotName(
          t`New Bot`,
          bots.map((item) => item.name),
        ),
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

  /** A new agent whose job is to build and keep its own page; it opens with the page showing. */
  async function createPage() {
    try {
      const bot = await rpc.bots.create({
        name: uniqueBotName(
          t`New page`,
          bots.map((item) => item.name),
        ),
        title: "",
        description: "",
        instructions: NEW_PAGE_INSTRUCTIONS,
        notifyOnFinish: true,
        computerMode: "team",
        page: true,
      });
      setBots((current) =>
        current.some((item) => item.id === bot.id) ? current : [bot, ...current],
      );
      const destKey =
        userId && bootstrapMe?.spaceId
          ? rightPanelStorageKey(userId, bootstrapMe.spaceId, "bot", bot.id)
          : null;
      explicitPanelTarget.current = destKey;
      pendingPanelRestore.current = null;
      navigate(`/app/${bot.id}`);
      setPanelState("page");
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
      setComputerError(
        errorText(error, takeControl ? t`Could not take control` : t`Could not start the computer`),
      );
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
    if (!active || bootstrapMe === undefined) return;
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
      const action = computerPanelAutoBoot(state, screen, computersOff);
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
  }, [panel, active?.id, bootstrapMe?.sandboxProvider]);

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
        // Below the docked breakpoint the panel covers the chat (and any approval in it): close it.
        if (!wideScreen()) setPanelState(null);
        else if (carried !== panel) setPanelState(carried);
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
    setGoalNotice(null);
  }, [active?.id, clearReply, groupId, inGroup]);

  useEffect(() => {
    if (!computerOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      // Capture phase plus preventDefault: the side panel underneath stays open.
      event.preventDefault();
      setComputerOpen(false);
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
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
    const groupTarget = activeGroupId.current;
    const botTarget = activeBotId.current;
    if (sendingRef.current || (!groupTarget && !botTarget)) return;
    const last = activeSnapshot?.messages.findLast((message) => message.role === "user");
    const payload = last && retryPayload(last);
    if (!payload) return;

    sendingRef.current = true;
    setSending(true);
    sentHere.current = true;
    void (async () => {
      try {
        if (groupTarget) {
          await rpc.threads.send({ groupId: groupTarget, ...payload, clientNonce: newClientId() });
        } else if (botTarget) {
          const sent = await rpc.threads.send({
            botId: botTarget,
            ...payload,
            clientNonce: newClientId(),
          });
          if (activeBotId.current === botTarget) {
            updateSnapshot((current) =>
              applyThreadSendReceipt(
                current,
                { botId: botTarget, runId: sent.runId, taskId: sent.taskId },
                terminalRunReceipts.current,
              ),
            );
          }
        }
        if (
          (groupTarget && activeGroupId.current === groupTarget) ||
          (botTarget && activeBotId.current === botTarget)
        ) {
          dismissComposerError();
        }
        void refreshBots().catch(() => undefined);
        if (groupTarget) void refreshGroupThreadRef.current(groupTarget).catch(() => undefined);
        else if (botTarget) void refreshThreadRef.current(botTarget).catch(() => undefined);
      } catch (error) {
        sentHere.current = false;
        if (
          (groupTarget && activeGroupId.current === groupTarget) ||
          (botTarget && activeBotId.current === botTarget)
        ) {
          setSendError(errorText(error, t`Failed to send message`));
        }
      } finally {
        sendingRef.current = false;
        setSending(false);
      }
    })();
  }

  const embeddedScreenUrl = embeddableScreenUrl(screenUrl);
  // The address the preview frame has finished loading; the caption waits for it.
  const [loadedScreenUrl, setLoadedScreenUrl] = useState<string | null>(null);
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
  const screenIframeMounted =
    !computerOpen &&
    computer?.kind !== "desktop" &&
    computer?.state === "running" &&
    Boolean(embeddedScreenUrl) &&
    !computerScreenError;
  // A load only counts for the iframe mount that reported it; forget it when the iframe goes away.
  useEffect(() => {
    if (!screenIframeMounted) setLoadedScreenUrl(null);
  }, [screenIframeMounted]);
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
  const legalWaitsForConsent = legalMode && legalConsentWaitsFor !== null;
  const composerDisabled = Boolean(recordingSkill) || pageAgentNeedsModel || legalWaitsForConsent;
  // A "needs your permission" error from before the page's Allow no longer applies once it is given.
  const staleConsentError =
    !legalWaitsForConsent &&
    (sendError === LEGAL_CONSENT_REQUIRED_MESSAGE ||
      displayedRunError === LEGAL_CONSENT_REQUIRED_MESSAGE);
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
      {active && !inGroup ? (
        <InstructionsUpgradeNotice
          botId={active.id}
          instructions={active.instructions}
          onUpgraded={(updated) =>
            setBots((current) => current.map((bot) => (bot.id === updated.id ? updated : bot)))
          }
        />
      ) : null}
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
          className={CHAT_COLUMN_INSET}
          onAddModel={bootstrapMe?.needsModel === true ? () => openSettings("models") : undefined}
          disabled={sending}
          onPick={(text) => void sendMessage(text, [], newClientId())}
        />
      ) : null}
      {cartaAgentPage && transcriptMessages.length === 0 && !transcriptRunning && activeSnapshot ? (
        <AgentPanelIntro
          description={cartaAgentIntro}
          suggestions={cartaSuggestions}
          className={CHAT_COLUMN_INSET}
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
              pageAgentIntroKind(active?.spawnKey) &&
              transcriptMessages.length === 0 &&
              activeSnapshot.olderCursor == null &&
              !transcriptRunning &&
              !sending ? (
              <PageAgentIntro
                kind={pageAgentIntroKind(active?.spawnKey) ?? "inbox"}
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
              <OpeningSpace />
            ) : (
              <Transcript
                key={activeSnapshot?.threadId}
                scrollRef={messageScroll}
                delegateStates={transcriptDelegateStates}
                sentHere={sentHere}
                scrollRequest={scrollRequest}
                onScrollRequestHandled={clearScrollRequest}
                artifactTarget={transcriptArtifactTarget}
                messages={transcriptMessages}
                delegate={delegateWaitTarget(activeSnapshot?.messages ?? [])}
                showToolActivity={showToolActivity}
                olderCursor={activeSnapshot?.olderCursor ?? null}
                loadingOlder={loadingOlder}
                answerableAskMessageId={answerableAskMessageId}
                ownerOnlyAskMessageIds={ownerOnlyAskMessageIds}
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
                onMarkUnread={markMessageUnread}
                sendTargets={sendToAgentTargets}
                onSendFiles={(message, agent) => void sendMessageFilesToAgent(message, agent)}
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
            <Suspense fallback={null}>
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
                  ...(composerDraft.replyToId ? { replyToId: composerDraft.replyToId } : {}),
                  forwarded: [],
                  files: [],
                  saved: false,
                  accounts: composerAccounts ?? [
                    { connectionId: composerDraft.connectionId, label: composerDraft.account },
                  ],
                }}
                onClose={() => setComposerDraft(null)}
              />
            </Suspense>
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
          {!transcriptRunning &&
          pendingDelegateAgents(activeSnapshot?.delegatePendingAgents).length === 0 ? (
            <DelegateWaitNotice messages={activeSnapshot?.messages ?? []} />
          ) : null}
          {pendingDelegateAgents(activeSnapshot?.delegatePendingAgents).map((agent) => (
            // Same side padding as the composer, and the toasts rise above it.
            <div
              key={agent.id}
              data-toast-avoid=""
              className="px-3 pb-2 md:px-[max(1.75rem,calc((100%-900px)/2))]"
            >
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
            <div className="flex flex-wrap items-center justify-center gap-2 px-6 pb-2 text-center text-[13px] text-destructive">
              <Trans>Teaching in progress. Stop teaching before sending a new message.</Trans>
              {computerOpen ? null : (
                <>
                  <TeachStopButton busy={teachBusy} onStop={stopTeaching} />
                  <TeachCancelButton
                    recording={recordingSkill}
                    busy={teachBusy}
                    onCancel={cancelTeaching}
                  />
                </>
              )}
            </div>
          ) : null}
          {active || activeGroup ? (
            <Composer
              key={inGroup ? `group:${groupId}` : `bot:${active?.id}`}
              draftKey={inGroup ? `group:${groupId}` : `bot:${active?.id}`}
              activeName={inGroup ? (activeGroup?.name ?? activeSnapshot?.groupName) : active?.name}
              running={composerShowsStop(currentRuns)}
              disabled={composerDisabled}
              canDictate={
                deviceSpeech?.state === "ready" ||
                Boolean(voiceStatus?.transcribe || voiceStatus?.transcriptionReady)
              }
              deviceDictation={deviceSpeech?.state === "ready"}
              disabledPlaceholder={
                legalWaitsForConsent
                  ? legalConsentWaitsFor === "model"
                    ? t`Add a model to ask`
                    : t`Allow access on the page to ask`
                  : undefined
              }
              pendingAttachments={activePendingAttachments}
              dataRoomItems={activeDataRoomItems}
              onRemoveDataRoomItem={removeDataRoomItem}
              attachmentNotice={attachmentNotice}
              onDismissAttachmentNotice={() => setAttachmentNotice(null)}
              placeholder={
                activeSnapshot?.delegatePending?.length ? waitingForApprovalLabel() : undefined
              }
              sendError={sendError}
              runError={displayedRunError}
              runErrorFix={runErrorAction(activeSnapshot?.run?.error)}
              runErrorId={displayedRunErrorId}
              onRunErrorPresented={handleRunErrorPresented}
              onDismissError={dismissComposerError}
              onRetryRun={retryFailedRun}
              onOpenModelSettings={(provider) =>
                // "" is a rejected key: open the provider the failed run used.
                openSettings("models", provider || (activeSnapshot?.run?.modelProvider ?? ""))
              }
              onOpenBotSettings={() => setPanel("settings")}
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
              onVoice={!inGroup && active && !call ? () => void startElioCall() : undefined}
              artifactTarget={transcriptArtifactTarget}
              replyTarget={activeReplyTarget}
              replyQuote={activeReplyQuote}
              replyTargetName={replyTargetName}
              onClearReply={clearReply}
              mentionTargets={composerMentionTargets}
              onMentionOpen={() => {
                loadMentionConnectors();
                loadMentionRoutines();
              }}
              agentSkills={agentSkills}
              onSlashOpen={refreshAgentSkills}
              goalSlot={
                <>
                  {!inGroup && active && activeSnapshot?.goal ? (
                    <GoalLine
                      goal={activeSnapshot.goal}
                      waiting={isGoalWaitingOnOwner(
                        activeSnapshot.activeRuns ?? [activeSnapshot.run],
                      )}
                      onClear={() => {
                        const botId = active.id;
                        void rpc.threads
                          .clearGoal({ botId })
                          .then(() =>
                            updateSnapshot((prev) => snapshotWithGoal(prev, { goal: null })),
                          )
                          .catch((error: unknown) =>
                            setSendError(errorText(error, t`Could not clear the goal`)),
                          );
                      }}
                    />
                  ) : null}
                  {goalNotice ? (
                    <GoalNotice message={goalNotice} onDismiss={() => setGoalNotice(null)} />
                  ) : null}
                </>
              }
              sentHistory={sentHistory}
              onSlashAction={(action) => {
                if (action === "chat-settings") {
                  setPanel(inGroup ? "group-settings" : "settings");
                  // Page modes render no settings panel; they open on the agent's own page.
                  if (pageMode && active) openBot(active.id);
                  return;
                }
                openSettings("general");
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

  /** The page the route names, or null for a chat. Each page sits in one boundary. */
  function renderPage(): ReactNode {
    if (integrationsMode) {
      return (
        <PageFrame>
          <IntegrationsPage
            activeBotId={activeBotId.current}
            onOpenMessaging={() => setMessagingSettingsOpen(true)}
            onOpenAiDataSharing={() => openSettings("privacy")}
            onOpenVoiceSettings={() => openSettings("voice")}
          />
        </PageFrame>
      );
    }
    if (scannerMode) {
      return (
        <PageFrame>
          <ScannerPage
            spaceName={pageSpaceName}
            onAskAgent={scannerAgent.open ? undefined : scannerAgent.ask}
          />
        </PageFrame>
      );
    }
    if (dataRoomMode) {
      return (
        <PageFrame>
          <DataRoomPage
            onAskAgent={dataRoomAgent.open ? undefined : dataRoomAgent.ask}
            onOpenModelSettings={() => openSettings("models")}
            agents={sendToAgentTargets}
            onSendToAgent={(items, agent) => void sendFilesToAgent(items, agent)}
            spaceName={
              spaces.length > 1
                ? spaces.find((space) => space.id === bootstrapMe?.spaceId)?.name
                : undefined
            }
          />
        </PageFrame>
      );
    }
    if (meetingMatch?.params.meetingId) {
      return (
        <PageFrame>
          <MeetingDetailPage meetingId={meetingMatch.params.meetingId} spaceName={pageSpaceName} />
        </PageFrame>
      );
    }
    if (meetingsMode) {
      return (
        <PageFrame>
          <MeetingsPage spaceName={pageSpaceName} onAddSpeech={() => openSettings("voice")} />
        </PageFrame>
      );
    }
    if (contactMatch?.params.contactId) {
      return (
        <PageFrame>
          <ContactDetailPage id={contactMatch.params.contactId} spaceName={pageSpaceName} />
        </PageFrame>
      );
    }
    if (botPageMatch?.params.botId && botPageMatch.params.pageId) {
      return (
        <PageFrame>
          <BotPageView botId={botPageMatch.params.botId} pageId={botPageMatch.params.pageId} />
        </PageFrame>
      );
    }
    if (calendarMode) {
      return (
        <PageFrame>
          <CalendarPage spaceName={pageSpaceName} bots={bots} onOpenBot={openBotSettings} />
        </PageFrame>
      );
    }
    if (contactsMode) {
      return (
        <PageFrame>
          <ContactsPage spaceName={pageSpaceName} onAskAgent={askChief} />
        </PageFrame>
      );
    }
    if (artifactsMode) {
      return (
        <PageFrame>
          <ArtifactsPage spaceName={pageSpaceName} onAskAgent={askChief} bots={bots} />
        </PageFrame>
      );
    }
    if (boardMode) {
      return (
        <PageFrame>
          <BoardPage embedded />
        </PageFrame>
      );
    }
    if (brexMode) {
      return (
        <PageFrame>
          <BrexPage spaceName={pageSpaceName} />
        </PageFrame>
      );
    }
    if (financeMode) {
      return (
        <PageFrame>
          <FinancePage
            onAskAgent={financeAgent.open ? undefined : financeAgent.ask}
            spaces={spaces}
            spaceId={bootstrapMe?.spaceId}
            onSwitchSpace={(spaceId) => {
              // Like opening another space's chat: the auth boundary changes, so reload. A detail
              // page belongs to this space, so the other space opens on its dashboard.
              if (selectSpace(spaceId)) window.location.assign("/app/finance");
            }}
          />
        </PageFrame>
      );
    }
    if (companyMode) {
      return (
        <PageFrame>
          {pathname === "/app/company/import" ? (
            <CompanyImportPage
              onOpenSettings={() => openSettings("models")}
              settingsOpen={settingsOpen}
              onAskAgent={company.open ? undefined : company.ask}
            />
          ) : (
            <CompanyPage onAskAgent={company.open ? undefined : company.ask} />
          )}
        </PageFrame>
      );
    }
    if (legalMode) {
      return (
        <PageFrame>
          <LegalPage
            onAskAgent={legalAgent.open ? undefined : legalAgent.ask}
            onAskAbout={askLegalAgentAbout}
            onConsentChange={setLegalConsentWaitsFor}
            onOpenSettings={() => openSettings("models")}
            settingsOpen={settingsOpen}
            agentBusy={transcriptRunning}
            spaces={spaces}
            spaceId={bootstrapMe?.spaceId}
            onSwitchSpace={(spaceId) => {
              // Like Finance: the auth boundary changes, so reload on the other space's Legal page.
              if (selectSpace(spaceId)) window.location.assign("/app/legal");
            }}
          />
        </PageFrame>
      );
    }
    if (gtmMode) {
      return (
        <PageFrame>
          <GtmPage
            key={bootstrapMe?.spaceId}
            botId={active?.id}
            remote={pageRemote}
            onAskAgent={gtmAgent.ask}
            agentOpen={gtmAgent.open}
          />
        </PageFrame>
      );
    }
    if (devinMode) {
      return (
        <PageFrame>
          <DevinPage
            key={devinPageKey}
            onAskAgent={devinAgent.open ? undefined : devinAgent.ask}
            onConnect={() => setDevinDialog("connect")}
            onReconnect={() => setDevinDialog("replace")}
          />
        </PageFrame>
      );
    }
    if (investorsMode && investorUpdateMatch?.params.id) {
      return (
        <PageFrame>
          <UpdateEditor
            key={investorUpdateMatch.params.id}
            updateId={investorUpdateMatch.params.id}
            agentBusy={transcriptRunning}
          />
        </PageFrame>
      );
    }
    if (capTableMode) {
      return (
        <PageFrame>
          <CapTablePage />
        </PageFrame>
      );
    }
    if (fundraisingMode) {
      return (
        <PageFrame>
          <FundraisingPage
            spaceName={pageSpaceName}
            onShowAgent={investorsPanel.open ? undefined : askInvestorsAgent}
            onAskAbout={askInvestorsAgentAbout}
            agentBusy={transcriptRunning}
          />
        </PageFrame>
      );
    }
    if (investorsMode) {
      return (
        <PageFrame>
          <InvestorsPage
            onShowAgent={investorsPanel.open ? undefined : askInvestorsAgent}
            onCartaStatus={setCartaConnected}
            onOpenModelSettings={() => openSettings("models")}
            needsModel={bootstrapMe?.needsModel === true}
            agentBusy={transcriptRunning}
          />
        </PageFrame>
      );
    }
    if (inboxMode) {
      return (
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
          consentScope={userId && activeSpaceId ? `${userId}:${activeSpaceId}` : undefined}
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
      );
    }
    return null;
  }
  const pageBody = renderPage();

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
      <SpaceSidebar
        sidebarRef={sidebarRef}
        botsSidebarDensity={botsSidebarDensity}
        botsSidebarCollapsed={botsSidebarCollapsed}
        rail={rail}
        sidebarDocked={sidebarDocked}
        mobileSidebarOpen={mobileSidebarOpen}
        setBotsSidebarCollapsedPref={setBotsSidebarCollapsedPref}
        onOpenSearch={() => setCommandPaletteOpen(true)}
        activityMode={activityMode}
        toggleActivityMode={toggleActivityMode}
        setMobileSidebarOpen={setMobileSidebarOpen}
        createMenuOpen={createMenuOpen}
        setCreateMenuOpen={setCreateMenuOpen}
        bots={bots}
        initialBotsLoaded={initialBotsLoaded}
        createBot={createBot}
        createPage={createPage}
        markBotsRead={markBotsRead}
        askArchiveBots={setArchiveEmailTarget}
        navigate={navigate}
        setPanel={setPanel}
        setNewSpaceOpen={setNewSpaceOpen}
        canCreateSpace={spaces.length > 1 || (spaces.length === 1 && spaces[0]?.memberCount !== 1)}
        setPickerInfoTopic={setPickerInfoTopic}
        sidebarScrollRef={sidebarScrollRef}
        collapsedSidebarSections={collapsedSidebarSections}
        toggleSidebarSection={toggleSidebarSection}
        unseen={unseen}
        inboxUnread={inboxUnread}
        glance={glance}
        currentPage={pageKey ?? null}
        hiddenPages={hiddenPages}
        addedPages={addedPages}
        toggleHiddenPage={toggleHiddenPage}
        setAddedPages={setAddedPages}
        sidebarLayout={sidebarLayout}
        sidebarDragLabel={sidebarDragLabel}
        dropSidebarItem={dropSidebarItem}
        sidebarDragOverlay={sidebarDragOverlay}
        sidebarGroups={sidebarGroups}
        botSections={botSections}
        bootstrapMe={bootstrapMe}
        userId={userId}
        collapsedRosterParents={collapsedRosterParents}
        editingFolderId={editingFolderId}
        toggleFolder={toggleFolder}
        setEditingFolderId={setEditingFolderId}
        renameFolder={renameFolder}
        deleteFolder={deleteFolder}
        openSpaceChat={openSpaceChat}
        spaceMenuAnchor={spaceMenuAnchor}
        setSpaceMenu={setSpaceMenu}
        inGroup={inGroup}
        pageMode={pageMode}
        active={active}
        activeGroup={activeGroup}
        dismissedRunErrorIds={dismissedRunErrorIds}
        displayedRunError={displayedRunError}
        toggleRosterParent={toggleRosterParent}
        fileDropBotId={fileDropBotId}
        rowFileDrag={rowFileDrag}
        setFileDropBotId={setFileDropBotId}
        keepNoticeFor={keepNoticeFor}
        onAttachmentPick={onAttachmentPick}
        setFocusComposerBotId={setFocusComposerBotId}
        openBot={openBot}
        openBotSettings={openBotSettings}
        moveSidebarItem={moveSidebarItem}
        botMenuAnchor={botMenuAnchor}
        setBotMenu={setBotMenu}
        agentAppFor={agentAppFor}
        activeSnapshot={activeSnapshot}
        botMenu={botMenu}
        archivedBots={archivedBots}
        archivedGroups={archivedGroups}
        archivedOpen={archivedOpen}
        setArchivedOpen={setArchivedOpen}
        refreshBots={refreshBots}
        setDeleteTarget={setDeleteTarget}
        setDeleteGroupTarget={setDeleteGroupTarget}
        integrationsMode={integrationsMode}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        userName={userName}
        initials={initials}
        openSettings={openSettings}
        chiefId={chiefId}
        tourOpen={tourOpen}
        onTourAsk={() => {
          if (!chiefId) return;
          tourQuestion.current = true;
          setFocusComposerBotId(chiefId);
          openBot(chiefId);
        }}
        onTourSkip={() => setAskChiefChip(true)}
        onTourEnd={() => setTourEnded(true)}
        setTourRestart={setTourRestart}
        setBootstrapMe={setBootstrapMe}
      />

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
          className={`isolate flex min-w-0 flex-1 flex-col bg-background pb-[var(--toast-page-reserve,0px)] outline-none ${
            paneDraggingFiles ? "ring-2 ring-inset ring-ring" : ""
          }`}
        >
          <RecordingPillHost />
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
                : TOP_BAR_HEIGHT
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
                        : (active?.name ??
                          (opening ? "" : noChatBots ? t`No bots yet` : t`Select a bot`))}
                    </span>
                  </span>
                  {!inGroup && active?.firewall ? <BotFirewallMark /> : null}
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
                  data-tour="routines"
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
                  {/* One icon whatever the computer state, so it does not change while the panel loads. */}
                  <CalendarClock size={18} strokeWidth={1.6} className="text-foreground/75" />
                </button>
              ) : null}
            </div>
          </div>
          {pageBody ??
            (opening ? (
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
            ))}
        </main>
      </PageNavContext.Provider>

      <CallCard onSettings={() => openSettings("voice")} />

      <ResizableSidePanel
        botsSidebarCollapsed={botsSidebarCollapsed}
        onClose={agentPanel ? agentPanel.collapse : () => setPanel(null)}
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
          <div className="rk-scroll h-full w-full overflow-y-auto px-5 pt-[17px] pb-[calc(17px+var(--toast-panel-reserve,0px))]">
            {panel !== "routine" && panel !== "create-group" && panel !== "group-settings" ? (
              <div
                className={`sticky top-[-17px] z-10 -mx-5 -mt-[17px] mb-4 flex items-center justify-between bg-background px-5 ${TOP_BAR_HEIGHT}`}
              >
                {/* Between phone and desktop this panel covers the chat header, so it carries the way to the sidebar. A phone panel is a full sheet that closes back to the chat. */}
                <div className="flex min-w-0 items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t`Open navigation`}
                    onClick={() => setMobileSidebarOpen(true)}
                    className="-ms-1.5 text-foreground/75 max-sm:hidden lg:hidden"
                  >
                    <Menu size={19} strokeWidth={1.7} />
                  </Button>
                  <span
                    className="min-w-0 truncate text-[16px] font-medium text-foreground"
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
                      computerScreenError || noComputerScreen || computersOff ? null : (
                        computerStateLabel(computer?.state)
                      )
                    ) : (
                      <Trans>Group</Trans>
                    )}
                  </span>
                </div>
                <div className="flex shrink-0 gap-1">
                  {active &&
                  panel === "computer" &&
                  !computerOpen &&
                  computerPanelNeedsMaintenance(computer?.state, booting, computersOff) ? (
                    <ComputerMaintenanceActions
                      botId={active.id}
                      computer={computer}
                      onChanged={async () => {
                        await refreshThread(active.id);
                      }}
                    />
                  ) : null}
                  {/* The Routines button in the chat header is the way back to the computer. */}
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
              <Suspense fallback={null}>
                <BotPagePanel
                  key={active.id}
                  botId={active.id}
                  remote={pageRemote}
                  dataRemote={pageDataRemote}
                />
              </Suspense>
            ) : null}
            {panel === "list" && botPins?.list ? (
              <PinsList pins={botPins} onPins={setBotPins} />
            ) : null}
            {panel === "computer" && active ? (
              <div>
                <RoutineListHeader
                  empty={activeRoutines.every((r) => r.managedKind !== null)}
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
                      onToggleActive={(next) => {
                        const botId = active.id;
                        void rpc.routines
                          .update({ routineId: routine.id, active: next })
                          .then((saved) =>
                            setRoutines((current) =>
                              current.map((entry) => (entry.id === saved.id ? saved : entry)),
                            ),
                          )
                          .catch(() => reloadRoutines(botId));
                      }}
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
                          onLoad={() => setLoadedScreenUrl(embeddedScreenUrl)}
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
                                deploymentOwner={bootstrapMe?.isDeploymentOwner === true}
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
                    {showsComputerCaption({
                      kind: computer?.kind,
                      state: computer?.state,
                      screenLoaded: loadedScreenUrl === embeddedScreenUrl,
                      hasError: Boolean(computerScreenError),
                      open: computerOpen,
                    }) ? (
                      <p className="mt-2 truncate text-[13.5px] text-muted-foreground" dir="auto">
                        {/s$/i.test(active.name.trim())
                          ? t`${active.name}' computer`
                          : t`${active.name}'s computer`}
                      </p>
                    ) : null}
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
                focusName={manualFold[active.id] ?? namingBotId === active.id}
                foldable={active.id in manualFold || namingBotId === active.id}
                onFoldedChange={(folded) =>
                  setManualFold((current) => ({ ...current, [active.id]: folded }))
                }
                notificationsOff={notificationsOff}
                onOpenNotificationSettings={() => openSettings("general")}
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
                focusScratchpadItemId={
                  scratchpadFocus.focus?.botId === active.id
                    ? scratchpadFocus.focus.itemId
                    : undefined
                }
                focusScratchpadNonce={
                  scratchpadFocus.focus?.botId === active.id
                    ? scratchpadFocus.focus.nonce
                    : undefined
                }
                onScratchpadFocusHandled={scratchpadFocus.consume}
                onCheckInChange={() => reloadRoutines(active.id)}
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
                taughtSkills={routineTaughtSkills}
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
                onOpenModelSettings={() => openSettings("models")}
                onOpenBotSettings={() => setPanel("settings")}
                onResume={(resumed) =>
                  setRoutines((current) =>
                    current.map((entry) => (entry.id === resumed.id ? resumed : entry)),
                  )
                }
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
                    !routineDraft.watch &&
                    !routineDraft.messageProvider
                  ) {
                    setRoutineError(t`Add a schedule, webhook, GitHub, or message trigger`);
                    return;
                  }
                  if (
                    routineDraft.watch &&
                    !WatchSpecSchema.safeParse(routineDraft.watch).success
                  ) {
                    setRoutineError(t`Enter the page address, starting with http:// or https://`);
                    return;
                  }
                  if (!routineDraft.prompt.trim() && !routineDraft.taughtSkill) {
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
                      modelCredentialId:
                        model && routineDraft.credentialId ? routineDraft.credentialId : null,
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
                        const parsed = routineRunAtDate(
                          routineDraft.runAtLocal,
                          routineDraft.timezone || targetRoutine.timezone,
                        );
                        if (!parsed || parsed.getTime() <= Date.now()) {
                          setRoutineError(t`Run time must be in the future.`);
                          return;
                        }
                        runAt = parsed.toISOString();
                      }
                      saved = await rpc.routines.update({
                        routineId: targetRoutine.id,
                        name:
                          routineDraft.name.trim() ||
                          defaultRoutineName(routineDraft.prompt, routineDraft.taughtSkill?.name),
                        prompt: routineDraft.prompt.trim(),
                        taughtSkillId: routineDraft.taughtSkill?.id ?? null,
                        crons,
                        active: armOneShot ? true : routineDraft.active,
                        webhookEnabled: routineDraft.webhookEnabled,
                        githubEnabled: routineDraft.githubEnabled,
                        messageProvider: routineDraft.messageProvider,
                        quiet: routineDraft.quiet,
                        // Always sent: the update schema rejects empty crons unless a watch comes with them.
                        watch: routineDraft.watch,
                        ...(routineDraft.timezone &&
                        routineDraft.timezone !== targetRoutine.timezone
                          ? { timezone: routineDraft.timezone }
                          : {}),
                        ...(routineModel.modelProvider !== targetRoutine.modelProvider ||
                        routineModel.modelId !== targetRoutine.modelId ||
                        routineModel.modelCredentialId !==
                          (targetRoutine.modelCredentialId ?? null) ||
                        routineModel.thinkingLevel !== targetRoutine.thinkingLevel
                          ? routineModel
                          : {}),
                        ...(runAt ? { runAt } : {}),
                      });
                    } else {
                      saved = await rpc.routines.create({
                        botId: targetBotId,
                        name:
                          routineDraft.name.trim() ||
                          defaultRoutineName(routineDraft.prompt, routineDraft.taughtSkill?.name),
                        prompt: routineDraft.prompt.trim(),
                        taughtSkillId: routineDraft.taughtSkill?.id ?? null,
                        crons,
                        timezone: routineDraft.timezone || accountTimezone(bootstrapMe),
                        active: routineDraft.active,
                        notify: true,
                        webhookEnabled: routineDraft.webhookEnabled,
                        githubEnabled: routineDraft.githubEnabled,
                        messageProvider: routineDraft.messageProvider,
                        quiet: routineDraft.quiet,
                        watch: routineDraft.watch?.kind === "page" ? routineDraft.watch : null,
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
              void catchBotMenuRequest(
                request.then(() => refreshBots()),
                contextChat.id,
              );
            }}
            onToggleUnread={() => {
              const unread = !contextChat.unread;
              setBotMenu(null);
              if (contextBot) {
                const request = unread ? markBotUnread(contextBot.id) : markBotRead(contextBot.id);
                void catchBotMenuRequest(request, contextChat.id);
              } else {
                const request = unread
                  ? rpc.threads.markUnread({ groupId: contextGroup!.id })
                  : rpc.threads.markRead({ groupId: contextGroup!.id });
                void catchBotMenuRequest(
                  request.then(() =>
                    setGroups((current) =>
                      current.map((group) =>
                        group.id === contextGroup!.id ? { ...group, unread } : group,
                      ),
                    ),
                  ),
                  contextChat.id,
                );
              }
            }}
            onMoveToSection={(sectionId) => {
              setBotMenu(null);
              if (sectionId === contextChat.sectionId) return;
              const request = contextBot
                ? rpc.bots.update({ botId: contextBot.id, sectionId })
                : rpc.groups.update({ groupId: contextGroup!.id, sectionId });
              void catchBotMenuRequest(
                request.then(() => refreshBots()),
                contextChat.id,
              );
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
                    closeMobileSidebar();
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
              closeMobileSidebar();
            }}
            onDuplicate={() => {
              setBotMenu(null);
              closeMobileSidebar();
              const request = contextBot
                ? rpc.bots.duplicate({ botId: contextBot.id })
                : rpc.groups.duplicate({ groupId: contextGroup!.id });
              void request
                .then(async (chat) => {
                  await refreshBots();
                  navigate(contextBot ? `/app/${chat.id}` : `/app/g/${chat.id}`);
                })
                .catch((error: unknown) => setSendError(errorText(error, t`Failed to duplicate`)));
            }}
            onClear={
              contextBot
                ? undefined
                : () => {
                    setClearTarget({ kind: "group", chat: contextGroup! });
                    setBotMenu(null);
                  }
            }
            onHide={
              contextBot
                ? () => {
                    const { id, name } = contextBot;
                    setBotMenu(null);
                    void rpc.bots
                      .update({ botId: id, hidden: true })
                      .then(() => refreshBots())
                      .then(() => {
                        setArchiveUndo(null);
                        setFolderUndo(null);
                        setHideUndo({ id, name });
                      })
                      .catch((error: unknown) =>
                        setSendError(errorText(error, t`Failed to hide bot`)),
                      );
                  }
                : undefined
            }
            onArchive={() => {
              setBotMenu(null);
              const target = contextBot
                ? { kind: "bot" as const, id: contextBot.id, name: contextBot.name }
                : { kind: "group" as const, id: contextGroup!.id, name: contextGroup!.name };
              const request =
                target.kind === "bot"
                  ? rpc.bots.archive({ botId: target.id })
                  : rpc.groups.archive({ groupId: target.id });
              // Recorded before the await: the archive's own redirect replaces the route.
              const openAtArchive =
                target.kind === "bot" ? botId === target.id : groupId === target.id;
              const pathAtArchive = pathnameRef.current;
              // A move made while the request is in flight is the user's own choice, so Undo
              // must not take them back.
              let movedMeanwhile = false;
              const sequence = ++archiveSequence.current;
              void request
                .then(() => {
                  movedMeanwhile = pathnameRef.current !== pathAtArchive;
                  return refreshBots(true);
                })
                // One frame for the redirect to reach the route refs, so Undo can tell them apart.
                .then(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
                .then(() => {
                  if (archiveSequence.current !== sequence) return;
                  setHideUndo(null);
                  setFolderUndo(null);
                  setArchiveUndo({
                    ...target,
                    wasOpen: openAtArchive && !movedMeanwhile,
                    landedPath: pathnameRef.current,
                    seq: sequence,
                  });
                })
                .catch((error: unknown) => setSendError(errorText(error, t`Failed to archive`)));
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

        {/* One notice at a time: the latest action wins. */}
        {archiveUndo ? (
          <SidebarUndoNotice
            message={archiveUndo.error ?? t`${archiveUndo.name} archived`}
            // A pending restore must not lose its failure to the auto-dismiss timer.
            hold={archiveUndo.pending}
            onUndo={() => {
              const target = archiveUndo;
              const { kind, id, seq } = target;
              if (target.pending) return;
              const clickedPath = pathnameRef.current;
              const update = (
                next: (NonNullable<typeof archiveUndo> & { pending?: boolean }) | null,
              ) =>
                setArchiveUndo((current) =>
                  current && current.seq === seq ? (next ? { ...next } : null) : current,
                );
              update({ ...target, pending: true });
              const restore =
                kind === "bot"
                  ? rpc.bots.restore({ botId: id })
                  : rpc.groups.restore({ groupId: id });
              void restore
                .then(() => refreshBots(true))
                .then(() => {
                  update(null);
                  if (reopensAfterUndo(target, clickedPath, pathnameRef.current))
                    navigate(kind === "bot" ? `/app/${id}` : `/app/g/${id}`);
                })
                // Kept on screen, because setSendError only shows inside the composer.
                .catch((error: unknown) =>
                  update({ ...target, error: errorText(error, t`Failed to restore`) }),
                );
            }}
            onDismiss={() => setArchiveUndo(null)}
          />
        ) : folderUndo ? (
          <SidebarUndoNotice
            message={t`Chats grouped into folders`}
            onUndo={() => void undoAutoGroup()}
            onDismiss={() => setFolderUndo(null)}
          />
        ) : hideUndo ? (
          <SidebarUndoNotice
            message={t`${hideUndo.name} hidden`}
            onUndo={() => {
              const { id } = hideUndo;
              setHideUndo(null);
              void rpc.bots
                .update({ botId: id, hidden: false })
                .then(() => refreshBots())
                .catch(() => undefined);
            }}
            onDismiss={() => setHideUndo(null)}
          />
        ) : null}

        <CommandPalette
          open={commandPaletteOpen}
          onOpenChange={setCommandPaletteOpen}
          // An email's chat is found once, under Chats; the GTM page already opens the GTM agent.
          // Page and integration agents open from their page's Ask button, so only a search lists them.
          bots={paletteMainBots}
          searchOnlyBots={paletteSearchOnlyBots}
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
            // Plain keywords, not translated: "New bot" already has a catalog entry.
            { label: t`New bot`, keywords: "agent create", run: () => void createBot() },
            { label: t`New folder`, run: () => void createFolder() },
            { label: t`Group chats into folders`, run: () => void autoGroupSidebar() },
            ...spaceSwitchTargets(spaces, bootstrapMe?.spaceId).map((space) => ({
              label: t`Switch to ${space.name}`,
              keywords: t`space`,
              run: () => {
                setMobileSidebarOpen(false);
                if (selectSpace(space.id)) window.location.assign("/app");
              },
            })),
            ...settingsJumps,
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

        {archiveEmailTarget ? (
          <ArchiveBotsDialog
            count={archiveEmailTarget.length}
            onCancel={() => setArchiveEmailTarget(null)}
            onConfirm={async () => {
              const results = await Promise.allSettled(
                archiveEmailTarget.map((botId) => rpc.bots.archive({ botId })),
              );
              const failed = results.filter((result) => result.status === "rejected").length;
              setArchiveEmailTarget(null);
              if (failed > 0) setSendError(t`Could not archive ${failed} email chats`);
              await refreshBots(true);
            }}
          />
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
            hiddenBots={bots.filter((bot) => bot.hiddenAt)}
            onShowBot={(botId) => {
              void rpc.bots
                .update({ botId, hidden: false })
                .then(() => refreshBots())
                .catch(() => undefined);
            }}
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
            memoryConfigLoadFailed={memoryProviderConfigLoadFailed}
            onRetryMemoryConfigLoad={retryMemoryProviderConfigLoad}
            onMemoryConfigChange={(config) => {
              memoryProviderConfigRevision.current += 1;
              setMemoryProviderConfig(config);
              setMemoryProviderConfigLoadFailed(false);
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
                    onCancel={cancelTeaching}
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
                  <>
                    <TeachStopButton busy={teachBusy} onStop={stopTeaching} />
                    <TeachCancelButton
                      recording={recordingSkill}
                      busy={teachBusy}
                      onCancel={cancelTeaching}
                    />
                  </>
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
                {computerBot && !recordingSkill && !computersOff ? (
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
                dock
                recordingSkillId={recordingSkill?.id}
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
        {missingPath === pathname ? (
          <ErrorBoundary fallback={<SectionLoadFailed />}>
            <Suspense fallback={<RowsSkeleton className="p-6" />}>
              <NotFoundPage />
            </Suspense>
          </ErrorBoundary>
        ) : (
          shell
        )}
      </AppNavigateContext.Provider>
    </AvatarStyleProvider>
  );
}

/** Whether the pane is still waiting for its chat: the bot list loads, or the route's bot is not in it yet. */
const SETTINGS_SECTIONS = [
  "general",
  "privacy",
  "models",
  "memory",
  "voice",
  "computer",
  "billing",
  "connections",
] as const satisfies readonly SettingsSection[];

export function settingsSectionFromParam(value: string | null): SettingsSection | null {
  if (value === null) return null;
  return (SETTINGS_SECTIONS as readonly string[]).includes(value)
    ? (value as SettingsSection)
    : "general";
}

export function chatIsOpening(input: {
  hasChat: boolean;
  botsLoaded: boolean;
  routeWaiting: boolean;
}): boolean {
  return !input.hasChat && (!input.botsLoaded || input.routeWaiting);
}

/**
 * Undo reopens the archived chat only if it was the open one, and only while the view is still
 * on the path the archive left it at, both when Undo was clicked (`clickedPath`) and when the
 * restore resolves (`currentPath`). Anything opened since is where the person meant to be.
 */
export function reopensAfterUndo(
  undo: { wasOpen: boolean; landedPath: string },
  clickedPath: string,
  currentPath: string,
): boolean {
  return undo.wasOpen && undo.landedPath === clickedPath && undo.landedPath === currentPath;
}

/** Whether an `/app/:botId` link still names a chat, live or archived. */
export function knownBotId(
  botId: string,
  bots: readonly Pick<Bot, "id">[],
  archivedBots: readonly Pick<Bot, "id">[],
): boolean {
  return bots.some((bot) => bot.id === botId) || archivedBots.some((bot) => bot.id === botId);
}

/** `name`, or `name 2`, `name 3` ... when bots already use it, so new bots never share a sidebar row's text. */
export function uniqueBotName(name: string, taken: readonly string[]): string {
  if (!taken.includes(name)) return name;
  let n = 2;
  while (taken.includes(`${name} ${n}`)) n += 1;
  return `${name} ${n}`;
}

/**
 * Where a person with no usable route lands: the first chat. A page's auto-created agent is not a
 * chat to land on, so a space holding only those stays at /app. A pending `?settings=` link is
 * carried along, so the redirect cannot swallow it before the shell opens the dialog.
 */
export function firstThreadRoute(
  bots: readonly Pick<Bot, "id" | "spawnKey">[],
  groups: readonly Pick<Group, "id">[],
  search = "",
): string {
  const settings = new URLSearchParams(search).get("settings");
  const query = settings === null ? "" : `?${new URLSearchParams({ settings })}`;
  const chat = bots.find((bot) => pageAgentKind(bot.spawnKey) === null);
  if (chat) return `/app/${chat.id}${query}`;
  if (groups[0]) return `/app/g/${groups[0].id}${query}`;
  return `/app${query}`;
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

/** The "<bot>'s computer" caption names a live screen; under a placeholder, hint or a frame that has not loaded it labels nothing. */
export function showsComputerCaption(input: {
  kind: ComputerStatus["kind"] | undefined;
  state?: ComputerStatus["state"];
  screenLoaded: boolean;
  hasError: boolean;
  open: boolean;
}) {
  return (
    input.kind !== "desktop" &&
    input.state === "running" &&
    input.screenLoaded &&
    !input.hasError &&
    !input.open
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
