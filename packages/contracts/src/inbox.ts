import * as z from "zod";
import { Id } from "./ids.js";

/** The one place the Inbox agent's spawn key is built. */
export const inboxAgentSpawnKey = (userId: string) => `inbox-agent:${userId}`;

export const isInboxAgentSpawnKey = (spawnKey: string | null | undefined) =>
  Boolean(spawnKey?.startsWith(inboxAgentSpawnKey("")));

/** Connection.displayName labels the account tab. */
export const MailAccountSchema = z.object({ connectionId: Id, label: z.string() });

export const InboxPrioritySchema = z.enum(["critical", "important", "normal", "low"]);

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
});

export const InboxListInputSchema = z.object({ connectionId: Id.optional() });

export const InboxListOutputSchema = z.object({
  /** Empty means no mail account is connected. */
  accounts: z.array(MailAccountSchema),
  /** The unarchived Inbox agent, if any. */
  agent: z.object({ botId: Id, name: z.string() }).nullable(),
  /** Newest first, one row per thread. */
  rows: z.array(MailRowSchema),
  /** Newest lastSyncedAt; null means never synced. */
  syncedAt: z.string().nullable(),
  /** Accounts whose last sync failed. */
  failedAccounts: z.array(Id),
  /** True when triage can run: a usable model the user has allowed. Clients hide triage UI otherwise. */
  enabled: z.boolean(),
  /** True while connected-account mail still waits for triage; clients refetch a few times. */
  triagePending: z.boolean(),
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
});

export type InboxTodo = z.infer<typeof InboxTodoSchema>;
export type MailRow = z.infer<typeof MailRowSchema>;
export type InboxListOutput = z.infer<typeof InboxListOutputSchema>;
