import * as z from "zod";
import { Id } from "./ids.js";

/** The one place the Inbox agent's spawn key is built. */
export const inboxAgentSpawnKey = (userId: string) => `inbox-agent:${userId}`;

export const isInboxAgentSpawnKey = (spawnKey: string | null | undefined) =>
  Boolean(spawnKey?.startsWith(inboxAgentSpawnKey("")));

/** Connection.displayName labels the account tab. */
export const MailAccountSchema = z.object({
  connectionId: Id,
  label: z.string(),
  /** The mailbox address, once Gmail has reported it; optional for older servers. */
  address: z.string().optional(),
  /**
   * Whether the mailbox can keep skipped senders out of the inbox itself (a Gmail filter): "ready",
   * "needs_permission" (reconnect with one more permission) or "unsupported". Optional for older servers.
   */
  senderRules: z.enum(["ready", "needs_permission", "unsupported"]).optional(),
});

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

/** Bump when the headers requested or the parsing changes; sync then fetches older rows again. */
export const MAIL_SIGNALS_VERSION = 1;

/** null = absent, none, neutral or temperror. */
const AuthResult = z.enum(["pass", "fail"]).nullable();

/** Provider-neutral facts about one message that the free classifier rules read. */
export const MailSignalsSchema = z.object({
  /** https URLs first, then mailto, as written in List-Unsubscribe; http dropped; at most 3, each at most 2000 characters. */
  listUnsubscribe: z.array(z.string().max(2000)).max(3),
  /** List-Unsubscribe-Post carries List-Unsubscribe=One-Click (RFC 8058). */
  oneClick: z.boolean(),
  listId: z.string().max(200).nullable(),
  /** Precedence: bulk, list or junk. */
  bulk: z.boolean(),
  /** Auto-Submitted is present and not "no". */
  autoSubmitted: z.boolean(),
  /** From the topmost Authentication-Results of the receiving server. fail covers fail, softfail and permerror. */
  auth: z.object({ dkim: AuthResult, spf: AuthResult, dmarc: AuthResult }),
  /** A passing DKIM signature lists both list-unsubscribe and list-unsubscribe-post in h=. */
  dkimCoversUnsubscribe: z.boolean(),
  categories: z.object({
    spam: z.boolean(),
    promotions: z.boolean(),
    social: z.boolean(),
    updates: z.boolean(),
    forums: z.boolean(),
    important: z.boolean(),
  }),
});
export type MailSignals = z.infer<typeof MailSignalsSchema>;

/** The piles the free rules and the model sort mail into. */
export const InboxPileSchema = z.enum(["important", "updates", "newsletters", "spam"]);
export type InboxPile = z.infer<typeof InboxPileSchema>;

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
  /** One-line summary of what the mail is about; null until triaged, and while triage is not enabled. */
  reason: z.string().nullable(),
  /** Null until triaged, and while triage is not enabled. */
  category: InboxCategorySchema.nullable(),
  /** The user's mark on this sender; null when unmarked and while triage is not enabled. */
  feedback: InboxMarkSchema.nullable(),
  /** Sent by the user, such as their reply in a search result; optional for older servers. */
  fromSelf: z.boolean().optional(),
  /** Lowercased sender address, the key rows group by; optional for older servers. */
  fromAddress: z.string().optional(),
  /** The pile the row belongs to (Gmail spam rows are "spam"); null while undecided. Optional for older servers. */
  pile: InboxPileSchema.nullable().optional(),
});

/** Which account a request covers; omitted means every connected mail account. */
export const InboxScopeInputSchema = z.object({ connectionId: Id.optional() });

/** `waitMs` holds the reply until the queued sync finishes, up to that long (a client that lists right after). */
export const InboxRefreshInputSchema = InboxScopeInputSchema.extend({
  waitMs: z.number().int().min(0).max(10_000).optional(),
});

/** Refresh queues the sync and returns at once; the new fields are optional for older clients and servers. */
export const InboxRefreshOutputSchema = z.object({
  ok: z.literal(true),
  /** A sync is queued or running for at least one account. */
  syncing: z.boolean().optional(),
  /** Newest successful sync across the accounts, ISO 8601; null when none has finished. */
  syncedAt: z.string().nullable().optional(),
  /** Accounts whose last sync failed. */
  failedAccounts: z.array(Id).optional(),
});
export type InboxRefreshOutput = z.infer<typeof InboxRefreshOutputSchema>;

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
 * `pile` lists one pile from the free rules and the model's category. It works while triage is not
 * enabled, and cannot be combined with `view`, `category`, `filter` or `query`.
 */
export const InboxListInputSchema = InboxScopeInputSchema.extend({
  filter: InboxFilterSchema.optional(),
  query: z.string().max(500).optional(),
  view: InboxViewSchema.optional(),
  category: InboxViewCategorySchema.optional(),
  pile: InboxPileSchema.optional(),
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

/** Threads per pile in the 14-day window. */
export const InboxPileCountsSchema = z.object({
  important: z.number().int().nonnegative(),
  updates: z.number().int().nonnegative(),
  newsletters: z.number().int().nonnegative(),
  spam: z.number().int().nonnegative(),
});

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
  /** Not on filtered or searched lists or while no account is connected; optional for older servers. */
  pileCounts: InboxPileCountsSchema.optional(),
});

