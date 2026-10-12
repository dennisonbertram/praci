import * as z from "zod";
import { Id } from "./ids.js";

/** The one place the Inbox agent's spawn key is built. */
export const inboxAgentSpawnKey = (userId: string) => `inbox-agent:${userId}`;

/** Connection.displayName labels the account tab. */
export const MailAccountSchema = z.object({ connectionId: Id, label: z.string() });

export const MailRowSchema = z.object({
  id: Id,
  connectionId: Id,
  threadId: z.string(),
  from: z.string(),
  subject: z.string(),
  snippet: z.string(),
  receivedAt: z.string(),
  unread: z.boolean(),
  needsReply: z.boolean().nullable(),
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
});

export const InboxMessageSchema = z.object({
  from: z.string(),
  to: z.string(),
  date: z.string(),
  subject: z.string(),
  html: z.string().nullable(),
  text: z.string().nullable(),
});

export type MailRow = z.infer<typeof MailRowSchema>;
export type InboxListOutput = z.infer<typeof InboxListOutputSchema>;
