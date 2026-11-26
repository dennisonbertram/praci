import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { MailApproval, MailBatch, MailReplyFlag, MessageBlock } from "@rakazo/contracts";
import {
  MAIL_REPLY_ACCOUNT_HOLD,
  MAIL_REPLY_FIREWALL_HOLD,
  MAIL_REPLY_GRANT_HOLD,
  MAIL_REPLY_INFORMING_FLAGS,
  MAIL_REPLY_LIMIT_HOLD,
  MAIL_REPLY_NEW_MESSAGE_HOLD,
  MAIL_REPLY_SWITCH_HOLD,
} from "@rakazo/contracts";
import { isClosedApprovalAnswer, SKIPPED_APPROVAL_ANSWER } from "@rakazo/core";
import { Badge, Button, Checkbox, cn } from "@rakazo/ui-web";
import { Mail } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { holdCommit } from "../lib/outbox";
import { parseRecipient, splitEntries } from "../lib/recipients";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";
import type { ComposerDraft } from "./BotToolControls";
import { SeeAll, useCappedRows } from "./CappedList";
import { MailApprovalCard } from "./MailApprovalCard";

type Row = MailBatch["rows"][number];
type Fields = { to: string; cc: string; bcc: string; subject: string; body: string };
type Flags = { flags: MailReplyFlag[]; startsUnticked: boolean };

/** Rows shown before See all, on a phone too: each row is one line and the owner must see them. */
const CAP = 8;
const PREVIEW_DELAY_MS = 300;
const POLL_MS = 3_000;

const fieldsOf = (row: Row): Fields => ({
  to: row.to.join(", "),
  cc: row.cc.join(", "),
  bcc: row.bcc.join(", "),
  subject: row.subject,
  body: row.body,
});

/** Only what the owner changed, as the press and the preview post it. */
function changedFields(row: Row, fields: Fields | undefined): Partial<Fields> {
  if (!fields) return {};
  const base = fieldsOf(row);
  return Object.fromEntries(
    (Object.keys(base) as (keyof Fields)[])
      .filter((key) => fields[key] !== base[key])
      .map((key) => [key, fields[key]]),
  );
}

const addressesOf = (text: string) =>
  splitEntries(text)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => parseRecipient(entry).address);

const firstLine = (body: string) =>
  body
    .split("\n")
    .find((line) => line.trim())
    ?.trim() ?? "";

function flagText(flag: MailReplyFlag): string {
  switch (flag) {
    case "not_on_thread":
      return t`Not on this thread`;
    case "new_message":
      return t`New message`;
    case "important_sender":
      return t`Important sender`;
    case "no_reply_address":
      return t`No-reply address`;
    case "no_reply_needed":
      return t`You said no reply needed`;
    case "already_sent":
      return t`Already sent a few minutes ago`;
    case "duplicate_email":
      return t`Possible duplicate`;
    case "new_recipient":
      return t`New recipient`;
    case "has_link":
      return t`Has a link`;
    case "same_text":
      return t`Same text as others`;
  }
}

function FlagBadge({ flag }: { flag: MailReplyFlag }) {
  return (
    <Badge variant="secondary" className="shrink-0 bg-warning/15 text-warning">
      {flagText(flag)}
    </Badge>
  );
}

/** Why a row was held, for the holds the owner can act on. Other holds keep the plain "Not sent". */
function holdText(error: string | null): string | null {
  if (error === MAIL_REPLY_LIMIT_HOLD)
    return t`Daily limit for new recipients reached. Retry later.`;
  if (error === MAIL_REPLY_FIREWALL_HOLD) return t`Firewall is on, so this agent can only reply.`;
  if (error === MAIL_REPLY_NEW_MESSAGE_HOLD) return t`New message on this thread.`;
  if (error === MAIL_REPLY_SWITCH_HOLD) return t`Sending is off for this agent.`;
  if (error === MAIL_REPLY_GRANT_HOLD) return t`This agent can no longer send from this account.`;
  if (error === MAIL_REPLY_ACCOUNT_HOLD) return t`This account is no longer connected.`;
  return null;
}

function cardTitle(fresh: number, replies: number) {
  const emails = fresh === 1 ? <Trans>1 new email</Trans> : <Trans>{fresh} new emails</Trans>;
  const answers = replies === 1 ? <Trans>1 reply</Trans> : <Trans>{replies} replies</Trans>;
  if (fresh === 0) return answers;
  if (replies === 0) return emails;
  return (
    <>
      {emails} · {answers}
    </>
  );
}

