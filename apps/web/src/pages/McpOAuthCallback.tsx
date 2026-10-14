import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@rakazo/ui-web";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { isMcpOauthPopup, MCP_OAUTH_CHANNEL } from "../lib/mcp-connect";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";

export function McpOAuthCallbackPage() {
  const { t } = useLingui();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const handledState = useRef<string | null>(null);
  const [isPopup] = useState(isMcpOauthPopup);
  useEffect(() => {
    const code = params.get("code");
    const state = params.get("state");
    const fail = (message: string) => {
      const channel = new BroadcastChannel(MCP_OAUTH_CHANNEL);
      channel.postMessage({ type: "mcp-oauth-failed" });
      channel.close();
      setError(message);
    };
    if (!code || !state) {
      fail(params.get("error_description") ?? t`OAuth authorization was cancelled.`);
      return;
    }
    if (handledState.current === state) return;
    handledState.current = state;
    void rpc.mcp.oauth
      .complete({ sessionId: state, code, state })
      .then(() => {
        const channel = new BroadcastChannel(MCP_OAUTH_CHANNEL);
        channel.postMessage({ type: "mcp-oauth-complete" });
        channel.close();
        if (isPopup) {
          setDone(true);
          window.close();
          return;
        }
        navigate("/app?mcp_oauth=connected", { replace: true });
      })
      .catch((err: unknown) => fail(errorText(err, t`Could not complete OAuth`)));
  }, [isPopup, navigate, params, t]);
  const showReturn = Boolean(error) && !isPopup;
  return (
    <div className="grid min-h-screen place-items-center bg-background p-6 text-center">
      <div>
        <div className="text-lg text-foreground">
          {error ? (
            <Trans>OAuth connection failed</Trans>
          ) : done ? (
            <Trans>Connected</Trans>
          ) : (
            <Trans>Finishing MCP connection…</Trans>
          )}
        </div>
        {error ? <p className="mt-2 max-w-md text-sm text-muted-foreground">{error}</p> : null}
        {showReturn ? (
          <Button type="button" className="mt-5" onClick={() => navigate("/app")}>
            <Trans>Return to Rakazo</Trans>
          </Button>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            {error || done ? (
              <Trans>You can close this window.</Trans>
            ) : (
              <Trans>You can close this tab if it does not redirect automatically.</Trans>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
