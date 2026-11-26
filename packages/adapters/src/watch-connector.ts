import type {
  AdapterContext,
  ConnectorCall,
  ConnectorProvider,
  ConnectorTool,
} from "@rakazo/adapter-kit";
import type { ConnectorWatchSpec } from "@rakazo/contracts";
import { isGtmAgentSpawnKey } from "@rakazo/contracts";
import {
  botCanReachConnection,
  botUsesConnectorTools,
  connectionAccessFilter,
  connectionRowsForAudience,
  connectorToolRequiresApproval,
  deniedConnectionIds,
  stableJsonText,
  toolRequiresExplicitApproval,
  withInboxAgentStandIn,
} from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";
import { builtinAgentTools } from "./builtin-tools.js";
import { CHANGED_TO_WRITE_MESSAGE } from "./composio-connector.js";
import { connectionDenial } from "./connection-denial.js";
import {
  assertConnectorToolArgs,
  CATALOG_EXECUTE,
  isLazyCatalogControlRoute,
} from "./lazy-tool-catalog.js";
import { isMeetingSourceAgent } from "./meeting-tools.js";

/**
 * Connected-app watches. A watch stores a pointer to one tool of one connector and fixed
 * arguments. Nothing about it is trusted at check time: every check (and the creation) resolves
 * the bot's connections, the tool and its declared effect again, the way the executor does for a
 * model's tool call, and runs the same connection authorization before the provider call.
 */

export const WATCH_CONNECTOR_TIMEOUT_MS = 15_000;
// Same cap as a page body: the fingerprint covers this much, the stored snapshot is cut to 16 KB.
const WATCH_RESULT_MAX_CHARS = 2 * 1024 * 1024;

/** `access` pauses the watch at once; `transient` backs off and retries. */
export type ConnectorWatchFailure = { kind: "transient" | "access"; message: string };

type Scope = { spaceId: string; userId: string; botId: string };
type Db = Pick<PrismaClient, "bot" | "connection" | "mcpServer">;

const denied = (message: string): { ok: false } & ConnectorWatchFailure => ({
  ok: false,
  kind: "access",
  message,
});

const BUILTIN_TOOL_NAMES = new Set(builtinAgentTools.map((tool) => tool.name));

/**
 * Whether a connector tool may be watched: a plain read by the connector-specific rule, never a
 * built-in name, and never one the connector declares a write (readOnly or readOnlyHint false).
 * For watches only, a camelCase read name (getAccounts, listTransactions) counts like get_accounts;
 * the shared approval classifier used by chat and background runs is not changed.
 */
export function watchToolIsRead(tool: {
  name: string;
  readOnly?: boolean;
  readOnlyHint?: boolean;
}): boolean {
  if (BUILTIN_TOOL_NAMES.has(tool.name) || toolRequiresExplicitApproval(tool.name)) return false;
  if (tool.readOnly === false || tool.readOnlyHint === false) return false;
  return !connectorToolRequiresApproval(
    tool.name.replace(/([a-z0-9])([A-Z])/g, "$1_$2"),
    tool.readOnly,
  );
}

/**
 * The tool a spec points at, only if the bot may use it now and it is a plain read. Without a
 * connectorId (at creation, when the bot has only named the tool) it looks across every
 * connection the bot may use and returns the route it finds.
 */
