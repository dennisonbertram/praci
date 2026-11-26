import { Trans, useLingui } from "@lingui/react/macro";
import type { RoutineHistory } from "@rakazo/contracts";
import { runErrorAction } from "@rakazo/core";
import { Button } from "@rakazo/ui-web";
import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { rpc } from "../lib/rpc";
import { formatToolActivityDuration } from "../lib/tool-activity-view";
import { runErrorText } from "../lib/user-error";
import { statusLabel, statusTone } from "./ActivityList";

export function RoutineRunHistory({
  routineId,
  name,
  running = false,
  onOpenModelSettings,
  onOpenBotSettings,
}: {
  routineId: string;
  name?: string;
  running?: boolean;
  /** Opens Settings > Models (an overlay); offered on the newest failed run for a model fix. */
  onOpenModelSettings?: () => void;
  /** Opens this bot's settings; offered for a lost connection the routine does not pin itself. */
  onOpenBotSettings?: () => void;
}) {
  const { i18n, t } = useLingui();
  const [history, setHistory] = useState<RoutineHistory | null>(null);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const historyRef = useRef<RoutineHistory | null>(null);
  const generation = useRef(0);
  const firstPageRequest = useRef(0);
  const acceptedFirstPage = useRef(0);
  const olderPages = useRef(0);
  const expandedRef = useRef(false);
  const hasLoadedOlder = useRef(false);
  const listId = useId();
  const runs = history?.runs ?? null;

  useEffect(() => {
    expandedRef.current = expanded;
  }, [expanded]);

  function acceptFirstPage(page: RoutineHistory, sequence: number, request: number) {
    if (request !== generation.current || sequence < acceptedFirstPage.current) return;
    acceptedFirstPage.current = sequence;
    const current = historyRef.current;
    if (!expandedRef.current || !current) {
      olderPages.current += 1;
      hasLoadedOlder.current = false;
      setLoadingMore(false);
      historyRef.current = page;
      setHistory(page);
    } else {
      const firstPageIds = new Set(page.runs.map((run) => run.id));
      const overlaps = current.runs.some((run) => firstPageIds.has(run.id));
      if (!overlaps) {
        olderPages.current += 1;
        hasLoadedOlder.current = false;
        setLoadingMore(false);
        historyRef.current = page;
        setHistory(page);
      } else {
        const merged = {
          runs: [...page.runs, ...current.runs.filter((run) => !firstPageIds.has(run.id))],
          nextCursor: current.nextCursor,
        };
        historyRef.current = merged;
        setHistory(merged);
      }
    }
    setFailed(false);
  }

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    generation.current += 1;
    historyRef.current = null;
    setHistory(null);
    setFailed(false);
    setLoadingMore(false);
    setRefreshing(false);
    hasLoadedOlder.current = false;

    async function loadFirstPage() {
      const sequence = ++firstPageRequest.current;
      try {
        const page = await rpc.routines.history({ routineId });
        // A run-state refresh that answered first is newer; keep it.
        if (cancelled || sequence < acceptedFirstPage.current) return;
        acceptFirstPage(page, sequence, generation.current);
      } catch {
        if (!cancelled) setFailed(true);
      }
    }

    async function poll() {
      // Expanded browsing uses explicit Refresh only so loaded older pages stay coherent.
      if (expandedRef.current) {
        if (!cancelled) timer = window.setTimeout(() => void poll(), 15_000);
        return;
      }
      const request = generation.current;
      const sequence = ++firstPageRequest.current;
      try {
        const page = await rpc.routines.history({ routineId });
        if (
          cancelled ||
          request !== generation.current ||
          expandedRef.current ||
          sequence < acceptedFirstPage.current
        )
          return;
        acceptFirstPage(page, sequence, request);
      } catch {
        if (
          !cancelled &&
          request === generation.current &&
          !expandedRef.current &&
          sequence >= acceptedFirstPage.current
        )
          setFailed(true);
      } finally {
        if (!cancelled) timer = window.setTimeout(() => void poll(), 15_000);
      }
    }

    void loadFirstPage().then(() => {
      if (!cancelled) timer = window.setTimeout(() => void poll(), 15_000);
    });
    return () => {
      cancelled = true;
      generation.current += 1;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [routineId]);

  // A run starting or finishing refreshes the first page in place; it must not drop loaded older runs.
  const lastRunning = useRef(running);
  useEffect(() => {
    if (lastRunning.current === running) return;
    lastRunning.current = running;
    const request = generation.current;
    const sequence = ++firstPageRequest.current;
    void rpc.routines
      .history({ routineId })
      .then((page) => {
        acceptFirstPage(page, sequence, request);
      })
      .catch(() => {
        if (request === generation.current && sequence >= acceptedFirstPage.current)
          setFailed(true);
      });
  }, [running, routineId]);

  function toggleExpanded() {
    const next = !expanded;
    expandedRef.current = next;
    generation.current += 1;
    setLoadingMore(false);
    setRefreshing(false);
    setExpanded(next);
    if (next || !hasLoadedOlder.current) return;
    const request = generation.current;
    const sequence = ++firstPageRequest.current;
    void rpc.routines
      .history({ routineId })
      .then((page) => {
        if (
          request !== generation.current ||
          expandedRef.current ||
          sequence < acceptedFirstPage.current
        )
          return;
        acceptFirstPage(page, sequence, request);
      })
      .catch(() => {
        if (
          request === generation.current &&
          !expandedRef.current &&
          sequence >= acceptedFirstPage.current
        )
          setFailed(true);
      });
  }

  async function loadMore() {
    if (!history?.nextCursor || loadingMore) return;
    const request = generation.current;
    const olderPageRequest = olderPages.current;
    setLoadingMore(true);
    try {
      const page = await rpc.routines.history({ routineId, before: history.nextCursor });
      if (request !== generation.current || olderPageRequest !== olderPages.current) return;
      hasLoadedOlder.current = true;
      const current = historyRef.current;
      if (!current) return;
      const next = {
        runs: [
          ...current.runs,
          ...page.runs.filter((run) => !current.runs.some((existing) => existing.id === run.id)),
        ],
        nextCursor: page.nextCursor,
      };
      historyRef.current = next;
      setHistory(next);
      setFailed(false);
    } catch {
      if (request === generation.current) setFailed(true);
    } finally {
      if (request === generation.current) setLoadingMore(false);
    }
  }

  async function refresh() {
    if (refreshing || loadingMore) return;
    const request = generation.current;
    const sequence = ++firstPageRequest.current;
    setRefreshing(true);
    try {
      const page = await rpc.routines.history({ routineId });
      acceptFirstPage(page, sequence, request);
    } catch {
      if (request === generation.current && sequence >= acceptedFirstPage.current) setFailed(true);
    } finally {
      if (request === generation.current) setRefreshing(false);
    }
  }

  return (
    <section data-testid="routine-run-history" className="mt-8 text-sm text-muted-foreground">
      <div className="flex items-center justify-between gap-2">
        <h3>
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={listId}
            onClick={toggleExpanded}
            className="flex items-center gap-2 hover:text-foreground"
          >
            <Trans>Run history</Trans>
            <ChevronDown size={14} aria-hidden className={expanded ? "rotate-180" : undefined} />
          </button>
        </h3>
        {expanded ? (
          <Button
            size="xs"
            variant="ghost"
            disabled={refreshing || loadingMore}
            onClick={() => void refresh()}
          >
            <Trans>Refresh</Trans>
          </Button>
        ) : null}
      </div>
      {failed ? (
        <p role="alert" className="mt-2 text-[13.5px] text-destructive">
          <Trans>Could not load run history</Trans>
        </p>
      ) : runs === null ? (
        <p role="status" className="mt-2 text-[13.5px]">
          <Trans>Loading…</Trans>
        </p>
      ) : null}
      {/* The run row can lag the click by several seconds; say so at once. */}
      {running && runs && !failed && (!runs[0] || runs[0].completedAt) ? (
        <p role="status" className="mt-2 text-[13.5px]">
          <Trans>Running…</Trans>
        </p>
      ) : runs?.length === 0 && !failed ? (
        <p className="mt-2 text-[13.5px]">
          <Trans>No runs yet</Trans>
        </p>
      ) : null}
      {runs && runs.length > 0 ? (
        <ul id={listId} className="mt-2 divide-y divide-border">
          {(expanded ? runs : runs.slice(0, 1)).map((run) => {
            const at = run.startedAt ?? run.createdAt;
            // Only the newest run offers its fix; older failures stay read-only.
            const fix = run === runs[0] ? runErrorAction(run.error) : undefined;
            const duration =
              run.startedAt && run.completedAt
                ? formatToolActivityDuration(
                    Date.parse(run.completedAt) - Date.parse(run.startedAt),
                  )
                : null;
            const chatTo = run.messageId
              ? run.groupId
                ? `/app/g/${encodeURIComponent(run.groupId)}?m=${encodeURIComponent(run.messageId)}`
                : `/app/${encodeURIComponent(run.botId)}?m=${encodeURIComponent(run.messageId)}`
              : null;
            return (
              <li key={run.id} className="py-2.5 text-[13px]" data-testid="routine-run-row">
                <div className="flex items-center justify-between gap-2">
                  <time dateTime={at} title={new Date(at).toLocaleString(i18n.locale || "en")}>
                    {new Date(at).toLocaleString(i18n.locale || "en", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </time>
                  {run.waitingOn ? (
                    <span className="text-warning">
                      <Trans>Waiting on {run.waitingOn}</Trans>
                    </span>
                  ) : (
                    <span className={statusTone(run.status)}>{statusLabel(run.status)}</span>
                  )}
                </div>
                {name ? <p className="mt-1 truncate font-medium text-foreground">{name}</p> : null}
                {run.silent && !run.waitingOn ? (
                  <p className={name ? "" : "mt-1"}>
                    <Trans>Nothing to report</Trans>
                  </p>
                ) : run.preview && !run.waitingOn ? (
                  <p className={`truncate text-foreground ${name ? "" : "mt-1"}`}>{run.preview}</p>
                ) : null}
                {run.status === "failed" && run.error ? (
                  <div className="mt-1 text-destructive">
                    <p>{runErrorText(run.error)}</p>
                    {(fix === "models" && onOpenModelSettings) ||
                    (fix === "connection" && (onOpenModelSettings || onOpenBotSettings)) ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {fix === "models" && onOpenModelSettings ? (
                          <Button size="sm" variant="outline" onClick={onOpenModelSettings}>
                            <Trans>Open Models settings</Trans>
                          </Button>
                        ) : null}
                        {fix === "connection" && onOpenModelSettings ? (
                          <Button size="sm" variant="outline" onClick={onOpenModelSettings}>
                            <Trans>Sign in again</Trans>
                          </Button>
                        ) : null}
                        {fix === "connection" && onOpenBotSettings ? (
                          <Button size="sm" variant="outline" onClick={onOpenBotSettings}>
                            <Trans>Choose another connection</Trans>
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                    {runErrorText(run.error) !== run.error ? (
                      <details key={run.error} className="mt-1">
                        <summary className="w-fit cursor-pointer">{t`Details`}</summary>
                        <pre className="mt-2 whitespace-pre-wrap break-words text-xs">
                          {run.error}
                        </pre>
                      </details>
                    ) : null}
                  </div>
                ) : null}
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span>{duration}</span>
                  {chatTo ? (
                    <Link to={chatTo} className="text-foreground underline underline-offset-2">
                      <Trans>View chat</Trans>
                    </Link>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
      {expanded && history?.nextCursor ? (
        <Button
          size="xs"
          variant="ghost"
          disabled={loadingMore}
          onClick={() => void loadMore()}
          className="mt-2"
        >
          <Trans>Load older runs</Trans>
        </Button>
      ) : null}
    </section>
  );
}
