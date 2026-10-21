import { Trans, useLingui } from "@lingui/react/macro";
import type { MailRow } from "@rakazo/contracts";
import { rowSummary } from "@rakazo/core";
import { Button, Skeleton } from "@rakazo/ui-web";
import { Archive } from "lucide-react";
import { maskCurrencyWhenHidden, useHideAmounts } from "../../lib/hide-amounts-preference";
import { formatMailTime } from "../../lib/mail-time";

/**
 * The Newsletters pile read as a digest: one card per issue, newest first, each with the sender,
 * subject, the one-line summary and an Open button. Archive all archives every card shown.
 */
export function InboxDigest({
  rows,
  loading = false,
  onOpen,
  onArchiveAll,
  selectedId,
}: {
  /** Already limited to the digest window and ordered newest first (`digestRows`). */
  rows: MailRow[];
  loading?: boolean;
  onOpen: (messageId: string) => void;
  onArchiveAll: () => void;
  /** The focused card, as the keyboard leaves it. */
  selectedId?: string;
}) {
  const { t } = useLingui();
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
      <p className="py-16 text-center text-sm text-muted-foreground">
        <Trans>No mail</Trans>
      </p>
    );
  return (
    <section className="mb-5 flex flex-col gap-3">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={onArchiveAll}>
          <Archive aria-hidden="true" />
          {t`Archive all ${rows.length}`}
        </Button>
      </div>
      {rows.map((row) => {
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
                data-unread-dot={row.unread ? "" : undefined}
                className={`size-2 shrink-0 rounded-full ${row.unread ? "bg-primary" : ""}`}
              />
              <span dir="auto" className="truncate text-[15px] font-semibold">
                {row.from}
              </span>
              {row.unread ? (
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
              <Button variant="outline" size="xs" onClick={() => onOpen(row.id)}>
                <Trans>Open</Trans>
              </Button>
            </div>
            <p dir="auto" className="truncate text-[15px]">
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
