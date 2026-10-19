/** Devin's official remote MCP server (Streamable HTTP; the /sse endpoint is deprecated). */
export const DEVIN_MCP_ENDPOINT = "https://mcp.devin.ai/mcp";

/** Whether an MCP server endpoint is Devin's, matched by https host so path variants still match. */
export function isDevinEndpoint(endpoint: string | null | undefined): boolean {
  if (!endpoint) return false;
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && url.host === new URL(DEVIN_MCP_ENDPOINT).host;
  } catch {
    return false;
  }
}

/** From https://docs.devin.ai/work-with-devin/devin-mcp (2026-10). `list_integrations` is the legacy name. */
export const DEVIN_READ_TOOLS = [
  "read_wiki_structure",
  "read_wiki_contents",
  "ask_question",
  "list_available_repos",
  "devin_session_search",
  "devin_session_events",
  "devin_session_gather",
  "devin_list_integrations",
  "list_integrations",
] as const;

/**
 * Always writes. devin_session_create spends the team's ACUs; devin_session_interact can message,
 * sleep, terminate, archive or tag a session, so it is a write whatever it is asked to do.
 */
export const DEVIN_WRITE_TOOLS = [
  "devin_session_create",
  "devin_session_interact",
  "devin_playbook_manage",
  "devin_knowledge_manage",
  "devin_schedule_manage",
] as const;
