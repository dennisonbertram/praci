import { plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { LegalDeadline, LegalDeadlineStatus } from "@rakazo/contracts";
import { Button, cn } from "@rakazo/ui-web";
import { useState } from "react";
import { Link } from "react-router-dom";
import { DATA_ROOM_PATH } from "../../lib/data-room";
import { fullDay } from "../../lib/finance-format";
import { daysBetween, todayIso } from "../../lib/legal-format";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";

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
  const close = async (deadline: LegalDeadline, status: LegalDeadlineStatus) => {
    setClosing(deadline.id);
    setError("");
    try {
      await rpc.legal.updateDeadline({ id: deadline.id, status });
      setGone((ids) => new Set(ids).add(deadline.id));
      onChanged();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setClosing(null);
    }
  };
  const open = deadlines.filter((deadline) => !gone.has(deadline.id));
  if (open.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        <Trans>No open deadlines.</Trans>
      </p>
    );
  }
  return (
    <div>
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
                    {deadline.sourceQuote}
                  </blockquote>
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
