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
} from "@rakazo/contracts";
import {
  isCartaAgentSpawnKey,
  isIntegrationAgentSpawnKey,
  preferNativeGoogle,
} from "@rakazo/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { desktopBridge, nativeGoogleAvailable } from "../../lib/desktop";
import { optionalCatalogFeedProbe } from "../../lib/optional-catalog-feed";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";

export type ConnectionAccess = { allAgents: boolean; botIds: string[] };

export type IntegrationsData = {
  loaded: boolean;
  error: string | null;
  catalog: ConnectionCatalogItem[];
  connections: Connection[];
  servers: McpServer[];
  bots: Bot[];
  mcpAssignments: BotMcpServer[];
  access: Record<string, ConnectionAccess>;
  sources: CapabilityInstall[];
  /** Mercury and Brex, the first-party Finance integrations. */
  financeSources: FinanceSource[];
  setup: IntegrationSetupState | null;
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
      const [catalog, connections, servers, bots, mcpAssignments, installs, setup, feed, finance] =
        await Promise.all([
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
        ]);
      const live = connections.filter((row) => row.status !== "revoked");
      const access = Object.fromEntries(
        await Promise.all(
          live.map(
            async (row) =>
              [
                row.id,
                await rpc.connections
                  .access({ connectionId: row.id })
                  .catch((): ConnectionAccess => ({ allAgents: true, botIds: [] })),
              ] as const,
          ),
        ),
      );
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

type OwnBotIds = string | null | undefined | readonly (string | null | undefined)[];

/**
 * An integration agent works only with its own connection or server, so it is not offered on any
 * other, even when that account is shared with all agents. `own` is the agent(s) that belong here.
 * The Carta agent is the same for MCP servers, but its built-in mail, calendar and Drive tools do
 * reach shared Google connections, so connection lists pass `keepCarta` and still show it.
 */
export function withoutOtherIntegrationAgents(
  bots: Bot[],
  own?: OwnBotIds,
  { keepCarta = false } = {},
): Bot[] {
  const ownIds = Array.isArray(own) ? own : [own];
  return bots.filter(
    (bot) =>
      ownIds.includes(bot.id) ||
      !(
        isIntegrationAgentSpawnKey(bot.spawnKey) ||
        (!keepCarta && isCartaAgentSpawnKey(bot.spawnKey))
      ),
  );
}

/** Agents that can use a connection, for the avatar stack. */
export function agentsFor(
  bots: Bot[],
  access: ConnectionAccess | undefined,
  own?: OwnBotIds,
): Bot[] {
  if (!access) return [];
  const usable = withoutOtherIntegrationAgents(bots, own, { keepCarta: true });
  return access.allAgents ? usable : usable.filter((bot) => access.botIds.includes(bot.id));
}
