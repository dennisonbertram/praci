import { Trans, useLingui } from "@lingui/react/macro";
import type { McpActivityCall } from "@rakazo/contracts";
import { Button, Skeleton } from "@rakazo/ui-web";
import { useEffect, useState } from "react";
import { rpc } from "../lib/rpc";

/** The last 20 calls of one connection: tool, how it ended, and when. */
export function McpConnectionActivity({ connectionId }: { connectionId: string }) {
  const { t, i18n } = useLingui();
  const [calls, setCalls] = useState<McpActivityCall[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` re-runs the load on Try again.
  useEffect(() => {
    let current = true;
    rpc.mcpConnections
      .activity({ id: connectionId })
      .then((rows: McpActivityCall[]) => current && setCalls(rows))
      .catch(() => current && setFailed(true));
    return () => {
      current = false;
    };
  }, [connectionId, attempt]);

  const outcome = (call: McpActivityCall) =>
    ({
      ok: t`OK`,
      error: t`Failed`,
      rate_limited: t`Rate limited`,
      pending: t`Waiting for approval`,
      blocked: t`Blocked`,
    })[call.outcome];
  const time = (iso: string) =>
    new Date(iso).toLocaleString(i18n.locale || "en", { dateStyle: "medium", timeStyle: "short" });

  if (failed) {
    return (
      <div>
        <p role="alert" className="text-sm text-destructive">
          <Trans>Could not load activity</Trans>
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-2 rounded-full"
          onClick={() => {
            setFailed(false);
            setCalls(null);
            setAttempt((n) => n + 1);
          }}
        >
          <Trans>Try again</Trans>
        </Button>
      </div>
    );
  }
  if (!calls) return <Skeleton className="h-16 w-full" />;
  if (calls.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        <Trans>No calls yet</Trans>
      </p>
    );
  }
  return (
    <ul className="space-y-1 text-sm" aria-label={t`Recent activity`}>
      {calls.map((call, index) => (
        <li key={`${call.createdAt}-${call.tool}-${index}`} className="flex items-baseline gap-3">
          <span className="font-mono">{call.tool}</span>
          <span
            className={
              call.outcome === "ok" || call.outcome === "pending"
                ? "text-muted-foreground"
                : "text-destructive"
            }
          >
            {outcome(call)}
          </span>
          <span className="ml-auto text-muted-foreground">{time(call.createdAt)}</span>
        </li>
      ))}
    </ul>
  );
}
