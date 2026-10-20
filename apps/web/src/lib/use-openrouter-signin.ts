import { useRef, useState } from "react";
import { openMcpOauthPopup } from "./mcp-connect";
import { rpc } from "./rpc";
import { errorText } from "./user-error";

export const OPENROUTER_CALLBACK_PATH = "/models/openrouter/callback";

/**
 * "Sign in with OpenRouter": the API builds the authorization URL and keeps the PKCE verifier;
 * this opens it in the shared OAuth popup and waits for the callback page to finish the exchange.
 * The key is stored by the API and never reaches the browser.
 */
export function useOpenRouterSignIn(options: {
  onConnected: () => void | Promise<void>;
  onError: (message: string) => void;
  onClearError?: () => void;
}) {
  const [pending, setPending] = useState(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  async function start() {
    optionsRef.current.onClearError?.();
    setPending(true);
    try {
      const { authorizationUrl } = await rpc.models.beginOpenRouterOAuth({
        redirectUri: `${window.location.origin}${OPENROUTER_CALLBACK_PATH}`,
      });
      if ((await openMcpOauthPopup(authorizationUrl)) === "connected") {
        await optionsRef.current.onConnected();
      }
    } catch (err) {
      optionsRef.current.onError(errorText(err, "Could not sign in with OpenRouter"));
    } finally {
      setPending(false);
    }
  }

  return { pending, start };
}
