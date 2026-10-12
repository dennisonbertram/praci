import { t } from "@lingui/core/macro";

/** The notice for accounts whose sync failed outright; empty when none did. */
export function syncErrorText(list: {
  failedAccounts: readonly string[];
  reconnectAccounts: readonly string[];
}): string {
  if (list.failedAccounts.length === 0) return "";
  return list.reconnectAccounts.length > 0
    ? t`Gmail needs to be reconnected.`
    : t`Couldn't reach Gmail.`;
}
