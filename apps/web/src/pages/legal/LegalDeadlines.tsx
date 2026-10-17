import { plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { LegalDeadline, LegalDeadlineStatus } from "@rakazo/contracts";
import { Button, cn } from "@rakazo/ui-web";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { DATA_ROOM_PATH } from "../../lib/data-room";
import { fullDay } from "../../lib/finance-format";
import { maskCurrencyWhenHidden, useHideAmounts } from "../../lib/hide-amounts-preference";
import { daysBetween, todayIso } from "../../lib/legal-format";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";

/** How long the Undo stays after Done or Dismiss. */
const UNDO_MS = 8_000;
/** Deadlines closer than this get a "due in N days" line. */
const SOON_DAYS = 30;

/** Open deadlines, soonest first. Done and Dismiss close one; `onChanged` reloads the page's numbers. */
export function LegalDeadlines({
  deadlines,
  onChanged,
  today = todayIso(),
}: {
  deadlines: LegalDeadline[];
  onChanged: () => void;
  today?: string;
}) {
  const [closing, setClosing] = useState<string | null>(null);
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState("");
  const [undo, setUndo] = useState<{ deadline: LegalDeadline; status: LegalDeadlineStatus } | null>(
    null,
  );
  useHideAmounts();
  const undoTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(undoTimer.current), []);
  const close = async (deadline: LegalDeadline, status: LegalDeadlineStatus) => {
    setClosing(deadline.id);
    setError("");
    try {
      await rpc.legal.updateDeadline({ id: deadline.id, status });
      setGone((ids) => new Set(ids).add(deadline.id));
      setUndo({ deadline, status });
      clearTimeout(undoTimer.current);
      undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS);
      onChanged();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setClosing(null);
    }
  };
  const reopen = async () => {
    if (!undo) return;
    setError("");
    try {
      await rpc.legal.updateDeadline({ id: undo.deadline.id, status: "open" });
      setGone((ids) => {
        const next = new Set(ids);
        next.delete(undo.deadline.id);
        return next;
      });
      setUndo(null);
      onChanged();
    } catch (cause) {
      setError(errorText(cause));
    }
  };
  const open = deadlines.filter((deadline) => !gone.has(deadline.id));
  const undoBar = undo ? (
    <p role="status" className="mb-2 flex items-center gap-2 text-sm">
      {undo.status === "done" ? (
        <Trans>Marked {undo.deadline.title} done.</Trans>
      ) : (
        <Trans>Dismissed {undo.deadline.title}.</Trans>
      )}
      <Button size="sm" variant="ghost" onClick={() => void reopen()}>
        <Trans>Undo</Trans>
      </Button>
    </p>
  ) : null;
  if (open.length === 0) {
    return (
      <div>
        {undoBar}
        <p className="py-8 text-center text-sm text-muted-foreground">
          <Trans>No open deadlines.</Trans>
        </p>
      </div>
    );
  }
  return (
    <div>
      {undoBar}
      {error ? (
        <p role="alert" className="mb-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <ul className="flex flex-col">
        {open.map((deadline) => {
          const days = daysBetween(today, deadline.dueDate);
          const overdue = days < 0;
          const late = -days;
          return (
            <li
              key={deadline.id}
              className="flex flex-wrap items-start gap-x-4 gap-y-2 border-t border-border py-2.5"
            >
              <div className="min-w-0 flex-1 basis-64">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{deadline.title}</span>
                  {overdue ? (
                    <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
                      {plural(late, { one: "Overdue by # day", other: "Overdue by # days" })}
                    </span>
                  ) : days <= SOON_DAYS ? (
                    <span className="text-xs text-muted-foreground">
                      {days === 0 ? (
                        <Trans>Due today</Trans>
                      ) : days === 1 ? (
                        <Trans>Due tomorrow</Trans>
                      ) : (
                        plural(days, { one: "Due in # day", other: "Due in # days" })
                      )}
                    </span>
                  ) : null}
                </div>
                <div className="text-xs text-muted-foreground">
                  {deadline.contractTitle && deadline.dataRoomItemId ? (
                    <Link
                      to={`${DATA_ROOM_PATH}?item=${deadline.dataRoomItemId}`}
                      className="hover:underline"
                    >
                      {deadline.contractTitle}
                    </Link>
                  ) : (
                    deadline.contractTitle
                  )}
                </div>
                {deadline.sourceQuote ? (
                  <blockquote className="mt-1 border-s-2 border-border ps-2 text-xs text-muted-foreground">
                    {maskCurrencyWhenHidden(deadline.sourceQuote)}
                  </blockquote>
                ) : null}
                {deadline.notes ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {maskCurrencyWhenHidden(deadline.notes)}
                  </p>
                ) : null}
              </div>
              <time
                dateTime={deadline.dueDate}
                className={cn("text-sm tabular-nums", overdue && "font-medium text-destructive")}
              >
                {fullDay(deadline.dueDate)}
              </time>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={closing === deadline.id}
                  aria-label={t`Mark ${deadline.title} done`}
                  onClick={() => void close(deadline, "done")}
                >
                  <Trans>Done</Trans>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={closing === deadline.id}
                  aria-label={t`Dismiss ${deadline.title}`}
                  onClick={() => void close(deadline, "dismissed")}
                >
                  <Trans>Dismiss</Trans>
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
