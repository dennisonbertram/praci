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

/** Open the sign-in popup for an authorization URL. Null when the browser blocked it. */
export function openMcpAuthorization(authorizationUrl: string): Window | null {
  const popup = window.open("about:blank", MCP_OAUTH_CHANNEL, "popup,width=560,height=720");
  if (!popup) return null;
  try {
    popup.sessionStorage.setItem(MCP_OAUTH_POPUP_KEY, "1");
  } catch {
    // Without the marker the callback page returns to /app; completion still broadcasts.
  }
  popup.location.href = authorizationUrl;
  return popup;
}

/** Wait for the callback page to broadcast completion or failure. Resolves "timed_out" when
 * nothing arrives in time and "aborted" when the signal fires first.
 *
 * The BroadcastChannel (not window.opener) is the completion signal because
 * provider login pages with COOP sever the opener link. A severed handle reads
 * as closed, so `popup.closed` cannot prove the sign-in was cancelled; only the
 * timeout or a failure message from the callback page does. */
export function waitForMcpOauth(
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<"connected" | "failed" | "timed_out" | "aborted"> {
  return new Promise((resolve) => {
    const channel = new BroadcastChannel(MCP_OAUTH_CHANNEL);
    let timeoutTimer = 0;
    const finish = (result: "connected" | "failed" | "timed_out" | "aborted") => {
      window.clearTimeout(timeoutTimer);
      options.signal?.removeEventListener("abort", onAbort);
      channel.close();
      resolve(result);
    };
    const onAbort = () => finish("aborted");
    if (options.signal?.aborted) return finish("aborted");
    options.signal?.addEventListener("abort", onAbort);
    timeoutTimer = window.setTimeout(
      () => finish("timed_out"),
      options.timeoutMs ?? MCP_OAUTH_TIMEOUT_MS,
    );
    channel.onmessage = (event: MessageEvent) => {
      const type = (event.data as { type?: string } | null)?.type;
      if (type === "mcp-oauth-complete") finish("connected");
      else if (type === "mcp-oauth-failed") finish("failed");
    };
  });
}

/** Run the browser OAuth popup flow for an MCP server: request an
 * authorization URL, open the popup, and wait until the callback page
 * broadcasts completion or failure, or the attempt times out.
 *
 * `reauthorize` asks the API for a fresh sign-in even when a token is stored;
 * the stored token is replaced only once the new authorization completes. */
export async function connectMcpOauth(
  serverId: string,
  options: { reauthorize?: boolean } = {},
): Promise<McpOauthResult> {
  const started = await beginMcpOauth(serverId, options);
  if (started.status !== "authorization_required") return started.status;
  return await openMcpOauthPopup(started.authorizationUrl);
}

/** Open the provider's sign-in page in a popup and wait for the callback page to report the result.
 * `connectMcpOauth` uses it after `mcp.oauth.begin`; Finance uses it after `finance.connect`, which
 * begins the same OAuth flow itself. */
export async function openMcpOauthPopup(authorizationUrl: string): Promise<McpOauthResult> {
  const controller = new AbortController();
  const waiting = waitForMcpOauth({ signal: controller.signal });
  const popup = openMcpAuthorization(authorizationUrl);
  if (!popup) {
    // Popup blocked: navigate this tab instead; the callback page returns to /app.
    controller.abort();
    window.location.assign(authorizationUrl);
    return "cancelled";
  }
  const result = await waiting;
  // A timed-out or failed attempt leaves no use for the provider's sign-in window.
  if (result !== "connected") popup.close();
  return result === "connected" ? "connected" : "cancelled";
}

/** Start an MCP sign-in without opening it, so the caller can show its own waiting state. */
export function beginMcpOauth(
  serverId: string,
  options: {
    reauthorize?: boolean;
    oauthClient?: { clientId: string; clientSecret?: string };
  } = {},
) {
  return rpc.mcp.oauth.begin({
    serverId,
    redirectUri: `${window.location.origin}/mcp/oauth/callback`,
    ...(options.reauthorize ? { reauthorize: true } : {}),
    ...(options.oauthClient ? { oauthClient: options.oauthClient } : {}),
  });
}
