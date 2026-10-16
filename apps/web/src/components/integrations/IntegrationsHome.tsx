import { Trans, useLingui } from "@lingui/react/macro";
import type { CapabilityInstall, ConnectionCatalogItem, McpServer } from "@rakazo/contracts";
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
  CATEGORY_IDS,
  type CategoryFilter,
  type ConnectedApp,
  FINANCE_PROVIDERS,
  filterCatalog,
  groupConnections,
  mcpStatus,
  popularApps,
} from "../../lib/integrations";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";
import { AppLogo } from "./AppLogo";
import { ConnectAppDialog } from "./ConnectAppDialog";
import { CustomConnectionDialog } from "./CustomConnectionDialog";
import { FinanceSection } from "./FinanceSection";
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

function UsedBy({ bots }: { bots: ReturnType<typeof agentsFor> }) {
  if (bots.length === 0) return null;
  return (
    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
      <Trans>Used by</Trans>
      <AgentStack bots={bots} />
    </div>
  );
}

function McpCard({ server, data }: { server: McpServer; data: IntegrationsData }) {
  const reconnect = useMcpReconnect(server.id, () => void data.refresh());
  const status = reconnect.busy ? "connecting" : mcpStatus(server);
  const assigned = data.mcpAssignments
    .filter((entry) => entry.serverId === server.id)
    .map((entry) => entry.botId);
  return (
    <Card>
      <CardHead
        name={server.name}
        sub={hostOf(server.endpoint) || server.command || undefined}
        to={`/app/integrations/mcp/${server.id}`}
      />
      <div className="flex items-center gap-2">
        <StatusBadge status={status} />
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
        to={`/app/integrations/app/${encodeURIComponent(app.connectorId)}/${encodeURIComponent(app.provider)}`}
      />
      <div className="flex items-center gap-2">
        <StatusBadge status={app.status} />
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
  const [custom, setCustom] = useState<{ url: string } | null>(null);
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
  const financeNames = FINANCE_PROVIDERS.map((entry) => entry.name.toLowerCase());
  const showFinance =
    (category === "all" || category === "finance") &&
    financeNames.some((name) => name.includes(query.trim().toLowerCase()));
  const financeServerIds = data.financeSources.flatMap((source) =>
    source.serverId ? [source.serverId] : [],
  );
  const servers = data.servers.filter((server) => !financeServerIds.includes(server.id));
  const filtering = Boolean(query.trim()) || category !== "all";
  const hasConnected = apps.length + servers.length + data.sources.length > 0;
  // Native Google items fill the catalog without a managed provider, so ask the setup state.
  // Without it (the call failed), fall back to whether the catalog has anything.
  const managedConfigured = data.setup
    ? data.setup.providers.some(
        (provider) =>
          provider.configured && (provider.id === "composio" || provider.id === "pipedream"),
      )
    : data.catalog.length > 0;
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
    <div className="rk-scroll h-full overflow-y-auto px-4 py-6 md:px-9 md:py-7">
      <div className="mx-auto max-w-[1040px]">
        <h1 className="text-xl font-semibold">
          <Trans>Integrations</Trans>
        </h1>
        <p className="mb-5 max-w-[640px] text-muted-foreground">
          <Trans>
            Connect the apps you use so your agents can read and act in them. You choose which
            agents get access to each one.
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
                <McpCard key={server.id} server={server} data={data} />
              ))}
              {data.sources.map((source) => (
                <SourceCard key={source.id} source={source} onRemove={setRemoving} />
              ))}
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
                    to="/integrations/setup"
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
        ) : (
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
            {results.length === 0 && showFinance ? null : (
              <>
                <SectionTitle>
                  {filtering ? <Trans>Apps</Trans> : <Trans>Popular</Trans>}
                </SectionTitle>
                {results.length === 0 && !showFinance ? (
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
            <FinanceSection sources={data.financeSources} onChanged={() => void data.refresh()} />
          </div>
        ) : null}

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
              <Trans>Agents lose access to its tools.</Trans>
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
