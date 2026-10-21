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
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";

/** The stored grant, which the access switches edit and save. */
export type ConnectionAccess = { allAgents: boolean; botIds: string[] };
/** The stored grant plus who can really use the connection, as computed by the server. */
export type ConnectionAccessState = ConnectionAccess & {
  effectiveAccess: { shared: "all" | "some" | "none"; botIds: string[] };
};

export type IntegrationsData = {
  loaded: boolean;
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

/** Everything the Integrations pages show, loaded together and refreshed after any change. */
export function useIntegrations(): IntegrationsData {
  const { t } = useLingui();
  // useLingui returns a fresh t each render; keep refresh stable so its effect runs once.
  const loadFailed = useRef(t`Could not load integrations`);
  loadFailed.current = t`Could not load integrations`;
  const [data, setData] = useState<Omit<IntegrationsData, "refresh">>({
    loaded: false,
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
  });
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
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
      setData({
        loaded: true,
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
      });
    } catch (err) {
      if (mounted.current)
        setData((prev) => ({
          ...prev,
          loaded: true,
          error: errorText(err, loadFailed.current),
        }));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { ...data, refresh };
}

/** Agents that can use a connection, for the avatar stack. The server decides; the web does not. */
export function agentsFor(bots: Bot[], access: ConnectionAccessState | undefined): Bot[] {
  if (!access) return [];
  const ids = new Set(access.effectiveAccess.botIds);
  return bots.filter((bot) => ids.has(bot.id));
}
