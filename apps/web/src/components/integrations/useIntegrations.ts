import { useLingui } from "@lingui/react/macro";
import type {
  Bot,
  BotMcpServer,
  CapabilityInstall,
  Connection,
  ConnectionCatalogItem,
  FinanceSource,
  IntegrationSetupState,
  McpServer,
  MeetingsStatus,
} from "@rakazo/contracts";
import { preferNativeGoogle } from "@rakazo/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { INTEGRATIONS_CHANGED_EVENT } from "../../lib/agent-app";
import { desktopBridge, nativeGoogleAvailable } from "../../lib/desktop";
import { optionalCatalogFeedProbe } from "../../lib/optional-catalog-feed";
import { rpc, selectedSpaceId } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";

/** The stored grant, which the access switches edit and save. */
export type ConnectionAccess = { allAgents: boolean; botIds: string[] };
/** The stored grant plus who can really use the connection, as computed by the server. */
export type ConnectionAccessState = ConnectionAccess & {
  effectiveAccess: { shared: "all" | "some" | "none"; botIds: string[] };
};

export type IntegrationsData = {
  loaded: boolean;
  /** This data came from a request made now, not from the revisit cache. Navigation waits for it. */
  fresh: boolean;
  error: string | null;
  catalog: ConnectionCatalogItem[];
  connections: Connection[];
  servers: McpServer[];
  bots: Bot[];
  mcpAssignments: BotMcpServer[];
  access: Record<string, ConnectionAccessState>;
  sources: CapabilityInstall[];
  /** Mercury and Brex, the first-party Finance integrations. */
  financeSources: FinanceSource[];
  setup: IntegrationSetupState | null;
  /** The Granola API-key route; null before a key was pasted. */
  meetings?: MeetingsStatus;
  /** The app catalog request failed, which is different from a server with no catalog. */
  catalogFailed: boolean;
  /** The server offers the by-domain catalog search. */
  feedEnabled: boolean;
  refresh: () => Promise<void>;
};

type LoadedData = Omit<IntegrationsData, "refresh">;

/** The last successful load, so a revisit paints the list at once while it refreshes. */
let lastLoaded: { owner: string; data: LoadedData } | null = null;
let cacheUser: string | null = null;

/** The cache belongs to one person in one Space; anything else is a miss. */
function cacheOwner(): string {
  return `${cacheUser ?? ""}:${selectedSpaceId() ?? ""}`;
}

/** Forget the last load on every sign-in, sign-out and session expiry. */
export function clearIntegrationsCache() {
  lastLoaded = null;
}

/** Tell the cache who is signed in; a different person (or none) empties it. */
export function bindIntegrationsCache(userId: string | null) {
  if (userId !== cacheUser) lastLoaded = null;
  cacheUser = userId;
}

/** Everything the Integrations pages show, loaded together and refreshed after any change. */
export function useIntegrations(): IntegrationsData {
  const { t } = useLingui();
  // useLingui returns a fresh t each render; keep refresh stable so its effect runs once.
  const loadFailed = useRef(t`Could not load integrations`);
  loadFailed.current = t`Could not load integrations`;
  const [data, setData] = useState<LoadedData>(
    () =>
      (lastLoaded?.owner === cacheOwner() ? { ...lastLoaded.data, fresh: false } : null) ?? {
        loaded: false,
        fresh: false,
        error: null,
        catalog: [],
        connections: [],
        servers: [],
        bots: [],
        mcpAssignments: [],
        access: {},
        sources: [],
        financeSources: [],
        setup: null,
        feedEnabled: false,
        catalogFailed: false,
      },
  );
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    const owner = cacheOwner();
    try {
      // A server without a managed catalog fails or returns nothing: custom connections still work.
      const [
        catalog,
        connections,
        servers,
        bots,
        mcpAssignments,
        installs,
        setup,
        feed,
        finance,
        meetings,
      ] = await Promise.all([
        rpc.connections.catalog({}).catch(() => null),
        rpc.connections.list().catch(() => []),
        rpc.mcp.servers.list(),
        rpc.bots.list(),
        rpc.mcp.assignments.all().catch(() => []),
        rpc.capabilities.list().catch(() => []),
        rpc.integrationSetup.get().catch(() => null),
        optionalCatalogFeedProbe(rpc.capabilities.catalogSearch({ query: "" })).catch(() => ({
          enabled: false,
        })),
        rpc.finance.overview().catch(() => null),
        Promise.resolve()
          .then(() => rpc.meetings.status())
          .catch(() => null),
      ]);
      const live = connections.filter((row) => row.status !== "revoked");
      const effective = await rpc.connections
        .effectiveAccess()
        .catch((): Record<string, ConnectionAccessState["effectiveAccess"]> => ({}));
      const access = Object.fromEntries(
        await Promise.all(
          live.map(
            async (row) =>
              [
                row.id,
                {
                  ...(await rpc.connections
                    .access({ connectionId: row.id })
                    .catch((): ConnectionAccess => ({ allAgents: true, botIds: [] }))),
                  effectiveAccess: effective[row.id] ?? { shared: "none", botIds: [] },
                },
              ] as const,
          ),
        ),
      );
      window.dispatchEvent(new Event(INTEGRATIONS_CHANGED_EVENT));
      if (!mounted.current) return;
      const next: LoadedData = {
        loaded: true,
        fresh: true,
        error: null,
        catalogFailed: catalog === null,
        catalog: preferNativeGoogle(catalog ?? [], {
          nativeGoogle: nativeGoogleAvailable(desktopBridge()),
        }),
        connections: live,
        servers: servers.filter((server) => server.enabled),
        bots: bots.filter((bot) => !bot.archivedAt),
        mcpAssignments,
        access,
        sources: installs.filter(
          (install) =>
            install.kind === "mcp" || install.kind === "api" || install.kind === "graphql",
        ),
        financeSources: finance?.sources ?? [],
        setup,
        meetings,
        feedEnabled: feed.enabled,
      };
      if (owner === cacheOwner()) lastLoaded = { owner, data: next };
      setData(next);
    } catch (err) {
      if (mounted.current)
        setData((prev) => ({
          ...prev,
          loaded: true,
          fresh: !prev.loaded,
          error: errorText(err, loadFailed.current),
        }));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // While the first Granola sync runs the page shows "Syncing"; look again every few seconds, only
  // while the page is visible, and stop once it has finished.
  const syncing = data.meetings?.status === "connected" && !data.meetings.syncedThrough;
  useEffect(() => {
    if (!syncing) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void Promise.resolve()
        .then(() => rpc.meetings.status())
        .then((meetings) => {
          if (mounted.current) setData((prev) => ({ ...prev, meetings }));
        })
        .catch(() => undefined);
    }, 5000);
    return () => clearInterval(timer);
  }, [syncing]);

  return { ...data, refresh };
}

/** Agents that can use a connection, for the avatar stack. The server decides; the web does not. */
export function agentsFor(bots: Bot[], access: ConnectionAccessState | undefined): Bot[] {
  if (!access) return [];
  const ids = new Set(access.effectiveAccess.botIds);
  return bots.filter((bot) => ids.has(bot.id));
}
