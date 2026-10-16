import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Button, Skeleton, Tabs, TabsList, TabsTrigger } from "@rakazo/ui-web";
import { useState } from "react";
import {
  AskAgentButton,
  ErrorNotice,
  FinanceChromeProvider,
  Kpi,
  useFinanceQuery,
} from "../components/finance/ui";
import { LegalConsentPrompt } from "../components/legal/ConsentPrompt";
import { LegalGraphView } from "../components/legal/LegalGraph";
import { formatRelativeTime } from "../lib/relative-time";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";
import { LegalContracts } from "./legal/LegalContracts";
import { LegalDeadlines } from "./legal/LegalDeadlines";

type View = "contracts" | "deadlines" | "graph";

/** The Legal area at /app/legal: contracts, deadlines and the relationship graph the Legal agent keeps. */
export function LegalPage({ onAskAgent }: { onAskAgent?: () => void }) {
  return (
    <FinanceChromeProvider value={{ onAskAgent }}>
      <div className="@container rk-scroll flex-1 overflow-y-auto px-4 pb-6 pt-2 md:px-7 md:pt-5">
        <Legal onAskAgent={onAskAgent} />
      </div>
    </FinanceChromeProvider>
  );
}

function Legal({ onAskAgent }: { onAskAgent?: () => void }) {
  const overview = useFinanceQuery(() => rpc.legal.overview(), []);
  // A failed consent read must not hide the page; the agent reports when it cannot read documents.
  const consent = useFinanceQuery(() => rpc.legal.consent(), []);
  const [granted, setGranted] = useState<typeof consent.data>(null);
  const [view, setView] = useState<View>("contracts");
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const status = granted ?? consent.data;

  const scan = async () => {
    setScanning(true);
    setScanError("");
    try {
      await rpc.legal.scanNow();
      onAskAgent?.();
      overview.reload();
    } catch (cause) {
      setScanError(errorText(cause));
    } finally {
      setScanning(false);
    }
  };

  const data = overview.data;
  if (overview.error) return <ErrorNotice message={overview.error} onRetry={overview.retry} />;
  if (!data) return <LegalSkeleton />;
  const { counts } = data;
  const lastScan = data.agent.lastScanAt ? formatRelativeTime(data.agent.lastScanAt) : "";
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-medium">
          <Trans>Legal</Trans>
        </h1>
        <span className="text-[11px] text-muted-foreground">
          {lastScan ? <Trans>Last scan {lastScan}</Trans> : <Trans>Not scanned yet</Trans>}
        </span>
        <div className="ms-auto flex items-center gap-2">
          <Button
            variant="outline"
            disabled={scanning || status?.allowed === false}
            onClick={() => void scan()}
          >
            {scanning ? <Trans>Scanning…</Trans> : <Trans>Scan now</Trans>}
          </Button>
          <AskAgentButton />
        </div>
      </div>
      {scanError ? (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {scanError}
        </p>
      ) : null}
      {status && !status.allowed ? (
        <LegalConsentPrompt consent={status} onChange={setGranted} />
      ) : null}
      <div className="mb-4 grid grid-cols-2 gap-3 @3xl:grid-cols-5">
        <Kpi title={t`Contracts`} value={counts.contracts} />
        <Kpi title={t`Active`} value={counts.activeContracts} />
        <Kpi title={t`Open deadlines`} value={counts.openDeadlines} />
        <Kpi title={t`Overdue`} value={counts.overdueDeadlines} />
        <Kpi title={t`Unreviewed documents`} value={counts.unreviewedDocuments} />
      </div>
      {data.contracts.length === 0 && data.deadlines.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="max-w-sm text-sm text-muted-foreground">
            <Trans>The Legal agent scans your Data room for contracts and deadlines.</Trans>
          </p>
          <Button disabled={scanning || status?.allowed === false} onClick={() => void scan()}>
            <Trans>Scan now</Trans>
          </Button>
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
