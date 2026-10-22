import { plural } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { MailRow } from "@rakazo/contracts";
import { groupBySender, rowSummary } from "@rakazo/core";
import { Button, Skeleton } from "@rakazo/ui-web";
import { Archive } from "lucide-react";
import { maskCurrencyWhenHidden, useHideAmounts } from "../../lib/hide-amounts-preference";
import { formatMailTime } from "../../lib/mail-time";

/**
 * The Newsletters pile read as a digest: one card per sender with how many messages they sent,
 * newest sender first, showing the newest message's subject and summary and an Open button for it.
 * Archive all archives every message in the digest.
 */
export function InboxDigest({
  rows,
  loading = false,
  onOpen,
  onArchiveAll,
  onShowPile,
  selectedId,
}: {
  /** Already limited to the digest window and ordered newest first (`digestRows`). */
  rows: MailRow[];
  loading?: boolean;
  onOpen: (messageId: string) => void;
  onArchiveAll: () => void;
  /** Leaves the digest for the whole pile, when the window holds nothing. */
  onShowPile: () => void;
  /** The focused card, as the keyboard leaves it. */
  selectedId?: string;
}) {
  useHideAmounts();
  if (loading)
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        {[0, 1, 2].map((n) => (
          <Skeleton key={n} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  if (rows.length === 0)
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-sm text-muted-foreground">
        <p>
          <Trans>No newsletters in the last 7 days</Trans>
        </p>
        <Button variant="outline" size="sm" onClick={onShowPile}>
          <Trans>Show the pile</Trans>
        </Button>
      </div>
    );
  const groups = groupBySender(rows);
  return (
    <section className="mb-5 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] text-muted-foreground">
          <Trans>Last 7 days</Trans>
        </span>
        <Button variant="ghost" size="sm" onClick={onArchiveAll}>
          <Archive aria-hidden="true" />
          {plural(rows.length, {
            one: `Archive ${rows.length} message from ${groups.length} sender`,
            other: `Archive all # messages from ${plural(groups.length, { one: "# sender", other: "# senders" })}`,
          })}
        </Button>
      </div>
      {groups.map((group) => {
        const row = group.newest;
        const summary = rowSummary(row);
        return (
          <article
            key={row.id}
            data-row-id={row.id}
            aria-current={row.id === selectedId ? "true" : undefined}
            className={`flex min-w-0 flex-col gap-1 rounded-xl border bg-card p-3 text-card-foreground ${row.id === selectedId ? "border-primary" : "border-foreground/10"}`}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden="true"
                data-unread-dot={group.unreadCount > 0 ? "" : undefined}
                className={`size-2 shrink-0 rounded-full ${group.unreadCount > 0 ? "bg-primary" : ""}`}
              />
              <span dir="auto" className="truncate text-[15px] font-semibold">
                {row.from}
              </span>
              <span className="shrink-0 text-[13px] text-muted-foreground">
                {plural(group.count, { one: "# message", other: "# messages" })}
              </span>
              {group.unreadCount > 0 ? (
                <span className="sr-only">
                  <Trans> (unread)</Trans>
                </span>
              ) : null}
              <time
                dateTime={row.receivedAt}
                className="ms-auto shrink-0 text-[13px] tabular-nums text-muted-foreground"
              >
                {formatMailTime(row.receivedAt)}
              </time>
              <Button variant="outline" size="sm" onClick={() => onOpen(row.id)}>
                <Trans>Open</Trans>
              </Button>
            </div>
            <p dir="auto" className="truncate ps-4 text-[15px]">
              {maskCurrencyWhenHidden(row.subject)}
              {summary && summary.trim() !== row.subject.trim() ? (
                <span className="text-sm text-muted-foreground">
                  {" "}
                  · {maskCurrencyWhenHidden(summary)}
                </span>
              ) : null}
            </p>
          </article>
        );
      })}
    </section>
  );
}
