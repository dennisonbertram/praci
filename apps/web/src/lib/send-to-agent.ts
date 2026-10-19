import type { Bot, DataRoomApiItem } from "@rakazo/contracts";
import { ATTACHMENT_MAX_COUNT, botCanReadDataRoom } from "@rakazo/contracts";
import type { SendTarget } from "../components/data-room/SendToAgent";

/** A Data room file waiting in an agent's composer, sent by reference with the next message. */
export type DataRoomRef = Pick<DataRoomApiItem, "id" | "name" | "mimeType"> & { threadKey: string };

/** Agents a file can be sent to, the most recently active first. */
export function sendTargets(bots: Bot[]): SendTarget[] {
  return bots
    .filter((bot) => !bot.archivedAt)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
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
