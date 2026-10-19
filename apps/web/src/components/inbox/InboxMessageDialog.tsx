import { i18n } from "@lingui/core";
import { plural, t } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import type { ComposeMode, InboxThreadMessage } from "@rakazo/contracts";
import {
  Button,
  cn,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  Skeleton,
} from "@rakazo/ui-web";
import {
  Archive,
  Check,
  ChevronDown,
  ChevronUp,
  FileArchive,
  FileImage,
  FileText,
  Forward,
  Inbox,
  Mail,
  MailOpen,
  Reply,
  ReplyAll,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ComposeEmail } from "../../components/ComposeEmail";
import { recallClosed } from "../../components/compose/draft-memory";
import { SandboxedHtmlViewer } from "../../components/SandboxedHtmlViewer";
import { formatBytes } from "../../lib/format-bytes";
import { maskCurrencyWhenHidden, useHideAmounts } from "../../lib/hide-amounts-preference";
import { allowStep } from "../../lib/inbox-keyboard";
import type { InboxMessageOutput } from "../../lib/inbox-message-cache";
import {
  loadInboxMessage,
  peekInboxMessage,
  prefetchInboxMessage,
} from "../../lib/inbox-message-cache";
import { MAIL_SENT_EVENT } from "../../lib/outbox";
import { withSpaceHeaders } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";