/** Most threads one bulk archive or unarchive call takes. */
export const MAX_BULK_ARCHIVE = 50;

export const InboxBulkInputSchema = z.object({
  messageIds: z.array(Id).min(1).max(MAX_BULK_ARCHIVE),
  /** Archive takes spam-pile mail only when the user is in the Spam view. Unarchive ignores it. */
  allowSpam: z.boolean().optional(),
});

/** `reconnect`: the account lacks permission to change mail. `unavailable`: Gmail failed. */
export const InboxBulkResultSchema = z.object({
  done: z.array(Id),
  failed: z.array(
    z.object({
      messageId: Id,
      reason: z.enum(["not_found", "spam", "reconnect", "unavailable"]),
    }),
  ),
});

/** Most senders the cleanup list returns. */
export const MAX_CLEANUP_SENDERS = 100;

/** What Unsubscribe would do for a sender; `refused` is spam-like mail, `none` has no unsubscribe target. */
export const CleanupUnsubscribeSchema = z.enum(["one_click", "link", "mailto", "refused", "none"]);
export const UnsubscribeStatusSchema = z.enum([
  "done",
  "opened",
  "sent",
  "unknown",
  "failed",
  "refused",
]);

/** Where a skipped sender's Gmail filter stands: made, waiting for permission, over the cap, or failed. */
export const SenderRuleStatusSchema = z.enum(["active", "pending", "full", "failed"]);
export type SenderRuleStatus = z.infer<typeof SenderRuleStatusSchema>;

/** One sender on one mail account, over the 90-day cache window. */
export const CleanupSenderSchema = z.object({
  connectionId: Id,
  /** Lowercased From address. */
  address: z.string(),
  name: z.string(),
  messageCount: z.number().int().nonnegative(),
  readCount: z.number().int().nonnegative(),
  lastReceivedAt: z.string().nullable(),
  /** Conversations in the Inbox from this sender: what an archive touches. */
  inboxThreads: z.number().int().nonnegative(),
  preselected: z.boolean(),
  /** Some window mail is spam, scam or suspicious, or failed authentication. Never skipped or unsubscribed. */
  spamLike: z.boolean(),
  unsubscribe: CleanupUnsubscribeSchema,
  /** Future mail from this sender is archived during sync. */
  skipInbox: z.boolean(),
  unsubscribeStatus: UnsubscribeStatusSchema.nullable(),
  /** The Gmail filter for a skipped sender; omitted when there is none. */
  rule: SenderRuleStatusSchema.optional(),
});

export const CleanupListInputSchema = InboxScopeInputSchema;
export const CleanupListOutputSchema = z.object({
  accounts: z.array(MailAccountSchema),
  senders: z.array(CleanupSenderSchema),
  syncedAt: z.string().nullable(),
});

export const CleanupKindSchema = z.enum(["archive", "skip_inbox", "unsubscribe", "spam"]);

/** One page of a sender cleanup: at most 50 conversations. Call again with the returned batchId while `remaining` is above 0. */
export const CleanupArchiveInputSchema = z.object({
  batchId: Id.optional(),
  kind: CleanupKindSchema,
  connectionId: Id,
  address: z.string().min(3).max(320),
});
export const CleanupArchiveOutputSchema = z.object({
  batchId: Id,
  done: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  remaining: z.number().int().nonnegative(),
});

export const CleanupForgetInputSchema = z.object({
  connectionId: Id,
  address: z.string().min(3).max(320),
});

export const UnsubscribeInputSchema = z.object({
  connectionId: Id,
  address: z.string().min(3).max(320),
  /** The user confirmed sending the unsubscribe email. */
  confirmMailto: z.boolean().optional(),
});
/**
 * `done`: one-click POST accepted. `opened`: open `openUrl` in a new tab. `sent`/`unknown`: the
 * unsubscribe email went out / may have. `needs_confirmation`: ask before emailing `mailTo`.
 * `refused`: spam-like mail. `disabled`: mail writes are off. `unavailable`: no unsubscribe target.
 * `failed`: the attempt failed; `openUrl`, when present, is the sender's link.
 */
export const UnsubscribeOutputSchema = z.object({
  status: z.enum([
    "done",
    "opened",
    "sent",
    "unknown",
    "failed",
    "refused",
    "needs_confirmation",
    "disabled",
    "unavailable",
  ]),
  method: z.enum(["one_click", "link", "mailto"]).nullable(),
  openUrl: z.string().optional(),
  mailTo: z.string().optional(),
});

export const InboxMoveInputSchema = z.object({
  op: z.enum(["spam", "notSpam", "trash"]),
  messageIds: z.array(Id).min(1).max(MAX_BULK_ARCHIVE),
});
export const InboxMoveOutputSchema = InboxBulkResultSchema.extend({ batchId: Id });

