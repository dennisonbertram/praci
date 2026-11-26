import { i18n } from "@lingui/core";

/** A calendar date as every cap table tab shows it, e.g. "Nov 11, 2026". */
export const mediumDate = (value: string) =>
  new Intl.DateTimeFormat(i18n.locale || "en", { dateStyle: "medium" }).format(new Date(value));
