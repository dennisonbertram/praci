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

export function sizeText(bytes: number) {
  const [unit, divisor] =
    bytes < 1_000
      ? (["byte", 1] as const)
      : bytes < 1_000_000
        ? (["kilobyte", 1_000] as const)
        : (["megabyte", 1_000_000] as const);
  return new Intl.NumberFormat(i18n.locale || undefined, {
    style: "unit",
    unit,
    unitDisplay: "narrow",
    maximumFractionDigits: 1,
  }).format(bytes / divisor);
}
