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
  /** False for search results already archived; only inbox mail can be archived. */
  inInbox: z.boolean(),
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
  /** The failed accounts the provider rate limited; optional so older servers and clients still match. */
  rateLimitedAccounts: z.array(Id).optional(),
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
  /** Empty when the message has no Cc. */
  cc: z.string(),
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

/** Chosen by the browser when a composer opens; it names that message for idempotency. */
export const ComposeClientId = z
  .string()
  .min(8)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);

export const ComposeModeSchema = z.enum(["reply", "replyAll", "forward"]);

export const ComposePrefillInputSchema = z.object({
  messageId: Id,
  mode: ComposeModeSchema,
  /** IANA zone and BCP 47 locale of the browser, for dates written into the quote. Default UTC, en-US. */
  timeZone: z.string().max(64).optional(),
  locale: z.string().max(35).optional(),
});

/** Fields are text as typed; recipients are comma-separated. The account is the one the original came from. */
export const ComposePrefillOutputSchema = z.object({
  connectionId: Id,
  to: z.string(),
  cc: z.string(),
  subject: z.string(),
  body: z.string(),
  /** A forward of an HTML mail: the original's sanitized HTML, to show below the forwarded header in `body`. */
  quotedHtml: z.string().optional(),
  /** Present for a reply, which stays in the original's thread; absent for a forward. */
  replyToMessageId: Id.optional(),
  /** A forward's original files (not inline pictures), to be attached again on send; [] otherwise. */
  attachments: z.array(
    z.object({
      id: z.string(),
      filename: z.string(),
      mimeType: z.string(),
      size: z.number().int().nonnegative(),
    }),
  ),
  /** The original had attachments, but together they are over the attachment limit. */
  attachmentsTooLarge: z.boolean().optional(),
});

export const MAX_COMPOSE_BODY = 150_000;
export const MAX_COMPOSE_HTML = 300_000;
/**
 * Attachments travel inside the JSON request, which the API caps at 16 MB; base64 adds a third,
 * so 10 MB of files is the most that fits with the body.
 */
export const MAX_COMPOSE_ATTACHMENT_MB = 10;
export const MAX_COMPOSE_ATTACHMENT_BYTES = MAX_COMPOSE_ATTACHMENT_MB * 1024 * 1024;
export const MAX_COMPOSE_ATTACHMENTS = 20;

export const ComposeAttachmentSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().max(255),
  /** The file's bytes, base64. */
  data: z.string().max(Math.ceil((MAX_COMPOSE_ATTACHMENT_BYTES * 4) / 3) + 4),
});

export const ComposeFieldsSchema = z.object({
  clientId: ComposeClientId,
  /** The From account: one of the caller's connected Gmail accounts. */
  connectionId: Id,
  replyToMessageId: Id.optional(),
  /** Sending a forward: the server attaches these files of the original, so they never travel from the browser. */
  forwardOf: z
    .object({
      messageId: Id,
      attachmentIds: z.array(z.string().min(1).max(100)).max(MAX_COMPOSE_ATTACHMENTS),
    })
    .optional(),
  to: z.string().max(4_000),
  cc: z.string().max(4_000),
  bcc: z.string().max(4_000),
  subject: z.string().max(998),
  /** Plain text; used when `html` is absent. With `html`, the server writes the text from it. */
  body: z.string().max(MAX_COMPOSE_BODY),
  /** The editor's HTML. The server keeps only basic formatting and links. */
  html: z.string().max(MAX_COMPOSE_HTML).optional(),
  attachments: z.array(ComposeAttachmentSchema).max(MAX_COMPOSE_ATTACHMENTS).optional(),
});

/**
 * `saved`/`sent`: done. `unknown`: the send may have gone out; it is never repeated, so the user
 * checks Sent. `reconnect`: the account lacks permission. `disabled`: the deployment turned
 * Gmail writes off. `failed`: nothing was sent or saved; trying again is safe.
 */
export const ComposeResultSchema = z.object({
  status: z.enum(["saved", "sent", "unknown", "reconnect", "disabled", "failed"]),
});

/** `mark: null` removes the mark from the message's sender. */
export const InboxFeedbackInputSchema = z.object({
  messageId: Id,
  mark: InboxMarkSchema.nullable(),
});
export const InboxFeedbackOutputSchema = z.object({ mark: InboxMarkSchema.nullable() });

/** `read: false` marks only this message unread; `read: true` marks the whole thread read. */
export const InboxMarkReadInputSchema = z.object({ messageId: Id, read: z.boolean() });

export type ComposeFields = z.infer<typeof ComposeFieldsSchema>;
export type ComposeMode = z.infer<typeof ComposeModeSchema>;
export type ComposePrefillOutput = z.infer<typeof ComposePrefillOutputSchema>;
export type ComposeResult = z.infer<typeof ComposeResultSchema>;
export type InboxMarkReadInput = z.infer<typeof InboxMarkReadInputSchema>;
export type InboxFeedbackInput = z.infer<typeof InboxFeedbackInputSchema>;
export type InboxListInput = z.infer<typeof InboxListInputSchema>;
export type InboxMessage = z.infer<typeof InboxMessageSchema>;
export type InboxTodo = z.infer<typeof InboxTodoSchema>;
export type MailRow = z.infer<typeof MailRowSchema>;
export type InboxListOutput = z.infer<typeof InboxListOutputSchema>;
