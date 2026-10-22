import { plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { LegalDeadline } from "@rakazo/contracts";
import { Button, Skeleton, Tabs, TabsList, TabsTrigger } from "@rakazo/ui-web";
import { X } from "lucide-react";
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
import { LEGAL_CONSENT_GRANTED, LegalConsentPrompt } from "../components/legal/ConsentPrompt";
import { LegalGraphView } from "../components/legal/LegalGraph";
import { PageHeader } from "../components/PageHeader";
import { DATA_ROOM_PATH } from "../lib/data-room";
import { fullDay } from "../lib/finance-format";
import { daysBetween, todayIso } from "../lib/legal-format";
import { formatRelativeTime } from "../lib/relative-time";
import { rpc } from "../lib/rpc";
import { errorText, KEY_REJECTED_PATTERN, runErrorText } from "../lib/user-error";
import { LegalContracts } from "./legal/LegalContracts";
import { LegalDeadlines } from "./legal/LegalDeadlines";

const VIEWS = ["contracts", "deadlines", "graph"] as const;
type View = (typeof VIEWS)[number];
const LEGAL_PATH = "/app/legal";

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
      <div className="@container rk-scroll flex-1 overflow-y-auto px-4 pb-6 pt-2 md:px-7 md:pt-5">
        <div className="mx-auto max-w-[1440px]">
          <Legal
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
  onOpenSettings,
  settingsOpen,
  onAskAbout,
  onConsentChange,
}: {
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
  const status = granted ?? consent.data;
  const data = overview.data;
  const lastRun = data?.agent.lastScanRun ?? null;
  const finishedWaiting = lastRun?.id === waitingFor && lastRun?.status !== "running";
  const running = lastRun?.status === "running" || (waitingFor !== null && !finishedWaiting);

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
    if (finishedWaiting) setWaitingFor(null);
  }, [finishedWaiting]);
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
  // While a scan runs, re-read the overview until it ends; give up after a few minutes.
  useEffect(() => {
    if (!running) return;
    const poll = setInterval(() => reload.current.overview(), SCAN_POLL_MS);
    const stop = setTimeout(() => {
      clearInterval(poll);
      setWaitingFor(null);
    }, SCAN_WAIT_MS);
    return () => {
      clearInterval(poll);
      clearTimeout(stop);
    };
  }, [running]);

  const scan = async () => {
    setScanError("");
    try {
      const { runId } = await rpc.legal.scanNow();
      // The page shows the scan's progress and result; the agent panel stays as the founder left it.
      setWaitingFor(runId);
      overview.reload();
    } catch (cause) {
      setScanError(errorText(cause));
    }
  };

  // Allow in the agent panel: re-read, then scan like the page's own card does.
  const scanRef = useRef(scan);
  scanRef.current = scan;
  useEffect(() => {
    const granted = () => {
      reload.current.consent();
      void scanRef.current();
    };
    window.addEventListener(LEGAL_CONSENT_GRANTED, granted);
    return () => window.removeEventListener(LEGAL_CONSENT_GRANTED, granted);
  }, []);
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
  return (
    <div>
      <PageHeader
        title={<Trans>Legal</Trans>}
        meta={
          <>
            <SpaceName />
            <span className="min-w-0 text-[11px]">
              {needsConsent ? null : lastScan ? (
                data.agent.dailyScanActive ? (
                  <Trans>Last scan {lastScan}. Scans daily.</Trans>
                ) : (
                  <Trans>Last scan {lastScan}. Daily scan paused.</Trans>
                )
              ) : running ? null : data.agent.dailyScanActive ? (
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
            {setupMissing ? null : (
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
      {status && !status.allowed && status.recipients.length > 0 ? (
        <LegalConsentPrompt
          consent={status}
          onChange={(next) => {
            setGranted(next);
            // Allow was the click for the first scan too.
            if (next.allowed) void scan();
          }}
        />
      ) : null}
      {lastRun?.status === "failed" && !running && lastRun.id !== dismissedRun ? (
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
      {/* A line, not a fifth tile: four tiles fill two rows of two, or one row, with none alone. */}
      {counts.unreviewedDocuments > 0 ? (
        <p className="-mt-2 mb-4 text-sm text-muted-foreground">
          <Link
            to={`${DATA_ROOM_PATH}?legal=unchecked`}
            className="rk-tap inline-flex min-h-6 items-center text-sm text-foreground hover:underline underline-offset-2"
          >
            {plural(counts.unreviewedDocuments, {
              one: "# Data room document not yet checked by Legal",
              other: "# Data room documents not yet checked by Legal",
            })}
          </Link>
        </p>
      ) : null}
      {/* Before Allow the empty tabs below show what Legal will fill in; the card above is the instruction. */}
      {!needsConsent && data.contracts.length === 0 && data.deadlines.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="max-w-sm text-sm text-muted-foreground">
            {running ? (
              <Trans>Reading your Data room…</Trans>
            ) : data.agent.lastScanAt ? (
              <Trans>No contracts or deadlines found on {fullDay(data.agent.lastScanAt)}.</Trans>
            ) : data.agent.dailyScanActive ? (
              <Trans>
                Press Scan now to read your Data room for contracts and deadlines. Legal also scans
                every day.
              </Trans>
            ) : (
              <Trans>Press Scan now to read your Data room for contracts and deadlines.</Trans>
            )}
          </p>
        </div>
      ) : (
        <>
          <Tabs value={view} onValueChange={(next) => setView(next as View)} className="mb-3">
            <TabsList className="rounded-full" aria-label={t`View`}>
              <TabsTrigger value="contracts" className="rounded-full px-3">
                <Trans>Contracts</Trans> {counts.contracts}
              </TabsTrigger>
              <TabsTrigger value="deadlines" className="rounded-full px-3">
                <Trans>Deadlines</Trans> {counts.openDeadlines}
                {overdue > 0 ? (
                  <span className="ms-1 text-destructive">
                    <Trans>{overdue} overdue</Trans>
                  </span>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="graph" className="rounded-full px-3">
                <Trans>Graph</Trans>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {view === "contracts" ? <LegalContracts contracts={data.contracts} /> : null}
          {view === "deadlines" ? (
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

function GraphTab() {
  const graph = useFinanceQuery(() => rpc.legal.graph(), []);
  if (graph.error) return <ErrorNotice message={graph.error} onRetry={graph.retry} />;
  // bg-border: the default skeleton fill is almost the page colour, so the tab looked blank.
  if (!graph.data) return <Skeleton aria-busy="true" className="h-64 bg-border" />;
  return <LegalGraphView graph={graph.data} />;
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
