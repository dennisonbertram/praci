import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { DEVIN_APP_ORIGIN } from "@rakazo/contracts";
import { Button, Skeleton } from "@rakazo/ui-web";
import { useEffect, useRef } from "react";
import {
  AskAgentButton,
  ErrorNotice,
  FinanceChromeProvider,
  Kpi,
  useFinanceQuery,
} from "../components/finance/ui";
import { PageHeader } from "../components/PageHeader";
import { kindSection } from "../lib/devin-format";
import { formatRelativeTime } from "../lib/relative-time";
import { rpc } from "../lib/rpc";
import { DevinSessions } from "./devin/DevinSessions";

/** How often the page re-reads the shared session list while it is visible. */
const REFRESH_MS = 60_000;

/**
 * The Devin page at /app/devin: the connected organization's sessions, read-only. Connect and
 * Reconnect are handed in (the Shell opens the key dialog); Ask is handed in only for the connector.
 */
export function DevinPage({
  onAskAgent,
  onConnect,
  onReconnect,
}: {
  onAskAgent?: () => void;
  onConnect?: () => void;
  onReconnect?: () => void;
}) {
  return (
    <FinanceChromeProvider value={{ onAskAgent, agentName: "Devin agent" }}>
      <div className="@container rk-scroll flex-1 overflow-y-auto px-4 pb-6 pt-2 md:px-7">
        <Devin onConnect={onConnect} onReconnect={onReconnect} />
      </div>
    </FinanceChromeProvider>
  );
}

function Devin({ onConnect, onReconnect }: { onConnect?: () => void; onReconnect?: () => void }) {
  const query = useFinanceQuery(() => rpc.devin.sessions(), []);
  const data = query.data;
  const reload = useRef(query.reload);
  reload.current = query.reload;

  // Session state changes in Devin, not here: re-read every minute while visible, and when the
  // person comes back to the tab.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "hidden") reload.current();
    };
    const timer = setInterval(refresh, REFRESH_MS);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  // The sidebar count reads the same rows; tell it each time they were read.
  useEffect(() => {
    if (data) window.dispatchEvent(new Event("rakazo:notifications-changed"));
  }, [data]);

  if (!data) {
    return query.error ? (
      <div>
        <PageHeader title={<Trans>Devin</Trans>} />
        <ErrorNotice message={t`Could not load Devin sessions.`} onRetry={query.retry} />
      </div>
    ) : (
      <DevinSkeleton />
    );
  }

  const { connection, sessions } = data;
  const isConnector = connection.isConnector;
  const paused = connection.status === "rejected" || connection.status === "connector_gone";
  const header = (
    <PageHeader
      title={<Trans>Devin</Trans>}
      meta={
        data.stale && data.fetchedAt ? (
          <span className="text-[11px]">
            <Trans>Updated {formatRelativeTime(data.fetchedAt)}</Trans>
          </span>
        ) : undefined
      }
      actions={isConnector && !paused ? <AskAgentButton /> : undefined}
    />
  );

  if (connection.status === "none") {
    return (
      <div>
        {header}
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          {connection.canConnect ? (
            <>
              <p className="max-w-sm text-sm text-muted-foreground">
                <Trans>Connect Devin to see its sessions here.</Trans>
              </p>
              <Button onClick={onConnect}>
                <Trans>Connect Devin</Trans>
              </Button>
            </>
          ) : (
            <p className="max-w-sm text-sm text-muted-foreground">
              <Trans>Ask a space owner to connect Devin.</Trans>
            </p>
          )}
        </div>
      </div>
    );
  }

  const needsYou = sessions.filter((s) => kindSection(s.kind) === "needs_you").length;
  const working = sessions.filter((s) => s.kind === "working").length;
  // A rate limit with rows on screen is already said by "Updated …"; everything else says so.
  const failed =
    connection.status === "unreachable" ||
    (connection.status === "rate_limited" && sessions.length === 0);
  const reconnect =
    connection.manage && onReconnect ? { label: t`Reconnect`, onClick: onReconnect } : undefined;
  return (
    <div>
      {header}
      {query.error || failed ? (
        <ErrorNotice message={t`Could not load Devin sessions.`} onRetry={query.reload} />
      ) : null}
      {paused ? (
        <>
          <ErrorNotice
            message={
              connection.status === "rejected"
                ? t`Devin rejected the key. Alerts are paused.`
                : t`The member who connected Devin left this space. Alerts are paused.`
            }
            action={reconnect}
          />
          {!connection.manage ? (
            <p className="-mt-3 mb-4 text-sm text-muted-foreground">
              <Trans>Ask a space owner to reconnect.</Trans>
            </p>
          ) : null}
        </>
      ) : sessions.length > 0 ? (
        <div className="mb-4 grid grid-cols-2 gap-3">
          <Kpi title={t`Needs you`} value={needsYou} alert={needsYou > 0} />
          <Kpi title={t`Working`} value={working} />
        </div>
      ) : null}
      {data.partial && !paused ? (
        <p className="mb-3 text-xs text-muted-foreground">
          <Trans>Some sessions could not be read.</Trans>
        </p>
      ) : null}
      {sessions.length > 0 ? (
        <DevinSessions sessions={sessions} muted={paused} />
      ) : !failed && !paused && !data.partial ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center text-sm">
          <p className="text-muted-foreground">
            <Trans>No Devin sessions yet.</Trans>
          </p>
          <a
            href={DEVIN_APP_ORIGIN}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            <Trans>Open Devin</Trans>
          </a>
        </div>
      ) : null}
    </div>
  );
}

function DevinSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-3">
      <Skeleton className="h-7 w-32" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      {[0, 1, 2, 3, 4, 5].map((n) => (
        <Skeleton key={n} className="h-10" />
      ))}
    </div>
  );
}
