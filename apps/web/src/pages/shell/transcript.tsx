import { i18n } from "@lingui/core";
import { plural } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import type { ChatMarkdownProps } from "@rakazo/chat-ui/web";
import { ChatMarkdown } from "@rakazo/chat-ui/web";
import type { MailEdits, MessageReaction, ThreadMessage } from "@rakazo/contracts";
import { canReactToThreadMessage, MESSAGE_REACTIONS } from "@rakazo/contracts";
import {
  DEFAULT_BOT_COLOR,
  firstUnreadMessageId,
  formatMessageTime,
  groupVoiceChats,
  isApprovalAskBlock,
  isPeerReceiptBlocks,
  isStoredMessage,
  isToolActivityBlock,
  lastReadMessageId,
  laterMessageId,
  newMessagesAfter,
  projectMessageReactions,
  timeSeparatorIds,
  toolPhrase,
  userRepliedAfter,
} from "@rakazo/core";
import type { GroupAvatarMember } from "@rakazo/ui-web";
import {
  BotAvatar,
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  resolvePersonaColorDef,
} from "@rakazo/ui-web";
import {
  ArrowDown,
  BookmarkCheck,
  BookmarkPlus,
  Copy,
  MoreHorizontal,
  Reply,
  Smile,
  TextQuote,
  X,
} from "lucide-react";
import type { ReactNode, RefObject } from "react";
import {
  createContext,
  Fragment,
  memo,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ArtifactFileCard } from "../../components/ArtifactFileCard";
import { AskCard } from "../../components/AskCard";
import { ActiveBotGlyph, CollaborationMarker } from "../../components/ai/CollaborationMarker";
import { BotToolControlsContext } from "../../components/BotToolControls";
import { CloudAgentCard } from "../../components/CloudAgentCard";
import { VoiceChatCard } from "../../components/call/VoiceChatCard";
import { EmailCards } from "../../components/EmailCards";
import { FinanceCardGroup } from "../../components/FinanceCards";
import { MailApprovalCard } from "../../components/MailApprovalCard";
import { MailThreadCard } from "../../components/MailThreadCard";
import { MessageHoverMetadata } from "../../components/MessageHoverMetadata";
import {
  LIVE_TOOL_STEP_WINDOW,
  StandaloneToolActivity,
  ToolActivityDisclosure,
  ToolOnlyNarration,
  ToolSteps,
} from "../../components/ToolActivityDisclosure";
import { SkillDraftCard } from "../../components/teach/SkillDraftCard";
import { bubbleMeasure, UserTextBubble } from "../../components/UserTextBubble";
import type { ArtifactTarget } from "../../lib/artifact-open";
import { delegateWaitTarget } from "../../lib/delegate-wait";
import { maskCurrencyWhenHidden, useHideAmounts } from "../../lib/hide-amounts-preference";
import { copyableMessageText } from "../../lib/message-text";
import { messageProviderLabel } from "../../lib/messaging";
import { quoteDraftForSelection } from "../../lib/quote-selection";
import { runPhaseLine, runPhaseWaitingLabel } from "../../lib/run-phase";
import {
  isToolOnlyNarration,
  messageHasVisibleBlocks,
  renderableMessageBlocks,
  shouldRenderToolCard,
  toolStepCount,
} from "../../lib/tool-activity-view";
import {
  transcriptIsNearEnd,
  transcriptMovedDown,
  transcriptShouldSnap,
  transcriptUserJustSent,
} from "../../lib/transcript-scroll";
import { useMailAccounts } from "../../lib/use-mail-accounts";
import type { RememberControls } from "../../lib/use-remembered-messages";
import { useAttended } from "../../lib/use-sidebar-glance";
import type { WorkingActivity } from "../../lib/working-activity";
import { previewMessageText, ReplyLine, TimeSeparator } from "./chat-context";
import {
  AppConnectCard,
  ArtifactImageGrid,
  ChartBlockView,
  ChoiceCard,
  McpApprovalCard,
  ResultCard,
} from "./message-cards";
import { toolActionLabel } from "./working-label";

/** Opens an in-app path through the router; unset outside the page, where links load normally. */
const AppNavigateContext = createContext<((href: string) => void) | undefined>(undefined);

/** Chat markdown whose /app/ links navigate in place instead of reloading the page. */
function ThreadMarkdown(props: ChatMarkdownProps) {
  const onNavigate = useContext(AppNavigateContext);
  return <ChatMarkdown {...props} onNavigate={onNavigate} />;
}

/** A thin line in the bot's accent (neutral without one) marking where unread messages start. */
export function UnreadDivider() {
  return (
    <div
      data-unread-divider=""
      data-testid="unread-divider"
      className="flex w-160 max-w-full items-center gap-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground in-data-bot-accent:text-bot-accent"
    >
      <span aria-hidden="true" className="h-px flex-1 bg-border in-data-bot-accent:bg-bot-accent" />
      <Trans>New</Trans>
    </div>
  );
}

