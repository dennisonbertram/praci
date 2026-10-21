import * as z from "zod";

export const ZERNIO_MCP_ENDPOINT = "https://mcp.zernio.com/mcp";
/** REST paths start with /v1; this origin accepts API keys, not documented MCP OAuth tokens. */
export const ZERNIO_API_BASE_URL = "https://zernio.com/api";

export function isZernioEndpoint(endpoint: string | null | undefined): boolean {
  if (!endpoint) return false;
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && url.host === new URL(ZERNIO_MCP_ENDPOINT).host;
  } catch {
    return false;
  }
}

/** Closed read-only allowlist from authenticated tools/list; no generated tools or dispatchers. */
export const ZERNIO_READ_TOOLS = [
  "accounts_list",
  "accounts_get",
  "profiles_list",
  "profiles_get",
  "posts_list",
  "posts_get",
  "posts_list_failed",
  "media_check_upload_status",
  "docs_search",
] as const;

/** Configuration capability, not approval: OAuth-only links can read but cannot post via REST. */
export const ZernioPostingCapabilitySchema = z.enum(["not_connected", "api_key_required", "ready"]);
export type ZernioPostingCapability = z.infer<typeof ZernioPostingCapabilitySchema>;
