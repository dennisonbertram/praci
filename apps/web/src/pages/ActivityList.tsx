import { plural, t } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import type { RunActivityRow, RunStatus, WaitingOnYouItem } from "@rakazo/contracts";
import { isAgedStuckWork } from "@rakazo/core";
import { Button, Input, Popover, PopoverContent, PopoverTrigger } from "@rakazo/ui-web";
import type { ReactNode, Ref } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { PhoneDateRange, PickFilter, SearchField, SortControl } from "../components/ListControls";
import { RowsSkeleton } from "../components/RowsSkeleton";
import type { ActivityListFilters, ActivitySort } from "../lib/activity-list-filters";
import {
  ACTIVITY_SORTS,
  activityFiltersActive,
  DEFAULT_ACTIVITY_SORT,
  filterActivityRuns,
  sortActivityRuns,
} from "../lib/activity-list-filters";
import { useListParams } from "../lib/list-params";
import { needsAnswerLabel } from "../lib/roster-status";
import { formatRosterTime } from "../lib/roster-time";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";
import { ScratchpadItemMeta } from "./ScratchpadSection";

export function statusTone(status: RunActivityRow["status"], updatedAt?: string): string {
  if (status === "failed") return "text-destructive";
  if (status === "cancelled") return "text-muted-foreground";
  // A finished run needs nothing; colour stays for what needs the person or went wrong.
  if (status === "completed") return "text-muted-foreground";
  if (status === "waiting_input" || status === "waiting_takeover") return "text-warning";
  if (updatedAt && isAgedStuckWork(status, updatedAt)) return "text-warning";
  return "text-foreground";
}

type ActivityListProps = {
  onOpenRun: (run: RunActivityRow) => void;
  /** The bots whose active runs are listed here, so the chat list can skip them while this is open. */
  onListedBots?: (botIds: ReadonlySet<string>) => void;
  /** Opens the bot's panel, where the item sits under Open work. */
  onOpenWaitingItem?: (item: WaitingOnYouItem) => void;
};

/** A request that has not answered by now becomes the error with Try again, not an endless skeleton. */
const ACTIVITY_REQUEST_MS = 12_000;

