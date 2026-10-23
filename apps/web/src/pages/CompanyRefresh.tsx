import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Button, Skeleton } from "@rakazo/ui-web";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useFinanceQuery } from "../components/finance/ui";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";

type Source = Awaited<ReturnType<typeof rpc.companyImport.refreshStatus>>[number];
function sourceName(kind: string) {
  if (kind === "data_room") return t`Data Room`;
  return (
    {
      gmail: "Gmail",
      slack: "Slack",
      github: "GitHub",
      notion: "Notion",
      linear: "Linear",
      mcp: "MCP",
      composio: "Connected app",
    }[kind] ?? kind
  );
}
function sourceReason(source: Source) {
  if (source.reason === "source_disconnected") return t`Reconnect this source before importing.`;
  if (source.reason === "gmail_history_expired")
    return t`Gmail history expired. Re-import to establish a new checkpoint.`;
  if (source.capability !== "supported") {
    if (source.sourceKind === "slack")
      return t`Slack history does not reliably include edits to older messages.`;
    if (source.sourceKind === "github")
      return t`GitHub lists do not provide a complete change feed.`;
    if (source.sourceKind === "notion")
      return t`Notion search does not guarantee complete or immediate change detection.`;
    if (source.sourceKind === "linear" || source.reason?.includes("linear"))
      return t`The selected Linear reader does not provide a complete change feed.`;
    if (source.sourceKind === "data_room")
      return t`Connected Data Room sources require manual re-import.`;
    return t`This reader has no verified incremental change feed.`;
  }
  if (source.status === "awaiting_consent") return t`Model consent needed`;
  if (source.status === "budget_reached") return t`Token budget reached`;
  if (source.status === "recovery_required" || source.status === "needs_baseline")
    return t`Re-import to establish a checkpoint.`;
  if (source.reason) return t`Refresh needs attention`;
  return "";
}
export function CompanyRefresh({ onChanged }: { onChanged: () => void }) {
  const query = useFinanceQuery(() => rpc.companyImport.refreshStatus(), []);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const reload = query.reload;
  const active = query.data?.some((source) => !!source.runId);
  useEffect(() => {
    window.addEventListener("focus", reload);
    const timer = active ? setInterval(reload, 4000) : undefined;
    return () => {
      window.removeEventListener("focus", reload);
      if (timer) clearInterval(timer);
    };
  }, [active, reload]);
  async function refresh(source: Source) {
    setBusy(source.id);
    setError("");
    try {
      await rpc.companyImport.refresh({ sourceId: source.id });
      reload();
      onChanged();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(null);
    }
  }
  return (
    <section aria-label={t`Refresh sources`} className="space-y-3">
      {(error || query.error) && (
        <p role="alert" className="text-sm text-destructive">
          {error || query.error}{" "}
          <Button
            variant="link"
            onClick={() => {
              setError("");
              reload();
            }}
          >
            <Trans>Retry</Trans>
          </Button>
        </p>
      )}
      {!query.data && !query.error && <Skeleton className="h-24 w-full" />}
      {query.data?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          <Trans>Import a source to set up refresh.</Trans>
        </p>
      )}
      {query.data?.map((source) => (
        <div key={source.id} className="rounded-lg border bg-card p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-medium">{sourceName(source.sourceKind)}</h3>
            {source.capability === "supported" &&
            (source.runId ||
              (source.lastSuccessAt &&
                ["ready", "failed", "partial", "cancelled"].includes(source.status))) ? (
              source.runId ? (
                <Link
                  className="underline underline-offset-4"
                  to={`/app/company/import?runId=${encodeURIComponent(source.runId)}`}
                >
                  <Trans>View progress</Trans>
                </Link>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() => void refresh(source)}
                >
                  <Trans>Refresh</Trans>
                </Button>
              )
            ) : (
              <Link className="underline underline-offset-4" to="/app/company/import?new=1">
                <Trans>Re-import</Trans>
              </Link>
            )}
          </div>
          {sourceReason(source) && (
            <p className="mt-2 text-muted-foreground">{sourceReason(source)}</p>
          )}
          {source.capability !== "supported" && (
            <p className="mt-1 text-xs text-muted-foreground">
              <Trans>Manual re-import only</Trans>
            </p>
          )}
          {source.capability === "supported" && source.lastSuccessAt && (
            <p className="mt-2 text-xs text-muted-foreground">
              <Trans>Last completed</Trans>:{" "}
              <time dateTime={source.lastSuccessAt}>
                {new Date(source.lastSuccessAt).toLocaleString(undefined, {
                  timeZoneName: "short",
                })}
              </time>
            </p>
          )}
          {source.capability === "supported" && source.nextRunAt && (
            <p className="mt-1 text-xs text-muted-foreground">
              <Trans>Next refresh</Trans>:{" "}
              <time dateTime={source.nextRunAt}>
                {new Date(source.nextRunAt).toLocaleString(undefined, { timeZoneName: "short" })}
              </time>
            </p>
          )}
        </div>
      ))}
    </section>
  );
}
