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
 * The tools of Wispr Flow's MCP server, from its live tool list (2026-11). Every one is annotated
 * read-only. A tool Wispr adds later stays hidden until it is added here.
 */
export const WISPR_FLOW_READ_TOOLS = [
  "search_meetings",
  "get_meeting",
  "get_meeting_participants_enriched",
  "get_participant_contacts",
  "resolve_share_link",
  "search_scratchpad_notes",
  "get_scratchpad_note",
  "search_calendar_events",
  "resolve_calendar_link",
  "get_calendar_event",
  "get_meeting_by_calendar_id",
  "list_meeting_series",
  "list_upcoming_meetings",
  "get_upcoming_meeting",
  "list_folders",
  "list_folder_meetings",
] as const;