function within<T>(request: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error(t`Could not load activity`)),
      ACTIVITY_REQUEST_MS,
    );
    request.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        window.clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export function ActivityList({ onOpenRun, onListedBots, onOpenWaitingItem }: ActivityListProps) {
  const { t } = useLingui();
  const [activeRuns, setActiveRuns] = useState<RunActivityRow[]>([]);
  const [recentRuns, setRecentRuns] = useState<RunActivityRow[]>([]);
  const [waitingItems, setWaitingItems] = useState<WaitingOnYouItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // The filters and sort live in the URL; the names are prefixed because the sidebar shares the URL with its page.
  const list = useListParams(ACTIVITY_SORTS, DEFAULT_ACTIVITY_SORT, ACTIVITY_PARAM);
  const query = list.param(`${ACTIVITY_PARAM}q`) ?? "";
  const askedStatus = list.param(`${ACTIVITY_PARAM}status`);
  const status = STATUS_FILTERS.find((s) => s === askedStatus) ?? "all";
  const from = list.param(`${ACTIVITY_PARAM}from`) ?? "";
  const to = list.param(`${ACTIVITY_PARAM}to`) ?? "";
  const filters = useMemo<ActivityListFilters>(
    () => ({ query, status, dateRange: { from, to } }),
    [query, status, from, to],
  );

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
            within(rpc.runs.list({ filter: "active" })).then((result) => {
              if (!fresh()) return;
              setActiveRuns(result.runs);
              setLoading(false);
            }),
            within(rpc.runs.list({ filter: "recent" })).then((result) => {
              if (fresh()) setRecentRuns(result.runs);
            }),
            within(rpc.scratchpad.waitingOnYou({})).then((result) => {
              if (fresh()) setWaitingItems(result);
            }),
          ]);
          if (fresh()) setError(null);
        } catch (err) {
          if (cancelled || requestId !== generation) return;
          setError(errorText(err, t`Could not load activity`));
        } finally {
          if (!cancelled && requestId === generation) {
            setLoading(false);
            // A hidden window stops polling; the visibilitychange handler resumes it.
            if (document.visibilityState !== "hidden") timer = window.setTimeout(load, 15_000);
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
    const onVisible = () => {
      if (document.visibilityState === "hidden") {
        if (timer !== undefined) window.clearTimeout(timer);
        timer = undefined;
      } else if (timer === undefined) {
        load();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      reloadRef.current = null;
      document.removeEventListener("visibilitychange", onVisible);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [t]);

  const { field: sortField, dir: sortDir } = list.sort;
  const filteredActive = useMemo(
    () =>
      sortActivityRuns(filterActivityRuns(activeRuns, filters), { field: sortField, dir: sortDir }),
    [activeRuns, filters, sortField, sortDir],
  );
  useEffect(() => {
    onListedBots?.(new Set(filteredActive.map((run) => run.botId)));
    return () => onListedBots?.(new Set());
  }, [filteredActive, onListedBots]);

  const filteredRecent = useMemo(
    () =>
      sortActivityRuns(filterActivityRuns(recentRuns, filters), { field: sortField, dir: sortDir }),
    [recentRuns, filters, sortField, sortDir],
  );

  // A quiet routine run that said nothing is not "finished work": it stays out of the count and sits last, dimmed.
  const finishedRuns = useMemo(() => filteredRecent.filter((run) => !run.silent), [filteredRecent]);
  const quietRuns = useMemo(() => filteredRecent.filter((run) => run.silent), [filteredRecent]);

  const filtersOn = activityFiltersActive(filters);
  const [showFilters, setShowFilters] = useState(false);
  // A popover floats over the list, so a phone shows the filters inline above it instead.
  const wide = useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia?.("(min-width: 640px)");
      query?.addEventListener("change", notify);
      return () => query?.removeEventListener("change", notify);
    },
    () => window.matchMedia?.("(min-width: 640px)").matches ?? true,
    () => true,
  );
  const [showFinished, setShowFinished] = useState(false);
  const finishedRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (showFinished) finishedRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [showFinished]);
  // What needs the person comes first; the rest of the active work follows as "Working".
  const needsYou = filteredActive.filter((run) => NEEDS_YOU.has(run.status));
  const working = filteredActive.filter((run) => !NEEDS_YOU.has(run.status));
  const hasAnyRuns = activeRuns.length > 0 || recentRuns.length > 0 || waitingItems.length > 0;
  const hasVisibleRuns = filteredActive.length > 0 || filteredRecent.length > 0;

  // The list ends on a whole row: its height stops at the bottom of the last row that fits.
  const rowsRef = useRef<HTMLDivElement>(null);
  const layoutKey = [...filteredActive, ...filteredRecent]
    .map((run) => `${run.runId}${run.status}`)
    .join()
    .concat(`|${waitingItems.map((item) => item.id).join()}`);
  // biome-ignore lint/correctness/useExhaustiveDependencies: layoutKey, showFinished and error change which rows are drawn
  useLayoutEffect(() => {
    const scroller = rowsRef.current;
    if (!scroller) return;
    const fit = () => {
      scroller.style.maxHeight = "";
      // Expanded finished runs are what the person asked for: show them all, and let the sidebar scroll.
      if (showFinished) return;
      // In the phone drawer the sidebar is the one scroller, so Working and Finished stay reachable.
      if (window.matchMedia && !window.matchMedia("(min-width: 1024px)").matches) return;
      const top = scroller.getBoundingClientRect().top;
      const endOf = (row: Element) => row.getBoundingClientRect().bottom - top + scroller.scrollTop;
      // Everything waiting on the person always shows; the other runs share what is left of 30% of the window.
      const needsRows = scroller.querySelectorAll(
        '[aria-labelledby="activity-needs-heading"] [data-activity-row], [aria-labelledby="activity-waiting-heading"] [data-activity-row]',
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
    return <RowsSkeleton rows={3} className="px-2.5 py-2" onRetry={() => reloadRef.current?.()} />;
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
        <Popover open={wide && showFilters} onOpenChange={setShowFilters}>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 rounded-full px-2 text-[12px] text-muted-foreground pointer-coarse:h-11 pointer-coarse:px-3"
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
            <ActivityFilters filters={filters} list={list} />
          </PopoverContent>
        </Popover>
      </div>
      {!wide && showFilters ? (
        <div className="px-2.5 pb-2">
          <ActivityFilters filters={filters} list={list} />
        </div>
      ) : null}
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
            <Trans>No recent runs match these filters.</Trans>
          </p>
        ) : null}

        {/* Each row names its own state, so this group's heading is for screen readers only. */}
        <ActivitySection id="activity-needs-heading" title={<Trans>Needs you</Trans>} titleHidden>
          {needsYou.map((run) => (
            <ActivityRow key={run.runId} run={run} onOpen={() => onOpenRun(run)} />
          ))}
        </ActivitySection>
        <ActivitySection id="activity-waiting-heading" title={<Trans>Waiting on you</Trans>}>
          {waitingItems.map((item) => (
            <WaitingRow key={item.id} item={item} onOpen={() => onOpenWaitingItem?.(item)} />
          ))}
        </ActivitySection>
        <ActivitySection id="activity-now-heading" title={<Trans>Working</Trans>}>
          {working.map((run) => (
            <ActivityRow key={run.runId} run={run} onOpen={() => onOpenRun(run)} compact />
          ))}
        </ActivitySection>
        {needsYou.length === 0 &&
        working.length === 0 &&
        waitingItems.length === 0 &&
        !filtersOn ? (
          <p className="px-2.5 py-1 text-[13px] text-muted-foreground/80" role="status">
            <Trans>Nothing needs you right now.</Trans>
          </p>
        ) : null}
        {/* Finished runs need nothing from the person, so they stay folded unless filtering. */}
        {finishedRuns.length > 0 && !showFinished && !filtersOn ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-full justify-start rounded-xl px-2.5 text-[12.5px] font-medium text-muted-foreground/80 pointer-coarse:h-11"
            data-testid="activity-show-finished"
            aria-expanded={false}
            onClick={() => setShowFinished(true)}
          >
            {plural(finishedRuns.length, {
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
            {[...finishedRuns, ...quietRuns].map((run) => (
              <ActivityRow key={run.runId} run={run} onOpen={() => onOpenRun(run)} />
            ))}
          </ActivitySection>
        )}
      </div>
    </div>
  );
}

/** Put in front of this list's URL params so they do not clash with the page's own. */
const ACTIVITY_PARAM = "activity-";

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
  list,
}: {
  filters: ActivityListFilters;
  list: ReturnType<typeof useListParams<ActivitySort>>;
}) {
  const { t } = useLingui();
  const param = (name: string) => `${ACTIVITY_PARAM}${name}`;
  const filtersOn = activityFiltersActive(filters);
  const sortNames: [ActivitySort, string][] = [
    ["updated", t`Updated`],
    ["bot", t`Bot`],
  ];

  return (
    // On a phone, search and the one Filters button share a row; From, To and Reset live in its sheet.
    <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-stretch">
      <SearchField
        value={filters.query}
        onChange={(value) => list.setParam(param("q"), value)}
        placeholder={t`Search runs`}
        label={t`Search activity`}
        name="activity-search"
      />
      <div className="contents sm:flex sm:flex-wrap sm:items-center sm:gap-1.5">
        <PickFilter
          label={t`Status`}
          value={filters.status === "all" ? undefined : filters.status}
          options={STATUS_FILTERS.map((status) => [status, statusLabel(status)])}
          onChange={(value) => list.setParam(param("status"), value)}
        />
        <SortControl
          fields={sortNames}
          field={list.sort.field}
          fieldLabel={sortNames.find(([field]) => field === list.sort.field)?.[1] ?? ""}
          direction={list.sort.dir}
          onField={(field) => list.setSort({ field, dir: field === "bot" ? "asc" : "desc" })}
          onDirection={(dir) => list.setSort({ field: list.sort.field, dir })}
        />
      </div>
      <PhoneDateRange
        label={t`Dates`}
        from={filters.dateRange.from || undefined}
        to={filters.dateRange.to || undefined}
        // One edge changes per edit; "Clear all" empties both in one go.
        onChange={(from, to) =>
          from === undefined && to === undefined
            ? list.clear(param("from"), param("to"))
            : from !== (filters.dateRange.from || undefined)
              ? list.setParam(param("from"), from)
              : list.setParam(param("to"), to)
        }
      />
      <div className="flex items-center justify-between gap-2 text-[12.5px] text-muted-foreground/80 max-sm:hidden">
        <Trans>From</Trans>
        <Input
          type="date"
          name="activity-from"
          aria-label={t`From`}
          data-testid="activity-date-from"
          value={filters.dateRange.from}
          onChange={(event) => list.setParam(param("from"), event.target.value)}
          className="w-40 rounded-xl bg-card text-[13px] dark:bg-input"
        />
      </div>
      <div className="flex items-center justify-between gap-2 text-[12.5px] text-muted-foreground/80 max-sm:hidden">
        <Trans>To</Trans>
        <Input
          type="date"
          name="activity-to"
          aria-label={t`To`}
          data-testid="activity-date-to"
          value={filters.dateRange.to}
          onChange={(event) => list.setParam(param("to"), event.target.value)}
          className="w-40 rounded-xl bg-card text-[13px] dark:bg-input"
        />
      </div>
      {filtersOn ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 self-start rounded-full px-2 text-[12px] max-sm:hidden"
          data-testid="activity-reset-filters"
          onClick={() => list.clear(...["q", "status", "from", "to"].map(param))}
        >
          <Trans>Reset all</Trans>
        </Button>
      ) : null}
    </div>
  );
}

