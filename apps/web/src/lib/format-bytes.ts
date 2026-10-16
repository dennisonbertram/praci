import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";

/** Binary (1024) units, with the number formatted for the active locale. */
export function formatBytes(size: number) {
  const locale = i18n.locale || "en";
  if (size < 1024) return t`${size} B`;
  const format = (value: number) =>
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value);
  if (size < 1024 * 1024) return t`${format(size / 1024)} KB`;
  return t`${format(size / (1024 * 1024))} MB`;
}
