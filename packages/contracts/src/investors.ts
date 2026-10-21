/** The one place the Investors agent's spawn key is built. */
export const investorsAgentSpawnKey = (userId: string) => `investors-agent:${userId}`;

export const isInvestorsAgentSpawnKey = (spawnKey: string | null | undefined) =>
  Boolean(spawnKey?.startsWith(investorsAgentSpawnKey("")));

/**
 * The only built-in tools the Investors agent is offered. It never gets mail_send (mail goes out
 * from the page on the founder's click) or any MCP or Composio tool. cap_table_update writes only
 * as the table's Google Sheet source (the database refuses it otherwise). Each slice that adds a
 * tool for it adds the name here.
 */
export const INVESTORS_AGENT_BUILTIN_TOOLS = [
  "cap_table_read",
  "cap_table_update",
  "contacts_list",
  "contacts_add",
  "contacts_save",
  "finance_overview",
  "finance_breakdown",
  "search_data_room",
  "read_data_room_item",
  "read_spreadsheet",
  "mail_search",
  "mail_grep",
  "mail_get",
  "mail_draft",
  "drive_search",
  "drive_read",
  "message_bot",
  "remember",
  "save_memory",
  "recall_memory",
  "forget_memory",
  "save_shared_memory",
  "ask_user",
  "notify_user",
] as const;
