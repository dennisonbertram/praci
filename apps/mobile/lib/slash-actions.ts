import type { SLASH_INSERTS, SlashActionId } from "@rakazo/core";

/** A picker action: a screen to open, or (an insert) a command put in the draft. */
export type MobileSlashActionId = SlashActionId | (typeof SLASH_INSERTS)[number]["id"];

/** Where a picker action navigates; null when it navigates nowhere (an unknown action does not open Account). */
export function slashActionRoute(
  action: MobileSlashActionId,
  chat: { inGroup: boolean; groupId?: string; botId?: string },
): { pathname: string; params?: Record<string, string> } | null {
  if (action === "chat-settings") {
    if (chat.inGroup && chat.groupId) {
      return { pathname: "/group-settings", params: { groupId: chat.groupId } };
    }
    return chat.botId ? { pathname: "/bot-settings", params: { botId: chat.botId } } : null;
  }
  return action === "settings-general" ? { pathname: "/account" } : null;
}
