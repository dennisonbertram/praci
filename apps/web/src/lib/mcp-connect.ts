import { rpc } from "./rpc";

export const MCP_OAUTH_CHANNEL = "rakazo-mcp-oauth";
const MCP_OAUTH_TIMEOUT_MS = 2 * 60 * 1000;
// Provider login pages that send COOP clear window.name and sever the opener's
// handle, but this tab-scoped sessionStorage marker survives the round trip.
const MCP_OAUTH_POPUP_KEY = "rakazo-mcp-oauth-popup";

/** True in the OAuth popup; false when a blocked popup fell back to this tab. */
export function isMcpOauthPopup(): boolean {
  try {
    return sessionStorage.getItem(MCP_OAUTH_POPUP_KEY) === "1";
  } catch {
    return false;
  }
}

export type McpOauthResult =
  | "connected"
  | "cancelled"
  | "already_connected"
  | "authorization_not_requested";

/** Run the browser OAuth popup flow for an MCP server: request an
 * authorization URL, open the popup, and wait until the callback page
 * broadcasts completion or failure, or the attempt times out.
 *
 * The BroadcastChannel (not window.opener) is the completion signal because
 * provider login pages with COOP sever the opener link. A severed handle reads
 * as closed, so `popup.closed` cannot mean cancelled; only the timeout or a
 * failure message from the callback page does. */
export async function connectMcpOauth(serverId: string): Promise<McpOauthResult> {
  const started = await rpc.mcp.oauth.begin({
    serverId,
    redirectUri: `${window.location.origin}/mcp/oauth/callback`,
  });
  if (started.status !== "authorization_required") return started.status;
  const popup = window.open("about:blank", MCP_OAUTH_CHANNEL, "popup,width=560,height=720");
  if (!popup) {
    // Popup blocked: navigate this tab instead; the callback page returns to /app.
    window.location.assign(started.authorizationUrl);
    return "cancelled";
  }
  try {
    popup.sessionStorage.setItem(MCP_OAUTH_POPUP_KEY, "1");
  } catch {
    // Without the marker the callback page returns to /app; completion still broadcasts.
  }
  popup.location.href = started.authorizationUrl;
  return await new Promise<McpOauthResult>((resolve) => {
    const channel = new BroadcastChannel(MCP_OAUTH_CHANNEL);
    let settled = false;
    let timeoutTimer = 0;
    const finish = (result: McpOauthResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutTimer);
      channel.close();
      resolve(result);
    };
    timeoutTimer = window.setTimeout(() => {
      popup.close();
      finish("cancelled");
    }, MCP_OAUTH_TIMEOUT_MS);
    channel.onmessage = (event: MessageEvent) => {
      const type = (event.data as { type?: string } | null)?.type;
      if (type === "mcp-oauth-complete") finish("connected");
      else if (type === "mcp-oauth-failed") finish("cancelled");
    };
  });
}
