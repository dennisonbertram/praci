import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { FINANCE_READ_TOOLS } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import type { FinanceCallTool, FinanceSyncDeps } from "./finance-sync.js";
import type { McpConnector } from "./mcp-connector.js";

/** The tool's JSON payload: its structured content, or its text content parsed as JSON. */
export function unwrapToolResult(result: CallToolResult): unknown {
  const text = result.content
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("\n");
  // An error result carries the vendor's message, which sync never stores.
  if (result.isError) throw new Error(`Tool failed: ${text.slice(0, 200)}`);
  if (result.structuredContent !== undefined) return result.structuredContent;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Tool returned text that is not JSON");
  }
}

/**
 * Builds the read-tool caller Finance sync and receipt links use, over the user's stored MCP server
 * (endpoint, encrypted credential and OAuth refresh all come from `McpConnector`). Only the
 * read tools in FINANCE_READ_TOOLS can be called, whatever a source asks for.
 */
export function createFinanceCallToolFor(
  prisma: Pick<PrismaClient, "mcpServer">,
  mcp: Pick<McpConnector, "callServerTool">,
): FinanceSyncDeps["callToolFor"] {
  return async (server, signal): Promise<FinanceCallTool> => {
    const row = await prisma.mcpServer.findUnique({ where: { id: server.id } });
    if (!row?.enabled) throw new Error("Finance server is not available");
    // The row names its own owner, so the session key and secret lookup stay in that user's scope.
    const context = {
      operationId: `finance:${row.id}`,
      traceId: `finance:${row.id}`,
      spaceId: row.spaceId,
      userId: row.userId,
      signal,
    };
    const allowed: readonly string[] = FINANCE_READ_TOOLS[server.provider];
    return async (name, args) => {
      if (!allowed.includes(name)) throw new Error(`Finance may not call ${name}`);
      return unwrapToolResult(await mcp.callServerTool(row, context, name, args));
    };
  };
}
