import type { UiLocale } from "@rakazo/core";
import { pickUiLocale } from "@rakazo/core";

export type { UiLocale } from "@rakazo/core";
export {
  isUiLocale,
  normalizeUiLocale,
  UI_LOCALE_LABELS,
  UI_LOCALE_STORAGE_KEY,
} from "@rakazo/core";

// Picker order differs from web, so the mobile list stays here.
export const UI_LOCALES = [
  "en",
  "zh-CN",
  "ru",
  "de",
  "es",
  "fr",
  "pt-BR",
  "hi",
  "ko",
  "tr",
] as const satisfies readonly UiLocale[];

/** Convert an internal locale identifier to the document language tag. */
export function htmlLangForLocale(locale: string): string {
  return locale === "zh-CN" ? "zh-CN" : locale;
}

export type ResolveUiLocaleOptions = {
  stored?: string | null;
  envDefault?: string | null;
  deviceLanguage?: string | null;
};

/**
 * Order: saved choice → `EXPO_PUBLIC_DEFAULT_UI_LOCALE` → device language → English.
 */
export function resolveUiLocale(options: ResolveUiLocaleOptions = {}): UiLocale {
  return pickUiLocale(options.stored, options.envDefault, options.deviceLanguage);
}
