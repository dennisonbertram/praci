import { describe, expect, it } from "vitest";
import {
  isUiLocale,
  normalizeUiLocale,
  pickUiLocale,
  UI_LOCALE_LABELS,
  UI_LOCALES,
} from "./ui-locale.js";

describe("ui locale", () => {
  it("labels every locale", () => {
    expect(Object.keys(UI_LOCALE_LABELS).sort()).toEqual([...UI_LOCALES].sort());
    expect(isUiLocale("fr")).toBe(true);
    expect(isUiLocale("pt")).toBe(false);
    expect(isUiLocale(null)).toBe(false);
  });

  it("maps Portuguese and Spanish tags", () => {
    expect(normalizeUiLocale("pt")).toBe("pt-BR");
    expect(normalizeUiLocale("pt_PT")).toBe("pt-BR");
    expect(normalizeUiLocale("es-MX")).toBe("es");
    expect(normalizeUiLocale("de-DE")).toBe("de");
  });

  it("maps only Simplified Chinese to zh-CN", () => {
    for (const tag of ["zh", "zh-CN", "zh_cn", "zh-Hans", "zh-SG", "zh-Hans-CN"]) {
      expect(normalizeUiLocale(tag)).toBe("zh-CN");
    }
    for (const tag of ["zh-TW", "zh-HK", "zh-Hant"]) {
      expect(normalizeUiLocale(tag)).toBe("en");
    }
  });

  it("falls back to English", () => {
    expect(normalizeUiLocale(undefined)).toBe("en");
    expect(normalizeUiLocale("ja-JP")).toBe("en");
  });

  it("picks the first present candidate", () => {
    expect(pickUiLocale("ko", "de", "fr")).toBe("ko");
    expect(pickUiLocale(null, "de-AT", "fr")).toBe("de");
    expect(pickUiLocale(null, "", "pt-PT")).toBe("pt-BR");
    expect(pickUiLocale()).toBe("en");
  });
});
