import { plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { LegalDeadline, LegalDeadlineKind, LegalDeadlineStatus } from "@rakazo/contracts";
import { Button, cn } from "@rakazo/ui-web";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { PickFilter, SearchField, SortControl } from "../../components/ListControls";
import { DATA_ROOM_PATH } from "../../lib/data-room";
import { fullDay } from "../../lib/finance-format";
import { maskCurrencyWhenHidden, useHideAmounts } from "../../lib/hide-amounts-preference";
import { daysBetween, isDueSoon, todayIso, utcTodayIso } from "../../lib/legal-format";
import { legalDataRoomState } from "../../lib/legal-navigation";
import { sortBy, useListParams } from "../../lib/list-params";
import { rpc } from "../../lib/rpc";
import { NOTIFICATIONS_CHANGED_EVENT } from "../../lib/use-sidebar-glance";
import { errorText } from "../../lib/user-error";

/** How long the Undo stays after Done or Dismiss. */
const UNDO_MS = 30_000;
/** Deadlines closer than this get a "due in N days" line. */
const SOON_DAYS = 30;

/** The sentence the Legal agent adds to every derived notice deadline; the list says it once. */
const DERIVED_NOTE = "Derived from the expiration date and the notice period.";

/** A row's own note: without the shared sentence, and with any ISO date written as the page writes dates. */
const rowNote = (notes: string | null) =>
  (notes ?? "")
    .replace(DERIVED_NOTE, "")
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, (iso) => fullDay(iso))
    .trim();

/** The title as the row shows it: the contract is part of it, so no two rows read alike. */
const fullTitle = (deadline: LegalDeadline) =>
  maskCurrencyWhenHidden(
    deadline.contractTitle ? `${deadline.title}: ${deadline.contractTitle}` : deadline.title,
  );

const SORTS = ["due", "contract"] as const;
type DeadlineSort = (typeof SORTS)[number];

const kindNames = (): Record<LegalDeadlineKind, string> => ({
  renewal: t`Renewal`,
  notice: t`Notice`,
  termination: t`Termination`,
  payment: t`Payment`,
  filing: t`Filing`,
  compliance: t`Compliance`,
  other: t`Other`,
});

