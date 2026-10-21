import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DEVIN_INTERACT_READ_ACTIONS, isDevinEndpoint } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import type { McpConnector } from "./mcp-connector.js";

export type DevinCallTool = (
  serverId: string,
  name: string,
  args: Record<string, unknown>,
  signal?: AbortSignal,
) => Promise<string>;

function allowed(name: string, args: Record<string, unknown>): boolean {
  if (name === "devin_session_search") return true;
  return (
    name === "devin_session_interact" &&
    (DEVIN_INTERACT_READ_ACTIONS as readonly unknown[]).includes(args.action)
  );
}

/**
 * Reads Devin for the page over the stored MCP server, in the row's owner's scope. Only search and
 * the read actions of interact can be called, checked before the call; everything else, and every
 * `isError` result, throws. Returns the tool's text for the parsers in devin-sessions.ts.
 */
export function createDevinCallTool(
  prisma: Pick<PrismaClient, "mcpServer">,
  mcp: Pick<McpConnector, "callServerTool">,
): DevinCallTool {
  return async (serverId, name, args, signal) => {
    if (!allowed(name, args)) throw new Error(`Devin may not call ${name}`);
    const row = await prisma.mcpServer.findUnique({ where: { id: serverId } });
    if (!row?.enabled || !isDevinEndpoint(row.endpoint)) {
      throw new Error("Devin server is not available");
    }
    const context = {
      operationId: `devin:${row.id}`,
      traceId: `devin:${row.id}`,
      spaceId: row.spaceId,
      userId: row.userId,
      signal: signal ?? new AbortController().signal,
    };
    const result: CallToolResult = await mcp.callServerTool(row, context, name, args);
    const text = result.content
      .flatMap((part) => (part.type === "text" ? [part.text] : []))
      .join("\n");
    if (result.isError) throw new Error(`Tool failed: ${text.slice(0, 200)}`);
    return text;
  };
}

export type DevinFailure = "rejected" | "session_forbidden" | "rate_limited" | "unreachable";

/**
 * Classifies a failed Devin call from the sanitized connector text, which ends in `(HTTP <status>)`
 * for an HTTP failure. Timeouts and anything else are `unreachable`. A 403 on the listing means
 * the key lacks permission and is `rejected`; a 403 on one session leaves the connection alone.
 */
export function devinFailureOf(
  error: unknown,
  { phase }: { phase: "listing" | "session" },
): DevinFailure {
  const message = error instanceof Error ? error.message : String(error);
  const status = Number(/\(HTTP (\d{3})\)$/.exec(message)?.[1]);
  if (status === 401) return "rejected";
  if (status === 403) return phase === "listing" ? "rejected" : "session_forbidden";
  if (status === 429) return "rate_limited";
  return "unreachable";
}
