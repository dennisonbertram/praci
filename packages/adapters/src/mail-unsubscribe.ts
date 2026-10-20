import type { MailUnsubscriber } from "@rakazo/adapter-kit";
import { MailProviderError } from "@rakazo/adapter-kit";
import { postSafeWebForm, type SafeWebFetchOptions } from "./web-ssrf.js";

/** The fixed body RFC 8058 requires for a one-click unsubscribe. */
const ONE_CLICK_BODY = "List-Unsubscribe=One-Click";

/**
 * Sends the one-click unsubscribe POST through the SSRF-guarded fetch. Tests inject `fetch` and
 * `resolveHostname`; the guard refuses loopback, so a local test server cannot be reached.
 */
export function createMailUnsubscriber(
  options: Pick<SafeWebFetchOptions, "fetch" | "resolveHostname" | "timeoutMs"> = {},
): MailUnsubscriber {
  return {
    async oneClick(url, context) {
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        throw new MailProviderError("invalid", "Unsubscribe link is not a URL");
      }
      if (parsed.protocol !== "https:")
        throw new MailProviderError("invalid", "Unsubscribe link must be https");
      try {
        await postSafeWebForm(url, ONE_CLICK_BODY, { ...options, signal: context.signal });
      } catch (error) {
        throw new MailProviderError(
          "unavailable",
          "Unsubscribe request failed",
          undefined,
          error instanceof Error ? error.message : undefined,
        );
      }
    },
  };
}
