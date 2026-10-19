import {
  integrationAgentSpawnKey,
  isCartaAgentSpawnKey,
  isFinanceAgentSpawnKey,
  isInboxAgentSpawnKey,
  isIntegrationAgentSpawnKey,
  isLegalAgentSpawnKey,
  isVoiceAgentSpawnKey,
} from "@rakazo/contracts";

/** A connection row as the access rules read it. `botAccess` lists the grants being considered. */
export type ConnectionAccessRow = {
  id: string;
  connectorId: string;
  provider: string;
  status: string;
  allAgents: boolean;
  agentBotId: string | null;
  /** Set when Rakazo made the connection private to its own agent on connect. */
  agentProvisionedAt?: Date | null;
  botAccess: { botId: string }[];
};

/** A connection limited to chosen agents is usable only by a bot with an access row. */
export function botMayUseConnection(row: {
  allAgents: boolean;
  botAccess: { botId: string }[];
}): boolean {
  return row.allAgents || row.botAccess.length > 0;
}

/** Whether the bot works with Composio, Pipedream and other connector tools at all. */
export function botUsesConnectorTools(spawnKey: string | null | undefined): boolean {
  return !(
    isInboxAgentSpawnKey(spawnKey) ||
    isFinanceAgentSpawnKey(spawnKey) ||
    isLegalAgentSpawnKey(spawnKey) ||
    isVoiceAgentSpawnKey(spawnKey) ||
    isCartaAgentSpawnKey(spawnKey) ||
    isIntegrationAgentSpawnKey(spawnKey)
  );
}

/** Whether the bot is offered the built-in mail, calendar and Drive tools of native Google. */
export function botUsesNativeGoogle(spawnKey: string | null | undefined): boolean {
  return !(isIntegrationAgentSpawnKey(spawnKey) || isVoiceAgentSpawnKey(spawnKey));
}

/** The rule the executor applies before access rows: can this bot's identity reach the connection. */
export function botCanReachConnection(
  bot: { id: string; spawnKey: string | null },
  row: { id: string; connectorId: string; agentBotId: string | null },
): boolean {
  // A connected-app agent works on its own linked connection only; a Calendar or Drive agent
  // uses the built-in tools of that one native Google account.
  if (row.agentBotId === bot.id && bot.spawnKey === integrationAgentSpawnKey(row.id)) return true;
  return row.connectorId === "google"
    ? botUsesNativeGoogle(bot.spawnKey)
    : botUsesConnectorTools(bot.spawnKey);
}

/**
 * Connections the bot may not use. Only connected rows count: a pending or errored row never
 * denies anything, so an abandoned second account cannot block a shared one.
 * - Ordinary rows (no linked agent) keep the app-wide rule: if any connected account of an app is
 *   limited to other agents, every live account of that app is denied, so no sibling stands in.
 * - Provisioned connections that lost their agent are denied one by one too.
 * - Agent-linked native Google rows are denied one by one: an exclusive account never denies its
 *   siblings, because the Google built-in tools check the account id of every call. Every other
 *   connector keeps the app-wide rule, because Composio and Pipedream can resolve an account the
 *   run did not pick.
 */
export function deniedConnectionIds(rows: ConnectionAccessRow[]): Set<string> {
  const appKey = (row: { connectorId: string; provider: string }) =>
    `${row.connectorId}\u0000${row.provider}`;
  const live = rows.filter((row) => row.status !== "revoked");
  const perConnection = (row: ConnectionAccessRow) =>
    (row.connectorId === "google" && row.agentBotId !== null) ||
    // A private connection whose agent is gone stands alone: it never denies, or is shared with,
    // its siblings.
    (row.agentProvisionedAt != null && row.agentBotId === null);
  const deniedApps = new Set(
    live
      .filter(
        (row) => row.status === "connected" && !perConnection(row) && !botMayUseConnection(row),
      )
      .map(appKey),
  );
  return new Set(
    live
      .filter((row) =>
        perConnection(row)
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
      if (row.status !== "connected" || !botCanReachConnection(bot, row)) continue;
      // The executor hands a connected-app agent its own linked connection directly, so the
      // app-wide denial of a sibling account does not apply to it.
      const own = row.agentBotId === bot.id && row.connectorId !== "google";
      if (own ? !botMayUseConnection(row) : denied.has(row.id)) continue;
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
