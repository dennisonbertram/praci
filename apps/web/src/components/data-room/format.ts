import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";

export const dateText = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat(i18n.locale || undefined, {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(new Date(iso))
    : "";

export const statusLabel = (status: string) =>
  status === "failed"
    ? t`Failed`
    : status === "extracting"
      ? t`Reading`
      : status === "classifying" || status === "indexing"
        ? t`Filing`
        : status === "pending"
          ? t`Pending`
          : "";