/** Opens one cached message in a modal; full screen on phones. Shared by the Inbox and chat email cards. */
export function InboxMessageDialog({
  messageId,
  subject,
  previousId,
  nextId,
  onNavigate,
  unread,
  inInbox,
  onArchive,
  onMoveToInbox,
  onRead,
  notice,
  onClose,
}: {
  messageId: string | null;
  /** Shown until the message loads, from the list row that was opened. */
  subject?: string;
  /** With `onNavigate`, adds previous/next buttons and the j/k keys. */
  previousId?: string;
  nextId?: string;
  onNavigate?: (messageId: string) => void;
  /**
   * With `onArchive` and `onRead`, adds Archive and Mark read or unread. `unread` falls back to the
   * loaded message's state, and Archive shows only while the message is in the Inbox.
   */
  unread?: boolean;
  /** Whether the message is in the Inbox, when the caller knows better than the loaded copy. */
  inInbox?: boolean;
  onArchive?: () => void;
  /** Offered while the message is archived, such as a search result. */
  onMoveToInbox?: () => void;
  onRead?: (read: boolean) => void;
  /** A brief message with its own action, shown here because the page behind the dialog is inert. */
  notice?: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    if (previousId) prefetchInboxMessage(previousId);
    if (nextId) prefetchInboxMessage(nextId);
  }, [previousId, nextId]);
  // Focus the dialog itself so no toolbar button shows a focus ring on open.
  const popupRef = useRef<HTMLDivElement>(null);
  // The composer is a dialog of its own; the preview hides while it is open and returns on close.
  const [composing, setComposing] = useState<ComposeMode | null>(null);
  useEffect(() => setComposing(null), [messageId]);
  return (
    <Dialog open={messageId !== null} onOpenChange={(next) => !next && onClose()}>
      {/* Anchored at the top on wide screens, so a loading body or a notice grows it downward instead
          of moving the whole dialog. */}
      <DialogContent
        ref={popupRef}
        initialFocus={popupRef}
        tabIndex={-1}
        showCloseButton={false}
        className={cn(
          "top-0 left-0 flex h-dvh max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-2 rounded-none pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] ring-0 sm:max-w-none md:top-[7.5vh] md:left-1/2 md:h-auto md:max-h-[85vh] md:w-[min(768px,94vw)] md:-translate-x-1/2 md:translate-y-0 md:rounded-xl md:ring-1 md:has-[iframe]:h-[min(85vh,820px)]",
          composing && "invisible",
        )}
      >
        {messageId ? (
          <InboxMessage
            key={messageId}
            messageId={messageId}
            subject={subject}
            previousId={previousId}
            nextId={nextId}
            onNavigate={onNavigate}
            unread={unread}
            inInbox={inInbox}
            onArchive={onArchive}
            onMoveToInbox={onMoveToInbox}
            onRead={onRead}
            notice={notice}
            composing={composing}
            setComposing={setComposing}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

const COMPOSE_KEYS: Record<string, ComposeMode> = { r: "reply", a: "replyAll", f: "forward" };

function InboxMessage({
  messageId,
  subject,
  previousId,
  nextId,
  onNavigate,
  unread,
  inInbox: inInboxProp,
  onArchive,
  onMoveToInbox,
  onRead,
  notice,
  composing,
  setComposing,
}: {
  messageId: string;
  subject?: string;
  previousId?: string;
  nextId?: string;
  onNavigate?: (messageId: string) => void;
  unread?: boolean;
  inInbox?: boolean;
  onArchive?: () => void;
  onMoveToInbox?: () => void;
  onRead?: (read: boolean) => void;
  notice?: React.ReactNode;
  composing: ComposeMode | null;
  setComposing: (mode: ComposeMode | null) => void;
}) {
  const { t } = useLingui();
  useHideAmounts();
  const [message, setMessage] = useState<InboxMessageOutput | null>(
    () => peekInboxMessage(messageId) ?? null,
  );
  const [error, setError] = useState("");
  // A stale link: the email was deleted or moved, so trying again cannot help.
  const [gone, setGone] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const seed = useMemo(
    () => (composing ? ({ kind: composing, messageId } as const) : null),
    [composing, messageId],
  );
  useEffect(() => {
    if (attempt === 0 && peekInboxMessage(messageId)) return;
    let live = true;
    setError("");
    setGone(false);
    loadInboxMessage(messageId)
      .then((next) => {
        if (live) setMessage(next);
      })
      .catch((cause) => {
        if (!live) return;
        if ((cause as { code?: string } | null)?.code === "NOT_FOUND") setGone(true);
        else setError(errorText(cause));
      });
    return () => {
      live = false;
    };
  }, [messageId, attempt]);

  // A reply sent from here joins the conversation; the cache is already cleared, so reload it.
  useEffect(() => {
    const reload = () => setAttempt((n) => n + 1);
    window.addEventListener(MAIL_SENT_EVENT, reload);
    return () => window.removeEventListener(MAIL_SENT_EVENT, reload);
  }, []);

  // Read on every render: closing the composer re-renders, so a kept draft shows at once.
  const draft = recallClosed({ kind: "reply", messageId });
  const shownUnread = unread ?? message?.unread;
  // The caller's row is newer than the loaded copy after an archive or a move.
  const inInbox = inInboxProp ?? message?.inInbox !== false;
  const canArchive = onArchive && inInbox ? onArchive : undefined;
  useEffect(() => {
    if (!onNavigate || composing) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (
        target?.closest("input, textarea, select, [contenteditable]:not([contenteditable=false])")
      )
        return;
      const step = event.key === "j" ? nextId : event.key === "k" ? previousId : undefined;
      if (step) {
        if (allowStep(event)) onNavigate(step);
      } else if (event.key === "e" && canArchive) canArchive();
      else if (message && event.key in COMPOSE_KEYS) setComposing(COMPOSE_KEYS[event.key] ?? null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onNavigate, composing, setComposing, nextId, previousId, message, canArchive]);

  const title = gone
    ? t`Email not found`
    : maskCurrencyWhenHidden(message?.subject ?? subject ?? "");
  const sent = message ? new Date(message.date) : null;
  const parsed = splitSender(message?.from ?? "");
  // The user's own message, such as their reply found by search, says "You" as the conversation does.
  const sender = message?.fromSelf
    ? { name: t`You`, address: parsed.address || parsed.name }
    : parsed;
  return (
    <>
      <div className="flex items-start gap-2">
        <DialogTitle dir="auto" className="min-w-0 flex-1 text-xl leading-snug font-medium">
          {title}
        </DialogTitle>
        {onNavigate && !gone ? (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              className="-mt-1 shrink-0"
              disabled={!previousId}
              aria-label={t`Previous message`}
              onClick={() => previousId && onNavigate(previousId)}
            >
              <ChevronUp aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="-mt-1 shrink-0"
              disabled={!nextId}
              aria-label={t`Next message`}
              onClick={() => nextId && onNavigate(nextId)}
            >
              <ChevronDown aria-hidden="true" />
            </Button>
          </>
        ) : null}
        <DialogClose
          render={<Button variant="ghost" size="icon-sm" className="-mt-1 shrink-0" />}
          aria-label={t`Close`}
        >
          <X aria-hidden="true" />
        </DialogClose>
      </div>
      {message ? (
        <div className="flex flex-col gap-0.5 text-sm text-muted-foreground">
          <div className="flex items-baseline justify-between gap-3">
            <span dir="auto" className="min-w-0 truncate">
              <span className="font-semibold text-foreground">{sender.name}</span>
              {sender.address ? <span className="text-xs"> {`<${sender.address}>`}</span> : null}
            </span>
            <span className="flex shrink-0 items-baseline gap-2">
              {message.fromSelf ? <SentMark /> : null}
              <time
                dateTime={sent && !Number.isNaN(sent.getTime()) ? sent.toISOString() : undefined}
                className="text-xs tabular-nums"
              >
                {sent && !Number.isNaN(sent.getTime())
                  ? sent.toLocaleString(i18n.locale || "en", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })
                  : message.date}
              </time>
            </span>
          </div>
          <div className="flex gap-x-3 text-xs">
            <span dir="auto" title={message.to} className="min-w-0 truncate">
              {t`to ${message.to}`}
            </span>
            {message.cc ? (
              <span dir="auto" title={message.cc} className="min-w-0 truncate">
                {t`cc ${message.cc}`}
              </span>
            ) : null}
          </div>
        </div>
      ) : (
        <Skeleton className="h-8 w-full" />
      )}
      {message ? (
        <div className="flex flex-wrap gap-1.5">
          <Button variant="outline" size="sm" onClick={() => setComposing("reply")}>
            <Reply aria-hidden="true" />
            <Trans>Reply</Trans>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setComposing("replyAll")}>
            <ReplyAll aria-hidden="true" />
            <Trans>Reply all</Trans>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setComposing("forward")}>
            <Forward aria-hidden="true" />
            <Trans>Forward</Trans>
          </Button>
          {canArchive ? (
            <Button variant="outline" size="sm" onClick={canArchive}>
              <Archive aria-hidden="true" />
              <Trans>Archive</Trans>
            </Button>
          ) : null}
          {onMoveToInbox && !inInbox ? (
            <Button variant="outline" size="sm" onClick={onMoveToInbox}>
              <Inbox aria-hidden="true" />
              <Trans>Move to Inbox</Trans>
            </Button>
          ) : null}
          {onRead && shownUnread !== undefined ? (
            <Button variant="outline" size="sm" onClick={() => onRead(shownUnread)}>
              {shownUnread ? <MailOpen aria-hidden="true" /> : <Mail aria-hidden="true" />}
              {shownUnread ? <Trans>Mark read</Trans> : <Trans>Mark unread</Trans>}
            </Button>
          ) : null}
          {/* In the toolbar, so it neither covers the email nor moves the dialog. */}
          {notice ? <div className="ms-auto flex min-w-0 max-w-full">{notice}</div> : null}
        </div>
      ) : null}
      {message && !composing && draft ? (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Trans>You have an unsent reply to this email.</Trans>
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={() => setComposing(draft.seed.kind === "new" ? "reply" : draft.seed.kind)}
          >
            <Trans>Continue draft</Trans>
          </Button>
        </p>
      ) : null}
      {seed ? <ComposeEmail seed={seed} accounts={[]} onClose={() => setComposing(null)} /> : null}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {message?.thread?.length ? (
          // The open message is below with its own sender line, so this counts only the rows here.
          <ThreadMessages
            heading={plural(message.thread.length, {
              one: "# earlier message",
              other: "# earlier messages",
            })}
            messages={message.thread}
          />
        ) : null}
        {gone ? (
          <div className="flex flex-col items-start gap-3">
            <p role="status" className="text-sm text-muted-foreground">
              <Trans>
                This email isn't in your mail any more. It may have been deleted or moved.
              </Trans>
            </p>
            <DialogClose render={<Button variant="outline" size="sm" />}>
              <Trans>Back to Inbox</Trans>
            </DialogClose>
          </div>
        ) : error ? (
          <div className="flex flex-col items-start gap-2">
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
            <Button variant="outline" size="sm" onClick={() => setAttempt((n) => n + 1)}>
              <Trans>Try again</Trans>
            </Button>
          </div>
        ) : !message ? (
          <Skeleton className="h-24 w-full" />
        ) : message.html &&
          hasVisibleContent(message.html) &&
          !(message.text && isPlainHtml(message.html)) ? (
          <div className="min-h-64 flex-1 overflow-hidden rounded-lg border border-border">
            <SandboxedHtmlViewer html={message.html} title={message.subject} email />
          </div>
        ) : (
          <p dir="auto" className="whitespace-pre-wrap wrap-anywhere text-sm">
            {maskCurrencyWhenHidden(message.text ?? "")}
          </p>
        )}
        {message?.attachments.length ? (
          <InboxAttachments messageId={messageId} attachments={message.attachments} />
        ) : null}
        {message?.later?.length ? (
          <div className="mt-4">
            <ThreadMessages heading={t`Later in this conversation`} messages={message.later} />
          </div>
        ) : null}
      </div>
    </>
  );
}

/** False for a mail whose HTML has no text and no picture, which would show as a blank frame. */
function hasVisibleContent(html: string): boolean {
  const { body } = new DOMParser().parseFromString(html, "text/html");
  for (const node of body.querySelectorAll("style, script")) node.remove();
  return Boolean(body.textContent?.trim()) || body.querySelector("img, svg, video") !== null;
}

/** Tags of a plain written message, such as one from the composer, which reads best as text in the app's own style. Links are left out: the text copy would drop their destinations. */
const PLAIN_TAGS = new Set([
  "HTML",
  "HEAD",
  "BODY",
  "META",
  "TITLE",
  "P",
  "BR",
  "DIV",
  "SPAN",
  "B",
  "STRONG",
  "I",
  "EM",
  "U",
  "UL",
  "OL",
  "LI",
  "BLOCKQUOTE",
]);

/** True when the HTML is only text formatting: no layout, pictures or styles of its own. */
export function isPlainHtml(html: string): boolean {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return [...doc.querySelectorAll("*")].every((el) => PLAIN_TAGS.has(el.tagName));
}

/** `Name <a@b.test>` as the server writes it; a bare address is its own name. */
function splitSender(from: string): { name: string; address: string } {
  const match = /^\s*"?([^<"]*?)"?\s*<([^<>]+)>\s*$/.exec(from);
  if (!match) return { name: from, address: "" };
  const name = (match[1] ?? "").trim();
  const address = (match[2] ?? "").trim();
  return name ? { name, address } : { name: address, address: "" };
}

