import { Trans } from "@lingui/react/macro";
import type { McpPendingAction } from "@rakazo/contracts";
import {
  actionTypeForTool,
  ALWAYS_ASK_ACTION_TYPES,
  hardLineFor,
  toolRuleAllowsAllow,
} from "@rakazo/core";
import { Button } from "@rakazo/ui-web";
import { formatRelativeTime } from "../lib/relative-time";

/** One change an outside client asked for, with what it sent, waiting for Approve or Deny. */
export function McpActionCard({
  action,
  busy,
  onDecide,
}: {
  action: McpPendingAction;
  busy: boolean;
  onDecide: (decision: "approve" | "deny", alwaysAllow?: boolean) => void;
}) {
  const fields = Object.entries(action.args)
    .filter(([, value]) => value !== undefined)
    // The agent's name reads better than its id.
    .map(([key, value]): [string, unknown] =>
      key === "botId" && action.botName ? ["agent", action.botName] : [key, value],
    );
  const actionType = actionTypeForTool({
    toolName: action.tool,
    viaConnector: true,
    readOnly: false,
    args: action.args,
  });
  const canSaveAllowRule =
    toolRuleAllowsAllow(action.tool) &&
    !(actionType && ALWAYS_ASK_ACTION_TYPES.has(actionType)) &&
    hardLineFor({
      toolName: action.tool,
      viaConnector: true,
      readOnly: false,
      args: action.args,
    }) === null;
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset brings its own border and sizing to a card
    <div
      role="group"
      aria-label={`${action.connectionLabel}: ${action.tool}`}
      className="max-w-full rounded-2xl border border-border bg-card px-5 py-4"
    >
      <div className="flex items-baseline gap-2 text-[13.5px]">
        <span className="font-medium text-foreground">{action.connectionLabel}</span>
        <span className="font-mono text-muted-foreground">{action.tool}</span>
        <span className="text-muted-foreground">{formatRelativeTime(action.createdAt)}</span>
      </div>
      {fields.length > 0 ? (
        <dl className="mt-2 space-y-1 text-[13.5px]">
          {fields.map(([key, value]) => (
            <div key={key} className="flex gap-2">
              <dt className="shrink-0 text-muted-foreground">{key}</dt>
              <dd className="min-w-0 break-words text-foreground">
                {typeof value === "string" ? value : JSON.stringify(value)}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      <div className="mt-3.5 flex gap-2">
        <Button disabled={busy} onClick={() => onDecide("approve")}>
          <Trans>Approve</Trans>
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => onDecide("deny")}>
          <Trans>Deny</Trans>
        </Button>
        {canSaveAllowRule ? (
          <Button
            variant="ghost"
            className="ms-auto"
            disabled={busy}
            onClick={() => onDecide("approve", true)}
          >
            <Trans>Approve and save an Allow rule</Trans>
          </Button>
        ) : null}
      </div>
      {canSaveAllowRule ? (
        <p className="mt-2 text-end text-[13px] text-muted-foreground">
          <Trans>Stricter space permissions can still require approval.</Trans>
        </p>
      ) : null}
    </div>
  );
}
