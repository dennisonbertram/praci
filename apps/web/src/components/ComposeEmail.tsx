import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { ComposeMode, ComposeResult } from "@rakazo/contracts";
import { MAX_COMPOSE_BODY } from "@rakazo/contracts";
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Input,
  NativeSelect,
  NativeSelectOption,
  Spinner,
  Textarea,
} from "@rakazo/ui-web";
import { useEffect, useMemo, useRef, useState } from "react";
import { createDraftSaver } from "../lib/compose-draft";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";

/** Fired on `window` after a message is sent, so the Inbox can show "Sent" and refresh. */
export const MAIL_SENT_EVENT = "rakazo:mail-sent";

const AUTOSAVE_MS = 1_500;

export type ComposeSeed = { kind: "new" } | { kind: ComposeMode; messageId: string };

/** Pass this one object, not a new literal each render: a changed seed loads the prefill again. */
export const NEW_MESSAGE: ComposeSeed = { kind: "new" };

interface Fields {
  connectionId: string;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
}

type Notice = { kind: "saved" | "error"; text: string };

/** Random enough to name one composer: it is the key that keeps a retried send from sending twice. */
function newClientId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

const isBlank = (f: Fields) =>
  [f.to, f.cc, f.bcc, f.subject, f.body].every((text) => text.trim() === "");

