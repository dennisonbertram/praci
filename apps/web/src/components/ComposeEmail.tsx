import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { ComposeMode, ComposeResult } from "@rakazo/contracts";
import { MAX_COMPOSE_ATTACHMENT_BYTES, MAX_COMPOSE_ATTACHMENT_MB } from "@rakazo/contracts";
import { newClientId } from "@rakazo/core";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
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
import { clientLocale, fileToBase64, prefillHtml, textToHtml } from "../lib/compose-body";
import { createDraftSaver } from "../lib/compose-draft";
import { announceComposerSent } from "../lib/composer-sent";
import { formatBytes } from "../lib/format-bytes";
import { maskCurrencyWhenHidden, useHideAmounts } from "../lib/hide-amounts-preference";
import { holdDiscard, holdSend } from "../lib/outbox";
import { invalidRecipients, summarizeRecipients, takeEntries } from "../lib/recipients";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";
import { focusRestored } from "./compose/caret";
import { forgetClosed, recallClosed, rememberClosed } from "./compose/draft-memory";
import { invalidAddressText, RecipientField } from "./compose/RecipientField";
import { FormatBar, ToolButton, useComposeEditor } from "./compose/RichTextEditor";

const AUTOSAVE_MS = 1_500;

export type ComposeSeed = { kind: "new" } | { kind: ComposeMode; messageId: string };

/** Pass this one object, not a new literal each render: a changed seed loads the prefill again. */
export const NEW_MESSAGE: ComposeSeed = { kind: "new" };

export interface Fields {
  connectionId: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  /** The editor's HTML; empty when the message has no text. */
  html: string;
  text: string;
}