export async function resolveWatchTool(
  prisma: Db,
  connector: ConnectorProvider,
  scope: Scope,
  spec: { toolName: string; arguments?: Record<string, unknown> } & Partial<
    Pick<ConnectorWatchSpec, "connectorId" | "connectionId" | "resourceId">
  >,
  signal: AbortSignal,
  operationId: string,
) {
  const bot = await prisma.bot.findFirst({
    where: { id: scope.botId, spaceId: scope.spaceId, userId: scope.userId, archivedAt: null },
    select: {
      id: true,
      spawnKey: true,
      audience: true,
      firewall: true,
      userId: true,
      spaceId: true,
      archivedAt: true,
    },
  });
  if (!bot) return denied("The bot is no longer available.");
  if (
    !botUsesConnectorTools(bot.spawnKey) ||
    isGtmAgentSpawnKey(bot.spawnKey) ||
    (await isMeetingSourceAgent(bot, { prisma }))
  ) {
    return denied("This bot cannot watch a connected app.");
  }
  const rows = (
    await prisma.connection.findMany({
      where: { userId: scope.userId, spaceId: scope.spaceId },
      select: {
        id: true,
        connectorId: true,
        provider: true,
        providerRef: true,
        displayName: true,
        status: true,
        allAgents: true,
        agentBotId: true,
        privateByDefault: true,
        botAccess: { where: connectionAccessFilter(bot), select: { botId: true } },
        agentBot: { select: { spawnKey: true } },
      },
    })
  ).map((row) => withInboxAgentStandIn(row, bot));
  const deniedIds = deniedConnectionIds(
    connectionRowsForAudience(rows, bot.audience, bot.firewall),
  );
  // A connection linked to an agent is not offered to an ordinary bot's watch at all.
  const usable = rows.filter(
    (row) =>
      row.status === "connected" &&
      !deniedIds.has(row.id) &&
      row.agentBotId === null &&
      botCanReachConnection(bot, row),
  );
  if (spec.connectionId && !usable.some((row) => row.id === spec.connectionId)) {
    return denied("The connected account is no longer available to this bot.");
  }
  // Same scoping as a run: the connections this bot may use, and (for MCP) only the one server.
  const connections = spec.connectionId
    ? usable.filter((row) => row.id === spec.connectionId)
    : spec.connectorId
      ? usable.filter((row) => row.connectorId === spec.connectorId)
      : usable;
  const context: AdapterContext = {
    operationId,
    traceId: operationId,
    spaceId: scope.spaceId,
    userId: scope.userId,
    botId: bot.id,
    signal,
    connectedConnections: connections.map((row) => ({
      id: row.id,
      connectorId: row.connectorId,
      externalId: row.provider,
      displayName: row.displayName,
      providerRef: row.providerRef ?? undefined,
    })),
    connectedProviders: connections
      .filter((row) => row.connectorId === "composio")
      .map((row) => row.provider),
    ...(spec.resourceId ? { mcpServerIds: [spec.resourceId] } : {}),
  };
  const discovered = await connector.discoverTools(
    context,
    spec.connectorId ? [spec.connectorId] : undefined,
  );
  const sameRoute = (candidate: ConnectorTool) =>
    !spec.connectorId ||
    (candidate.route?.connectorId === spec.connectorId &&
      candidate.route.connectionId === spec.connectionId &&
      candidate.route.resourceId === spec.resourceId);
  let tool = discovered.find(
    (candidate) =>
      candidate.name === spec.toolName &&
      !isLazyCatalogControlRoute(candidate.route) &&
      sameRoute(candidate),
  );
  let args: Record<string, unknown> | undefined;
  if (!tool && connector.resolveCall) {
    // A connector with many tools offers a lazy catalog: the same lookup the executor makes for
    // a call to its "execute" wrapper, which names the one underlying tool and checks the arguments.
    for (const wrapper of discovered) {
      if (!wrapper.route || wrapper.route.toolName !== CATALOG_EXECUTE) continue;
      if (!isLazyCatalogControlRoute(wrapper.route)) continue;
      if (spec.connectorId && wrapper.route.connectorId !== spec.connectorId) continue;
      try {
        const resolved = await connector.resolveCall(
          {
            tool: wrapper.name,
            args: { id: spec.toolName, arguments: spec.arguments ?? {} },
            executionId: operationId,
            route: wrapper.route,
          },
          context,
        );
        if (
          resolved &&
          sameRoute(resolved.tool) &&
          !isLazyCatalogControlRoute(resolved.tool.route)
        ) {
          tool = resolved.tool;
          args = resolved.call.args;
          break;
        }
      } catch {
        // Not this wrapper's tool, or its arguments do not fit.
      }
    }
  }
  if (!tool?.route) return denied("The tool is no longer available.");
  // The executor hides a tool of an agent's own connection from other bots unless it is declared a read.
  const route = tool.route;
  if (
    tool.readOnly !== true &&
    rows.some(
      (row) =>
        row.agentBotId &&
        row.connectorId === route.connectorId &&
        (!route.connectionId || row.id === route.connectionId),
    )
  ) {
    return denied("The tool is no longer available.");
  }
  if (!args && spec.arguments) {
    try {
      assertConnectorToolArgs(tool.inputSchema, spec.arguments);
    } catch {
      return denied("The tool's arguments are not valid.");
    }
  }
  // The executor's own gate: a declared write, or a name that is not a plain read, asks first.
  if (!watchToolIsRead(tool)) {
    return denied("The tool is no longer a read-only tool.");
  }
  return {
    ok: true as const,
    bot,
    tool,
    /** The arguments the connector accepted for a catalog tool; a direct tool's are checked by the caller. */
    args,
    route: tool.route,
    context,
    availableIds: connections
      .filter((row) => row.connectorId === tool.route?.connectorId)
      .map((row) => row.id),
    appDisplayName: connections.find((row) => row.id === tool.route?.connectionId)?.displayName,
  };
}

