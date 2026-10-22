import { plural, t } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import type { RunActivityRow, RunStatus } from "@rakazo/contracts";
import { isAgedStuckWork } from "@rakazo/core";
import {
  Button,
  Input,
  Label,
  NativeSelect,
  NativeSelectOption,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@rakazo/ui-web";
import type { ReactNode, Ref } from "react";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { RowsSkeleton } from "../components/RowsSkeleton";
import type { ActivityListFilters } from "../lib/activity-list-filters";
import {
  activityFiltersActive,
  clearActivityFilterField,
  emptyActivityFilters,
  filterActivityRuns,
} from "../lib/activity-list-filters";
import { needsAnswerLabel } from "../lib/roster-status";
import { formatRosterTime } from "../lib/roster-time";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";

export function statusTone(status: RunActivityRow["status"], updatedAt?: string): string {
  if (status === "failed") return "text-destructive";
  if (status === "cancelled") return "text-muted-foreground";
  if (status === "completed") return "text-success";
  if (status === "waiting_input" || status === "waiting_takeover") return "text-warning";
  if (updatedAt && isAgedStuckWork(status, updatedAt)) return "text-warning";
  return "text-foreground";
}

type ActivityListProps = {
  onOpenRun: (run: RunActivityRow) => void;
  /** The bots whose active runs are listed here, so the chat list can skip them while this is open. */
  onListedBots?: (botIds: ReadonlySet<string>) => void;
};

export function ActivityList({ onOpenRun, onListedBots }: ActivityListProps) {
  const { t } = useLingui();
  const [activeRuns, setActiveRuns] = useState<RunActivityRow[]>([]);
  const [recentRuns, setRecentRuns] = useState<RunActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ActivityListFilters>(emptyActivityFilters);

  const reloadRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    let generation = 0;

    const load = () => {
      const requestId = ++generation;
      if (timer !== undefined) {
        window.clearTimeout(timer);
        timer = undefined;
      }
      void (async () => {
        try {
          // Each list renders as soon as it arrives; the second need not hold up the first.
          const fresh = () => !cancelled && requestId === generation;
          await Promise.all([
            rpc.runs.list({ filter: "active" }).then((result) => {
              if (!fresh()) return;
              setActiveRuns(result.runs);
              setLoading(false);
            }),
            rpc.runs.list({ filter: "recent" }).then((result) => {
              if (fresh()) setRecentRuns(result.runs);
            }),
          ]);
          if (fresh()) setError(null);
        } catch (err) {
          if (cancelled || requestId !== generation) return;
          setError(errorText(err, t`Could not load activity`));
        } finally {
          if (!cancelled && requestId === generation) {
            setLoading(false);
            timer = window.setTimeout(load, 15_000);
          }
        }
      })();
    };

    reloadRef.current = () => {
      setLoading(true);
      setError(null);
      load();
    };
    load();
    return () => {
      cancelled = true;
      reloadRef.current = null;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [t]);

  const filteredActive = useMemo(
    () => filterActivityRuns(activeRuns, filters),
    [activeRuns, filters],
  );
  useEffect(() => {
    onListedBots?.(new Set(filteredActive.map((run) => run.botId)));
    return () => onListedBots?.(new Set());
  }, [filteredActive, onListedBots]);

  const filteredRecent = useMemo(
    () => filterActivityRuns(recentRuns, filters),
    [recentRuns, filters],
  );

  const filtersOn = activityFiltersActive(filters);
  const [showFilters, setShowFilters] = useState(false);
  const [showFinished, setShowFinished] = useState(false);
  const finishedRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (showFinished) finishedRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [showFinished]);
  // What needs the person comes first; the rest of the active work follows as "Working".
  const needsYou = filteredActive.filter((run) => NEEDS_YOU.has(run.status));
  const working = filteredActive.filter((run) => !NEEDS_YOU.has(run.status));
  const hasAnyRuns = activeRuns.length > 0 || recentRuns.length > 0;
  const hasVisibleRuns = filteredActive.length > 0 || filteredRecent.length > 0;

  // The list ends on a whole row: its height stops at the bottom of the last row that fits.
  const rowsRef = useRef<HTMLDivElement>(null);
  const layoutKey = [...filteredActive, ...filteredRecent]
    .map((run) => `${run.runId}${run.status}`)
    .join();
  // biome-ignore lint/correctness/useExhaustiveDependencies: layoutKey, showFinished and error change which rows are drawn
  useLayoutEffect(() => {
    const scroller = rowsRef.current;
    if (!scroller) return;
    const fit = () => {
      scroller.style.maxHeight = "";
      // Expanded finished runs are what the person asked for: show them all, and let the sidebar scroll.
      if (showFinished) return;
      const top = scroller.getBoundingClientRect().top;
      const endOf = (row: Element) => row.getBoundingClientRect().bottom - top + scroller.scrollTop;
      // Everything waiting on the person always shows; the other runs share what is left of 30% of the window.
      const needsRows = scroller.querySelectorAll(
        '[aria-labelledby="activity-needs-heading"] [data-activity-row]',
      );
      const lastNeeds = needsRows[needsRows.length - 1];
      const limit = Math.max(window.innerHeight * 0.3, lastNeeds ? endOf(lastNeeds) : 0);
      if (scroller.scrollHeight <= limit) return;
      let bottom = 0;
      for (const row of scroller.querySelectorAll("[data-activity-row]")) {
        const end = endOf(row);
        if (end <= limit) bottom = end;
      }
      if (bottom > 0) scroller.style.maxHeight = `${Math.ceil(bottom)}px`;
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [layoutKey, showFinished, error]);

  if (loading && !hasAnyRuns && !filtersOn) {
    return <RowsSkeleton rows={3} className="px-2.5 py-2" />;
  }

  if (!hasAnyRuns && !filtersOn) {
    if (!error)
      return (
        <div className="mb-2 border-b border-border px-2.5 pb-3 pt-1">
          <h2 className="text-[13px] font-medium text-foreground">
            <Trans>Activity</Trans>
          </h2>
          <p className="text-[13px] text-muted-foreground/80" role="status">
            <Trans>Nothing needs you right now.</Trans>
          </p>
        </div>
      );
    return (
      <div className="px-2.5 py-2" role="alert">
        <ActivityError error={error} onRetry={() => reloadRef.current?.()} />
      </div>
    );
  }

  return (
    <div
      className="mb-2 flex shrink-0 snap-start flex-col border-b border-border pb-2"
      data-testid="activity-list"
    >
      <div className="flex items-center justify-between px-2.5 pb-1">
        <h2 className="text-[13px] font-medium text-foreground">
          <Trans>Activity</Trans>
        </h2>
        {/* A popover, so the filter form never takes the list's space. */}
        <Popover open={showFilters} onOpenChange={setShowFilters}>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 rounded-full px-2 text-[12px] text-muted-foreground"
                data-testid="activity-show-filters"
              />
            }
          >
            <Trans>Filter</Trans>
            {filtersOn ? (
              <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
            ) : null}
          </PopoverTrigger>
          <PopoverContent side="right" align="start" className="w-72" initialFocus={false}>
            <ActivityFilters filters={filters} onChange={setFilters} />
          </PopoverContent>
        </Popover>
      </div>
      <div ref={rowsRef} className="min-h-0 flex-1 overflow-y-auto" data-testid="activity-rows">
        {error ? (
          <div className="px-2.5 pb-2" role="alert">
            <ActivityError error={error} onRetry={() => reloadRef.current?.()} compact />
          </div>
        ) : null}

        {loading && !hasAnyRuns ? (
          <p className="px-2.5 py-2 text-[13px] text-muted-foreground/80" role="status">
            <Trans>Loading activity…</Trans>
          </p>
        ) : !error && filtersOn && hasAnyRuns && !hasVisibleRuns ? (
          <p className="px-2.5 py-2 text-[13px] text-muted-foreground/80" role="status">
            <Trans>No runs match these filters.</Trans>
          </p>
        ) : null}

        {/* Each row names its own state, so this group's heading is for screen readers only. */}
        <ActivitySection id="activity-needs-heading" title={<Trans>Needs you</Trans>} titleHidden>
          {needsYou.map((run) => (
            <ActivityRow key={run.runId} run={run} onOpen={() => onOpenRun(run)} />
          ))}
        </ActivitySection>
        <ActivitySection id="activity-now-heading" title={<Trans>Working</Trans>}>
          {working.map((run) => (
            <ActivityRow key={run.runId} run={run} onOpen={() => onOpenRun(run)} compact />
          ))}
        </ActivitySection>
        {needsYou.length === 0 && working.length === 0 && !filtersOn ? (
          <p className="px-2.5 py-1 text-[13px] text-muted-foreground/80" role="status">
            <Trans>Nothing needs you right now.</Trans>
          </p>
        ) : null}
        {/* Finished runs need nothing from the person, so they stay folded unless filtering. */}
        {filteredRecent.length > 0 && !showFinished && !filtersOn ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-full justify-start rounded-xl px-2.5 text-[12.5px] font-medium text-muted-foreground/80"
            data-testid="activity-show-finished"
            aria-expanded={false}
            onClick={() => setShowFinished(true)}
          >
            {plural(filteredRecent.length, {
              one: "Show # finished run",
              other: "Show # finished runs",
            })}
          </Button>
        ) : (
          <ActivitySection
            id="activity-recent-heading"
            title={<Trans>Finished</Trans>}
            headingRef={finishedRef}
          >
            {filteredRecent.map((run) => (
              <ActivityRow key={run.runId} run={run} onOpen={() => onOpenRun(run)} />
            ))}
          </ActivitySection>
        )}
      </div>
    </div>
  );
}

