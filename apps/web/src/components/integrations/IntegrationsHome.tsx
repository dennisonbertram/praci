import { Trans, useLingui } from "@lingui/react/macro";
import {
  type CapabilityInstall,
  type ConnectionCatalogItem,
  isCryptoEndpoint,
  type McpServer,
} from "@rakazo/contracts";
import { CONNECTION_CATALOG_PAGE_SIZE } from "@rakazo/core";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Input,
} from "@rakazo/ui-web";
import { Search } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  appPath,
  CATEGORY_IDS,
  type CategoryFilter,
  type ConnectedApp,
  FINANCE_PROVIDERS,
  FIRST_PARTY_MCP,
  filterCatalog,
  groupConnections,
  isSameMcpEndpoint,
  mcpStatus,
  popularApps,
} from "../../lib/integrations";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";
import { AppLogo } from "./AppLogo";
import { ConnectAppDialog } from "./ConnectAppDialog";
import { CustomConnectionDialog } from "./CustomConnectionDialog";
import {
  connectedFinanceKeys,
  FINANCE_TILE_COUNT,
  FinanceSection,
  useFinanceStatus,
} from "./FinanceSection";
import { AgentStack, IntegrationTile, StatusBadge } from "./parts";
import { agentsFor, type IntegrationsData } from "./useIntegrations";
import { useMcpReconnect } from "./useMcpReconnect";

function hostOf(value: string | null) {
  if (!value) return "";
  try {
    return new URL(value).host;
  } catch {
    return value;
  }
}

function Card({ children }: { children: ReactNode }) {
  return (
    <IntegrationTile className="relative  transition-colors hover:bg-muted/40">
      {children}
    </IntegrationTile>
  );
}

function CardHead({
  name,
  logo,
  sub,
  to,
}: {
  name: string;
  logo?: string | null;
  sub?: string;
  to?: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <AppLogo name={name} logo={logo} />
      <div className="min-w-0">
        {to ? (
          <Link to={to} className="block truncate font-semibold after:absolute after:inset-0">
            {name}
          </Link>
        ) : (
          <div className="truncate font-semibold">{name}</div>
        )}
        {sub ? <div className="truncate text-xs text-muted-foreground">{sub}</div> : null}
      </div>
    </div>
  );
}

/** Opens the app page an integration feeds (Inbox, Cap table), like Mercury's "Open Finance". */
function OpenPageLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="relative z-10 ms-auto inline-flex h-7 items-center rounded-lg border border-border px-2.5 text-[0.8rem] font-medium hover:bg-muted"
    >
      {children}
    </Link>
  );
}

function UsedBy({ bots }: { bots: ReturnType<typeof agentsFor> }) {
  if (bots.length === 0) return null;
  return (
    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
      <Trans>Used by</Trans>
      <AgentStack bots={bots} />
    </div>
  );
}

function McpCard({
  server,
  data,
  descriptions,
}: {
  server: McpServer;
  data: IntegrationsData;
  /** What each first-party server does, shown instead of its raw address. */
  descriptions: Partial<Record<string, string>>;
}) {
  const { t } = useLingui();
  const reconnect = useMcpReconnect(server.id, () => void data.refresh());
  const status = reconnect.busy ? "connecting" : mcpStatus(server);
  const assigned = data.mcpAssignments
    .filter((entry) => entry.serverId === server.id)
    .map((entry) => entry.botId);
  const known =
    "endpoint" in server
      ? FIRST_PARTY_MCP.find((entry) => isSameMcpEndpoint(server.endpoint, entry.endpoint))
      : undefined;
  // The app page a known server feeds, opened from its card like Mercury's "Open Finance".
  const page =
    known?.id === "carta" ? { to: "/app/cap-table", label: t`Open Cap table` } : undefined;
  return (
    <Card>
      <CardHead
        name={server.name}
        logo={known?.logo}
        sub={
          (known && descriptions[known.id]) ||
          hostOf(server.endpoint) ||
          server.command ||
          undefined
        }
        to={`/app/integrations/mcp/${server.id}`}
      />
      <div className="flex items-center gap-2">
        <StatusBadge status={status} />
        {page && status === "connected" ? (
          <OpenPageLink to={page.to}>{page.label}</OpenPageLink>
        ) : null}
        {status === "reconnect" ? (
          <Button
            size="sm"
            className="relative z-10 ms-auto"
            disabled={reconnect.busy}
            onClick={() => void reconnect.run()}
          >
            <Trans>Reconnect</Trans>
          </Button>
        ) : null}
      </div>
      {reconnect.error ? (
        <p role="alert" className="text-xs text-destructive">
          {reconnect.error}
        </p>
      ) : null}
      <UsedBy bots={data.bots.filter((bot) => assigned.includes(bot.id))} />
      {reconnect.needsClient ? (
        <CustomConnectionDialog data={data} existingServer={server} onClose={reconnect.dismiss} />
      ) : null}
    </Card>
  );
}

