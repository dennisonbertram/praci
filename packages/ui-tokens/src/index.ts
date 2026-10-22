export const APPEARANCE_PREFERENCES = ["system", "light", "dark"] as const;

export type AppearancePreference = (typeof APPEARANCE_PREFERENCES)[number];

export type ResolvedAppearance = "light" | "dark";

export const UI_APPEARANCE_STORAGE_KEY = "rakazo.uiAppearance";

/**
 * Semantic palette shared by web, Electron, and Expo. Names follow the shadcn
 * convention so the same slot means the same thing on every surface: a `border`
 * is always a border and never a fill.
 */
export type ColorTokens = {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  chatUser: string;
  chatUserForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
  sidebar: string;
  sidebarForeground: string;
  sidebarBorder: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  link: string;
  /** Backing behind a link's site icon. White in both themes so dark logos stay visible. */
  faviconPlate: string;
  success: string;
  warning: string;
  statusWorking: string;
  overlay: string;
  scrollbar: string;
  scrollbarHover: string;
};

export const darkTokens = {
  background: "#1C1C1A",
  foreground: "#ECEBE6",
  card: "#252523",
  cardForeground: "#ECEBE6",
  popover: "#252523",
  popoverForeground: "#ECEBE6",
  primary: "#F1F0EB",
  primaryForeground: "#1C1C1A",
  secondary: "#282826",
  secondaryForeground: "#ECEBE6",
  chatUser: "#33322F",
  chatUserForeground: "#ECEBE6",
  muted: "#252523",
  mutedForeground: "#9C9A93",
  accent: "#2A2927",
  accentForeground: "#ECEBE6",
  destructive: "#F46262",
  destructiveForeground: "#1C1C1A",
  border: "#2E2D2A",
  input: "#4A4944",
  ring: "#ECEBE6",
  sidebar: "#222220",
  sidebarForeground: "#ECEBE6",
  sidebarBorder: "#2A2926",
  sidebarAccent: "#2A2927",
  sidebarAccentForeground: "#ECEBE6",
  link: "#4F8FF7",
  faviconPlate: "#FFFFFF",
  success: "#4ECB71",
  warning: "#E9C46A",
  statusWorking: "#4F8FF7",
  overlay: "rgba(8, 8, 7, 0.72)",
  scrollbar: "#2E2D2A",
  scrollbarHover: "#45443F",
} as const satisfies ColorTokens;

export const lightTokens = {
  background: "#FAFAF8",
  foreground: "#1A1A1A",
  card: "#FFFFFF",
  cardForeground: "#1A1A1A",
  popover: "#FFFFFF",
  popoverForeground: "#1A1A1A",
  primary: "#1A1A1A",
  primaryForeground: "#F1F1EF",
  secondary: "#F0F0ED",
  secondaryForeground: "#1A1A1A",
  chatUser: "#E2E2DC",
  chatUserForeground: "#1A1A1A",
  muted: "#F0F0ED",
  mutedForeground: "#666669",
  accent: "#EAEAE6",
  accentForeground: "#1A1A1A",
  destructive: "#DC2626",
  destructiveForeground: "#FFFFFF",
  border: "#F0F0ED",
  input: "#C8C8C4",
  ring: "#1A1A1A",
  sidebar: "#ECECE9",
  sidebarForeground: "#1A1A1A",
  sidebarBorder: "#E8E8E4",
  sidebarAccent: "#FFFFFF",
  sidebarAccentForeground: "#1A1A1A",
  link: "#2563EB",
  faviconPlate: "#FFFFFF",
  success: "#228B3B",
  warning: "#B7791F",
  statusWorking: "#2563EB",
  overlay: "rgba(20, 20, 22, 0.45)",
  scrollbar: "#C8C8C4",
  scrollbarHover: "#A8A8A4",
} as const satisfies ColorTokens;

/** Dark palette. Prefer `tokensForAppearance` when theme-aware. */
export const tokens = darkTokens;

export const RADIUS = "0.75rem";

