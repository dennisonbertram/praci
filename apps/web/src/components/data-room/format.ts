import { i18n } from "@lingui/core";
import { plural, t } from "@lingui/core/macro";

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

/** A file size with a space before the unit: "722 bytes", "12.3 kB", "4.1 MB". */
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
    // "Narrow" runs number and unit together ("722B"); bytes read best spelled out.
    unitDisplay: unit === "byte" ? "long" : "short",
    maximumFractionDigits: 1,
  }).format(bytes / divisor);
}

/** The notice after an import finishes. */
export const importedText = (imported: number, duplicates: number) =>
  imported === 0 && duplicates > 0
    ? t`Already in the Data room`
    : plural(imported, { one: "Imported # file", other: "Imported # files" });

export const failedText = (failed: number) =>
  plural(failed, { one: "Couldn't import # file", other: "Couldn't import # files" });