export const MailActionKindSchema = z.enum([
  "archive",
  "skip_inbox",
  "unsubscribe",
  "spam",
  "not_spam",
  "trash",
]);
export const MailActionSchema = z.object({
  batchId: Id,
  kind: MailActionKindSchema,
  source: z.enum(["user", "auto"]),
  /** What led to it: a sender cleanup, a hand-picked selection, or a sender's skip-inbox decision. */
  reason: z.enum(["cleanup", "selection", "skip_inbox"]),
  createdAt: z.string(),
  undone: z.boolean(),
  threadCount: z.number().int().nonnegative(),
  /** The first few sender addresses. */
  senders: z.array(z.string()).max(5),
  senderCount: z.number().int().nonnegative(),
});
export const MailActionsListOutputSchema = z.object({ actions: z.array(MailActionSchema) });
export const MailActionUndoInputSchema = z.object({ batchId: Id });
export const MailActionUndoOutputSchema = z.object({
  restored: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
});

export const InboxTodoSchema = z.object({
  id: Id,
  connectionId: Id,
  /** Null once the message left the 14-day cache. */
  messageId: Id.nullable(),
  text: z.string(),
  /** The message's one-line summary. */
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

/** Another message of the same conversation, as the cache has it; its body loads with inbox.get. */
export const InboxThreadMessageSchema = z.object({
  id: Id,
  from: z.string(),
  receivedAt: z.string(),
  snippet: z.string(),
  /** Sent by the user; optional for older servers. */
  fromSelf: z.boolean().optional(),
});

export const InboxMessageSchema = z.object({
  from: z.string(),
  /** Sent by the user; optional for older servers. */
  fromSelf: z.boolean().optional(),
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
  /** The cached copy's state, so any view of the message offers the same actions; optional for older servers. */
  unread: z.boolean().optional(),
  inInbox: z.boolean().optional(),
  /** The conversation's cached messages before this one, oldest first; empty for a single message. */
  thread: z.array(InboxThreadMessageSchema).optional(),
  /** The conversation's cached messages after this one, such as the user's reply, oldest first. */
  later: z.array(InboxThreadMessageSchema).optional(),
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
  /** The account the reply or forward is sent from, for the composer's From line; optional for older servers. */
  account: MailAccountSchema.optional(),
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
  /** With attachmentsTooLarge: the files that did not fit, so the composer can name them. */
  attachmentsLeftOut: z
    .array(z.object({ filename: z.string(), size: z.number().int().nonnegative() }))
    .optional(),
  /** Gmail could not be read, so To and Subject come from the cached copy and the quote is empty. */
  quoteUnavailable: z.boolean().optional(),
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
  /** Why a `failed` send failed, when Gmail said: it refused the message, or it is limiting requests. */
  reason: z.enum(["rejected", "rate_limited"]).optional(),
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
export type InboxBulkInput = z.infer<typeof InboxBulkInputSchema>;
export type InboxBulkResult = z.infer<typeof InboxBulkResultSchema>;
export type InboxPileCounts = z.infer<typeof InboxPileCountsSchema>;
export type InboxListInput = z.infer<typeof InboxListInputSchema>;
export type InboxMessage = z.infer<typeof InboxMessageSchema>;
export type InboxThreadMessage = z.infer<typeof InboxThreadMessageSchema>;
export type InboxTodo = z.infer<typeof InboxTodoSchema>;
export type MailRow = z.infer<typeof MailRowSchema>;
export type InboxListOutput = z.infer<typeof InboxListOutputSchema>;
export type CleanupSender = z.infer<typeof CleanupSenderSchema>;
export type CleanupKind = z.infer<typeof CleanupKindSchema>;
export type CleanupListOutput = z.infer<typeof CleanupListOutputSchema>;
export type CleanupArchiveInput = z.infer<typeof CleanupArchiveInputSchema>;
export type CleanupArchiveOutput = z.infer<typeof CleanupArchiveOutputSchema>;
export type CleanupForgetInput = z.infer<typeof CleanupForgetInputSchema>;
export type CleanupUnsubscribe = z.infer<typeof CleanupUnsubscribeSchema>;
export type UnsubscribeInput = z.infer<typeof UnsubscribeInputSchema>;
export type UnsubscribeOutput = z.infer<typeof UnsubscribeOutputSchema>;
export type UnsubscribeStatus = z.infer<typeof UnsubscribeStatusSchema>;
export type InboxMoveInput = z.infer<typeof InboxMoveInputSchema>;
export type InboxMoveOutput = z.infer<typeof InboxMoveOutputSchema>;
export type MailAction = z.infer<typeof MailActionSchema>;
export type MailActionKind = z.infer<typeof MailActionKindSchema>;
export type MailActionsListOutput = z.infer<typeof MailActionsListOutputSchema>;
export type MailActionUndoInput = z.infer<typeof MailActionUndoInputSchema>;
export type MailActionUndoOutput = z.infer<typeof MailActionUndoOutputSchema>;
