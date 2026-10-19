import { isIntegrationAgentSpawnKey } from "@rakazo/contracts";

/** A connection row as the access rules read it. `botAccess` lists the grants being considered. */
export type ConnectionAccessRow = {
  id: string;
  connectorId: string;
  provider: string;
  status: string;
  allAgents: boolean;
  agentBotId: string | null;
  botAccess: { botId: string }[];
};

/** A connection limited to chosen agents is usable only by a bot with an access row. */
export function botMayUseConnection(row: {
  allAgents: boolean;
  botAccess: { botId: string }[];
}): boolean {
  return row.allAgents || row.botAccess.length > 0;
}

/**
 * Connections the bot may not use. Only connected rows count: a pending or errored row never
 * denies anything, so an abandoned second account cannot block a shared one.
 * - Ordinary rows (no linked agent) keep the app-wide rule: if any connected account of an app is
 *   limited to other agents, every live account of that app is denied, so no sibling stands in.
 * - Agent-linked rows are denied one by one: an exclusive account never denies its siblings.
 */
export function deniedConnectionIds(rows: ConnectionAccessRow[]): Set<string> {
  const appKey = (row: { connectorId: string; provider: string }) =>
    `${row.connectorId}\u0000${row.provider}`;
  const live = rows.filter((row) => row.status !== "revoked");
  const deniedApps = new Set(
    live
      .filter((row) => row.status === "connected" && !row.agentBotId && !botMayUseConnection(row))
      .map(appKey),
  );
  return new Set(
    live
      .filter((row) =>
        row.agentBotId
          ? row.status === "connected" && !botMayUseConnection(row)
          : deniedApps.has(appKey(row)),
      )
      .map((row) => row.id),
  );
}

export type EffectiveAccess = { shared: "all" | "some" | "none"; botIds: string[] };

/**
 * The agents that can really use each connection, with the same rules the executor applies per
 * run. `rows` carry every access grant; each bot is judged with only its own grants.
 */
export function effectiveAccessByConnection(
  rows: ConnectionAccessRow[],
  bots: { id: string; spawnKey: string | null; archivedAt: Date | null }[],
): Record<string, EffectiveAccess> {
  const active = bots.filter((bot) => !bot.archivedAt);
  const usable = new Map<string, string[]>(rows.map((row) => [row.id, []]));
  for (const bot of active) {
    const own = rows.map((row) => ({
      ...row,
      botAccess: row.botAccess.filter((entry) => entry.botId === bot.id),
    }));
    const denied = deniedConnectionIds(own);
    for (const row of own) {
      if (row.status !== "connected" || denied.has(row.id)) continue;
      // An integration agent works only on its own connection.
      if (isIntegrationAgentSpawnKey(bot.spawnKey) && row.agentBotId !== bot.id) continue;
      usable.get(row.id)?.push(bot.id);
    }
  }
  return Object.fromEntries(
    rows.map((row) => {
      const botIds = usable.get(row.id) ?? [];
      const shared = botIds.length === 0 ? "none" : row.allAgents ? "all" : "some";
      return [row.id, { shared, botIds }];
    }),
  );
}
