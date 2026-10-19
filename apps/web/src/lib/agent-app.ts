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

let loaded: Promise<AgentAppData> | undefined;

function loadAgentAppData(): Promise<AgentAppData> {
  loaded ??= Promise.all([
    rpc.connections.list().catch(() => []),
    rpc.mcp.servers.list().catch(() => []),
    rpc.connections.catalog({}).catch(() => []),
  ])
    .then(([connections, servers, catalog]) => ({ connections, servers, catalog }))
    .catch(() => {
      loaded = undefined;
      return { connections: [], servers: [], catalog: [] };
    });
  return loaded;
}

/** Looks up the app behind an integration agent's bot; undefined until loaded or for other bots. */
export function useAgentApp(bots: readonly { id: string; spawnKey: string | null }[]) {
  const [data, setData] = useState<AgentAppData>();
  const needed = bots.some(
    (bot) => isIntegrationAgentSpawnKey(bot.spawnKey) || isCartaAgentSpawnKey(bot.spawnKey),
  );
  useEffect(() => {
    if (needed) void loadAgentAppData().then(setData);
  }, [needed]);
  return (botId: string) => {
    const bot = bots.find((row) => row.id === botId);
    return data && bot ? agentApp(bot, data) : undefined;
  };
}
