import { plural } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import type { OmiCloudStatus, OmiStatus } from "@rakazo/contracts";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@rakazo/ui-web";
import { ArrowLeft, MoreHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { setOthersAccess, toggleAccess } from "../../lib/integrations";
import type { OmiSyncState } from "../../lib/omi/useOmiSync";
import { useOmiSync } from "../../lib/omi/useOmiSync";
import { formatRelativeTime } from "../../lib/relative-time";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";
import { Shimmer } from "../ai/primitives";
import { ErrorNotice } from "../finance/ui";
import { ConfirmDialog } from "./AppDetail";
import { AppLogo } from "./AppLogo";
import { IntegrationAgentSection } from "./IntegrationAgentSection";
import { OmiCloudKeyCard } from "./OmiCloudKeyCard";
import { OmiSegments } from "./OmiSegments";
import { AgentToggleList } from "./parts";
import type { IntegrationsData } from "./useIntegrations";

/** Hours with at most one decimal: 27, 3.2. */
const hours = (minutes: number) => Math.round(minutes / 6) / 10;
const LONG_MIN = 120;
const CLOUD_POLL_MS = 10_000;

function StatusLine({ state }: { state: OmiSyncState }) {
  const { t } = useLingui();
  if (state.kind === "unsupported") return <Trans>Use Chrome, Edge or the desktop app</Trans>;
  if (state.kind === "old_firmware") return <Trans>Update the pendant in the Omi app</Trans>;
  if (state.kind === "failed") return <Trans>Could not reach the pendant</Trans>;
  if (state.kind === "upload_failed")
    return <Trans>Could not upload · saved on this computer</Trans>;
  if (state.kind === "connecting") {
    return (
      <Shimmer>
        <Trans>Connecting…</Trans>
      </Shimmer>
    );
  }
  if (state.kind === "downloading") {
    const { done, total } = state;
    return (
      <Shimmer>
        {done === null || (total ?? 0) < 1 ? (
          <Trans>Downloading</Trans>
        ) : (total ?? 0) >= LONG_MIN ? (
          <Trans>
            Downloading {hours(done)} of {hours(total ?? done)} h
          </Trans>
        ) : (
          <Trans>
            Downloading {Math.round(done)} of {Math.round(total ?? done)} min
          </Trans>
        )}
      </Shimmer>
    );
  }
  if (state.kind === "paused") {
    const { done, total } = state;
    return total === null || total < 1 ? (
      <Trans>Paused</Trans>
    ) : total >= LONG_MIN ? (
      <Trans>
        Paused · {hours(done)} of {hours(total)} h saved
      </Trans>
    ) : (
      <Trans>
        Paused · {Math.round(done)} of {Math.round(total)} min saved
      </Trans>
    );
  }
  if (state.kind === "synced") {
    return <span>{t`Synced ${formatRelativeTime(new Date(state.at).toISOString())}`}</span>;
  }
  return null;
}

/** The Omi page without data loading: pendant state, actions and the lists below it. */
export function OmiView({
  status,
  sync,
  noKey = false,
  error,
  onSync,
  onDisconnect,
  onDeleteAll,
  onOpenVoiceSettings,
  onRetryTranscription,
  children,
}: {
  /** Null before the first connect. */
  status: OmiStatus | undefined;
  sync: OmiSyncState;
  /** A recording could not be transcribed because no transcription provider is set up. */
  noKey?: boolean;
  error?: string | null;
  onSync: () => void;
  onDisconnect: () => void;
  onDeleteAll: () => void;
  onOpenVoiceSettings?: () => void;
  onRetryTranscription?: () => void;
  children?: ReactNode;
}) {
  const { t } = useLingui();
  const [deleting, setDeleting] = useState(false);
  const action = {
    idle: t`Connect pendant`,
    reconnect: t`Reconnect`,
    paused: t`Sync now`,
    failed: t`Sync now`,
    upload_failed: t`Sync now`,
    synced: t`Sync now`,
  }[sync.kind as "idle"];
  const primary = sync.kind === "idle" || sync.kind === "reconnect";
  return (
    <div className="rk-scroll h-full overflow-y-auto px-4 py-6 md:px-9 md:py-7">
      <div className="mx-auto max-w-[1040px]">
        <Link
          to="/app/integrations"
          className="rk-tap mb-3.5 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          <Trans>Integrations</Trans>
        </Link>
        <div className="flex flex-wrap items-center gap-4">
          <AppLogo name="Omi" size="xl" />
          <h1 className="text-xl font-semibold">Omi</h1>
          <div className="ms-auto flex items-center gap-2">
            {action ? (
              <Button variant={primary ? "default" : "outline"} onClick={onSync}>
                {action}
              </Button>
            ) : null}
            {status ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={t`More`}
                  render={<Button variant="ghost" size="icon" className="text-muted-foreground" />}
                >
                  <MoreHorizontal />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onDisconnect}>
                    <Trans>Disconnect</Trans>
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onClick={() => setDeleting(true)}>
                    <Trans>Delete all recordings</Trans>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>
        <p className="mt-4 min-h-5 text-sm" role="status">
          <StatusLine state={sync} />
        </p>
        {noKey ? (
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={onOpenVoiceSettings}
            disabled={!onOpenVoiceSettings}
          >
            <Trans>Add a transcription key</Trans>
          </Button>
        ) : null}
        {status && status.notTranscribed > 0 ? (
          <p className="mt-3 flex items-center gap-2 text-sm">
            {plural(status.notTranscribed, {
              one: "# not transcribed",
              other: "# not transcribed",
            })}
            <Button variant="outline" size="sm" onClick={onRetryTranscription}>
              <Trans>Try again</Trans>
            </Button>
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {children}
      </div>
      <ConfirmDialog
        open={deleting}
        busy={false}
        title={t`Delete all recordings?`}
        confirm={t`Delete`}
        onCancel={() => setDeleting(false)}
        onConfirm={() => {
          setDeleting(false);
          onDeleteAll();
        }}
      >
        <li>
          <Trans>Removes the audio, transcripts and meetings from Praci.</Trans>
        </li>
      </ConfirmDialog>
    </div>
  );
}

/** Who can read recordings: the Omi agent, plus any agent the owner switches on. */
export function OmiAgent({
  connectionId,
  agentBotId,
  data,
}: {
  connectionId: string;
  agentBotId: string;
  data: IntegrationsData;
}) {
  const { t } = useLingui();
  const [access, setAccess] = useState<{
    allAgents: boolean;
    botIds: string[];
    agentShared: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const load = useCallback(() => {
    void rpc.connections
      .access({ connectionId })
      .then((loaded) => {
        setAccess(loaded);
        setLoadFailed(false);
      })
      .catch(() => setLoadFailed(true));
  }, [connectionId]);
  useEffect(load, [load]);
  const allBotIds = data.bots.map((bot) => bot.id);
  const isOn = (botId: string) =>
    botId === agentBotId || (access ? access.allAgents || access.botIds.includes(botId) : false);
  const shared = access?.agentShared ?? false;
  // Each change builds on the one before it, not on the last server answer, and saves run in click order.
  const latest = useRef(access);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const [saving, setSaving] = useState(0);
  useEffect(() => {
    latest.current = access;
  }, [access]);
  const pending = useRef(0);
  const failed = useRef(false);
  function save(
    next: { allAgents: boolean; botIds: string[] },
    send: () => Promise<typeof access> = () => rpc.connections.setAccess({ connectionId, ...next }),
  ) {
    setError(null);
    // Choosing another agent turns sharing on; switching them all off leaves it on.
    const sharing = {
      ...next,
      agentShared:
        latest.current?.agentShared === true ||
        next.allAgents ||
        next.botIds.some((id) => id !== agentBotId),
    };
    latest.current = sharing;
    setAccess(sharing);
    pending.current += 1;
    setSaving((count) => count + 1);
    queue.current = queue.current.then(async () => {
      try {
        const saved = await send();
        if (latest.current === sharing) setAccess(saved);
      } catch (err) {
        setError(errorText(err, t`Could not update bot access`));
        failed.current = true;
      }
      pending.current -= 1;
      // A failure only rolls back to the server's answer once no newer selection is queued behind it.
      if (pending.current === 0 && failed.current) {
        failed.current = false;
        const server = await rpc.connections.access({ connectionId }).catch(() => null);
        if (server) setAccess(server);
      }
      setSaving((count) => count - 1);
    });
  }
  return (
    <div className="mt-6">
      <IntegrationAgentSection
        service="Omi"
        agentName={data.bots.find((bot) => bot.id === agentBotId)?.name ?? t`Omi agent`}
        agentHref={`/app/${agentBotId}`}
        writesEnabled={false}
        shared={shared}
        disabled={!access}
        idPrefix="omi"
        onShared={(on) =>
          void (async () => {
            setError(null);
            try {
              await rpc.connections.setExclusive({
                connectionId,
                exclusive: !on,
              });
              setAccess(await rpc.connections.access({ connectionId }));
            } catch (err) {
              setError(errorText(err, t`Could not update access`));
            }
          })()
        }
        usedBy={
          <AgentToggleList
            bots={data.bots}
            appName="Omi"
            ready={access !== null}
            isOn={isOn}
            ownerBotId={agentBotId}
            saving={saving > 0}
            everyone={access?.allAgents ?? false}
            onSetAll={(on) =>
              save(
                setOthersAccess(
                  latest.current ?? { allAgents: false, botIds: [] },
                  allBotIds,
                  [agentBotId],
                  on,
                ),
              )
            }
            onToggle={(botId, on) => {
              if (botId === agentBotId) return;
              // The server changes only this agent's grant; the shown state is its guess until it answers.
              save(
                toggleAccess(
                  latest.current ?? { allAgents: false, botIds: [] },
                  allBotIds,
                  botId,
                  on,
                ),
                () => rpc.connections.setAgentAccess({ connectionId, botId, on }),
              );
            }}
          />
        }
      />
      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {loadFailed ? <ErrorNotice message={t`Could not load`} onRetry={load} /> : null}
    </div>
  );
}

/** The Omi page at /app/integrations/omi. */
export function OmiPage({
  data,
  onOpenVoiceSettings,
}: {
  data: IntegrationsData;
  onOpenVoiceSettings?: () => void;
}) {
  const [status, setStatus] = useState<OmiStatus | undefined>(undefined);
  const [noKey, setNoKey] = useState(false);
  const [cloud, setCloud] = useState<OmiCloudStatus>(null);
  const [segmentsKey, setSegmentsKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try {
      setStatus((await rpc.omi.status()) ?? null);
      setCloud((await rpc.omiCloud.status()) ?? null);
      // A recording without a key stays "ready" with the error, so the status is not filtered.
      const items = await rpc.dataRoom.items.list({ source: "omi", limit: 100 });
      setNoKey(
        (items?.items ?? []).some(
          (item) => item.source === "omi" && item.error === "no_transcription_provider",
        ),
      );
    } catch (err) {
      setError(errorText(err));
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  const { state, sync } = useOmiSync(status, reload);
  // The card shows "Syncing" until the first sync finishes; ask again until it does.
  const cloudSyncing = cloud?.status === "connected" && !cloud.syncedThrough;
  useEffect(() => {
    if (!cloudSyncing) return;
    const controller = new AbortController();
    let pending = false;
    const timer = setInterval(() => {
      // One request at a time: a slow answer is not stacked under the next tick.
      if (pending) return;
      pending = true;
      void rpc.omiCloud
        .status(undefined, { signal: controller.signal })
        .then((next) => {
          if (!controller.signal.aborted) setCloud(next ?? null);
        })
        .catch(() => undefined)
        .finally(() => {
          pending = false;
        });
    }, CLOUD_POLL_MS);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [cloudSyncing]);

  async function deleteAll() {
    setError(null);
    try {
      await rpc.omi.deleteRecordings();
      setSegmentsKey((key) => key + 1);
      await reload();
    } catch (err) {
      setError(errorText(err));
    }
  }
  async function retryTranscription() {
    setError(null);
    try {
      await rpc.omi.retryTranscription();
      await reload();
    } catch (err) {
      setError(errorText(err));
    }
  }
  async function disconnect(deleteRecordings: boolean) {
    setError(null);
    try {
      await rpc.omi.disconnect({ deleteRecordings });
      await reload();
    } catch (err) {
      setError(errorText(err));
    }
  }
  return (
    <OmiView
      status={status}
      sync={status === null && state.kind === "reconnect" ? { kind: "idle" } : state}
      noKey={noKey}
      error={error}
      onSync={sync}
      onDisconnect={() => void disconnect(false)}
      onDeleteAll={() => void deleteAll()}
      onOpenVoiceSettings={onOpenVoiceSettings}
      onRetryTranscription={() => void retryTranscription()}
    >
      <OmiCloudKeyCard status={cloud} onChanged={() => void reload()} />
      {status ? (
        <>
          <OmiSegments reloadKey={segmentsKey} />
          {status.agentBotId ? (
            <OmiAgent
              connectionId={status.connectionId}
              agentBotId={status.agentBotId}
              data={data}
            />
          ) : null}
        </>
      ) : cloud?.agentBotId && cloud.status === "connected" ? (
        <OmiAgent connectionId={cloud.connectionId} agentBotId={cloud.agentBotId} data={data} />
      ) : null}
    </OmiView>
  );
}
