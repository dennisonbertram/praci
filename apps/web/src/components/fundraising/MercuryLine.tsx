import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { MercurySafeState } from "@rakazo/contracts";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@rakazo/ui-web";
import { formatRelativeTime } from "../../lib/relative-time";

/**
 * The Fundraising header's Mercury line: Connect Mercury, "Mercury · 5m ago" with Refresh, or
 * "Sync failed" with Refresh and Reconnect. Rows Mercury sent that could not be read are named
 * beside it; none of them was written.
 */
export function MercuryLine({
  state,
  onConnect,
  onRefresh,
  onReconnect,
}: {
  state: MercurySafeState;
  onConnect: () => void;
  onRefresh: () => void;
  onReconnect: () => void;
}) {
  if (state.status === "not_connected")
    return (
      <Button variant="outline" size="sm" onClick={onConnect}>
        <Trans>Connect Mercury</Trans>
      </Button>
    );
  const failed = state.status !== "ok";
  const synced = state.lastSyncedAt ? formatRelativeTime(state.lastSyncedAt) : null;
  const label = failed ? t`Sync failed` : synced ? t`Mercury · ${synced}` : t`Mercury`;
  const unreadable = state.unreadable;
  return (
    <div className="flex items-center gap-2">
      {unreadable > 0 ? (
        <span className="text-xs text-muted-foreground">
          {unreadable === 1
            ? t`1 SAFE could not be read`
            : t`${unreadable} SAFEs could not be read`}
        </span>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className={failed ? "text-warning" : "text-muted-foreground"}
            />
          }
        >
          {label}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onRefresh}>
            <Trans>Refresh</Trans>
          </DropdownMenuItem>
          {failed ? (
            <DropdownMenuItem onClick={onReconnect}>
              <Trans>Reconnect</Trans>
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
