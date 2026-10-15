import type { FinanceProvider } from "@rakazo/contracts";
import type { McpOauthResult } from "./mcp-connect";
import { openMcpOauthPopup } from "./mcp-connect";
import { rpc } from "./rpc";

/** Create the provider's MCP server if the user has none and run the same OAuth sign-in the
 * Integrations overlay uses. `finance.connect` begins the OAuth session itself, so the popup opens
 * on the URL it returns instead of beginning a second session. */
export async function connectFinanceProvider(
  provider: FinanceProvider,
  reconnect = false,
): Promise<McpOauthResult> {
  const started = await rpc.finance.connect({
    provider,
    redirectUri: `${window.location.origin}/mcp/oauth/callback`,
    ...(reconnect ? { reconnect } : {}),
  });
  if (started.status !== "authorization_required") return started.status;
  return await openMcpOauthPopup(started.authorizationUrl);
}