function problemText(status: ComposeResult["status"], sending: boolean): string {
  if (status === "reconnect") return t`Gmail needs to be reconnected.`;
  if (status === "disabled") return t`Sending is turned off.`;
  if (status === "unknown") return t`Not confirmed as sent. Check Sent before trying again.`;
  return sending ? t`Couldn't send. Try again.` : t`Couldn't save the draft`;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-b border-border pb-1">
      <span aria-hidden="true" className="w-14 shrink-0 text-xs text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

const bareInput =
  "h-7 rounded-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent";

/**
 * Writes a new message, or a reply, reply-all or forward of a cached one. The text is plain; the
 * server adds the HTML copy. Typing saves a Gmail draft after a pause. Send is the only
 * confirmation, and a retried or repeated send never sends twice because the server keys it by
 * `clientId`. Closing keeps the draft unless nothing was written.
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
    to: "",
    cc: "",
    bcc: "",
    subject: "",
    body: "",
  };
  const [fields, setFields] = useState(initial);
  const fieldsRef = useRef(initial);
  const replyToRef = useRef<string | undefined>(undefined);
  const [loading, setLoading] = useState(seed.kind !== "new");
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [sending, setSending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  // Set once the person edits; an untouched reply is not worth keeping.
  const touched = useRef(false);
  // A Gmail draft may exist once a save has succeeded.
  const saved = useRef(false);
  const done = useRef(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const toRef = useRef<HTMLInputElement>(null);

  const payload = (f: Fields) => ({
    clientId,
    connectionId: f.connectionId,
    ...(replyToRef.current ? { replyToMessageId: replyToRef.current } : {}),
    to: f.to,
    cc: f.cc,
    bcc: f.bcc,
    subject: f.subject,
    body: f.body,
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

  useEffect(() => {
    if (seed.kind === "new") return;
    let live = true;
    rpc.inbox.compose
      .prefill({ messageId: seed.messageId, mode: seed.kind })
      .then((next) => {
        if (!live) return;
        replyToRef.current = next.replyToMessageId;
        const loaded = {
          connectionId: next.connectionId,
          to: next.to,
          cc: next.cc,
          bcc: "",
          subject: next.subject,
          body: next.body,
        };
        fieldsRef.current = loaded;
        setFields(loaded);
        setShowCc(Boolean(next.cc));
        setLoading(false);
      })
      .catch((cause) => {
        if (!live) return;
        setNotice({ kind: "error", text: errorText(cause) });
      });
    return () => {
      live = false;
    };
  }, [seed]);

  // A reply starts above the quoted original; a forward starts at its empty To.
  useEffect(() => {
    if (loading || seed.kind === "new") return;
    const target = seed.kind === "forward" ? toRef.current : bodyRef.current;
    target?.focus();
    if (target === bodyRef.current) target?.setSelectionRange(0, 0);
  }, [loading, seed.kind]);

  // Closing the page or the message view keeps what was typed.
  useEffect(
    () => () => {
      if (!done.current) void saver.flush();
    },
    [saver],
  );

  const update = (patch: Partial<Fields>) => {
    touched.current = true;
    const next = { ...fieldsRef.current, ...patch };
    fieldsRef.current = next;
    setFields(next);
    if (isBlank(next)) saver.cancel();
    else saver.change(payload(next));
  };

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

  const close = () => {
    if (sending) return;
    if (!touched.current || isBlank(fieldsRef.current)) discard();
    else onClose();
  };

  const send = async () => {
    if (sending || blocked || loading) return;
    setSending(true);
    setNotice(null);
    // An autosave still running would race the send; the send carries the final text itself.
    saver.cancel();
    await saver.flush();
    try {
      const { status } = await rpc.inbox.compose.send(payload(fieldsRef.current));
      if (status === "sent") {
        done.current = true;
        window.dispatchEvent(new Event(MAIL_SENT_EVENT));
        onClose();
        return;
      }
      if (status === "unknown") setBlocked(true);
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
          : t`Compose`;
  const locked = loading || sending;

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent
        initialFocus={seed.kind === "new" ? toRef : undefined}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            void send();
          }
        }}
        className="flex max-h-[92vh] w-[min(680px,94vw)] flex-col gap-3 overflow-y-auto max-w-none max-sm:inset-0 max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-none max-sm:w-screen max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none"
      >
        <DialogTitle className="pe-8">{title}</DialogTitle>
        <div className="flex flex-col gap-1.5">
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
          <Row label={t`To`}>
            <Input
              ref={toRef}
              className={bareInput}
              aria-label={t`To`}
              value={fields.to}
              disabled={locked}
              maxLength={4_000}
              autoComplete="off"
              onChange={(event) => update({ to: event.target.value })}
            />
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
          </Row>
          {showCc ? (
            <Row label={t`Cc`}>
              <Input
                className={bareInput}
                aria-label={t`Cc`}
                value={fields.cc}
                disabled={locked}
                maxLength={4_000}
                autoComplete="off"
                onChange={(event) => update({ cc: event.target.value })}
              />
            </Row>
          ) : null}
          {showBcc ? (
            <Row label={t`Bcc`}>
              <Input
                className={bareInput}
                aria-label={t`Bcc`}
                value={fields.bcc}
                disabled={locked}
                maxLength={4_000}
                autoComplete="off"
                onChange={(event) => update({ bcc: event.target.value })}
              />
            </Row>
          ) : null}
          <Row label={t`Subject`}>
            <Input
              className={bareInput}
              aria-label={t`Subject`}
              value={fields.subject}
              disabled={locked}
              maxLength={998}
              onChange={(event) => update({ subject: event.target.value })}
            />
          </Row>
        </div>
        <Textarea
          ref={bodyRef}
          dir="auto"
          aria-label={t`Message`}
          value={fields.body}
          disabled={locked}
          maxLength={MAX_COMPOSE_BODY}
          onChange={(event) => update({ body: event.target.value })}
          className="max-h-[50vh] min-h-48 resize-none max-sm:max-h-none max-sm:flex-1"
        />
        <div className="flex items-center gap-2">
          <p
            role={notice?.kind === "error" ? "alert" : "status"}
            className={`min-w-0 flex-1 truncate text-xs ${notice?.kind === "error" ? "text-destructive" : "text-muted-foreground"}`}
          >
            {notice?.text}
          </p>
          <Button variant="ghost" disabled={sending} onClick={discard}>
            <Trans>Discard</Trans>
          </Button>
          <Button disabled={locked || blocked} aria-busy={sending} onClick={() => void send()}>
            {sending ? <Spinner aria-hidden="true" role="presentation" /> : null}
            <Trans>Send</Trans>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
