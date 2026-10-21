import * as z from "zod";

export const gtmAgentSpawnKey = (userId: string) => `gtm-agent:${userId}`;

export const isGtmAgentSpawnKey = (spawnKey: string | null | undefined) =>
  Boolean(spawnKey?.startsWith(gtmAgentSpawnKey("")));

export const GTM_WORK_ROUTINE_NAME = "Work the plan";

/** Runtime gates further restrict browser and takeover tools. Posting is registered in S3c. */
export const GTM_AGENT_BUILTIN_TOOLS = [
  "web_search",
  "web_fetch",
  "browser_navigate",
  "browser_snapshot",
  "browser_act",
  "request_takeover",
  "request_secret",
  "list_secrets",
  "scratchpad_list",
  "scratchpad_add",
  "scratchpad_update",
  "scratchpad_complete",
  "scratchpad_remove",
  "page_read",
  "page_write",
  "page_edit",
  "mail_search",
  "mail_grep",
  "mail_get",
  "message_user",
  "remember",
  "save_memory",
  "recall_memory",
  "forget_memory",
] as const;

export const GTM_CHANNELS = {
  x: { label: "X", category: "public_post", approval: "every_item", platform: "twitter" },
  linkedin: {
    label: "LinkedIn",
    category: "public_post",
    approval: "every_item",
    platform: "linkedin",
  },
  threads: {
    label: "Threads",
    category: "public_post",
    approval: "every_item",
    platform: "threads",
  },
  bluesky: {
    label: "Bluesky",
    category: "public_post",
    approval: "every_item",
    platform: "bluesky",
  },
  reddit: { label: "Reddit", category: "draft", approval: "draft_only" },
  hn: { label: "Hacker News", category: "draft", approval: "draft_only" },
  producthunt: { label: "Product Hunt", category: "draft", approval: "draft_only" },
  directory: { label: "Directories", category: "create_account", approval: "directory_policy" },
  email: { label: "Email", category: "outbound_email", approval: "every_item" },
} as const;

/** App-owned REST adapter tool, never a remote MCP tool. */
export const GTM_POST_TOOL = "gtm_post";

/** The executor matches these unchanged values against one approved item before consuming it. */
export const GtmPostInputSchema = z.strictObject({
  content: z.string().min(1),
  scheduledFor: z.string().datetime({ offset: true }),
  accountId: z.string().min(1).max(200),
});
export type GtmPostInput = z.infer<typeof GtmPostInputSchema>;