export const Transcript = memo(function Transcript({
  scrollRef,
  sentHere,
  scrollRequest,
  onScrollRequestHandled,
  artifactTarget,
  messages,
  showToolActivity,
  olderCursor,
  loadingOlder,
  answerableAskMessageId,
  running,
  workingBots,
  workingActivity: activity,
  workingStartedAt,
  onStopRun,
  onRetryRun,
  failedNote,
  failedScheduled = false,
  onLoadOlder,
  onOpenBot,
  onAnswer,
  onReply,
  onQuote,
  onReact,
  remember,
  onJumpToMessage,
  onOpenPeerMessages,
  memberName,
  peerBot,
  onRefresh,
  onBotChanged,
  onAddRoutine,
  voiceReady,
  speakingMessageId,
  onSpeak,
  onOpenComputer,
  lastReadSeq,
  onRead,
  anchorToUnread = true,
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
  /** Set by the composer while its own message is on the way in. */
  sentHere: RefObject<boolean>;
  scrollRequest: { messageId: string; nonce: number } | null;
  onScrollRequestHandled: () => void;
  artifactTarget: ArtifactTarget;
  messages: ThreadMessage[];
  showToolActivity: boolean;
  olderCursor: number | null;
  loadingOlder: boolean;
  answerableAskMessageId: string | null;
  running: boolean;
  workingBots: GroupAvatarMember[];
  workingActivity?: WorkingActivity;
  workingStartedAt?: number;
  onStopRun?: () => void;
  onRetryRun?: () => void;
  /** Why the last run failed, once its error above the composer was dismissed; "" when unknown. */
  failedNote?: string | null;
  /** The failed run was a routine (a scheduled or Scan now run), not a reply to a message. */
  failedScheduled?: boolean;
  onLoadOlder: () => void | Promise<void>;
  onOpenBot: (botId: string) => void;
  onAnswer: (
    message: ThreadMessage,
    text: string,
    username?: string,
    mail?: MailEdits,
  ) => Promise<void>;
  onReply: (message: ThreadMessage) => void;
  onQuote: (message: ThreadMessage, quote: string) => void;
  onReact: (message: ThreadMessage, reaction: MessageReaction) => Promise<void>;
  remember?: RememberControls;
  onJumpToMessage: (messageId: string) => void;
  onOpenPeerMessages: (peer: { peerBotId: string; peerBotName: string }) => void;
  memberName?: (botId: string | undefined) => string | undefined;
  peerBot: (botId: string) => { name?: string; color: string; status?: string } | undefined;
  onRefresh: () => Promise<void>;
  onBotChanged: () => Promise<void>;
  onAddRoutine: (name: string, prompt: string) => void;
  voiceReady: boolean;
  speakingMessageId: string | null;
  onSpeak: (message: ThreadMessage) => void;
  onOpenComputer: (botId?: string) => void;
  /** The reader's read boundary when the thread opened; the "New" divider and pill count start there. */
  lastReadSeq?: number;
  /** Called, debounced, once the reader is attending to messages up to `upTo`; `toEnd` when at the latest. */
  onRead?: (messageId: string, toEnd: boolean) => Promise<void> | void;
  /** Open on the "New" divider. A docked page-agent panel opens on the latest message instead. */
  anchorToUnread?: boolean;
}) {
  const { t } = useLingui();
  const [atEnd, setAtEnd] = useState(true);
  const following = useRef(true);
  const autoScrolling = useRef(false);
  const lastScrollTop = useRef<number | null>(null);
  const autoScrollTimer = useRef<number | undefined>(undefined);
  // Until this time, a layout change keeps the "New" divider where the open scrolled it.
  const dividerPinUntil = useRef(0);
  const jumpButtonRef = useRef<HTMLButtonElement>(null);
  const messageById = useMemo(
    () => new Map(messages.map((message) => [message.id, message])),
    [messages],
  );
  const reactionView = useMemo(() => projectMessageReactions(messages), [messages]);
  // One Tab stop for all the messages' More buttons (roving): the newest, or the one last focused.
  // Up and Down move between them, so Tab reaches the composer in a few presses on a long chat.
  const [moreId, setMoreId] = useState<string | null>(null);
  const items = foldFinanceRuns(groupVoiceChats(reactionView.visibleMessages), (id) =>
    reactionView.reactions.has(id),
  );
  // Only messages rendered on their own have a More button; grouped voice and finance cards do not.
  const actionIds = items.flatMap((item) =>
    item.kind === "message" &&
    !item.message.id.startsWith("progress:") &&
    !isPeerReceiptBlocks(item.message.blocks) &&
    messageHasVisibleBlocks(item.message.blocks, showToolActivity)
      ? [item.message.id]
      : [],
  );
  const tabbableMoreId = moreId && actionIds.includes(moreId) ? moreId : actionIds.at(-1);
  const separatorIds = timeSeparatorIds(
    reactionView.visibleMessages.filter((message) =>
      messageHasVisibleBlocks(message.blocks, showToolActivity),
    ),
  );
  // The divider is placed once, when the thread opens, and stays put while the reader reads on.
  const readable = useMemo(() => messages.filter(isStoredMessage), [messages]);
  const countable = useMemo(
    () => readable.filter((message) => messageHasVisibleBlocks(message.blocks, showToolActivity)),
    [readable, showToolActivity],
  );
  const [openedLastReadSeq] = useState(lastReadSeq);
  const [dividerId] = useState(() => firstUnreadMessageId(countable, openedLastReadSeq));
  // Live rows carry event seqs, so everything after open is compared by id and list order.
  const [openedLatestId] = useState(() => countable.at(-1)?.id ?? null);
  const showDividerId =
    dividerId && messageById.has(dividerId) && !userRepliedAfter(messages, openedLatestId)
      ? dividerId
      : null;
  const attended = useAttended();
  const latestId = readable.at(-1)?.id ?? null;
  const latestIdRef = useRef(latestId);
  latestIdRef.current = latestId;
  // The newest message the reader has had in view, and the newest already reported as read.
  const [seenId, setSeenId] = useState(() => lastReadMessageId(readable, openedLastReadSeq));
  const [viewId, setViewId] = useState<string | null>(null);
  const reportedId = useRef<string | null>(null);
  const onReadRef = useRef(onRead);
  onReadRef.current = onRead;
  const [dismissedCount, setDismissedCount] = useState(0);
  const newCount = atEnd
    ? 0
    : newMessagesAfter(readable, seenId, (message) =>
        messageHasVisibleBlocks(message.blocks, showToolActivity),
      );
  const showNewCount = newCount > dismissedCount;
  const workingBotName = workingBots.length === 1 ? workingBots[0]?.name : undefined;
  const workingLabel =
    activity?.kind === "starting"
      ? t`Starting`
      : activity?.kind === "phase"
        ? activity.phase.kind === "model_wait"
          ? t`Thinking`
          : t`Starting`
        : activity?.kind === "thinking"
          ? t`Thinking`
          : activity?.kind === "writing"
            ? t`Writing`
            : activity?.kind === "tool"
              ? (toolActionLabel(activity.action) ??
                (toolPhrase(activity.label, "activity") || activity.label))
              : workingBotName
                ? t`${workingBotName} is working`
                : t`Bots are working`;
  const waitingLabel = (service: string) => t`Still waiting on ${service}`;
  // After this agent messages another and nothing has come back, the wait is on that agent.
  const delegate = delegateWaitTarget(messages);
  const [quoteDraft, setQuoteDraft] = useState<{
    message: ThreadMessage;
    text: string;
    range: Range;
  } | null>(null);
  const selectingWithMouse = useRef(false);

  const evaluateSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      setQuoteDraft(null);
      return;
    }
    const range = selection.getRangeAt(0);
    const contentOf = (node: Node) =>
      (node instanceof Element ? node : node.parentElement)?.closest<HTMLElement>(
        "[data-quote-message-id]",
      ) ?? null;
    const startContent = contentOf(range.startContainer);
    const endContent = contentOf(range.endContainer);
    // selection.toString() serializes the whole range (a Ctrl+A transcript is
    // unbounded), so it only runs once both endpoints sit in one message.
    const draft = quoteDraftForSelection(
      {
        startContent,
        endContent,
        text: startContent && startContent === endContent ? selection.toString() : "",
      },
      messageById,
    );
    setQuoteDraft((prev) => {
      if (!draft) return null;
      // Repeat firings for an unchanged selection reuse the draft so the
      // transcript isn't re-rendered by every unrelated selection event. A
      // moved selection (e.g. keyboard-selecting a second occurrence of the
      // same text) must carry its new Range — the pill anchors to it.
      if (
        prev &&
        prev.message === draft.message &&
        prev.text === draft.text &&
        prev.range.compareBoundaryPoints(Range.START_TO_START, range) === 0 &&
        prev.range.compareBoundaryPoints(Range.END_TO_END, range) === 0
      ) {
        return prev;
      }
      return { ...draft, range };
    });
  }, [messageById]);

  // Keyboard and assistive-tech selections never reach a mouseup, so the pill
  // lifecycle listens on selectionchange; the mouse flag keeps it hidden while
  // a drag is still in flight.
  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      selectingWithMouse.current = true;
      if ((event.target as Element | null)?.closest?.("[data-quote-selection]")) return;
      setQuoteDraft(null);
    };
    const onMouseUp = () => {
      selectingWithMouse.current = false;
      evaluateSelection();
    };
    const onSelectionChange = () => {
      if (!selectingWithMouse.current) evaluateSelection();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setQuoteDraft(null);
    };
    // A drag that ends outside the window never fires document mouseup; reset
    // the flag on blur so keyboard selections keep working afterwards.
    const onWindowBlur = () => {
      selectingWithMouse.current = false;
    };
    document.addEventListener("mousedown", onMouseDown, true);
    document.addEventListener("mouseup", onMouseUp, true);
    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("keydown", onKey);
    window.addEventListener("blur", onWindowBlur);
    return () => {
      document.removeEventListener("mousedown", onMouseDown, true);
      document.removeEventListener("mouseup", onMouseUp, true);
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", onWindowBlur);
    };
  }, [evaluateSelection]);
  const snapToEnd = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    following.current = true;
    autoScrolling.current = false;
    setAtEnd(true);
    element.scrollTo({ top: element.scrollHeight, behavior: "auto" });
  }, [scrollRef]);

  // Keep the newest message in view while following when the layout changes under it: a phone
  // rotating or a window resizing rewraps every bubble, and cards (asks, connect steps) grow
  // after they mount. Message changes are handled by the layout effect below.
  useEffect(() => {
    const element = scrollRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (performance.now() < dividerPinUntil.current) {
        // Rows measure themselves after the first paint and the thread shrinks; keep the divider at the top.
        const row = element.querySelector("[data-unread-divider]");
        const drift = row
          ? row.getBoundingClientRect().top - element.getBoundingClientRect().top - 24
          : 0;
        if (Math.abs(drift) > 1) element.scrollTop += drift;
        return;
      }
      if (!following.current || jumpScrolling.current) return;
      if (element.scrollHeight - element.scrollTop - element.clientHeight > 1) {
        element.scrollTop = element.scrollHeight;
      }
    });
    observer.observe(element);
    for (const child of element.children) observer.observe(child);
    return () => observer.disconnect();
  }, [scrollRef, messages]);

  const jumpToLatest = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    following.current = true;
    autoScrolling.current = !reducedMotion;
    setAtEnd(true);
    element.scrollTo({
      top: element.scrollHeight,
      behavior: reducedMotion ? "auto" : "smooth",
    });
    window.clearTimeout(autoScrollTimer.current);
    // Fallback only: onScroll clears autoScrolling once near-end is reached.
    autoScrollTimer.current = window.setTimeout(
      () => {
        autoScrolling.current = false;
      },
      reducedMotion ? 0 : 2_000,
    );
  }, [scrollRef]);

  const scrolledJump = useRef<number | null>(null);
  const jumpScrolling = useRef(false);
  const jumpScrollTimer = useRef<number | undefined>(undefined);
  const endJumpScroll = useCallback(() => {
    jumpScrolling.current = false;
    window.clearTimeout(jumpScrollTimer.current);
    scrollRef.current?.removeEventListener("scrollend", endJumpScroll);
  }, [scrollRef]);
  // A jump scroll must win over follow-the-tail: unfollow inside the commit
  // that mounts the row so a live commit cannot cancel the animation, keep
  // retrying while the pinned window is still rendering, and suppress the
  // near-end follow re-arm only for the jump's own scroll events — scrollend
  // (or user input interrupting it, which also fires scrollend) ends the
  // suppression, with the timeout as fallback when no scroll happens.
  useLayoutEffect(() => {
    if (!scrollRequest || scrolledJump.current === scrollRequest.nonce) return;
    const element = scrollRef.current;
    const row = element?.querySelector(
      `[data-message-id="${CSS.escape(scrollRequest.messageId)}"]`,
    );
    if (!element || !row) return;
    scrolledJump.current = scrollRequest.nonce;
    following.current = false;
    autoScrolling.current = false;
    jumpScrolling.current = true;
    element.addEventListener("scrollend", endJumpScroll, { once: true });
    window.clearTimeout(jumpScrollTimer.current);
    jumpScrollTimer.current = window.setTimeout(endJumpScroll, 2_000);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    row.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
    row.animate(
      reducedMotion
        ? [{ backgroundColor: "var(--muted)" }, { backgroundColor: "var(--muted)" }]
        : [
            { backgroundColor: "transparent" },
            { backgroundColor: "var(--muted)" },
            { backgroundColor: "transparent" },
          ],
      { duration: 1200 },
    );
    onScrollRequestHandled();
  }, [messages, scrollRequest, scrollRef, endJumpScroll, onScrollRequestHandled]);

  // A message sent from this composer brings the transcript to the end even after the reader
  // scrolled up (or clicked a card, which stops following), so the reply that follows is in view.
  // A user message that arrives from elsewhere (another tab, a steer) leaves the reader in place.
  // Mirrors atEnd for the layout effect below, which must not re-run on every scroll.
  const atEndRef = useRef(true);
  atEndRef.current = atEnd;
  const lastMessageId = useRef<string | null>(null);
  useLayoutEffect(() => {
    const last = messages.at(-1);
    const previousLastId = lastMessageId.current;
    let sentNow = false;
    if (last?.id !== previousLastId) {
      sentNow = sentHere.current && transcriptUserJustSent(previousLastId, last);
      if (sentNow) following.current = true;
      sentHere.current = false;
    }
    lastMessageId.current = last?.id ?? null;
    const snap = transcriptShouldSnap({
      following: following.current,
      atEnd: atEndRef.current,
      previousLastId: previousLastId ?? undefined,
      // Only a message sent from this composer counts as the user's own new message.
      last: sentNow ? last : undefined,
      jumping: jumpScrolling.current,
    });
    if (snap) {
      snapToEnd();
      return;
    }
    // Content grew below a reader who scrolled up: offer the Jump to latest button.
    const element = scrollRef.current;
    if (element) setAtEnd(transcriptIsNearEnd(element));
  }, [messages, running, snapToEnd, scrollRef, sentHere]);

  useLayoutEffect(() => {
    const button = jumpButtonRef.current;
    if (atEnd && button && document.activeElement === button) {
      button.blur();
    }
  }, [atEnd]);

  // The newest message the reader has in view: all of them at the bottom, else the last row on screen.
  const measureView = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    if (transcriptIsNearEnd(element)) {
      setViewId(latestIdRef.current);
      return;
    }
    const bottom = element.getBoundingClientRect().bottom - 16;
    let id: string | null = null;
    for (const row of element.querySelectorAll<HTMLElement>("[data-stored-message]")) {
      if (row.getBoundingClientRect().top >= bottom) break;
      id = row.dataset.messageId ?? id;
    }
    setViewId(id);
  }, [scrollRef]);
  useLayoutEffect(() => {
    measureView();
  }, [messages, atEnd, measureView]);

  // Opening on unread messages scrolls to the divider when the usual snap to the end left it
  // above the viewport; otherwise the thread opens where it always did.
  const [dividerSettled, setDividerSettled] = useState(false);
  const waitingForDivider = showDividerId != null && !dividerSettled;
  useLayoutEffect(() => {
    if (!showDividerId || dividerSettled) return;
    // The shell scrolls a freshly loaded thread to its end in its own layout effect, which runs
    // after this one, so wait for the next frame.
    const frame = window.requestAnimationFrame(() => {
      const element = scrollRef.current;
      const row = element?.querySelector("[data-unread-divider]");
      const offset =
        element && row ? row.getBoundingClientRect().top - element.getBoundingClientRect().top : 0;
      if (element && offset < 0 && anchorToUnread) {
        following.current = false;
        autoScrolling.current = false;
        element.scrollTop += offset - 24;
        dividerPinUntil.current = performance.now() + 1500;
      }
      // A question waiting for an answer matters more than where the unread messages begin.
      const ask = answerableAskMessageId
        ? element?.querySelector<HTMLElement>(
            `[data-stored-message][data-message-id="${CSS.escape(answerableAskMessageId)}"]`,
          )
        : null;
      if (element && ask) {
        const view = element.getBoundingClientRect();
        const box = ask.getBoundingClientRect();
        if (box.bottom > view.bottom || box.top < view.top) {
          following.current = false;
          autoScrolling.current = false;
          element.scrollTop += box.top - view.top - 24;
          dividerPinUntil.current = 0;
        }
      }
      if (element) {
        setAtEnd(transcriptIsNearEnd(element));
        measureView();
      }
      setDividerSettled(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    showDividerId,
    dividerSettled,
    scrollRef,
    measureView,
    answerableAskMessageId,
    anchorToUnread,
  ]);

  useEffect(() => {
    if (atEnd) setDismissedCount(0);
  }, [atEnd]);

  useEffect(() => {
    if (attended && !waitingForDivider) setSeenId((seen) => laterMessageId(readable, seen, viewId));
  }, [attended, waitingForDivider, viewId, readable]);

  // Report what the reader has seen, only while attending and after the view settles.
  useEffect(() => {
    if (!attended || waitingForDivider || !viewId || viewId === reportedId.current) return;
    if (laterMessageId(readable, reportedId.current, viewId) !== viewId) return;
    const timer = window.setTimeout(() => {
      const previous = reportedId.current;
      reportedId.current = viewId;
      Promise.resolve(onReadRef.current?.(viewId, atEnd)).catch(() => {
        reportedId.current = previous;
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [attended, waitingForDivider, viewId, atEnd, readable]);

  const loadOlder = useCallback(() => {
    const wasFollowing = following.current;
    // Prepend must not race the messages-driven snap-to-end follow path.
    following.current = false;
    autoScrolling.current = false;
    const pending = onLoadOlder();
    if (!pending) return;
    return Promise.resolve(pending).catch((error) => {
      const element = scrollRef.current;
      if (wasFollowing && element && transcriptIsNearEnd(element)) {
        following.current = true;
        setAtEnd(true);
      }
      throw error;
    });
  }, [onLoadOlder, scrollRef]);

  useEffect(
    () => () => {
      window.clearTimeout(autoScrollTimer.current);
      window.clearTimeout(jumpScrollTimer.current);
    },
    [],
  );

  return (
    <div className="@container relative flex min-h-0 flex-1 flex-col">
      {/* Announces the working phase once per change; the elapsed timer stays out of it. */}
      <div role="status" aria-live="polite" className="sr-only">
        {running ? workingLabel : ""}
      </div>
      <div
        ref={scrollRef}
        data-testid="transcript"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        onPointerDown={(event) => {
          dividerPinUntil.current = 0;
          lastScrollTop.current = event.currentTarget.scrollTop;
          autoScrolling.current = false;
          following.current = false;
        }}
        onTouchStart={(event) => {
          dividerPinUntil.current = 0;
          lastScrollTop.current = event.currentTarget.scrollTop;
          autoScrolling.current = false;
          following.current = false;
        }}
        onWheel={(event) => {
          dividerPinUntil.current = 0;
          if (event.deltaY < 0) {
            lastScrollTop.current = event.currentTarget.scrollTop;
            autoScrolling.current = false;
            following.current = false;
          }
        }}
        onScroll={(event) => {
          const scrolledDown = transcriptMovedDown(
            lastScrollTop.current,
            event.currentTarget.scrollTop,
          );
          lastScrollTop.current = event.currentTarget.scrollTop;
          const nearEnd = transcriptIsNearEnd(event.currentTarget);
          setAtEnd(nearEnd);
          measureView();
          // A jump scroll owns the viewport until its animation settles; its
          // own near-end crossings must not re-arm tail-following.
          if (jumpScrolling.current) return;
          if (nearEnd) {
            if (scrolledDown) following.current = true;
            if (autoScrolling.current) {
              autoScrolling.current = false;
              window.clearTimeout(autoScrollTimer.current);
            }
          } else if (!autoScrolling.current) {
            following.current = false;
          }
        }}
        data-transcript=""
        className="@container rk-scroll flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 pt-5 pb-[calc(1.25rem+var(--toast-reserve,0px))] md:px-[max(1.75rem,calc((100%-900px)/2))] md:pt-6 md:pb-[calc(1.5rem+var(--toast-reserve,0px))]"
      >
        {olderCursor != null ? (
          <button
            type="button"
            disabled={loadingOlder}
            onClick={() => void loadOlder()}
            className="self-center rounded-lg px-3 py-1.5 text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground/75 disabled:opacity-50"
          >
            {loadingOlder ? t`Loading…` : t`Load earlier messages`}
          </button>
        ) : null}
        {items.map((item) => {
          if (item.kind === "financeRun") {
            const first = item.messages[0];
            if (!first) return null;
            const speaker = memberName?.(first.botId);
            return (
              <div key={first.id} className="relative py-0.5">
                {separatorIds.has(first.id) ? (
                  <TimeSeparator createdAt={first.createdAt} locale={i18n.locale || "en"} />
                ) : null}
                {item.messages.some((m) => m.id === showDividerId) ? <UnreadDivider /> : null}
                {speaker ? (
                  <SpeakerHeader
                    botId={first.botId}
                    name={speaker}
                    color={first.botId ? peerBot?.(first.botId)?.color : undefined}
                  />
                ) : null}
                <FinanceCardGroup
                  items={item.messages.flatMap((m) =>
                    m.blocks.flatMap((block, i) =>
                      block.kind === "finance"
                        ? [{ id: `${m.id}:${i}`, messageId: m.id, block }]
                        : [],
                    ),
                  )}
                  revealMessageId={scrollRequest?.messageId}
                  onAsk={(messageId) => {
                    const message = item.messages.find((m) => m.id === messageId);
                    if (message) onReply(message);
                  }}
                />
              </div>
            );
          }
          if (item.kind === "voiceChat") {
            return (
              <div key={item.key}>
                {item.messages[0] && separatorIds.has(item.messages[0].id) ? (
                  <TimeSeparator
                    createdAt={item.messages[0].createdAt}
                    locale={i18n.locale || "en"}
                  />
                ) : null}
                {item.messages.some((m) => m.id === showDividerId) ? <UnreadDivider /> : null}
                <VoiceChatCard group={item} revealMessageId={scrollRequest?.messageId} />
              </div>
            );
          }
          const message = item.message;
          if (!messageHasVisibleBlocks(message.blocks, showToolActivity)) return null;
          const peerReceipt = isPeerReceiptBlocks(message.blocks);
          const messageReactions = reactionView.reactions.get(message.id);
          // Email cards run the full width of the transcript, like the "New" divider.
          const fullWidth = message.blocks.some((block) => block.kind === "emails");
          // A mail approval card leaves less than the hover rail's width beside it, so its rail sits below too.
          const mailCard = message.blocks.some((block) => block.kind === "ask" && block.mail);
          return (
            <Fragment key={message.id}>
              {separatorIds.has(message.id) ? (
                <TimeSeparator createdAt={message.createdAt} locale={i18n.locale || "en"} />
              ) : null}
              {showDividerId === message.id ? <UnreadDivider /> : null}
              {message.routineName ? (
                <p
                  className="mb-1 truncate text-xs text-muted-foreground"
                  data-testid="routine-label"
                >
                  {t`From routine: ${message.routineName}`}
                </p>
              ) : null}
              <div
                data-message-id={message.id}
                data-stored-message={isStoredMessage(message) ? "" : undefined}
                className={
                  peerReceipt
                    ? "relative py-0.5"
                    : // A narrow transcript (the Inbox agent panel) has no gutter beside the bubbles, so the
                      // hover time above and the actions below need room of their own.
                      "group/message relative hover:z-20 @max-md:[@media(hover:hover)]:pt-4 @max-sm:[@media(hover:hover)]:pb-5"
                }
              >
                <div
                  className={
                    peerReceipt
                      ? undefined
                      : `relative flex ${message.role === "user" ? "justify-end" : "justify-start"}`
                  }
                >
                  <div
                    data-testid={peerReceipt ? undefined : "message-bubble-frame"}
                    className={
                      peerReceipt
                        ? undefined
                        : `relative w-fit min-w-0 ${
                            // A narrow transcript (the Inbox agent panel) cannot spare 8rem beside each bubble.
                            message.role === "user"
                              ? "max-w-[max(min(84%,calc(100%_-_8rem)),min(84%,20rem))] @max-sm:max-w-[84%] [@media(hover:none)]:max-w-[84%]"
                              : fullWidth
                                ? "w-full max-w-full"
                                : mailCard
                                  ? "max-w-[calc(100%_-_5rem)] @max-sm:max-w-full [@media(hover:none)]:max-w-full"
                                  : "max-w-[max(min(88%,calc(100%_-_8rem)),min(88%,20rem))] @max-sm:max-w-[92%] [@media(hover:none)]:max-w-[88%]"
                          }`
                    }
                  >
                    <MessageView
                      artifactTarget={artifactTarget}
                      message={message}
                      canAnswer={message.id === answerableAskMessageId}
                      onOpenBot={onOpenBot}
                      onOpenPeerMessages={onOpenPeerMessages}
                      onAnswer={onAnswer}
                      speakerName={
                        peerReceipt
                          ? undefined
                          : message.role === "bot"
                            ? memberName?.(message.botId)
                            : undefined
                      }
                      memberName={memberName}
                      peerBot={peerBot}
                      replyParent={
                        message.replyToMessageId
                          ? messageById.get(message.replyToMessageId)
                          : undefined
                      }
                      onJumpToMessage={onJumpToMessage}
                      onRefresh={onRefresh}
                      onBotChanged={onBotChanged}
                      onAddRoutine={onAddRoutine}
                      voiceReady={voiceReady}
                      speaking={speakingMessageId === message.id}
                      onSpeak={() => onSpeak(message)}
                      onOpenComputer={onOpenComputer}
                      onReply={onReply}
                      showToolActivity={showToolActivity}
                    />
                    {peerReceipt ? null : (
                      <MessageHoverActions
                        message={message}
                        hasReactions={Boolean(messageReactions)}
                        side={message.role === "user" ? "start" : "end"}
                        below={fullWidth || mailCard}
                        onReply={onReply}
                        onReact={onReact}
                        remember={remember}
                        tabbable={message.id === tabbableMoreId}
                        onMoreFocus={() => setMoreId(message.id)}
                      />
                    )}
                    {peerReceipt ||
                    message.id.startsWith("progress:") ||
                    (message.role === "bot" && memberName?.(message.botId)) ? null : (
                      <time
                        dateTime={message.createdAt}
                        data-testid="message-hover-time"
                        className={cn(
                          "pointer-events-none absolute z-10 whitespace-nowrap text-xs tabular-nums text-muted-foreground opacity-0 transition-opacity group-hover/message:opacity-100 group-focus-within/message:opacity-100 group-has-[[aria-expanded=true]]/message:opacity-100 [@media(hover:none)]:transition-none",
                          // Bot speaker header renders its own time in the header row; here it sits in the
                          // gutter beside the bubble, above the hover actions, clear of neighbouring messages.
                          message.role === "user"
                            ? "end-full bottom-8 pe-3"
                            : "start-full bottom-8 ps-3",
                          // A narrow chat has no gutter beside a wide bubble: sit under it instead.
                          "@max-sm:[@media(hover:hover)]:top-full @max-sm:[@media(hover:hover)]:bottom-auto @max-sm:[@media(hover:hover)]:pt-1",
                          message.role === "user"
                            ? "@max-sm:[@media(hover:hover)]:end-0 @max-sm:[@media(hover:hover)]:pe-0"
                            : "@max-sm:[@media(hover:hover)]:start-0 @max-sm:[@media(hover:hover)]:ps-0",
                          fullWidth &&
                            "[@media(hover:hover)]:start-0 [@media(hover:hover)]:top-full [@media(hover:hover)]:bottom-auto [@media(hover:hover)]:ps-0 [@media(hover:hover)]:pt-1",
                          // Touch has no hover margin: drop the revealed time in-flow under the bubble.
                          "[@media(hover:none)]:hidden [@media(hover:none)]:group-hover/message:static [@media(hover:none)]:group-focus-within/message:static [@media(hover:none)]:group-has-[[aria-expanded=true]]/message:static",
                          "[@media(hover:none)]:group-hover/message:block [@media(hover:none)]:group-focus-within/message:block [@media(hover:none)]:group-has-[[aria-expanded=true]]/message:block",
                          "[@media(hover:none)]:group-hover/message:mt-1 [@media(hover:none)]:group-focus-within/message:mt-1 [@media(hover:none)]:group-has-[[aria-expanded=true]]/message:mt-1",
                          "[@media(hover:none)]:group-hover/message:h-auto [@media(hover:none)]:group-focus-within/message:h-auto [@media(hover:none)]:group-has-[[aria-expanded=true]]/message:h-auto",
                          message.role === "user"
                            ? "[@media(hover:none)]:group-hover/message:text-end [@media(hover:none)]:group-focus-within/message:text-end [@media(hover:none)]:group-has-[[aria-expanded=true]]/message:text-end"
                            : "[@media(hover:none)]:group-hover/message:text-start [@media(hover:none)]:group-focus-within/message:text-start [@media(hover:none)]:group-has-[[aria-expanded=true]]/message:text-start",
                        )}
                      >
                        {formatMessageTime(message.createdAt, i18n.locale || "en")}
                      </time>
                    )}
                  </div>
                </div>
                {!peerReceipt && messageReactions ? (
                  <div
                    data-testid="message-reactions"
                    className={cn(
                      "mt-1 flex flex-wrap gap-1",
                      message.role === "user" && "justify-end",
                    )}
                  >
                    {[...messageReactions].map(([emoji, count]) => (
                      <span
                        key={emoji}
                        className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs"
                      >
                        {emoji}
                        {count > 1 ? ` ${count}` : ""}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </Fragment>
          );
        })}
        {running &&
        !messages.some(
          (message) =>
            message.id.startsWith("progress:") &&
            message.blocks.some(
              (block) =>
                block.kind === "progress" && !isToolActivityBlock(block) && Boolean(block.text),
            ),
        ) ? (
          <ActiveBotGlyph
            bots={workingBots}
            label={workingLabel}
            startedAt={workingStartedAt}
            onStop={onStopRun}
            onRetry={onRetryRun}
            detail={
              activity?.kind === "tool"
                ? activity.detail
                : activity?.kind === "phase"
                  ? maskCurrencyWhenHidden(runPhaseLine(activity.phase) ?? "")
                  : delegate
                    ? t`Waiting on ${delegate}`
                    : undefined
            }
            detailSince={activity?.kind === "phase" ? Date.parse(activity.phase.at) : undefined}
            waitingLabel={
              activity?.kind === "tool" && activity.service
                ? waitingLabel(activity.service)
                : activity?.kind === "phase"
                  ? (runPhaseWaitingLabel(activity.phase) ?? undefined)
                  : undefined
            }
          />
        ) : null}
        {!running && failedNote != null ? (
          <p data-testid="transcript-failed-note" className="py-2 text-xs text-destructive">
            {failedScheduled ? (
              failedNote ? (
                <Trans>Scheduled run failed: {failedNote}</Trans>
              ) : (
                <Trans>Scheduled run failed.</Trans>
              )
            ) : failedNote ? (
              <Trans>Last run failed: {failedNote}</Trans>
            ) : (
              <Trans>Last run failed.</Trans>
            )}
          </p>
        ) : null}
      </div>
      {quoteDraft ? (
        <QuoteSelectionButton
          range={quoteDraft.range}
          onQuote={() => {
            onQuote(quoteDraft.message, quoteDraft.text);
            window.getSelection()?.removeAllRanges();
            setQuoteDraft(null);
          }}
        />
      ) : null}
      <div
        data-toast-avoid=""
        // The pill has its own row between the messages and the composer, so it covers no text.
        // The row collapses to nothing at the end of the chat.
        className={`flex shrink-0 items-center justify-center overflow-hidden transition-[height] duration-200 motion-reduce:transition-none @max-md:justify-end @max-md:pe-3 ${
          atEnd ? "h-0" : "h-11"
        }`}
      >
        <div
          // A labeled, opaque pill: an unlabeled see-through circle read as part of the text under it.
          // In a narrow panel it shrinks to a round button at the right edge, so it covers less text.
          className={`flex h-8 items-center rounded-full border border-border bg-popover text-[13px] font-medium text-foreground shadow-md transition-[opacity,transform,background-color] duration-200 ease-[cubic-bezier(.22,1,.36,1)] hover:bg-accent in-data-bot-accent:border-transparent in-data-bot-accent:bg-bot-accent in-data-bot-accent:text-bot-accent-foreground in-data-bot-accent:ring-2 in-data-bot-accent:ring-background in-data-bot-accent:hover:bg-bot-accent/90 motion-reduce:transition-none ${
            atEnd ? "pointer-events-none translate-y-2 opacity-0" : "translate-y-0 opacity-100"
          }`}
        >
          <button
            ref={jumpButtonRef}
            type="button"
            aria-hidden={atEnd}
            tabIndex={atEnd ? -1 : 0}
            onClick={jumpToLatest}
            className={`flex h-8 items-center justify-center gap-1.5 rounded-full ps-3 ${
              showNewCount ? "pe-1.5" : "pe-3"
            } ${showNewCount ? "" : "@max-md:w-8 @max-md:px-0"}`}
          >
            <ArrowDown size={15} strokeWidth={1.8} aria-hidden="true" />
            {showNewCount ? (
              <span data-testid="new-messages-count">
                {plural(newCount, { one: "# new message", other: "# new messages" })}
              </span>
            ) : (
              <span className="@max-md:sr-only">
                <Trans>Jump to latest</Trans>
              </span>
            )}
          </button>
          {showNewCount && !atEnd ? (
            <button
              type="button"
              aria-label={t`Dismiss`}
              onClick={() => setDismissedCount(newCount)}
              className="me-1 grid size-6 place-items-center rounded-full hover:bg-current/10"
            >
              <X size={13} strokeWidth={1.8} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
});

/**
 * Floating Quote action anchored to the selection's bounding rect. Measures
 * itself after mount so it can flip below the selection when there is no room
 * above and stay clamped inside the viewport; re-anchors on scroll/resize.
 */
const QuoteSelectionButton = memo(function QuoteSelectionButton({
  range,
  onQuote,
}: {
  range: Range;
  onQuote: () => void;
}) {
  const { t } = useLingui();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [placement, setPlacement] = useState<{
    top: number;
    left: number;
    above: boolean;
  } | null>(null);

  useLayoutEffect(() => {
    const update = () => {
      if (range.collapsed || !document.contains(range.commonAncestorContainer)) {
        setPlacement(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      const width = buttonRef.current?.offsetWidth ?? 0;
      const height = buttonRef.current?.offsetHeight ?? 0;
      const above = rect.top >= height + 8;
      setPlacement({
        top: above ? rect.top - 8 : rect.bottom + 8,
        left: Math.min(
          Math.max(rect.left + rect.width / 2, width / 2 + 8),
          window.innerWidth - width / 2 - 8,
        ),
        above,
      });
    };
    update();
    window.addEventListener("resize", update);
    // Scroll doesn't bubble — listen on the capture phase to catch any scroller.
    window.addEventListener("scroll", update, { capture: true, passive: true });
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [range]);

  return createPortal(
    <button
      ref={buttonRef}
      type="button"
      data-quote-selection
      data-testid="quote-selection"
      onMouseDown={(event) => {
        // Keep the highlight alive until the click commits the quote.
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={onQuote}
      style={placement ? { top: placement.top, left: placement.left } : { visibility: "hidden" }}
      className={cn(
        "fixed z-50 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-[13px] font-medium text-foreground shadow-md hover:bg-muted",
        placement?.above === false ? "translate-y-0" : "-translate-y-full",
      )}
    >
      <TextQuote size={13} strokeWidth={2} />
      {t`Quote`}
    </button>,
    document.body,
  );
});

function MessageHoverActions({
  message,
  side,
  hasReactions = false,
  onReply,
  onReact,
  remember,
  below,
  tabbable = true,
  onMoreFocus,
}: {
  message: ThreadMessage;
  side: "start" | "end";
  below?: boolean;
  hasReactions?: boolean;
  onReply: (message: ThreadMessage) => void;
  onReact: (message: ThreadMessage, reaction: MessageReaction) => Promise<void>;
  remember?: RememberControls;
  tabbable?: boolean;
  onMoreFocus?: () => void;
}) {
  const { t } = useLingui();
  const [moreOpen, setMoreOpen] = useState(false);
  const [reactionsOpen, setReactionsOpen] = useState(false);

  // Streaming progress bubbles keep hover free for selection / stop clicks.
  if (message.id.startsWith("progress:")) return null;

  function copyMessage() {
    const text = maskCurrencyWhenHidden(copyableMessageText(message));
    if (!text || !navigator.clipboard) return;
    void navigator.clipboard.writeText(text).catch(() => undefined);
  }

  const iconButtonClass =
    "grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:transition-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring";
  const canRemember =
    Boolean(remember) && message.role === "bot" && canReactToThreadMessage(message);
  const remembered = remember?.ids.has(message.id) ?? false;
  const RememberIcon = remembered ? BookmarkCheck : BookmarkPlus;

  return (
    <MessageHoverMetadata
      pinned={moreOpen || reactionsOpen}
      side={side}
      below={below}
      hasReactions={hasReactions}
    >
      <div data-testid="message-hover-actions" className="flex items-center gap-0.5">
        {canReactToThreadMessage(message) ? (
          <Popover open={reactionsOpen} onOpenChange={setReactionsOpen}>
            <PopoverTrigger
              aria-label={t`React`}
              tabIndex={-1}
              className={cn(
                iconButtonClass,
                "h-11 w-11 [@media(hover:hover)_and_(pointer:fine)]:h-7 [@media(hover:hover)_and_(pointer:fine)]:w-7 [@media(hover:none)]:hidden",
              )}
            >
              <Smile size={15} strokeWidth={1.7} />
            </PopoverTrigger>
            <PopoverContent
              align={side === "end" ? "start" : "end"}
              className="w-auto flex-row gap-0 rounded-2xl p-1.5"
              aria-label={t`Reactions`}
            >
              {MESSAGE_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  aria-label={emoji}
                  className="grid h-11 w-11 place-items-center rounded-xl text-2xl hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                  onClick={() => {
                    setReactionsOpen(false);
                    void onReact(message, emoji);
                  }}
                >
                  {emoji}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        ) : null}
        <button
          type="button"
          aria-label={t`Reply`}
          tabIndex={-1}
          onClick={() => onReply(message)}
          className={cn(
            iconButtonClass,
            "h-11 w-11 [@media(hover:hover)_and_(pointer:fine)]:h-7 [@media(hover:hover)_and_(pointer:fine)]:w-7 [@media(hover:none)]:hidden",
          )}
        >
          <Reply size={15} strokeWidth={1.7} />
        </button>
        {canRemember ? (
          <button
            type="button"
            aria-label={remembered ? t`Remembered` : t`Remember`}
            title={remembered ? t`Remembered` : t`Remember`}
            tabIndex={-1}
            aria-pressed={remembered}
            disabled={remembered}
            onClick={() => remember?.onRemember(message.id)}
            className={cn(
              iconButtonClass,
              "h-11 w-11 [@media(hover:hover)_and_(pointer:fine)]:h-7 [@media(hover:hover)_and_(pointer:fine)]:w-7 [@media(hover:none)]:hidden",
              remembered && "text-foreground",
            )}
          >
            <RememberIcon size={15} strokeWidth={1.7} />
          </button>
        ) : null}
        <DropdownMenu open={moreOpen} onOpenChange={setMoreOpen}>
          <DropdownMenuTrigger
            aria-label={t`More`}
            data-message-more=""
            tabIndex={tabbable ? 0 : -1}
            onFocus={onMoreFocus}
            onKeyDown={(event) => {
              if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
              const all = [
                ...(event.currentTarget
                  .closest("[data-transcript]")
                  ?.querySelectorAll<HTMLElement>("[data-message-more]") ?? []),
              ];
              const next =
                all[all.indexOf(event.currentTarget) + (event.key === "ArrowUp" ? -1 : 1)];
              if (!next) return;
              // The menu trigger would otherwise open the menu on Up and Down.
              event.preventBaseUIHandler();
              event.preventDefault();
              next.focus();
            }}
            className={cn(
              iconButtonClass,
              // On touch this is the only way in to react, reply and bookmark, so it reads stronger.
              "h-11 w-11 [@media(hover:hover)_and_(pointer:fine)]:h-7 [@media(hover:hover)_and_(pointer:fine)]:w-7 [@media(hover:none)]:text-foreground/75",
            )}
          >
            <MoreHorizontal size={15} strokeWidth={1.7} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align={side === "end" ? "start" : "end"}>
            {canReactToThreadMessage(message) ? (
              // The row's buttons are not Tab stops (one stop per message), so this menu is the keyboard route to every action.
              <div className="grid w-33 grid-cols-3 pb-1">
                {MESSAGE_REACTIONS.map((emoji) => (
                  <DropdownMenuItem
                    key={emoji}
                    aria-label={emoji}
                    className="size-11 justify-center p-0 text-2xl"
                    onClick={() => void onReact(message, emoji)}
                  >
                    {emoji}
                  </DropdownMenuItem>
                ))}
              </div>
            ) : null}
            <DropdownMenuItem
              onClick={() => {
                setMoreOpen(false);
                onReply(message);
              }}
            >
              <Reply size={14} strokeWidth={1.7} />
              <Trans>Reply</Trans>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={copyMessage}>
              <Copy size={14} strokeWidth={1.7} />
              <Trans>Copy</Trans>
            </DropdownMenuItem>
            {canRemember ? (
              <DropdownMenuItem
                disabled={remembered}
                onClick={() => {
                  setMoreOpen(false);
                  remember?.onRemember(message.id);
                }}
              >
                <RememberIcon size={14} strokeWidth={1.7} />
                {remembered ? <Trans>Remembered</Trans> : <Trans>Remember</Trans>}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </MessageHoverMetadata>
  );
}

type TranscriptItem = ReturnType<typeof groupVoiceChats<ThreadMessage>>[number];

type FinanceRun = { kind: "financeRun"; messages: ThreadMessage[] };

const isFinanceOnly = (message: ThreadMessage) =>
  message.role === "bot" &&
  message.blocks.length > 0 &&
  message.blocks.every((block) => block.kind === "finance");

/** Each finance tool call is its own bot message; fold 2+ consecutive ones from the same bot so they tile as one group. A lone one stays a normal message. */
function foldFinanceRuns(
  items: TranscriptItem[],
  hasReactions: (messageId: string) => boolean = () => false,
): (TranscriptItem | FinanceRun)[] {
  const out: (TranscriptItem | FinanceRun)[] = [];
  let run: TranscriptItem[] = [];
  const flush = () => {
    if (run.length >= 2) {
      out.push({
        kind: "financeRun",
        messages: run.flatMap((i) => (i.kind === "message" ? [i.message] : [])),
      });
    } else out.push(...run);
    run = [];
  };
  for (const item of items) {
    if (item.kind === "message" && isFinanceOnly(item.message) && !hasReactions(item.message.id)) {
      const prev = run[0];
      if (prev?.kind === "message" && prev.message.botId !== item.message.botId) flush();
      run.push(item);
    } else {
      flush();
      out.push(item);
    }
  }
  flush();
  return out;
}

/** Group-chat speaker line: bot avatar and name, with optional trailing content. */
function SpeakerHeader({
  botId,
  name,
  color,
  children,
}: {
  botId?: string;
  name: string;
  color?: string;
  children?: ReactNode;
}) {
  const colorDef = resolvePersonaColorDef(botId ?? "bot", color);
  return (
    <div
      className="mb-1.5 flex items-center gap-2 text-[13px] font-semibold tracking-tight"
      dir="auto"
      style={{ color: colorDef.light }}
    >
      <BotAvatar color={color ?? DEFAULT_BOT_COLOR} identity={botId} size={22} />
      <span className="min-w-0 truncate">{name}</span>
      {children}
    </div>
  );
}

const MessageView = memo(function MessageView({
  artifactTarget,
  canAnswer,
  message,
  onAnswer,
  onOpenBot,
  onOpenPeerMessages,
  speakerName,
  memberName,
  peerBot,
  replyParent,
  onJumpToMessage,
  onRefresh,
  onBotChanged,
  onAddRoutine,
  voiceReady,
  speaking,
  onSpeak,
  onOpenComputer,
  onReply,
  showToolActivity,
}: {
  artifactTarget: ArtifactTarget;
  canAnswer: boolean;
  message: ThreadMessage;
  onAnswer: (
    message: ThreadMessage,
    text: string,
    username?: string,
    mail?: MailEdits,
  ) => Promise<void>;
  onOpenBot: (botId: string) => void;
  onOpenPeerMessages: (peer: { peerBotId: string; peerBotName: string }) => void;
  speakerName?: string;
  memberName?: (botId: string | undefined) => string | undefined;
  peerBot: (botId: string) => { name?: string; color: string; status?: string } | undefined;
  replyParent?: ThreadMessage;
  onJumpToMessage?: (messageId: string) => void;
  onRefresh: () => Promise<void>;
  onBotChanged: () => Promise<void>;
  onAddRoutine: (name: string, prompt: string) => void;
  voiceReady: boolean;
  speaking: boolean;
  onSpeak: () => void;
  onOpenComputer: (botId?: string) => void;
  onReply: (message: ThreadMessage) => void;
  showToolActivity: boolean;
}) {
  useHideAmounts();
  const { t } = useLingui();
  const botToolControls = useContext(BotToolControlsContext);
  // A pending mail approval that names no sender: the card lists the accounts so the person can pick.
  const mailAccounts = useMailAccounts(
    canAnswer &&
      message.blocks.some(
        (block) =>
          block.kind === "ask" &&
          block.status !== "answered" &&
          block.mail !== undefined &&
          !block.mail.account &&
          isApprovalAskBlock(block),
      ),
  );
  const isNarration =
    message.role === "bot" &&
    message.blocks.length > 0 &&
    message.blocks.every(
      (block) => block.kind === "text" || block.kind === "progress" || block.kind === "steps",
    );
  const isLive = message.id.startsWith("progress:");
  const quoteMessageId = message.id.includes(":") ? undefined : message.id;
  const visibleNarrationBlocks = renderableMessageBlocks(message.blocks, showToolActivity);

  const replyBotId = message.replyPreview?.botId ?? replyParent?.botId;
  const speakerBot = message.botId ? peerBot?.(message.botId) : undefined;
  const messageContext = (
    <>
      {speakerName ? (
        <SpeakerHeader botId={message.botId} name={speakerName} color={speakerBot?.color}>
          {isLive ? null : (
            <time
              dateTime={message.createdAt}
              data-testid="message-hover-time"
              className="pointer-events-none ms-auto whitespace-nowrap text-xs font-normal tabular-nums text-muted-foreground opacity-0 transition-opacity group-hover/message:opacity-100 group-focus-within/message:opacity-100 group-has-[[aria-expanded=true]]/message:opacity-100 [@media(hover:none)]:transition-none"
            >
              {formatMessageTime(message.createdAt, i18n.locale || "en")}
            </time>
          )}
        </SpeakerHeader>
      ) : null}
      <ReplyLine
        target={artifactTarget}
        message={message}
        fallbackText={replyParent ? previewMessageText(replyParent) : undefined}
        author={
          (message.replyPreview?.role ?? replyParent?.role) === "user"
            ? t`You`
            : ((replyBotId ? peerBot(replyBotId)?.name : undefined) ??
              memberName?.(replyBotId) ??
              t`Bot`)
        }
        onJump={onJumpToMessage}
      />
    </>
  );
  if (isNarration) {
    if (visibleNarrationBlocks.length === 0) return null;
    if (isToolOnlyNarration(message.blocks, showToolActivity)) {
      return (
        <>
          {messageContext}
          <ToolOnlyNarration blocks={visibleNarrationBlocks} live={isLive} />
        </>
      );
    }
    return (
      <>
        {messageContext}
        <div
          className={`flex w-fit max-w-full justify-start [@media(hover:none)]:w-full ${bubbleMeasure(
            visibleNarrationBlocks.map((block) => ("text" in block ? block.text : "")).join("\n"),
          )}`}
        >
          <div
            data-testid="message-bot-bubble"
            className="max-w-full space-y-2.5 rounded-[20px] bg-muted px-[18px] py-3 text-[15.5px] leading-[1.5] text-foreground/90"
            dir="auto"
          >
            {visibleNarrationBlocks.map((block, i) => {
              if (block.kind === "steps") {
                return (
                  <ToolActivityDisclosure
                    key={i}
                    live={isLive}
                    stepCount={toolStepCount(block.steps)}
                    durationMs={block.durationMs}
                  >
                    <ToolSteps
                      steps={block.steps}
                      currentIndex={isLive ? block.steps.length - 1 : undefined}
                      limit={isLive ? LIVE_TOOL_STEP_WINDOW : undefined}
                    />
                  </ToolActivityDisclosure>
                );
              }
              if (block.kind === "text" || block.kind === "progress") {
                return (
                  <div
                    key={i}
                    data-quote-message-id={block.kind === "text" ? quoteMessageId : undefined}
                  >
                    <ThreadMarkdown streaming={block.kind === "progress"}>
                      {block.text}
                    </ThreadMarkdown>
                  </div>
                );
              }
              return null;
            })}
            {!isLive && voiceReady && message.blocks.some((block) => block.kind === "text") ? (
              <button
                type="button"
                aria-label={speaking ? t`Stop speaking` : t`Speak this reply`}
                onClick={onSpeak}
                className="text-[12px] text-muted-foreground hover:text-foreground"
              >
                {speaking ? <Trans>Stop</Trans> : <Trans>Speak</Trans>}
              </button>
            ) : null}
          </div>
        </div>
      </>
    );
  }
  return (
    <>
      {messageContext}
      {message.blocks.map((block, i) => {
        if (block.kind === "steps" && shouldRenderToolCard(block, showToolActivity)) {
          return (
            <StandaloneToolActivity
              key={i}
              live={isLive}
              steps={block.steps}
              stepCount={toolStepCount(block.steps)}
              durationMs={block.durationMs}
            />
          );
        }
        if (isToolActivityBlock(block)) return null;
        if (block.kind === "handoff") {
          const from = memberName?.(block.fromBotId) ?? t`bot`;
          const to = memberName?.(block.toBotId) ?? t`bot`;
          return (
            <div
              key={i}
              className="flex flex-col items-center gap-0.5 py-1 text-center text-[13.5px] text-muted-foreground"
            >
              {/* The handoff note is the bot-to-bot prompt, not something written for the reader. */}
              <span>
                <Trans>
                  {from} handed off to {to}
                </Trans>
              </span>
            </div>
          );
        }
        if (block.kind === "bot_message_sent" || block.kind === "bot_message_received") {
          const sent = block.kind === "bot_message_sent";
          const peer = sent ? block.toBotName : block.fromBotName;
          const peerBotId = sent ? block.toBotId : block.fromBotId;
          const label = sent ? t`Messaged ${peer}` : t`Message from ${peer}`;
          return (
            <CollaborationMarker
              key={i}
              ariaLabel={label}
              color={peerBot(peerBotId)?.color ?? DEFAULT_BOT_COLOR}
              identity={peerBotId}
              label={label}
              onClick={() => onOpenPeerMessages({ peerBotId, peerBotName: peer })}
            />
          );
        }
        if (block.kind === "channel_message") {
          return (
            <div
              key={i}
              className="flex items-center justify-center gap-2 py-1 text-[13.5px] text-muted-foreground"
            >
              <span>
                {messageProviderLabel(block.provider, block.transport)} · {block.fromLabel}:{" "}
                {maskCurrencyWhenHidden(block.text)}
              </span>
            </div>
          );
        }
        if (block.kind === "meta") {
          return (
            <div
              key={i}
              className="flex items-center justify-center gap-2 py-1 text-[13.5px] text-muted-foreground"
            >
              <span className="text-warning">◷</span>
              <span>{maskCurrencyWhenHidden(block.text)}</span>
            </div>
          );
        }
        if (block.kind === "progress") {
          return (
            <div
              key={i}
              className={`flex w-fit max-w-full justify-start [@media(hover:none)]:w-full ${bubbleMeasure(block.text)}`}
            >
              <div
                data-testid="message-bot-bubble"
                className="max-w-full rounded-[20px] bg-muted px-[18px] py-3 text-[15.5px] leading-[1.5] text-foreground/90"
                dir="auto"
              >
                <ThreadMarkdown streaming>{block.text}</ThreadMarkdown>
              </div>
            </div>
          );
        }
        if (block.kind === "subagent") {
          const running = block.status === "running";
          const failed = block.status === "failed";
          return (
            <div
              key={i}
              className="w-[min(420px,90%)] rounded-[18px] border border-border bg-muted px-[18px] py-4"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[15px] font-medium text-foreground" dir="auto">
                  {block.name}
                </span>
                <span
                  className={`rounded-full px-[11px] py-1 text-[13px] ${
                    failed
                      ? "bg-destructive/15 text-destructive"
                      : running
                        ? "bg-warning/15 text-warning"
                        : "bg-success/15 text-success"
                  }`}
                  style={{
                    animation: running ? "rkPulse 1.2s ease-in-out infinite" : undefined,
                  }}
                >
                  {running ? <Trans>subagent</Trans> : block.status}
                </span>
              </div>
              <div className="mt-2 text-[13.5px] text-muted-foreground">{block.task}</div>
              {block.progress || block.result ? (
                <div className="mt-2.5 text-[14.5px] leading-[1.5] text-foreground/75">
                  <ThreadMarkdown streaming={running}>
                    {block.result || block.progress || ""}
                  </ThreadMarkdown>
                </div>
              ) : null}
            </div>
          );
        }
        if (block.kind === "child_bot") {
          const removed = block.status === "deleted" || block.status === "archived";
          return (
            <button
              key={i}
              type="button"
              disabled={removed}
              onClick={() => onOpenBot(block.botId)}
              className="w-[min(340px,90%)] rounded-[18px] border border-border bg-muted px-[18px] py-4 text-start disabled:opacity-60"
            >
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-medium text-foreground" dir="auto">
                  {block.name}
                </span>
                <span
                  className={`rounded-full px-[11px] py-1 text-[13px] ${
                    removed ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success"
                  }`}
                >
                  {block.status === "archived" ? (
                    <Trans>archived</Trans>
                  ) : block.status === "deleted" ? (
                    <Trans>deleted</Trans>
                  ) : (
                    <Trans>bot</Trans>
                  )}
                </span>
              </div>
              <div className="mt-2 text-[14.5px] leading-[1.5] text-foreground/75" dir="auto">
                {removed
                  ? block.status === "archived"
                    ? t`Archived. Chat, memory, and files kept.`
                    : t`Removed with chat, computer, and memory.`
                  : block.title || t`Opened its thread.`}
              </div>
            </button>
          );
        }
        if (block.kind === "choice") {
          const botId = "botId" in artifactTarget ? artifactTarget.botId : message.botId;
          if (!botId) return null;
          return <ChoiceCard key={i} botId={botId} block={block} onBotChanged={onBotChanged} />;
        }
        if (block.kind === "app_connect") {
          const botId = "botId" in artifactTarget ? artifactTarget.botId : message.botId;
          if (!botId) return null;
          return (
            <div key={i} className="flex justify-start py-1">
              <AppConnectCard botId={botId} block={block} />
            </div>
          );
        }
        if (block.kind === "chart") {
          return (
            <div key={i} className="flex justify-start">
              <ChartBlockView name={block.name} spec={block.spec} data={block.data} />
            </div>
          );
        }
        if (block.kind === "mcp_approval") {
          const botId = "botId" in artifactTarget ? artifactTarget.botId : message.botId;
          if (!botId) return null;
          return (
            <div key={i} className="flex justify-start">
              <McpApprovalCard botId={botId} threadId={message.threadId} block={block} />
            </div>
          );
        }
        if (block.kind === "image") {
          // A run of images is drawn once, at its first block.
          if (message.blocks[i - 1]?.kind === "image") return null;
          const images = [];
          for (const next of message.blocks.slice(i)) {
            if (next.kind !== "image") break;
            images.push(next);
          }
          return (
            <div
              key={i}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <ArtifactImageGrid target={artifactTarget} images={images} />
            </div>
          );
        }
        if (block.kind === "file") {
          return (
            <div
              key={i}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <ArtifactFileCard
                target={artifactTarget}
                artifactId={block.artifactId}
                name={block.name}
                mimeType={block.mimeType}
                size={block.size}
              />
            </div>
          );
        }
        if (block.kind === "text" && message.role === "user") {
          return <UserTextBubble key={i} text={block.text} quoteMessageId={quoteMessageId} />;
        }
        if (block.kind === "text") {
          return (
            <div
              key={i}
              className={`flex w-fit max-w-full justify-start [@media(hover:none)]:w-full ${bubbleMeasure(block.text)}`}
            >
              <div
                data-testid="message-bot-bubble"
                className="max-w-full rounded-[20px] bg-muted px-[18px] py-3 text-[15.5px] leading-[1.5] text-foreground/90"
                dir="auto"
              >
                <div data-quote-message-id={quoteMessageId}>
                  <ThreadMarkdown>{block.text}</ThreadMarkdown>
                </div>
                {voiceReady ? (
                  <button
                    type="button"
                    aria-label={speaking ? t`Stop speaking` : t`Speak this reply`}
                    onClick={onSpeak}
                    className="mt-2 text-[12px] text-muted-foreground hover:text-foreground"
                  >
                    {speaking ? <Trans>Stop</Trans> : <Trans>Speak</Trans>}
                  </button>
                ) : null}
              </div>
            </div>
          );
        }
        if (block.kind === "card") {
          return <ResultCard key={i} block={block} />;
        }
        if (block.kind === "ask") {
          // A card after text in the same message sits one message-gap (20 px) below it.
          const gap = i > 0 ? "mt-5" : undefined;
          if (block.mail && isApprovalAskBlock(block)) {
            return (
              <div key={i} className={gap}>
                <MailApprovalCard
                  mail={block.mail}
                  accounts={mailAccounts.accounts}
                  accountsStatus={mailAccounts.status}
                  onRetryAccounts={mailAccounts.retry}
                  status={block.status === "answered" ? "answered" : "pending"}
                  answer={block.answer}
                  canAnswer={canAnswer}
                  botName={botToolControls?.editableBotName(message.botId)}
                  onAnswer={(text, username, mail) => onAnswer(message, text, username, mail)}
                  onOpenComposer={
                    botToolControls
                      ? (failed) =>
                          botToolControls.openComposer({
                            connectionId: failed.connectionId ?? "",
                            account: failed.account ?? "",
                            to: failed.to,
                            cc: failed.cc,
                            bcc: failed.bcc,
                            subject: failed.subject,
                            body: failed.body,
                          })
                      : undefined
                  }
                  onDisableTool={
                    message.botId
                      ? (tool) => botToolControls!.disableTool(message.botId!, tool)
                      : undefined
                  }
                />
              </div>
            );
          }
          return (
            <div key={i} className={gap}>
              <AskCard
                block={block}
                requestedAt={message.createdAt}
                // A held message is answered without a waiting run, so it stays answerable.
                canAnswer={canAnswer || block.share === true}
                onAnswer={(text, username) => onAnswer(message, text, username)}
              />
            </div>
          );
        }
        if (block.kind === "cloud_agent") return <CloudAgentCard key={i} block={block} />;
        if (block.kind === "emails") {
          return (
            <div key={i} className="flex justify-start">
              <EmailCards block={block} />
            </div>
          );
        }
        if (block.kind === "mail_thread") {
          return (
            <div key={i} className="flex justify-start">
              <MailThreadCard block={block} />
            </div>
          );
        }
        if (block.kind === "finance") {
          return (
            <div key={i} className="flex justify-start">
              <FinanceCardGroup
                items={[{ id: `${message.id}:${i}`, messageId: message.id, block }]}
                onAsk={() => onReply(message)}
              />
            </div>
          );
        }
        if (block.kind === "skill_draft") {
          return (
            <div key={i} className="flex justify-start">
              <SkillDraftCard block={block} onRefresh={onRefresh} onAddRoutine={onAddRoutine} />
            </div>
          );
        }
        if (block.kind === "computer") {
          return (
            <div
              key={i}
              data-testid="computer-card"
              className="w-[340px] rounded-[18px] border border-border bg-muted px-[18px] py-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-medium text-foreground">
                  <Trans>Computer</Trans>
                </span>
                <span
                  className={
                    block.state === "Needs you"
                      ? "rounded-full bg-warning/15 px-[11px] py-1 text-[13px] text-warning"
                      : "rounded-full bg-success/15 px-[11px] py-1 text-[13px] text-success"
                  }
                >
                  {/* The stored state is "Needs you"; computer cards are takeovers, not questions. */}
                  {block.state === "Needs you" ? <Trans>Needs takeover</Trans> : block.state}
                </span>
              </div>
              <div className="my-2.5 text-[14.5px] leading-[1.5] text-foreground/75">
                <ThreadMarkdown>{block.text}</ThreadMarkdown>
              </div>
              <Button
                type="button"
                size="sm"
                data-testid="computer-card-open"
                onClick={() => onOpenComputer(message.botId)}
              >
                <Trans>Open</Trans>
              </Button>
            </div>
          );
        }
        return null;
      })}
    </>
  );
});

export { AppNavigateContext };