const NEEDS_YOU = new Set<RunStatus>(["waiting_input", "waiting_takeover"]);

/** A titled group of runs; renders nothing when it has none. */
function ActivitySection({
  id,
  title,
  titleHidden = false,
  headingRef,
  children,
}: {
  id: string;
  title: ReactNode;
  titleHidden?: boolean;
  headingRef?: Ref<HTMLDivElement>;
  children: ReactNode[];
}) {
  if (children.length === 0) return null;
  return (
    <section className="mt-1 first:mt-0" aria-labelledby={id}>
      <div
        id={id}
        ref={headingRef}
        className={
          titleHidden
            ? "sr-only"
            : "px-2.5 pb-1 pt-1 text-[12.5px] font-medium text-muted-foreground/80"
        }
      >
        {title}
      </div>
      {children}
    </section>
  );
}

const STATUS_FILTERS: RunStatus[] = [
  "running",
  "queued",
  "leased",
  "waiting_input",
  "waiting_takeover",
  "completed",
  "failed",
  "cancelled",
];

function ActivityError({
  error,
  onRetry,
  compact = false,
}: {
  error: string;
  onRetry: () => void;
  compact?: boolean;
}) {
  return (
    <>
      <p className={`${compact ? "text-[12.5px]" : "text-[13px]"} text-destructive`}>{error}</p>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="mt-2 rounded-full"
        onClick={onRetry}
      >
        <Trans>Try again</Trans>
      </Button>
    </>
  );
}

