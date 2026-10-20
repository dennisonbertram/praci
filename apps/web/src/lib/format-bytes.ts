import { i18n } from "@lingui/core";
import { formatFileSize } from "@rakazo/core";

/** Binary (1024) units up to TB, with the number formatted for the active locale. */
export function formatBytes(size: number) {
  return formatFileSize(size, i18n.locale || "en");
}
