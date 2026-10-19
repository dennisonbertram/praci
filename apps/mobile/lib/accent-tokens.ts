import { accentForeground, type ColorTokens } from "@rakazo/ui-tokens";

/** Tokens where the user's bubble fill and the primary button take the bot colour. */
export function accentTokens(tokens: ColorTokens, accent: string | null): ColorTokens {
  if (!accent) return tokens;
  const foreground = accentForeground(accent);
  return {
    ...tokens,
    secondary: accent,
    secondaryForeground: foreground,
    primary: accent,
    primaryForeground: foreground,
    link: foreground,
  };
}
