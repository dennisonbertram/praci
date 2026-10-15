import { t } from "@lingui/core/macro";

/** The notice for accounts whose sync failed outright; empty when none did. */
export function syncErrorText(list: {
  failedAccounts: readonly string[];
  reconnectAccounts: readonly string[];
  rateLimitedAccounts?: readonly string[] | undefined;
}): string {
  if (list.failedAccounts.length === 0) return "";
  if (list.reconnectAccounts.length > 0) return t`Gmail needs to be reconnected.`;
  if (list.rateLimitedAccounts?.length) {
    return t`Gmail is limiting requests right now. Try again in a minute.`;
  }
  return t`Couldn't reach Gmail.`;
}
