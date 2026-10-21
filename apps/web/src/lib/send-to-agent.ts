import type { Bot, DataRoomApiItem } from "@rakazo/contracts";
import {
  ATTACHMENT_MAX_COUNT,
  botCanReadDataRoom,
  FIRST_BOT_SPAWN_KEY,
  isMailThreadAgentSpawnKey,
} from "@rakazo/contracts";
import type { SendTarget } from "../components/data-room/SendToAgent";

/** A Data room file waiting in an agent's composer, sent by reference with the next message. */
export type DataRoomRef = Pick<DataRoomApiItem, "id" | "name" | "mimeType"> & { threadKey: string };

/** The agents of the pages a founder files documents for, ahead of the rest: Data room, Legal, Finance, then Chief. */
const PAGE_AGENT_PREFIXES = [
  "data-room-agent:",
  "legal-agent:",
  "finance-agent:",
  FIRST_BOT_SPAWN_KEY,
];
const pageRank = (bot: Bot) => {
  const rank = PAGE_AGENT_PREFIXES.findIndex((prefix) => bot.spawnKey?.startsWith(prefix));
  return rank === -1 ? PAGE_AGENT_PREFIXES.length : rank;
};

/**
 * Agents a file can be sent to: the page agents first, then the rest by recent activity. An agent
 * that belongs to one email thread is not a place to file a document, so it is left out.
 */
export function sendTargets(bots: Bot[]): SendTarget[] {
  return bots
    .filter((bot) => !bot.archivedAt && !isMailThreadAgentSpawnKey(bot.spawnKey))
    .sort((a, b) => pageRank(a) - pageRank(b) || b.updatedAt.localeCompare(a.updatedAt))
    .map(({ id, name, color }) => ({ id, name, color }));
}

/**
 * Files go by reference to an agent that can open the Data room, up to the per-message cap.
 * Every other agent gets the file itself as an ordinary attachment.
 */
export function planSendToAgent(
  bot: Pick<Bot, "spawnKey" | "disabledBuiltinTools">,
  items: DataRoomApiItem[],
): { refs: DataRoomApiItem[]; copies: DataRoomApiItem[] } {
  return botCanReadDataRoom(bot)
    ? { refs: items.slice(0, ATTACHMENT_MAX_COUNT), copies: [] }
    : { refs: [], copies: items };
}
