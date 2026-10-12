const STORAGE_PREFIX = "rakazo:bots-sidebar-collapsed:";

const INBOX_AGENT_STORAGE_PREFIX = "rakazo:inbox-agent-collapsed:";

export function botsSidebarCollapsedStorageKey(
  userId: string | null | undefined,
  prefix = STORAGE_PREFIX,
): string | null {
  if (!userId) return null;
  return `${prefix}${userId}`;
}

export function readBotsSidebarCollapsed(
  userId: string | null | undefined,
  prefix = STORAGE_PREFIX,
): boolean {
  const storageKey = botsSidebarCollapsedStorageKey(userId, prefix);
  if (!storageKey) return false;
  try {
    return window.localStorage.getItem(storageKey) === "1";
  } catch {
    return false;
  }
}

export function writeBotsSidebarCollapsed(
  userId: string | null | undefined,
  collapsed: boolean,
  prefix = STORAGE_PREFIX,
): void {
  const storageKey = botsSidebarCollapsedStorageKey(userId, prefix);
  if (!storageKey) return;
  try {
    if (collapsed) window.localStorage.setItem(storageKey, "1");
    else window.localStorage.removeItem(storageKey);
  } catch {
    // Ignore quota / private-mode failures; in-memory state still applies.
  }
}

export const readInboxAgentCollapsed = (userId: string | null | undefined) =>
  readBotsSidebarCollapsed(userId, INBOX_AGENT_STORAGE_PREFIX);

export const writeInboxAgentCollapsed = (userId: string | null | undefined, collapsed: boolean) =>
  writeBotsSidebarCollapsed(userId, collapsed, INBOX_AGENT_STORAGE_PREFIX);

/** Drag distance (px) before the edge handle commits expand/collapse. */
export const BOTS_SIDEBAR_EDGE_DRAG_PX = 40;
