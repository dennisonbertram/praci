import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@rakazo/ui-web";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PLUGIN_CONNECT_WINDOW } from "../lib/plugin-connect";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";

export function GoogleOAuthCallbackPage() {
  const { t } = useLingui();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const handledState = useRef<string | null>(null);
  const isPopup = window.name === PLUGIN_CONNECT_WINDOW;
  useEffect(() => {
    const code = params.get("code");
    const state = params.get("state");
    if (!code || !state) {
      setError(params.get("error_description") ?? t`OAuth authorization was cancelled.`);
      return;
    }
    if (handledState.current === state) return;
    handledState.current = state;
    // The connect screen that opened this window polls connections.complete, so it
    // sees the connection become ready; this page only has to finish the exchange.
    void rpc.connections
      .complete({ state, code })
      .then(() => {
        if (isPopup) {
          setDone(true);
          window.close();
          return;
        }
        navigate("/app", { replace: true });
      })
      .catch((err: unknown) => setError(errorText(err, t`Could not complete OAuth`)));
  }, [isPopup, navigate, params, t]);
  return (
    <div className="grid min-h-screen place-items-center bg-background p-6 text-center">
      <div>
        <div className="text-lg text-foreground">
          {error ? (
            <Trans>OAuth connection failed</Trans>
          ) : done ? (
            <Trans>Connected</Trans>
          ) : (
            <Trans>Connecting…</Trans>
          )}
        </div>
        {error ? <p className="mt-2 max-w-md text-sm text-muted-foreground">{error}</p> : null}
        {error && !isPopup ? (
          <Button type="button" className="mt-5" onClick={() => navigate("/app")}>
            <Trans>Return to Praci</Trans>
          </Button>
        ) : error || done ? (
          <p className="mt-2 text-sm text-muted-foreground">
            <Trans>You can close this window.</Trans>
          </p>
        ) : null}
      </div>
    </div>
  );
}
