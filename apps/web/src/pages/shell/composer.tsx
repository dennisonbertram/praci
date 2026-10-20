import { t } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import type { AgentSkillCatalogEntry, ThreadMessage } from "@rakazo/contracts";
import { ATTACHMENT_ALLOWED_MIME_TYPES } from "@rakazo/contracts";
import type { ComposerMention, SlashActionId } from "@rakazo/core";
import {
  mentionChipKey,
  newClientId,
  plainTextFromMarkdown,
  rankMentionOptions,
  replyAttachment,
  resolveMentionPickerKey,
  SLASH_ACTIONS,
  serializeComposerPrompt,
  truncateSlashDescription,
} from "@rakazo/core";
import { financeCardSummary } from "@rakazo/core/message-quote";
import { Button } from "@rakazo/ui-web";
import { ArrowUp, Box, Mic, Paperclip, Plus, Settings, Square, X } from "lucide-react";
import type { ClipboardEvent, DragEvent, RefObject } from "react";
import { memo, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { fileIcon } from "../../components/data-room/ItemRows";
import type { ArtifactTarget } from "../../lib/artifact-open";
import {
  readChatDraft,
  readChatDraftMentions,
  readChatDraftSkill,
  writeChatDraft,
  writeChatDraftMentions,
  writeChatDraftSkill,
} from "../../lib/chat-draft";
import { stepComposerHistory } from "../../lib/composer-history";
import { maskCurrencyWhenHidden, useHideAmounts } from "../../lib/hide-amounts-preference";
import { isFileDrag, isFilePaste } from "../../lib/pending-attachments";
import type { DataRoomRef } from "../../lib/send-to-agent";
import { slashSkillOptions as pickSlashSkills, slashSkillLabel } from "../../lib/slash-skills";
import { ComposerReplyPreview } from "./chat-context";
import { ComposerError } from "./composer-error";
import { MentionIcon } from "./mention-icon";

export type PendingAttachment = {
  id: string;
  threadKey: string;
  file: File;
  previewUrl?: string;
};

const ATTACHMENT_ACCEPT = [...ATTACHMENT_ALLOWED_MIME_TYPES, ".zip"].join(",");
/** Above one line (~28px); two lines clear this. */
const COMPOSER_SINGLE_LINE_MAX_PX = 36;
/** One-line `gap-x-3.5`, subtracted on each side of the text. */
const COMPOSER_ONE_LINE_GAP_PX = 14;
/** Narrower than the expand check so a draft at the edge cannot flip. */
const COMPOSER_COLLAPSE_SLACK_PX = 16;

export const Composer = memo(function Composer({
  artifactTarget,
  draftKey,
  activeName,
  running,
  disabled,
  pendingAttachments,
  dataRoomItems = [],
  onRemoveDataRoomItem,
  attachmentNotice,
  onDismissAttachmentNotice,
  sendError,
  runError,
  runErrorId,
  onRunErrorPresented,
  onDismissError,
  onOpenModelSettings,
  onNavigate,
  sending,
  fileInputRef,
  onAttachmentPick,
  onRemoveAttachment,
  onSend,
  onStop,
  onVoice,
  replyTarget,
  replyQuote,
  replyTargetName,
  onClearReply,
  mentionTargets,
  onMentionOpen,
  agentSkills,
  onSlashOpen,
  onSlashAction,
  sentHistory = [],
}: {
  activeName?: string;
  running: boolean;
  disabled?: boolean;
  pendingAttachments: PendingAttachment[];
  /** Data room files sent by reference with the next message. */
  dataRoomItems?: DataRoomRef[];
  onRemoveDataRoomItem?: (item: DataRoomRef) => void;
  attachmentNotice: string | null;
  onDismissAttachmentNotice?: () => void;
  sendError: string | null;
  runError: string | null;
  runErrorId: string | null;
  onRunErrorPresented: (runId: string) => void;
  onDismissError: () => void;
  /** Opens the Models settings a model-setup run error points to. */
  onOpenModelSettings?: (provider?: string) => void;
  onNavigate?: (path: string) => void;
  sending: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onAttachmentPick: (files: FileList | null) => boolean;
  onRemoveAttachment: (attachment: PendingAttachment) => void;
  onSend: (text: string, mentions: ComposerMention[], clientNonce: string) => Promise<boolean>;
  onStop: () => Promise<void>;
  onVoice?: () => void;
  artifactTarget: ArtifactTarget;
  /** Which chat this composer writes to, so a half-written message survives switching chats. */
  draftKey?: string;
  replyTarget?: ThreadMessage | null;
  replyQuote?: string | null;
  replyTargetName?: string;
  onClearReply?: () => void;
  mentionTargets?: ComposerMention[];
  onMentionOpen?: () => void;
  agentSkills?: AgentSkillCatalogEntry[];
  onSlashOpen?: () => void;
  onSlashAction?: (action: SlashActionId) => void;
  /** The user's sent messages in this conversation, oldest first. */
  sentHistory?: string[];
}) {
  useHideAmounts();
  const { t } = useLingui();
  const [draft, setDraft] = useState(() => readChatDraft(draftKey));
  useEffect(() => {
    writeChatDraft(draftKey, draft);
  }, [draftKey, draft]);
  const historyIndex = useRef<number | null>(null);
  const historyDraft = useRef("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  // Highlight is tracked by option identity so late-loading targets cannot shift it to another item.
  const [mentionHighlightKey, setMentionHighlightKey] = useState<string | null>(null);
  const [slashQuery, setSlashQuery] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState(() =>
    readChatDraftSkill<AgentSkillCatalogEntry>(draftKey),
  );
  useEffect(() => {
    writeChatDraftSkill(draftKey, selectedSkill);
  }, [draftKey, selectedSkill]);
  const [selectedMentions, setSelectedMentions] = useState<ComposerMention[]>(() =>
    readChatDraftMentions<ComposerMention>(draftKey),
  );
  useEffect(() => {
    writeChatDraftMentions(draftKey, selectedMentions);
  }, [draftKey, selectedMentions]);
  const editRevision = useRef(0);
  const retryNonce = useRef<string | null>(null);
  const replyId = replyTarget?.id ?? null;
  const quote = replyTarget ? (replyQuote ?? null) : null;
  const previousReply = useRef({ id: replyId, quote });
  useEffect(() => {
    if (previousReply.current.id !== replyId || previousReply.current.quote !== quote) {
      editRevision.current += 1;
      retryNonce.current = null;
      previousReply.current = { id: replyId, quote };
    }
  }, [replyId, quote]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [composerExpanded, setComposerExpanded] = useState(false);
  const attachButtonRef = useRef<HTMLButtonElement>(null);
  const composerActionsRef = useRef<HTMLDivElement>(null);
  const composerBarRef = useRef<HTMLDivElement>(null);
  const composerFieldRef = useRef<HTMLDivElement>(null);
  const composerLayoutRef = useRef<ComposerLayout | null>(null);
  const previousExpandedRef = useRef(false);
  const composerAnimationsRef = useRef<Animation[]>([]);
  const [replyAnnouncement, setReplyAnnouncement] = useState("");
  // What the live region currently holds — a send disarming the reply clears
  // "reply" text, while an explicit cancel must keep "Reply cancelled".
  const replyAnnouncementKind = useRef<"reply" | "cancelled" | null>(null);
  const prevReplyTarget = useRef<ThreadMessage | null>(null);
  const runErrorRef = useRef<HTMLDivElement>(null);
  const presentedRunErrorIdRef = useRef<string | null>(null);
  const mentionListboxId = useId();
  const slashListboxId = useId();
  const dragDepth = useRef(0);
  const [draggingFiles, setDraggingFiles] = useState(false);
  const canSend =
    draft.trim().length > 0 ||
    selectedSkill !== null ||
    selectedMentions.length > 0 ||
    pendingAttachments.length > 0 ||
    dataRoomItems.length > 0;

  useEffect(() => {
    if (!runError || !runErrorId) return;
    const currentRunErrorId = runErrorId;
    let frame = 0;
    function recordIfPresented() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const element = runErrorRef.current;
        if (!element || document.visibilityState !== "visible") return;
        const rect = element.getBoundingClientRect();
        const topElement = document.elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        );
        if (topElement && (topElement === element || element.contains(topElement))) {
          if (presentedRunErrorIdRef.current === currentRunErrorId) return;
          presentedRunErrorIdRef.current = currentRunErrorId;
          onRunErrorPresented(currentRunErrorId);
        }
      });
    }
    recordIfPresented();
    const observer = new MutationObserver(recordIfPresented);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("transitionend", recordIfPresented);
    document.addEventListener("visibilitychange", recordIfPresented);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("transitionend", recordIfPresented);
      document.removeEventListener("visibilitychange", recordIfPresented);
    };
  }, [onRunErrorPresented, runError, runErrorId]);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    function syncHeight() {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const bar = composerBarRef.current;
      // A chip can switch the grid in this commit; keep the previous box as the animation start.
      if ((bar?.dataset.expanded === "true") === previousExpandedRef.current) {
        const layout = readComposerLayout(bar, composerFieldRef.current);
        if (layout) composerLayoutRef.current = layout;
      }
      const contentHeight = measureTextareaHeight(textarea);
      textarea.style.height = `${contentHeight}px`;
      if (draft.length === 0) {
        setComposerExpanded(false);
        return;
      }
      if (contentHeight > COMPOSER_SINGLE_LINE_MAX_PX) {
        setComposerExpanded(true);
        return;
      }
      const attach = attachButtonRef.current;
      const actions = composerActionsRef.current;
      if (!attach || !actions) return;
      const besideControls =
        actions.getBoundingClientRect().left -
        attach.getBoundingClientRect().right -
        2 * COMPOSER_ONE_LINE_GAP_PX;
      const heightBeside = measureTextareaHeight(
        textarea,
        besideControls - COMPOSER_COLLAPSE_SLACK_PX,
      );
      textarea.style.height = `${contentHeight}px`;
      if (heightBeside <= COMPOSER_SINGLE_LINE_MAX_PX) setComposerExpanded(false);
    }

    syncHeight();
    let lastWidth = el.getBoundingClientRect().width;
    const observer = new ResizeObserver(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const width = textarea.getBoundingClientRect().width;
      if (width === lastWidth) return;
      lastWidth = width;
      syncHeight();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [draft]);

  function markEdited() {
    editRevision.current += 1;
    retryNonce.current = null;
  }

  function pickAttachments(files: FileList | null) {
    if (!files?.length) return;
    if (onAttachmentPick(files)) markEdited();
  }

  function recallHistory(direction: "older" | "newer"): boolean {
    const next = stepComposerHistory(sentHistory.length, historyIndex.current, direction);
    if (next === undefined) return false;
    if (historyIndex.current === null) historyDraft.current = draft;
    historyIndex.current = next;
    const value =
      next === null ? historyDraft.current : (sentHistory[sentHistory.length - 1 - next] ?? "");
    markEdited();
    setDraft(value);
    requestAnimationFrame(() => textareaRef.current?.setSelectionRange(value.length, value.length));
    return true;
  }

  function updateDraft(value: string) {
    historyIndex.current = null;
    markEdited();
    setDraft(value);
    const mentionMatch = /(?:^|\s)@([\w-]*)$/.exec(value);
    const nextMentionQuery = mentionMatch ? (mentionMatch[1] ?? "") : null;
    if (mentionQuery === null && nextMentionQuery !== null) onMentionOpen?.();
    setMentionQuery(nextMentionQuery);
    // `/` only at the start of the draft so forced skills expand (`Use skill:` / `/Name` prefix).
    const slashMatch = selectedSkill === null ? /^\/([^\n]*)$/.exec(value) : null;
    const nextSlash = slashMatch ? (slashMatch[1] ?? "") : null;
    if (nextSlash !== null && slashQuery === null) onSlashOpen?.();
    setSlashQuery(nextSlash);
  }

  function focusComposer() {
    textareaRef.current?.focus();
  }

  function insertMention(mention: ComposerMention) {
    markEdited();
    setDraft((current) => current.replace(/@([\w-]*)$/, ""));
    setMentionQuery(null);
    setMentionHighlightKey(null);
    setSelectedMentions((current) =>
      current.some((selected) => mentionChipKey(selected) === mentionChipKey(mention))
        ? current
        : [...current, mention],
    );
    focusComposer();
  }

  function insertSkill(skill: AgentSkillCatalogEntry) {
    markEdited();
    setSelectedSkill(skill);
    setDraft("");
    setSlashQuery(null);
  }

  function runSlashAction(action: SlashActionId) {
    markEdited();
    setDraft("");
    setSlashQuery(null);
    onSlashAction?.(action);
  }

  function removeLastChip() {
    markEdited();
    if (selectedMentions.length > 0) {
      setSelectedMentions((current) => current.slice(0, -1));
      return;
    }
    if (selectedSkill) setSelectedSkill(null);
  }

  const mentionOptions = useMemo(() => {
    if (mentionQuery === null || !mentionTargets?.length) return [];
    // Prefix, then word-start, then substring matches, so the cap never hides a better match.
    return rankMentionOptions(mentionTargets, mentionQuery).slice(0, 10);
  }, [mentionQuery, mentionTargets]);
  // A typed query with no match shows "No matches" instead of closing, so `@zz` is not sent unnoticed.
  const mentionNoMatches =
    mentionQuery !== null &&
    mentionQuery !== "" &&
    mentionOptions.length === 0 &&
    Boolean(mentionTargets?.length);

  // Reset to the first option only when the typed query changes.
  useEffect(() => {
    setMentionHighlightKey(null);
  }, [mentionQuery]);

  // Pin the default highlight to the first shown option so a later insert cannot take it over.
  useEffect(() => {
    if (mentionHighlightKey === null && mentionOptions[0]) {
      setMentionHighlightKey(mentionChipKey(mentionOptions[0]));
    }
  }, [mentionHighlightKey, mentionOptions]);

  // A highlighted option that left the list falls back to the first one.
  const activeMentionIndex = Math.max(
    0,
    mentionOptions.findIndex((mention) => mentionChipKey(mention) === mentionHighlightKey),
  );
  const mentionPickerOpen = mentionOptions.length > 0;
  const activeMentionOptionId = mentionPickerOpen
    ? `${mentionListboxId}-option-${activeMentionIndex}`
    : undefined;

  const slashSkillOptions = useMemo(
    () => (slashQuery === null ? [] : pickSlashSkills(agentSkills ?? [], slashQuery)),
    [agentSkills, slashQuery],
  );

  const slashActionOptions = useMemo(() => {
    if (slashQuery === null) return [];
    const query = slashQuery.trim().toLowerCase();
    return SLASH_ACTIONS.filter((action) => !query || action.label.toLowerCase().includes(query));
  }, [slashQuery]);

  const showSlashPicker =
    slashQuery !== null &&
    mentionQuery === null &&
    (slashSkillOptions.length > 0 || slashActionOptions.length > 0);
  const slashOptionCount = slashSkillOptions.length + slashActionOptions.length;
  const [slashHighlight, setSlashHighlight] = useState(0);
  // Each new query starts at the first option.
  useEffect(() => {
    setSlashHighlight(0);
  }, [slashQuery]);
  const activeSlashIndex = Math.min(slashHighlight, Math.max(0, slashOptionCount - 1));

  function pickSlashOption(index: number) {
    const skill = slashSkillOptions[index];
    if (skill) return insertSkill(skill);
    const action = slashActionOptions[index - slashSkillOptions.length];
    if (action) runSlashAction(action.id);
  }

  async function send() {
    // Same as Enter: while "No matches" shows, Escape first, then send as typed.
    if (!canSend || sending || disabled || mentionNoMatches) return;
    const revision = editRevision.current;
    const clientNonce = retryNonce.current ?? newClientId();
    retryNonce.current = null;
    const text = serializeComposerPrompt(draft, selectedSkill, selectedMentions);
    historyIndex.current = null;
    setDraft("");
    setMentionQuery(null);
    setMentionHighlightKey(null);
    setSlashQuery(null);
    setSelectedSkill(null);
    const mentions = selectedMentions;
    setSelectedMentions([]);
    try {
      if ((await onSend(text, mentions, clientNonce)) !== false) return;
    } catch {
      // A rejected callback leaves acceptance unknown; do not restore a possible send.
      return;
    }
    // Restore only an untouched draft, retaining its nonce for an unchanged retry.
    if (editRevision.current !== revision) return;
    retryNonce.current = clientNonce;
    setDraft(draft);
    setSelectedSkill(selectedSkill);
    setSelectedMentions(mentions);
  }

  function handleDragEnter(event: DragEvent<HTMLFieldSetElement>) {
    const dataTransfer = event.dataTransfer;
    if (!isFileDrag(dataTransfer)) return;
    event.preventDefault();
    if (disabled) {
      dragDepth.current = 0;
      setDraggingFiles(false);
      return;
    }
    dragDepth.current += 1;
    setDraggingFiles(true);
  }

  function handleDragOver(event: DragEvent<HTMLFieldSetElement>) {
    const dataTransfer = event.dataTransfer;
    if (!isFileDrag(dataTransfer)) return;
    event.preventDefault();
    dataTransfer.dropEffect = disabled ? "none" : "copy";
    if (disabled) {
      dragDepth.current = 0;
      setDraggingFiles(false);
      return;
    }
    setDraggingFiles(true);
  }

  function handleDragLeave(event: DragEvent<HTMLFieldSetElement>) {
    if (!isFileDrag(event.dataTransfer)) return;
    if (disabled) {
      dragDepth.current = 0;
      setDraggingFiles(false);
      return;
    }
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDraggingFiles(false);
  }

  function handleDrop(event: DragEvent<HTMLFieldSetElement>) {
    const dataTransfer = event.dataTransfer;
    if (!isFileDrag(dataTransfer)) return;
    event.preventDefault();
    dragDepth.current = 0;
    setDraggingFiles(false);
    if (!disabled) pickAttachments(dataTransfer.files);
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const clipboardData = event.clipboardData;
    // Only intercept real FileList pastes; leave text-only / empty-files native.
    if (disabled || !clipboardData || !isFilePaste(clipboardData)) return;
    event.preventDefault();
    pickAttachments(clipboardData.files);
    const text = clipboardData.getData("text/plain");
    if (!text) return;
    const textarea = event.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    updateDraft(`${draft.slice(0, start)}${text}${draft.slice(end)}`);
    const caret = start + text.length;
    window.requestAnimationFrame(() => {
      textareaRef.current?.setSelectionRange(caret, caret);
    });
  }

  const showComposerPlaceholder =
    draft.length === 0 && selectedSkill === null && selectedMentions.length === 0;
  const expanded = composerExpanded || selectedSkill !== null || selectedMentions.length > 0;

  useLayoutEffect(() => {
    if (previousExpandedRef.current === expanded) return;
    previousExpandedRef.current = expanded;
    const bar = composerBarRef.current;
    const field = composerFieldRef.current;
    const textarea = textareaRef.current;
    const start = composerLayoutRef.current;
    if (!bar || !field || !textarea) return;
    textarea.style.height = `${measureTextareaHeight(textarea)}px`;
    const resting = readComposerLayout(bar, field);
    // A send or a cleared draft snaps back; nothing is left to follow.
    if (
      !start ||
      textarea.value === "" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      if (resting) composerLayoutRef.current = resting;
      return;
    }
    if (!resting) return;
    composerLayoutRef.current = resting;
    // Grow from the fixed bottom edge so the controls stay put.
    const timing = { duration: 120, easing: "cubic-bezier(0.2, 0, 0, 1)" };
    composerAnimationsRef.current = [
      bar.animate(
        [
          { height: `${start.barHeight}px`, overflow: "hidden" },
          { height: `${resting.barHeight}px`, overflow: "hidden" },
        ],
        timing,
      ),
      field.animate(
        [
          {
            transform: `translate(${start.fieldX - resting.fieldX}px, ${start.fieldY - resting.fieldY}px)`,
          },
          { transform: "none" },
        ],
        timing,
      ),
    ];
    return () => {
      const animations = composerAnimationsRef.current;
      // A chip removed mid-transition must shrink from the box on screen, not the finished target.
      if (animations.some((animation) => animation.playState === "running")) {
        const onScreen = readComposerLayout(composerBarRef.current, composerFieldRef.current);
        if (onScreen) composerLayoutRef.current = onScreen;
      }
      for (const animation of animations) animation.cancel();
      composerAnimationsRef.current = [];
    };
  }, [expanded]);
  const replyName = replyTarget ? (replyTargetName ?? previewMessageText(replyTarget)) : "";
  const replyNameRef = useRef(replyName);
  replyNameRef.current = replyName;
  const announceTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(announceTimer.current), []);

  // Arming or retargeting a reply unmounts the control that started it, so
  // focus would drop to <body>; announce on start and when the target changes.
  // The timer lives in a ref: a same-id rerender (e.g. the display name
  // resolving after arming) must not cancel the pending announcement.
  useEffect(() => {
    const prev = prevReplyTarget.current;
    prevReplyTarget.current = replyTarget ?? null;
    if (!replyTarget) {
      // Cancel (or send) within the delay must not let a stale "Replying to"
      // overwrite the cancel announcement — kill the pending timer.
      window.clearTimeout(announceTimer.current);
      // A send disarms the reply without touching the region — drop the stale
      // "Replying to" so it cannot linger or re-announce. An explicit cancel
      // sets "Reply cancelled" in the same event, so only clear "reply" text.
      if (replyAnnouncementKind.current === "reply") {
        replyAnnouncementKind.current = null;
        setReplyAnnouncement("");
      }
      return;
    }
    if (!prev || prev.id !== replyTarget.id) {
      textareaRef.current?.focus();
      // Clear-then-set so a switch between same-author targets re-announces —
      // identical live-region text would otherwise be a no-op.
      setReplyAnnouncement("");
      replyAnnouncementKind.current = null;
      window.clearTimeout(announceTimer.current);
      announceTimer.current = window.setTimeout(() => {
        replyAnnouncementKind.current = "reply";
        setReplyAnnouncement(t`Replying to ${replyNameRef.current}`);
      }, 50);
    }
  }, [replyTarget, replyName, t]);

  return (
    <fieldset
      aria-label={t`Message composer`}
      data-dragging={draggingFiles ? "files" : undefined}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative z-30 m-0 min-w-0 border-0 px-3 pb-4 pt-3 md:px-6 md:pb-6 ${
        draggingFiles ? "rounded-[14px] ring-2 ring-inset ring-ring" : ""
      }`}
    >
      <div role="status" data-testid="composer-announcement" className="sr-only">
        {replyAnnouncement}
      </div>
      {sendError || runError ? (
        <ComposerError
          ref={runErrorRef}
          message={(sendError ?? runError) as string}
          onOpenModelSettings={!sendError ? onOpenModelSettings : undefined}
          onNavigate={!sendError ? onNavigate : undefined}
          onDismiss={() => {
            onDismissError();
            window.requestAnimationFrame(() => textareaRef.current?.focus());
          }}
        />
      ) : null}
      {replyTarget ? (
        <ComposerReplyPreview
          author={replyName}
          text={previewMessageText(replyTarget)}
          quote={replyQuote ? maskCurrencyWhenHidden(replyQuote) : replyQuote}
          attachment={replyAttachment(replyTarget.blocks)}
          target={artifactTarget}
          onDismiss={() => {
            replyAnnouncementKind.current = "cancelled";
            window.clearTimeout(announceTimer.current);
            onClearReply?.();
            setReplyAnnouncement(t`Reply cancelled`);
            textareaRef.current?.focus();
          }}
        />
      ) : null}
      {attachmentNotice ? (
        <div
          role="status"
          className="mb-3 flex items-center gap-2 rounded-[14px] border border-warning/40 bg-warning/10 py-1 ps-4 pe-1 text-[13px] text-warning"
        >
          <span className="min-w-0 flex-1 py-1">{attachmentNotice}</span>
          {onDismissAttachmentNotice ? (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={t`Dismiss`}
              className="shrink-0 text-warning"
              onClick={onDismissAttachmentNotice}
            >
              <X aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      ) : null}
      {pendingAttachments.length || dataRoomItems.length ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {dataRoomItems.map((ref) => {
            const Icon = fileIcon(ref);
            return (
              <div
                key={ref.id}
                data-testid="data-room-chip"
                className="flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1.5 text-[13px] text-foreground/75"
              >
                <Icon aria-hidden="true" size={14} strokeWidth={1.8} />
                <span className="max-w-[180px] truncate" dir="auto">
                  {ref.name}
                </span>
                <button
                  type="button"
                  aria-label={t`Remove ${ref.name}`}
                  onClick={() => {
                    markEdited();
                    onRemoveDataRoomItem?.(ref);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X size={13} strokeWidth={2} />
                </button>
              </div>
            );
          })}
          {pendingAttachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1.5 text-[13px] text-foreground/75"
            >
              {attachment.previewUrl ? (
                <img
                  src={attachment.previewUrl}
                  alt={attachment.file.name}
                  className="h-8 w-8 rounded object-cover"
                />
              ) : (
                <Paperclip size={14} strokeWidth={1.8} />
              )}
              <span className="max-w-[180px] truncate" dir="auto">
                {attachment.file.name}
              </span>
              <button
                type="button"
                aria-label={t`Remove ${attachment.file.name}`}
                onClick={() => {
                  markEdited();
                  onRemoveAttachment(attachment);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={13} strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {mentionPickerOpen ? (
        <div
          id={mentionListboxId}
          role="listbox"
          aria-label={t`Mentions`}
          data-testid="mention-picker"
          className="mb-2 overflow-hidden rounded-[14px] border border-border bg-muted"
        >
          {mentionOptions.map((mention, index) => {
            const optionId = `${mentionListboxId}-option-${index}`;
            const highlighted = index === activeMentionIndex;
            return (
              <button
                id={optionId}
                key={mentionChipKey(mention)}
                type="button"
                role="option"
                aria-selected={highlighted}
                aria-label={t`@${mention.name}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => insertMention(mention)}
                // Opening the list under a stationary pointer must not steal the keyboard highlight.
                onMouseMove={() => setMentionHighlightKey(mentionChipKey(mention))}
                className={`flex w-full items-start gap-3 px-4 py-2.5 text-start hover:bg-accent ${
                  highlighted ? "bg-accent" : ""
                }`}
              >
                <MentionIcon mention={mention} variant="option" />
                <span className="min-w-0">
                  <span dir="auto" className="block text-[14px] text-foreground">
                    @{mention.name}
                  </span>
                  {mention.subtitle ? (
                    <span dir="auto" className="block truncate text-[12.5px] text-muted-foreground">
                      {mention.subtitle}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
      {mentionNoMatches ? (
        <div
          id={mentionListboxId}
          role="status"
          data-testid="mention-picker-empty"
          className="mb-2 rounded-[14px] border border-border bg-muted px-4 py-2.5 text-[14px] text-muted-foreground"
        >
          <Trans>No matches. Press Escape to send as typed.</Trans>
        </div>
      ) : null}
      {showSlashPicker ? (
        <div
          id={slashListboxId}
          role="listbox"
          aria-label={t`Skills and actions`}
          data-testid="slash-picker"
          className="mb-2 overflow-hidden rounded-[14px] border border-border bg-muted"
        >
          {slashSkillOptions.length ? (
            <div role="presentation" className={SLASH_SECTION_CLASS}>
              <Trans>Skills</Trans>
            </div>
          ) : null}
          {slashSkillOptions.map((skill, index) => {
            const label = slashSkillLabel(skill);
            return (
              <button
                id={`${slashListboxId}-option-${index}`}
                key={skill.id}
                type="button"
                role="option"
                aria-selected={index === activeSlashIndex}
                aria-label={t`Skill ${label.title}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => insertSkill(skill)}
                onMouseMove={() => setSlashHighlight(index)}
                className={`flex w-full items-start gap-3 px-4 py-2.5 text-start hover:bg-accent ${
                  index === activeSlashIndex ? SLASH_SELECTED_CLASS : ""
                }`}
              >
                <Box
                  size={16}
                  strokeWidth={1.7}
                  className="mt-0.5 shrink-0 text-muted-foreground"
                />
                <span className="min-w-0">
                  <span dir="auto" className="block text-[14px] text-foreground">
                    {label.title}
                  </span>
                  <span dir="auto" className="block truncate text-[12.5px] text-muted-foreground">
                    {truncateSlashDescription(label.description)}
                  </span>
                </span>
              </button>
            );
          })}
          {slashActionOptions.length ? (
            <div role="presentation" className={SLASH_SECTION_CLASS}>
              <Trans>Actions</Trans>
            </div>
          ) : null}
          {slashActionOptions.map((action, actionIndex) => {
            const label = slashActionLabel(action.id);
            const index = slashSkillOptions.length + actionIndex;
            return (
              <button
                id={`${slashListboxId}-option-${index}`}
                key={action.id}
                type="button"
                role="option"
                aria-selected={index === activeSlashIndex}
                aria-label={label}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => runSlashAction(action.id)}
                onMouseMove={() => setSlashHighlight(index)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-start hover:bg-accent ${
                  index === activeSlashIndex ? SLASH_SELECTED_CLASS : ""
                }`}
              >
                <Settings size={16} strokeWidth={1.7} className="shrink-0 text-muted-foreground" />
                <span className="text-[14px] text-foreground">{label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
      <div
        ref={composerBarRef}
        data-testid="composer-bar"
        data-expanded={expanded}
        className={`grid grid-cols-[auto_minmax(0,1fr)_auto] content-end items-center rounded-[26px] border border-border bg-background pe-2.5 ps-3 transition-colors focus-within:border-ring ${
          expanded ? "gap-x-2 gap-y-2 pb-[9px] pt-3" : "gap-x-3.5 py-[9px]"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ATTACHMENT_ACCEPT}
          className="hidden"
          onChange={(event) => pickAttachments(event.target.files)}
        />
        <Button
          ref={attachButtonRef}
          variant="ghost"
          size="icon"
          aria-label={t`Attach file`}
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
          className={`col-start-1 size-8 shrink-0 rounded-full border border-border bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-foreground ${
            expanded ? "row-start-2" : ""
          }`}
        >
          <Plus size={16} strokeWidth={2} />
        </Button>
        <div
          ref={composerFieldRef}
          className={`flex min-w-0 flex-wrap items-end gap-1.5 ${
            expanded ? "col-span-3 row-start-1 px-1.5" : "col-start-2"
          }`}
        >
          {selectedSkill ? (
            <span
              data-testid="skill-chip"
              className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[13px] text-foreground"
            >
              <Box size={13} strokeWidth={1.7} className="shrink-0 text-muted-foreground/70" />
              <span dir="auto" className="truncate">
                {slashSkillLabel(selectedSkill).title}
              </span>
              <button
                type="button"
                aria-label={t`Remove skill ${slashSkillLabel(selectedSkill).title}`}
                onClick={() => {
                  markEdited();
                  setSelectedSkill(null);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={12} strokeWidth={2} />
              </button>
            </span>
          ) : null}
          {selectedMentions.map((mention) => (
            <span
              key={mentionChipKey(mention)}
              data-testid="mention-chip"
              data-mention-kind={mention.kind}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[13px] text-foreground"
            >
              <MentionIcon mention={mention} variant="chip" />
              <span dir="auto" className="truncate">
                {mention.name}
              </span>
              {mention.kind === "routine" ? (
                <span className="shrink-0 text-muted-foreground">
                  <Trans>Runs on send</Trans>
                </span>
              ) : mention.authStatus === "needs_auth" ? (
                <span className="shrink-0 text-muted-foreground">
                  <Trans>Needs sign-in</Trans>
                </span>
              ) : null}
              <button
                type="button"
                aria-label={t`Remove mention ${mention.name}`}
                onClick={() => {
                  markEdited();
                  setSelectedMentions((current) =>
                    current.filter(
                      (selected) => mentionChipKey(selected) !== mentionChipKey(mention),
                    ),
                  );
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={12} strokeWidth={2} />
              </button>
            </span>
          ))}
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => updateDraft(event.target.value)}
            onPaste={handlePaste}
            onKeyDown={(event) => {
              if (
                event.key === "Backspace" &&
                draft.length === 0 &&
                (selectedSkill !== null || selectedMentions.length > 0)
              ) {
                event.preventDefault();
                removeLastChip();
                return;
              }
              const composing = event.nativeEvent.isComposing || event.keyCode === 229;
              if (showSlashPicker) {
                const slashKey = resolveMentionPickerKey({
                  key: event.key,
                  shiftKey: event.shiftKey,
                  isComposing: composing,
                  optionCount: slashOptionCount,
                  highlightedIndex: activeSlashIndex,
                });
                if (slashKey.type === "move") {
                  event.preventDefault();
                  setSlashHighlight(slashKey.index);
                  return;
                }
                if (slashKey.type === "complete") {
                  event.preventDefault();
                  pickSlashOption(slashKey.index);
                  return;
                }
                if (slashKey.type === "dismiss") {
                  event.preventDefault();
                  setSlashQuery(null);
                  return;
                }
              }
              const action = resolveMentionPickerKey({
                key: event.key,
                shiftKey: event.shiftKey,
                isComposing: composing,
                optionCount: mentionOptions.length,
                highlightedIndex: activeMentionIndex,
              });
              if (mentionNoMatches && !composing && event.key === "Enter" && !event.shiftKey) {
                // Escape dismisses the empty state first; Enter then sends the text as typed.
                event.preventDefault();
                return;
              }
              if (mentionNoMatches && !composing && event.key === "Escape") {
                event.preventDefault();
                setMentionQuery(null);
                return;
              }
              if (action.type === "complete") {
                const mention = mentionOptions[action.index];
                if (!mention) return;
                event.preventDefault();
                insertMention(mention);
                return;
              }
              if (action.type === "move") {
                event.preventDefault();
                const target = mentionOptions[action.index];
                if (target) setMentionHighlightKey(mentionChipKey(target));
                return;
              }
              if (action.type === "dismiss") {
                event.preventDefault();
                setMentionQuery(null);
                setMentionHighlightKey(null);
                return;
              }
              if (
                (event.key === "ArrowUp" || event.key === "ArrowDown") &&
                action.type === "none" &&
                slashQuery === null &&
                !event.shiftKey &&
                !event.altKey &&
                !event.metaKey &&
                !event.ctrlKey
              ) {
                const field = event.currentTarget;
                const up = event.key === "ArrowUp";
                // Start only from an empty draft; then step whenever the caret is on the edge line.
                const canStep =
                  field.selectionStart === field.selectionEnd &&
                  (historyIndex.current === null
                    ? up && draft.length === 0
                    : up
                      ? !draft.slice(0, field.selectionStart).includes("\n")
                      : !draft.slice(field.selectionEnd).includes("\n"));
                if (canStep && recallHistory(up ? "older" : "newer")) {
                  event.preventDefault();
                  return;
                }
              }
              if (action.type === "send") {
                event.preventDefault();
                void send();
              }
            }}
            disabled={disabled}
            placeholder={
              showComposerPlaceholder
                ? activeName
                  ? t`Message ${activeName}`
                  : t`Message…`
                : undefined
            }
            aria-label={activeName ? t`Message ${activeName}` : t`Message`}
            role="combobox"
            aria-autocomplete="list"
            aria-haspopup="listbox"
            aria-expanded={mentionPickerOpen || mentionNoMatches}
            aria-controls={
              mentionPickerOpen || mentionNoMatches
                ? mentionListboxId
                : showSlashPicker
                  ? slashListboxId
                  : undefined
            }
            aria-activedescendant={
              activeMentionOptionId ??
              (showSlashPicker ? `${slashListboxId}-option-${activeSlashIndex}` : undefined)
            }
            name="chat-message"
            autoComplete="off"
            dir="auto"
            rows={1}
            className="rk-scroll max-h-25 min-h-[24px] min-w-[8rem] flex-1 resize-none overflow-y-auto bg-transparent py-0.5 text-[15.5px] leading-6 text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-40"
          />
        </div>
        <div
          ref={composerActionsRef}
          className={`col-start-3 flex shrink-0 items-center gap-2 justify-self-end ${
            expanded ? "row-start-2" : ""
          }`}
        >
          {onVoice && draft.trim().length === 0 ? (
            <Button
              variant="outline"
              size="icon"
              aria-label={t`Call Elio`}
              title={t`Call Elio`}
              disabled={disabled}
              onClick={onVoice}
              className="size-8 shrink-0 rounded-full text-foreground/75"
            >
              <Mic size={16} strokeWidth={1.8} />
            </Button>
          ) : null}
          {running ? (
            <>
              {/* Two buttons at most, so the message field keeps its width while a run goes on. */}
              {canSend ? (
                <Button
                  size="icon"
                  aria-label={t`Send`}
                  disabled={sending || disabled}
                  onClick={send}
                  className="size-8 rounded-full bg-white text-black hover:bg-white/90 in-data-bot-accent:bg-bot-accent in-data-bot-accent:text-bot-accent-foreground in-data-bot-accent:hover:bg-bot-accent/90 shadow-sm transition-transform active:scale-95"
                >
                  <ArrowUp size={16} strokeWidth={2.2} />
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="icon"
                aria-label={t`Stop`}
                disabled={sending}
                onClick={() => void onStop()}
                className="size-8 rounded-full border border-border bg-muted text-foreground/80 shadow-sm transition-colors hover:bg-accent hover:text-foreground"
              >
                <Square size={11} strokeWidth={0} fill="currentColor" />
              </Button>
            </>
          ) : (
            <Button
              size="icon"
              aria-label={t`Send`}
              disabled={sending || !canSend || disabled}
              onClick={send}
              className="size-8 shrink-0 rounded-full bg-white text-black hover:bg-white/90 shadow-sm transition-transform active:scale-95 in-data-bot-accent:bg-bot-accent in-data-bot-accent:text-bot-accent-foreground in-data-bot-accent:hover:bg-bot-accent/90 disabled:bg-white/10 disabled:text-muted-foreground/30 disabled:shadow-none in-data-bot-accent:disabled:bg-bot-accent/25 in-data-bot-accent:disabled:text-bot-accent-foreground/60"
            >
              <ArrowUp size={16} strokeWidth={2.2} />
            </Button>
          )}
        </div>
      </div>
    </fieldset>
  );
});

type ComposerLayout = { barHeight: number; fieldX: number; fieldY: number };

/** Screen coordinates; the bar grows upward from its bottom edge. */
function readComposerLayout(
  bar: HTMLElement | null,
  field: HTMLElement | null,
): ComposerLayout | null {
  if (!bar || !field) return null;
  const fieldBox = field.getBoundingClientRect();
  return {
    barHeight: bar.getBoundingClientRect().height,
    fieldX: fieldBox.left,
    fieldY: fieldBox.top,
  };
}

/** Hides the scrollbar while measuring and leaves the height at 0. */
function measureTextareaHeight(textarea: HTMLTextAreaElement, width?: number) {
  const { style } = textarea;
  style.overflowY = "hidden";
  if (width !== undefined) {
    style.flex = "none";
    style.width = `${width}px`;
  }
  style.height = "0px";
  const height = textarea.scrollHeight;
  style.overflowY = "";
  style.flex = "";
  style.width = "";
  return height;
}

/** The picker sits on bg-muted, where bg-accent barely shows; the page background stands out. */
const SLASH_SELECTED_CLASS = "bg-background shadow-[inset_3px_0_0_var(--ring)]";
const SLASH_SECTION_CLASS =
  "px-4 pt-2.5 pb-1 text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground/80";

function slashActionLabel(id: SlashActionId) {
  switch (id) {
    case "chat-settings":
      return t`Chat settings`;
    case "settings-general":
      return t`Open Settings`;
    case "settings-usage":
      return t`See usage`;
  }
}

export function previewMessageText(message: ThreadMessage): string {
  const text = message.blocks
    .map((block) => {
      if (block.kind === "channel_message") return block.text;
      if (block.kind === "finance") return financeCardSummary(block.card);
      if (block.kind === "text") {
        // Bot text is Markdown; user text is already plain.
        return message.role === "bot" ? plainTextFromMarkdown(block.text) : block.text;
      }
      return "";
    })
    .filter(Boolean)
    .join(" ")
    .trim();
  if (text) return maskCurrencyWhenHidden(text);
  const attachment = replyAttachment(message.blocks);
  if (attachment) return attachment.kind === "image" ? t`Photo` : attachment.name || t`Attachment`;
  return t`Message`;
}
