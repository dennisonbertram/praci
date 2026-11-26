/**
 * The built-in read tools a page source may call. Each one works from stored data given only
 * `{prisma, scope}` and the bot, applies the same owner/agent gates as a bot run, and is marked
 * readOnly in builtin-tools. Left out: meetings_list (consent is per model, and the text is
 * untrusted), search_data_room (needs the run's AI consent and returns untrusted snippets),
 * inbox_overview and calendar_agenda (need a mail or calendar provider and account tokens).
 */
export const PRACI_SOURCE_TOOLS = [
  "finance_overview",
  "finance_breakdown",
  "finance_transactions",
  "finance_recurring",
  "cap_table_read",
  "fundraising_read",
  "contacts_list",
  "board_tickets",
] as const;

export type PraciSourceTool = (typeof PRACI_SOURCE_TOOLS)[number];
