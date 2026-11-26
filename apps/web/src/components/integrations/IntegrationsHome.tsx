import { Trans, useLingui } from "@lingui/react/macro";
import type {
  CapabilityInstall,
  Connection,
  ConnectionCatalogItem,
  DevinSessionsOutput,
  McpServer,
} from "@rakazo/contracts";
import {
  isBrexCardsEndpoint,
  isCryptoEndpoint,
  isDevinEndpoint,
  isGranolaEndpoint,
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
  DropdownMenuItem,
  Input,
  Skeleton,
} from "@rakazo/ui-web";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { hexBridge } from "../../lib/hex/useHexSync";
import type { ConnectedApp, EntryInfo } from "../../lib/integrations";
import {
  accountLabels,
  accountLines,
  appEntry,
  appPath,
  EXCHANGES,
  FINANCE_PROVIDERS,
  FIRST_PARTY_MCP,
  filterCatalog,
  filterEntries,
  groupConnections,
  isSameMcpEndpoint,
  mcpStatus,
  popularApps,
  sortEntries,
} from "../../lib/integrations";
import { useListParams } from "../../lib/list-params";
import { appReturnPath } from "../../lib/return-to";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";
import { PickFilter, SearchField, SortControl } from "../ListControls";
import { PAGE_GUTTER_X, PageHeader } from "../PageHeader";
import { AppLogo } from "./AppLogo";
import { BrexCardsConnectDialog } from "./BrexCardsConnectDialog";
import { ConnectAppDialog } from "./ConnectAppDialog";
import { CustomConnectionDialog } from "./CustomConnectionDialog";
import { DevinConnectDialog } from "./DevinConnectDialog";
import {
  connectedFinanceKeys,
  erroredFinanceKeys,
  FINANCE_TILE_COUNT,
  FinanceSection,
  lapsedFinanceKeys,
  useFinanceStatus,
} from "./FinanceSection";
import { GranolaStatusLine, granolaLine } from "./GranolaMeetingsCard";
import { HexCard } from "./HexCard";
import { IMessageSection } from "./IMessageSection";
import {
  AgentStack,
  CardHead,
  IntegrationTile,
  OPEN_LINK,
  SectionTitle,
  StatusBadge,
  TileMenu,
} from "./parts";
import type { IntegrationsData } from "./useIntegrations";
import { agentsFor } from "./useIntegrations";
import { useMcpReconnect } from "./useMcpReconnect";

const PHONE_POPULAR = 3;

/** The filter chips: All, then the section headings that hold tiles of their own. */
const CHIPS = ["all", "finance", "social", "equity", "tools"] as const;
type Chip = (typeof CHIPS)[number];
const SORT_FIELDS = ["default", "name", "status", "connected"] as const;
const GRANOLA_PATH = "/app/integrations/granola";
const OMI_PATH = "/app/integrations/omi";

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
    <IntegrationTile className="relative transition-colors hover:bg-muted/40 max-sm:flex-row max-sm:flex-wrap max-sm:items-center">
      {children}
    </IntegrationTile>
  );
}

/** Opens the app page an integration feeds (Inbox, Investors), like Mercury's "Open Finance". */
function OpenPageLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <>
      <Link to={to} className={OPEN_LINK}>
        {children}
      </Link>
    </>
  );
}

function UsedBy({ bots }: { bots: ReturnType<typeof agentsFor> }) {
  if (bots.length === 0) return null;
  return (
    <div className="flex items-center gap-2 text-[11px] text-muted-foreground max-sm:hidden">
      <Trans>Used by</Trans>
      <AgentStack bots={bots} />
    </div>
  );
}

/** The space's Devin connection, read once while a Devin card is shown. Null until it loads or if it fails. */
function useDevinConnection(enabled: boolean) {
  const [connection, setConnection] = useState<DevinSessionsOutput["connection"] | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    rpc.devin
      .sessions()
      .then((result) => live && setConnection(result.connection))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [enabled]);
  return connection;
}

