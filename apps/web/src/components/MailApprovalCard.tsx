import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { MailApproval, MailEdits } from "@rakazo/contracts";
import {
  Badge,
  Button,
  cn,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Textarea,
} from "@rakazo/ui-web";
import { ChevronDown } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { parseRecipient, splitEntries } from "../lib/recipients";
import { errorText } from "../lib/user-error";
import { invalidAddressText } from "./compose/RecipientField";

type Fields = { to: string; cc: string; bcc: string; subject: string; body: string };

const toFields = (mail: MailApproval): Fields => ({
  to: mail.to.join(", "),
  cc: mail.cc.join(", "),
  bcc: mail.bcc.join(", "),
  subject: mail.subject,
  body: mail.body,
});

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-9 items-start gap-2 px-3 py-1">
      <span aria-hidden="true" className="w-12 shrink-0 text-sm leading-7 text-muted-foreground">
        {label}
      </span>
      <div className="min-w-0 flex-1 break-words text-sm leading-7 text-foreground">{children}</div>
    </div>
  );
}

/**
 * The approval card for a mail_draft or mail_send call. Send approves the same pending call, with
 * the fields the person changed; Discard denies it. The server checks the edits again.
 */
export function MailApprovalCard({
  mail,
  status,
  answer,
  canAnswer,
  botName,
  onAnswer,
  onDisableTool,
  onOpenComposer,
}: {
  mail: MailApproval;
  status: "pending" | "answered";
  answer?: string;
  canAnswer: boolean;
  /** Set when the person can change this bot's tools. */
  botName?: string;
  onAnswer: (text: string, username?: string, mail?: MailEdits) => Promise<void>;
  onDisableTool?: (tool: MailApproval["tool"]) => Promise<void>;
  /** Offered when the person's own edited send did not go out. */
  onOpenComposer?: (mail: MailApproval) => void;
}) {
  const initial = toFields(mail);
  const [fields, setFields] = useState<Fields>(initial);
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const answered = status === "answered";
  const interactive = !answered && canAnswer;
  const busy = pendingAction !== null;
  const draft = mail.tool === "mail_draft";
  const shown = answered ? initial : fields;

  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (body && !expanded) setOverflows(body.scrollHeight > body.clientHeight + 1);
  }, [expanded, shown.body, editing]);

  const set = (key: keyof Fields) => (value: string) => setFields((f) => ({ ...f, [key]: value }));

  async function submit(action: "allow" | "deny" | "disable") {
    if (busy) return;
    let edits: MailEdits | undefined;
    if (action === "allow") {
      const changed = (Object.keys(fields) as (keyof Fields)[]).filter(
        (key) => fields[key] !== initial[key],
      );
      if (changed.length) edits = Object.fromEntries(changed.map((key) => [key, fields[key]]));
      const recipients = [fields.to, fields.cc, fields.bcc].flatMap((text) =>
        splitEntries(text)
          .map((entry) => entry.trim())
          .filter(Boolean)
          .map(parseRecipient),
      );
      const invalid = recipients.find((recipient) => !recipient.valid);
      if (invalid) return setError(invalidAddressText(invalid.address));
      if (!draft && recipients.length === 0) return setError(t`Add a recipient.`);
    }
    setPendingAction(action);
    setError(null);
    try {
      if (action === "disable") await onDisableTool?.(mail.tool);
      await onAnswer(action === "allow" ? "allow" : "deny", undefined, edits);
      setEditing(false);
    } catch (err) {
      setError(errorText(err, t`Could not submit this answer`));
    } finally {
      setPendingAction(null);
    }
  }

  const recipientRows = (
    [
      ["To", t`To`, shown.to, true],
      ["Cc", t`Cc`, shown.cc, false],
      ["Bcc", t`Bcc`, shown.bcc, false],
    ] as const
  ).filter(([, , value, always]) => always || value.trim() || (editing && interactive));

  return (
    <div
      data-testid="mail-approval-card"
      data-editing={editing || undefined}
      className={cn(
        "w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card",
        editing && "ring-2 ring-primary",
      )}
    >
      <div className="flex min-h-12 items-center justify-between gap-2 px-4 py-2">
        <h3 className="text-[15px] font-medium text-foreground">
          {mail.reply ? <Trans>Reply</Trans> : <Trans>New email</Trans>}
        </h3>
        {answered ? (
          <Badge variant="secondary">
            {mail.outcome === "sent" ? (
              <Trans>Sent</Trans>
            ) : mail.outcome === "saved" ? (
              <Trans>Draft saved</Trans>
            ) : mail.outcome === "failed" ? (
              <Trans>Not sent</Trans>
            ) : mail.outcome === "unknown" ? (
              <Trans>Unknown</Trans>
            ) : answer === "deny" && mail.connectionId ? (
              draft ? (
                <Trans>Saving…</Trans>
              ) : (
                <Trans>Sending…</Trans>
              )
            ) : answer === "deny" ? (
              <Trans>Discarded</Trans>
            ) : (
              <Trans>Approved</Trans>
            )}
          </Badge>
        ) : !canAnswer ? (
          <Badge variant="secondary">
            <Trans>No longer active</Trans>
          </Badge>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            aria-pressed={editing}
            onClick={() => setEditing((value) => !value)}
          >
            {editing ? <Trans>Done</Trans> : <Trans>Edit</Trans>}
          </Button>
        )}
      </div>
      <div
        className={cn(
          "mx-4 divide-y divide-border rounded-lg border border-border",
          editing && "bg-muted",
        )}
      >
        {mail.account ? (
          <Row label={t`From`}>
            <span className="text-muted-foreground">{mail.account}</span>
          </Row>
        ) : null}
        {recipientRows.map(([key, label, value]) => (
          <Row key={key} label={label}>
            {editing ? (
              <Input
                aria-label={label}
                className="h-7 bg-background"
                disabled={busy}
                value={fields[key.toLowerCase() as "to" | "cc" | "bcc"]}
                onChange={(event) =>
                  set(key.toLowerCase() as "to" | "cc" | "bcc")(event.target.value)
                }
              />
            ) : (
              value
            )}
          </Row>
        ))}
        <Row label={t`Subject`}>
          {editing ? (
            <Input
              aria-label={t`Subject`}
              className="h-7 bg-background"
              disabled={busy}
              value={fields.subject}
              onChange={(event) => set("subject")(event.target.value)}
            />
          ) : (
            shown.subject
          )}
        </Row>
      </div>
      <div className="px-4 pt-3">
        {editing ? (
          <Textarea
            aria-label={t`Message`}
            className="min-h-32 bg-background text-sm leading-6"
            disabled={busy}
            value={fields.body}
            onChange={(event) => set("body")(event.target.value)}
          />
        ) : (
          <>
            <div className="relative">
              <div
                ref={bodyRef}
                data-testid="mail-approval-body"
                className={cn(
                  "whitespace-pre-wrap break-words text-sm leading-6 text-foreground",
                  !expanded && "max-h-36 overflow-hidden",
                )}
              >
                {shown.body}
              </div>
              {overflows && !expanded ? (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-card to-transparent" />
              ) : null}
            </div>
            {overflows || expanded ? (
              <Button
                variant="link"
                size="sm"
                className="px-0"
                aria-expanded={expanded}
                onClick={() => setExpanded((value) => !value)}
              >
                {expanded ? <Trans>Show less</Trans> : <Trans>Show more</Trans>}
                <ChevronDown
                  aria-hidden="true"
                  className={cn("transition-transform", expanded && "rotate-180")}
                />
              </Button>
            ) : null}
          </>
        )}
      </div>
      {interactive ? (
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <div className="flex gap-2">
            <Button disabled={busy} onClick={() => void submit("allow")}>
              {pendingAction === "allow" ? (
                draft ? (
                  <Trans>Saving…</Trans>
                ) : (
                  <Trans>Sending…</Trans>
                )
              ) : draft ? (
                <Trans>Save draft</Trans>
              ) : (
                <Trans>Send</Trans>
              )}
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => void submit("deny")}>
              <Trans>Discard</Trans>
            </Button>
          </div>
          {botName && onDisableTool ? (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="sm" disabled={busy} />}>
                <Trans>Needs approval</Trans>
                <ChevronDown aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuCheckboxItem checked onCheckedChange={() => undefined}>
                  <Trans>Needs approval</Trans>
                </DropdownMenuCheckboxItem>
                <DropdownMenuItem onClick={() => void submit("disable")}>
                  {draft ? t`Disable drafts for ${botName}` : t`Disable sending for ${botName}`}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      ) : (
        <div className="h-3" />
      )}
      {mail.outcome === "unknown" ? (
        <p className="px-4 pb-3 text-[13px] text-muted-foreground">
          <Trans>Not confirmed as sent. Check Sent before trying again.</Trans>
        </p>
      ) : null}
      {mail.outcome === "failed" && onOpenComposer ? (
        <div className="px-4 pb-3">
          <Button variant="outline" size="sm" onClick={() => onOpenComposer(mail)}>
            <Trans>Open in composer</Trans>
          </Button>
        </div>
      ) : null}
      {error ? <p className="px-4 pb-3 text-[13px] text-destructive">{error}</p> : null}
    </div>
  );
}
