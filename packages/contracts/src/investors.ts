import * as z from "zod";
import { Id, IsoDate } from "./ids.js";

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
  "fundraising_read",
  "contacts_list",
  "contacts_add",
  "contacts_save",
  "investor_update_draft",
  "audit_request_upsert",
  "skill_read",
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

export const InvestorAudienceSchema = z.enum(["investors", "board"]);
export type InvestorAudience = z.infer<typeof InvestorAudienceSchema>;

/** Posted: on the portal with no email sent (no Gmail). Partly sent is derived: sent, or sending with no movement for 10 minutes, with a failed or unknown delivery. */
export const InvestorUpdateStatusSchema = z.enum([
  "draft",
  "sending",
  "sent",
  "partly_sent",
  "posted",
]);
export type InvestorUpdateStatus = z.infer<typeof InvestorUpdateStatusSchema>;

/** `unknown`: an attempt with no recorded result. It is never resent unless the founder confirms. */
export const InvestorDeliveryStateSchema = z.enum(["sent", "sending", "failed", "unknown"]);
export type InvestorDeliveryState = z.infer<typeof InvestorDeliveryStateSchema>;

export const InvestorUpdateSchema = z.object({
  id: Id,
  audience: InvestorAudienceSchema,
  subject: z.string(),
  /** YYYY-MM or YYYY-Qn. */
  period: z.string(),
  /** Markdown. */
  body: z.string(),
  status: InvestorUpdateStatusSchema,
  recipientContactIds: z.array(Id),
  fromConnectionId: Id.nullable(),
  /** One row per recipient once a send has started; empty for a draft. */
  deliveries: z.array(
    z.object({ contactId: Id, name: z.string(), state: InvestorDeliveryStateSchema }),
  ),
  sentAt: IsoDate.nullable(),
  createdAt: IsoDate,
  updatedAt: IsoDate,
});
export type InvestorUpdate = z.infer<typeof InvestorUpdateSchema>;

/** Without `id` this adds a draft (the audience is then required). Only a draft can be saved. */
export const InvestorUpdateSaveInputSchema = z.object({
  id: Id.optional(),
  audience: InvestorAudienceSchema.optional(),
  subject: z.string().trim().max(998).optional(),
  period: z
    .string()
    .regex(/^\d{4}-(?:0[1-9]|1[0-2]|Q[1-4])$/)
    .optional(),
  body: z.string().max(100_000).optional(),
  recipientContactIds: z.array(Id).max(1000).optional(),
  fromConnectionId: Id.nullable().optional(),
});
export type InvestorUpdateSaveInput = z.infer<typeof InvestorUpdateSaveInputSchema>;

export const InvestorUpdateRetryInputSchema = z.object({
  id: Id,
  /** Only these recipients; omitted means every failed one. */
  contactIds: z.array(Id).max(1000).optional(),
  /** The founder confirmed that an Unknown recipient may be sent again. */
  resendUnknown: z.boolean().optional(),
});

export const InvestorReminderCadenceSchema = z.enum(["monthly", "quarterly", "off"]);
export type InvestorReminderCadence = z.infer<typeof InvestorReminderCadenceSchema>;

/** Post to portal: the update, and how many investor contacts the portal notice reached. */
export const InvestorPostResultSchema = z.object({
  update: InvestorUpdateSchema,
  notified: z.number().int().min(0),
});

/** One portal link, shown once because only its hash is stored. */
export const PortalLinkSchema = z.object({ contactId: Id, name: z.string(), link: z.string() });
export type PortalLink = z.infer<typeof PortalLinkSchema>;

/** Gives investor contacts a Data room document. `emailLink` sends each new one a fresh link. */
export const InvestorShareInputSchema = z.object({
  itemId: Id,
  contactIds: z.array(Id).min(1).max(1000),
  emailLink: z.boolean(),
});
/** Links that could not be emailed (no email provider, or no address), for the founder to paste. */
export const InvestorShareResultSchema = z.object({ links: z.array(PortalLinkSchema) });
export const InvestorUnshareInputSchema = z.object({ itemId: Id, contactId: Id });

/** Resend: emails a fresh link. `copy`, or no email provider, returns the link instead. */
export const PortalResendInputSchema = z.object({ contactId: Id, copy: z.boolean().optional() });
export const PortalResendResultSchema = z.object({ link: z.string().nullable() });

/** What an investor sees at `/api/portal/*`; nothing else is ever returned to them. */
export const PortalMeSchema = z.object({ company: z.string(), name: z.string() });
export const PortalUpdateSchema = z.object({
  id: Id,
  subject: z.string(),
  body: z.string(),
  sentAt: IsoDate.nullable(),
});
export const PortalDocumentSchema = z.object({
  id: Id,
  name: z.string(),
  size: z.number().int().min(0),
});
export type PortalMe = z.infer<typeof PortalMeSchema>;
export type PortalUpdate = z.infer<typeof PortalUpdateSchema>;
export type PortalDocument = z.infer<typeof PortalDocumentSchema>;
export const AuditRequestStatusSchema = z.enum(["open", "drafted", "done", "dismissed"]);
export type AuditRequestStatus = z.infer<typeof AuditRequestStatusSchema>;

const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** An auditor, 409A or DocuSign request. Only the founder closes one (done or dismissed). */
export const AuditRequestSchema = z.object({
  id: Id,
  fund: z.string(),
  asOf: Day.nullable(),
  /** False when the statement had to use current holdings. */
  asOfMatched: z.boolean(),
  dueDate: Day.nullable(),
  status: AuditRequestStatusSchema,
  mailThreadId: z.string().nullable(),
  connectionId: Id.nullable(),
  /** Gmail draft id. */
  draftRef: z.string().nullable(),
  /** The sender is an Auditor contact. */
  senderKnown: z.boolean(),
  notes: z.string(),
  dataRoomItemId: Id.nullable(),
  /** A drafting run started in the last few minutes, so Draft reply is hidden. */
  drafting: z.boolean(),
  /** Mail arrived in the thread after the draft was made. */
  newMail: z.boolean(),
  createdAt: IsoDate,
});
export type AuditRequest = z.infer<typeof AuditRequestSchema>;

export const AuditRequestListInputSchema = z.object({ includeDone: z.boolean().optional() });

/** Closing is the only change the founder makes. */
export const AuditRequestUpdateInputSchema = z.object({
  id: Id,
  status: z.enum(["done", "dismissed"]),
});
