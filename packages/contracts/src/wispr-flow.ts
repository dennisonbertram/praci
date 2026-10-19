/** Wispr Flow's official remote MCP server (read-only: meetings, notes, tasks, Scratchpad, calendar). */
export const WISPR_FLOW_MCP_ENDPOINT = "https://api.wisprflow.ai/connect/mcp";

/** Whether an MCP server endpoint is Wispr Flow's, matched by https host and the /connect/mcp path. */
export function isWisprFlowEndpoint(endpoint: string | null | undefined): boolean {
  if (!endpoint) return false;
  try {
    const url = new URL(endpoint);
    const target = new URL(WISPR_FLOW_MCP_ENDPOINT);
    return (
      url.protocol === "https:" &&
      url.host === target.host &&
      url.pathname.replace(/\/+$/, "") === target.pathname
    );
  } catch {
    return false;
  }
}

/**
 * Wispr does not document its tool names. The server is read-only, so a tool counts as a read when
 * its name starts with a read verb. TODO: replace this with an exact list after the first live connection.
 */
export const WISPR_FLOW_READ_NAME = /^(get|list|search|read|find|fetch|query|lookup)/i;