type MailAttachmentItem = InboxMessageOutput["attachments"][number];

function AttachmentIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) return <FileImage />;
  if (/zip|compressed|tar/.test(mimeType)) return <FileArchive />;
  return <FileText />;
}

/** Fetches with the session and space header, then saves the bytes; the file is never opened in the page. */
async function saveAttachment(messageId: string, attachment: MailAttachmentItem) {
  const response = await fetch(
    `/api/inbox/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachment.id)}`,
    { headers: withSpaceHeaders(), credentials: "include" },
  );
  if (!response.ok) throw new Error(`Attachment download failed (${response.status})`);
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = attachment.filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function InboxAttachments({
  messageId,
  attachments,
}: {
  messageId: string;
  attachments: MailAttachmentItem[];
}) {
  const [result, setResult] = useState<{ ok: boolean; filename: string } | null>(null);
  return (
    <div className="mt-3">
      <ul aria-label={t`Attachments`} className="flex flex-wrap gap-2">
        {attachments.map((attachment) => (
          <li key={attachment.id}>
            <Button
              variant="outline"
              className="h-auto max-w-64 justify-start gap-2 px-3 py-2 text-start [&_svg]:size-4 [&_svg]:text-muted-foreground"
              onClick={() => {
                setResult(null);
                saveAttachment(messageId, attachment).then(
                  () => setResult({ ok: true, filename: attachment.filename }),
                  () => setResult({ ok: false, filename: attachment.filename }),
                );
              }}
            >
              <AttachmentIcon mimeType={attachment.mimeType} />
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{attachment.filename}</span>
                <span className="text-xs text-muted-foreground">
                  {formatBytes(attachment.size)}
                </span>
              </span>
            </Button>
          </li>
        ))}
      </ul>
      <p
        role={result && !result.ok ? "alert" : "status"}
        className={cn(
          "mt-2 text-sm empty:hidden",
          result?.ok ? "text-muted-foreground" : "text-destructive",
        )}
      >
        {result
          ? result.ok
            ? t`Downloaded ${result.filename}`
            : t`Couldn't download ${result.filename}`
          : null}
      </p>
    </div>
  );
}

/** Shown on a message the user sent; the provider only reports a message as sent once it left. */
function SentMark() {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Check aria-hidden="true" className="size-3 text-success" />
      <Trans>Sent</Trans>
    </span>
  );
}

