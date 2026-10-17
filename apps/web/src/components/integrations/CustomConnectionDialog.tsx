import { Trans, useLingui } from "@lingui/react/macro";
import type {
  IntegrationCatalogResult,
  IntegrationCatalogSurface,
  McpServer,
} from "@rakazo/contracts";
import {
  isCartaAgentSpawnKey,
  isCartaEndpoint,
  MCP_OAUTH_CLIENT_ID_REQUIRED,
} from "@rakazo/contracts";
import { deriveMcpName, newClientId } from "@rakazo/core";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
  NativeSelect,
  NativeSelectOption,
} from "@rakazo/ui-web";
import { useRef, useState } from "react";
import { useCopyText } from "../../lib/copy-text";
import { beginMcpOauth, openMcpAuthorization, waitForMcpOauth } from "../../lib/mcp-connect";
import { rpc } from "../../lib/rpc";
import { watchWindowClosed } from "../../lib/sign-in-window";
import { errorText } from "../../lib/user-error";
import { AgentStep } from "./AgentStep";
import { AppLogo } from "./AppLogo";
import { type SignInState, SignInStep } from "./SignInStep";
import type { IntegrationsData } from "./useIntegrations";

type SourceKind = "treg" | "executor" | "api" | "graphql";
type View =
  | { kind: "form" }
  | { kind: "source"; source: SourceKind }
  | { kind: "stdio" }
  | { kind: "directory"; publicCatalog: boolean }
  | { kind: "signin"; state: SignInState }
  | { kind: "agents" }
  | { kind: "done"; hint: string | null };

function hostOf(value: string) {
  try {
    return new URL(value).host || value;
  } catch {
    return value;
  }
}

