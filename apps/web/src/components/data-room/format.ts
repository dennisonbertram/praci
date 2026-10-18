import { i18n } from "@lingui/core";
import { plural, t } from "@lingui/core/macro";

export const dateText = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat(i18n.locale || undefined, {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(new Date(iso))
    : "";

/** Words for the types the classifier gives (DataRoomDocTypeSchema), where one word is unclear. */
const typeNames = (): Record<string, string> => ({
  tax: t`Tax document`,
  legal: t`Legal document`,
  hr: t`HR document`,
  investor: t`Investor document`,
  correspondence: t`Letter or email`,
});

/**
 * A document type as shown: a clear name for the classifier's short types, otherwise the value
 * with its first letter capitalised. The stored value (and the filter) stays as it is.
 */
export const typeLabel = (docType: string | null) =>
  docType ? (typeNames()[docType] ?? docType.charAt(0).toLocaleUpperCase() + docType.slice(1)) : "";

/**
 * True once the item's text, type and folder are in place. "indexing" only brings search up to
 * date (after a rename or move too), so it shows as done rather than sending the row back to
 * "Reading".
 */
export const isSettled = (status: string) => status === "ready" || status === "indexing";

/**
 * The word for an item's status. Every working step is "Reading": whether the item is then tagged
 * and filed depends on consent, so the list never promises filing it may not do.
 */
export const statusLabel = (status: string) =>
  status === "failed" ? t`Failed` : isSettled(status) ? "" : t`Reading`;

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
