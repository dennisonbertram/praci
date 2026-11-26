import type { AdapterContext } from "@rakazo/adapter-kit";
import {
  integrationPresetForEndpoint,
  isIntegrationAgentSpawnKey,
  isReadTool,
} from "@rakazo/contracts";
import { connectorToolRequiresApproval } from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";
import type { McpConnector } from "./mcp-connector.js";
import { assignmentAllowsTool } from "./mcp-connector.js";

export const MCP_SOURCE_TIMEOUT_MS = 15_000;

export interface McpReadSourceDeps {
  prisma: PrismaClient;
  /** Lists a server's tools so a source can be checked against the tool's annotations. */
  mcp?: Pick<McpConnector, "listServerTools">;
}

export interface McpReadSourceScope {
  spaceId: string;
  botId: string;
  /** The bot's owner; the caller has already checked the bot belongs to this space and user. */
  userId: string;
}

/** MCP tools often use camelCase (getAccounts); the approval name check expects snake_case. */
function toolNameIsReadOnly(tool: string): boolean {
  return !connectorToolRequiresApproval(tool.replace(/([a-z0-9])([A-Z])/g, "$1_$2"));
}

/** The context for a server call made on the bot's behalf outside a run (pins, page sources). */
export function mcpSourceContext(scope: McpReadSourceScope, kind: string): AdapterContext {
  return {
    operationId: `${kind}:${scope.botId}`,
    traceId: `${kind}:${scope.botId}`,
    spaceId: scope.spaceId,
    userId: scope.userId,
    botId: scope.botId,
    signal: AbortSignal.timeout(MCP_SOURCE_TIMEOUT_MS),
  };
}

/**
 * The one rule for rerunning an MCP tool without a model, used by pins and page sources. Looks up
 * the source's server and checks the call is safe to rerun. The server must be enabled and belong
 * to the bot's space and owner, the bot must still be assigned to it, and the assignment must
 * allow the tool (the rule a bot run uses). The server must list the tool. A tool is read-only
 * only when no annotation declares a write (readOnlyHint false, destructiveHint true) and its name
 * reads as a get/list/search/read, the same rule that exempts a run from approval.
 */
export async function checkMcpReadSource(
  deps: McpReadSourceDeps,
  scope: McpReadSourceScope,
  source: { serverId: string; tool: string },
  contextKind = "pins",
) {
  const { prisma } = deps;
  const loadAssignment = () =>
    prisma.botMcpServer.findFirst({
      where: {
        botId: scope.botId,
        serverId: source.serverId,
        spaceId: scope.spaceId,
        userId: scope.userId,
        server: { enabled: true, spaceId: scope.spaceId, userId: scope.userId },
      },
      include: {
        server: {
          include: {
            agentBot: {
              select: { id: true, spawnKey: true, spaceId: true, userId: true, archivedAt: true },
            },
          },
        },
        bot: {
          select: { id: true, spawnKey: true, spaceId: true, userId: true, archivedAt: true },
        },
      },
    });
  let assignment = await loadAssignment();
  if (!assignment) throw new Error(`MCP tool ${source.tool} is not assigned to this bot`);
  if (!deps.mcp) throw new Error("MCP is not available");
  // Fresh, not cached: refresh calls the tool outside the approval flow, so a tool that has turned
  // into a write since the last listing must not pass on old annotations.
  const tools = await deps.mcp.listServerTools(
    assignment.server,
    mcpSourceContext(scope, contextKind),
    { fresh: true },
  );
  // The listing took time: authorize on the row as it is now.
  const current = await loadAssignment();
  if (!current) throw new Error(`MCP tool ${source.tool} is not assigned to this bot`);
  assignment = current;
  const meta = tools.find((tool) => tool.name === source.tool);
  // The gate needs the tool's annotations (an integration agent's reads) and the bot's owner.
  if (!assignmentAllowsTool(assignment, source.tool, meta?.annotations)) {
    throw new Error(`MCP tool ${source.tool} is not assigned to this bot`);
  }
  if (!meta) throw new Error(`Tool ${source.tool} is not offered by the server`);
  const hints = meta.annotations;
  // Never rerun what a bot run would need approval for: the name rule applies whatever the server claims.
  // With an integration agent involved, only the agent's own read classification counts: refresh runs
  // outside the approval flow, so an unannotated get_* tool (a write there) must not pass by its name.
  const readOnly =
    assignment.server.agentBotId || isIntegrationAgentSpawnKey(assignment.bot?.spawnKey)
      ? isReadTool(meta, integrationPresetForEndpoint(assignment.server.endpoint))
      : hints?.readOnlyHint !== false &&
        hints?.destructiveHint !== true &&
        toolNameIsReadOnly(source.tool);
  if (!readOnly) {
    throw new Error(`Tool ${source.tool} is not read-only, so it cannot be a saved source`);
  }
  return assignment.server;
}
