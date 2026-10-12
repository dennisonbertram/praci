import { useLingui } from "@lingui/react/macro";
import type { EmailCard, MessageBlock } from "@rakazo/contracts";
import { groupEmailCards } from "@rakazo/core";
import { Card, Dialog, DialogContent, DialogTitle } from "@rakazo/ui-web";
import { Paperclip } from "lucide-react";
import { useId, useState } from "react";
import { formatRelativeTime } from "../lib/relative-time";
import { InboxMessageView } from "../pages/Inbox";

/** Mail the bot cited, grouped by urgency. Mail text is untrusted, so it only ever renders as text. */
export function EmailCards({ block }: { block: Extract<MessageBlock, { kind: "emails" }> }) {
  const { t } = useLingui();
  const [open, setOpen] = useState<EmailCard | null>(null);
  const bodyId = useId();
  const now = new Date();
  const titles = {
    today: t`Today`,
    within_3_days: t`Within 3 days`,
    this_week: t`This week`,
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
                      {formatRelativeTime(email.receivedAt, now)}
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
                      {formatRelativeTime(email.receivedAt, now)}
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
      <Dialog open={open !== null} onOpenChange={(next) => !next && setOpen(null)}>
        <DialogContent className="flex max-h-[88vh] w-[min(720px,94vw)] flex-col gap-2 overflow-y-auto sm:max-w-none">
          {open ? (
            <>
              <DialogTitle dir="auto" className="pe-8">
                {open.subject}
              </DialogTitle>
              <InboxMessageView id={bodyId} messageId={open.id} subject={open.subject} />
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
