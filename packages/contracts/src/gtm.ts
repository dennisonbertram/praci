import * as z from "zod";
import {
  ScratchpadCategorySchema,
  ScratchpadChannelSchema,
  ScratchpadDateTimeSchema,
  ScratchpadItemSchema,
} from "./domain.js";
import { MailAccountSchema } from "./inbox.js";
import { ZernioPostingCapabilitySchema } from "./zernio.js";

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

export const GTM_PAGE_FENCES = ["gtm-plan", "gtm-channels", "gtm-metric"] as const;
export const GTM_PAGE_MAX_BLOCKS = 12;

export const GtmPlanBlockSchema = z.strictObject({
  group: z.enum(["in_progress", "drafts", "done"]),
  channel: z.array(ScratchpadChannelSchema).optional(),
  category: z.array(ScratchpadCategorySchema).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export const GtmChannelsBlockSchema = z.strictObject({});

export const GtmMetricBlockSchema = z.strictObject({
  label: z.string().min(1).max(40),
  count: z.enum(["done", "in_progress", "drafts", "needs_you"]),
  channel: ScratchpadChannelSchema.optional(),
  goal: z.number().finite().nonnegative().optional(),
});

export const GtmPageBlockSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("gtm-plan"), query: GtmPlanBlockSchema }),
  z.strictObject({ type: z.literal("gtm-channels"), query: GtmChannelsBlockSchema }),
  z.strictObject({ type: z.literal("gtm-metric"), query: GtmMetricBlockSchema }),
]);
export type GtmPageBlock = z.infer<typeof GtmPageBlockSchema>;

/** App-owned REST adapter tool, never a remote MCP tool. */
export const GTM_POST_TOOL = "gtm_post";

/** The executor matches these unchanged values against one approved item before consuming it. */
export const GtmPostInputSchema = z.strictObject({
  content: z.string().min(1),
  scheduledFor: z.string().datetime({ offset: true }),
  accountId: z.string().min(1).max(200),
});
export type GtmPostInput = z.infer<typeof GtmPostInputSchema>;

/** Queue windows are half-open: posts at `from` are included; posts at `to` are not. */
export const GtmQueueInputSchema = z
  .strictObject({
    from: ScratchpadDateTimeSchema,
    to: ScratchpadDateTimeSchema,
  })
  .refine(
    ({ from, to }) => {
      const start = Date.parse(from);
      const end = Date.parse(to);
      return end > start && end - start <= 31 * 86_400_000;
    },
    { message: "Queue window must be ordered and at most 31 days." },
  );
export type GtmQueueInput = z.infer<typeof GtmQueueInputSchema>;

function isSafePlatformPostUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export const GtmQueuePostPlatformSchema = z.strictObject({
  platform: z.string().min(1).max(100),
  accountId: z.string().min(1).max(200),
  status: z.string().min(1).max(100),
  platformPostUrl: z.string().url().refine(isSafePlatformPostUrl).optional(),
});

export const GtmQueuePostSchema = z.strictObject({
  id: z.string().min(1).max(200),
  content: z.string().max(20_000),
  status: z.string().min(1).max(100),
  scheduledFor: ScratchpadDateTimeSchema,
  platforms: z.array(GtmQueuePostPlatformSchema).max(50),
});

export const GtmQueueStatusSchema = z.enum([
  "not_connected",
  "api_key_required",
  "ready",
  "unavailable",
]);

export const GtmQueueOutputSchema = z
  .strictObject({
    status: GtmQueueStatusSchema,
    complete: z.boolean(),
    posts: z.array(GtmQueuePostSchema).max(1_000),
  })
  .refine((output) => output.status !== "unavailable" || !output.complete, {
    path: ["complete"],
    message: "Unavailable queue results cannot be complete.",
  });
export type GtmQueueOutput = z.infer<typeof GtmQueueOutputSchema>;

const GtmChannelStatusSchema = z.enum([
  "connected",
  "not_connected",
  "unavailable",
  "ready",
  "draft_only",
]);

export const GtmOverviewSchema = z.strictObject({
  goal: ScratchpadItemSchema.nullable(),
  groups: z.strictObject({
    needs_you: z.array(ScratchpadItemSchema),
    in_progress: z.array(ScratchpadItemSchema),
    drafts: z.array(ScratchpadItemSchema),
    done: z.array(ScratchpadItemSchema),
  }),
  counts: z.strictObject({
    needs_you: z.number().int().nonnegative(),
    in_progress: z.number().int().nonnegative(),
    drafts: z.number().int().nonnegative(),
    done: z.number().int().nonnegative(),
  }),
  channels: z.array(
    z.strictObject({
      channel: ScratchpadChannelSchema,
      status: GtmChannelStatusSchema,
      accounts: z.array(
        z.strictObject({
          id: z.string().min(1).max(200),
          platform: z.string().min(1).max(100),
          label: z.string().min(1).max(300),
        }),
      ),
    }),
  ),
  gmailAccounts: z.array(MailAccountSchema),
  zernioLinked: z.boolean(),
  postingCapability: ZernioPostingCapabilitySchema,
  nextRunAt: ScratchpadDateTimeSchema.nullable(),
  directoryPolicy: z.strictObject({
    founderApprovals: z.number().int().nonnegative(),
    autoOpenings: z.number().int().nonnegative(),
    approvalsBeforeAuto: z.number().int().positive(),
    dailyCap: z.number().int().positive(),
  }),
});
export type GtmOverview = z.infer<typeof GtmOverviewSchema>;