function isHttpUrl(value: string) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export function CustomConnectionDialog({
  data,
  existingServer,
  initialUrl = "",
  service,
  tokenSource = false,
  oauthClient = false,
  oauthScope,
  onClose,
}: {
  data: IntegrationsData;
  /** Sign in an existing server that needs a client ID; its connection fields stay locked. */
  existingServer?: McpServer;
  initialUrl?: string;
  /** The first-party service this dialog connects; it names the dialog instead of "custom connection". */
  service?: string;
  /** Open on the Treg token form (the one way to connect Treg) instead of the URL form. */
  tokenSource?: boolean;
  /** Show the OAuth client ID fields up front, for servers that refuse dynamic registration. */
  oauthClient?: boolean;
  oauthScope?: string;
  onClose: () => void;
}) {
  const { t } = useLingui();
  const [view, setView] = useState<View>(
    tokenSource ? { kind: "source", source: "treg" } : { kind: "form" },
  );
  const [url, setUrl] = useState(existingServer?.endpoint ?? initialUrl);
  const [authHeader, setAuthHeader] = useState("");
  const [headerValue, setHeaderValue] = useState("");
  const [transport, setTransport] = useState<"streamable_http" | "sse">("streamable_http");
  const [token, setToken] = useState("");
  const [needsClient, setNeedsClient] = useState(oauthClient || existingServer !== undefined);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [copied, copy] = useCopyText();
  const callbackUrl = `${window.location.origin}/mcp/oauth/callback`;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [server, setServer] = useState<McpServer | null>(existingServer ?? null);
  const [name, setName] = useState("");
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");
  const [sourceAuth, setSourceAuth] = useState<"none" | "bearer" | "header">("bearer");
  const [sourceHeader, setSourceHeader] = useState("x-api-key");
  const [directoryQuery, setDirectoryQuery] = useState("");
  const [directoryResults, setDirectoryResults] = useState<IntegrationCatalogResult[] | null>(null);
  const attempt = useRef<AbortController | null>(null);
  /** The server this dialog added, removed again when sign-in cannot start. */
  const createdHere = useRef<string | null>(null);
  const authUrl = useRef<string | null>(null);
  const stopWatching = useRef<() => void>(() => undefined);
  const popup = useRef<Window | null>(null);
  const { refresh } = data;

  const serverName = server?.name ?? (name.trim() || deriveMcpName(url.trim()));
  const carta = isCartaEndpoint(server?.endpoint ?? url.trim());

  function close() {
    attempt.current?.abort();
    stopWatching.current();
    popup.current?.close();
    void refresh();
    onClose();
  }

  async function guard(action: () => Promise<void>, fallback: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(errorText(err, fallback));
    } finally {
      setBusy(false);
    }
  }

  /** Sign in, wait for the callback page, then move on. Failure leaves the server row in place. */
  async function signIn(target: McpServer) {
    attempt.current?.abort();
    const controller = new AbortController();
    attempt.current = controller;
    stopWatching.current();
    setView({ kind: "signin", state: { kind: "waiting" } });
    const addedHint = t`${target.name} was added and shows Needs reconnect until you sign in.`;
    try {
      const started = await beginMcpOauth(target.id, {
        ...(clientId.trim()
          ? {
              oauthClient: {
                clientId: clientId.trim(),
                ...(oauthScope ? { scope: oauthScope } : {}),
                ...(clientSecret.trim() ? { clientSecret: clientSecret.trim() } : {}),
              },
            }
          : {}),
      });
      // Closing the dialog while the request was in flight must not open a window afterwards.
      if (controller.signal.aborted) return;
      if (started.status !== "authorization_required") {
        // No browser sign-in is needed (or one is already stored).
        setView(afterSignIn(target));
        return;
      }
      authUrl.current = started.authorizationUrl;
      const waiting = waitForMcpOauth({ signal: controller.signal });
      openWindow(started.authorizationUrl);
      const result = await waiting;
      if (result === "aborted") return;
      stopWatching.current();
      popup.current?.close();
      if (result === "connected") {
        void refresh();
        setView(afterSignIn(target));
      } else {
        void refresh();
        setView({
          kind: "signin",
          state: {
            kind: "failed",
            message:
              result === "timed_out"
                ? `${t`Sign-in did not finish in time.`} ${addedHint}`
                : `${t`Sign-in was denied or failed.`} ${addedHint}`,
          },
        });
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      void refresh();
      if (err instanceof Error && err.message.includes(MCP_OAUTH_CLIENT_ID_REQUIRED)) {
        setNeedsClient(true);
        setError(t`This server needs an OAuth client ID.`);
        setView({ kind: "form" });
        return;
      }
      // Sign-in could not even start, usually because the server is unreachable. A connection this
      // dialog just added would only sit in the list looking connected, so remove it and say why.
      if (createdHere.current === target.id) {
        createdHere.current = null;
        await rpc.mcp.servers.remove({ id: target.id }).catch(() => undefined);
        setServer(null);
        void refresh();
        setError(
          t`Could not reach ${hostOf(target.endpoint ?? url)}. Check the address and try again.`,
        );
        setView({ kind: "form" });
        return;
      }
      setView({
        kind: "signin",
        state: {
          kind: "failed",
          message: `${errorText(err, t`Could not start sign-in.`)} ${addedHint}`,
        },
      });
    }
  }

  /** Carta belongs to the Carta agent alone and the API gives it the new server, so there is no
   * agent to choose. */
  function afterSignIn(target: McpServer): View {
    return isCartaEndpoint(target.endpoint) ? { kind: "done", hint: null } : { kind: "agents" };
  }

  function openWindow(target: string) {
    const opened = openMcpAuthorization(target);
    if (!opened) {
      setView({ kind: "signin", state: { kind: "blocked" } });
      return;
    }
    popup.current = opened;
    setView({ kind: "signin", state: { kind: "waiting" } });
    stopWatching.current();
    // A hint only; the wait continues because a severed handle also reads as closed.
    stopWatching.current = watchWindowClosed(opened, () =>
      setView((current) =>
        current.kind === "signin" && current.state.kind === "waiting"
          ? { kind: "signin", state: { kind: "waiting", closed: true } }
          : current,
      ),
    );
  }

  async function createServer(): Promise<McpServer> {
    if (server) return server;
    const endpoint = url.trim();
    const existing = data.servers.find((entry) => entry.endpoint === endpoint);
    if (existing) return existing;
    const customHeader = authHeader.trim();
    const created = await rpc.mcp.servers.create({
      slug: `integration-${newClientId().slice(0, 8)}`,
      name: serverName,
      transport,
      endpoint,
      headers: headerValue.trim() ? { [customHeader || "Authorization"]: headerValue.trim() } : {},
      ...(token.trim() ? { secret: token.trim() } : {}),
      enabled: true,
    });
    createdHere.current = created.id;
    return created;
  }

  async function connectUrl() {
    if (!isHttpUrl(url.trim())) {
      setError(t`Enter the server URL, starting with https://.`);
      return;
    }
    await guard(async () => {
      const created = await createServer();
      setServer(created);
      void refresh();
      if (token.trim() || headerValue.trim()) setView({ kind: "agents" });
      else await signIn(created);
    }, t`Could not add the connection`);
  }

  async function addStdio() {
    if (!command.trim()) {
      setError(t`Enter the command to run.`);
      return;
    }
    await guard(async () => {
      const created = await rpc.mcp.servers.create({
        slug: `integration-${newClientId().slice(0, 8)}`,
        name: name.trim() || command.trim().split("/").pop() || t`Local server`,
        transport: "stdio",
        command: command.trim(),
        args: args.split(/\s+/).filter(Boolean),
        env: {},
        enabled: true,
      });
      setServer(created);
      void refresh();
      setView({ kind: "agents" });
    }, t`Could not add the connection`);
  }

  async function installSource(kind: SourceKind) {
    if (kind !== "treg" && !isHttpUrl(url.trim())) {
      setError(t`Enter the URL, starting with https://.`);
      return;
    }
    await guard(async () => {
      const auth = {
        type: sourceAuth,
        ...(sourceAuth === "header" ? { name: sourceHeader.trim() } : {}),
      };
      const label =
        name.trim() ||
        { treg: "Treg", executor: "Executor", graphql: "GraphQL", api: "Custom API" }[kind];
      await rpc.capabilities.install({
        kind: kind === "treg" || kind === "executor" ? "mcp" : kind,
        name: label,
        source: kind === "treg" ? "https://treg.to/mcp/" : url.trim(),
        credential: token.trim() || undefined,
        config:
          kind === "treg"
            ? { preset: "treg", auth: { type: "bearer" } }
            : kind === "api"
              ? { openApi: true, auth }
              : kind === "graphql"
                ? { auth }
                : { preset: "custom", auth: { type: "bearer" } },
      });
      setToken("");
      setName(label);
      await refresh();
      setView({ kind: "done", hint: null });
    }, t`Could not add the connection`);
  }

  function chooseSource(kind: SourceKind) {
    setError(null);
    setName("");
    setToken("");
    setSourceAuth(kind === "treg" || kind === "executor" ? "bearer" : "none");
    setView({ kind: "source", source: kind });
  }

  async function searchDirectory(publicCatalog: boolean) {
    await guard(async () => {
      const response = await rpc.capabilities.catalogSearch({
        query: directoryQuery,
        usePublicCatalog: publicCatalog,
      });
      setDirectoryResults(response.results);
    }, t`Could not search`);
  }

  function pickSurface(result: IntegrationCatalogResult, surface: IntegrationCatalogSurface) {
    if (!surface.source) return;
    setError(null);
    setName(result.name);
    setUrl(surface.source);
    if (surface.kind === "mcp") setView({ kind: "form" });
    else if (surface.kind === "openapi") {
      setSourceAuth(surface.auth?.type ?? "none");
      setSourceHeader(surface.auth?.headerName ?? "x-api-key");
      setView({ kind: "source", source: "api" });
    }
  }

  async function assign(botIds: string[]) {
    if (!server) return;
    await guard(async () => {
      for (const botId of botIds) {
        // replace() overwrites the bot's list, so merge with what it already has.
        const existing = (await rpc.mcp.assignments.list({ botId })).filter(
          (entry) => entry.serverId !== server.id,
        );
        await rpc.mcp.assignments.replace({
          botId,
          assignments: [
            ...existing.map(({ serverId, allowAllTools, allowedTools }) => ({
              serverId,
              allowAllTools,
              allowedTools,
            })),
            { serverId: server.id, allowAllTools: true, allowedTools: [] },
          ],
        });
      }
      void refresh();
      setView({ kind: "done", hint: null });
    }, t`Could not save bot access`);
  }

  const fields = (kind: SourceKind) => (
    <div className="mt-3 space-y-3">
      <Input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder={t`Display name`}
        aria-label={t`Display name`}
      />
      {kind !== "treg" ? (
        <Input
          className="font-mono"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder={
            kind === "graphql"
              ? "https://example.com/graphql"
              : kind === "executor"
                ? "https://executor.example/mcp"
                : "https://example.com/openapi.json"
          }
          aria-label={t`URL`}
        />
      ) : null}
      {kind === "api" || kind === "graphql" ? (
        <NativeSelect
          className="w-full"
          value={sourceAuth}
          aria-label={t`Authentication`}
          onChange={(event) => setSourceAuth(event.target.value as typeof sourceAuth)}
        >
          <NativeSelectOption value="none">{t`No authentication`}</NativeSelectOption>
          <NativeSelectOption value="bearer">{t`Bearer token`}</NativeSelectOption>
          <NativeSelectOption value="header">{t`API key header`}</NativeSelectOption>
        </NativeSelect>
      ) : null}
      {sourceAuth === "header" && (kind === "api" || kind === "graphql") ? (
        <Input
          value={sourceHeader}
          onChange={(event) => setSourceHeader(event.target.value)}
          placeholder={t`Header name`}
          aria-label={t`Header name`}
        />
      ) : null}
      {kind === "treg" || kind === "executor" || sourceAuth !== "none" ? (
        <Input
          type="password"
          autoComplete="new-password"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder={t`Token`}
          aria-label={t`Token`}
        />
      ) : null}
    </div>
  );

  const errorLine = error ? (
    <p role="alert" className="mt-3 text-sm text-destructive">
      {error}
    </p>
  ) : null;
  const back = tokenSource ? (
    <Button variant="outline" onClick={close}>
      <Trans>Cancel</Trans>
    </Button>
  ) : (
    <Button
      variant="outline"
      onClick={() => {
        setError(null);
        setView({ kind: "form" });
      }}
    >
      <Trans>Back</Trans>
    </Button>
  );

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent
        className="max-h-[calc(100%-2rem)] max-w-[min(440px,calc(100%-2rem))] overflow-y-auto sm:max-w-[min(440px,calc(100%-2rem))]"
        aria-label={service ? t`Connect ${service}` : t`Add a custom connection`}
      >
        {view.kind === "form" ? (
          <div>
            <DialogTitle>
              {service ? <Trans>Connect {service}</Trans> : <Trans>Add a custom connection</Trans>}
            </DialogTitle>
            <DialogDescription>
              {service ? (
                <Trans>Sign in with {service} in the window that opens.</Trans>
              ) : (
                <Trans>Paste the MCP server URL from the app's documentation.</Trans>
              )}
            </DialogDescription>
            {/* A first-party service has a known URL, so it shows no connection settings. */}
            {service ? null : (
              <div className="mt-3 text-xs text-muted-foreground">
                <Trans>Server URL</Trans>
                <Input
                  aria-label={t`Server URL`}
                  autoFocus
                  className="mt-1 font-mono text-sm"
                  value={url}
                  // The server already exists; only the client fields can still change.
                  readOnly={server !== null}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://example.com/mcp"
                  onKeyDown={(event) => event.key === "Enter" && void connectUrl()}
                />
              </div>
            )}
            {needsClient ? (
              <div className="mt-3 space-y-3 text-xs text-muted-foreground">
                <div>
                  <Trans>Client ID</Trans>
                  <Input
                    aria-label={t`Client ID`}
                    className="mt-1 font-mono text-sm"
                    value={clientId}
                    onChange={(event) => setClientId(event.target.value)}
                  />
                </div>
                <div>
                  <Trans>Client secret (optional)</Trans>
                  <Input
                    aria-label={t`Client secret (optional)`}
                    className="mt-1 font-mono text-sm"
                    type="password"
                    autoComplete="new-password"
                    value={clientSecret}
                    onChange={(event) => setClientSecret(event.target.value)}
                  />
                </div>
                <div>
                  <Trans>Callback URL</Trans>
                  <div className="mt-1 flex gap-2">
                    <Input
                      aria-label={t`Callback URL`}
                      className="font-mono text-sm"
                      readOnly
                      value={callbackUrl}
                    />
                    <Button variant="outline" onClick={() => copy(callbackUrl)}>
                      {copied ? <Trans>Copied</Trans> : <Trans>Copy</Trans>}
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
            {server === null && !service ? (
              <details className="mt-4 border-t border-border pt-3">
                <summary className="cursor-pointer text-sm text-muted-foreground">
                  <Trans>Advanced</Trans>
                </summary>
                <div className="mt-3 text-xs text-muted-foreground">
                  <Trans>Transport</Trans>
                  <NativeSelect
                    className="mt-1 w-full"
                    value={transport}
                    aria-label={t`Transport`}
                    onChange={(event) => setTransport(event.target.value as typeof transport)}
                  >
                    <NativeSelectOption value="streamable_http">{t`Streamable HTTP`}</NativeSelectOption>
                    <NativeSelectOption value="sse">SSE</NativeSelectOption>
                  </NativeSelect>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  <Trans>Auth header</Trans>
                  <Input
                    aria-label={t`Auth header`}
                    className="mt-1 font-mono text-sm"
                    value={authHeader}
                    onChange={(event) => setAuthHeader(event.target.value)}
                    placeholder="Authorization"
                  />
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  <Trans>Header value</Trans>
                  <Input
                    aria-label={t`Header value`}
                    className="mt-1 font-mono text-sm"
                    type="password"
                    autoComplete="new-password"
                    value={headerValue}
                    onChange={(event) => setHeaderValue(event.target.value)}
                    placeholder={t`Optional`}
                  />
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  <Trans>Token</Trans>
                  <Input
                    aria-label={t`Token`}
                    className="mt-1 font-mono text-sm"
                    type="password"
                    autoComplete="new-password"
                    value={token}
                    onChange={(event) => setToken(event.target.value)}
                    placeholder={t`Only if the server does not use sign-in`}
                  />
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  <Trans>Other connection types</Trans>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {(
                      [
                        ["api", "OpenAPI"],
                        ["graphql", "GraphQL"],
                        ["executor", "Executor"],
                      ] as const
                    ).map(([kind, label]) => (
                      <Button
                        key={kind}
                        variant="outline"
                        size="xs"
                        onClick={() => chooseSource(kind)}
                      >
                        {label}
                      </Button>
                    ))}
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => {
                        setError(null);
                        setName("");
                        setView({ kind: "stdio" });
                      }}
                    >
                      <Trans>Local command</Trans>
                    </Button>
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => setView({ kind: "directory", publicCatalog: true })}
                    >
                      <Trans>Search directory</Trans>
                    </Button>
                    {data.feedEnabled ? (
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => setView({ kind: "directory", publicCatalog: false })}
                      >
                        <Trans>Search by domain</Trans>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </details>
            ) : null}
            {errorLine}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={close}>
                <Trans>Cancel</Trans>
              </Button>
              <Button
                disabled={busy || !url.trim() || (needsClient && !clientId.trim())}
                onClick={() => void connectUrl()}
              >
                {busy ? (
                  <Trans>Connecting…</Trans>
                ) : service ? (
                  <Trans>Sign in with {service}</Trans>
                ) : (
                  <Trans>Connect</Trans>
                )}
              </Button>
            </div>
          </div>
        ) : view.kind === "source" ? (
          <div>
            <DialogTitle>
              {view.source === "treg" ? (
                <Trans>Connect Treg</Trans>
              ) : view.source === "executor" ? (
                <Trans>Connect Executor</Trans>
              ) : view.source === "graphql" ? (
                <Trans>Add a GraphQL endpoint</Trans>
              ) : (
                <Trans>Import an OpenAPI description</Trans>
              )}
            </DialogTitle>
            <DialogDescription>
              <Trans>Credentials are encrypted and never sent to the model.</Trans>
            </DialogDescription>
            {fields(view.source)}
            {errorLine}
            <div className="mt-4 flex justify-end gap-2">
              {back}
              <Button disabled={busy} onClick={() => void installSource(view.source)}>
                {busy ? <Trans>Verifying…</Trans> : <Trans>Verify and add</Trans>}
              </Button>
            </div>
          </div>
        ) : view.kind === "stdio" ? (
          <div>
            <DialogTitle>
              <Trans>Add a local command</Trans>
            </DialogTitle>
            <div className="mt-3 space-y-3">
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t`Display name`}
                aria-label={t`Display name`}
              />
              <Input
                className="font-mono"
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                placeholder="/opt/mcp-server"
                aria-label={t`Command`}
              />
              <Input
                className="font-mono"
                value={args}
                onChange={(event) => setArgs(event.target.value)}
                placeholder="--stdio"
                aria-label={t`Arguments`}
              />
            </div>
            {errorLine}
            <div className="mt-4 flex justify-end gap-2">
              {back}
              <Button disabled={busy} onClick={() => void addStdio()}>
                <Trans>Add</Trans>
              </Button>
            </div>
          </div>
        ) : view.kind === "directory" ? (
          <div>
            <DialogTitle>
              {view.publicCatalog ? (
                <Trans>Search the directory</Trans>
              ) : (
                <Trans>Search by domain</Trans>
              )}
            </DialogTitle>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void searchDirectory(view.publicCatalog);
              }}
            >
              <Input
                autoFocus
                value={directoryQuery}
                onChange={(event) => setDirectoryQuery(event.target.value)}
                placeholder={view.publicCatalog ? t`Search apps` : "github.com"}
                aria-label={t`Search`}
              />
              <Button type="submit" disabled={busy || !directoryQuery.trim()}>
                <Trans>Search</Trans>
              </Button>
            </form>
            {errorLine}
            {directoryResults?.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                <Trans>No results</Trans>
              </p>
            ) : null}
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
              {directoryResults?.map((result) => (
                <div
                  key={`${result.domain}:${result.name}`}
                  className="rounded-xl border border-border p-3"
                >
                  <div className="text-sm font-medium">{result.name}</div>
                  <div className="text-xs text-muted-foreground">{result.domain}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {result.surfaces.map((surface) => {
                      const usable =
                        Boolean(surface.source) &&
                        (surface.kind === "mcp" || surface.kind === "openapi");
                      return (
                        <Button
                          key={`${result.domain}:${surface.slug}`}
                          variant="outline"
                          size="xs"
                          disabled={!usable}
                          title={usable ? undefined : t`Manual setup required`}
                          onClick={() => pickSurface(result, surface)}
                        >
                          {surface.kind.toUpperCase()}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">{back}</div>
          </div>
        ) : view.kind === "signin" ? (
          <SignInStep
            appName={serverName}
            totalSteps={carta ? 2 : 3}
            state={view.state}
            onOpenAgain={authUrl.current ? () => openWindow(authUrl.current as string) : undefined}
            onTryAgain={() => (server ? void signIn(server) : setView({ kind: "form" }))}
            onClose={close}
          />
        ) : view.kind === "agents" ? (
          <AgentStep
            appName={serverName}
            bots={
              isCartaEndpoint(server?.endpoint)
                ? data.bots.filter((bot) => isCartaAgentSpawnKey(bot.spawnKey))
                : data.bots
            }
            busy={busy}
            error={error}
            onContinue={(ids) => void assign(ids)}
            onSkip={() => setView({ kind: "done", hint: null })}
          />
        ) : (
          <div className="text-center">
            <div className="mb-3 flex justify-center">
              <AppLogo name={serverName} size="xl" />
            </div>
            <DialogTitle className="text-center">
              <Trans>{serverName} connected</Trans>
            </DialogTitle>
            <DialogDescription className="text-center">
              {carta ? (
                <Trans>The Carta agent can now read your cap table.</Trans>
              ) : (
                <Trans>It now appears under Connected.</Trans>
              )}
            </DialogDescription>
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
