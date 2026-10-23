import { plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { LegalDeadline } from "@rakazo/contracts";
import { LEGAL_CONSENT_REQUIRED_MESSAGE } from "@rakazo/contracts";
import { Button, Skeleton, Tabs, TabsList, TabsTrigger } from "@rakazo/ui-web";
import { Scale, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { FinanceSpace } from "../components/finance/ui";
import {
  AskAgentButton,
  ErrorNotice,
  FinanceChromeProvider,
  SpaceName,
  useFinanceQuery,
} from "../components/finance/ui";
import { LegalConsentPrompt } from "../components/legal/ConsentPrompt";
import { LegalGraphView } from "../components/legal/LegalGraph";
import { PageEmptyState } from "../components/PageEmptyState";
import { PageHeader } from "../components/PageHeader";
import { DATA_ROOM_PATH } from "../lib/data-room";
import { fullDay } from "../lib/finance-format";
import { maskCurrencyWhenHidden, useHideAmounts } from "../lib/hide-amounts-preference";
import { daysBetween, todayIso } from "../lib/legal-format";
import { formatRelativeTime } from "../lib/relative-time";
import { rpc } from "../lib/rpc";
import { NOTIFICATIONS_CHANGED_EVENT } from "../lib/use-sidebar-glance";
import { errorText, KEY_REJECTED_PATTERN, runErrorText } from "../lib/user-error";
import { LegalContracts } from "./legal/LegalContracts";
import { LegalDeadlines } from "./legal/LegalDeadlines";

const VIEWS = ["contracts", "deadlines", "graph"] as const;
type View = (typeof VIEWS)[number];
const LEGAL_PATH = "/app/legal";

const deadlineKey = (d: LegalDeadline) => [d.title, d.dueDate, d.notes].join("|");
const deadlineQuestion = (deadline: LegalDeadline) => {
  const { title, contractTitle } = deadline;
  const due = fullDay(deadline.dueDate);
  return contractTitle
    ? t`Help me with "${title}" on ${contractTitle}, due ${due}.`
    : t`Help me with "${title}", due ${due}.`;
};

/** How often the page re-reads the overview while a scan runs, and when it stops waiting. */
const SCAN_POLL_MS = 4_000;
const SCAN_WAIT_MS = 5 * 60_000;

/** The Legal area at /app/legal: contracts, deadlines and the relationship graph the Legal agent keeps. */
export function LegalPage({
  onAskAgent,
  onAskAbout,
  onConsentChange,
  onOpenSettings,
  settingsOpen = false,
  spaces,
  spaceId,
  onSwitchSpace,
}: {
  onAskAgent?: () => void;
  /** Sends the Legal agent a question about one row, opening its panel first. */
  onAskAbout?: (question: string) => void;
  /** Tells the shell whether Legal still lacks consent, so the agent's composer waits for the page's Allow. */
  onConsentChange?: (missing: boolean) => void;
  /** Which company Legal shows, and how to switch, when the user has more than one space. */
  spaces?: FinanceSpace[];
  spaceId?: string;
  onSwitchSpace?: (spaceId: string) => void;
  /** Opens Settings on Models > OpenRouter with the own-key form open. */
  onOpenSettings?: () => void;
  /** Settings is open over the page; the page re-reads its state when it closes. */
  settingsOpen?: boolean;
}) {
  return (
    <FinanceChromeProvider
      value={{ onAskAgent, agentName: "Legal agent", spaces, spaceId, onSwitchSpace }}
    >
      <div className="@container rk-scroll flex-1 overflow-y-auto px-4 pb-6 pt-2 md:px-7">
        <div className="mx-auto max-w-[1440px]">
          <Legal
            selfName={spaces?.find((space) => space.id === spaceId)?.name}
            onOpenSettings={onOpenSettings}
            settingsOpen={settingsOpen}
            onAskAbout={onAskAbout}
            onConsentChange={onConsentChange}
          />
        </div>
      </div>
    </FinanceChromeProvider>
  );
}

function Legal({
  selfName,
  onOpenSettings,
  settingsOpen,
  onAskAbout,
  onConsentChange,
}: {
  /** The company itself, left out of each contract's Parties. */
  selfName?: string;
  onOpenSettings?: () => void;
  settingsOpen: boolean;
  onAskAbout?: (question: string) => void;
  onConsentChange?: (missing: boolean) => void;
}) {
  const overview = useFinanceQuery(() => rpc.legal.overview(), []);
  // A failed consent read must not hide the page; the agent reports when it cannot read documents.
  const consent = useFinanceQuery(() => rpc.legal.consent(), []);
  const [granted, setGranted] = useState<typeof consent.data>(null);
  // The tab lives in the URL, so the deadline tiles can link straight to it.
  const [params, setParams] = useSearchParams();
  const asked = params.get("view");
  const view: View = VIEWS.includes(asked as View) ? (asked as View) : "contracts";
  // A link with due=overdue opens Deadlines on just the overdue ones.
  const onlyOverdue = view === "deadlines" && params.get("due") === "overdue";
  const setView = (next: View) =>
    setParams(next === "contracts" ? {} : { view: next }, { replace: true });
  const [scanError, setScanError] = useState("");
  // The failed run whose notice the user closed; the next failed run shows its own.
  const [dismissedRun, setDismissedRun] = useState<string | null>(null);
  // The run Scan now queued, until the overview shows it finished.
  const [waitingFor, setWaitingFor] = useState<string | null>(null);
  // What the page showed when Scan now was pressed, and the one-line result once the scan ends.
  const beforeScan = useRef<{
    contracts: Map<string, string>;
    deadlines: Map<string, string>;
  } | null>(null);
  useHideAmounts(); // re-render the masked scan summary when the switch flips
  const [scanResult, setScanResult] = useState("");
  // How many documents were unchecked when Scan now was pressed; the count falling is the progress.
  // Deadlines the user closed (done or dismissed), listed on request under Deadlines.
  const [showDone, setShowDone] = useState(false);
  const [scanTotal, setScanTotal] = useState(0);
  const status = granted ?? consent.data;
  const data = overview.data;
  const lastRun = data?.agent.lastScanRun ?? null;
  const finishedWaiting = lastRun?.id === waitingFor && lastRun?.status !== "running";
  // A failed refresh stops the wait: the Could not refresh notice offers Try again.
  const running =
    !overview.error && (lastRun?.status === "running" || (waitingFor !== null && !finishedWaiting));

  // The header shows how long this scan has run (it re-renders on every poll), not the last scan's age.
  const scanStart = useRef(0);
  const consentMissing = status?.allowed === false;
  const reportConsent = useRef(onConsentChange);
  reportConsent.current = onConsentChange;
  useEffect(() => {
    reportConsent.current?.(consentMissing);
    return () => reportConsent.current?.(false);
  }, [consentMissing]);

  const reload = useRef({ overview: overview.reload, consent: consent.reload });
  reload.current = { overview: overview.reload, consent: consent.reload };
  // A fresh read replaces a grant made on this page.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the read changes.
  useEffect(() => setGranted(null), [consent.data]);
  useEffect(() => {
    if (!finishedWaiting) return;
    setWaitingFor(null);
    const before = beforeScan.current;
    beforeScan.current = null;
    if (!before || !data || lastRun?.status === "failed") return;
    if (lastRun?.status === "cancelled") {
      setScanResult(t`Scan cancelled.`);
      return;
    }
    const contractsChanged = data.contracts.filter(
      (c) => before.contracts.get(c.id) !== c.analyzedAt,
    ).length;
    const deadlinesAdded = data.deadlines.filter(
      (d) => before.deadlines.get(d.id) !== deadlineKey(d),
    ).length;
    const suggested = data.deadlines.filter((d) => d.removalProposed).length;
    // Name what changed, so the founder can find it without comparing lists.
    const names = [
      ...data.contracts
        .filter((c) => before.contracts.get(c.id) !== c.analyzedAt)
        .map((c) => c.title),
      ...data.deadlines
        .filter((d) => before.deadlines.get(d.id) !== deadlineKey(d))
        .map((d) => d.title),
    ];
    const list = names.slice(0, 3).join(", ");
    const more = names.length - 3;
    const named =
      names.length === 0
        ? ""
        : more > 0
          ? ` ${t`Updated: ${list} and ${more} more.`}`
          : ` ${t`Updated: ${list}.`}`;
    const changes =
      contractsChanged + deadlinesAdded === 0
        ? t`Scan finished: nothing changed.`
        : t`Scan finished: ${plural(contractsChanged, { one: "# contract", other: "# contracts" })} and ${plural(deadlinesAdded, { one: "# deadline", other: "# deadlines" })} added or updated.`;
    setScanResult(
      suggested === 0
        ? `${changes}${named}`
        : `${changes}${named} ${plural(suggested, { one: "# deadline may no longer apply: review it under Deadlines.", other: "# deadlines may no longer apply: review them under Deadlines." })}`,
    );
  }, [finishedWaiting, data, lastRun?.status]);
  // A key added in Settings, or a model changed in another tab, shows up when the user comes back.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "hidden") return;
      reload.current.overview();
      reload.current.consent();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  const settingsWasOpen = useRef(false);
  useEffect(() => {
    if (settingsWasOpen.current && !settingsOpen) {
      reload.current.overview();
      reload.current.consent();
    }
    settingsWasOpen.current = settingsOpen;
  }, [settingsOpen]);
  // The run that outlived the wait has ended: drop the "still running" note.
  const timedOut = useRef(false);
  useEffect(() => {
    if (timedOut.current && lastRun && lastRun.status !== "running") {
      timedOut.current = false;
      setScanResult("");
    }
  }, [lastRun]);
  // While a scan runs, re-read the overview until it ends; give up after a few minutes.
  useEffect(() => {
    if (!running) return;
    scanStart.current = Date.now();
    const poll = setInterval(() => reload.current.overview(), SCAN_POLL_MS);
    const stop = setTimeout(() => {
      clearInterval(poll);
      setWaitingFor(null);
      beforeScan.current = null;
      setScanResult(t`Scan is still running. Check back shortly.`);
      timedOut.current = true;
    }, SCAN_WAIT_MS);
    return () => {
      clearInterval(poll);
      clearTimeout(stop);
    };
  }, [running]);

  const scan = async () => {
    setScanError("");
    setScanResult("");
    setScanTotal(data?.counts.unreviewedDocuments ?? 0);
    timedOut.current = false;
    beforeScan.current = data && {
      contracts: new Map(data.contracts.map((c) => [c.id, c.analyzedAt])),
      deadlines: new Map(data.deadlines.map((d) => [d.id, deadlineKey(d)])),
    };
    try {
      const { runId } = await rpc.legal.scanNow();
      // The page shows the scan's progress and result; the agent panel stays as the founder left it.
      setWaitingFor(runId);
      overview.reload();
    } catch (cause) {
      setScanError(errorText(cause));
    }
  };

  // A failed first load has nothing to show; a failed re-read keeps the page and says so.
  if (overview.error && !data) {
    return (
      <div>
        <PageHeader
          title={<Trans>Legal</Trans>}
          meta={<SpaceName />}
          actions={<AskAgentButton />}
        />
        <ErrorNotice message={overview.error} onRetry={overview.retry} />
      </div>
    );
  }
  if (!data) return <LegalSkeleton />;
  // Nothing in the Data room yet: one sentence and Add files, not a consent card or empty tabs.
  const noDocuments =
    data.counts.contracts +
      data.counts.openDeadlines +
      data.counts.doneDeadlines +
      data.counts.unreviewedDocuments ===
      0 &&
    !data.agent.lastScanAt &&
    !running;
  const needsConsent = status?.allowed === false;
  const setupMissing = needsConsent;
  const scanDisabled = running;
  // The banners below already explain the other reasons; only this one has none.
  const scanReason =
    !running && status && needsConsent && status.recipients.length === 0
      ? t`Connect a model in Settings first.`
      : "";
  const { counts } = data;
  // Counted here so the tile and the row pills use the viewer's date, not the server's.
  const today = todayIso();
  const overdue = data.deadlines.filter((d) => daysBetween(today, d.dueDate) < 0).length;
  const keyRejected =
    lastRun?.status === "failed" &&
    !running &&
    Boolean(lastRun.error && KEY_REJECTED_PATTERN.test(lastRun.error));
  const lastScan = data.agent.lastScanAt ? formatRelativeTime(data.agent.lastScanAt) : "";
  // Below the tabs, so the result appearing never moves them.
  const readCount = Math.min(scanTotal, Math.max(0, scanTotal - counts.unreviewedDocuments));
  const resultLine =
    running && scanTotal > 0 && !scanResult ? (
      <p role="status" className="mb-3 text-sm text-muted-foreground">
        {/* Every document is read; the agent is still writing deadlines and the graph. */}
        {readCount >= scanTotal ? (
          <Trans>Saving results…</Trans>
        ) : (
          <Trans>
            Reading {readCount} of {scanTotal}
          </Trans>
        )}
      </p>
    ) : scanResult ? (
      <p role="status" className="mb-3 text-sm text-muted-foreground">
        {maskCurrencyWhenHidden(scanResult)}
      </p>
    ) : null;
  // A row, not a fifth tile. It sits below the tabs, so it going away after a scan never moves them.
  const uncheckedLine = (
    <>
      {/* Hidden while scanning (the progress line says it) and until Legal may read documents. */}
      {counts.unreviewedDocuments > 0 && !running && !setupMissing ? (
        <p className="mb-4 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
          {plural(counts.unreviewedDocuments, {
            one: "# Data room document not yet checked by Legal",
            other: "# Data room documents not yet checked by Legal",
          })}
          <Button size="sm" variant="outline" onClick={() => void scan()}>
            <Trans>Check now</Trans>
          </Button>
        </p>
      ) : null}
    </>
  );

  return (
    <div>
      <PageHeader
        title={<Trans>Legal</Trans>}
        meta={
          <>
            <SpaceName />
            <span className="min-w-0 text-[11px]">
              {needsConsent ? null : running ? (
                (() => {
                  const minutes = Math.floor((Date.now() - scanStart.current) / 60_000);
                  return minutes > 0 ? (
                    <Trans>Scanning for {minutes} min</Trans>
                  ) : (
                    <Trans>Scanning now</Trans>
                  );
                })()
              ) : lastScan ? (
                data.agent.dailyScanActive ? (
                  <Trans>Last scan {lastScan}. Scans daily.</Trans>
                ) : (
                  <Trans>Last scan {lastScan}. Daily scan paused.</Trans>
                )
              ) : data.agent.dailyScanActive ? (
                <Trans>Not scanned yet</Trans>
              ) : (
                <Trans>Not scanned yet. Daily scan paused.</Trans>
              )}
            </span>
          </>
        }
        actions={
          <>
            {/* Until consent exists the card holds the one action. */}
            {setupMissing || noDocuments ? null : (
              <Button variant="outline" disabled={scanDisabled} onClick={() => void scan()}>
                {running ? <Trans>Scanning…</Trans> : <Trans>Scan now</Trans>}
              </Button>
            )}
            <AskAgentButton />
          </>
        }
      />
      {/* The reason a scan cannot start sits under the header so the buttons keep one row. */}
      {scanReason ? (
        <p className="-mt-2 mb-4 text-end text-xs text-muted-foreground">{scanReason}</p>
      ) : null}
      {overview.error ? (
        <ErrorNotice message={t`Could not refresh: ${overview.error}`} onRetry={overview.reload} />
      ) : null}
      {scanError ? (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {scanError}
        </p>
      ) : null}
      {!noDocuments && status && !status.allowed && status.recipients.length > 0 ? (
        <LegalConsentPrompt
          consent={status}
          onChange={(next) => {
            setGranted(next);
            // Allow was the click for the first scan too.
            if (next.allowed) void scan();
          }}
        />
      ) : null}
      {lastRun?.status === "failed" &&
      !running &&
      lastRun.id !== dismissedRun &&
      // A consent failure is fixed by the Allow card above, or already fixed: it is never a banner.
      !(status && lastRun.error === LEGAL_CONSENT_REQUIRED_MESSAGE) ? (
        <div
          role="status"
          data-testid="scan-failed"
          className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive"
        >
          <p className="min-w-0 flex-1 basis-64">
            {keyRejected ? (
              <Trans>Last scan failed: The AI key was rejected.</Trans>
            ) : lastRun.error ? (
              <Trans>Last scan failed: {runErrorText(lastRun.error)}</Trans>
            ) : (
              <Trans>Last scan failed</Trans>
            )}
          </p>
          {/* A rejected key is fixed in one place; go straight to its field. */}
          {keyRejected && onOpenSettings ? (
            <Button size="sm" variant="outline" onClick={onOpenSettings}>
              <Trans>Replace key</Trans>
            </Button>
          ) : null}
          <button
            type="button"
            aria-label={t`Dismiss`}
            onClick={() => setDismissedRun(lastRun.id)}
            className="shrink-0 hover:text-foreground"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      ) : null}
      {/* Before Allow the empty tabs below show what Legal will fill in; the card above is the instruction. */}
      {noDocuments ? (
        <PageEmptyState
          icon={<Scale className="size-8" strokeWidth={1.6} aria-hidden="true" />}
          title={<Trans>No contracts yet</Trans>}
          description={<Trans>Add contracts to your Data room and Legal reads them.</Trans>}
        >
          <Button variant="outline" render={<Link to={DATA_ROOM_PATH} />}>
            <Trans>Add files</Trans>
          </Button>
        </PageEmptyState>
      ) : !needsConsent &&
        data.contracts.length === 0 &&
        data.deadlines.length === 0 &&
        data.counts.doneDeadlines === 0 ? (
        <>
          {resultLine}
          {uncheckedLine}
          <PageEmptyState
            icon={<Scale className="size-8" strokeWidth={1.6} aria-hidden="true" />}
            title={<Trans>No contracts yet</Trans>}
            description={
              running ? (
                <Trans>Reading your Data room…</Trans>
              ) : data.agent.lastScanAt ? (
                <Trans>No contracts or deadlines found on {fullDay(data.agent.lastScanAt)}.</Trans>
              ) : data.agent.dailyScanActive ? (
                <Trans>
                  Press Scan now to read your Data room for contracts and deadlines. Legal also
                  scans every day.
                </Trans>
              ) : (
                <Trans>Press Scan now to read your Data room for contracts and deadlines.</Trans>
              )
            }
          />
        </>
      ) : (
        <>
          <Tabs value={view} onValueChange={(next) => setView(next as View)} className="mb-3">
            <TabsList
              className="max-w-full justify-start overflow-x-auto rounded-full"
              aria-label={t`View`}
            >
              <TabsTrigger value="contracts" className="rounded-full px-2 sm:px-3">
                <Trans>Contracts</Trans> {counts.contracts}
              </TabsTrigger>
              <TabsTrigger value="deadlines" className="rounded-full px-2 sm:px-3">
                <Trans>Deadlines</Trans> {counts.openDeadlines}
                {overdue > 0 ? (
                  <span className="ms-1 text-destructive">
                    <Trans>{overdue} overdue</Trans>
                  </span>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="graph" className="rounded-full px-2 sm:px-3">
                <Trans>Graph</Trans>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {resultLine}
          {uncheckedLine}
          {view === "contracts" ? (
            <LegalContracts contracts={data.contracts} selfName={selfName} />
          ) : null}
          {view === "deadlines" ? (
            <div className="mb-2 flex justify-end">
              <Button
                size="sm"
                variant="ghost"
                aria-pressed={showDone}
                onClick={() => setShowDone(!showDone)}
              >
                {showDone ? <Trans>Show open</Trans> : <Trans>Show closed</Trans>}
              </Button>
            </div>
          ) : null}
          {view === "deadlines" && showDone ? <DoneDeadlines onChanged={overview.reload} /> : null}
          {view === "deadlines" && !showDone ? (
            <LegalDeadlines
              deadlines={data.deadlines}
              onChanged={overview.reload}
              onlyOverdue={onlyOverdue}
              onShowAll={() => setView("deadlines")}
              // The agent cannot read documents until the page's Allow, so no question goes to it before.
              onAsk={
                onAskAbout && !consentMissing
                  ? (deadline) => onAskAbout(deadlineQuestion(deadline))
                  : undefined
              }
            />
          ) : null}
          {view === "graph" ? <GraphTab /> : null}
        </>
      )}
    </div>
  );
}

function DoneDeadlines({ onChanged }: { onChanged: () => void }) {
  const [error, setError] = useState("");
  const done = useFinanceQuery(() => rpc.legal.doneDeadlines(), []);
  if (done.error) return <ErrorNotice message={done.error} onRetry={done.retry} />;
  if (!done.data) return <Skeleton aria-busy="true" className="h-24 bg-border" />;
  if (done.data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        <Trans>No closed deadlines.</Trans>
      </p>
    );
  }
  const reopen = async (id: string) => {
    setError("");
    try {
      await rpc.legal.updateDeadline({ id, status: "open" });
      done.reload();
      onChanged();
      // The sidebar Legal badge counts open deadlines.
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
    } catch (cause) {
      setError(errorText(cause));
    }
  };
  return (
    <>
      {error ? (
        <p role="alert" className="mb-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <ul aria-label={t`Closed deadlines`} className="flex flex-col">
        {done.data.map((deadline) => (
          <li
            key={deadline.id}
            className="flex flex-wrap items-center justify-between gap-x-4 border-t border-border py-1.5 text-sm"
          >
            <span className="min-w-0 font-medium">
              {maskCurrencyWhenHidden(
                deadline.contractTitle
                  ? `${deadline.title}: ${deadline.contractTitle}`
                  : deadline.title,
              )}
              {deadline.status === "dismissed" ? (
                <span className="ms-2 font-normal text-muted-foreground">
                  <Trans>Dismissed</Trans>
                </span>
              ) : null}
            </span>
            <span className="flex items-center gap-2">
              <time dateTime={deadline.dueDate} className="tabular-nums text-muted-foreground">
                {fullDay(deadline.dueDate)}
              </time>
              <Button size="sm" variant="ghost" onClick={() => void reopen(deadline.id)}>
                {deadline.status === "dismissed" ? <Trans>Restore</Trans> : <Trans>Reopen</Trans>}
              </Button>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

function GraphTab() {
  const graph = useFinanceQuery(() => rpc.legal.graph(), []);
  if (graph.error) return <ErrorNotice message={graph.error} onRetry={graph.retry} />;
  // bg-border: the default skeleton fill is almost the page colour, so the tab looked blank.
  if (!graph.data) return <BuildingGraph />;
  return <LegalGraphView graph={graph.data} />;
}

/** The graph's placeholder; after 2 seconds it says what is happening. */
function BuildingGraph() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 2_000);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div aria-busy="true" className="relative">
      <Skeleton className="h-64 bg-border" />
      {slow ? (
        <p
          role="status"
          className="absolute inset-0 grid place-items-center text-sm text-muted-foreground"
        >
          <Trans>Building graph…</Trans>
        </p>
      ) : null}
    </div>
  );
}

function LegalSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-3">
      <Skeleton className="h-7 w-32" />
      <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-4">
        {[0, 1, 2, 3].map((n) => (
          <Skeleton key={n} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-56" />
    </div>
  );
}
