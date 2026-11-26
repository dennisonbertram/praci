import { plural } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import type { LocalMeetingsStatus } from "@rakazo/contracts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Label,
  Switch,
} from "@rakazo/ui-web";
import { useCallback, useEffect, useState } from "react";
import type { HexOutcome } from "../../lib/hex/sync";
import { hexBridge, hexSyncNow, useHexOutcome } from "../../lib/hex/useHexSync";
import { formatRelativeTime } from "../../lib/relative-time";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";
import { CardHead, IntegrationTile } from "./parts";

type Tone = "success" | "warning" | "muted" | "destructive";
const DOT: Record<Tone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  muted: "bg-muted-foreground",
  destructive: "bg-destructive",
};

function Line({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span aria-hidden="true" data-tone={tone} className={`size-1.5 rounded-full ${DOT[tone]}`} />
      {children}
    </span>
  );
}

/**
 * The Hex tile. Hex records on the Mac, so only the macOS desktop app can connect and sync it;
 * everywhere else the tile appears once a connection exists, read-only except Disconnect.
 * `available` and `outcome` are inputs for stories; the app reads them from the desktop bridge.
 */
export function HexCard({
  available = hexBridge() !== undefined,
  outcome: outcomeOverride,
}: {
  available?: boolean;
  outcome?: HexOutcome;
}) {
  const { t } = useLingui();
  const liveOutcome = useHexOutcome();
  const outcome = outcomeOverride ?? liveOutcome;
  const [status, setStatus] = useState<LocalMeetingsStatus | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleteMeetings, setDeleteMeetings] = useState(false);

  const reload = useCallback(
    () =>
      Promise.resolve()
        .then(() => rpc.meetings.localStatus())
        .then((next) => setStatus(next ?? null))
        .catch(() => setStatus((previous) => previous ?? null)),
    [],
  );
  // Reload when a pass ends, so the count and time are current.
  useEffect(() => void reload(), [reload, outcome]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await reload();
    } catch (cause) {
      setError(errorText(cause, t`Could not update Hex`));
    } finally {
      setBusy(false);
    }
  }
  const connect = () =>
    run(async () => {
      await rpc.meetings.connectLocal({ source: "hex" });
      void hexSyncNow();
    });
  const disconnect = () =>
    run(async () => {
      if (status)
        await rpc.meetings.disconnectLocal({ connectionId: status.connectionId, deleteMeetings });
      setConfirming(false);
      setDeleteMeetings(false);
    });

  if (status === undefined) return null;
  const connected = status?.status === "connected";
  if (!available && !connected) return null;

  let line: React.ReactNode = null;
  if (!connected) {
    line = (
      <Button size="sm" disabled={busy} onClick={() => void connect()}>
        <Trans>Connect</Trans>
      </Button>
    );
  } else if (!available) {
    line = (
      <>
        <Line tone="muted">
          <Trans>Desktop app</Trans>
        </Line>
        {status?.lastSyncedAt ? (
          <span className="text-sm text-muted-foreground">
            <Trans>Last sync {formatRelativeTime(status.lastSyncedAt)}</Trans>
          </span>
        ) : null}
      </>
    );
  } else if (outcome === "not_found") {
    line = (
      <Line tone="muted">
        <Trans>Install Hex</Trans>
      </Line>
    );
  } else if (outcome === "update") {
    line = (
      <Line tone="warning">
        <Trans>Update Hex</Trans>
      </Line>
    );
  } else if (outcome === "failed") {
    line = (
      <>
        <Line tone="destructive">
          <Trans>Couldn't read Hex</Trans>
        </Line>
        <Button size="sm" variant="outline" onClick={() => void hexSyncNow()}>
          <Trans>Retry</Trans>
        </Button>
      </>
    );
  } else if (!status?.lastSyncedAt) {
    line = (
      <Line tone="muted">
        <Trans>Syncing</Trans>
      </Line>
    );
  } else {
    line = (
      <>
        <Line tone="success">
          <Trans>Synced</Trans>
        </Line>
        <span className="text-sm text-muted-foreground">
          {plural(status.count, { one: "# meeting", other: "# meetings" })} ·{" "}
          {formatRelativeTime(status.lastSyncedAt)}
        </span>
      </>
    );
  }

  return (
    <IntegrationTile className="relative max-sm:flex-row max-sm:flex-wrap max-sm:items-center">
      <CardHead name="Hex" sub={t`Meetings recorded on this Mac`} />
      <div className="mt-auto flex min-h-7 flex-wrap items-center gap-2 max-sm:basis-full">
        {line}
        {connected ? (
          <Button
            size="sm"
            variant="outline"
            className="ms-auto"
            disabled={busy}
            onClick={() => setConfirming(true)}
          >
            <Trans>Disconnect</Trans>
          </Button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <AlertDialog open={confirming} onOpenChange={(open) => !open && setConfirming(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <Trans>Disconnect Hex?</Trans>
            </AlertDialogTitle>
          </AlertDialogHeader>
          <div className="flex items-center gap-2">
            <Switch
              id="hex-delete-meetings"
              checked={deleteMeetings}
              onCheckedChange={setDeleteMeetings}
            />
            <Label htmlFor="hex-delete-meetings">
              <Trans>Delete imported meetings too</Trans>
            </Label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Trans>Cancel</Trans>
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                void disconnect();
              }}
            >
              <Trans>Disconnect</Trans>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </IntegrationTile>
  );
}
