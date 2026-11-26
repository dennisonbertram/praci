import {
  inboxAgentSpawnKey,
  integrationAgentSpawnKey,
  isInboxAgentSpawnKey,
  isIntegrationAgentSpawnKey,
  isMailAgentSpawnKey,
  isMailThreadAgentSpawnKey,
  pageAgentDefOf,
} from "@rakazo/contracts";

export type StatusKind = "connected" | "reconnect" | "failed" | "connecting";

/** Status of one managed app, from all of its account rows. Any signed-out account shows as reconnect. */
export function appStatus(
  rows: readonly { status: string; needsReconnect?: boolean }[],
): StatusKind | null {
  const live = rows.filter((row) => row.status === "connected");
  // Connected on paper, but a provider refuses at least one account's sign-in.
  if (live.some((row) => row.needsReconnect)) return "reconnect";
  if (live.length > 0) return "connected";
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
 * What an external or firewalled bot sees of the connection rows: "all agents" does not reach it,
 * only an explicit access row does. Every place that reads connection rows for a run applies this.
 */
export function connectionRowsForAudience<T extends { allAgents: boolean }>(
  rows: T[],
  audience: string | null | undefined,
  firewall?: boolean,
): T[] {
  return audience === "external" || firewall === true
    ? rows.map((row) => ({ ...row, allAgents: false }))
    : rows;
}

/**
 * Whether a bot that is NOT the connection's own agent may make changes on an agent-linked
 * connection: only with its own write grant, only while the connection's changes switch is on, and
 * never for an external bot. `botAccess` holds the grants being considered for this bot.
 */
export function nonOwnerMayWrite(
  row: { writesEnabled?: boolean; botAccess: { canWrite?: boolean }[] },
  bot: { audience?: string | null },
): boolean {
  return (
    row.writesEnabled === true &&
    bot.audience !== "external" &&
    row.botAccess.some((entry) => entry.canWrite === true)
  );
}

/** Built-in Google tools that change something. Only these follow an agent-linked connection's write rule. */
export const GOOGLE_BUILTIN_WRITES: ReadonlySet<string> = new Set([
  "mail_draft",
  "mail_modify",
  "mail_send",
  "mail_reply_batch",
  "calendar_create_event",
  "calendar_update_event",
  "calendar_delete_event",
  "drive_create_file",
  "drive_update_file",
]);

/**
 * Whether this bot may use the built-in Google tool on the account now. The account must exist in
 * the rows read for this bot, be connected and be open to it; a write on an agent-linked connection
 * also follows the agent rule. Rows are read fresh by the caller, so a changed switch applies.
 */
export function accountAllowedIn<
  T extends ConnectionAccessRow & {
    writesEnabled?: boolean;
    botAccess: { botId: string; canWrite?: boolean }[];
  },
>(
  rows: T[],
  accountId: string,
  toolName: string,
  bot: { id: string; audience?: string | null },
): boolean {
  const row = rows.find((candidate) => candidate.id === accountId);
  if (!row || row.status !== "connected" || deniedConnectionIds(rows).has(row.id)) return false;
  if (!GOOGLE_BUILTIN_WRITES.has(toolName) || row.agentBotId === null) return true;
  if (row.agentBotId === bot.id) return row.writesEnabled === true;
  // Another agent changes it only with its own write grant, still asking before each change.
  return nonOwnerMayWrite(row, bot);
}

/** A connection limited to chosen agents is usable only by a bot with an access row. */
export function botMayUseConnection(row: {
  allAgents: boolean;
  botAccess: { botId: string }[];
}): boolean {
  return row.allAgents || row.botAccess.length > 0;
}

/**
 * The access rows a run reads for its bot. An email's own agent has exactly the Inbox agent's
 * permissions, so it reads the Inbox agent's rows ALONE. Its own rows are ignored: combining the
 * two could grant it an account that the Inbox agent is denied.
 */
export function connectionAccessFilter(bot: {
  id: string;
  userId: string;
  spawnKey: string | null;
}) {
  return isMailThreadAgentSpawnKey(bot.spawnKey)
    ? { bot: { spawnKey: inboxAgentSpawnKey(bot.userId) } }
    : { botId: bot.id };
}

/**
 * For an email's own agent, a connection whose agent is the Inbox agent is linked to it too, so it
 * may make the changes the Inbox agent may (the write rule compares `agentBotId` with the bot).
 */
export function withInboxAgentStandIn<
  T extends { agentBotId: string | null; agentBot?: { spawnKey: string | null } | null },
>(row: T, bot: { id: string; spawnKey: string | null }): T {
  return isMailThreadAgentSpawnKey(bot.spawnKey) && isInboxAgentSpawnKey(row.agentBot?.spawnKey)
    ? { ...row, agentBotId: bot.id }
    : row;
}

/** Whether the bot works with Composio, Pipedream and other connector tools at all. */
export function botUsesConnectorTools(spawnKey: string | null | undefined): boolean {
  return !(
    isMailAgentSpawnKey(spawnKey) ||
    isIntegrationAgentSpawnKey(spawnKey) ||
    pageAgentDefOf(spawnKey)?.connectorTools === false
  );
}

/** Whether the bot is offered the built-in mail, calendar and Drive tools of native Google. */
export function botUsesNativeGoogle(spawnKey: string | null | undefined): boolean {
  return !(
    isIntegrationAgentSpawnKey(spawnKey) || pageAgentDefOf(spawnKey)?.nativeGoogle === false
  );
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
  bots: {
    id: string;
    spawnKey: string | null;
    archivedAt: Date | null;
    audience?: string;
    firewall?: boolean;
  }[],
): Record<string, EffectiveAccess> {
  const active = bots.filter((bot) => !bot.archivedAt);
  // An email's own agent is judged by the Inbox agent's grants alone, as the executor reads them.
  const inboxId = bots.find((bot) => isInboxAgentSpawnKey(bot.spawnKey))?.id;
  const usable = new Map<string, string[]>(rows.map((row) => [row.id, []]));
  for (const bot of active) {
    const grantee = isMailThreadAgentSpawnKey(bot.spawnKey) ? inboxId : bot.id;
    const own = connectionRowsForAudience(
      rows.map((row) => ({
        ...row,
        botAccess: row.botAccess.filter((entry) => entry.botId === grantee),
      })),
      bot.audience,
      bot.firewall,
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

/**
 * What a bot may do with a directly connected source (MCP, API or GraphQL install). The source's
 * own agent reads it; every other internal agent needs "all agents" or its own grant. A change
 * needs the source's "Allow changes" switch, and for a non-owner either "all agents" or its own
 * write grant. External and firewalled bots get nothing, like the "all agents" rule on connections.
 */
export function sourceAccessFor(
  source: {
    agentBotId: string | null;
    allAgents: boolean;
    writesEnabled: boolean;
    botAccess: { botId: string; canWrite: boolean }[];
  },
  bot: { id: string; audience?: string | null; firewall?: boolean },
): { read: boolean; write: boolean } {
  if (bot.audience === "external" || bot.firewall === true) return { read: false, write: false };
  if (source.agentBotId === bot.id) return { read: true, write: source.writesEnabled };
  const grant = source.botAccess.find((entry) => entry.botId === bot.id);
  if (grant) return { read: true, write: source.writesEnabled && grant.canWrite };
  return source.allAgents
    ? { read: true, write: source.writesEnabled }
    : { read: false, write: false };
}
