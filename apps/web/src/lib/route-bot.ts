import type { Bot } from "@rakazo/contracts";

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
}): { bot: Bot | undefined; waiting: boolean; needsRefresh: boolean } {
  const { bots, botId, loaded, seen, applied } = input;
  const found = bots.find((bot) => bot.id === botId);
  if (found || !botId || !loaded)
    return { bot: found ?? bots[0], waiting: false, needsRefresh: false };
  const tracked = seen?.id === botId;
  if (tracked && applied > seen.epoch) return { bot: bots[0], waiting: false, needsRefresh: false };
  return { bot: undefined, waiting: true, needsRefresh: !tracked };
}
