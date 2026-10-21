import {
  integrationAgentSpawnKey,
  isCartaAgentSpawnKey,
  isDataRoomAgentSpawnKey,
  isFinanceAgentSpawnKey,
  isIntegrationAgentSpawnKey,
  isLegalAgentSpawnKey,
  isMailAgentSpawnKey,
  isVoiceAgentSpawnKey,
} from "@rakazo/contracts";

export type StatusKind = "connected" | "reconnect" | "failed" | "connecting";

/** Status of one managed app, from all of its account rows. A working account wins. */
export function appStatus(
  rows: readonly { status: string; needsReconnect?: boolean }[],
): StatusKind | null {
  const live = rows.filter((row) => row.status === "connected");
  if (live.some((row) => !row.needsReconnect)) return "connected";
  // Every account is connected on paper, but its provider refuses the sign-in.
  if (live.length > 0) return "reconnect";
  if (rows.some((row) => row.status === "pending")) return "connecting";
  if (rows.some((row) => row.status === "error")) return "failed";
  return null;
}

/** A connection row as the access rules read it. `botAccess` lists the grants being considered. */
export type ConnectionAccessRow = {
  id: string;
  connectorId: string;
  provider: string;
  status: string;
  allAgents: boolean;
  agentBotId: string | null;
  /** Created private to its own agent: always scoped on its own, never grouped with siblings. */
  privateByDefault?: boolean;
  botAccess: { botId: string }[];
};

/**
 * What an external bot sees of the connection rows: "all agents" does not reach it, only an
 * explicit access row does. Every place that reads connection rows for a run applies this.
 */
export function connectionRowsForAudience<T extends { allAgents: boolean }>(
  rows: T[],
  audience: string | null | undefined,
): T[] {
  return audience === "external" ? rows.map((row) => ({ ...row, allAgents: false })) : rows;
}

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
    isMailAgentSpawnKey(spawnKey) ||
    isFinanceAgentSpawnKey(spawnKey) ||
    isLegalAgentSpawnKey(spawnKey) ||
    isDataRoomAgentSpawnKey(spawnKey) ||
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
  row: { id: string; connectorId: string; agentBotId: string | null; provider?: string },
): boolean {
  // A connected-app agent works on its own linked connection only; a Calendar or Drive agent
  // uses the built-in tools of that one native Google account.
  if (row.agentBotId === bot.id && bot.spawnKey === integrationAgentSpawnKey(row.id)) return true;
  // The Inbox agent and an email's own agent read every Gmail account with the built-in mail tools, whatever the connector.
  if (row.provider?.toLowerCase() === "gmail" && isMailAgentSpawnKey(bot.spawnKey)) return true;
  return row.connectorId === "google"
    ? botUsesNativeGoogle(bot.spawnKey)
    : botUsesConnectorTools(bot.spawnKey);
}

/**
 * Connections the bot may not use. Only connected rows count: a pending or errored row never
 * denies anything, so an abandoned second account cannot block a shared one.
 * - Ordinary rows (no linked agent) keep the app-wide rule: if any connected account of an app is
 *   limited to other agents, every live account of that app is denied, so no sibling stands in.
 * - Agent-linked or private native Google rows are denied one by one: an exclusive account never denies its
 *   siblings, because the Google built-in tools check the account id of every call. Every other
 *   connector keeps the app-wide rule, because Composio and Pipedream can resolve an account the
 *   run did not pick.
 */
export function deniedConnectionIds(rows: ConnectionAccessRow[]): Set<string> {
  const appKey = (row: { connectorId: string; provider: string }) =>
    `${row.connectorId}\u0000${row.provider}`;
  const live = rows.filter((row) => row.status !== "revoked");
  // Only native Google dispatch is pinned to one account. Composio and Pipedream can resolve an
  // account the run did not pick (Pipedream's ordinary routes send no account id), so a limited
  // or private account there keeps denying the whole app, as it always has.
  const perConnection = (row: ConnectionAccessRow) =>
    row.connectorId === "google" && (row.agentBotId !== null || row.privateByDefault === true);
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
  bots: { id: string; spawnKey: string | null; archivedAt: Date | null; audience?: string }[],
): Record<string, EffectiveAccess> {
  const active = bots.filter((bot) => !bot.archivedAt);
  const usable = new Map<string, string[]>(rows.map((row) => [row.id, []]));
  for (const bot of active) {
    const own = connectionRowsForAudience(
      rows.map((row) => ({
        ...row,
        botAccess: row.botAccess.filter((entry) => entry.botId === bot.id),
      })),
      bot.audience,
    );
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
