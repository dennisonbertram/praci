import * as z from "zod";
import { Id } from "./ids.js";

/** The one place the Inbox agent's spawn key is built. */
export const inboxAgentSpawnKey = (userId: string) => `inbox-agent:${userId}`;

export const isInboxAgentSpawnKey = (spawnKey: string | null | undefined) =>
  Boolean(spawnKey?.startsWith(inboxAgentSpawnKey("")));

/** Connection.displayName labels the account tab. */
export const MailAccountSchema = z.object({ connectionId: Id, label: z.string() });

export const InboxPrioritySchema = z.enum(["critical", "important", "normal", "low"]);
export type InboxPriority = z.infer<typeof InboxPrioritySchema>;

/** What triage calls a message. `reply` and `action` came first; the rest widen the set for views. */
export const InboxCategorySchema = z.enum([
  "reply",
  "action",
  "billing",
  "receipt",
  "scheduling",
  "newsletter",
  "security",
  "notification",
  "personal",
  "fyi",
  "bulk",
  "suspicious",
  "spam",
  "scam",
]);
export type InboxCategory = z.infer<typeof InboxCategorySchema>;

/** A user's mark on a sender: "important" mail ranks up, "noise" mail is left out of Needs reply and to-dos. */
export const InboxMarkSchema = z.enum(["important", "noise"]);
export type InboxMark = z.infer<typeof InboxMarkSchema>;

/** The categories the Inbox offers as views. The rest stay visible in the list but have no view. */
export const InboxViewCategorySchema = z.enum([
  "billing",
  "receipt",
  "scheduling",
  "newsletter",
  "security",
  "notification",
  "personal",
]);

/** `important` is priority critical or important, or needs a reply, or a sender marked important. */
export const InboxViewSchema = z.enum(["all", "important"]);

export const MailRowSchema = z.object({
  id: Id,
  connectionId: Id,
  threadId: z.string(),
  from: z.string(),
  subject: z.string(),
  snippet: z.string(),
  receivedAt: z.string(),
  unread: z.boolean(),
  /** Null until triaged, and while triage is not enabled. Already-answered threads are false. */
  needsReply: z.boolean().nullable(),
  priority: InboxPrioritySchema.nullable(),
  reason: z.string().nullable(),
  /** Null until triaged, and while triage is not enabled. */
  category: InboxCategorySchema.nullable(),
  /** The user's mark on this sender; null when unmarked and while triage is not enabled. */
  feedback: InboxMarkSchema.nullable(),
});

/** Which account a request covers; omitted means every connected mail account. */
export const InboxScopeInputSchema = z.object({ connectionId: Id.optional() });

/** Gmail filters, each one a fixed Gmail search term. */
export const InboxFilterSchema = z.enum([
  "unread",
  "starred",
  "important",
  "attachment",
  "primary",
  "promotions",
  "social",
  "updates",
]);

/**
 * With a `filter` or a `query` the list is read live from Gmail, newest first, 50 per account.
 * `query` is Gmail search syntax, passed through. `pageToken` is the opaque `nextPageToken`
 * of the previous response.
 * `view` and `category` narrow the cached list by triage results and cannot be combined with a
 * `filter` or `query`. Both are ignored while triage is not enabled.
 */
export const InboxListInputSchema = InboxScopeInputSchema.extend({
  filter: InboxFilterSchema.optional(),
  query: z.string().max(500).optional(),
  view: InboxViewSchema.optional(),
  category: InboxViewCategorySchema.optional(),
  pageToken: z.string().max(4096).optional(),
});

/** Why triage is off: no usable model, or the user has not allowed the model's recipient yet. */
export const TriageBlockedSchema = z.discriminatedUnion("reason", [
  z.object({ reason: z.literal("no_model") }),
  z.object({
    reason: z.literal("needs_consent"),
    /** The exact recipient `aiConsent.allow` must be given; `name` is what to show the user. */
    recipient: z.object({ key: z.string(), name: z.string() }),
  }),
]);
export type TriageBlocked = z.infer<typeof TriageBlockedSchema>;

export const InboxListOutputSchema = z.object({
  /** Empty means no mail account is connected. */
  accounts: z.array(MailAccountSchema),
  /** The unarchived Inbox agent, if any. */
  agent: z.object({ botId: Id, name: z.string() }).nullable(),
  /** Newest first, one row per thread. */
  rows: z.array(MailRowSchema),
  /** Newest lastSyncedAt; null means never synced. */
  syncedAt: z.string().nullable(),
  /** Accounts whose last sync failed outright; a sync that only came up short is not a failure. */
  failedAccounts: z.array(Id),
  /** The failed accounts whose login the provider refused: they need reconnecting. */
  reconnectAccounts: z.array(Id),
  /** True when triage can run: a usable model the user has allowed. Clients hide triage UI otherwise. */
  enabled: z.boolean(),
  /** Why `enabled` is false; null when triage can run. */
  triageBlocked: TriageBlockedSchema.nullable(),
  /** True while connected-account mail still waits for triage; clients refetch a few times. */
  triagePending: z.boolean(),
  /** Only on filtered or searched lists: present while Gmail has more results. */
  nextPageToken: z.string().optional(),
});

export const InboxTodoSchema = z.object({
  id: Id,
  connectionId: Id,
  /** Null once the message left the 14-day cache. */
  messageId: Id.nullable(),
  text: z.string(),
  /** The message's one-line reason. */
  detail: z.string().nullable(),
  /** Sender of the message, if it is still cached. */
  from: z.string().nullable(),
  priority: InboxPrioritySchema.nullable(),
  /** YYYY-MM-DD */
  dueOn: z.string().nullable(),
  doneAt: z.string().nullable(),
});

export const InboxTodosOutputSchema = z.object({
  enabled: z.boolean(),
  /** Open to-dos plus those finished in the last 24 hours. Empty when not enabled. */
  todos: z.array(InboxTodoSchema),
});

export const InboxMessageSchema = z.object({
  from: z.string(),
  to: z.string(),
  date: z.string(),
  subject: z.string(),
  html: z.string().nullable(),
  text: z.string().nullable(),
  /** Files to offer; pictures the body embeds are left out. */
  attachments: z.array(
    z.object({
      id: z.string(),
      filename: z.string(),
      mimeType: z.string(),
      size: z.number().int().nonnegative(),
    }),
  ),
});

/** `mark: null` removes the mark from the message's sender. */
export const InboxFeedbackInputSchema = z.object({
  messageId: Id,
  mark: InboxMarkSchema.nullable(),
});
export const InboxFeedbackOutputSchema = z.object({ mark: InboxMarkSchema.nullable() });

export type InboxFeedbackInput = z.infer<typeof InboxFeedbackInputSchema>;
export type InboxListInput = z.infer<typeof InboxListInputSchema>;
export type InboxMessage = z.infer<typeof InboxMessageSchema>;
export type InboxTodo = z.infer<typeof InboxTodoSchema>;
export type MailRow = z.infer<typeof MailRowSchema>;
export type InboxListOutput = z.infer<typeof InboxListOutputSchema>;
