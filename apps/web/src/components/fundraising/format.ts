import { i18n } from "@lingui/core";
import { shortDay, usdFigure } from "../../lib/finance-format";

/** Whole-dollar USD (`$75,000`) for the fundraising pages; masked while amounts are hidden. */
export const usd = (cents: number) => usdFigure(cents / 100, 0, i18n.locale || "en");

/** `usd` for an amount that may not exist; null stays null so the caller shows its own empty mark. */
export const usdOrNull = (cents: number | null) => (cents == null ? null : usd(cents));

/** An ISO datetime as `Oct 16` on its UTC day, with the year when it is not this one. */
export const isoShortDay = (iso: string) =>
  shortDay(iso.slice(0, 10), new Date(), i18n.locale || "en");
