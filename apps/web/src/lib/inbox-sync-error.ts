import { t } from "@lingui/core/macro";

/** The notice for accounts whose sync failed outright; empty when none did. `retried`: a retry failed again. */
export function syncErrorText(
  list: {
    failedAccounts: readonly string[];
    reconnectAccounts: readonly string[];
    rateLimitedAccounts?: readonly string[] | undefined;
  },
  retried = false,
): string {
  if (list.failedAccounts.length === 0) return "";
  if (list.reconnectAccounts.length > 0) return t`Gmail needs to be reconnected.`;
  if (list.rateLimitedAccounts?.length) {
    return retried
      ? t`Gmail is still limiting requests.`
      : t`Gmail is limiting requests right now.`;
  }
  return t`Couldn't reach Gmail.`;
}
