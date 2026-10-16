import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";

export const dateText = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat(i18n.locale || undefined, {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(new Date(iso))
    : "";

/**
 * The word for an item's status. Every working step is "Reading": whether the item is then tagged
 * and filed depends on consent, so the list never promises filing it may not do.
 */
export const statusLabel = (status: string) =>
  status === "failed" ? t`Failed` : status === "ready" ? "" : t`Reading`;
