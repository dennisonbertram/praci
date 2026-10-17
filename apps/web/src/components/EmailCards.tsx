import { useLingui } from "@lingui/react/macro";
import type { EmailCard, MessageBlock } from "@rakazo/contracts";
import { groupEmailCards } from "@rakazo/core";
import { Card } from "@rakazo/ui-web";
import { Paperclip } from "lucide-react";
import { useState } from "react";
import { INBOX_CHANGED_EVENT } from "../lib/inbox-message-cache";
import { formatMailTime } from "../lib/mail-time";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";
import { InboxMessageDialog } from "./inbox/InboxMessageDialog";

/** Mail the bot cited, grouped by urgency. Mail text is untrusted, so it only ever renders as text. */
export function EmailCards({ block }: { block: Extract<MessageBlock, { kind: "emails" }> }) {
  const { t } = useLingui();
  const [open, setOpen] = useState<EmailCard | null>(null);
  // Read changes made here, until the message reloads; the dialog shows the cached state otherwise.
  const [unread, setUnread] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const changed = (call: Promise<unknown>, undo?: () => void) =>
    call
      .then(() => window.dispatchEvent(new Event(INBOX_CHANGED_EVENT)))
      .catch((cause) => {
        undo?.();
        setError(errorText(cause));
      });
  const now = new Date();
  // The same order the cards are listed in, so the preview steps through them.
  const ordered = groupEmailCards(block.emails).flatMap((group) => group.emails);
  const at = ordered.findIndex((email) => email.id === open?.id);
  // Groups are how soon a reply is due, not when the mail came, so the titles say so.
  const titles = {
    today: t`Reply today`,
    within_3_days: t`Reply within 3 days`,
    this_week: t`Reply this week`,
    later: t`Later`,
  };
  const attachments = (email: EmailCard) =>
    email.attachments ? (
      <span
        className="inline-flex items-center gap-0.5 text-xs text-muted-foreground"
        role="img"
        aria-label={t`Attachments: ${email.attachments}`}
      >
        <Paperclip size={12} aria-hidden="true" />
        {email.attachments}
      </span>
    ) : null;

  return (
    <div data-testid="email-cards" className="flex w-80 max-w-full flex-col gap-3 py-1">
      {groupEmailCards(block.emails).map((group) => (
        <section key={group.urgency} className="flex flex-col gap-1.5">
          <h3 className="text-xs font-semibold text-muted-foreground">{titles[group.urgency]}</h3>
          {group.urgency === "later" ? (
            <Card size="sm" className="gap-0 py-1">
              {group.emails.map((email) => (
                <button
                  key={email.id}
                  type="button"
                  data-testid="email-row"
                  onClick={() => setOpen(email)}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 px-3 py-1.5 text-start hover:bg-muted"
                >
                  <span dir="auto" className="truncate font-medium">
                    {email.from}
                  </span>
                  <span className="flex items-center gap-2">
                    {attachments(email)}
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatMailTime(email.receivedAt, now)}
                    </span>
                  </span>
                  <span dir="auto" className="col-span-2 truncate text-muted-foreground">
                    {email.subject}
                  </span>
                </button>
              ))}
            </Card>
          ) : (
            group.emails.map((email) => (
              <button
                key={email.id}
                type="button"
                data-testid="email-card"
                onClick={() => setOpen(email)}
                className="flex w-full flex-col gap-0.5 rounded-xl bg-card px-3 py-2.5 text-start text-sm ring-1 ring-foreground/10 hover:bg-muted"
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span dir="auto" className="truncate font-medium">
                    {email.from}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {attachments(email)}
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatMailTime(email.receivedAt, now)}
                    </span>
                  </span>
                </span>
                <span dir="auto" className="truncate">
                  {email.subject}
                </span>
                <span dir="auto" className="line-clamp-2 text-muted-foreground">
                  {email.snippet}
                </span>
              </button>
            ))
          )}
        </section>
      ))}
      <InboxMessageDialog
        messageId={open?.id ?? null}
        subject={open?.subject}
        previousId={at > 0 ? ordered[at - 1]?.id : undefined}
        nextId={at >= 0 ? ordered[at + 1]?.id : undefined}
        onNavigate={(id) => setOpen(ordered.find((email) => email.id === id) ?? null)}
        unread={open ? unread[open.id] : undefined}
        onArchive={() => {
          if (!open) return;
          setError("");
          changed(rpc.inbox.archive({ messageId: open.id }));
          setOpen(null);
        }}
        onRead={(read) => {
          if (!open) return;
          setError("");
          const { id } = open;
          const before = unread[id];
          setUnread((all) => ({ ...all, [id]: !read }));
          // A failed change puts the previous state back, so the button offers the right action.
          changed(rpc.inbox.markRead({ messageId: id, read }), () =>
            setUnread(({ [id]: _failed, ...rest }) =>
              before === undefined ? rest : { ...rest, [id]: before },
            ),
          );
        }}
        onClose={() => setOpen(null)}
      />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
