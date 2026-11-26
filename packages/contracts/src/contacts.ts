import * as z from "zod";
import { Id, IsoDate } from "./ids.js";

export const ContactKindSchema = z.enum([
  "investor",
  "auditor",
  "board",
  "customer",
  "vendor",
  "partner",
  "advisor",
  "legal",
  "prospect",
  "other",
]);
export type ContactKind = z.infer<typeof ContactKindSchema>;

/** A prospect's place in the pipeline, in order. */
export const ContactStageSchema = z.enum([
  "target",
  "intro",
  "meeting",
  "diligence",
  "committed",
  "passed",
]);
export type ContactStage = z.infer<typeof ContactStageSchema>;

/** A record's place on the Fundraising pipeline, in order. */
export const PipelineStatusSchema = z.enum([
  "not_reached",
  "reached_out",
  "intro_requested",
  "intro_made",
  "meeting_booked",
  "met",
  "diligence",
  "committed",
  "passed",
]);
export type PipelineStatus = z.infer<typeof PipelineStatusSchema>;

/** The investor's stance, set on the pipeline row. It never touches money. */
export const PipelineInterestSchema = z.enum(["in", "maybe", "out"]);
export type PipelineInterest = z.infer<typeof PipelineInterestSchema>;

/** How a logged call went. */
export const PipelineCallOutcomeSchema = z.enum(["spoke", "left_message", "no_answer"]);
export type PipelineCallOutcome = z.infer<typeof PipelineCallOutcomeSchema>;

/**
 * A change the auto-status job made from the user's mail or calendar. `status` and `nextCallAt`
 * are what it set (null when it left that field alone); `summary` is the email subject or event title.
 */
export const PipelineAutoChangeSchema = z.object({
  eventId: Id,
  at: IsoDate,
  source: z.enum(["mail", "calendar"]),
  status: PipelineStatusSchema.nullable(),
  nextCallAt: IsoDate.nullable(),
  summary: z.string(),
});
export type PipelineAutoChange = z.infer<typeof PipelineAutoChangeSchema>;

/** One fund detail on a record, with where it came from. */
export const PipelineDetailSchema = z.object({
  label: z.string(),
  value: z.string(),
  source: z.enum(["list", "agent", "owner"]),
  url: z.string().optional(),
  at: z.string().optional(),
});
export type PipelineDetail = z.infer<typeof PipelineDetailSchema>;

export const ContactSchema = z.object({
  id: Id,
  name: z.string(),
  email: z.string().nullable(),
  organization: z.string().nullable(),
  kind: ContactKindSchema,
  notes: z.string().nullable(),
  /** Fundraising fields, read from the contact's pipeline record; null on a contact with none. */
  stage: ContactStageSchema.nullish(),
  checkSizeCents: z.number().int().nullish(),
  nextStep: z.string().nullish(),
  /** The round open when the stage was last saved as committed. */
  roundId: Id.nullish(),
  /**
   * The Fundraising record this contact is on. On the Fundraising overview, a row whose `id` equals
   * this record's id is a record with no person yet.
   */
  pipelineRecord: z
    .object({
      id: Id,
      name: z.string(),
      status: PipelineStatusSchema,
      interest: PipelineInterestSchema.nullish(),
      /** A date alone is midnight UTC of that date (`nextCallHasTime` false); otherwise an instant. */
      nextCallAt: IsoDate.nullish(),
      nextCallHasTime: z.boolean().optional(),
      group: z.string().nullish(),
      /** Set only on the Fundraising overview. */
      referredBy: z.object({ id: Id, name: z.string() }).nullish(),
      people: z.array(z.object({ id: Id, name: z.string() })).optional(),
      details: z.array(PipelineDetailSchema).optional(),
      lastCall: z
        .object({ outcome: PipelineCallOutcomeSchema, at: IsoDate, note: z.string().nullable() })
        .nullish(),
      /** Latest email either way, or meeting, with one of the record's people; set by the auto-status job. */
      lastContactAt: IsoDate.nullish(),
      /** The newest automatic change that is not undone, set only on the Fundraising overview. */
      lastAuto: PipelineAutoChangeSchema.nullish(),
    })
    .nullish(),
  /** Investor portal dates (read-only): last link issued, last opened, and when access was revoked. */
  portalLinkSentAt: IsoDate.nullish(),
  portalLastSeenAt: IsoDate.nullish(),
  portalBlockedAt: IsoDate.nullish(),
  /** When Send SAFE opened Mercury; the prospect reads Waiting for Mercury until a SAFE attaches or Not sent. */
  mercurySentAt: IsoDate.nullish(),
  /** Where the contact's profile photo is served (an authenticated API path); absent when there is none. Set by contacts.list and contacts.detail. */
  photoUrl: z.string().nullish(),
  /** The agent that added the contact; null for a contact added by hand. */
  addedBy: z.object({ id: Id, name: z.string() }).nullable(),
  createdAt: IsoDate,
  updatedAt: IsoDate,
});
export type Contact = z.infer<typeof ContactSchema>;

/** An email address as the server accepts it: trimmed, lower-cased, well-formed. */
export const ContactEmailSchema = z.string().trim().toLowerCase().pipe(z.email());

/** Create, or update when `id` is given. Null clears a field; omitted keeps it. */
export const ContactSaveInputSchema = z.object({
  id: Id.optional(),
  name: z.string().trim().min(1).max(200),
  email: ContactEmailSchema.nullish(),
  organization: z.string().trim().max(200).nullish(),
  kind: ContactKindSchema.optional(),
  notes: z.string().trim().max(5000).nullish(),
  stage: ContactStageSchema.nullish(),
  checkSizeCents: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullish(),
  nextStep: z.string().trim().max(500).nullish(),
  /** Keeps a Committed prospect in this round (Undo of a delete) instead of the open one. */
  roundId: Id.optional(),
  /** A new contact's Fundraising record, for the first person of a record with none. */
  pipelineRecordId: Id.optional(),
});
export type ContactSaveInput = z.infer<typeof ContactSaveInputSchema>;

export const ContactListInputSchema = z.object({ kind: ContactKindSchema.optional() });
export type ContactListInput = z.infer<typeof ContactListInputSchema>;

/** What deleting a contact removes with it (beyond its name, email, organization, kind and notes). */
export const ContactLinkedSchema = z.object({
  /** The contact has a live portal link or session. */
  portal: z.boolean(),
  /** Names of the Data room documents shared with the contact. */
  documents: z.array(z.string()),
  /** How many SAFEs name the contact; deleting it detaches them. */
  safes: z.number().int(),
});
export type ContactLinked = z.infer<typeof ContactLinkedSchema>;

/** Most rows of each related list the contact page shows. */
export const CONTACT_DETAIL_LIMIT = 10;

/**
 * A contact with what is stored against it: mail threads and meetings matched by the contact's email
 * address, and Data room documents and SAFEs linked by contact id. A list with nothing in it is empty.
 */
export const ContactDetailSchema = z.object({
  contact: ContactSchema,
  /** One row per thread, its newest message, newest thread first. */
  mail: z.array(
    z.object({
      id: Id,
      subject: z.string(),
      from: z.string(),
      snippet: z.string(),
      receivedAt: IsoDate,
    }),
  ),
  meetings: z.array(z.object({ id: Id, title: z.string(), startedAt: IsoDate })),
  documents: z.array(z.object({ id: Id, name: z.string() })),
  safes: z.array(z.object({ id: Id, amountCents: z.number().int(), status: z.string() })),
});
export type ContactDetail = z.infer<typeof ContactDetailSchema>;