function RowState({ state }: { state: Row["state"] }) {
  const text =
    state === "sent" ? (
      <Trans>Sent</Trans>
    ) : state === "not_sent" ? (
      <Trans>Not sent</Trans>
    ) : state === "unknown" ? (
      <Trans>Unknown</Trans>
    ) : state === "skipped" ? (
      <Trans>Skipped</Trans>
    ) : state === "composer" ? (
      <Trans>Opened in composer</Trans>
    ) : state === "sending" ? (
      <Trans>Sending…</Trans>
    ) : null;
  if (!text) return null;
  return (
    <span
      className={cn(
        "shrink-0 text-[13px]",
        state === "not_sent" ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {text}
    </span>
  );
}

/**
 * One card for the several replies and new emails of a mail_reply_batch call. An open row is the real mail card.
 * Send selected is its own request with the exact rows; Discard answers the card as usual. Flags,
 * hashes and results come from the server, and the card shows what `threads.mailBatch` reads.
 */
export function MailReplyBatchCard({
  block,
  botId,
  message,
  canAnswer,
  onAnswer,
  onOpenComposer,
  fallback,
  initialOpen,
  initialEditing = false,
}: {
  block: Extract<MessageBlock, { kind: "ask" }>;
  botId: string;
  message: { id: string; runId?: string | null };
  canAnswer: boolean;
  onAnswer: (answer: string) => Promise<void>;
  onOpenComposer?: (draft: ComposerDraft) => void;
  /** The plain card, for a reader whose request for the rows fails. */
  fallback: ReactNode;
  /** A row already open, for stories. */
  initialOpen?: string;
  initialEditing?: boolean;
}) {
  const ids = useMemo(
    () => ({ botId, runId: message.runId ?? "", messageId: message.id }),
    [botId, message.runId, message.id],
  );
  const [data, setData] = useState<MailBatch | null>(null);
  const [failed, setFailed] = useState(false);
  const [ticks, setTicks] = useState<ReadonlySet<string>>(new Set());
  const [edited, setEdited] = useState<Record<string, Fields>>({});
  const [previews, setPreviews] = useState<Record<string, Flags>>({});
  const [checkedEdits, setCheckedEdits] = useState("{}");
  const [open, setOpen] = useState(initialOpen);
  const [editing, setEditing] = useState(initialEditing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Flags already shown per row: only a flag that is new unticks a row the owner ticked. */
  const shownFlags = useRef(new Map<string, string>());
  /** The first order stays: rows do not jump while the owner reads them. */
  const order = useRef<string[]>([]);

  const applyFlags = useCallback((rows: { itemId: string; flags: Flags }[]) => {
    const untick = rows.filter(({ itemId, flags }) => {
      const key = flags.flags.join();
      if (shownFlags.current.get(itemId) === key) return false;
      shownFlags.current.set(itemId, key);
      return flags.startsUnticked;
    });
    if (untick.length === 0) return;
    setTicks((current) => {
      const next = new Set(current);
      for (const { itemId } of untick) next.delete(itemId);
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    try {
      const batch = await rpc.threads.mailBatch(ids);
      if (order.current.length === 0) {
        order.current = [...batch.rows]
          .sort((a, b) => Number(b.startsUnticked) - Number(a.startsUnticked))
          .map((row) => row.itemId);
        setTicks(new Set(batch.rows.filter((row) => !row.startsUnticked).map((row) => row.itemId)));
        for (const row of batch.rows) shownFlags.current.set(row.itemId, row.flags.join());
      }
      setData(batch);
      setFailed(false);
      return batch;
    } catch {
      setFailed((current) => current || order.current.length === 0);
      return null;
    }
  }, [ids]);

  const cardState = `${block.status}|${block.answer}|${JSON.stringify(block.mailBatch)}`;
  useEffect(() => {
    void load();
  }, [load, cardState]);

  const rows = useMemo(() => {
    const byId = new Map((data?.rows ?? []).map((row) => [row.itemId, row]));
    return order.current.flatMap((id) => {
      const row = byId.get(id);
      return row ? [row] : [];
    });
  }, [data]);
  const sending = rows.some((row) => row.state === "sending");

  // A realtime event moves the card on; this covers one that was missed while rows are going out.
  useEffect(() => {
    if (!sending) return;
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [sending, load]);

  const edits = useMemo(
    () =>
      rows.flatMap((row) => {
        // Once a row left review, what the server holds is what is true, not a local edit.
        if (row.state !== "reviewing") return [];
        const changed = changedFields(row, edited[row.itemId]);
        return Object.keys(changed).length ? [{ itemId: row.itemId, edits: changed }] : [];
      }),
    [rows, edited],
  );
  // What the server knows of an edited row is part of the check: a new message means a new check.
  // The check can flag other rows too, so all of them count once anything is edited.
  const editsKey = JSON.stringify(
    edits.length === 0
      ? []
      : rows.map((row) => [
          row.itemId,
          changedFields(row, edited[row.itemId]),
          row.seenMessageId,
          row.flags,
        ]),
  );

  // Editing recomputes flags on the server, so an edit adding a recipient unticks that row at once.
  useEffect(() => {
    if (edits.length === 0) {
      setPreviews({});
      setCheckedEdits(editsKey);
      return;
    }
    let current = true;
    const timer = setTimeout(() => {
      rpc.threads
        .previewMailBatch({ ...ids, rows: edits })
        .then((result) => {
          if (!current) return;
          setPreviews(
            Object.fromEntries(
              result.rows.map(({ itemId, flags, startsUnticked }) => [
                itemId,
                { flags, startsUnticked },
              ]),
            ),
          );
          applyFlags(
            result.rows.map(({ itemId, flags, startsUnticked }) => ({
              itemId,
              flags: { flags, startsUnticked },
            })),
          );
          setCheckedEdits(editsKey);
        })
        .catch(() => {
          if (!current) return;
          // The edit could not be checked, so its row needs a deliberate tick.
          setTicks((ticked) => {
            const next = new Set(ticked);
            for (const { itemId } of edits) next.delete(itemId);
            return next;
          });
          setCheckedEdits(editsKey);
        });
    }, PREVIEW_DELAY_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [editsKey, ids, applyFlags]);

  // A flag the server found since the last read (a new message) unticks a row. An edited row gets
  // its flags from the check above, which runs again when this read changes it.
  useEffect(() => {
    const isEdited = new Set(edits.map((edit) => edit.itemId));
    applyFlags(
      rows
        .filter(
          (row) => !isEdited.has(row.itemId) && !previews[row.itemId] && row.state === "reviewing",
        )
        .map((row) => ({
          itemId: row.itemId,
          flags: { flags: row.flags, startsUnticked: row.startsUnticked },
        })),
    );
  }, [rows, edits, previews, applyFlags]);

  const reviewing = block.status !== "answered" && canAnswer;
  const list = useCappedRows(rows, { phone: CAP, desktop: CAP });
  const hiddenTicked =
    reviewing && rows.slice(list.rows.length).some((row) => ticks.has(row.itemId));
  const ticked = rows.filter((row) => ticks.has(row.itemId));
  // A row flagged for the owner to look at stays unticked until ticked by hand, so Select all
  // ticks only rows whose flags merely inform or whose unticked start was outside content.
  const eligible = rows.filter(
    (row) =>
      row.state === "reviewing" &&
      (previews[row.itemId]?.flags ?? row.flags).every((flag) =>
        (MAIL_REPLY_INFORMING_FLAGS as readonly MailReplyFlag[]).includes(flag),
      ),
  );
  const eligibleTicked = eligible.filter((row) => ticks.has(row.itemId)).length;
  const allTicked = eligible.length > 0 && eligibleTicked === eligible.length;
  const checkPending = editsKey !== checkedEdits;
  const retryable = rows.filter((row) => row.retryable);

  if (failed) return <>{fallback}</>;
  if (!data) {
    return (
      <div
        data-testid="mail-reply-batch-card"
        className="w-160 max-w-full rounded-3xl bg-muted px-5 py-3.5 text-[15px] text-foreground ring-1 ring-inset ring-border"
      >
        {block.text}
      </div>
    );
  }

  const hold = (run: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    holdCommit(
      async () => void (await run()),
      (problem) => {
        if (typeof problem === "string") setError(problem || t`Could not submit this answer`);
        if (problem !== undefined) void load();
        setBusy(false);
      },
    );
  };
  const sendSelected = () =>
    hold(() =>
      rpc.threads.sendMailBatch({
        ...ids,
        rows: ticked.map((row) => {
          const changed = changedFields(row, edited[row.itemId]);
          return {
            itemId: row.itemId,
            hash: row.hash,
            seenMessageId: row.seenMessageId,
            // What this card showed; the server refuses a row with a flag not in this list.
            flags: previews[row.itemId]?.flags ?? row.flags,
            ...(Object.keys(changed).length ? { edits: changed } : {}),
          };
        }),
      }),
    );
  const retry = () =>
    hold(() =>
      rpc.threads.retryMailBatch({
        ...ids,
        rows: retryable.map((row) => ({
          itemId: row.itemId,
          seenMessageId: row.seenMessageId,
        })),
      }),
    );
  const discard = async () => {
    setBusy(true);
    setError(null);
    try {
      await onAnswer("deny");
    } catch (problem) {
      setError(errorText(problem, t`Could not submit this answer`));
    } finally {
      setBusy(false);
    }
  };
  const toComposer = async (row: Row) => {
    setError(null);
    try {
      onOpenComposer?.(await rpc.threads.mailBatchToComposer({ ...ids, itemId: row.itemId }));
    } catch (problem) {
      setError(errorText(problem, t`Could not submit this answer`));
    }
    await load();
  };

  const sent = rows.filter((row) => row.state === "sent").length;
  const notSent = rows.filter((row) => row.state === "not_sent").length;
  const unknown = rows.filter((row) => row.state === "unknown").length;
  const results = [
    sent > 0 ? t`${sent} sent` : "",
    notSent > 0 ? t`${notSent} not sent` : "",
    unknown > 0 ? t`${unknown} unknown` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const status =
    block.status !== "answered" ? (
      canAnswer ? (
        <Trans>Needs approval</Trans>
      ) : (
        <Trans>Not waiting for approval</Trans>
      )
    ) : block.answer === "deny" ? (
      <Trans>Discarded</Trans>
    ) : block.answer === SKIPPED_APPROVAL_ANSWER ? (
      <Trans>Skipped</Trans>
    ) : isClosedApprovalAnswer(block.answer) ? (
      <Trans>Not sent</Trans>
    ) : sending ? (
      <Trans>Sending…</Trans>
    ) : (
      results
    );
  const count = rows.length;
  const newEmails = rows.filter((row) => row.replyToId === null).length;

  return (
    <div
      data-testid="mail-reply-batch-card"
      className={cn(
        "@container w-160 max-w-full overflow-hidden rounded-3xl bg-muted",
        reviewing && "ring-1 ring-inset ring-border",
      )}
    >
      <div className="flex items-center gap-3 px-5 py-3.5">
        <span className="hidden size-[30px] shrink-0 items-center justify-center rounded-lg bg-card text-foreground @sm:flex">
          <Mail aria-hidden="true" className="size-4" />
        </span>
        <span className="min-w-0 flex-1 text-[15px]">
          <span className="font-medium text-foreground">
            {cardTitle(newEmails, count - newEmails)}
          </span>{" "}
          <span className="text-muted-foreground">{status}</span>
          {data.account ? (
            <span className="block truncate text-sm text-muted-foreground">{data.account}</span>
          ) : null}
        </span>
      </div>
      {reviewing && rows.length >= 2 && eligible.length > 0 ? (
        <div className="flex items-center gap-3 border-t border-border px-5 py-2.5">
          <Checkbox
            id={`${ids.messageId}-select-all`}
            checked={allTicked}
            indeterminate={eligibleTicked > 0 && !allTicked}
            disabled={busy}
            onCheckedChange={() => {
              if (allTicked) return setTicks(new Set());
              setTicks(new Set([...ticks, ...eligible.map((r) => r.itemId)]));
              // Every ticked row must be visible before Send, so ticking opens the list.
              if (list.capped && !list.expanded) list.toggle();
            }}
          />
          <label htmlFor={`${ids.messageId}-select-all`} className="text-sm text-foreground">
            <Trans>Select all</Trans>
          </label>
        </div>
      ) : null}
      <ul>
        {list.rows.map((row) => {
          const inReview = row.state === "reviewing";
          const fields = (inReview ? edited[row.itemId] : undefined) ?? fieldsOf(row);
          // A row that already went out has nothing left to warn about.
          const flags =
            row.state === "sent"
              ? []
              : ((inReview ? previews[row.itemId]?.flags : undefined) ?? row.flags);
          const [first = "", ...others] = [fields.to, fields.cc, fields.bcc].flatMap(addressesOf);
          const isOpen = open === row.itemId;
          const newEmail = row.replyToId === null;
          const hold = row.state === "not_sent" ? holdText(row.error) : null;
          const mail: MailApproval = {
            tool: "mail_send",
            to: addressesOf(fields.to),
            cc: addressesOf(fields.cc),
            bcc: addressesOf(fields.bcc),
            subject: fields.subject,
            body: fields.body,
            reply: !newEmail,
            // A held row's reason is the card's failure line, instead of the generic one.
            ...(hold ? { error: hold } : {}),
            ...(row.state === "sent"
              ? { outcome: "sent" as const }
              : row.state === "not_sent"
                ? { outcome: "failed" as const }
                : row.state === "unknown"
                  ? { outcome: "unknown" as const }
                  : {}),
          };
          return (
            <li key={row.itemId} className="border-t border-border">
              <div className="flex items-start gap-3 px-5 py-2.5">
                {reviewing ? (
                  <Checkbox
                    className="mt-0.5"
                    checked={ticks.has(row.itemId)}
                    disabled={busy}
                    aria-label={
                      newEmail ? t`Include new email to ${first}` : t`Include reply to ${first}`
                    }
                    onCheckedChange={(value) =>
                      setTicks((current) => {
                        const next = new Set(current);
                        if (value) next.add(row.itemId);
                        else next.delete(row.itemId);
                        return next;
                      })
                    }
                  />
                ) : null}
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => {
                    setOpen(isOpen ? undefined : row.itemId);
                    setEditing(false);
                  }}
                  className="min-w-0 flex-1 text-start"
                >
                  <span className="flex min-w-0 flex-wrap items-center gap-x-2 text-sm text-foreground">
                    {newEmail && newEmails < count ? (
                      <Badge variant="outline" className="shrink-0">
                        <Trans>New email</Trans>
                      </Badge>
                    ) : null}
                    {/* Wraps, never truncates: a cut-off address would hide the recipient being flagged. */}
                    <span className="min-w-0 break-words">{[first, ...others].join(", ")}</span>
                    {flags[0] ? <FlagBadge flag={flags[0]} /> : null}
                  </span>
                  <span className="block truncate text-[13px] text-muted-foreground">
                    {fields.subject} · {firstLine(fields.body)}
                  </span>
                  {hold && !isOpen ? (
                    <span className="block text-[13px] text-destructive">{hold}</span>
                  ) : null}
                </button>
                <RowState state={row.state} />
              </div>
              {isOpen ? (
                <div className="px-3 pb-3">
                  {flags.length > 1 ? (
                    <div className="flex flex-wrap gap-1.5 px-2 pb-2">
                      {flags.slice(1).map((flag) => (
                        <FlagBadge key={flag} flag={flag} />
                      ))}
                    </div>
                  ) : null}
                  {/* Its header and buttons are this card's. The key keeps edits when the rows reload,
                      and starts again from the server's text when another tab changed the row. */}
                  <MailApprovalCard
                    key={`${row.itemId}:${row.hash}`}
                    mail={mail}
                    status={reviewing && inReview ? "pending" : "answered"}
                    canAnswer={reviewing}
                    onAnswer={async () => undefined}
                    embedded={{ editing: editing && reviewing && !busy }}
                    onFieldsChange={(next) =>
                      setEdited((current) => ({ ...current, [row.itemId]: next }))
                    }
                  />
                  <div className="flex flex-wrap gap-2 px-2 pt-2">
                    {reviewing && !busy ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-full"
                        aria-pressed={editing}
                        onClick={() => setEditing((value) => !value)}
                      >
                        {editing ? <Trans>Done</Trans> : <Trans>Edit</Trans>}
                      </Button>
                    ) : null}
                    {((row.state === "not_sent" && row.retryable) || row.state === "composer") &&
                    onOpenComposer ? (
                      <Button variant="outline" size="sm" onClick={() => void toComposer(row)}>
                        <Trans>Open in composer</Trans>
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {list.capped && !hiddenTicked ? (
        <div className="border-t border-border px-5 py-2">
          <SeeAll list={list} />
        </div>
      ) : null}
      {reviewing || retryable.length > 0 || error ? (
        <div className="border-t border-border px-5 py-3.5">
          {reviewing && block.approvalReason ? (
            <p className="pb-3 text-[13px] text-muted-foreground">{block.approvalReason}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            {reviewing ? (
              <>
                {hiddenTicked ? (
                  <Button className="rounded-full" onClick={list.toggle}>
                    <Trans>Review all ({count})</Trans>
                  </Button>
                ) : (
                  <Button
                    className="rounded-full"
                    disabled={busy || checkPending || ticked.length === 0}
                    onClick={sendSelected}
                  >
                    <Trans>Send selected ({ticked.length})</Trans>
                  </Button>
                )}
                <Button
                  variant="secondary"
                  className="rounded-full"
                  disabled={busy}
                  onClick={() => void discard()}
                >
                  <Trans>Discard</Trans>
                </Button>
              </>
            ) : retryable.length > 0 ? (
              <Button className="rounded-full" disabled={busy} onClick={retry}>
                <Trans>Retry failed</Trans>
              </Button>
            ) : null}
          </div>
          {error ? (
            <p role="alert" className="pt-3 text-[13px] text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