function AppCard({
  app,
  data,
  onRetry,
}: {
  app: ConnectedApp;
  data: IntegrationsData;
  onRetry: (app: ConnectedApp) => void;
}) {
  const accounts = app.rows
    .filter((row) => row.status === "connected")
    .map((row) => row.displayName)
    .join(", ");
  const working = app.rows.find((row) => row.status === "connected");
  return (
    <Card>
      <CardHead
        name={app.name}
        logo={app.logo}
        sub={accounts || app.rows[0]?.displayName}
        to={appPath({ connectorId: app.connectorId, slug: app.provider })}
      />
      <div className="flex items-center gap-2">
        <StatusBadge status={app.status} />
        {app.status === "connected" && app.provider.toUpperCase() === "GMAIL" ? (
          <OpenPageLink to="/app/inbox">
            <Trans>Open Inbox</Trans>
          </OpenPageLink>
        ) : null}
        {app.status === "failed" ? (
          <Button
            size="sm"
            variant="outline"
            className="relative z-10 ms-auto"
            onClick={() => onRetry(app)}
          >
            <Trans>Try again</Trans>
          </Button>
        ) : null}
      </div>
      {app.status === "failed" ? (
        <p className="text-xs text-muted-foreground">
          {app.error ?? <Trans>Sign-in did not finish.</Trans>}
        </p>
      ) : app.status === "connecting" ? (
        <p className="text-xs text-muted-foreground">
          <Trans>Waiting for you to finish signing in.</Trans>
        </p>
      ) : (
        <UsedBy bots={agentsFor(data.bots, working ? data.access[working.id] : undefined)} />
      )}
    </Card>
  );
}

function SourceCard({
  source,
  onRemove,
}: {
  source: CapabilityInstall;
  onRemove: (source: CapabilityInstall) => void;
}) {
  const { t } = useLingui();
  return (
    <Card>
      <CardHead
        name={source.name}
        sub={`${source.kind.toUpperCase()} · ${hostOf(source.source)}`}
      />
      <div className="flex items-center gap-2">
        <StatusBadge status="connected" />
        <Button
          size="sm"
          variant="outline"
          className="ms-auto"
          aria-label={t`Remove ${source.name}`}
          onClick={() => onRemove(source)}
        >
          <Trans>Remove</Trans>
        </Button>
      </div>
    </Card>
  );
}

function AppTile({
  name,
  logo,
  description,
  onConnect,
}: {
  name: string;
  logo?: string | null;
  description?: string | null;
  onConnect: () => void;
}) {
  const { t } = useLingui();
  return (
    <IntegrationTile>
      <CardHead name={name} logo={logo} sub={description ?? undefined} />
      <div className="mt-auto flex">
        <Button
          size="sm"
          variant="outline"
          className="ms-auto"
          aria-label={t`Connect ${name}`}
          onClick={onConnect}
        >
          <Trans>Connect</Trans>
        </Button>
      </div>
    </IntegrationTile>
  );
}