/** The first line of a tool's own name for people: "mcp__mercury__get_accounts" gives "Mercury". */
export function connectorAppLabel(toolName: string, displayName?: string | null): string {
  const clean = (value: string) =>
    value
      .replace(/[^A-Za-z0-9 ._-]+/g, " ")
      .trim()
      .slice(0, 60);
  const fromDisplay = displayName ? clean(displayName) : "";
  if (fromDisplay) return fromDisplay;
  const segments = toolName.split("__");
  const word = (segments.length > 2 ? segments[1] : toolName.split("_")[0]) ?? toolName;
  return clean(word.charAt(0).toUpperCase() + word.slice(1)) || "App";
}

/** One check: resolve and authorize again, call the read tool, return the result as stable JSON text. */
export async function probeConnectorWatch(
  deps: { prisma: Db; connector: ConnectorProvider; signal?: AbortSignal },
  scope: Scope & { routineId: string },
  spec: ConnectorWatchSpec,
): Promise<{ ok: true; text: string } | ({ ok: false } & ConnectorWatchFailure)> {
  const abort = new AbortController();
  const stop = () => abort.abort();
  deps.signal?.addEventListener("abort", stop);
  let timer = setTimeout(stop, WATCH_CONNECTOR_TIMEOUT_MS);
  try {
    const resolved = await resolveWatchTool(
      deps.prisma,
      deps.connector,
      scope,
      spec,
      abort.signal,
      `watch:${scope.routineId}`,
    );
    if (!resolved.ok) return resolved;
    // Discovery waits on every provider; the tool call gets its own full budget.
    clearTimeout(timer);
    timer = setTimeout(stop, WATCH_CONNECTOR_TIMEOUT_MS);
    const declaredReadOnly = resolved.tool.readOnly;
    let refusal: string | null = null;
    const check = async () => {
      refusal = await connectionDenial(deps.prisma, {
        spaceId: scope.spaceId,
        userId: scope.userId,
        bot: resolved.bot,
        route: resolved.route,
        availableIds: resolved.availableIds,
        declaredReadOnly,
      });
      return refusal;
    };
    const early = await check();
    if (early) return denied(early);
    const call: ConnectorCall = {
      tool: resolved.tool.name,
      args: resolved.args ?? spec.arguments,
      executionId: `watch:${scope.routineId}:${Date.now()}`,
      // The classification the gate used: a connector refuses to dispatch a tool that is a write now.
      route:
        declaredReadOnly === true
          ? { ...resolved.route, discoveredReadOnly: true }
          : resolved.route,
      beforeDispatch: check,
    };
    let data: unknown;
    for await (const event of deps.connector.execute(call, resolved.context)) {
      if (event.type === "error") {
        const late = refusal as string | null;
        return late || event.message === CHANGED_TO_WRITE_MESSAGE
          ? denied(late ?? event.message)
          : { ok: false, kind: "transient", message: event.message };
      }
      if (event.type === "result") data = event.data;
    }
    if (data === undefined) return { ok: false, kind: "transient", message: "No result." };
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch {
        // Plain text stays text.
      }
    }
    // Composio wraps the data with the id of this execution's log, which differs on every call.
    if (data && typeof data === "object" && "logId" in data && "data" in data) {
      data = (data as { data: unknown }).data;
    }
    const text = typeof data === "string" ? data : stableJsonText(data);
    return { ok: true, text: text.slice(0, WATCH_RESULT_MAX_CHARS) };
  } catch (error) {
    return {
      ok: false,
      kind: "transient",
      message: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
    deps.signal?.removeEventListener("abort", stop);
  }
}