/** An attachment of the message being forwarded; the server adds its bytes when it sends. */
interface Forwarded {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

type Account = { connectionId: string; label: string; address?: string };
type Accounts = Account[];

/** The From line: the address when Gmail has reported it, with the account's name. */
const accountText = (account: Account) =>
  account.address && account.address !== account.label
    ? `${account.label} <${account.address}>`
    : account.label;

/** Everything in a composer, so a held or failed send can open it again as it was. */
export interface ComposeRestore {
  seed: ComposeSeed;
  clientId: string;
  fields: Fields;
  replyToId?: string;
  forwarded: Forwarded[];
  /** The original's files that were too large to forward. */
  leftOut?: { filename: string; size: number }[];
  files: File[];
  /** A Gmail draft may exist, so Discard has one to remove. */
  saved: boolean;
  accounts: Accounts;
  notice?: string;
}

type Notice = { kind: "saved" | "error"; text: string };

const isBlank = (f: Fields) =>
  [f.subject, f.text].every((text) => text.trim() === "") &&
  f.to.length + f.cc.length + f.bcc.length === 0;

function problemText(
  { status, reason }: Pick<ComposeResult, "status" | "reason">,
  sending: boolean,
): string {
  if (status === "reconnect") return t`Gmail needs to be reconnected.`;
  if (status === "disabled") return t`Sending is turned off.`;
  if (status === "unknown") return t`Not confirmed as sent. Check Sent before trying again.`;
  if (reason === "rejected") return t`Gmail didn't accept it. Check the addresses.`;
  if (reason === "rate_limited") return t`Gmail is limiting requests. Try again in a minute.`;
  return sending ? t`Gmail didn't respond. Try again.` : t`Couldn't save the draft`;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-9 items-start gap-2 border-b border-border py-1">
      <span aria-hidden="true" className="w-12 shrink-0 text-sm leading-7 text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

/** More recipients than this fold into one summary line while the recipient rows are not in use. */
const COLLAPSE_OVER = 3;

/** Not-sent wording for a failed send; "unknown" already says so and warns about a repeat. */
const notSent = (text: string, status?: ComposeResult["status"]) =>
  status === "unknown" ? text : t`Not sent. ${text}`;

/** The recipients as one line (a few names and "+N more"); focusing it opens the rows. */
function RecipientSummary({ entries, onOpen }: { entries: string[]; onOpen: () => void }) {
  const { recipients, more } = summarizeRecipients(entries);
  return (
    <button
      type="button"
      onFocus={onOpen}
      className="flex h-7 min-w-0 flex-1 items-center gap-1 rounded-sm text-start text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <span className="truncate" dir="auto">
        {recipients.map((recipient, index) => (
          <span key={recipient.entry} className={cn(!recipient.valid && "text-destructive")}>
            {recipient.name || recipient.address}
            {index < recipients.length - 1 || more > 0 ? ", " : ""}
          </span>
        ))}
      </span>
      {more > 0 ? <span className="shrink-0 text-muted-foreground">{t`+${more} more`}</span> : null}
    </button>
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
  seed: seedProp,
  accounts,
  connectionId,
  restore: restoreProp,
  draft,
  spaceId,
  onClose,
}: {
  seed: ComposeSeed;
  /** The From choices for a new message; with more than one, a picker shows. */
  accounts: Accounts;
  /** The account a new message starts from. */
  connectionId?: string;
  /** Opens again as it was left (after Undo or a failed send) instead of loading the seed. */
  restore?: ComposeRestore;
  /** Text for a reply to start with, above the quoted original: a draft the email's agent wrote. */
  draft?: string;
  /** The Space the composer belongs to; save, send and discard stay in it if the shared selection moves. */
  spaceId?: string | null;
  onClose: () => void;
}) {
  const spaceContext = useMemo(
    () => (spaceId === undefined ? {} : { context: { spaceId } }),
    [spaceId],
  );
  // Reply, reply all and forward continue the composer closed last time for the same message.
  const [recalled] = useState(() => restoreProp ?? recallClosed(seedProp));
  // A reply typed under Reply comes back under Reply all too, but with the recipients of the button
  // pressed: the text carries over and the prefill fills To and Cc again.
  const [carried] = useState(() =>
    !restoreProp && recalled && seedProp.kind !== "new" && recalled.seed.kind !== seedProp.kind
      ? recalled
      : undefined,
  );
  const restore = carried ? undefined : recalled;
  const seed = restore?.seed ?? seedProp;
  const [clientId] = useState(() => recalled?.clientId ?? newClientId());
  const initial: Fields = restore?.fields ?? {
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
  const replyToRef = useRef<string | undefined>(restore?.replyToId);
  // HTML waiting to go into the editor once it exists.
  const pendingContent = useRef<string | null>(
    restore ? restore.fields.html || textToHtml(restore.fields.text) : null,
  );
  const [loading, setLoading] = useState(seed.kind !== "new" && !restore);
  const [showCc, setShowCc] = useState(Boolean(restore?.fields.cc.length));
  const [showBcc, setShowBcc] = useState(Boolean(restore?.fields.bcc.length));
  const [reveal, setReveal] = useState<"to" | "cc" | "bcc" | null>(null);
  // The recipient rows are open while focus is inside them; otherwise many recipients fold up.
  const [expanded, setExpanded] = useState(false);
  const recipientsRef = useRef<HTMLDivElement>(null);
  const [showFormat, setShowFormat] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [forwarded, setForwarded] = useState<Forwarded[]>(restore?.forwarded ?? []);
  // Named for as long as the composer is open, so autosave's "Draft saved" never hides it.
  const [leftOut, setLeftOut] = useState(restore?.leftOut ?? []);
  // Display only: the warning masks amounts in file names when they are hidden.
  useHideAmounts();
  const leftOutNames = maskCurrencyWhenHidden(leftOut.map((file) => file.filename).join(", "));
  const [files, setFiles] = useState<File[]>(recalled?.files ?? []);
  const [dragging, setDragging] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [prefillAttempt, setPrefillAttempt] = useState(0);
  const [prefillFailed, setPrefillFailed] = useState(false);
  const [quoteMissing, setQuoteMissing] = useState(false);
  const [skipped, setSkipped] = useState("");
  // A reply or forward goes from the account the original came to, which the prefill names.
  const [sentFrom, setSentFrom] = useState<Account | undefined>(
    () =>
      recalled?.accounts.find((a) => a.connectionId === recalled.fields.connectionId) ??
      accounts.find((a) => a.connectionId === initial.connectionId),
  );
  const [notice, setNotice] = useState<Notice | null>(
    restore?.notice ? { kind: "error", text: restore.notice } : null,
  );
  // Set once the person edits; an untouched reply is not worth keeping. A draft opened under the
  // other reply button counts once it is edited, so a glance leaves it as it was written.
  const touched = useRef(Boolean(recalled) && !carried);
  // A Gmail draft may exist once a save has succeeded.
  const saved = useRef(recalled?.saved ?? false);
  const done = useRef(false);
  const toRef = useRef<HTMLInputElement>(null);
  const ccRef = useRef<HTMLInputElement>(null);
  const bccRef = useRef<HTMLInputElement>(null);
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
          const result = await rpc.inbox.compose.draftSave(value, spaceContext);
          const { status } = result;
          if (status === "saved") {
            saved.current = true;
            setNotice({ kind: "saved", text: t`Draft saved` });
          } else if (status !== "sent") {
            setNotice({ kind: "error", text: problemText(result, false) });
          }
        } catch {
          setNotice({ kind: "error", text: t`Couldn't save the draft` });
        }
      }, AUTOSAVE_MS),
    [],
  );

  // The missing quote stays visible through autosave; other errors take the slot while they last.
  const shownNotice: Notice | null =
    quoteMissing && notice?.kind !== "error"
      ? { kind: "error", text: t`The original message didn't load.` }
      : notice;

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
    onChange: ({ html, text }) => {
      // Only a change to the text is an edit; the editor also reports seeding and normalizing.
      if (html !== fieldsRef.current.html || text !== fieldsRef.current.text)
        update({ html, text });
    },
    onLinkShortcut: () => {
      // The link field opens from its button in the formatting bar.
      setShowFormat(true);
      setLinkOpen(true);
    },
  });

  useEffect(() => {
    if (!reveal) return;
    (reveal === "to" ? toRef : reveal === "cc" ? ccRef : bccRef).current?.focus();
    setReveal(null);
  }, [reveal]);

  useEffect(() => {
    if (seed.kind === "new" || restore) return;
    let live = true;
    setPrefillFailed(false);
    setQuoteMissing(false);
    setNotice(null);
    rpc.inbox.compose
      .prefill({ messageId: seed.messageId, mode: seed.kind, ...clientLocale() })
      .then((prefilled) => {
        if (!live) return;
        const next = draft ? { ...prefilled, body: `${draft}${prefilled.body}` } : prefilled;
        replyToRef.current = next.replyToMessageId;
        if (next.account) setSentFrom(next.account);
        pendingContent.current = carried
          ? carried.fields.html || textToHtml(carried.fields.text)
          : prefillHtml(next);
        // An older server sends no attachment list.
        setForwarded(next.attachments ?? []);
        // The server filled To and Subject from its cached copy. The form is usable, so no retry that would overwrite edits.
        setLeftOut(next.attachmentsLeftOut ?? []);
        if (next.quoteUnavailable) setQuoteMissing(true);
        // An older server says only that something was too large.
        else if (next.attachmentsTooLarge && !next.attachmentsLeftOut)
          setNotice({
            kind: "error",
            text: t`Attachments can't be over ${MAX_COMPOSE_ATTACHMENT_MB} MB.`,
          });
        const loaded: Fields = {
          connectionId: next.connectionId,
          to: takeEntries(next.to, [], true).added,
          cc: takeEntries(next.cc, [], true).added,
          bcc: [],
          subject: carried?.fields.subject ?? next.subject,
          html: carried?.fields.html ?? "",
          text: carried?.fields.text ?? next.body,
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
  }, [seed, restore, prefillAttempt, draft]);

  // Fill the editor with the quoted original (or the restored message) once both it and the editor
  // exist. A reply starts above the quote; a forward starts at its empty To.
  useEffect(() => {
    if (loading || !editor || pendingContent.current === null) return;
    editor.commands.setContent(pendingContent.current, { emitUpdate: false });
    pendingContent.current = null;
    fieldsRef.current = {
      ...fieldsRef.current,
      html: editor.isEmpty ? "" : editor.getHTML(),
      text: editor.getText({ blockSeparator: "\n" }),
    };
    setFields(fieldsRef.current);
    if (recalled) focusRestored(editor, seed.kind === "reply" || seed.kind === "replyAll");
    else if (seed.kind === "forward") {
      // Focus starts at To; tabbing down lands above the forwarded block.
      editor.commands.setTextSelection(1);
      toRef.current?.focus({ preventScroll: true });
    } else editor.commands.focus("start", { scrollIntoView: false });
  }, [loading, editor, seed.kind, recalled]);

  // Closing the page or the message view keeps what was typed.
  useEffect(
    () => () => {
      if (!done.current) void saver.flush();
    },
    [saver],
  );

  /** Everything in the composer, so it can open again as it is now. */
  const snapshot = (kept: File[], hasDraft: boolean): ComposeRestore => ({
    seed,
    clientId,
    fields: fieldsRef.current,
    ...(replyToRef.current ? { replyToId: replyToRef.current } : {}),
    forwarded,
    leftOut,
    files: kept,
    saved: hasDraft,
    // A reply has no picker, so it keeps the one account it is sent from.
    accounts: accounts.length > 0 ? accounts : sentFrom ? [sentFrom] : [],
  });

  /** Drops the Gmail draft, if one was saved, once any save in flight has finished. */
  const dropDraft = () =>
    saver
      .flush()
      .then(() =>
        saved.current ? rpc.inbox.compose.discard({ clientId }, spaceContext) : undefined,
      );

  const discardNow = () => {
    done.current = true;
    saver.cancel();
    forgetClosed(seed);
    void dropDraft().catch(() => undefined);
    onClose();
  };

  /** The Discard button: with something written, the draft goes after an Undo window. */
  const discard = () => {
    if (isBlank(fieldsRef.current) && files.length === 0) return discardNow();
    done.current = true;
    saver.cancel();
    forgetClosed(seed);
    onClose();
    // A save still in flight may have made the draft; the server accepts a discard of none.
    void saver.flush().then(() => holdDiscard(dropDraft, snapshot(files, true)));
  };

  const closeNow = () => {
    if (carried && !touched.current) {
      // Opened under the other button and left alone: the draft stays in the mode it was written in.
      done.current = true;
      saver.cancel();
      onClose();
    } else if (!touched.current || (isBlank(fieldsRef.current) && files.length === 0)) discardNow();
    else {
      // Closing saves a draft; attachments are not part of it, so they are not kept.
      rememberClosed(seed, snapshot([], true));
      onClose();
    }
  };

  const close = () => {
    if (sending) return;
    // Autosave leaves attachments out, so closing would lose them: ask first.
    if (files.length > 0) setConfirmClose(true);
    else closeNow();
  };

  const addFiles = (incoming: File[]) => {
    if (incoming.length === 0) return;
    let total = [...files, ...forwarded].reduce((sum, file) => sum + file.size, 0);
    const accepted: File[] = [];
    const rejected: File[] = [];
    for (const file of incoming) {
      if (total + file.size > MAX_COMPOSE_ATTACHMENT_BYTES) {
        rejected.push(file);
        continue;
      }
      total += file.size;
      accepted.push(file);
    }
    const [first] = rejected;
    // Shown under the attachment chips, where the file would have appeared.
    setSkipped(
      first
        ? rejected.length === 1
          ? t`${first.name} (${formatBytes(first.size)}) was not added. Attachments can be up to ${MAX_COMPOSE_ATTACHMENT_MB} MB in total.`
          : t`${rejected.length} files were not added. Attachments can be up to ${MAX_COMPOSE_ATTACHMENT_MB} MB in total.`
        : "",
    );
    if (accepted.length) {
      touched.current = true;
      setFiles([...files, ...accepted]);
    }
  };

  const send = async () => {
    if (sending || loading) return;
    const current = fieldsRef.current;
    if (seed.kind === "new" && !current.connectionId) {
      setNotice({ kind: "error", text: t`Choose which account to send from.` });
      return;
    }
    const all = [...current.to, ...current.cc, ...current.bcc];
    if (all.length === 0) {
      setNotice({ kind: "error", text: t`Add a recipient.` });
      return;
    }
    const invalid = invalidRecipients(all);
    if (invalid.length) {
      const [first] = invalid as [(typeof invalid)[number]];
      setNotice({
        kind: "error",
        text:
          invalid.length === 1
            ? invalidAddressText(first.address)
            : t`Fix or remove the highlighted addresses.`,
      });
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
      const request = {
        ...payload(current),
        ...(attachments.length ? { attachments } : {}),
        ...(forwarded.length && seed.kind === "forward"
          ? { forwardOf: { messageId: seed.messageId, attachmentIds: forwarded.map((f) => f.id) } }
          : {}),
      };
      const reopen = snapshot(files, saved.current);
      // Held for a few seconds so Undo can bring this composer back; a failure does too.
      holdSend(async () => {
        try {
          const result = await rpc.inbox.compose.send(request, spaceContext);
          if (result.status === "sent") {
            announceComposerSent({
              connectionId: request.connectionId,
              subject: request.subject,
              to: request.to,
            });
            return null;
          }
          return notSent(problemText(result, true), result.status);
        } catch (cause) {
          return notSent(errorText(cause));
        }
      }, reopen);
      done.current = true;
      forgetClosed(seed);
      onClose();
      return;
    } catch (cause) {
      setNotice({ kind: "error", text: errorText(cause) });
    }
    setSending(false);
  };

  // A reply or forward hides its quoted original until asked; it is still sent.
  const collapsed =
    (seed.kind === "reply" || seed.kind === "replyAll") &&
    !quoteOpen &&
    fields.html.includes("<blockquote");

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
          {seed.kind === "new" &&
          (accounts.length > 1 || (accounts.length > 0 && !fields.connectionId)) ? (
            <Row label={t`From`}>
              <NativeSelect
                size="sm"
                className="min-w-0 flex-1"
                value={fields.connectionId}
                disabled={locked}
                aria-label={t`From`}
                onChange={(event) => update({ connectionId: event.target.value })}
              >
                {fields.connectionId ? null : <NativeSelectOption value="" disabled />}
                {accounts.map((account) => (
                  <NativeSelectOption key={account.connectionId} value={account.connectionId}>
                    {accountText(account)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Row>
          ) : sentFrom ? (
            <Row label={t`From`}>
              <span dir="auto" className="min-w-0 flex-1 truncate text-sm leading-7">
                {accountText(sentFrom)}
              </span>
            </Row>
          ) : null}
          {/* biome-ignore lint/a11y/noStaticElementInteractions: the handlers only track whether focus is inside */}
          <div
            ref={recipientsRef}
            className="max-h-[30dvh] overflow-y-auto"
            onFocus={() => setExpanded(true)}
            onBlur={() =>
              // Wait for focus to land: moving between the rows is not leaving them.
              setTimeout(() => {
                if (!recipientsRef.current?.contains(document.activeElement)) setExpanded(false);
              }, 0)
            }
          >
            {!expanded &&
            fields.to.length + fields.cc.length + fields.bcc.length > COLLAPSE_OVER ? (
              <Row label={t`To`}>
                <RecipientSummary
                  entries={[...fields.to, ...fields.cc, ...fields.bcc]}
                  onOpen={() => setReveal("to")}
                />
              </Row>
            ) : (
              <>
                <Row label={t`To`}>
                  <RecipientField
                    label={t`To`}
                    inputRef={toRef}
                    entries={fields.to}
                    disabled={locked}
                    onChange={(to) => update({ to })}
                    trailing={
                      <>
                        {!showCc ? (
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => {
                              setShowCc(true);
                              setReveal("cc");
                            }}
                          >
                            <Trans>Cc</Trans>
                          </Button>
                        ) : null}
                        {!showBcc ? (
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => {
                              setShowBcc(true);
                              setReveal("bcc");
                            }}
                          >
                            <Trans>Bcc</Trans>
                          </Button>
                        ) : null}
                      </>
                    }
                  />
                </Row>
                {showCc ? (
                  <Row label={t`Cc`}>
                    <RecipientField
                      label={t`Cc`}
                      inputRef={ccRef}
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
                      inputRef={bccRef}
                      entries={fields.bcc}
                      disabled={locked}
                      onChange={(bcc) => update({ bcc })}
                    />
                  </Row>
                ) : null}
              </>
            )}
          </div>
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
          {loading && !prefillFailed ? (
            <p role="status" className="px-4 pt-3 text-sm text-muted-foreground">
              <Trans>Preparing draft…</Trans>
            </p>
          ) : null}
          <div
            data-collapsed={collapsed}
            className="data-[collapsed=true]:[&_blockquote]:hidden data-[collapsed=true]:[&_p:has(+blockquote)]:hidden data-[collapsed=true]:[&_blockquote+p:last-child:has(>br:only-child)]:hidden data-[collapsed=true]:[&_[contenteditable]]:pb-0"
          >
            <EditorContent editor={editor} />
          </div>
          {collapsed ? (
            <Button
              variant="secondary"
              size="xs"
              className="mx-4 mb-3 rounded-full text-muted-foreground"
              onClick={() => setQuoteOpen(true)}
            >
              <Trans>Show original message</Trans>
            </Button>
          ) : null}
        </div>

        {leftOut.length ? (
          <p
            role="status"
            data-testid="compose-left-out"
            className="shrink-0 border-t border-border px-4 py-2 text-xs text-destructive"
          >
            {t`Not attached, over the ${MAX_COMPOSE_ATTACHMENT_MB} MB limit: ${leftOutNames}. Download it from the original to share it another way.`}
          </p>
        ) : null}
        {files.length + forwarded.length ? (
          <ul
            aria-label={t`Attachments`}
            className="flex max-h-33 shrink-0 flex-wrap gap-1.5 overflow-y-auto overscroll-contain border-t border-border px-4 py-2"
          >
            {forwarded.map((file) => (
              <li
                key={file.id}
                className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-lg border border-border ps-2 pe-0.5 text-xs"
              >
                <Paperclip aria-hidden="true" className="size-3 shrink-0 text-muted-foreground" />
                <span className="truncate" dir="auto">
                  {file.filename}
                </span>
                <span className="shrink-0 text-muted-foreground">{formatBytes(file.size)}</span>
                <button
                  type="button"
                  disabled={sending}
                  aria-label={t`Remove ${file.filename}`}
                  className="inline-flex size-5 shrink-0 items-center justify-center rounded-full hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none pointer-coarse:size-8"
                  onClick={() => setForwarded(forwarded.filter((other) => other.id !== file.id))}
                >
                  <X aria-hidden="true" className="size-3" />
                </button>
              </li>
            ))}
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
                  className="inline-flex size-5 shrink-0 items-center justify-center rounded-full hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none pointer-coarse:size-8"
                  onClick={() => setFiles(files.filter((_, i) => i !== index))}
                >
                  <X aria-hidden="true" className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {skipped ? (
          <p
            role="alert"
            className={cn(
              "shrink-0 px-4 pb-2 text-xs text-destructive",
              files.length + forwarded.length ? "" : "border-t border-border pt-2",
            )}
          >
            {skipped}
          </p>
        ) : null}

        {showFormat ? (
          <FormatBar
            editor={editor}
            disabled={locked}
            linkOpen={linkOpen}
            onLinkOpenChange={setLinkOpen}
          />
        ) : null}

        <div className="flex shrink-0 flex-wrap items-center gap-1 px-3 py-2">
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
            role={shownNotice?.kind === "error" ? "alert" : "status"}
            title={shownNotice?.text}
            className={cn(
              "min-w-0 flex-1 px-2 text-end text-xs md:truncate max-md:order-first max-md:basis-full max-md:pb-1 max-md:text-start max-md:empty:hidden",
              shownNotice?.kind === "error" ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {shownNotice?.text}
          </p>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="pointer-coarse:size-10"
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
              {isBlank(fields) ? <Trans>Discard draft?</Trans> : <Trans>Remove attachments?</Trans>}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isBlank(fields) ? (
                <Trans>Attachments are not kept.</Trans>
              ) : (
                <Trans>Your text is saved as a draft. Attachments are not kept.</Trans>
              )}
            </AlertDialogDescription>
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
                <Trans>Close and remove</Trans>
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