function McpCard({
  server,
  data,
  descriptions,
  onReconnectDevin,
}: {
  server: McpServer;
  data: IntegrationsData;
  /** What each first-party server does, shown instead of its raw address. */
  descriptions: Partial<Record<string, string>>;
  onReconnectDevin: () => void;
}) {
  const { t } = useLingui();
  const reconnect = useMcpReconnect(server.id, () => void data.refresh());
  const isDevin = "endpoint" in server && isDevinEndpoint(server.endpoint);
  const connection = useDevinConnection(isDevin);
  // The space's connection is this card only for the connector's own server; a private Devin
  // server kept from before is a plain MCP server and must not take the shared key's actions.
  const devin =
    connection?.isConnector && connection.agentBotId === (server.agentBotId ?? null)
      ? connection
      : null;
  // A key Devin refused, or a connector who left, is fixed with a new key, not by signing in again.
  const devinLapsed = devin?.status === "rejected" || devin?.status === "connector_gone";
  const status = reconnect.busy ? "connecting" : devinLapsed ? "reconnect" : mcpStatus(server);
  const assigned = data.mcpAssignments
    .filter((entry) => entry.serverId === server.id)
    .map((entry) => entry.botId);
  const known =
    "endpoint" in server
      ? FIRST_PARTY_MCP.find((entry) => isSameMcpEndpoint(server.endpoint, entry.endpoint))
      : undefined;
  // The app page a known server feeds, opened from its card like Mercury's "Open Finance".
  const page =
    known?.id === "carta"
      ? { to: "/app/investors", label: t`Open Investors` }
      : devin
        ? { to: "/app/devin", label: t`Open Devin` }
        : undefined;
  const granola = isGranolaEndpoint(server.endpoint);
  // One line for Granola: the key route's status when it has one, else the sign-in badge.
  const keyStatus = data.meetings;
  const keyLine = granola && keyStatus ? granolaLine(keyStatus) : null;
  const managePath = granola ? GRANOLA_PATH : `/app/integrations/mcp/${server.id}`;
  return (
    <Card>
      <CardHead
        name={server.name}
        logo={known?.logo}
        sub={
          (known && descriptions[known.id]) ||
          (isBrexCardsEndpoint(server.endpoint) ? undefined : hostOf(server.endpoint)) ||
          server.command ||
          undefined
        }
        to={managePath}
      />
      <UsedBy bots={data.bots.filter((bot) => assigned.includes(bot.id))} />
      <div className="mt-auto flex min-h-7 items-center gap-2 max-sm:basis-full max-sm:empty:hidden">
        {keyLine && keyStatus ? (
          <GranolaStatusLine status={keyStatus} />
        ) : (
          <StatusBadge status={status} quiet />
        )}
        {page && status === "connected" ? (
          <OpenPageLink to={page.to}>{page.label}</OpenPageLink>
        ) : null}
        {status === "reconnect" && !keyLine && (!devin || devin.manage) ? (
          <Button
            size="sm"
            className="relative z-10 ms-auto"
            disabled={reconnect.busy}
            onClick={() => (devin ? onReconnectDevin() : void reconnect.run())}
          >
            <Trans>Reconnect</Trans>
          </Button>
        ) : null}
      </div>
      {reconnect.error ? (
        <p role="alert" className="text-xs text-destructive max-sm:basis-full">
          {reconnect.error}
        </p>
      ) : null}
      {reconnect.needsClient ? (
        <CustomConnectionDialog data={data} existingServer={server} onClose={reconnect.dismiss} />
      ) : null}
    </Card>
  );
}

/** Granola with only the API key connected: there is no sign-in server to build a card from. */
function GranolaKeyCard({
  status,
  description,
}: {
  status: NonNullable<IntegrationsData["meetings"]>;
  description?: string;
}) {
  return (
    <Card>
      <CardHead name="Granola" sub={description} to={GRANOLA_PATH} />
      <div className="mt-auto flex min-h-7 items-center gap-2 max-sm:basis-full max-sm:empty:hidden">
        <GranolaStatusLine status={status} />
      </div>
    </Card>
  );
}

function AppCard({
  app,
  data,
  onRetry,
  onReconnect,
}: {
  app: ConnectedApp;
  data: IntegrationsData;
  onRetry: (app: ConnectedApp) => void;
  onReconnect: (app: ConnectedApp, row: Connection) => void;
}) {
  // An account labelled with the app's own name says nothing new, so show what the app does instead.
  const { t } = useLingui();
  const { lines, more } = accountLines(accountLabels(app), 3);
  const count = more;
  const accounts = more ? [...lines, t`+${count} more`] : lines;
  const working = app.rows.find((row) => row.status === "connected");
  const lapsed = app.rows.find((row) => row.status === "connected" && row.needsReconnect);
  const description = data.catalog.find(
    (item) => item.connectorId === app.connectorId && item.slug === app.provider,
  )?.description;
  const to = appPath({ connectorId: app.connectorId, slug: app.provider });
  return (
    <Card>
      <CardHead
        name={app.name}
        logo={app.logo}
        sub={accounts.length ? accounts : (description ?? undefined)}
        to={to}
      />
      {app.status === "failed" || app.status === "connecting" ? null : (
        <UsedBy bots={agentsFor(data.bots, working ? data.access[working.id] : undefined)} />
      )}
      <div className="mt-auto flex min-h-7 items-center gap-2 max-sm:basis-full max-sm:empty:hidden">
        <StatusBadge status={app.status} quiet />
        {app.status === "connected" && app.provider.toUpperCase() === "GMAIL" ? (
          <OpenPageLink to="/app/inbox">
            <Trans>Open Inbox</Trans>
          </OpenPageLink>
        ) : null}
        {app.status === "reconnect" && lapsed ? (
          <Button
            size="sm"
            className="relative z-10 ms-auto"
            onClick={() => onReconnect(app, lapsed)}
          >
            <Trans>Reconnect</Trans>
          </Button>
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
        <p className="text-xs text-muted-foreground max-sm:basis-full">
          {app.error ?? <Trans>Sign-in did not finish.</Trans>}
        </p>
      ) : app.status === "connecting" ? (
        <p className="text-xs text-muted-foreground max-sm:basis-full">
          <Trans>Waiting for you to finish signing in.</Trans>
        </p>
      ) : null}
    </Card>
  );
}

