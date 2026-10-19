import type { ColorTokens } from "@rakazo/ui-tokens";
import { createContext, useContext } from "react";
import { accentTokens } from "./accent-tokens";
import { useMobileTokens } from "./native";

/** The open bot's colour; null in a group or when no bot is open, which keeps the thread monochrome. */
export const BotAccentContext = createContext<string | null>(null);

export function useAccentedTokens(): ColorTokens {
  return accentTokens(useMobileTokens(), useContext(BotAccentContext));
}