function ActivityFilters({
  filters,
  onChange,
}: {
  filters: ActivityListFilters;
  onChange: (next: ActivityListFilters) => void;
}) {
  const { t } = useLingui();
  const searchId = useId();
  const statusId = useId();
  const fromId = useId();
  const toId = useId();
  const filtersOn = activityFiltersActive(filters);
  const statusLabelText = filters.status === "all" ? null : statusLabel(filters.status);

  return (
    <div className="flex flex-col gap-2">
      <div>
        <Label htmlFor={statusId} className="text-[12.5px] text-muted-foreground/80">
          <Trans>Status</Trans>
        </Label>
        <NativeSelect
          id={statusId}
          data-testid="activity-status-filter"
          value={filters.status}
          onChange={(event) =>
            onChange({
              ...filters,
              status: event.target.value as ActivityListFilters["status"],
            })
          }
          className="mt-1 w-full"
        >
          <NativeSelectOption value="all">{t`All statuses`}</NativeSelectOption>
          {STATUS_FILTERS.map((status) => (
            <NativeSelectOption key={status} value={status}>
              {statusLabel(status)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <details className="group">
        <summary className="cursor-pointer text-[12.5px] text-muted-foreground/80">
          <Trans>More filters</Trans>
        </summary>
        <div className="mt-2 flex flex-col gap-2">
          <div>
            <Label htmlFor={searchId} className="sr-only">
              <Trans>Search activity</Trans>
            </Label>
            <Input
              id={searchId}
              data-testid="activity-search"
              value={filters.query}
              onChange={(event) => onChange({ ...filters, query: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === "Escape") onChange(clearActivityFilterField(filters, "query"));
              }}
              placeholder={t`Search runs`}
              autoComplete="off"
              className="rounded-xl bg-card text-[13px] dark:bg-input"
            />
          </div>
          <div>
            <Label htmlFor={fromId} className="text-[12.5px] text-muted-foreground/80">
              <Trans>From</Trans>
            </Label>
            <Input
              id={fromId}
              data-testid="activity-date-from"
              type="date"
              value={filters.dateRange.from}
              onChange={(event) =>
                onChange({
                  ...filters,
                  dateRange: { ...filters.dateRange, from: event.target.value },
                })
              }
              className="mt-1 rounded-xl bg-card text-[13px] dark:bg-input"
            />
          </div>
          <div>
            <Label htmlFor={toId} className="text-[12.5px] text-muted-foreground/80">
              <Trans>To</Trans>
            </Label>
            <Input
              id={toId}
              data-testid="activity-date-to"
              type="date"
              value={filters.dateRange.to}
              onChange={(event) =>
                onChange({
                  ...filters,
                  dateRange: { ...filters.dateRange, to: event.target.value },
                })
              }
              className="mt-1 rounded-xl bg-card text-[13px] dark:bg-input"
            />
          </div>
        </div>
      </details>
      {filtersOn ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.query.trim() ? (
            <FilterChip
              label={t`Search: ${filters.query.trim()}`}
              onClear={() => onChange(clearActivityFilterField(filters, "query"))}
            />
          ) : null}
          {statusLabelText ? (
            <FilterChip
              label={statusLabelText}
              onClear={() => onChange(clearActivityFilterField(filters, "status"))}
            />
          ) : null}
          {filters.dateRange.from ? (
            <FilterChip
              label={t`From ${filters.dateRange.from}`}
              onClear={() => onChange(clearActivityFilterField(filters, "from"))}
            />
          ) : null}
          {filters.dateRange.to ? (
            <FilterChip
              label={t`To ${filters.dateRange.to}`}
              onClear={() => onChange(clearActivityFilterField(filters, "to"))}
            />
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 rounded-full px-2 text-[12px]"
            data-testid="activity-reset-filters"
            onClick={() => onChange(emptyActivityFilters())}
          >
            <Trans>Reset all</Trans>
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  const { t } = useLingui();
  return (
    <button
      type="button"
      className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11.5px] text-foreground hover:bg-accent"
      onClick={onClear}
      aria-label={t`Clear filter ${label}`}
    >
      <span className="truncate">{label}</span>
      <span aria-hidden>×</span>
    </button>
  );
}

/** `compact` is one line: the chat list already shows what a working bot is doing. */
function ActivityRow({
  run,
  onOpen,
  compact = false,
}: {
  run: RunActivityRow;
  onOpen: () => void;
  compact?: boolean;
}) {
  const { t } = useLingui();
  const title = run.groupName ? `${run.botName} · ${run.groupName}` : run.botName;
  const label = statusLabel(run.status, run.needsApproval);
  const activityLabel = t`${title}, ${label}`;
  const tone = statusTone(run.status, run.updatedAt);
  return (
    <button
      type="button"
      aria-label={activityLabel}
      onClick={onOpen}
      data-activity-row=""
      className={`flex w-full gap-3 rounded-xl px-2.5 text-left hover:bg-accent ${compact ? "py-1.5" : "py-[9px]"}`}
    >
      <span
        className={`mt-1.5 size-2 shrink-0 rounded-full bg-current ${tone}`}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium text-foreground">{title}</span>
          {compact ? (
            <span className={`shrink-0 text-xs ${tone}`}>{label}</span>
          ) : (
            <span className="shrink-0 text-xs text-muted-foreground/80">
              {formatRosterTime(run.updatedAt)}
            </span>
          )}
        </div>
        <div hidden={compact} className="mt-0.5">
          <span className={`block text-xs ${tone}`}>{label}</span>
          {run.promptSnippet ? (
            <span className="block truncate text-[13px] text-muted-foreground">
              {run.promptSnippet}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

export function statusLabel(status: RunActivityRow["status"], needsApproval?: boolean): string {
  switch (status) {
    case "queued":
      return t`Queued`;
    case "leased":
      return t`Starting`;
    case "running":
      return t`Running`;
    case "waiting_input":
      return needsApproval ? t`Needs approval` : needsAnswerLabel();
    case "waiting_takeover":
      return t`Needs takeover`;
    case "completed":
      return t`Done`;
    case "failed":
      return t`Failed`;
    case "cancelled":
      return t`Cancelled`;
    default:
      return status;
  }
}