/** Other messages of the conversation, one line each; a click shows that message's text. */
/** A reply's preview without the "On <date>, <name> wrote:" line that starts its quote. */
export function withoutQuoteHeader(snippet: string): string {
  return snippet.replace(/\s*On [^\n]{4,160}? wrote:[\s\S]*$/, "").trim() || snippet;
}

function ThreadMessages({
  heading,
  messages,
}: {
  heading: string;
  messages: InboxThreadMessage[];
}) {
  return (
    <section className="mb-3 flex flex-col">
      <h3 className="mb-1 text-xs text-muted-foreground">{heading}</h3>
      {messages.length ? (
        <ol className="flex flex-col rounded-lg border border-border">
          {messages.map((item) => (
            <ThreadMessage key={item.id} item={item} />
          ))}
        </ol>
      ) : null}
    </section>
  );
}

function ThreadMessage({ item }: { item: InboxThreadMessage }) {
  useHideAmounts();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState<InboxMessageOutput | null>(null);
  const [error, setError] = useState("");
  const toggle = () => {
    setOpen(!open);
    if (open || body) return;
    setError("");
    loadInboxMessage(item.id).then(setBody, (cause) => setError(errorText(cause)));
  };
  const sent = new Date(item.receivedAt);
  return (
    <li
      className={cn(
        "border-b border-border last:border-b-0",
        item.fromSelf && "border-s-2 border-s-success/40",
      )}
    >
      <Button
        variant="ghost"
        aria-expanded={open}
        onClick={toggle}
        className="h-auto w-full min-w-0 justify-start gap-2 rounded-none px-3 py-2 text-start font-normal"
      >
        <span dir="auto" className="max-w-[40%] shrink-0 truncate font-medium">
          {item.fromSelf ? <Trans>You</Trans> : item.from}
        </span>
        <span dir="auto" className="min-w-0 flex-1 truncate text-muted-foreground">
          {open ? null : maskCurrencyWhenHidden(withoutQuoteHeader(item.snippet))}
        </span>
        {item.fromSelf ? <SentMark /> : null}
        <time
          dateTime={item.receivedAt}
          className="shrink-0 text-xs text-muted-foreground tabular-nums"
        >
          {Number.isNaN(sent.getTime())
            ? ""
            : sent.toLocaleString(i18n.locale || "en", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
        </time>
      </Button>
      {open ? (
        <div className="px-3 pb-3">
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : body ? (
            <p dir="auto" className="whitespace-pre-wrap wrap-anywhere text-sm">
              {maskCurrencyWhenHidden(body.text || item.snippet)}
            </p>
          ) : (
            <Skeleton className="h-12 w-full" />
          )}
        </div>
      ) : null}
    </li>
  );
}
