import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { MailAccountSummary, MailApproval, MailEdits } from "@rakazo/contracts";
import { isClosedApprovalAnswer } from "@rakazo/core";
import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  NativeSelect,
  NativeSelectOption,
  Textarea,
} from "@rakazo/ui-web";
import { ChevronDown, ChevronsUpDown, Mail, MoreHorizontal } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
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

function Row({
  label,
  hideLabel = false,
  children,
}: {
  label: string;
  /** The row's field has its own accessible name, so the visible label is not read twice. */
  hideLabel?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col border-b border-border py-2 @sm:flex-row @sm:items-start @sm:gap-2.5">
      <span
        aria-hidden={hideLabel || undefined}
        className="shrink-0 text-xs leading-5 text-muted-foreground @sm:w-11 @sm:text-sm @sm:leading-7"
      >
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
  initialEditing = false,
  allowLabel,
  allowDisabled = false,
  onFieldsChange,
  toOnly = false,
  accounts = [],
  accountsStatus = "ready",
  onRetryAccounts,
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
  initialEditing?: boolean;
  allowLabel?: string;
  allowDisabled?: boolean;
  onFieldsChange?: (fields: Required<Omit<MailEdits, "account">>) => void;
  toOnly?: boolean;
  /** The person's connected mail accounts; with more than one, the card lets them pick the sender. */
  accounts?: readonly MailAccountSummary[];
  /** Until the accounts are known, a send that names no sender cannot go out. */
  accountsStatus?: "loading" | "error" | "ready";
  onRetryAccounts?: () => void;
}) {
  const initial = toFields(mail);
  const [fields, setFields] = useState<Fields>(initial);
  const [account, setAccount] = useState("");
  const [editing, setEditing] = useState(initialEditing);
  const outcomeNeedsAttention = mail.outcome === "failed" || mail.outcome === "unknown";
  const [open, setOpen] = useState(status !== "answered" || outcomeNeedsAttention);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [disabledNotice, setDisabledNotice] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const askedToDisable = useRef(false);
  const confirmId = useId();
  const ownAnswer = useRef(false);
  const answered = status === "answered";
  const interactive = !answered && canAnswer;
  const busy = pendingAction !== null;
  const draft = mail.tool === "mail_draft";
  // A send of a saved draft: the agent named only the draft, so there is nothing to edit or show.
  const savedDraftSend = !draft && Boolean(mail.locked);
  const shown = answered ? initial : fields;
  // With no sender named, the send waits for the accounts, and for a pick when there are several.
  const senderOpen = interactive && !mail.account && !mail.locked;
  const chooseAccount = senderOpen && accountsStatus === "ready" && accounts.length > 1;
  const needsAccount =
    senderOpen && (accountsStatus !== "ready" || (accounts.length > 1 && !account));

  // A finished card folds up to its header, unless the person still has something to do with it.
  useEffect(() => {
    if (answered) setOpen(outcomeNeedsAttention);
  }, [answered, outcomeNeedsAttention]);

  // Answering from this card removes the button that had focus; keep it on the card's header.
  useEffect(() => {
    if (!answered || !ownAnswer.current) return;
    ownAnswer.current = false;
    const active = document.activeElement;
    if (!active || active === document.body || cardRef.current?.contains(active)) {
      toggleRef.current?.focus();
    }
  }, [answered]);

  // The confirmation replaces the menu that opened it: focus the safe choice, and put focus back on
  // "More" when it closes (after a successful answer the card's header takes focus instead).
  useEffect(() => {
    if (confirmDisable) {
      askedToDisable.current = true;
      cancelRef.current?.focus();
    } else if (askedToDisable.current) {
      askedToDisable.current = false;
      moreRef.current?.focus();
    }
  }, [confirmDisable]);

  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (body && !expanded) setOverflows(body.scrollHeight > body.clientHeight + 1);
  }, [expanded, shown.body, editing]);

  const set = (key: keyof Fields) => (value: string) => {
    const next = { ...fields, [key]: value };
    setFields(next);
    onFieldsChange?.(next);
  };

  async function submit(action: "allow" | "deny" | "disable") {
    if (busy || (action === "allow" && (allowDisabled || needsAccount))) return;
    let edits: MailEdits | undefined;
    if (action === "allow") {
      const changed = (Object.keys(fields) as (keyof Fields)[]).filter(
        (key) => fields[key] !== initial[key],
      );
      if (changed.length) edits = Object.fromEntries(changed.map((key) => [key, fields[key]]));
      if (chooseAccount) edits = { ...edits, account };
      const recipients = [fields.to, fields.cc, fields.bcc].flatMap((text) =>
        splitEntries(text)
          .map((entry) => entry.trim())
          .filter(Boolean)
          .map(parseRecipient),
      );
      const invalid = recipients.find((recipient) => !recipient.valid);
      if (invalid) return setError(invalidAddressText(invalid.address));
      if (!draft && !savedDraftSend && recipients.length === 0)
        return setError(t`Add a recipient.`);
    }
    setPendingAction(action);
    setError(null);
    ownAnswer.current = true;
    try {
      if (action === "disable") {
        await onDisableTool?.(mail.tool);
        setDisabledNotice(true);
      }
      await onAnswer(action === "allow" ? "allow" : "deny", undefined, edits);
      setEditing(false);
      setConfirmDisable(false);
    } catch (err) {
      ownAnswer.current = false;
      setConfirmDisable(false);
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
  ).filter(
    ([key, , value, always]) =>
      (!toOnly || key === "To") &&
      ((always && !savedDraftSend) || value.trim() || (editing && interactive)),
  );

  const firstRecipient = mail.to[0] ? parseRecipient(mail.to[0]).address : "";
  const statusText = answered ? (
    // One final word whoever sent it: the agent after Send, or the person after editing.
    mail.outcome === "sent" ? (
      <Trans>Sent</Trans>
    ) : mail.outcome === "saved" ? (
      <Trans>Draft saved</Trans>
    ) : mail.outcome === "failed" ? (
      draft ? (
        <Trans>Draft not saved</Trans>
      ) : (
        <Trans>Not sent</Trans>
      )
    ) : mail.outcome === "unknown" ? (
      <Trans>Unknown</Trans>
    ) : isClosedApprovalAnswer(answer) ? (
      // The server closed this card (replaced by a newer one, or its run failed): never sent.
      <Trans>Not sent</Trans>
    ) : answer === "deny" && mail.connectionId ? (
      draft ? (
        <Trans>Saving…</Trans>
      ) : (
        <Trans>Sending…</Trans>
      )
    ) : answer === "deny" ? (
      <Trans>Discarded</Trans>
    ) : draft ? (
      // Approved: the agent is saving or sending it now, and the card changes when that ends.
      <Trans>Saving…</Trans>
    ) : (
      <Trans>Sending…</Trans>
    )
  ) : canAnswer ? (
    <Trans>Needs approval</Trans>
  ) : (
    <Trans>Not waiting for approval</Trans>
  );
  const headerText = (
    <span className="min-w-0 flex-1 text-start text-[15px]">
      <span className="flex min-w-0 gap-1">
        <span className="shrink-0 font-medium text-foreground">
          <Trans>Mail</Trans>
        </span>{" "}
        <span className="shrink-0 text-muted-foreground">{statusText}</span>
        {firstRecipient && !open ? (
          <span className="min-w-0 truncate text-muted-foreground"> · {firstRecipient}</span>
        ) : null}
      </span>
      {answered && !open && mail.subject ? (
        <span className="block truncate text-sm text-muted-foreground">{mail.subject}</span>
      ) : null}
    </span>
  );
  const tile = (
    <span
      className={cn(
        "flex size-[30px] shrink-0 items-center justify-center rounded-lg bg-card text-foreground",
        interactive && "hidden @sm:flex",
      )}
    >
      <Mail aria-hidden="true" className="size-4" />
    </span>
  );

  return (
    <div
      ref={cardRef}
      data-testid="mail-approval-card"
      data-editing={editing || undefined}
      className={cn(
        "@container w-160 max-w-full overflow-hidden rounded-3xl bg-muted",
        editing ? "ring-2 ring-primary" : interactive && "ring-1 ring-inset ring-border",
      )}
    >
      <div className="flex items-center gap-3 px-5 py-3.5">
        {answered ? (
          <button
            ref={toggleRef}
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="flex min-w-0 flex-1 items-center gap-3 text-start"
          >
            {tile}
            {headerText}
            <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          </button>
        ) : (
          <>
            {tile}
            {headerText}
            {interactive && !mail.locked ? (
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full"
                disabled={busy}
                aria-pressed={editing}
                onClick={() => setEditing((value) => !value)}
              >
                {editing ? <Trans>Done</Trans> : <Trans>Edit</Trans>}
              </Button>
            ) : null}
          </>
        )}
      </div>
      {open ? (
        <div className="px-5 pb-5 @sm:px-6">
          <div className={cn("mt-1.5 mb-3", !shown.subject && !editing && "hidden")}>
            {editing ? (
              <Input
                aria-label={t`Subject`}
                className="h-8 w-full border-muted-foreground/40 bg-background text-base font-semibold"
                disabled={busy}
                value={fields.subject}
                onChange={(event) => set("subject")(event.target.value)}
              />
            ) : (
              <h3 className="break-words text-base font-semibold text-foreground">
                {shown.subject}
              </h3>
            )}
          </div>
          <div>
            {chooseAccount ? (
              <Row label={t`From`} hideLabel>
                <NativeSelect
                  aria-label={t`From`}
                  className="h-7 w-full"
                  disabled={busy}
                  value={account}
                  onChange={(event) => setAccount(event.target.value)}
                >
                  {account ? null : (
                    <NativeSelectOption value="">
                      <Trans>Choose an account</Trans>
                    </NativeSelectOption>
                  )}
                  {accounts.map((value) => (
                    <NativeSelectOption key={value.connectionId} value={value.connectionId}>
                      {value.address ?? value.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Row>
            ) : senderOpen && accountsStatus === "error" ? (
              <Row label={t`From`}>
                <Button variant="link" className="h-auto p-0" onClick={onRetryAccounts}>
                  <Trans>Retry</Trans>
                </Button>
              </Row>
            ) : mail.account ? (
              <Row label={t`From`}>
                <span>{mail.account}</span>
              </Row>
            ) : null}
            {recipientRows.map(([key, label, value]) => (
              <Row key={key} label={label} hideLabel={editing}>
                {editing ? (
                  <Input
                    aria-label={label}
                    className="h-7 w-full border-muted-foreground/40 bg-background"
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
          </div>
          <div className={cn("pt-4", savedDraftSend && !shown.body && "hidden")}>
            {editing ? (
              <Textarea
                aria-label={t`Message`}
                className="min-h-32 border-muted-foreground/40 bg-background text-sm leading-6"
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
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-muted to-transparent" />
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
          {interactive && confirmDisable && botName ? (
            <fieldset
              aria-labelledby={confirmId}
              className="flex flex-wrap items-center gap-2 pt-4"
            >
              <span id={confirmId} className="text-sm text-foreground">
                {draft ? t`Turn off drafts for ${botName}?` : t`Turn off sending for ${botName}?`}
              </span>
              <Button
                variant="destructive"
                size="sm"
                className="rounded-full"
                disabled={busy}
                onClick={() => void submit("disable")}
              >
                <Trans>Turn off</Trans>
              </Button>
              <Button
                ref={cancelRef}
                variant="secondary"
                size="sm"
                className="rounded-full"
                disabled={busy}
                onClick={() => setConfirmDisable(false)}
              >
                <Trans>Cancel</Trans>
              </Button>
            </fieldset>
          ) : interactive ? (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-4">
              <div className="flex items-center gap-2">
                <Button
                  className="rounded-full"
                  disabled={busy || allowDisabled || needsAccount}
                  aria-describedby={chooseAccount && !account ? `${confirmId}-hint` : undefined}
                  onClick={() => void submit("allow")}
                >
                  {allowLabel ? (
                    allowLabel
                  ) : pendingAction === "allow" ? (
                    draft ? (
                      <Trans>Saving…</Trans>
                    ) : (
                      <Trans>Sending…</Trans>
                    )
                  ) : draft ? (
                    <Trans>Save draft</Trans>
                  ) : savedDraftSend ? (
                    <Trans>Send saved draft</Trans>
                  ) : (
                    <Trans>Send</Trans>
                  )}
                </Button>
                <Button
                  variant="secondary"
                  className="rounded-full"
                  disabled={busy}
                  onClick={() => void submit("deny")}
                >
                  <Trans>Discard</Trans>
                </Button>
                {chooseAccount && !account ? (
                  <span id={`${confirmId}-hint`} className="text-[13px] text-muted-foreground">
                    <Trans>Choose an account to send from.</Trans>
                  </span>
                ) : null}
              </div>
              {botName && onDisableTool ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        ref={moreRef}
                        variant="ghost"
                        size="icon-sm"
                        className="rounded-full"
                        aria-label={t`More`}
                        disabled={busy}
                      />
                    }
                  >
                    <MoreHorizontal aria-hidden="true" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setConfirmDisable(true)}>
                      {draft ? t`Disable drafts for ${botName}` : t`Disable sending for ${botName}`}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          ) : null}
          {mail.outcome === "unknown" ? (
            <p role="status" className="pt-3 text-[13px] text-muted-foreground">
              {draft ? (
                <Trans>
                  Not confirmed as saved. Check Drafts in your mail before trying again.
                </Trans>
              ) : (
                <Trans>Not confirmed as sent. Check Sent in your mail before trying again.</Trans>
              )}
            </p>
          ) : null}
          {mail.outcome === "failed" ? (
            <p role="status" className="pt-3 text-[13px] text-destructive">
              {mail.error ??
                (draft
                  ? t`This draft was not saved. Check the account in Integrations, then open it in the composer.`
                  : t`This email was not sent. Check the account in Integrations, then open it in the composer.`)}
            </p>
          ) : null}
          {mail.outcome === "failed" && onOpenComposer ? (
            <div className="pt-3">
              <Button variant="outline" size="sm" onClick={() => onOpenComposer(mail)}>
                <Trans>Open in composer</Trans>
              </Button>
            </div>
          ) : null}
          {error ? (
            <p role="alert" className="pt-3 text-[13px] text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      ) : error ? (
        <p role="alert" className="px-5 pb-4 text-[13px] text-destructive">
          {error}
        </p>
      ) : null}
      {disabledNotice && botName ? (
        <p role="status" className="px-5 pb-4 text-[13px] text-muted-foreground">
          {draft
            ? t`Drafts are off for ${botName}. Turn them back on in its tools.`
            : t`Sending is off for ${botName}. Turn it back on in its tools.`}
        </p>
      ) : null}
    </div>
  );
}
