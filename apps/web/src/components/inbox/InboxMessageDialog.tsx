import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import type { ComposeMode } from "@rakazo/contracts";
import { Button, Dialog, DialogClose, DialogContent, DialogTitle, Skeleton } from "@rakazo/ui-web";
import {
  ChevronDown,
  ChevronUp,
  FileArchive,
  FileImage,
  FileText,
  Forward,
  Reply,
  ReplyAll,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ComposeEmail } from "../../components/ComposeEmail";
import { SandboxedHtmlViewer } from "../../components/SandboxedHtmlViewer";
import type { InboxMessageOutput } from "../../lib/inbox-message-cache";
import {
  loadInboxMessage,
  peekInboxMessage,
  prefetchInboxMessage,
} from "../../lib/inbox-message-cache";
import { withSpaceHeaders } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";

/** Opens one cached message in a modal; full screen on phones. Shared by the Inbox and chat email cards. */
export function InboxMessageDialog({
  messageId,
  subject,
  previousId,
  nextId,
  onNavigate,
  onClose,
}: {
  messageId: string | null;
  /** Shown until the message loads, from the list row that was opened. */
  subject?: string;
  /** With `onNavigate`, adds previous/next buttons and the j/k keys. */
  previousId?: string;
  nextId?: string;
  onNavigate?: (messageId: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (previousId) prefetchInboxMessage(previousId);
    if (nextId) prefetchInboxMessage(nextId);
  }, [previousId, nextId]);
  // Focus the dialog itself so no toolbar button shows a focus ring on open.
  const popupRef = useRef<HTMLDivElement>(null);
  return (
    <Dialog open={messageId !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        ref={popupRef}
        initialFocus={popupRef}
        tabIndex={-1}
        showCloseButton={false}
        className="top-0 left-0 flex h-dvh max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-2 rounded-none pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] ring-0 sm:max-w-none md:top-1/2 md:left-1/2 md:h-auto md:max-h-[85vh] md:w-[min(768px,94vw)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:ring-1"
      >
        {messageId ? (
          <InboxMessage
            key={messageId}
            messageId={messageId}
            subject={subject}
            previousId={previousId}
            nextId={nextId}
            onNavigate={onNavigate}
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
}: {
  messageId: string;
  subject?: string;
  previousId?: string;
  nextId?: string;
  onNavigate?: (messageId: string) => void;
}) {
  const { t } = useLingui();
  const [message, setMessage] = useState<InboxMessageOutput | null>(
    () => peekInboxMessage(messageId) ?? null,
  );
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [composing, setComposing] = useState<ComposeMode | null>(null);
  const seed = useMemo(
    () => (composing ? ({ kind: composing, messageId } as const) : null),
    [composing, messageId],
  );
  useEffect(() => {
    if (attempt === 0 && peekInboxMessage(messageId)) return;
    let live = true;
    setError("");
    loadInboxMessage(messageId)
      .then((next) => {
        if (live) setMessage(next);
      })
      .catch((cause) => {
        if (live) setError(errorText(cause));
      });
    return () => {
      live = false;
    };
  }, [messageId, attempt]);

  useEffect(() => {
    if (!onNavigate || composing) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (
        target?.closest("input, textarea, select, [contenteditable]:not([contenteditable=false])")
      )
        return;
      if (event.key === "j" && nextId) onNavigate(nextId);
      else if (event.key === "k" && previousId) onNavigate(previousId);
      else if (message && event.key in COMPOSE_KEYS) setComposing(COMPOSE_KEYS[event.key] ?? null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onNavigate, composing, nextId, previousId, message]);

  const title = message?.subject ?? subject ?? "";
  const sent = message ? new Date(message.date) : null;
  const sender = splitSender(message?.from ?? "");
  return (
    <>
      <div className="flex items-start gap-2">
        <DialogTitle dir="auto" className="min-w-0 flex-1 text-xl leading-snug font-medium">
          {title}
        </DialogTitle>
        {onNavigate ? (
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
            <time
              dateTime={sent && !Number.isNaN(sent.getTime()) ? sent.toISOString() : undefined}
              className="shrink-0 text-xs tabular-nums"
            >
              {sent && !Number.isNaN(sent.getTime())
                ? sent.toLocaleString(i18n.locale || "en", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : message.date}
            </time>
          </div>
          <span dir="auto" className="truncate text-xs">
            {t`to ${message.to}`}
          </span>
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
        </div>
      ) : null}
      {seed ? <ComposeEmail seed={seed} accounts={[]} onClose={() => setComposing(null)} /> : null}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {error ? (
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
        ) : message.html ? (
          <div className="min-h-[50dvh] flex-1 overflow-hidden rounded-lg border border-border md:h-[min(70vh,640px)] md:flex-none">
            <SandboxedHtmlViewer html={message.html} title={message.subject} email />
          </div>
        ) : (
          <p dir="auto" className="whitespace-pre-wrap text-sm">
            {message.text}
          </p>
        )}
        {message?.attachments.length ? (
          <InboxAttachments messageId={messageId} attachments={message.attachments} />
        ) : null}
      </div>
    </>
  );
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

function formatAttachmentSize(bytes: number): string {
  const [unit, divisor] =
    bytes < 1_000
      ? (["byte", 1] as const)
      : bytes < 1_000_000
        ? (["kilobyte", 1_000] as const)
        : (["megabyte", 1_000_000] as const);
  return new Intl.NumberFormat(i18n.locale || "en", {
    style: "unit",
    unit,
    unitDisplay: "narrow",
    maximumFractionDigits: 1,
  }).format(bytes / divisor);
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
  const [failed, setFailed] = useState(false);
  return (
    <div className="mt-3">
      <ul aria-label={t`Attachments`} className="flex flex-wrap gap-2">
        {attachments.map((attachment) => (
          <li key={attachment.id}>
            <button
              type="button"
              className="flex max-w-64 items-center gap-2 rounded-lg border border-border px-3 py-2 text-start text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground"
              onClick={() => {
                setFailed(false);
                saveAttachment(messageId, attachment).catch(() => setFailed(true));
              }}
            >
              <AttachmentIcon mimeType={attachment.mimeType} />
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{attachment.filename}</span>
                <span className="text-xs text-muted-foreground">
                  {formatAttachmentSize(attachment.size)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {failed ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          <Trans>Download failed</Trans>
        </p>
      ) : null}
    </div>
  );
}
