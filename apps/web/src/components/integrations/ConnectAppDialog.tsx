import { Trans, useLingui } from "@lingui/react/macro";
import type { Connection, ConnectionCatalogItem } from "@rakazo/contracts";
import { abortableDelay } from "@rakazo/core";
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle } from "@rakazo/ui-web";
import { useEffect, useRef, useState } from "react";
import { desktopBridge, signInWithSystemBrowser } from "../../lib/desktop";
import { PLUGIN_CONNECT_WINDOW } from "../../lib/plugin-connect";
import { rpc } from "../../lib/rpc";
import { watchWindowClosed } from "../../lib/sign-in-window";
import { errorText } from "../../lib/user-error";
import { AgentStep } from "./AgentStep";
import { AppLogo } from "./AppLogo";
import { type SignInState, SignInStep } from "./SignInStep";
import type { IntegrationsData } from "./useIntegrations";

type Phase =
  | { kind: "signin"; state: SignInState }
  | { kind: "agents" }
  | { kind: "done"; agents: "all" | "some" | "none" | "skipped" };

const POLL_ATTEMPTS = 45;

function nextAccountLabel(name: string, existing: number) {
  return existing <= 0 ? name : `${name} ${existing + 1}`;
}

/** Connect a managed app: sign in, choose which agents get it, confirm. */
export function ConnectAppDialog({
  item,
  data,
  activeBotId,
  onClose,
}: {
  item: ConnectionCatalogItem;
  data: IntegrationsData;
  activeBotId?: string;
  onClose: () => void;
}) {
  const { t } = useLingui();
  const [phase, setPhase] = useState<Phase>({ kind: "signin", state: { kind: "waiting" } });
  const [row, setRow] = useState<Connection | null>(null);
  const [saving, setSaving] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const started = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const authorizationUrl = useRef<string | null>(null);
  const connectionId = useRef<string | null>(null);
  const finished = useRef(false);
  const failed = useRef(false);
  const popup = useRef<Window | null>(null);
  const stopWatching = useRef<() => void>(() => undefined);
  const { refresh } = data;

  const sameApp = (entry: Connection) =>
    entry.connectorId === item.connectorId && entry.provider === item.slug;

  function succeed(connection: Connection) {
    finished.current = true;
    stopWatching.current();
    popup.current?.close();
    setRow(connection);
    void refresh();
    if (activeBotId) {
      void rpc.onboarding
        .appConnected({ botId: activeBotId, provider: item.slug, connectorId: item.connectorId })
        .catch(() => undefined);
    }
    setPhase(data.bots.length > 0 ? { kind: "agents" } : { kind: "done", agents: "none" });
  }

  function fail(message: string) {
    failed.current = true;
    stopWatching.current();
    setPhase({ kind: "signin", state: { kind: "failed", message } });
  }

  /** Opens the sign-in window. A browser that blocks it leaves the dialog on the blocked step. */
  function openWindow(url: string): boolean {
    const opened = window.open(url, PLUGIN_CONNECT_WINDOW, "popup,width=560,height=720");
    if (!opened) {
      setPhase({ kind: "signin", state: { kind: "blocked" } });
      return false;
    }
    try {
      // The provider's page must not reach back into Rakazo.
      opened.opener = null;
    } catch {
      // Cross-origin handles may refuse; the named window still works.
    }
    popup.current = opened;
    stopWatching.current();
    setPhase({ kind: "signin", state: { kind: "waiting" } });
    // A closed window only adds a hint: some providers sever the handle while sign-in continues.
    stopWatching.current = watchWindowClosed(opened, () => {
      if (!finished.current && !failed.current) {
        setPhase({ kind: "signin", state: { kind: "waiting", closed: true } });
      }
    });
    return true;
  }

  async function start() {
    controller.current?.abort();
    const attempt = new AbortController();
    controller.current = attempt;
    failed.current = false;
    stopWatching.current();
    setPhase({ kind: "signin", state: { kind: "waiting" } });
    try {
      const rows = data.connections.filter(sameApp);
      // Reuse a pending row instead of piling up duplicates: it may already be signed in.
      const stale = rows.filter((entry) => entry.status === "pending");
      for (const pending of stale) {
        const done = await rpc.connections
          .complete({ connectionId: pending.id })
          .catch(() => undefined);
        if (done?.status === "connected") return succeed(done);
      }
      // Google refuses embedded browsers, so desktop signs in with the system browser. That browser
      // has no Rakazo session: the shell catches the code on loopback and this window finishes it.
      const viaSystemBrowser = item.connectorId === "google" && Boolean(desktopBridge());
      const begun = await rpc.connections.begin({
        connectorId: item.connectorId,
        provider: item.slug,
        displayName: nextAccountLabel(
          item.name,
          rows.filter((entry) => entry.status === "connected").length,
        ),
        ...(viaSystemBrowser ? { redirect: "desktop" as const } : {}),
      });
      connectionId.current = begun.connectionId;
      for (const old of stale)
        void rpc.connections.revoke({ connectionId: old.id }).catch(() => undefined);
      if (attempt.signal.aborted) return;
      if (viaSystemBrowser && begun.authorizationUrl) {
        const { code, state } = await signInWithSystemBrowser(
          begun.authorizationUrl,
          attempt.signal,
        );
        const done = await rpc.connections.complete({ state, code });
        if (!attempt.signal.aborted) succeed(done);
        return;
      }
      authorizationUrl.current = begun.authorizationUrl;
      if (begun.authorizationUrl) openWindow(begun.authorizationUrl);
      for (let i = 0; i < POLL_ATTEMPTS; i += 1) {
        if (attempt.signal.aborted) return;
        const done = await rpc.connections
          .complete({ connectionId: begun.connectionId })
          .catch(() => undefined);
        if (attempt.signal.aborted) return;
        if (done?.status === "connected") return succeed(done);
        if (done?.status === "error") {
          return fail(done.error ?? t`${item.name} did not accept the sign-in.`);
        }
        await abortableDelay(2_000, attempt.signal);
      }
      if (!attempt.signal.aborted) fail(t`Sign-in did not finish in time.`);
    } catch (err) {
      if (!attempt.signal.aborted) fail(errorText(err, t`Could not connect`));
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void start();
  }, []);

  function close() {
    controller.current?.abort();
    stopWatching.current();
    popup.current?.close();
    // Drop the half-made row unless it failed (Failed rows stay so the page can offer Try again).
    if (!finished.current && !failed.current && connectionId.current) {
      void rpc.connections
        .revoke({ connectionId: connectionId.current })
        .catch(() => undefined)
        .finally(() => void refresh());
    } else {
      void refresh();
    }
    onClose();
  }

  async function saveAccess(botIds: string[]) {
    if (!row) return;
    setSaving(true);
    setAccessError(null);
    const all = botIds.length === data.bots.length;
    try {
      await rpc.connections.setAccess({
        connectionId: row.id,
        allAgents: all,
        botIds: all ? [] : botIds,
      });
      void refresh();
      setPhase({ kind: "done", agents: all ? "all" : botIds.length > 0 ? "some" : "none" });
    } catch (err) {
      setAccessError(errorText(err, t`Could not save agent access`));
    } finally {
      setSaving(false);
    }
  }

  const signInUrl = authorizationUrl.current;
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent
        className="max-w-[440px] sm:max-w-[440px]"
        aria-label={t`Connect ${item.name}`}
      >
        {phase.kind === "signin" ? (
          <SignInStep
            appName={item.name}
            logo={item.logo}
            state={phase.state}
            onOpenAgain={signInUrl ? () => void openWindow(signInUrl) : undefined}
            onTryAgain={() => {
              // A failed or cancelled attempt is over; discard its row and begin again.
              const old = connectionId.current;
              if (old && !finished.current)
                void rpc.connections.revoke({ connectionId: old }).catch(() => undefined);
              connectionId.current = null;
              void start();
            }}
            onClose={close}
          />
        ) : phase.kind === "agents" ? (
          <AgentStep
            appName={item.name}
            bots={data.bots}
            busy={saving}
            error={accessError}
            onContinue={(ids) => void saveAccess(ids)}
            onSkip={() => setPhase({ kind: "done", agents: "skipped" })}
          />
        ) : (
          <div>
            <div className="mb-3 flex justify-center">
              <AppLogo name={item.name} logo={item.logo} size="xl" />
            </div>
            <DialogTitle className="text-center">
              <Trans>{item.name} connected</Trans>
            </DialogTitle>
            <DialogDescription className="text-center">
              {t`${row?.displayName ?? item.name} is ready.`}
            </DialogDescription>
            <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
              {phase.agents === "skipped" ? null : (
                <li>
                  <span className="font-bold text-success">✓ </span>
                  {phase.agents === "all" ? (
                    <Trans>All agents can use {item.name}.</Trans>
                  ) : phase.agents === "some" ? (
                    <Trans>The agents you chose can use {item.name}.</Trans>
                  ) : (
                    <Trans>No agent uses {item.name} yet. Choose agents on its page.</Trans>
                  )}
                </li>
              )}
              <li>
                <span className="font-bold text-success">✓ </span>
                <Trans>{item.name} now appears under Connected.</Trans>
              </li>
            </ul>
            <div className="mt-4 flex justify-end">
              <Button onClick={close}>
                <Trans>Done</Trans>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
