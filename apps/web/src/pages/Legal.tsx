import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Button, Skeleton, Tabs, TabsList, TabsTrigger } from "@rakazo/ui-web";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AskAgentButton,
  ErrorNotice,
  FinanceChromeProvider,
  Kpi,
  useFinanceQuery,
} from "../components/finance/ui";
import { HideAmountsButton } from "../components/HideAmountsToggle";
import { LegalConsentPrompt } from "../components/legal/ConsentPrompt";
import { LegalGraphView } from "../components/legal/LegalGraph";
import { DATA_ROOM_PATH } from "../lib/data-room";
import { daysBetween, todayIso } from "../lib/legal-format";
import { formatRelativeTime } from "../lib/relative-time";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";
import { LegalContracts } from "./legal/LegalContracts";
import { LegalDeadlines } from "./legal/LegalDeadlines";

const VIEWS = ["contracts", "deadlines", "graph"] as const;
type View = (typeof VIEWS)[number];
const LEGAL_PATH = "/app/legal";

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
  /** Opens Settings on Models > OpenRouter with the own-key form open. */
  onOpenSettings?: () => void;
  /** Settings is open over the page; the page re-reads its state when it closes. */
  settingsOpen?: boolean;
}) {
  return (
    <FinanceChromeProvider value={{ onAskAgent, agentName: "Legal agent" }}>
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
  // The tab lives in the URL, so the deadline tiles can link straight to it.
  const [params, setParams] = useSearchParams();
  const asked = params.get("view");
  const view: View = VIEWS.includes(asked as View) ? (asked as View) : "contracts";
  const setView = (next: View) =>
    setParams(next === "contracts" ? {} : { view: next }, { replace: true });
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

  // A failed first load has nothing to show; a failed re-read keeps the page and says so.
  if (overview.error && !data) {
    return <ErrorNotice message={overview.error} onRetry={overview.retry} />;
  }
  if (!data) return <LegalSkeleton />;
  const blocker = data.modelBlocker;
  const needsConsent = status?.allowed === false;
  const scanDisabled = running || blocker !== null || needsConsent;
  // Said next to a disabled Scan now, whatever the reason.
  const scanReason = running
    ? ""
    : blocker === "own_key"
      ? t`Needs your OpenRouter key.`
      : blocker === "model_changed"
        ? t`Needs Muse Spark 1.2.`
        : status && needsConsent
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
        <h1 className="text-lg font-medium">
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
            <Trans>Last scan {lastScan}. Scans daily.</Trans>
          ) : (
            <Trans>Not scanned yet</Trans>
          )}
        </span>
        {lastRun?.status === "failed" && !running ? (
          <Button size="sm" variant="outline" disabled={scanDisabled} onClick={() => void scan()}>
            <Trans>Retry</Trans>
          </Button>
        ) : null}
        <div className="ms-auto flex flex-wrap items-center justify-end gap-2">
          {/* Narrow, the reason takes its own line under the buttons, so they stay on one row. */}
          {scanReason ? (
            <span className="order-last w-full text-end text-xs text-muted-foreground @xl:order-none @xl:w-auto">
              {scanReason}
            </span>
          ) : null}
          <div className="flex items-center gap-2">
            <Button variant="outline" disabled={scanDisabled} onClick={() => void scan()}>
              {running ? <Trans>Scanning…</Trans> : <Trans>Scan now</Trans>}
            </Button>
            <HideAmountsButton />
            <AskAgentButton />
          </div>
        </div>
      </div>
      {overview.error ? (
        <ErrorNotice message={t`Could not refresh: ${overview.error}`} onRetry={overview.reload} />
      ) : null}
      {blocker ? (
        <ModelBlockerNotice
          blocker={blocker}
          model={data.model?.id ?? null}
          onOpenSettings={onOpenSettings}
        />
      ) : null}
      {scanError ? (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {scanError}
        </p>
      ) : null}
      {!blocker && status && !status.allowed && status.recipients.length > 0 ? (
        <LegalConsentPrompt consent={status} onChange={setGranted} />
      ) : null}
      <div className="mb-4 grid grid-cols-2 gap-3 @3xl:grid-cols-5">
        <Kpi title={t`Contracts`} value={counts.contracts} />
        <Kpi title={t`Active`} value={counts.activeContracts} />
        <Kpi
          title={t`Open deadlines`}
          value={counts.openDeadlines}
          to={`${LEGAL_PATH}?view=deadlines`}
        />
        <Kpi title={t`Overdue`} value={overdue} to={`${LEGAL_PATH}?view=deadlines`} />
        {/* Five tiles in two columns would leave this one alone; it takes the whole row instead. */}
        <div className="col-span-2 @3xl:col-span-1">
          <Kpi
            title={t`Documents not yet checked`}
            value={counts.unreviewedDocuments}
            to={DATA_ROOM_PATH}
            hover={t`Data room files the Legal agent has not read yet.`}
          />
        </div>
      </div>
      {data.contracts.length === 0 && data.deadlines.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="max-w-sm text-sm text-muted-foreground">
            {blocker === "own_key" ? (
              <Trans>
                Add your OpenRouter key above to start. The Legal agent then reads your Data room
                for contracts and deadlines.
              </Trans>
            ) : blocker ? (
              <Trans>
                Set the Legal agent back to Muse Spark 1.2 to start. It then reads your Data room
                for contracts and deadlines.
              </Trans>
            ) : needsConsent ? (
              <Trans>
                Allow access above to start. The Legal agent then reads your Data room for contracts
                and deadlines.
              </Trans>
            ) : (
              <Trans>
                Press Scan now to read your Data room for contracts and deadlines. Legal also scans
                every day.
              </Trans>
            )}
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

/** Why the Legal agent cannot run on Muse Spark 1.2, and the one step that fixes it. */
function ModelBlockerNotice({
  blocker,
  model,
  onOpenSettings,
}: {
  blocker: "own_key" | "model_changed";
  /** The model the agent would run on instead, when one resolves. */
  model: string | null;
  onOpenSettings?: () => void;
}) {
  return (
    <div
      role="status"
      className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm"
    >
      <p className="min-w-0 flex-1 basis-64">
        {blocker === "own_key" ? (
          <Trans>
            Legal runs on Muse Spark 1.2 and needs your own OpenRouter key. The space's shared
            OpenRouter access can't be used for Legal.
          </Trans>
        ) : model ? (
          <Trans>
            The Legal agent is set to {model}. Legal runs only on Muse Spark 1.2: choose it again in
            the Legal agent's settings.
          </Trans>
        ) : (
          <Trans>
            Legal runs only on Muse Spark 1.2: choose it again in the Legal agent's settings.
          </Trans>
        )}
      </p>
      {blocker === "own_key" && onOpenSettings ? (
        <Button size="sm" variant="outline" onClick={onOpenSettings}>
          <Trans>Add your OpenRouter key</Trans>
        </Button>
      ) : null}
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