/** Open deadlines, soonest first. Done and Dismiss close one; `onChanged` reloads the page's numbers. */
export function LegalDeadlines({
  deadlines,
  onChanged,
  today,
  onAsk,
}: {
  deadlines: LegalDeadline[];
  onChanged: () => void;
  /** Tests pin the date; otherwise Overdue uses the viewer's date and Due soon the server's (UTC), as the sidebar count does. */
  today?: string;
  /** Opens the Legal agent with this deadline as the question; without it no row offers Ask agent. */
  onAsk?: (deadline: LegalDeadline) => void;
}) {
  const location = useLocation();
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState("");
  const [reopening, setReopening] = useState<ReadonlySet<string>>(new Set());
  const [keeping, setKeeping] = useState<ReadonlySet<string>>(new Set());
  const reopeningRef = useRef(new Set<string>());
  const keepingRef = useRef(new Set<string>());
  const [undo, setUndo] = useState<{
    deadline: LegalDeadline;
    status: LegalDeadlineStatus;
    /** Where the row stood, for when the refetched list no longer holds it. */
    index: number;
  } | null>(null);
  useHideAmounts();
  const undoTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  /** The latest close request, so Undo waits for it instead of racing it. */
  const closing = useRef<Promise<boolean>>(Promise.resolve(true));
  useEffect(() => () => clearTimeout(undoTimer.current), []);
  useEffect(() => {
    const present = new Set(deadlines.map((deadline) => deadline.id));
    setKeeping((ids) => {
      const next = new Set([...ids].filter((id) => present.has(id)));
      for (const id of keepingRef.current) {
        if (!present.has(id)) keepingRef.current.delete(id);
      }
      return next.size === ids.size ? ids : next;
    });
  }, [deadlines]);
  const close = (deadline: LegalDeadline, status: LegalDeadlineStatus) => {
    const request = send(deadline, status);
    closing.current = request;
    return request;
  };
  const send = async (deadline: LegalDeadline, status: LegalDeadlineStatus) => {
    const index = deadlines.indexOf(deadline);
    setError("");
    // The row leaves at once with its Undo line; the request settles behind it.
    setGone((ids) => new Set(ids).add(deadline.id));
    setUndo({ deadline, status, index });
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS);
    try {
      await rpc.legal.updateDeadline({ id: deadline.id, status });
      onChanged();
      // The sidebar Legal badge counts open deadlines, so it refreshes now, not on the next page change.
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
      return true;
    } catch (cause) {
      if ((cause as { code?: string } | null)?.code === "NOT_FOUND") {
        setUndo((current) => (current?.deadline.id === deadline.id ? null : current));
        onChanged();
        window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
        return false;
      }
      setGone((ids) => {
        const next = new Set(ids);
        next.delete(deadline.id);
        return next;
      });
      // Only this row's Undo; another row may have closed since.
      setUndo((current) => (current?.deadline.id === deadline.id ? null : current));
      setError(errorText(cause));
      return false;
    }
  };
  const reopen = async () => {
    if (!undo) return;
    const id = undo.deadline.id;
    if (reopeningRef.current.has(id)) return;
    reopeningRef.current.add(id);
    setReopening((ids) => new Set(ids).add(id));
    setError("");
    // A failed close already put the row back and reported the error.
    try {
      if (!(await closing.current)) return;
      await rpc.legal.updateDeadline({ id: undo.deadline.id, status: "open" });
      setGone((ids) => {
        const next = new Set(ids);
        next.delete(id);
        return next;
      });
      setUndo((current) => (current?.deadline.id === id ? null : current));
      onChanged();
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setReopening((ids) => {
        const next = new Set(ids);
        next.delete(id);
        return next;
      });
      reopeningRef.current.delete(id);
    }
  };
  const keep = async (deadline: LegalDeadline) => {
    if (keepingRef.current.has(deadline.id)) return;
    keepingRef.current.add(deadline.id);
    setKeeping((ids) => new Set(ids).add(deadline.id));
    setError("");
    try {
      await rpc.legal.updateDeadline({ id: deadline.id, keep: true });
      onChanged();
    } catch (cause) {
      setError(errorText(cause));
      setKeeping((ids) => {
        const next = new Set(ids);
        next.delete(deadline.id);
        return next;
      });
      keepingRef.current.delete(deadline.id);
    }
  };
  const allOpen = deadlines.filter((deadline) => !gone.has(deadline.id));
  // Search, filters and sort live in the URL: ?q=, contract, kind, due (overdue or soon), sort, dir.
  const list = useListParams(SORTS, { field: "due", dir: "asc" });
  const filters = {
    q: list.param("q"),
    contract: list.param("contract"),
    kind: list.param("kind"),
    due: list.param("due"),
  };
  const filtered = Object.values(filters).some(Boolean);
  const needle = filters.q?.trim().toLowerCase();
  const open = allOpen.filter(
    (d) =>
      (!needle ||
        [d.title, d.contractTitle, d.notes].some((text) => text?.toLowerCase().includes(needle))) &&
      (!filters.contract || d.contractTitle === filters.contract) &&
      (!filters.kind || d.kind === filters.kind) &&
      (filters.due === "overdue"
        ? daysBetween(today ?? todayIso(), d.dueDate) < 0
        : filters.due === "soon"
          ? isDueSoon(d.dueDate, today ?? utcTodayIso())
          : true),
  );
  const names = kindNames();
  const sortNames: Record<DeadlineSort, string> = { due: t`Due date`, contract: t`Contract` };
  const toolbar =
    allOpen.length > 0 ? (
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <SearchField
          name="deadlines-search"
          value={filters.q ?? ""}
          onChange={(value) => list.setParam("q", value)}
          placeholder={t`Search deadlines`}
          label={t`Search deadlines`}
          className="w-56"
        />
        <PickFilter
          label={t`Contract`}
          value={filters.contract}
          options={[
            ...new Set(deadlines.flatMap((d) => (d.contractTitle ? [d.contractTitle] : []))),
          ]
            .sort((a, b) => a.localeCompare(b))
            .map((title) => [title, title])}
          onChange={(value) => list.setParam("contract", value)}
        />
        <PickFilter
          label={t`Kind`}
          value={filters.kind}
          options={[...new Set(deadlines.map((d) => d.kind))].map((kind) => [kind, names[kind]])}
          onChange={(value) => list.setParam("kind", value)}
        />
        <PickFilter
          label={t`Due`}
          value={filters.due}
          options={[
            ["overdue", t`Overdue`],
            ["soon", t`Due soon`],
          ]}
          onChange={(value) => list.setParam("due", value)}
        />
        <span className="ms-auto flex items-center gap-1">
          <SortControl
            fields={SORTS.map((field) => [field, sortNames[field]])}
            field={list.sort.field}
            fieldLabel={sortNames[list.sort.field]}
            direction={list.sort.dir}
            onField={(field) => list.setSort({ field, dir: "asc" })}
            onDirection={(dir) => list.setSort({ field: list.sort.field, dir })}
          />
        </span>
      </div>
    ) : null;
  // The closed row's slot holds the Undo line, so the rows below do not move.
  const undoLine = undo ? (
    <>
      {undo.status === "done" ? (
        <Trans>Marked {fullTitle(undo.deadline)} done.</Trans>
      ) : (
        <Trans>Dismissed {fullTitle(undo.deadline)}.</Trans>
      )}
      <Button
        size="sm"
        variant="ghost"
        disabled={reopening.has(undo.deadline.id)}
        onClick={() => void reopen()}
      >
        <Trans>Undo</Trans>
      </Button>
    </>
  ) : null;
  // The page reloads after Done and the server lists open deadlines only, so the closed row is put back at its place for the Undo line.
  const placed =
    undo && !deadlines.some((deadline) => deadline.id === undo.deadline.id)
      ? deadlines.toSpliced(undo.index, 0, undo.deadline)
      : deadlines;
  const rows = sortBy(
    placed,
    (d) => (list.sort.field === "due" ? d.dueDate : d.contractTitle),
    list.sort.dir,
  );
  if (open.length === 0) {
    return (
      <div>
        {toolbar}
        {error ? (
          <p role="alert" className="mb-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {undoLine ? (
          <div role="status" className="mb-2 flex h-8 items-center gap-2 text-sm">
            {undoLine}
          </div>
        ) : null}
        <p className="py-8 text-center text-sm text-muted-foreground">
          {filtered ? <Trans>No matches</Trans> : <Trans>No open deadlines.</Trans>}
        </p>
        {filtered && allOpen.length > 0 ? (
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => list.clear("q", "contract", "kind", "due")}
            >
              <Trans>Clear filters</Trans>
            </Button>
          </div>
        ) : null}
      </div>
    );
  }
  return (
    <div>
      {toolbar}
      {error ? (
        <p role="alert" className="mb-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <ul className="flex flex-col">
        {rows.map((deadline) => {
          if (undo?.deadline.id === deadline.id && gone.has(deadline.id)) {
            return (
              <li
                key={deadline.id}
                role="status"
                className="flex items-center gap-2 border-t border-border py-1 text-sm"
              >
                {undoLine}
              </li>
            );
          }
          if (!open.includes(deadline)) return null;
          const days = daysBetween(today ?? todayIso(), deadline.dueDate);
          const overdue = days < 0;
          const late = -days;
          // The visible title includes the contract, so the button names do too.
          const name = fullTitle(deadline);
          // The open deadline of the same contract, kind and date that the scan kept: the one to keep instead.
          const replacement = deadline.removalProposed
            ? deadlines.find(
                (other) =>
                  !other.removalProposed &&
                  other.id !== deadline.id &&
                  other.dueDate === deadline.dueDate &&
                  other.dataRoomItemId === deadline.dataRoomItemId &&
                  other.contractTitle === deadline.contractTitle &&
                  other.kind === deadline.kind,
              )
            : undefined;
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
                            state={legalDataRoomState(location)}
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
                {rowNote(deadline.notes) ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {maskCurrencyWhenHidden(rowNote(deadline.notes))}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <time
                  dateTime={deadline.dueDate}
                  className={cn(
                    "w-32 shrink-0 text-sm tabular-nums",
                    overdue && "font-medium text-destructive",
                  )}
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
                    aria-label={t`Mark ${name} done`}
                    onClick={() => void close(deadline, "done")}
                  >
                    <Trans>Done</Trans>
                  </Button>
                  {deadline.removalProposed ? null : (
                    <Button
                      size="sm"
                      variant="ghost"
                      title={t`Not a real deadline: hide it`}
                      aria-label={t`Dismiss ${name}`}
                      onClick={() => void close(deadline, "dismissed")}
                    >
                      <Trans>Dismiss</Trans>
                    </Button>
                  )}
                </div>
              </div>
              {deadline.removalProposed ? (
                <div className="flex basis-full flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  {replacement ? (
                    <Trans>
                      Replaced by {maskCurrencyWhenHidden(replacement.title)} on{" "}
                      {fullDay(replacement.dueDate)}.
                    </Trans>
                  ) : (
                    <Trans>The last scan thinks this no longer applies.</Trans>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={keeping.has(deadline.id)}
                    aria-label={t`Keep ${name}`}
                    onClick={() => void keep(deadline)}
                  >
                    <Trans>Keep this deadline</Trans>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={t`Remove ${name}`}
                    onClick={() => void close(deadline, "dismissed")}
                  >
                    <Trans>Remove this one</Trans>
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {open.some((deadline) => deadline.notes?.includes(DERIVED_NOTE)) ? (
        <p className="mt-3 text-xs text-muted-foreground">
          <Trans>
            Notice deadlines are derived from the expiration date and the notice period.
          </Trans>
        </p>
      ) : null}
    </div>
  );
}
