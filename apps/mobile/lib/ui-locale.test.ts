import { describe, expect, it } from "vitest";
import {
  htmlLangForLocale,
  isUiLocale,
  normalizeUiLocale,
  resolveUiLocale,
  UI_LOCALE_LABELS,
  UI_LOCALES,
} from "./ui-locale";

describe("UI_LOCALES", () => {
  it("offers every locale with a mobile catalog", () => {
    expect([...UI_LOCALES]).toEqual([
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
    ]);
    expect(Object.keys(UI_LOCALE_LABELS).sort()).toEqual([...UI_LOCALES].sort());
    for (const locale of ["ko", "tr", "hi", "pt-BR", "es", "fr"]) {
      expect(isUiLocale(locale)).toBe(true);
    }
    expect(isUiLocale("pt")).toBe(false);
    expect(isUiLocale("ru")).toBe(true);
    expect(isUiLocale("de")).toBe(true);
  });
});

describe("normalizeUiLocale", () => {
  it("maps regional tags onto supported locales", () => {
    expect(normalizeUiLocale("en-US")).toBe("en");
    expect(normalizeUiLocale("zh-CN")).toBe("zh-CN");
    expect(normalizeUiLocale("zh")).toBe("zh-CN");
    expect(normalizeUiLocale("zh-Hans")).toBe("zh-CN");
    expect(normalizeUiLocale("zh-SG")).toBe("zh-CN");
    expect(normalizeUiLocale("ru-RU")).toBe("ru");
    expect(normalizeUiLocale("ru_KZ")).toBe("ru");
    expect(normalizeUiLocale("de")).toBe("de");
    expect(normalizeUiLocale("de-DE")).toBe("de");
    expect(normalizeUiLocale("de-CH")).toBe("de");
    expect(normalizeUiLocale("de_AT")).toBe("de");
  });

  it("does not fold Traditional Chinese into Simplified", () => {
    expect(normalizeUiLocale("zh-TW")).toBe("en");
    expect(normalizeUiLocale("zh-HK")).toBe("en");
    expect(normalizeUiLocale("zh-Hant")).toBe("en");
  });

  it("maps the newer locales from regional device tags", () => {
    expect(normalizeUiLocale("fr-FR")).toBe("fr");
    expect(normalizeUiLocale("es_MX")).toBe("es");
    expect(normalizeUiLocale("ko-KR")).toBe("ko");
    expect(normalizeUiLocale("tr-TR")).toBe("tr");
    expect(normalizeUiLocale("hi-IN")).toBe("hi");
    expect(normalizeUiLocale("pt")).toBe("pt-BR");
    expect(normalizeUiLocale("pt-BR")).toBe("pt-BR");
    expect(normalizeUiLocale("pt-PT")).toBe("pt-BR");
  });

  it("falls back to English for unknown locales", () => {
    expect(normalizeUiLocale("it-IT")).toBe("en");
    expect(normalizeUiLocale("ja")).toBe("en");
    expect(normalizeUiLocale("")).toBe("en");
    expect(normalizeUiLocale(null)).toBe("en");
  });
});

describe("htmlLangForLocale", () => {
  it("keeps Simplified Chinese on zh-CN", () => {
    expect(htmlLangForLocale("zh-CN")).toBe("zh-CN");
    expect(htmlLangForLocale("en")).toBe("en");
  });
});

describe("resolveUiLocale", () => {
  it("prefers the saved choice over env and device language", () => {
    expect(
      resolveUiLocale({
        stored: "zh-CN",
        envDefault: "zh-CN",
        deviceLanguage: "en-US",
      }),
    ).toBe("zh-CN");
  });

  it("uses the env default, then device language, then English", () => {
    expect(
      resolveUiLocale({
        stored: null,
        envDefault: "zh-CN",
        deviceLanguage: "en-US",
      }),
    ).toBe("zh-CN");
    expect(
      resolveUiLocale({
        stored: null,
        envDefault: null,
        deviceLanguage: "zh-CN",
      }),
    ).toBe("zh-CN");
    expect(
      resolveUiLocale({
        stored: null,
        envDefault: null,
        deviceLanguage: null,
      }),
    ).toBe("en");
  });
});
