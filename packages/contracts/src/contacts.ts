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

export const ContactSchema = z.object({
  id: Id,
  name: z.string(),
  email: z.string().nullable(),
  organization: z.string().nullable(),
  kind: ContactKindSchema,
  notes: z.string().nullable(),
  /** Pipeline fields; null on a contact that is not a prospect. */
  stage: ContactStageSchema.nullish(),
  checkSizeCents: z.number().int().nullish(),
  nextStep: z.string().nullish(),
  /** The round open when the stage was last saved as committed. */
  roundId: Id.nullish(),
  /** Investor portal dates (read-only): last link issued, last opened, and when access was revoked. */
  portalLinkSentAt: IsoDate.nullish(),
  portalLastSeenAt: IsoDate.nullish(),
  portalBlockedAt: IsoDate.nullish(),
  /** The agent that added the contact; null for a contact added by hand. */
  addedBy: z.object({ id: Id, name: z.string() }).nullable(),
  createdAt: IsoDate,
  updatedAt: IsoDate,
});
export type Contact = z.infer<typeof ContactSchema>;

/** An email address as the server accepts it: trimmed, lower-cased, well-formed. */
export const ContactEmailSchema = z.string().trim().toLowerCase().pipe(z.email());

/** Create, or update when `id` is given or `email` matches the user's contact. Null clears a field; omitted keeps it. */
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
});
export type ContactLinked = z.infer<typeof ContactLinkedSchema>;
