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
import { authClient } from "../../lib/auth";
import { desktopBridge, nativeGoogleAvailable } from "../../lib/desktop";
import { optionalCatalogFeedProbe } from "../../lib/optional-catalog-feed";
import { rpc, selectedSpaceId } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";

/** The stored grant, which the access switches edit and save. */
/** What the toggles save. */
export type AccessValue = { allAgents: boolean; botIds: string[] };
/** The server's answer; agentShared is the "Let other agents use it" switch. */
export type ConnectionAccess = AccessValue & {
  agentShared: boolean;
  /** Granted agents that may also make changes (each still asks), while the connection allows changes. */
  writeBotIds?: string[];
};
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
  /** The Granola status request failed, so `meetings` is unknown rather than "never connected". */
  meetingsFailed: boolean;
  /** The app catalog request failed, which is different from a server with no catalog. */
  catalogFailed: boolean;
  /** The server offers the by-domain catalog search. */
  feedEnabled: boolean;
  /** The deployment runs stdio MCP servers, so the local-command route is offered. */
  mcpStdioEnabled?: boolean;
  refresh: () => Promise<void>;
};

const EMPTY: Omit<IntegrationsData, "refresh"> = {
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
  mcpStdioEnabled: false,
  catalogFailed: false,
  meetingsFailed: false,
};

/** Everything the Integrations pages show, loaded together and refreshed after any change. */
export function useIntegrations(): IntegrationsData {
  const { t } = useLingui();
  // useLingui returns a fresh t each render; keep refresh stable so its effect runs once.
  const loadFailed = useRef(t`Could not load integrations`);
  loadFailed.current = t`Could not load integrations`;
  const [data, setData] = useState<Omit<IntegrationsData, "refresh">>(EMPTY);
  // Who and which Space this data belongs to. A response for anyone else is dropped.
  const userId = authClient.useSession().data?.user?.id ?? null;
  const owner = `${userId}:${selectedSpaceId()}`;
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  const latest = useRef(0);
  const [dataOwner, setDataOwner] = useState(owner);
  if (dataOwner !== owner) {
    setDataOwner(owner);
    setData(EMPTY);
  }
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    const requestedFor = ownerRef.current;
    const request = ++latest.current;
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
        me,
      ] = await Promise.all([
        rpc.connections.catalog({}).catch(() => null),
        rpc.connections.list(),
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
          .then((value) => ({ value }))
          .catch(() => null),
        Promise.resolve()
          .then(() => rpc.me())
          .catch(() => null),
      ]);
      const live = connections.filter((row) => row.status !== "revoked");
      const [effective, accessById] = await Promise.all([
        rpc.connections.effectiveAccess(),
        rpc.connections.accessAll(),
      ]);
      const access = Object.fromEntries(
        live.flatMap((row) => {
          const own = accessById[row.id];
          return own
            ? [
                [
                  row.id,
                  { ...own, effectiveAccess: effective[row.id] ?? { shared: "none", botIds: [] } },
                ],
              ]
            : [];
        }),
      );
      if (!mounted.current || ownerRef.current !== requestedFor || request !== latest.current)
        return;
      window.dispatchEvent(new Event(INTEGRATIONS_CHANGED_EVENT));
      const meetingsFailed = meetings === null;
      setData((prev) => ({
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
        // A failed call keeps the status already shown; it is not "never connected".
        meetings: meetings ? meetings.value : prev.meetings,
        meetingsFailed,
        feedEnabled: feed.enabled,
        mcpStdioEnabled: me?.mcpStdioEnabled === true,
      }));
    } catch (err) {
      if (mounted.current && ownerRef.current === requestedFor && request === latest.current)
        setData((prev) => ({
          ...prev,
          loaded: true,
          error: errorText(err, loadFailed.current),
        }));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, owner]);

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
