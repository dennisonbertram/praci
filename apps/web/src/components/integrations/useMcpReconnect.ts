import { useLingui } from "@lingui/react/macro";
import { MCP_OAUTH_CLIENT_ID_REQUIRED } from "@rakazo/contracts";
import { useState } from "react";
import { connectMcpOauth } from "../../lib/mcp-connect";
import { errorText } from "../../lib/user-error";

/** Inline Reconnect for an MCP server. A cancelled or timed-out sign-in leaves a clear message. */
export function useMcpReconnect(serverId: string, onDone: () => void) {
  const { t } = useLingui();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsClient, setNeedsClient] = useState(false);
  async function run() {
    setBusy(true);
    setError(null);
    try {
      const result = await connectMcpOauth(serverId, { reauthorize: true });
      if (result === "cancelled") {
        setError(t`Sign-in was cancelled or did not finish. Try again.`);
      } else if (result === "authorization_not_requested") {
        setError(t`This server did not ask for a sign-in.`);
      }
    } catch (err) {
      // The server has no dynamic registration: the add dialog collects a client ID.
      if (err instanceof Error && err.message.includes(MCP_OAUTH_CLIENT_ID_REQUIRED)) {
        setNeedsClient(true);
        return;
      }
      setError(errorText(err, t`Could not reconnect`));
    } finally {
      setBusy(false);
      onDone();
    }
  }
  return { busy, error, run, needsClient, dismiss: () => setNeedsClient(false) };
}
