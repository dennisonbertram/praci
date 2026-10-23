import type { Bot } from "@rakazo/contracts";
import { useEffect } from "react";

/** A route bot that stays unknown this long is treated as gone, so the link shows "not found". */
export const ROUTE_BOT_GIVE_UP_MS = 3000;

export function useGiveUpOnMissingBot(
  waiting: boolean,
  key: string | undefined,
  giveUp: () => void,
) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: restart only when the wait or the route changes
  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(giveUp, ROUTE_BOT_GIVE_UP_MS);
    return () => clearTimeout(timer);
  }, [waiting, key]);
}

/** The route's bot id was first missing from the list; refreshes numbered above `epoch` started after that. */
export type MissingBotSeen = { id: string; epoch: number };

/**
 * Picks the bot a /app/:botId route shows. A bot the list does not know yet (just created
 * elsewhere) waits for one refresh that started after the id was first seen; only then does the
 * route fall back to the first bot.
 */
export function resolveRouteBot(input: {
  bots: Bot[];
  botId: string | undefined;
  loaded: boolean;
  seen: MissingBotSeen | null;
  applied: number;
  /** Bots that open only when the address names them, never as the fallback (a page's agent). */
  namedOnly?: (bot: Bot) => boolean;
}): { bot: Bot | undefined; waiting: boolean; needsRefresh: boolean } {
  const { bots, botId, loaded, seen, applied } = input;
  const first = bots.find((bot) => !input.namedOnly?.(bot));
  const found = bots.find((bot) => bot.id === botId);
  if (found || !botId || !loaded)
    return { bot: found ?? first, waiting: false, needsRefresh: false };
  const tracked = seen?.id === botId;
  if (tracked && applied > seen.epoch) return { bot: first, waiting: false, needsRefresh: false };
  return { bot: undefined, waiting: true, needsRefresh: !tracked };
}

/** A route given up on as missing is real after all once a stored list holds its bot. */
export function shouldClearMissingBot(
  missingPath: string | null,
  pathname: string,
  bots: Bot[],
  botId: string | undefined,
): boolean {
  return missingPath === pathname && bots.some((bot) => bot.id === botId);
}
