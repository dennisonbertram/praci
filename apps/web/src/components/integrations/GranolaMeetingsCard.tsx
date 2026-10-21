import { Trans, useLingui } from "@lingui/react/macro";
import type { MeetingsStatus } from "@rakazo/contracts";
import { Button, Input, Label } from "@rakazo/ui-web";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatRelativeTime } from "../../lib/relative-time";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";
import { Shimmer } from "../ai/primitives";
import { IntegrationAgentSection } from "./IntegrationAgentSection";

export const GRANOLA_MEETINGS_PATH = "/app/integrations/granola/meetings";
const KEY_HELP_URL = "https://docs.granola.ai/help-center/sharing/integrations/granola-api";

type Line = "reconnect" | "consent" | "syncing" | "synced";

/** The one status the key route shows, in the order the card and the tile share. Null: no line. */
export function granolaLine(status: MeetingsStatus): Line | null {
  if (!status || status.status === "disconnected") return null;
  if (status.status === "needs_reconnect") return "reconnect";
  if (status.consentOff) return "consent";
  return status.syncedThrough ? "synced" : "syncing";
}

const TONE: Record<Line, "success" | "warning" | "muted"> = {
  reconnect: "warning",
  consent: "muted",
  syncing: "muted",
  synced: "success",
};

/** Dot plus words. On the card the words link on; on a tile (already a link) they are plain text. */
export function GranolaStatusLine({
  status,
  interactive = false,
  onOpenAiDataSharing,
}: {
  status: NonNullable<MeetingsStatus>;
  interactive?: boolean;
  onOpenAiDataSharing?: () => void;
}) {
  const { t } = useLingui();
  const line = granolaLine(status);
  if (!line) return null;
  const count = status.syncedCount;
  const label = {
    reconnect: t`Reconnect needed`,
    consent: t`AI data sharing off`,
    syncing: t`Syncing`,
    synced: t`Synced ${count} meetings`,
  }[line];
  const words =
    line === "syncing" ? (
      <Shimmer>{label}</Shimmer>
    ) : interactive && line === "synced" ? (
      <Link to={GRANOLA_MEETINGS_PATH} className="hover:underline">
        {label}
      </Link>
    ) : interactive && line === "consent" && onOpenAiDataSharing ? (
      <button type="button" className="hover:underline" onClick={onOpenAiDataSharing}>
        {label}
      </button>
    ) : (
      label
    );
  const tone = TONE[line];
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span
        aria-hidden="true"
        data-tone={tone}
        className={`size-1.5 rounded-full ${
          tone === "success"
            ? "bg-success"
            : tone === "warning"
              ? "bg-warning"
              : "bg-muted-foreground"
        } ${line === "syncing" ? "animate-pulse" : ""}`}
      />
      {words}
      {status.lastSyncedAt && line !== "syncing" ? (
        <span className="text-muted-foreground">{formatRelativeTime(status.lastSyncedAt)}</span>
      ) : null}
    </span>
  );
}

/** The Granola API-key route: key field and Connect, or its status and Disconnect. */
export function GranolaMeetingsCard({
  status,
  bothRoutes,
  agentName,
  onChanged,
  onOpenAiDataSharing,
}: {
  status: MeetingsStatus;
  /** The sign-in route is connected too, so each card names its route. */
  bothRoutes: boolean;
  agentName: string;
  onChanged: () => void;
  onOpenAiDataSharing?: () => void;
}) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const [key, setKey] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const state = status?.status ?? "disconnected";
  const connected = state === "connected";
  const showForm = !connected;

  async function run(action: () => Promise<unknown>, fallback: string) {
    setBusy(true);
    try {
      await action();
      onChanged();
    } catch (err) {
      setError(errorText(err, fallback));
    } finally {
      setBusy(false);
    }
  }

  async function connect() {
    setConnecting(true);
    setError(null);
    try {
      await rpc.meetings.connect({ apiKey: key });
      setKey("");
      onChanged();
    } catch (err) {
      setError(errorText(err, t`Could not reach Granola`));
    } finally {
      setConnecting(false);
    }
  }

  return (
    <section aria-label={t`Granola API key`}>
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card px-3.5 py-3">
        {bothRoutes ? (
          <span className="text-xs font-semibold text-muted-foreground">
            <Trans>API key</Trans>
          </span>
        ) : null}
        {status && state !== "disconnected" ? (
          <div className="flex flex-wrap items-center gap-3">
            <GranolaStatusLine
              status={status}
              interactive
              onOpenAiDataSharing={onOpenAiDataSharing}
            />
            <Button
              size="sm"
              variant="outline"
              className="ms-auto"
              disabled={busy}
              onClick={() => void run(() => rpc.meetings.disconnect(), t`Could not disconnect`)}
            >
              <Trans>Disconnect</Trans>
            </Button>
          </div>
        ) : null}
        {state === "disconnected" && status ? (
          <p className="text-sm text-muted-foreground">
            {status.syncedCount > 0 ? (
              <Link to={GRANOLA_MEETINGS_PATH} className="hover:underline">
                <Trans>Praci keeps your meetings and to-dos.</Trans>
              </Link>
            ) : (
              <Trans>Praci keeps your meetings and to-dos.</Trans>
            )}
          </p>
        ) : null}
        {showForm ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <Label htmlFor="granola-api-key">
                <Trans>Granola API key</Trans>{" "}
                <span className="font-normal text-muted-foreground">
                  <Trans>Business plan</Trans>
                </span>
              </Label>
              {!key || error === t`Granola rejected this key` ? (
                <a
                  href={KEY_HELP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground underline"
                >
                  <Trans>Get a key</Trans>
                </a>
              ) : null}
            </div>
            <Input
              id="granola-api-key"
              type="password"
              autoComplete="off"
              value={key}
              onChange={(event) => {
                setKey(event.target.value);
                setError(null);
              }}
            />
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
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
            <p className="text-sm text-muted-foreground">
              <Trans>Sends your meeting notes and transcripts to your AI model.</Trans>
            </p>
          </div>
        ) : null}
        {connected && error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
      {status ? (
        status.agentBotId ? (
          <IntegrationAgentSection
            service="Granola"
            agentName={agentName}
            agentHref={`/app/${status.agentBotId}`}
            writesEnabled={false}
            shared={false}
            disabled={busy}
            idPrefix="granola-key"
          />
        ) : connected ? (
          <div className="mt-3">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const { botId } = await rpc.connections.createAgent({
                    connectionId: status.connectionId,
                  });
                  navigate(`/app/${botId}`);
                }, t`Could not create agent`)
              }
            >
              <Trans>Create agent</Trans>
            </Button>
          </div>
        ) : null
      ) : null}
    </section>
  );
}
