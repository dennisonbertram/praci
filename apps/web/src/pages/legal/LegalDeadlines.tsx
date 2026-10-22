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
import { NOTIFICATIONS_CHANGED_EVENT } from "../../lib/use-sidebar-glance";
import { errorText } from "../../lib/user-error";

/** How long the Undo stays after Done or Dismiss. */
const UNDO_MS = 30_000;
/** Deadlines closer than this get a "due in N days" line. */
const SOON_DAYS = 30;

const rowHeight = (event: React.MouseEvent<HTMLElement>) =>
  event.currentTarget.closest("li")?.getBoundingClientRect().height ?? 0;

/** The title as the row shows it: the contract is part of it, so no two rows read alike. */
const fullTitle = (deadline: LegalDeadline) =>
  maskCurrencyWhenHidden(
    deadline.contractTitle ? `${deadline.title}: ${deadline.contractTitle}` : deadline.title,
  );

/** Open deadlines, soonest first. Done and Dismiss close one; `onChanged` reloads the page's numbers. */
export function LegalDeadlines({
  deadlines,
  onChanged,
  today = todayIso(),
  onlyOverdue = false,
  onShowAll,
  onAsk,
}: {
  deadlines: LegalDeadline[];
  onChanged: () => void;
  today?: string;
  /** Lists only the overdue deadlines, with a way back to all of them. */
  onlyOverdue?: boolean;
  onShowAll?: () => void;
  /** Opens the Legal agent with this deadline as the question; without it no row offers Ask agent. */
  onAsk?: (deadline: LegalDeadline) => void;
}) {
  const [closing, setClosing] = useState<string | null>(null);
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState("");
  const [undo, setUndo] = useState<{
    deadline: LegalDeadline;
    status: LegalDeadlineStatus;
    /** The closed row's height, so the Undo line holds its place and the list does not move. */
    height: number;
  } | null>(null);
  useHideAmounts();
  const undoTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(undoTimer.current), []);
  const close = async (deadline: LegalDeadline, status: LegalDeadlineStatus, height: number) => {
    setClosing(deadline.id);
    setError("");
    try {
      await rpc.legal.updateDeadline({ id: deadline.id, status });
      setGone((ids) => new Set(ids).add(deadline.id));
      setUndo({ deadline, status, height });
      clearTimeout(undoTimer.current);
      undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS);
      onChanged();
      // The sidebar Legal badge counts open deadlines, so it refreshes now, not on the next page change.
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
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
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
    } catch (cause) {
      setError(errorText(cause));
    }
  };
  const allOpen = deadlines.filter((deadline) => !gone.has(deadline.id));
  const open = onlyOverdue
    ? allOpen.filter((deadline) => daysBetween(today, deadline.dueDate) < 0)
    : allOpen;
  const filterBar = onlyOverdue ? (
    <p className="mb-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      {plural(open.length, {
        one: "Showing # overdue deadline.",
        other: "Showing # overdue deadlines.",
      })}
      {onShowAll ? (
        <Button size="sm" variant="ghost" onClick={onShowAll}>
          {plural(allOpen.length, {
            one: "Show all # open deadline",
            other: "Show all # open deadlines",
          })}
        </Button>
      ) : null}
    </p>
  ) : null;
  // The closed row's slot holds the Undo line, so the rows below do not move.
  const undoLine = undo ? (
    <>
      {undo.status === "done" ? (
        <Trans>Marked {fullTitle(undo.deadline)} done.</Trans>
      ) : (
        <Trans>Dismissed {fullTitle(undo.deadline)}.</Trans>
      )}
      <Button size="sm" variant="ghost" onClick={() => void reopen()}>
        <Trans>Undo</Trans>
      </Button>
    </>
  ) : null;
  if (open.length === 0) {
    return (
      <div>
        {filterBar}
        {undoLine ? (
          <div role="status" className="mb-2 flex h-8 items-center gap-2 text-sm">
            {undoLine}
          </div>
        ) : null}
        <p className="py-8 text-center text-sm text-muted-foreground">
          {onlyOverdue ? <Trans>Nothing is overdue.</Trans> : <Trans>No open deadlines.</Trans>}
        </p>
      </div>
    );
  }
  return (
    <div>
      {filterBar}
      {error ? (
        <p role="alert" className="mb-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <ul className="flex flex-col">
        {deadlines.map((deadline) => {
          if (undo?.deadline.id === deadline.id && gone.has(deadline.id)) {
            return (
              <li
                key={deadline.id}
                role="status"
                style={{ minHeight: undo.height }}
                className="flex items-center gap-2 border-t border-border py-2.5 text-sm"
              >
                {undoLine}
              </li>
            );
          }
          if (!open.includes(deadline)) return null;
          const days = daysBetween(today, deadline.dueDate);
          const overdue = days < 0;
          const late = -days;
          // The visible title includes the contract, so the button names do too.
          const name = fullTitle(deadline);
          return (
            <li
              key={deadline.id}
              className="flex flex-wrap items-start gap-x-4 gap-y-2 border-t border-border py-2.5"
            >
              <div className="min-w-0 flex-1 basis-64">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  {/* The contract is part of the title, so no two rows open with the same words. */}
                  <span className="font-medium">
                    {maskCurrencyWhenHidden(deadline.title)}
                    {deadline.contractTitle ? (
                      <>
                        {": "}
                        {deadline.dataRoomItemId ? (
                          <Link
                            to={`${DATA_ROOM_PATH}?item=${deadline.dataRoomItemId}`}
                            className="hover:underline"
                          >
                            {maskCurrencyWhenHidden(deadline.contractTitle)}
                          </Link>
                        ) : (
                          maskCurrencyWhenHidden(deadline.contractTitle)
                        )}
                      </>
                    ) : null}
                  </span>
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
                {onAsk ? (
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={t`Ask agent about ${name}`}
                    onClick={() => onAsk(deadline)}
                  >
                    <Trans>Ask agent</Trans>
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={closing === deadline.id}
                  aria-label={t`Mark ${name} done`}
                  onClick={(event) => void close(deadline, "done", rowHeight(event))}
                >
                  <Trans>Done</Trans>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={closing === deadline.id}
                  title={t`Not a real deadline: hide it`}
                  aria-label={t`Dismiss ${name}`}
                  onClick={(event) => void close(deadline, "dismissed", rowHeight(event))}
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
