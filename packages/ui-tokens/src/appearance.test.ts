import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ColorTokens } from "./index.js";
import {
  accentForeground,
  botAccentHex,
  botAccentStyle,
  botColors,
  cssVariableName,
  darkTokens,
  lightTokens,
  normalizeAppearancePreference,
  persistAppearancePreference,
  renderTokensCss,
  resolveAppearance,
  resolveAppearancePreference,
  tokensForAppearance,
  UI_APPEARANCE_STORAGE_KEY,
} from "./index.js";

describe("appearance preference", () => {
  it("defaults unknown values to system", () => {
    expect(normalizeAppearancePreference(null)).toBe("system");
    expect(normalizeAppearancePreference("nope")).toBe("system");
    expect(normalizeAppearancePreference("light")).toBe("light");
  });

  it("resolves system from the platform scheme", () => {
    expect(resolveAppearance("system", "light")).toBe("light");
    expect(resolveAppearance("system", "dark")).toBe("dark");
    expect(resolveAppearance("dark", "light")).toBe("dark");
  });

  it("reads and writes storage", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    };
    expect(resolveAppearancePreference({ storage })).toBe("system");
    persistAppearancePreference("light", storage);
    expect(store.get(UI_APPEARANCE_STORAGE_KEY)).toBe("light");
    expect(resolveAppearancePreference({ storage })).toBe("light");
  });

  it("returns distinct light and dark token sets", () => {
    expect(tokensForAppearance("dark")).toBe(darkTokens);
    expect(tokensForAppearance("light")).toBe(lightTokens);
    for (const key of Object.keys(darkTokens) as (keyof ColorTokens)[]) {
      if (key === "destructiveForeground" || key === "faviconPlate") continue;
      expect(darkTokens[key], key).not.toBe(lightTokens[key]);
    }
  });

  it("keeps working-state blue in its own semantic token across themes", () => {
    expect(darkTokens.statusWorking).toBeTruthy();
    expect(lightTokens.statusWorking).toBeTruthy();
    expect(darkTokens.statusWorking).toBe(darkTokens.link);
    expect(lightTokens.statusWorking).toBe(lightTokens.link);
    expect(darkTokens.statusWorking).not.toBe(darkTokens.primary);
    expect(lightTokens.statusWorking).not.toBe(lightTokens.primary);
  });

  it("keeps user message surfaces muted, not cream invert", () => {
    const dark = tokensForAppearance("dark");
    const light = tokensForAppearance("light");
    expect(dark.secondary).not.toBe(dark.primary);
    expect(light.secondary).not.toBe(light.primary);
    expect(dark.secondaryForeground).not.toBe(dark.primaryForeground);
  });

  it("separates user bubbles from bot bubbles and the sidebar from the app", () => {
    const dark = tokensForAppearance("dark");
    const light = tokensForAppearance("light");
    expect(dark.chatUser).not.toBe(dark.muted);
    expect(light.chatUser).not.toBe(light.muted);
    expect(dark.sidebar).not.toBe(dark.background);
    expect(light.sidebar).not.toBe(light.background);
  });

  it("tolerates a throwing localStorage getter", () => {
    const desc = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("blocked");
      },
    });
    try {
      expect(resolveAppearancePreference()).toBe("system");
      persistAppearancePreference("light");
      expect(resolveAppearancePreference()).toBe("system");
    } finally {
      if (desc) Object.defineProperty(globalThis, "localStorage", desc);
      else delete (globalThis as { localStorage?: Storage }).localStorage;
    }
  });
});

describe("tokens.css", () => {
  it("derives kebab-case variable names", () => {
    expect(cssVariableName("background")).toBe("--background");
    expect(cssVariableName("mutedForeground")).toBe("--muted-foreground");
    expect(cssVariableName("sidebarAccentForeground")).toBe("--sidebar-accent-foreground");
  });

  it("is generated from the TS palette", () => {
    const onDisk = readFileSync(fileURLToPath(new URL("./tokens.css", import.meta.url)), "utf8");
    expect(onDisk).toBe(renderTokensCss());
  });

  it("scopes light and dark under data-theme", () => {
    const css = renderTokensCss();
    expect(css).toContain('[data-theme="dark"] {\n  color-scheme: dark;');
    expect(css).toContain('[data-theme="light"] {\n  color-scheme: light;');
    expect(css).toContain(`--background: ${lightTokens.background.toLowerCase()};`);
    expect(css).toContain(`--background: ${darkTokens.background.toLowerCase()};`);
  });
});

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const channel = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe("input borders", () => {
  for (const [name, palette] of [
    ["dark", darkTokens],
    ["light", lightTokens],
  ] as const) {
    it(`keeps ${name} input borders visible on the page, cards and dialogs`, () => {
      for (const surface of ["background", "card", "popover"] as const) {
        expect(contrast(palette.input, palette[surface])).toBeGreaterThanOrEqual(1.6);
      }
    });
  }
});

