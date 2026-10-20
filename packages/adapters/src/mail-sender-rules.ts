import { GMAIL_SETTINGS_BASIC } from "./google-connector.js";

/**
 * Whether a connected mail account can have Gmail filters made for it. Only the account's own Google
 * login can (`connectorId` "google"), and only after it was granted gmail.settings.basic, which the
 * connection's metadata records. Connections made before the scope was stored read as needing it.
 */
export function senderRulesState(
  connectorId: string,
  metadata: Record<string, unknown> | null | undefined,
): "ready" | "needs_permission" | "unsupported" {
  if (connectorId !== "google") return "unsupported";
  const scope = metadata?.scope;
  return typeof scope === "string" && scope.split(" ").includes(GMAIL_SETTINGS_BASIC)
    ? "ready"
    : "needs_permission";
}
