import { Trans, useLingui } from "@lingui/react/macro";
import type { MailAction, MailActionKind } from "@rakazo/contracts";
import { Button } from "@rakazo/ui-web";
import { formatMailTime } from "../../lib/mail-time";

/** Bulk actions, latest first, each undoable until it is undone. */
export function CleanupHistory({
  actions,
  onUndo,
  busyBatchId,
}: {
  actions: MailAction[];
  onUndo: (batchId: string) => void;
  /** The action being undone, so its button waits. */
  busyBatchId?: string;
}) {
  const { t } = useLingui();
  if (actions.length === 0) return null;
  const names: Record<MailActionKind, (count: number) => string> = {
    archive: (n) => t`Archived ${n}`,
    skip_inbox: (n) => t`Skipped inbox for ${n}`,
    unsubscribe: (n) => t`Unsubscribed and archived ${n}`,
    spam: (n) => t`Marked ${n} as spam`,
    not_spam: (n) => t`Marked ${n} as not spam`,
    trash: (n) => t`Moved ${n} to trash`,
  };
  // A hand-picked selection is the plain case and says nothing.
  const reasons: Partial<Record<MailAction["reason"], string>> = {
    cleanup: t`Cleanup`,
    skip_inbox: t`Archive future mail`,
  };
  return (
    <section aria-labelledby="cleanup-history" className="mt-8">
      <h2 id="cleanup-history" className="mb-1 text-[13px] font-semibold text-muted-foreground">
        <Trans>History</Trans>
      </h2>
      <ul>
        {actions.map((action) => (
          <li
            key={action.batchId}
            className="flex items-center gap-3 border-b border-foreground/10 px-1 py-2 text-sm"
          >
            <span className="min-w-0 flex-1 truncate" dir="auto">
              {names[action.kind](action.threadCount)}
              <span className="text-muted-foreground">
                {" · "}
                {action.senders[0] ?? ""}
                {action.senderCount > 1 ? ` +${action.senderCount - 1}` : ""}
                {action.source === "auto" ? ` · ${t`Automatic`}` : ""}
                {reasons[action.reason] && action.reason !== action.kind
                  ? ` · ${reasons[action.reason]}`
                  : ""}
              </span>
            </span>
            <time
              dateTime={action.createdAt}
              className="text-xs whitespace-nowrap text-muted-foreground"
            >
              {formatMailTime(action.createdAt)}
            </time>
            {action.undone ? (
              <span className="text-xs text-muted-foreground">
                <Trans>Undone</Trans>
              </span>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={busyBatchId === action.batchId}
                onClick={() => onUndo(action.batchId)}
              >
                <Trans>Undo</Trans>
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
