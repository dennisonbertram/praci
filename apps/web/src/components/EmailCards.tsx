import { Trans, useLingui } from "@lingui/react/macro";
import type { EmailCard, MessageBlock } from "@rakazo/contracts";
import { groupEmailCards } from "@rakazo/core";
import { Button, Table, TableBody, TableCell, TableRow } from "@rakazo/ui-web";
import { Paperclip } from "lucide-react";
import { useRef, useState } from "react";
import { maskCurrencyWhenHidden, useHideAmounts } from "../lib/hide-amounts-preference";
import { INBOX_CHANGED_EVENT } from "../lib/inbox-message-cache";
import { formatMailTime } from "../lib/mail-time";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";
import { InboxMessageDialog } from "./inbox/InboxMessageDialog";

/** Mail the bot cited, as one table ordered by urgency. Mail text is untrusted, so it only ever renders as text. */
export function EmailCards({ block }: { block: Extract<MessageBlock, { kind: "emails" }> }) {
  const { t } = useLingui();
  useHideAmounts();
  const [open, setOpen] = useState<EmailCard | null>(null);
  // Read changes made here, until the message reloads; the dialog shows the cached state otherwise.
  const [unread, setUnread] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  // Archived from here: the card says so, and the last one can be undone, as in the Inbox list.
  const [archived, setArchived] = useState<Record<string, boolean>>({});
  const [lastArchived, setLastArchived] = useState<EmailCard | null>(null);
  // Changes to one email run in order, so an Undo never starts before the change it reverses.
  const inFlight = useRef(new Map<string, Promise<unknown>>());
  const changed = (messageId: string, call: () => Promise<unknown>, undo?: () => void) => {
    const settled = (inFlight.current.get(messageId) ?? Promise.resolve()).catch(() => undefined);
    const next = settled
      .then(call)
      .then(() => window.dispatchEvent(new Event(INBOX_CHANGED_EVENT)))
      .catch((cause) => {
        undo?.();
        setError(errorText(cause));
      });
    inFlight.current.set(messageId, next);
    return next;
  };
  const now = new Date();
  // The table order, so the preview steps through the rows.
  const ordered = groupEmailCards(block.emails).flatMap((group) => group.emails);
  const at = ordered.findIndex((email) => email.id === open?.id);
  const attachments = (email: EmailCard) =>
    email.attachments ? (
      <span
        className="inline-flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground"
        role="img"
        aria-label={t`Attachments: ${email.attachments}`}
      >
        <Paperclip size={12} aria-hidden="true" />
        {email.attachments}
      </span>
    ) : null;
  // Urgency as a short label; "later" is the default and needs none. Only "Today" stands out.
  const whens = {
    today: t`Today`,
    within_3_days: t`3 days`,
    this_week: t`This week`,
    later: "",
  };

  return (
    <div data-testid="email-cards" className="@container flex w-full min-w-0 flex-col gap-2 py-1">
      <Table compact>
        <TableBody>
          {ordered.map((email) => (
            <TableRow
              key={email.id}
              data-testid="email-row"
              onOpen={() => setOpen(email)}
              className="align-top"
            >
              <TableCell className="w-px whitespace-nowrap text-xs">
                <span className="inline-flex items-center gap-1.5">
                  {unread[email.id] ? (
                    <span
                      role="img"
                      aria-label={t`Unread`}
                      className="size-2 shrink-0 rounded-full bg-primary"
                    />
                  ) : null}
                  <span
                    className={
                      email.urgency === "today"
                        ? "font-medium text-foreground"
                        : "text-muted-foreground"
                    }
                  >
                    {whens[email.urgency]}
                  </span>
                </span>
              </TableCell>
              <TableCell dir="auto" className="max-w-24 truncate @md:max-w-40 font-medium">
                {email.from}
              </TableCell>
              <TableCell className="w-full max-w-0">
                <span className="flex min-w-0 items-center gap-2">
                  <button
                    type="button"
                    data-row-open
                    dir="auto"
                    className="min-w-0 truncate text-start"
                  >
                    {maskCurrencyWhenHidden(email.subject)}
                  </button>
                  {attachments(email)}
                </span>
                {archived[email.id] ? (
                  <span className="block truncate text-xs text-muted-foreground">
                    <Trans>Archived</Trans>
                  </span>
                ) : email.note ? (
                  <span dir="auto" className="block truncate text-xs text-muted-foreground">
                    {maskCurrencyWhenHidden(email.note)}
                  </span>
                ) : null}
              </TableCell>
              <TableCell className="hidden whitespace-nowrap text-end text-xs text-muted-foreground tabular-nums @md:table-cell">
                {formatMailTime(email.receivedAt, now)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <InboxMessageDialog
        messageId={open?.id ?? null}
        subject={open?.subject}
        previousId={at > 0 ? ordered[at - 1]?.id : undefined}
        nextId={at >= 0 ? ordered[at + 1]?.id : undefined}
        onNavigate={(id) => setOpen(ordered.find((email) => email.id === id) ?? null)}
        unread={open ? unread[open.id] : undefined}
        onArchive={
          open && !archived[open.id]
            ? () => {
                const email = open;
                setError("");
                setArchived((all) => ({ ...all, [email.id]: true }));
                setLastArchived(email);
                changed(
                  email.id,
                  () => rpc.inbox.archive({ messageId: email.id }),
                  () => {
                    setArchived(({ [email.id]: _failed, ...rest }) => rest);
                    setLastArchived(null);
                  },
                );
                setOpen(null);
              }
            : undefined
        }
        onRead={(read) => {
          if (!open) return;
          setError("");
          const { id } = open;
          const before = unread[id];
          setUnread((all) => ({ ...all, [id]: !read }));
          // A failed change puts the previous state back, so the button offers the right action.
          changed(
            id,
            () => rpc.inbox.markRead({ messageId: id, read }),
            () =>
              setUnread(({ [id]: _failed, ...rest }) =>
                before === undefined ? rest : { ...rest, [id]: before },
              ),
          );
        }}
        onClose={() => setOpen(null)}
      />
      {lastArchived ? (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="min-w-0 truncate" dir="auto">
            <Trans>Archived "{maskCurrencyWhenHidden(lastArchived.subject)}"</Trans>
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const email = lastArchived;
              setLastArchived(null);
              setArchived(({ [email.id]: _undone, ...rest }) => rest);
              changed(
                email.id,
                () => rpc.inbox.unarchive({ messageId: email.id }),
                () => setArchived((all) => ({ ...all, [email.id]: true })),
              );
            }}
          >
            <Trans>Undo</Trans>
          </Button>
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