/** An open item that waits on the person; opening it shows the bot's Open work. */
function WaitingRow({ item, onOpen }: { item: WaitingOnYouItem; onOpen: () => void }) {
  const { t } = useLingui();
  const botName = item.botName;
  const title = item.title;
  return (
    <button
      type="button"
      aria-label={t`${title}, ${botName}`}
      onClick={onOpen}
      data-activity-row=""
      className="flex w-full gap-3 rounded-xl px-2.5 py-[9px] text-left hover:bg-accent pointer-coarse:min-h-11"
    >
      <span
        className="mt-1.5 size-2 shrink-0 rounded-full bg-current text-warning"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium text-foreground" dir="auto">
            {title}
          </span>
          <span className="max-w-[40%] shrink-0 truncate text-xs text-muted-foreground/80 pointer-coarse:max-w-[60%]">
            {botName}
          </span>
        </div>
        <ScratchpadItemMeta item={item} />
      </div>
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
  const quiet = run.silent === true;
  const label = quiet ? t`Nothing to report` : statusLabel(run.status, run.needsApproval);
  const activityLabel = t`${title}, ${label}`;
  const tone = statusTone(run.status, run.updatedAt);
  return (
    <button
      type="button"
      aria-label={activityLabel}
      onClick={onOpen}
      data-activity-row=""
      className={`flex w-full gap-3 rounded-xl px-2.5 text-left hover:bg-accent pointer-coarse:min-h-11 ${compact ? "py-1.5" : "py-[9px]"} ${quiet ? "opacity-60" : ""}`}
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
          {run.promptSnippet && !quiet ? (
            <span className="block truncate text-[13px] text-muted-foreground">
              {run.promptSnippet}
            </span>
          ) : null}
          {run.status === "failed" && run.error ? (
            <span className="block truncate text-[13px] text-muted-foreground" title={run.error}>
              {run.error}
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
