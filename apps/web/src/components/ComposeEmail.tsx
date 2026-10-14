import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { ComposeMode, ComposeResult } from "@rakazo/contracts";
import { MAX_COMPOSE_ATTACHMENT_BYTES, MAX_COMPOSE_ATTACHMENT_MB } from "@rakazo/contracts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogTitle,
  Button,
  cn,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  NativeSelect,
  NativeSelectOption,
  Spinner,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@rakazo/ui-web";
import { EditorContent } from "@tiptap/react";
import { Paperclip, Trash2, Type, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { fileToBase64, formatBytes, textToHtml } from "../lib/compose-body";
import { createDraftSaver } from "../lib/compose-draft";
import { parseRecipient, takeEntries } from "../lib/recipients";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";
import { RecipientField } from "./compose/RecipientField";
import { FormatBar, LinkButton, ToolButton, useComposeEditor } from "./compose/RichTextEditor";

/** Fired on `window` after a message is sent, so the Inbox can show "Sent" and refresh. */
export const MAIL_SENT_EVENT = "rakazo:mail-sent";

const AUTOSAVE_MS = 1_500;

export type ComposeSeed = { kind: "new" } | { kind: ComposeMode; messageId: string };

/** Pass this one object, not a new literal each render: a changed seed loads the prefill again. */
export const NEW_MESSAGE: ComposeSeed = { kind: "new" };

interface Fields {
  connectionId: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  /** The editor's HTML; empty when the message has no text. */
  html: string;
  text: string;
}

type Notice = { kind: "saved" | "error"; text: string };

/** Random enough to name one composer: it is the key that keeps a retried send from sending twice. */
function newClientId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

const isBlank = (f: Fields) =>
  [f.subject, f.text].every((text) => text.trim() === "") &&
  f.to.length + f.cc.length + f.bcc.length === 0;

function problemText(status: ComposeResult["status"], sending: boolean): string {
  if (status === "reconnect") return t`Gmail needs to be reconnected.`;
  if (status === "disabled") return t`Sending is turned off.`;
  if (status === "unknown") return t`Not confirmed as sent. Check Sent before trying again.`;
  return sending ? t`Couldn't send. Try again.` : t`Couldn't save the draft`;
}

function Row({
  label,
  children,
  end,
}: {
  label: string;
  children: React.ReactNode;
  end?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-9 items-start gap-2 border-b border-border py-1">
      <span aria-hidden="true" className="w-12 shrink-0 text-sm leading-7 text-muted-foreground">
        {label}
      </span>
      {children}
      {end ? <div className="flex h-7 shrink-0 items-center">{end}</div> : null}
    </div>
  );
}

const hasFiles = (event: React.DragEvent) => event.dataTransfer.types.includes("Files");

/**
 * Writes a new message, or a reply, reply-all or forward of a cached one, with chips for
 * recipients, a rich text body and attachments. Typing saves a Gmail draft after a pause (without
 * attachments). Send is the only confirmation, and a retried or repeated send never sends twice
 * because the server keys it by `clientId`. Closing keeps the draft unless nothing was written.
 */
export function ComposeEmail({
  seed,
  accounts,
  connectionId,
  onClose,
}: {
  seed: ComposeSeed;
  /** The From choices for a new message; with more than one, a picker shows. */
  accounts: Array<{ connectionId: string; label: string }>;
  /** The account a new message starts from. */
  connectionId?: string;
  onClose: () => void;
}) {
  const [clientId] = useState(newClientId);
  const initial: Fields = {
    connectionId: connectionId ?? accounts[0]?.connectionId ?? "",
    to: [],
    cc: [],
    bcc: [],
    subject: "",
    html: "",
    text: "",
  };
  const [fields, setFields] = useState(initial);
  const fieldsRef = useRef(initial);
  const replyToRef = useRef<string | undefined>(undefined);
  const prefillBody = useRef<string | null>(null);
  const [loading, setLoading] = useState(seed.kind !== "new");
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [showFormat, setShowFormat] = useState(true);
  const [linkOpen, setLinkOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [prefillAttempt, setPrefillAttempt] = useState(0);
  const [prefillFailed, setPrefillFailed] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  // Set once the person edits; an untouched reply is not worth keeping.
  const touched = useRef(false);
  // A Gmail draft may exist once a save has succeeded.
  const saved = useRef(false);
  const done = useRef(false);
  const toRef = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const locked = loading || sending;

  /** Autosave carries no attachments: they are re-sent with Send, and the draft stays small. */
  const payload = (f: Fields) => ({
    clientId,
    connectionId: f.connectionId,
    ...(replyToRef.current ? { replyToMessageId: replyToRef.current } : {}),
    to: f.to.join(", "),
    cc: f.cc.join(", "),
    bcc: f.bcc.join(", "),
    subject: f.subject,
    body: f.text,
    ...(f.html ? { html: f.html } : {}),
  });
  type Payload = ReturnType<typeof payload>;

  const saver = useMemo(
    () =>
      createDraftSaver<Payload>(async (value) => {
        try {
          const { status } = await rpc.inbox.compose.draftSave(value);
          if (status === "saved") {
            saved.current = true;
            setNotice({ kind: "saved", text: t`Draft saved` });
          } else if (status !== "sent") {
            setNotice({ kind: "error", text: problemText(status, false) });
          }
        } catch {
          setNotice({ kind: "error", text: t`Couldn't save the draft` });
        }
      }, AUTOSAVE_MS),
    [],
  );

  const update = (patch: Partial<Fields>) => {
    touched.current = true;
    const next = { ...fieldsRef.current, ...patch };
    fieldsRef.current = next;
    setFields(next);
    if (isBlank(next) && files.length === 0) saver.cancel();
    else saver.change(payload(next));
  };

  const editor = useComposeEditor({
    disabled: locked,
    onChange: ({ html, text }) => update({ html, text }),
    onLinkShortcut: () => setLinkOpen(true),
  });

  useEffect(() => {
    if (seed.kind === "new") return;
    let live = true;
    setPrefillFailed(false);
    setNotice(null);
    rpc.inbox.compose
      .prefill({ messageId: seed.messageId, mode: seed.kind })
      .then((next) => {
        if (!live) return;
        replyToRef.current = next.replyToMessageId;
        prefillBody.current = next.body;
        const loaded: Fields = {
          connectionId: next.connectionId,
          to: takeEntries(next.to, [], true).added,
          cc: takeEntries(next.cc, [], true).added,
          bcc: [],
          subject: next.subject,
          html: "",
          text: next.body,
        };
        fieldsRef.current = loaded;
        setFields(loaded);
        setShowCc(loaded.cc.length > 0);
        setLoading(false);
      })
      .catch((cause) => {
        if (!live) return;
        setNotice({ kind: "error", text: errorText(cause) });
        setPrefillFailed(true);
      });
    return () => {
      live = false;
    };
  }, [seed, prefillAttempt]);

  // Fill the editor with the quoted original once both it and the editor exist. A reply starts
  // above the quote; a forward starts at its empty To.
  useEffect(() => {
    if (loading || !editor || prefillBody.current === null) return;
    editor.commands.setContent(textToHtml(prefillBody.current), { emitUpdate: false });
    prefillBody.current = null;
    fieldsRef.current = {
      ...fieldsRef.current,
      html: editor.isEmpty ? "" : editor.getHTML(),
      text: editor.getText({ blockSeparator: "\n" }),
    };
    if (seed.kind === "forward") toRef.current?.focus({ preventScroll: true });
    else editor.commands.focus("start", { scrollIntoView: false });
  }, [loading, editor, seed.kind]);

  // Closing the page or the message view keeps what was typed.
  useEffect(
    () => () => {
      if (!done.current) void saver.flush();
    },
    [saver],
  );

  /** Drops the Gmail draft, if one was saved, once any save in flight has finished. */
  const discard = () => {
    done.current = true;
    saver.cancel();
    void saver
      .flush()
      .then(() => (saved.current ? rpc.inbox.compose.discard({ clientId }) : undefined))
      .catch(() => undefined);
    onClose();
  };

  const closeNow = () => {
    if (!touched.current || (isBlank(fieldsRef.current) && files.length === 0)) discard();
    else onClose();
  };

  const close = () => {
    if (sending) return;
    // Autosave leaves attachments out, so closing would lose them: ask first.
    if (files.length > 0) setConfirmClose(true);
    else closeNow();
  };

  const addFiles = (incoming: File[]) => {
    if (incoming.length === 0) return;
    let total = files.reduce((sum, file) => sum + file.size, 0);
    const accepted: File[] = [];
    let tooBig = false;
    for (const file of incoming) {
      if (total + file.size > MAX_COMPOSE_ATTACHMENT_BYTES) {
        tooBig = true;
        continue;
      }
      total += file.size;
      accepted.push(file);
    }
    setNotice(
      tooBig
        ? {
            kind: "error",
            text: t`Attachments can't be over ${MAX_COMPOSE_ATTACHMENT_MB} MB.`,
          }
        : null,
    );
    if (accepted.length) {
      touched.current = true;
      setFiles([...files, ...accepted]);
    }
  };

  const send = async () => {
    if (sending || loading) return;
    const current = fieldsRef.current;
    const all = [...current.to, ...current.cc, ...current.bcc];
    if (all.length === 0) {
      setNotice({ kind: "error", text: t`Add a recipient.` });
      return;
    }
    if (all.some((entry) => !parseRecipient(entry).valid)) {
      setNotice({ kind: "error", text: t`Fix or remove the highlighted addresses.` });
      return;
    }
    setSending(true);
    setNotice(null);
    // An autosave still running would race the send; the send carries the final text itself.
    saver.cancel();
    await saver.flush();
    try {
      const attachments = await Promise.all(
        files.map(async (file) => ({
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          data: await fileToBase64(file),
        })),
      );
      const { status } = await rpc.inbox.compose.send({
        ...payload(current),
        ...(attachments.length ? { attachments } : {}),
      });
      if (status === "sent") {
        done.current = true;
        window.dispatchEvent(new Event(MAIL_SENT_EVENT));
        onClose();
        return;
      }
      setNotice({ kind: "error", text: problemText(status, true) });
    } catch (cause) {
      setNotice({ kind: "error", text: errorText(cause) });
    }
    setSending(false);
  };

  const title =
    seed.kind === "reply"
      ? t`Reply`
      : seed.kind === "replyAll"
        ? t`Reply all`
        : seed.kind === "forward"
          ? t`Forward`
          : t`New message`;

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent
        initialFocus={seed.kind === "new" ? toRef : undefined}
        showCloseButton={false}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            void send();
          }
        }}
        onDragOver={(event) => {
          if (!hasFiles(event)) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={(event) => {
          if (!hasFiles(event)) return;
          event.preventDefault();
          setDragging(false);
          if (!locked) addFiles([...event.dataTransfer.files]);
        }}
        className="flex h-[min(680px,88vh)] w-[min(680px,94vw)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none max-md:inset-0 max-md:top-0 max-md:left-0 max-md:h-dvh max-md:max-h-none max-md:w-screen max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-none max-md:pt-[env(safe-area-inset-top)] max-md:pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border bg-muted/50 py-1.5 ps-4 pe-2">
          <DialogTitle className="min-w-0 flex-1 truncate text-sm leading-normal">
            {title}
          </DialogTitle>
          <DialogClose
            render={<Button variant="ghost" size="icon-sm" />}
            aria-label={t`Close`}
            disabled={sending}
          >
            <X aria-hidden="true" />
          </DialogClose>
        </div>

        <div className="shrink-0 px-4">
          {seed.kind === "new" && accounts.length > 1 ? (
            <Row label={t`From`}>
              <NativeSelect
                size="sm"
                className="min-w-0 flex-1"
                value={fields.connectionId}
                disabled={locked}
                aria-label={t`From`}
                onChange={(event) => update({ connectionId: event.target.value })}
              >
                {accounts.map((account) => (
                  <NativeSelectOption key={account.connectionId} value={account.connectionId}>
                    {account.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Row>
          ) : null}
          <Row
            label={t`To`}
            end={
              <>
                {!showCc ? (
                  <Button variant="ghost" size="xs" onClick={() => setShowCc(true)}>
                    <Trans>Cc</Trans>
                  </Button>
                ) : null}
                {!showBcc ? (
                  <Button variant="ghost" size="xs" onClick={() => setShowBcc(true)}>
                    <Trans>Bcc</Trans>
                  </Button>
                ) : null}
              </>
            }
          >
            <RecipientField
              label={t`To`}
              inputRef={toRef}
              entries={fields.to}
              disabled={locked}
              onChange={(to) => update({ to })}
            />
          </Row>
          {showCc ? (
            <Row label={t`Cc`}>
              <RecipientField
                label={t`Cc`}
                entries={fields.cc}
                disabled={locked}
                onChange={(cc) => update({ cc })}
              />
            </Row>
          ) : null}
          {showBcc ? (
            <Row label={t`Bcc`}>
              <RecipientField
                label={t`Bcc`}
                entries={fields.bcc}
                disabled={locked}
                onChange={(bcc) => update({ bcc })}
              />
            </Row>
          ) : null}
          <Row label={t`Subject`}>
            <input
              aria-label={t`Subject`}
              value={fields.subject}
              disabled={locked}
              maxLength={998}
              dir="auto"
              autoComplete="off"
              className="h-7 min-w-0 flex-1 bg-transparent text-sm outline-none disabled:opacity-50"
              onChange={(event) => update({ subject: event.target.value })}
            />
          </Row>
        </div>

        {/* biome-ignore lint/a11y/useKeyWithClickEvents: the editor itself is the keyboard target */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: a click on blank space focuses the editor */}
        <div
          className="min-h-0 flex-1 cursor-text overflow-y-auto"
          onClick={(event) => {
            if (event.target === event.currentTarget) editor?.commands.focus("end");
          }}
        >
          <EditorContent editor={editor} />
        </div>

        {files.length ? (
          <ul
            aria-label={t`Attachments`}
            className="flex max-h-24 shrink-0 flex-wrap gap-1.5 overflow-y-auto border-t border-border px-4 py-2"
          >
            {files.map((file, index) => (
              <li
                // Two files can share a name; the list only changes by add or remove.
                key={`${file.name}-${index}`}
                className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-lg border border-border ps-2 pe-0.5 text-xs"
              >
                <Paperclip aria-hidden="true" className="size-3 shrink-0 text-muted-foreground" />
                <span className="truncate" dir="auto">
                  {file.name}
                </span>
                <span className="shrink-0 text-muted-foreground">{formatBytes(file.size)}</span>
                <button
                  type="button"
                  disabled={sending}
                  aria-label={t`Remove ${file.name}`}
                  className="inline-flex size-5 shrink-0 items-center justify-center rounded-full hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                  onClick={() => setFiles(files.filter((_, i) => i !== index))}
                >
                  <X aria-hidden="true" className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {showFormat ? <FormatBar editor={editor} disabled={locked} /> : null}

        <div className="flex shrink-0 items-center gap-1 px-3 py-2">
          <Button
            className="rounded-full px-4"
            disabled={locked}
            aria-busy={sending}
            onClick={() => void send()}
          >
            {sending ? <Spinner aria-hidden="true" role="presentation" /> : null}
            <Trans>Send</Trans>
          </Button>
          <ToolButton
            label={t`Formatting options`}
            active={showFormat}
            onClick={() => setShowFormat(!showFormat)}
          >
            <Type aria-hidden="true" />
          </ToolButton>
          <ToolButton
            label={t`Attach files`}
            disabled={locked}
            onClick={() => fileInput.current?.click()}
          >
            <Paperclip aria-hidden="true" />
          </ToolButton>
          <LinkButton
            editor={editor}
            open={linkOpen}
            disabled={locked}
            onOpenChange={setLinkOpen}
          />
          <input
            ref={fileInput}
            type="file"
            multiple
            hidden
            aria-hidden="true"
            tabIndex={-1}
            onChange={(event) => {
              addFiles([...(event.target.files ?? [])]);
              event.target.value = "";
            }}
          />
          {prefillFailed ? (
            <Button variant="outline" size="sm" onClick={() => setPrefillAttempt((n) => n + 1)}>
              <Trans>Try again</Trans>
            </Button>
          ) : null}
          <p
            role={notice?.kind === "error" ? "alert" : "status"}
            className={cn(
              "min-w-0 flex-1 truncate px-2 text-end text-xs",
              notice?.kind === "error" ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {notice?.text}
          </p>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={sending}
                  aria-label={t`Discard`}
                  onClick={discard}
                />
              }
            >
              <Trash2 aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent>{t`Discard`}</TooltipContent>
          </Tooltip>
        </div>

        <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
          <AlertDialogContent size="sm">
            <AlertDialogTitle>
              <Trans>Discard attachments?</Trans>
            </AlertDialogTitle>
            <AlertDialogFooter>
              <AlertDialogCancel>
                <Trans>Keep editing</Trans>
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setConfirmClose(false);
                  closeNow();
                }}
              >
                <Trans>Close</Trans>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {dragging ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] border-2 border-dashed border-primary/40 bg-background/80 text-sm text-muted-foreground"
          >
            <Trans>Drop files to attach</Trans>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
