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
import { ChevronDown } from "lucide-react";
import { formatRelativeTime } from "../../lib/relative-time";

/**
 * The Fundraising header's Mercury line (beside the title, like the Investors source line): Connect Mercury, "Mercury · 5m ago" with Refresh, or
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
      <Button
        variant="ghost"
        size="sm"
        className="-mx-1 h-8 px-1 text-xs font-normal text-muted-foreground pointer-coarse:h-11"
        onClick={onConnect}
      >
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
              className={`-mx-1 h-8 px-1 text-xs font-normal pointer-coarse:h-11 ${failed ? "text-warning" : "text-muted-foreground"}`}
            />
          }
        >
          {label}
          <ChevronDown aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
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
