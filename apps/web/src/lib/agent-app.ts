import type { Connection, ConnectionCatalogItem, McpServer } from "@rakazo/contracts";
import { isCartaAgentSpawnKey, isIntegrationAgentSpawnKey } from "@rakazo/contracts";
import { useEffect, useState } from "react";
import { FINANCE_PROVIDERS, FIRST_PARTY_MCP, isSameMcpEndpoint } from "./integrations";
import { rpc } from "./rpc";

export type AgentApp = { name: string; logo: string | null };
export type AgentAppData = {
  connections: Pick<Connection, "provider" | "displayName" | "agentBotId">[];
  servers: Pick<McpServer, "name" | "endpoint" | "agentBotId">[];
  catalog: Pick<ConnectionCatalogItem, "slug" | "name" | "logo">[];
};

const slugKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");

/** The app an integration agent owns, for its avatar. Inbox and ordinary bots keep their own face. */
export function agentApp(
  bot: { id: string; spawnKey: string | null },
  data: AgentAppData,
): AgentApp | undefined {
  if (!isIntegrationAgentSpawnKey(bot.spawnKey) && !isCartaAgentSpawnKey(bot.spawnKey)) {
    return undefined;
  }
  const connection = data.connections.find((row) => row.agentBotId === bot.id);
  if (connection) {
    const app = data.catalog.find((item) => slugKey(item.slug) === slugKey(connection.provider));
    return { name: app?.name ?? connection.provider, logo: app?.logo ?? null };
  }
  const server = data.servers.find((row) => row.agentBotId === bot.id);
  if (server) {
    const known =
      FIRST_PARTY_MCP.find((entry) => isSameMcpEndpoint(server.endpoint, entry.endpoint)) ??
      FINANCE_PROVIDERS.find((entry) => slugKey(entry.name) === slugKey(server.name));
    return { name: server.name, logo: known?.logo ?? null };
  }
  return undefined;
}

type SpaceData = AgentAppData & { bots: { id: string; spawnKey: string | null }[] };

/** Fired after the integrations or their agents change, so cached logos are looked up again. */
export const INTEGRATIONS_CHANGED_EVENT = "rakazo:integrations-changed";

// One lookup per user and space. A failed lookup is dropped so the next render tries again.
const cache = new Map<string, Promise<SpaceData>>();

export function clearAgentAppCache() {
  cache.clear();
}

if (typeof window !== "undefined") {
  window.addEventListener(INTEGRATIONS_CHANGED_EVENT, clearAgentAppCache);
}

function loadSpace(userId: string, spaceId: string): Promise<SpaceData> {
  const key = `${userId}:${spaceId}`;
  let found = cache.get(key);
  if (!found) {
    const context = { context: { spaceId } };
    found = (async () => {
      const bots = await rpc.bots.list(undefined, context);
      const none = { connections: [], servers: [], catalog: [], bots };
      if (!bots.some((bot) => agentSpawnKey(bot.spawnKey))) return none;
      const [connections, servers, catalog] = await Promise.all([
        rpc.connections.list(undefined, context),
        rpc.mcp.servers.list(undefined, context),
        rpc.connections.catalog({}, context),
      ]);
      return { connections, servers, catalog, bots };
    })();
    cache.set(key, found);
    found.catch(() => {
      if (cache.get(key) === found) cache.delete(key);
    });
  }
  return found;
}

const agentSpawnKey = (spawnKey: string | null) =>
  isIntegrationAgentSpawnKey(spawnKey) || isCartaAgentSpawnKey(spawnKey);

/** Looks up the app behind each integration agent's bot in the given spaces. */
export function useAgentApp(userId: string | null | undefined, spaceIds: readonly string[]) {
  const [data, setData] = useState<Record<string, SpaceData>>({});
  const [version, setVersion] = useState(0);
  const spaces = spaceIds.join(",");
  useEffect(() => {
    const bump = () => setVersion((n) => n + 1);
    window.addEventListener(INTEGRATIONS_CHANGED_EVENT, bump);
    return () => window.removeEventListener(INTEGRATIONS_CHANGED_EVENT, bump);
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: version re-runs the lookup after a change
  useEffect(() => {
    setData({});
    if (!userId) return;
    let live = true;
    for (const spaceId of spaces.split(",").filter(Boolean)) {
      loadSpace(userId, spaceId).then(
        (loaded) => live && setData((prev) => ({ ...prev, [spaceId]: loaded })),
        () => undefined,
      );
    }
    return () => {
      live = false;
    };
  }, [userId, spaces, version]);
  return (botId: string, spaceId: string) => {
    const space = data[spaceId];
    const bot = space?.bots.find((row) => row.id === botId);
    return space && bot ? agentApp(bot, space) : undefined;
  };
}
