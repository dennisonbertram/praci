const RAIL_VALUE = "rail";
const STORAGE_PREFIX = "rakazo:bots-sidebar-collapsed:";

/** The Inbox agent panel starts closed, like every page's agent; this remembers an explicit open. */
const INBOX_AGENT_STORAGE_PREFIX = "rakazo:inbox-agent-open:";

/** Like the Inbox agent, the Carta agent panel starts closed; this remembers an explicit open. */
const CARTA_AGENT_STORAGE_PREFIX = "rakazo:carta-agent-open:";

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
    // "1" is the value from when collapsing hid the sidebar; it now means the icon rail.
    const value = window.localStorage.getItem(storageKey);
    return value === "1" || value === RAIL_VALUE;
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
    if (collapsed)
      window.localStorage.setItem(storageKey, prefix === STORAGE_PREFIX ? RAIL_VALUE : "1");
    else window.localStorage.removeItem(storageKey);
  } catch {
    // Ignore quota / private-mode failures; in-memory state still applies.
  }
}

export const readInboxAgentCollapsed = (userId: string | null | undefined) =>
  !readBotsSidebarCollapsed(userId, INBOX_AGENT_STORAGE_PREFIX);

export const writeInboxAgentCollapsed = (userId: string | null | undefined, collapsed: boolean) =>
  writeBotsSidebarCollapsed(userId, !collapsed, INBOX_AGENT_STORAGE_PREFIX);

export const readCartaAgentCollapsed = (userId: string | null | undefined) =>
  !readBotsSidebarCollapsed(userId, CARTA_AGENT_STORAGE_PREFIX);

export const writeCartaAgentCollapsed = (userId: string | null | undefined, collapsed: boolean) =>
  writeBotsSidebarCollapsed(userId, !collapsed, CARTA_AGENT_STORAGE_PREFIX);

/** Drag distance (px) before the edge handle commits expand/collapse. */
export const BOTS_SIDEBAR_EDGE_DRAG_PX = 40;
