import { i18n } from "@lingui/core";
import { plural, t } from "@lingui/core/macro";

/** A document's date is a calendar day (UTC); when something happened (`local`) is the viewer's day. */
export const dateText = (iso: string | null, local = false) =>
  iso
    ? new Intl.DateTimeFormat(i18n.locale || undefined, {
        dateStyle: "medium",
        timeZone: local ? undefined : "UTC",
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

/** The step a working item is in, for the hint on its row. */
export const stageLabel = (status: string) =>
  status === "classifying"
    ? t`Tagging`
    : status === "indexing"
      ? t`Indexing for search`
      : t`Reading text`;

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
export const alreadyText = () => t`Already in the Data room`;

export const importedText = (imported: number, duplicates: number) =>
  imported === 0 && duplicates > 0
    ? alreadyText()
    : plural(imported, { one: "Imported # file", other: "Imported # files" });

export const importingText = (files: number) =>
  plural(files, { one: "Importing # file", other: "Importing # files" });

export const failedText = (failed: number) =>
  plural(failed, { one: "Couldn't import # file", other: "Couldn't import # files" });

/**
 * A signature or logo picture rather than a document: a small image, or an image named like the
 * usual ones. The server already leaves out pictures the body embeds (Content-ID parts).
 */
const LOGO_NAME =
  /^(image\d*|logo|signature|outlook-\w+|icon|banner|spacer|facebook|twitter|linkedin|instagram)\b/i;
export const isNoiseImage = (file: { filename: string; mimeType: string; size: number }) =>
  file.mimeType.startsWith("image/") && (file.size < 10_000 || LOGO_NAME.test(file.filename));
