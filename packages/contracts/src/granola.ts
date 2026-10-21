/** Granola's official remote MCP server (https://docs.granola.ai/help-center/sharing/integrations/mcp). */
export const GRANOLA_MCP_ENDPOINT = "https://mcp.granola.ai/mcp";

/** Whether an MCP server endpoint is Granola's, matched by https host so path variants still match. */
export function isGranolaEndpoint(endpoint: string | null | undefined): boolean {
  if (!endpoint) return false;
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && url.host === new URL(GRANOLA_MCP_ENDPOINT).host;
  } catch {
    return false;
  }
}

/** From the Granola MCP docs (2026-10). Every one of these only reads. */
export const GRANOLA_READ_TOOLS = [
  "query_granola_meetings",
  "list_meeting_folders",
  "list_meetings",
  "get_meetings",
  "get_meeting_attachment",
  "get_meeting_transcript",
  "get_account_info",
] as const;

/**
 * Not usable by any agent. switch_workspace and sign_out change the account's session in the
 * user's other AI tools, so they are left out of the preset's allowed tools.
 */
export const GRANOLA_BLOCKED_TOOLS = ["switch_workspace", "sign_out"] as const;

/** Granola's public REST API (https://docs.granola.ai/introduction); keys look like `grn_...`. */
export const GRANOLA_API_BASE_URL = "https://public-api.granola.ai/v1";

/** Connection.connectorId for a Granola API key. */
export const GRANOLA_API_CONNECTOR_ID = "granola-api";

/**
 * The one Granola agent a user has, whichever route created it (the sign-in MCP server or the API
 * key). One key per user, so the unique (spaceId, spawnKey) index keeps it a single agent.
 */
export const granolaAgentSpawnKey = (userId: string) => `integration-agent:granola:${userId}`;