function SourceCard({
  source,
  bots,
  onRemove,
}: {
  source: CapabilityInstall;
  bots: IntegrationsData["bots"];
  onRemove: (source: CapabilityInstall) => void;
}) {
  const { t } = useLingui();
  const usedBy = new Set(source.usableBotIds ?? []);
  return (
    <Card>
      <TileMenu label={t`More ${source.name} actions`}>
        <DropdownMenuItem onClick={() => onRemove(source)}>
          <Trans>Remove</Trans>
        </DropdownMenuItem>
      </TileMenu>
      <CardHead
        name={source.name}
        sub={`${source.kind.toUpperCase()} · ${hostOf(source.source)}`}
        to={`/app/integrations/source/${source.id}`}
      />
      <UsedBy bots={bots.filter((bot) => usedBy.has(bot.id))} />
      {source.agentBotId ? (
        <div className="mt-auto flex min-h-7 items-center gap-2 max-sm:basis-full">
          <OpenPageLink to={`/app/${source.agentBotId}`}>
            <Trans>Open agent</Trans>
          </OpenPageLink>
        </div>
      ) : null}
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
    // Below 640px the tile is one row, Connect beside the name: 25 apps then fit in a few screens.
    <IntegrationTile className="max-sm:flex-row max-sm:items-center max-sm:p-3">
      <div className="min-w-0 sm:contents max-sm:flex-1">
        <CardHead name={name} logo={logo} sub={description ?? undefined} />
      </div>
      <div className="mt-auto flex items-center gap-2 max-sm:mt-0 max-sm:shrink-0">
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
  onOpenMessaging,
}: {
  data: IntegrationsData;
  activeBotId?: string;
  onOpenMessaging?: () => void;
}) {
  const { t } = useLingui();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const list = useListParams(SORT_FIELDS, { field: "default", dir: "asc" });
  const statusParam = list.param("status");
  // A status filter shows only the connected apps, so it hides everything that is not connected.
  const status =
    statusParam === "connected" || statusParam === "attention" ? statusParam : undefined;
  const [category, setCategory] = useState<Chip>(
    params.get("category") === "finance" ? "finance" : "all",
  );
  const financeRef = useRef<HTMLDivElement>(null);
  const lapsedRef = useRef<HTMLDivElement>(null);
  const jumpToFinance = useRef(params.get("category") === "finance");
  // /app/integrations?connect=carta opens that first-party tile's sign-in once the page has loaded.
  const connectOnLoad = useRef(params.get("connect"));
  // /app/integrations?open=gmail shows that app's page, where its accounts can be removed or added.
  const openOnLoad = useRef(params.get("open"));
  // ...&returnTo=/app/investors sends the founder back there when that dialog closes.
  const returnTo = useRef(appReturnPath(params.get("returnTo")));
  const navigate = useNavigate();
  const location = useLocation();
  const [visible, setVisible] = useState(CONNECTION_CATALOG_PAGE_SIZE);
  /** On a phone the Popular list starts at three apps, so the whole page is not one long scroll. */
  const [phoneAll, setPhoneAll] = useState(false);
  const [connecting, setConnecting] = useState<ConnectionCatalogItem | null>(null);
  /** The signed-out account a reconnect replaces once the new sign-in succeeds. */
  const [replacing, setReplacing] = useState<Connection | null>(null);
  const [connectionError, setConnectionError] = useState<{
    connectionId: string;
    message: string;
  } | null>(null);
  useEffect(() => {
    if (
      connectionError &&
      !data.connections.some(
        (connection) =>
          connection.id === connectionError.connectionId && connection.status !== "revoked",
      )
    ) {
      setConnectionError(null);
    }
  }, [connectionError, data.connections]);
  /** The page of an app that just finished connecting; its card takes focus once it appears. */
  const focusAfterConnect = useRef<string | null>(null);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (data.loaded) return setSlow(false);
    const timer = setTimeout(() => setSlow(true), 2000);
    return () => clearTimeout(timer);
  }, [data.loaded]);
  const [custom, setCustom] = useState<{
    url: string;
    /** The first-party service this dialog connects; titles the dialog. */
    service?: string;
    oauthClient?: boolean;
    scope?: string;
    token?: boolean;
    apiKey?: boolean;
  } | null>(null);
  /** The Devin key dialog: connecting the space, or replacing a refused key. */
  const [devinDialog, setDevinDialog] = useState<"connect" | "replace" | null>(null);
  const [brexDialog, setBrexDialog] = useState(false);
  const [removing, setRemoving] = useState<CapabilityInstall | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  // The chips are the page's own section headings (plus All), so each one jumps to a heading you can see.
  const labels: Record<Chip, string> = {
    all: t`All`,
    finance: t`Finance`,
    social: t`Social`,
    equity: t`Equity`,
    tools: t`Tools`,
  };

  const sortNames = {
    default: t`Default`,
    name: t`Name`,
    status: t`Status`,
    connected: t`Connected`,
  };
  const apps = useMemo(
    () => groupConnections(data.connections, data.catalog),
    [data.connections, data.catalog],
  );
  const open = useMemo(
    () => popularApps(data.catalog, data.connections),
    [data.catalog, data.connections],
  );
  // Only Finance also narrows the Popular catalog; Social, Equity and Tools hold just their own tiles.
  const results = useMemo(
    () =>
      !status && (category === "all" || category === "finance")
        ? filterCatalog(open, { query, category })
        : [],
    [open, query, category, status],
  );
  const firstPartySections = { social: labels.social, equity: labels.equity, tools: labels.tools };
  const firstPartyDescription = {
    zernio: t`Post and schedule to social accounts`,
    carta: t`Investors, equity and cap table`,
    x: t`Read posts, DMs and bookmarks`,
    treg: t`Live data, enrichment and generation tools`,
    devin: t`Coding sessions and repo docs`,
    box: t`Search and read files and folders`,
    granola: t`Meeting notes and transcripts`,
    wisprflow: t`Notetaker meetings, notes and tasks`,
    omi: t`Pendant recordings, meetings and notes`,
  };
  const financeStatus = useFinanceStatus();
  const connectedKeys = connectedFinanceKeys(data.financeSources, financeStatus);
  const financeNames = FINANCE_PROVIDERS.map((entry) => entry.name.toLowerCase());
  const financeMatches = financeNames.some((name) => name.includes(query.trim().toLowerCase()));
  const showFinance =
    !status &&
    (category === "all" || category === "finance") &&
    financeMatches &&
    connectedKeys.size < FINANCE_TILE_COUNT;
  // Connecting Brex cards is for the space owner. The role comes from the space list's own flag for
  // the owner's rights; until it answers, or if it fails, the tile stays hidden.
  const [spaceOwner, setSpaceOwner] = useState(false);
  useEffect(() => {
    void Promise.resolve()
      .then(() => rpc.spaces.list())
      .then((navigation) =>
        setSpaceOwner(
          navigation.spaces.find((space) => space.id === navigation.current.id)?.canRename === true,
        ),
      )
      .catch(() => setSpaceOwner(false));
  }, []);
  const [omiConnected, setOmiConnected] = useState(false);
  useEffect(() => {
    void Promise.resolve(rpc.omi?.status?.())
      .then((status) => setOmiConnected(Boolean(status)))
      .catch(() => undefined);
  }, []);
  const granolaKey =
    data.meetings && data.meetings.status !== "disconnected" ? data.meetings : null;
  const hasGranolaServer = data.servers.some((server) => isGranolaEndpoint(server.endpoint));
  const keyOnlyGranola = Boolean(granolaKey) && !hasGranolaServer;
  const unconnectedFirstParty = FIRST_PARTY_MCP.filter(
    (entry) =>
      !data.servers.some(
        (server) => "endpoint" in server && isSameMcpEndpoint(server.endpoint, entry.endpoint),
      ) &&
      !data.sources.some((source) => isSameMcpEndpoint(source.source, entry.endpoint)) &&
      // A connected API key is already Granola's tile under Connected.
      !(entry.id === "granola" && keyOnlyGranola) &&
      !(entry.id === "omi" && omiConnected),
  );
  const firstPartyMcp = unconnectedFirstParty.filter(
    (entry) =>
      !status &&
      (category === "all" || category === entry.section || category === entry.category) &&
      entry.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  // Brex cards has no https endpoint to match a connected server by, so its tile is hidden by its own check.
  const showBrexTile =
    !status &&
    spaceOwner &&
    !data.servers.some((server) => isBrexCardsEndpoint(server.endpoint)) &&
    (category === "all" || category === "tools" || category === "finance") &&
    "brex cards".includes(query.trim().toLowerCase());
  // A chip whose heading would not show is not offered. Finance always has its own tiles. Until the
  // data arrives only All and Finance show, so the other chips join at the end instead of shifting.
  const chips = CHIPS.filter(
    (id) =>
      id === "all" ||
      id === "finance" ||
      (data.loaded &&
        (id === category ||
          unconnectedFirstParty.some((entry) => entry.section === id) ||
          (id === "tools" && showBrexTile))),
  );
  const [chatMatches, setChatMatches] = useState(0);
  const financeServerIds = data.financeSources.flatMap((source) =>
    source.serverId ? [source.serverId] : [],
  );
  // A Blockscout key is stored as its MCP server. Once that server exists, the finance tile under
  // Connected replaces the server's own tile, so Blockscout has one status on the page.
  const isCrypto = (server: McpServer) => "endpoint" in server && isCryptoEndpoint(server.endpoint);
  const cryptoServer = connectedKeys.has("crypto") ? data.servers.find(isCrypto) : undefined;
  /** The agents assigned to an MCP server. */
  const botsOn = (serverId: string) =>
    data.bots.filter((bot) =>
      data.mcpAssignments.some((entry) => entry.serverId === serverId && entry.botId === bot.id),
    );
  const servers = data.servers.filter(
    (server) => !financeServerIds.includes(server.id) && server !== cryptoServer,
  );
  const filtering = Boolean(query.trim()) || category !== "all" || Boolean(status);
  const phoneCollapsed = !phoneAll && !filtering;
  // Connected narrows to the chip's category and to apps whose name matches the search, so an app
  // that is already connected still turns up when searched for.
  const searching = Boolean(query.trim()) || Boolean(status);
  const chipOnly = category !== "all" && !searching;
  const wholeList = category === "all";
  const financeProps = {
    sources: data.financeSources,
    status: financeStatus,
    onChanged: () => void data.refresh(),
    extras: {
      ...Object.fromEntries(
        data.financeSources.flatMap((source) =>
          source.serverId
            ? [[source.provider, <UsedBy key="used" bots={botsOn(source.serverId)} />]]
            : [],
        ),
      ),
      ...(cryptoServer ? { crypto: <UsedBy key="used" bots={botsOn(cryptoServer.id)} /> } : {}),
    },
    cryptoManageTo: cryptoServer ? `/app/integrations/mcp/${cryptoServer.id}` : undefined,
  };
  const financeLabel: Record<string, string> = {
    ...Object.fromEntries(FINANCE_PROVIDERS.map((entry) => [entry.provider, entry.name])),
    ...Object.fromEntries(EXCHANGES.map((entry) => [entry.provider, entry.name])),
    crypto: "Blockscout",
    alchemy: "Alchemy",
  };
  const specialSearch = query.trim().toLowerCase();
  const showSpecialSearch = wholeList && Boolean(specialSearch) && !status;
  const matchingSpecials = {
    granola:
      showSpecialSearch &&
      Boolean(granolaKey && keyOnlyGranola) &&
      "granola".includes(specialSearch),
    omi: showSpecialSearch && omiConnected && "omi".includes(specialSearch),
    // Hex only renders where the desktop bridge exists (or once connected), so count it there.
    hex: showSpecialSearch && hexBridge() !== undefined && "hex".includes(specialSearch),
    sources: showSpecialSearch
      ? data.sources.filter((source) => source.name.toLowerCase().includes(specialSearch))
      : [],
  };
  const hasSpecialSearchMatch =
    matchingSpecials.granola ||
    matchingSpecials.omi ||
    matchingSpecials.hex ||
    matchingSpecials.sources.length > 0;
  // Special cards keep their layout, but participate in search when it is the only filter.
  type Entry = EntryInfo & { key: string; node: ReactNode };
  const lapsedKeys = lapsedFinanceKeys(data.financeSources);
  const erroredKeys = erroredFinanceKeys(financeStatus);
  const entries: Entry[] = [
    ...apps
      .filter(
        (app) =>
          category === "all" ||
          data.catalog.find((item) => `${item.connectorId}:${item.slug}` === app.key)?.category ===
            category,
      )
      .map((app) => ({
        ...appEntry(app),
        key: app.key,
        node: <AppCard key={app.key} app={app} data={data} onRetry={retry} onReconnect={retry} />,
      })),
    ...(wholeList ? servers : []).map((server) => ({
      key: server.id,
      name: server.name,
      search: [server.name, hostOf(server.endpoint) ?? "", server.command ?? ""],
      attention: mcpStatus(server) !== "connected",
      created: server.createdAt ?? null,
      node: (
        <McpCard
          key={server.id}
          server={server}
          data={data}
          descriptions={firstPartyDescription}
          onReconnectDevin={() => setDevinDialog("replace")}
        />
      ),
    })),
    ...(wholeList || category === "finance"
      ? [
          ...[...connectedKeys].map((key) => ({ key, attention: false })),
          // Without a status filter a lapsed bank keeps its own section above Connected.
          ...(status
            ? [...lapsedKeys, ...erroredKeys].map((key) => ({ key, attention: true }))
            : []),
        ].map(({ key, attention }) => ({
          key: `finance:${key}`,
          name: financeLabel[key] ?? key,
          search: [financeLabel[key] ?? key],
          attention,
          created: null,
          node: (
            <div key={key} className="contents [&_[data-testid=finance-section]]:contents">
              <FinanceSection
                {...financeProps}
                mode={!attention ? "connected" : erroredKeys.has(key) ? "available" : "lapsed"}
                only={key}
              />
            </div>
          ),
        }))
      : []),
  ];
  // Every kind of card counts, and an active filter or sort keeps its controls so it can be cleared.
  const entryCount =
    entries.filter((entry) => !entry.key.startsWith("finance:")).length +
    connectedKeys.size +
    (status ? 0 : lapsedKeys.size + erroredKeys.size);
  const connectedEntries = sortEntries(
    filterEntries(entries, { query, status }),
    list.sort.field,
    list.sort.dir,
  );
  const otherMatches =
    showFinance ||
    firstPartyMcp.length > 0 ||
    showBrexTile ||
    chatMatches > 0 ||
    (searching && connectedEntries.length > 0) ||
    hasSpecialSearchMatch;
  const anyConnected =
    apps.length + servers.length + data.sources.length + connectedKeys.size > 0 ||
    keyOnlyGranola ||
    omiConnected;
  const hasConnected = chipOnly ? connectedEntries.length > 0 : anyConnected;
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
    // A lapsed bank's reconnect tile sits above the finance section, so land on it first.
    const target = lapsedRef.current?.firstChild ? lapsedRef.current : financeRef.current;
    target?.scrollIntoView?.({ block: "start" });
  }, [data.loaded]);

  // After Done, focus the new card (the Connect button it came from is gone).
  useEffect(() => {
    const path = focusAfterConnect.current;
    if (!path || connecting) return;
    const link = document.querySelector<HTMLElement>(`a[href="${CSS.escape(path)}"]`);
    if (!link) return;
    focusAfterConnect.current = null;
    // Wait a frame so the dialog's own focus restore has finished.
    const frame = requestAnimationFrame(() => link.focus());
    return () => cancelAnimationFrame(frame);
  }, [connecting, connectedEntries.length]);

  function connectFirstParty(entry: (typeof FIRST_PARTY_MCP)[number]) {
    if (entry.id === "devin") return setDevinDialog("connect");
    // Granola has its own page: sign-in and the API key are both connected there.
    if (entry.id === "granola") {
      void navigate(GRANOLA_PATH);
      return;
    }
    if (entry.id === "omi") {
      void navigate(OMI_PATH);
      return;
    }
    setCustom({
      url: entry.endpoint,
      service: entry.name,
      // Treg takes an API token, not a sign-in.
      ...(entry.id === "treg" ? { token: true } : {}),
      ...("oauthClient" in entry ? { oauthClient: true, scope: entry.scope } : {}),
    });
  }

  useEffect(() => {
    const wanted = connectOnLoad.current ?? openOnLoad.current;
    if (!wanted || !data.loaded) return;
    const connect = Boolean(connectOnLoad.current);
    connectOnLoad.current = null;
    openOnLoad.current = null;
    const entry = connect ? firstPartyMcp.find((candidate) => candidate.id === wanted) : undefined;
    if (entry) return connectFirstParty(entry);
    // A catalog app (?connect=gmail from the Inbox) opens its own page's connect flow.
    const app = data.catalog.find((item) => item.slug.toLowerCase() === wanted.toLowerCase());
    if (app)
      navigate(appPath(app, { connect, next: returnTo.current ?? undefined }), {
        state: location.state,
      });
    else setQuery(wanted);
    returnTo.current = null;
  }, [data.loaded, data.catalog, firstPartyMcp, navigate]);

  function retry(app: ConnectedApp, lapsed: Connection | null = null) {
    setConnectionError(null);
    const item = data.catalog.find((entry) => `${entry.connectorId}:${entry.slug}` === app.key);
    setReplacing(lapsed);
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
    <div className="flex h-full min-h-0 flex-col">
      {/* The title stays put and the cards scroll under its line. */}
      <div className={`${PAGE_GUTTER_X} pt-2`}>
        <PageHeader title={<Trans>Integrations</Trans>} className="mb-2" />
      </div>
      <div className={`rk-scroll min-h-0 flex-1 overflow-y-auto ${PAGE_GUTTER_X} pt-4 pb-6`}>
        <div>
          {/* Rendered before the data loads, so only the grid below waits. */}
          {notSetUp ? null : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                <SearchField
                  name="integration-search"
                  className="w-full sm:w-[420px]"
                  value={query}
                  placeholder={t`Search integrations`}
                  label={t`Search integrations`}
                  onChange={(value) => {
                    setQuery(value);
                    setVisible(CONNECTION_CATALOG_PAGE_SIZE);
                  }}
                />
                {entryCount > 1 || status || list.sort.field !== "default" ? (
                  <>
                    <PickFilter
                      label={t`Status`}
                      value={status}
                      options={[
                        ["connected", t`Connected`],
                        ["attention", t`Needs attention`],
                      ]}
                      onChange={(value) => list.setParam("status", value)}
                    />
                    <div className="ms-auto flex items-center gap-0.5">
                      <SortControl
                        fields={SORT_FIELDS.map((field) => [field, sortNames[field]])}
                        field={list.sort.field}
                        fieldLabel={sortNames[list.sort.field]}
                        direction={list.sort.field === "default" ? undefined : list.sort.dir}
                        onField={(field) => list.setSort({ field, dir: "asc" })}
                        onDirection={(dir) => list.setSort({ field: list.sort.field, dir })}
                      />
                    </div>
                  </>
                ) : null}
              </div>
              <fieldset
                aria-label={t`Category`}
                className="m-0 mb-4 flex min-w-0 flex-wrap gap-1.5 border-0 p-0"
              >
                {chips.map((id) => (
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
            </>
          )}
          {/* Until everything has loaded, show placeholders, not tiles that read "Not connected". */}
          {!data.loaded ? (
            <div
              aria-busy="true"
              role="status"
              aria-label={t`Loading integrations`}
              className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]"
            >
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <Skeleton key={n} className="h-28 w-full rounded-xl" />
              ))}
            </div>
          ) : null}
          {!data.loaded && slow ? (
            <p className="mt-3 text-sm text-muted-foreground">
              <Trans>Loading integrations…</Trans>
            </p>
          ) : null}
          {data.error || data.catalogFailed || connectionError ? (
            <div
              role="alert"
              className="mb-4 flex flex-wrap items-center gap-2 text-sm text-destructive"
            >
              <span>
                {connectionError?.message ?? data.error ?? (
                  <Trans>Could not load the app list. Reload to try again.</Trans>
                )}
              </span>
              {data.error ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setConnectionError(null);
                    void data.refresh();
                  }}
                >
                  <Trans>Try again</Trans>
                </Button>
              ) : null}
            </div>
          ) : null}
          {data.loaded ? (
            <>
              {/* A lapsed connection is the one thing to fix, so it sits above Connected. */}
              {!status && (wholeList || category === "finance") && financeMatches ? (
                <div ref={lapsedRef} className="mb-3 scroll-mt-4 empty:hidden">
                  <FinanceSection
                    mode="lapsed"
                    sources={data.financeSources}
                    status={financeStatus}
                    onChanged={() => void data.refresh()}
                  />
                </div>
              ) : null}
              {(searching ? connectedEntries.length > 0 || hasSpecialSearchMatch : hasConnected) ? (
                <>
                  <SectionTitle>
                    <Trans>Connected</Trans>
                  </SectionTitle>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
                    {connectedEntries.map((entry) => entry.node)}
                    {granolaKey &&
                    keyOnlyGranola &&
                    wholeList &&
                    (!searching || matchingSpecials.granola) ? (
                      <GranolaKeyCard
                        status={granolaKey}
                        description={firstPartyDescription.granola}
                      />
                    ) : null}
                    {omiConnected && wholeList && (!searching || matchingSpecials.omi) ? (
                      <Card>
                        <CardHead name="Omi" sub={firstPartyDescription.omi} to={OMI_PATH} />
                      </Card>
                    ) : null}
                    {wholeList && (!searching || matchingSpecials.hex) ? <HexCard /> : null}
                    {(wholeList ? (searching ? matchingSpecials.sources : data.sources) : []).map(
                      (source) => (
                        <SourceCard
                          key={source.id}
                          source={source}
                          bots={data.bots}
                          onRemove={setRemoving}
                        />
                      ),
                    )}
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
                          className="inline-flex h-8 pointer-coarse:h-11 items-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground"
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
                      onConnect={() => {
                        setConnectionError(null);
                        setConnecting(item);
                      }}
                    />
                  ))}
                </div>
              ) : null}
              {/* While filtering, every kind of match shares this one grid; its parts drop their own. */}
              <div
                className={
                  filtering
                    ? "mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))] [&_[data-flat]]:contents [&_[data-testid=finance-section]]:contents"
                    : undefined
                }
              >
                {notSetUp ? null : (
                  <>
                    {results.length === 0 && otherMatches ? null : (
                      <>
                        {filtering ? null : (
                          <SectionTitle>
                            <Trans>Popular</Trans>
                          </SectionTitle>
                        )}
                        {results.length === 0 && !otherMatches ? (
                          <p className="py-2 text-muted-foreground" data-testid="no-apps">
                            <Trans>No integrations match.</Trans>
                          </p>
                        ) : (
                          <>
                            <div
                              data-testid="app-grid"
                              data-flat={filtering ? "" : undefined}
                              className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]"
                            >
                              {results.slice(0, visible).map((item, index) => (
                                <div
                                  key={`${item.connectorId}:${item.slug}`}
                                  className={
                                    index >= PHONE_POPULAR && phoneCollapsed
                                      ? "contents max-sm:hidden"
                                      : "contents"
                                  }
                                >
                                  <AppTile
                                    name={item.name}
                                    logo={item.logo}
                                    description={item.description}
                                    onConnect={() => {
                                      setConnectionError(null);
                                      setConnecting(item);
                                    }}
                                  />
                                </div>
                              ))}
                            </div>
                            {phoneCollapsed ? (
                              <div className="mt-3 flex justify-center sm:hidden">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setPhoneAll(true)}
                                >
                                  <Trans>Show more</Trans>
                                </Button>
                              </div>
                            ) : null}
                          </>
                        )}
                      </>
                    )}
                    {results.length > visible ? (
                      <div
                        className={`col-span-full mt-4 flex justify-center ${phoneCollapsed ? "max-sm:hidden" : ""}`}
                      >
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
                  <div
                    ref={financeRef}
                    data-flat={filtering ? "" : undefined}
                    className={`scroll-mt-4 ${phoneCollapsed ? "max-sm:hidden" : ""}`}
                  >
                    {filtering ? null : (
                      <SectionTitle>
                        <Trans>Finance</Trans>
                      </SectionTitle>
                    )}
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
                  const brexTile = section === "tools" && showBrexTile;
                  return entries.length > 0 || brexTile ? (
                    <div
                      key={section}
                      data-flat={filtering ? "" : undefined}
                      className={phoneCollapsed ? "max-sm:hidden" : undefined}
                    >
                      {filtering ? null : (
                        <SectionTitle>{firstPartySections[section]}</SectionTitle>
                      )}
                      <div
                        data-flat={filtering ? "" : undefined}
                        className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]"
                      >
                        {entries.map((entry) => (
                          <AppTile
                            key={entry.id}
                            name={entry.name}
                            logo={entry.logo}
                            description={firstPartyDescription[entry.id]}
                            onConnect={() => connectFirstParty(entry)}
                          />
                        ))}
                        {brexTile ? (
                          <AppTile name="Brex cards" onConnect={() => setBrexDialog(true)} />
                        ) : null}
                      </div>
                    </div>
                  ) : null;
                })}

                {category === "all" && !status ? (
                  <IMessageSection
                    query={query}
                    flat={filtering}
                    onShown={setChatMatches}
                    onOpenMessaging={onOpenMessaging}
                  />
                ) : null}
              </div>

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
                    <Trans>Connect any other app by its address.</Trans>
                  </span>
                </div>
                <Button
                  variant="outline"
                  aria-label={t`Add custom connection`}
                  onClick={() => setCustom({ url: "" })}
                >
                  <Trans>Add</Trans>
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {connecting ? (
        <ConnectAppDialog
          item={connecting}
          data={data}
          activeBotId={activeBotId}
          accountName={replacing?.displayName}
          replacesConnectionId={replacing?.id}
          onClose={() => {
            setConnecting(null);
            setReplacing(null);
          }}
          onConnected={async () => {
            setConnectionError(null);
            focusAfterConnect.current = appPath({
              connectorId: connecting.connectorId,
              slug: connecting.slug,
            });
            if (replacing) {
              // A same-account sign-in can already have retired the old row on the server.
              try {
                await rpc.connections.revoke({ connectionId: replacing.id });
              } catch (err) {
                const rows = await rpc.connections.list().catch(() => null);
                if (
                  rows === null ||
                  rows.some((row) => row.id === replacing.id && row.status !== "revoked")
                ) {
                  setConnectionError({
                    connectionId: replacing.id,
                    message: errorText(err, t`Could not disconnect`),
                  });
                }
              }
              await data.refresh();
            }
          }}
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
          onAgent={(botId) => navigate(`/app/${botId}`)}
          onClose={() => {
            setCustom(null);
            const back = returnTo.current;
            returnTo.current = null;
            if (back) navigate(back);
          }}
        />
      ) : null}
      {brexDialog ? (
        <BrexCardsConnectDialog
          onConnected={() => data.refresh()}
          onClose={() => setBrexDialog(false)}
        />
      ) : null}
      {devinDialog ? (
        <DevinConnectDialog mode={devinDialog} onClose={() => setDevinDialog(null)} />
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