describe("text contrast", () => {
  const surfaces = ["background", "card", "muted", "accent", "secondary", "sidebar"] as const;
  for (const [name, palette] of [
    ["dark", darkTokens],
    ["light", lightTokens],
  ] as const) {
    it(`keeps foreground and muted text at WCAG AA on every ${name} surface`, () => {
      for (const surface of surfaces) {
        expect(
          contrast(palette.foreground, palette[surface]),
          `foreground on ${surface}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
      // Muted text is the dimmest text rows use (inbox previews), including on a hovered or selected row.
      for (const surface of ["background", "card", "muted", "sidebar"] as const) {
        expect(
          contrast(palette.mutedForeground, palette[surface]),
          `muted on ${surface}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    });
  }

  const statusText = ["destructive", "link", "statusWorking", "success", "warning"] as const;
  const raised = ["background", "card", "popover", "muted", "accent", "secondary"] as const;

  it("keeps every dark status and link colour at AA as text on every dark surface", () => {
    for (const color of statusText) {
      for (const surface of raised) {
        expect(
          contrast(darkTokens[color], darkTokens[surface]),
          `${color} on ${surface}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  // Light destructive and link pass on the page and cards. Light success and warning, and every
  // light status colour on muted/accent fills, are below AA today; those light tokens are unchanged.
  it("keeps light error and link text at AA on the page, cards and popovers", () => {
    for (const color of ["destructive", "link"] as const) {
      for (const surface of ["background", "card", "popover"] as const) {
        expect(
          contrast(lightTokens[color], lightTokens[surface]),
          `${color} on ${surface}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  for (const [name, palette] of [
    ["dark", darkTokens],
    ["light", lightTokens],
  ] as const) {
    it(`keeps labels on filled ${name} controls at AA`, () => {
      for (const [fill, label] of [
        ["destructive", "destructiveForeground"],
        ["primary", "primaryForeground"],
        ["secondary", "secondaryForeground"],
        ["card", "cardForeground"],
        ["popover", "popoverForeground"],
        ["accent", "accentForeground"],
        ["chatUser", "chatUserForeground"],
        ["sidebarAccent", "sidebarAccentForeground"],
      ] as const) {
        expect(
          contrast(palette[label], palette[fill]),
          `${label} on ${fill}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    });
  }

  it("keeps the dark palette warm and its surfaces stepped in order", () => {
    const warm = (hex: string) =>
      Number.parseInt(hex.slice(1, 3), 16) >= Number.parseInt(hex.slice(5, 7), 16);
    for (const token of [
      "background",
      "foreground",
      "card",
      "muted",
      "accent",
      "border",
      "mutedForeground",
    ] as const) {
      expect(warm(darkTokens[token]), token).toBe(true);
    }
    const lum = (token: keyof typeof darkTokens) => luminance(darkTokens[token]);
    expect(lum("background")).toBeLessThan(lum("sidebar"));
    expect(lum("sidebar")).toBeLessThan(lum("card"));
    expect(lum("card")).toBeLessThan(lum("accent"));
    expect(lum("accent")).toBeLessThan(lum("chatUser"));
  });
});

describe("dark input contrast", () => {
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  it("keeps input borders and switch tracks visible on a card", () => {
    const input = luminance(darkTokens.input);
    const card = luminance(darkTokens.card);
    const ratio = (Math.max(input, card) + 0.05) / (Math.min(input, card) + 0.05);
    expect(ratio).toBeGreaterThanOrEqual(1.3);
  });
});

describe("bot accent", () => {
  it("picks a readable foreground for every palette colour", () => {
    for (const hex of botColors) {
      const fg = accentForeground(hex);
      const l = (h: string) => {
        const n = Number.parseInt(h.slice(1), 16);
        const c = (v: number) => {
          const x = v / 255;
          return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * c((n >> 16) & 255) + 0.7152 * c((n >> 8) & 255) + 0.0722 * c(n & 255);
      };
      const [hi, lo] = [Math.max(l(hex), l(fg)), Math.min(l(hex), l(fg))];
      expect((hi + 0.05) / (lo + 0.05)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("chooses white on dark colours and near-black on light ones", () => {
    expect(accentForeground("#000000")).toBe("#ffffff");
    expect(accentForeground("#ffffff")).toBe("#111111");
  });
  it("sets the two custom properties a thread container needs", () => {
    expect(botAccentStyle("#3B82F6")).toEqual({
      "--bot-accent": "#3B82F6",
      "--bot-accent-foreground": accentForeground("#3B82F6"),
    });
  });
});

describe("botAccentHex", () => {
  it("returns the colour before the avatar shape suffix", () => {
    expect(botAccentHex("#3B82F6::shape_7")).toBe("#3B82F6");
    expect(botAccentHex("#3B82F6")).toBe("#3B82F6");
  });
  it("returns null for images, names and empty values", () => {
    expect(botAccentHex("data:image/png;base64,AAAA")).toBeNull();
    expect(botAccentHex("blue")).toBeNull();
    expect(botAccentHex("")).toBeNull();
    expect(botAccentHex(null)).toBeNull();
  });
});
