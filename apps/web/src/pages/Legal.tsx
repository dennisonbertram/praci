import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Button, Skeleton, Tabs, TabsList, TabsTrigger } from "@rakazo/ui-web";
import { useEffect, useRef, useState } from "react";
import {
  AskAgentButton,
  ErrorNotice,
  FinanceChromeProvider,
  Kpi,
  useFinanceQuery,
} from "../components/finance/ui";
import { LegalConsentPrompt } from "../components/legal/ConsentPrompt";
import { LegalGraphView } from "../components/legal/LegalGraph";
import { daysBetween, todayIso } from "../lib/legal-format";
import { formatRelativeTime } from "../lib/relative-time";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";
import { LegalContracts } from "./legal/LegalContracts";
import { LegalDeadlines } from "./legal/LegalDeadlines";

type View = "contracts" | "deadlines" | "graph";

/** How often the page re-reads the overview while a scan runs, and when it stops waiting. */
const SCAN_POLL_MS = 4_000;
const SCAN_WAIT_MS = 5 * 60_000;

/** The Legal area at /app/legal: contracts, deadlines and the relationship graph the Legal agent keeps. */
export function LegalPage({
  onAskAgent,
  onOpenSettings,
  settingsOpen = false,
}: {
  onAskAgent?: () => void;
  /** Opens Settings on the Models section. */
  onOpenSettings?: () => void;
  /** Settings is open over the page; the page re-reads its state when it closes. */
  settingsOpen?: boolean;
}) {
  return (
    <FinanceChromeProvider value={{ onAskAgent }}>
      <div className="@container rk-scroll flex-1 overflow-y-auto px-4 pb-6 pt-2 md:px-7 md:pt-5">
        <Legal
          onAskAgent={onAskAgent}
          onOpenSettings={onOpenSettings}
          settingsOpen={settingsOpen}
        />
      </div>
    </FinanceChromeProvider>
  );
}

function Legal({
  onAskAgent,
  onOpenSettings,
  settingsOpen,
}: {
  onAskAgent?: () => void;
  onOpenSettings?: () => void;
  settingsOpen: boolean;
}) {
  const overview = useFinanceQuery(() => rpc.legal.overview(), []);
  // A failed consent read must not hide the page; the agent reports when it cannot read documents.
  const consent = useFinanceQuery(() => rpc.legal.consent(), []);
  const [granted, setGranted] = useState<typeof consent.data>(null);
  const [view, setView] = useState<View>("contracts");
  const [scanError, setScanError] = useState("");
  // The run Scan now queued, until the overview shows it finished.
  const [waitingFor, setWaitingFor] = useState<string | null>(null);
  const status = granted ?? consent.data;
  const data = overview.data;
  const lastRun = data?.agent.lastScanRun ?? null;
  const finishedWaiting = lastRun?.id === waitingFor && lastRun?.status !== "running";
  const running = lastRun?.status === "running" || (waitingFor !== null && !finishedWaiting);

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
      setWaitingFor(runId);
      onAskAgent?.();
      overview.reload();
    } catch (cause) {
      setScanError(errorText(cause));
    }
  };

  if (overview.error) return <ErrorNotice message={overview.error} onRetry={overview.retry} />;
  if (!data) return <LegalSkeleton />;
  const modelReady = Boolean(data.model?.isPreferred);
  const needsConsent = status?.allowed === false;
  const scanDisabled = running || !modelReady || needsConsent;
  const consentReason =
    modelReady && status && needsConsent
      ? status.recipients.length > 0
        ? t`Allow access below first.`
        : t`Connect a model in Settings first.`
      : "";
  const { counts } = data;
  // Counted here so the tile and the row pills use the viewer's date, not the server's.
  const today = todayIso();
  const overdue = data.deadlines.filter((d) => daysBetween(today, d.dueDate) < 0).length;
  const lastScan = data.agent.lastScanAt ? formatRelativeTime(data.agent.lastScanAt) : "";
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold">
          <Trans>Legal</Trans>
        </h1>
        <span className="text-[11px] text-muted-foreground">
          {lastRun?.status === "failed" && !running ? (
            lastRun.error ? (
              <Trans>Last scan failed: {lastRun.error}</Trans>
            ) : (
              <Trans>Last scan failed</Trans>
            )
          ) : lastScan ? (
            <Trans>Last scan {lastScan}</Trans>
          ) : (
            <Trans>Not scanned yet</Trans>
          )}
        </span>
        {lastRun?.status === "failed" && !running ? (
          <Button size="sm" variant="outline" disabled={scanDisabled} onClick={() => void scan()}>
            <Trans>Retry</Trans>
          </Button>
        ) : null}
        <div className="ms-auto flex items-center gap-2">
          {consentReason ? (
            <span className="text-xs text-muted-foreground">{consentReason}</span>
          ) : null}
          <Button variant="outline" disabled={scanDisabled} onClick={() => void scan()}>
            {running ? <Trans>Scanning…</Trans> : <Trans>Scan now</Trans>}
          </Button>
          <AskAgentButton />
        </div>
      </div>
      {!modelReady ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <p className="text-xs text-muted-foreground">
            <Trans>Legal runs only on Muse Spark 1.2, which needs an OpenRouter key.</Trans>
          </p>
          {onOpenSettings ? (
            <Button size="sm" variant="outline" onClick={onOpenSettings}>
              <Trans>Open Models settings</Trans>
            </Button>
          ) : null}
        </div>
      ) : null}
      {scanError ? (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {scanError}
        </p>
      ) : null}
      {modelReady && status && !status.allowed && status.recipients.length > 0 ? (
        <LegalConsentPrompt consent={status} onChange={setGranted} />
      ) : null}
      <div className="mb-4 grid grid-cols-2 gap-3 @3xl:grid-cols-5">
        <Kpi title={t`Contracts`} value={counts.contracts} />
        <Kpi title={t`Active`} value={counts.activeContracts} />
        <Kpi title={t`Open deadlines`} value={counts.openDeadlines} />
        <Kpi title={t`Overdue`} value={overdue} />
        <Kpi title={t`Unreviewed documents`} value={counts.unreviewedDocuments} />
      </div>
      {data.contracts.length === 0 && data.deadlines.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="max-w-sm text-sm text-muted-foreground">
            <Trans>The Legal agent scans your Data room for contracts and deadlines.</Trans>
          </p>
        </div>
      ) : (
        <>
          <Tabs value={view} onValueChange={(next) => setView(next as View)} className="mb-3">
            <TabsList className="rounded-full" aria-label={t`View`}>
              <TabsTrigger value="contracts" className="rounded-full px-3">
                <Trans>Contracts</Trans>
              </TabsTrigger>
              <TabsTrigger value="deadlines" className="rounded-full px-3">
                <Trans>Deadlines</Trans>
              </TabsTrigger>
              <TabsTrigger value="graph" className="rounded-full px-3">
                <Trans>Graph</Trans>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {view === "contracts" ? <LegalContracts contracts={data.contracts} /> : null}
          {view === "deadlines" ? (
            <LegalDeadlines deadlines={data.deadlines} onChanged={overview.reload} />
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
  if (!graph.data) return <Skeleton aria-busy="true" className="h-64" />;
  return <LegalGraphView graph={graph.data} />;
}

function LegalSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-3">
      <Skeleton className="h-7 w-32" />
      <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-5">
        {[0, 1, 2, 3, 4].map((n) => (
          <Skeleton key={n} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-56" />
    </div>
  );
}
