/** The one place the Carta agent's spawn key is built. */
export const cartaAgentSpawnKey = (userId: string) => `carta-agent:${userId}`;

export const isCartaAgentSpawnKey = (spawnKey: string | null | undefined) =>
  Boolean(spawnKey?.startsWith(cartaAgentSpawnKey("")));

/** Carta's official remote MCP server. A server counts as Carta by its endpoint host. */
export const CARTA_MCP_ENDPOINT = "https://mcp.app.carta.com/mcp";

/** Whether an MCP server endpoint is Carta's, matched by https host. */
export function isCartaEndpoint(endpoint: string | null | undefined): boolean {
  if (!endpoint) return false;
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && url.host === new URL(CARTA_MCP_ENDPOINT).host;
  } catch {
    return false;
  }
}

/**
 * The tools the Carta agent may call on Carta's server, even when its assignment allows all tools.
 * Taken from Carta's public tool list (2026-10-15); all are reads. set_context only picks the company.
 * Write tools Carta adds later stay out until a plan adds them with approval.
 */
export const CARTA_READ_TOOLS = [
  "welcome",
  "discover",
  "fetch",
  "list_contexts",
  "set_context",
  "list_accounts",
  "get_current_user",
  "cap_table_chart",
  "cap_table_healthcheck",
] as const;
