import * as z from "zod";
import { BotSchema } from "./domain.js";
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

/** The only interact actions the page may call; every other action changes a session. */
export const DEVIN_INTERACT_READ_ACTIONS = ["get", "get_messages"] as const;

export const DEVIN_SESSION_KINDS = [
  "needs_you",
  "working",
  "finished",
  "error",
  "suspended",
  "unknown",
] as const;
export type DevinSessionKind = (typeof DEVIN_SESSION_KINDS)[number];

/**
 * Design 9 of docs/plans/devin.md. Every value is an assumption until a real capture confirms the
 * vocabulary (#516). A kind matches when the session's status or status detail is listed;
 * DEVIN_KIND_ORDER makes `needs_you` win over any other match.
 */
export const DEVIN_KIND_VALUES: Record<
  Exclude<DevinSessionKind, "unknown">,
  { statuses: readonly string[]; details: readonly string[] }
> = {
  needs_you: { statuses: ["blocked"], details: ["waiting_for_user", "awaiting_user_input"] },
  error: { statuses: ["error", "failed", "expired", "terminated"], details: [] },
  working: { statuses: ["working", "running", "resumed", "resume_requested"], details: [] },
  finished: { statuses: ["finished", "completed", "sleeping"], details: ["finish", "sleep"] },
  suspended: {
    statuses: ["suspended", "suspend_requested", "suspend_requested_frontend"],
    details: [],
  },
};
export const DEVIN_KIND_ORDER = ["needs_you", "error", "working", "finished", "suspended"] as const;

export const DEVIN_APP_ORIGIN = "https://app.devin.ai";
const DEVIN_SESSION_ID = /^[A-Za-z0-9_-]{1,128}$/;
const DEVIN_SESSION_PATH = /^\/sessions\/([A-Za-z0-9_-]{1,128})$/;

/** Whether `id` is a session id this app will put in a link. */
export function isDevinSessionId(id: string): boolean {
  return DEVIN_SESSION_ID.test(id);
}

/** The canonical link to a session in Devin. Built from the id, never stored. */
export function devinSessionUrl(id: string): string {
  if (!isDevinSessionId(id)) throw new Error("Invalid Devin session id");
  return `${DEVIN_APP_ORIGIN}/sessions/${id}`;
}

/** True only for exactly the URL `devinSessionUrl` builds. */
export function isDevinSessionUrl(value: string): boolean {
  const id = DEVIN_SESSION_PATH.exec(
    value.startsWith(DEVIN_APP_ORIGIN) ? value.slice(DEVIN_APP_ORIGIN.length) : "",
  )?.[1];
  return id !== undefined && value === devinSessionUrl(id);
}

export const DevinSessionSchema = z.object({
  id: z.string(),
  title: z.string(),
  kind: z.enum(DEVIN_SESSION_KINDS),
  status: z.string(),
  statusDetail: z.string().nullable(),
  question: z.string().nullable(),
  prs: z.array(z.object({ url: z.string(), state: z.string() })),
  origin: z.string(),
  /** When Devin last changed the session (ISO 8601). */
  updatedAt: z.string(),
});
export type DevinSessionView = z.infer<typeof DevinSessionSchema>;

export const DevinSessionsOutputSchema = z.object({
  connection: z.object({
    status: z.enum(["none", "ok", "rejected", "connector_gone", "unreachable", "rate_limited"]),
    /** The caller is a space owner: Connect, Reconnect and Disconnect apply. */
    manage: z.boolean(),
    canConnect: z.boolean(),
    /** The connection runs in the caller's scope, so only the caller has its agent. */
    isConnector: z.boolean(),
    agentBotId: z.string().nullable(),
  }),
  fetchedAt: z.string().nullable(),
  stale: z.boolean(),
  partial: z.boolean(),
  /** What the cache holds: needs_you, error, working, then the rest; newest first inside a group. */
  sessions: z.array(DevinSessionSchema),
});
export type DevinSessionsOutput = z.infer<typeof DevinSessionsOutputSchema>;

/** The connector's agent, or null for every other member. */
export const DevinAgentOutputSchema = z.object({ bot: BotSchema }).nullable();

export const DevinKeyInputSchema = z.object({ secret: z.string().trim().min(1).max(16384) });
