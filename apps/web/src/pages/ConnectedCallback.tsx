import { Trans } from "@lingui/react/macro";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PLUGIN_CONNECT_WINDOW } from "../lib/plugin-connect";

/**
 * Where Composio and Pipedream send the browser after sign-in. The window that started the
 * connection polls for the result, so this page only closes the popup. Anywhere else (a
 * full-page redirect, or a blocked popup) it returns to the integrations page.
 */
export function ConnectedCallbackPage() {
  const navigate = useNavigate();
  const isPopup = window.name === PLUGIN_CONNECT_WINDOW;
  useEffect(() => {
    if (isPopup) window.close();
    else navigate("/app/integrations", { replace: true });
  }, [isPopup, navigate]);
  return (
    <div className="grid min-h-screen place-items-center bg-background p-6 text-center text-lg text-foreground">
      <Trans>Connected</Trans>
    </div>
  );
}
