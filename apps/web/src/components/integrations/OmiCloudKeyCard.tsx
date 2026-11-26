import { plural } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import type { OmiCloudStatus } from "@rakazo/contracts";
import { Button, Input, Label } from "@rakazo/ui-web";
import { useState } from "react";
import { Link } from "react-router-dom";
import { formatRelativeTime } from "../../lib/relative-time";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";
import { Shimmer } from "../ai/primitives";

export const OMI_CLOUD_MEETINGS_PATH = "/app/meetings?source=omi_cloud";

/** The Omi Developer key route: a quiet link, then key field and Connect, or status and Remove. */
export function OmiCloudKeyCard({
  status,
  onChanged,
}: {
  /** Null before a key was pasted. */
  status: OmiCloudStatus;
  onChanged: () => void;
}) {
  const { t } = useLingui();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const state = status?.status ?? "disconnected";
  const connected = state === "connected";

  if (!status && !open) {
    return (
      <button
        type="button"
        className="mt-6 block text-sm text-muted-foreground hover:underline"
        onClick={() => setOpen(true)}
      >
        <Trans>Use an Omi key</Trans>
      </button>
    );
  }

  async function connect() {
    setConnecting(true);
    setError(null);
    try {
      await rpc.omiCloud.connect({ apiKey: key });
      setKey("");
      onChanged();
    } catch (err) {
      setError(errorText(err, t`Could not reach Omi`));
    } finally {
      setConnecting(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await rpc.omiCloud.disconnect();
      setOpen(false);
      onChanged();
    } catch (err) {
      setError(errorText(err, t`Could not remove the key`));
    } finally {
      setBusy(false);
    }
  }

  const count = status?.syncedCount ?? 0;
  const firstImport = connected && !status?.syncedThrough;
  const meetingsLink = (label: string, className: string) => (
    <Link to={OMI_CLOUD_MEETINGS_PATH} className={className}>
      {label}
    </Link>
  );
  return (
    <section className="mt-6">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card px-3.5 py-3">
        {status && state !== "disconnected" ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-sm">
              <span
                aria-hidden="true"
                className={`size-1.5 rounded-full ${connected ? "bg-success" : "bg-warning"}`}
              />
              {!connected ? (
                <Trans>Reconnect needed</Trans>
              ) : status.syncedThrough ? (
                meetingsLink(
                  plural(count, { one: "Synced # meeting", other: "Synced # meetings" }),
                  "hover:underline",
                )
              ) : (
                <>
                  <Shimmer>
                    <Trans>Syncing</Trans>
                  </Shimmer>
                  {count > 0
                    ? meetingsLink(
                        plural(count, { one: "# meeting so far", other: "# meetings so far" }),
                        "text-muted-foreground hover:underline",
                      )
                    : null}
                </>
              )}
              {status.lastSyncedAt ? (
                <span className="text-muted-foreground">
                  {formatRelativeTime(status.lastSyncedAt)}
                </span>
              ) : null}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="ms-auto"
              disabled={busy}
              onClick={() => void remove()}
            >
              <Trans>Remove</Trans>
            </Button>
          </div>
        ) : null}
        {firstImport ? (
          <p className="text-sm text-muted-foreground">
            <Trans>Importing the last 90 days. This can take several hours.</Trans>
          </p>
        ) : null}
        {state === "disconnected" && status ? (
          <p className="text-sm text-muted-foreground">
            <Trans>Praci keeps your meetings and to-dos.</Trans>
          </p>
        ) : null}
        {state === "disconnected" && count > 0
          ? meetingsLink(
              plural(count, { one: "Synced # meeting", other: "Synced # meetings" }),
              "w-fit text-sm text-muted-foreground hover:underline",
            )
          : null}
        {!connected ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="omi-developer-key">
              <Trans>Omi developer key</Trans>
            </Label>
            <Input
              id="omi-developer-key"
              type="password"
              autoComplete="off"
              value={key}
              onChange={(event) => {
                setKey(event.target.value);
                setError(null);
              }}
            />
            {key ? null : (
              <p className="text-sm text-muted-foreground">
                <Trans>In the Omi app: Settings → Developer → Create Key.</Trans>
              </p>
            )}
            <div>
              <Button disabled={!key.trim() || connecting} onClick={() => void connect()}>
                {connecting ? (
                  <Shimmer>
                    <Trans>Connecting…</Trans>
                  </Shimmer>
                ) : (
                  <Trans>Connect</Trans>
                )}
              </Button>
            </div>
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