export const botColors = [
  "#3EC5A8",
  "#F5A03C",
  "#6A6BF5",
  "#9B5CF6",
  "#3B82F6",
  "#F2622A",
  "#D9508A",
] as const;

export function isAppearancePreference(
  value: string | null | undefined,
): value is AppearancePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function normalizeAppearancePreference(
  raw: string | null | undefined,
): AppearancePreference {
  return isAppearancePreference(raw) ? raw : "system";
}

export type ResolveAppearancePreferenceOptions = {
  stored?: string | null;
  storage?: Pick<Storage, "getItem"> | null;
};

function getLocalStorage(): Pick<Storage, "getItem" | "setItem"> | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

export function resolveAppearancePreference(
  options: ResolveAppearancePreferenceOptions = {},
): AppearancePreference {
  const stored =
    options.stored !== undefined
      ? options.stored
      : readStoredAppearance(options.storage ?? getLocalStorage());
  return normalizeAppearancePreference(stored);
}

export function persistAppearancePreference(
  preference: AppearancePreference,
  storage: Pick<Storage, "setItem"> | null = getLocalStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(UI_APPEARANCE_STORAGE_KEY, preference);
  } catch {
    // Ignore quota / private-mode failures; in-memory preference still applies.
  }
}

export function resolveAppearance(
  preference: AppearancePreference,
  system: ResolvedAppearance = "dark",
): ResolvedAppearance {
  if (preference === "system") return system;
  return preference;
}

export function tokensForAppearance(appearance: ResolvedAppearance): ColorTokens {
  return appearance === "light" ? lightTokens : darkTokens;
}

function readStoredAppearance(storage: Pick<Storage, "getItem"> | null | undefined): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(UI_APPEARANCE_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** `cardForeground` -> `--card-foreground` */
export function cssVariableName(token: keyof ColorTokens): string {
  return `--${token.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}

function renderBlock(selector: string, colorScheme: ResolvedAppearance, palette: ColorTokens) {
  const lines = (Object.keys(palette) as (keyof ColorTokens)[]).map(
    (token) => `  ${cssVariableName(token)}: ${palette[token].toLowerCase()};`,
  );
  return `${selector} {\n  color-scheme: ${colorScheme};\n${lines.join("\n")}\n  --radius: ${RADIUS};\n}`;
}

/** The CSS in `tokens.css`. Generated from the TS palette so both stay in sync. */
export function renderTokensCss(): string {
  return `${[
    "/* Generated by `pnpm --filter @rakazo/ui-tokens generate`. Edit src/index.ts instead. */",
    renderBlock(':root,\n[data-theme="dark"]', "dark", darkTokens),
    renderBlock('[data-theme="light"]', "light", lightTokens),
  ].join("\n\n")}\n`;
}

const channel = (value: number) => {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** WCAG relative luminance of a `#rrggbb` colour. */
function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}

export const ACCENT_LIGHT_FOREGROUND = "#ffffff";
export const ACCENT_DARK_FOREGROUND = "#111111";

/** White or near-black, whichever reads better on `hex`. */
export function accentForeground(hex: string): string {
  const l = luminance(hex);
  const onWhite = 1.05 / (l + 0.05);
  const onDark = (l + 0.05) / (luminance(ACCENT_DARK_FOREGROUND) + 0.05);
  return onWhite >= onDark ? ACCENT_LIGHT_FOREGROUND : ACCENT_DARK_FOREGROUND;
}

/** The `#rrggbb` accent in a stored bot `color` ("#3B82F6" or "#3B82F6::shape_7"); null for images or garbage. */
export function botAccentHex(raw: string | null | undefined): string | null {
  const hex = raw?.split("::")[0];
  return hex && /^#[0-9a-f]{6}$/i.test(hex) ? hex : null;
}

/** The `--bot-accent` pair a thread container sets so its descendants use the bot's colour. */
export function botAccentStyle(hex: string): Record<`--${string}`, string> {
  return { "--bot-accent": hex, "--bot-accent-foreground": accentForeground(hex) };
}