export function IntegrationsHome({
  data,
  activeBotId,
}: {
  data: IntegrationsData;
  activeBotId?: string;
}) {
  const { t } = useLingui();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [category, setCategory] = useState<CategoryFilter>(
    params.get("category") === "finance" ? "finance" : "all",
  );
  const financeRef = useRef<HTMLDivElement>(null);
  const jumpToFinance = useRef(params.get("category") === "finance");
  const [visible, setVisible] = useState(CONNECTION_CATALOG_PAGE_SIZE);
  const [connecting, setConnecting] = useState<ConnectionCatalogItem | null>(null);
  const [custom, setCustom] = useState<{
    url: string;
    /** The first-party service this dialog connects; titles the dialog. */
    service?: string;
    oauthClient?: boolean;
    scope?: string;
    token?: boolean;
  } | null>(null);
  const [removing, setRemoving] = useState<CapabilityInstall | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const labels: Record<CategoryFilter, string> = {
    all: t`All`,
    email_calendar: t`Email & calendar`,
    chat: t`Chat`,
    docs_files: t`Docs & files`,
    finance: t`Finance`,
    developer: t`Developer`,
    sales_crm: t`Sales & CRM`,
  };

  const apps = useMemo(
    () => groupConnections(data.connections, data.catalog),
    [data.connections, data.catalog],
  );
  const results = useMemo(
    () => filterCatalog(popularApps(data.catalog, data.connections), { query, category }),
    [data.catalog, data.connections, query, category],
  );
  const firstPartySections = { social: t`Social`, equity: t`Equity`, tools: t`Tools` };
  const firstPartyDescription = {
    zernio: t`Post and schedule to social accounts`,
    carta: t`Cap table, equity and investors`,
    x: t`Read posts, DMs and bookmarks`,
    treg: t`Live data, enrichment and generation tools`,
  };
  const financeStatus = useFinanceStatus();
  const connectedKeys = connectedFinanceKeys(data.financeSources, financeStatus);
  const financeNames = FINANCE_PROVIDERS.map((entry) => entry.name.toLowerCase());
  const showFinance =
    (category === "all" || category === "finance") &&
    financeNames.some((name) => name.includes(query.trim().toLowerCase())) &&
    connectedKeys.size < FINANCE_TILE_COUNT;
  const firstPartyMcp = FIRST_PARTY_MCP.filter(
    (entry) =>
      (category === "all" || category === entry.category) &&
      entry.name.toLowerCase().includes(query.trim().toLowerCase()) &&
      !data.servers.some(
        (server) => "endpoint" in server && isSameMcpEndpoint(server.endpoint, entry.endpoint),
      ) &&
      !data.sources.some((source) => isSameMcpEndpoint(source.source, entry.endpoint)),
  );
  const otherMatches = showFinance || firstPartyMcp.length > 0;
  const financeServerIds = data.financeSources.flatMap((source) =>
    source.serverId ? [source.serverId] : [],
  );
  // A Blockscout key is stored as its MCP server. Once the key is connected, the finance tile
  // under Connected replaces that server's own tile.
  const isCrypto = (server: McpServer) => "endpoint" in server && isCryptoEndpoint(server.endpoint);
  const cryptoServer = connectedKeys.has("crypto") ? data.servers.find(isCrypto) : undefined;
  const servers = data.servers.filter(
    (server) => !financeServerIds.includes(server.id) && server !== cryptoServer,
  );
  const filtering = Boolean(query.trim()) || category !== "all";
  const hasConnected = apps.length + servers.length + data.sources.length + connectedKeys.size > 0;
  // Native Google items fill the catalog without a managed provider, so ask the setup state. Only
  // the deployment owner is told which providers are configured; a member (whose list is empty)
  // can tell from the catalog itself, and a failed call falls back to whether it has anything.
  const managedConfigured = !data.setup
    ? data.catalog.length > 0
    : data.setup.canConfigure
      ? data.setup.providers.some(
          (provider) =>
            provider.configured && (provider.id === "composio" || provider.id === "pipedream"),
        )
      : data.catalog.some((item) => item.connectorId !== "google");
  const notSetUp = data.loaded && !managedConfigured && !data.catalogFailed;

  // /app/integrations?category=finance preselects the chip; scroll once the page has content.
  useEffect(() => {
    if (!jumpToFinance.current || !data.loaded) return;
    jumpToFinance.current = false;
    financeRef.current?.scrollIntoView?.({ block: "start" });
  }, [data.loaded]);

  function retry(app: ConnectedApp) {
    const item = data.catalog.find((entry) => `${entry.connectorId}:${entry.slug}` === app.key);
    setConnecting(
      item ?? {
        connectorId: app.connectorId,
        slug: app.provider,
        name: app.name,
        logo: app.logo,
        connected: false,
        noAuth: false,
        description: null,
        category: "other",
      },
    );
  }

  async function removeSource(source: CapabilityInstall) {
    setRemoveError(null);
    try {
      await rpc.capabilities.remove({ id: source.id });
      setRemoving(null);
      await data.refresh();
    } catch (err) {
      setRemoveError(errorText(err, t`Could not remove connector`));
    }
  }

  return (
    <div className="rk-scroll h-full overflow-y-auto px-4 pb-6 pt-2 md:px-7 md:pt-5">
      <div className="max-w-[1040px]">
        <h1 className="text-lg font-semibold">
          <Trans>Integrations</Trans>
        </h1>
        <p className="mb-5 max-w-[640px] text-muted-foreground">
          <Trans>
            Connect the apps you use so your bots can read and act in them. You choose which bots
            get access to each one.
          </Trans>
        </p>
        {data.error || data.catalogFailed ? (
          <p role="alert" className="mb-4 text-sm text-destructive">
            {data.error ?? <Trans>Could not load the app list. Reload to try again.</Trans>}
          </p>
        ) : null}

        {hasConnected ? (
          <>
            <SectionTitle>
              <Trans>Connected</Trans>
            </SectionTitle>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
              {apps.map((app) => (
                <AppCard key={app.key} app={app} data={data} onRetry={retry} />
              ))}
              {servers.map((server) => (
                <McpCard
                  key={server.id}
                  server={server}
                  data={data}
                  descriptions={firstPartyDescription}
                />
              ))}
              {data.sources.map((source) => (
                <SourceCard key={source.id} source={source} onRemove={setRemoving} />
              ))}
              <FinanceSection
                mode="connected"
                sources={data.financeSources}
                status={financeStatus}
                onChanged={() => void data.refresh()}
                cryptoExtra={
                  cryptoServer ? (
                    <div className="flex items-center gap-2">
                      <UsedBy
                        bots={data.bots.filter((bot) =>
                          data.mcpAssignments.some(
                            (entry) => entry.serverId === cryptoServer.id && entry.botId === bot.id,
                          ),
                        )}
                      />
                      <Link
                        to={`/app/integrations/mcp/${cryptoServer.id}`}
                        aria-label={t`Manage ${cryptoServer.name}`}
                        className="ms-auto text-[11px] text-muted-foreground underline hover:text-foreground"
                      >
                        <Trans>Manage</Trans>
                      </Link>
                    </div>
                  ) : null
                }
              />
            </div>
          </>
        ) : null}

        {notSetUp ? (
          <div
            className="mt-6 rounded-xl border border-border bg-card p-5"
            data-testid="catalog-not-set-up"
          >
            {data.setup?.canConfigure ? (
              <>
                <b className="mb-1 block">
                  <Trans>
                    Connect a Composio or Pipedream account to add apps like Slack, Notion and
                    GitHub.
                  </Trans>
                </b>
                <div className="mt-3">
                  <Link
                    to="/app/integrations/setup?next=/app/integrations"
                    className="inline-flex h-8 items-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground"
                  >
                    <Trans>Set up app catalog</Trans>
                  </Link>
                </div>
              </>
            ) : (
              <>
                <b className="mb-1 block">
                  <Trans>App connections aren't set up on this server yet.</Trans>
                </b>
                <span className="text-muted-foreground">
                  <Trans>Custom connections still work.</Trans>
                </span>
                <div className="mt-1.5 text-muted-foreground">
                  <Trans>Ask the server owner to set up the app catalog.</Trans>
                </div>
              </>
            )}
          </div>
        ) : null}
        {notSetUp && results.length > 0 ? (
          // Native Google apps need no managed provider, so they stay connectable here.
          <div
            data-testid="app-grid"
            className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]"
          >
            {results.map((item) => (
              <AppTile
                key={`${item.connectorId}:${item.slug}`}
                name={item.name}
                logo={item.logo}
                description={item.description}
                onConnect={() => setConnecting(item)}
              />
            ))}
          </div>
        ) : null}
        {notSetUp ? null : (
          <>
            <SectionTitle>
              <Trans>Find an app</Trans>
            </SectionTitle>
            <div className="relative mb-3 max-w-[420px]">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute start-2.5 top-2.5 size-4 text-muted-foreground"
              />
              <Input
                type="search"
                className="h-9 ps-8"
                value={query}
                placeholder={t`Search apps`}
                aria-label={t`Search apps`}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setVisible(CONNECTION_CATALOG_PAGE_SIZE);
                }}
              />
            </div>
            <fieldset
              aria-label={t`Category`}
              className="m-0 mb-1.5 flex min-w-0 flex-wrap gap-1.5 border-0 p-0"
            >
              {CATEGORY_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={category === id}
                  onClick={() => {
                    setCategory(id);
                    setVisible(CONNECTION_CATALOG_PAGE_SIZE);
                  }}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    category === id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {labels[id]}
                </button>
              ))}
            </fieldset>
            {results.length === 0 && otherMatches ? null : (
              <>
                <SectionTitle>
                  {filtering ? <Trans>Apps</Trans> : <Trans>Popular</Trans>}
                </SectionTitle>
                {results.length === 0 && !otherMatches ? (
                  <p className="py-2 text-muted-foreground" data-testid="no-apps">
                    <Trans>No apps match.</Trans>
                  </p>
                ) : (
                  <div
                    data-testid="app-grid"
                    className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]"
                  >
                    {results.slice(0, visible).map((item) => (
                      <AppTile
                        key={`${item.connectorId}:${item.slug}`}
                        name={item.name}
                        logo={item.logo}
                        description={item.description}
                        onConnect={() => setConnecting(item)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
            {results.length > visible ? (
              <div className="mt-4 flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setVisible((n) => n + CONNECTION_CATALOG_PAGE_SIZE)}
                >
                  <Trans>Show more</Trans>
                </Button>
              </div>
            ) : null}
          </>
        )}

        {showFinance ? (
          <div ref={financeRef} className="scroll-mt-4">
            <SectionTitle>
              <Trans>Finance</Trans>
            </SectionTitle>
            <FinanceSection
              mode="available"
              sources={data.financeSources}
              status={financeStatus}
              onChanged={() => void data.refresh()}
            />
          </div>
        ) : null}

        {(["social", "equity", "tools"] as const).map((section) => {
          const entries = firstPartyMcp.filter((entry) => entry.section === section);
          return entries.length > 0 ? (
            <div key={section}>
              <SectionTitle>{firstPartySections[section]}</SectionTitle>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
                {entries.map((entry) => (
                  <AppTile
                    key={entry.id}
                    name={entry.name}
                    logo={entry.logo}
                    description={firstPartyDescription[entry.id]}
                    onConnect={() =>
                      setCustom({
                        url: entry.endpoint,
                        service: entry.name,
                        // Treg takes an API token, not a sign-in.
                        ...(entry.id === "treg" ? { token: true } : {}),
                        ...("oauthClient" in entry
                          ? { oauthClient: true, scope: entry.scope }
                          : {}),
                      })
                    }
                  />
                ))}
              </div>
            </div>
          ) : null;
        })}

        <SectionTitle>
          <Trans>Anything else</Trans>
        </SectionTitle>
        <div className="flex flex-col items-stretch gap-3 rounded-xl border border-dashed border-border bg-card p-3.5 sm:flex-row sm:items-center">
          <AppLogo name="+" />
          <div className="min-w-0 flex-1">
            <b className="block">
              <Trans>Add a custom connection</Trans>
            </b>
            <span className="text-muted-foreground">
              <Trans>Connect any app that offers an MCP server URL.</Trans>
            </span>
          </div>
          <Button variant="outline" onClick={() => setCustom({ url: "" })}>
            <Trans>Add custom connection</Trans>
          </Button>
        </div>
      </div>

      {connecting ? (
        <ConnectAppDialog
          item={connecting}
          data={data}
          activeBotId={activeBotId}
          onClose={() => setConnecting(null)}
        />
      ) : null}
      {custom ? (
        <CustomConnectionDialog
          data={data}
          initialUrl={custom.url}
          service={custom.service}
          tokenSource={custom.token}
          oauthClient={custom.oauthClient}
          oauthScope={custom.scope}
          onClose={() => setCustom(null)}
        />
      ) : null}
      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <Trans>Remove {removing?.name}?</Trans>
            </AlertDialogTitle>
            <AlertDialogDescription>
              <Trans>Bots lose access to its tools.</Trans>
            </AlertDialogDescription>
          </AlertDialogHeader>
          {removeError ? (
            <p role="alert" className="text-sm text-destructive">
              {removeError}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Trans>Cancel</Trans>
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(event) => {
                event.preventDefault();
                if (removing) void removeSource(removing);
              }}
            >
              <Trans>Remove</Trans>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-2.5 mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h2>
  );
}
