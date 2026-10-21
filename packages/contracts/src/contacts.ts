import * as z from "zod";
import { Id, IsoDate } from "./ids.js";

export const ContactKindSchema = z.enum([
  "investor",
  "auditor",
  "customer",
  "vendor",
  "partner",
  "advisor",
  "legal",
  "other",
]);
export type ContactKind = z.infer<typeof ContactKindSchema>;

export const ContactSchema = z.object({
  id: Id,
  name: z.string(),
  email: z.string().nullable(),
  organization: z.string().nullable(),
  kind: ContactKindSchema,
  notes: z.string().nullable(),
  createdAt: IsoDate,
  updatedAt: IsoDate,
});
export type Contact = z.infer<typeof ContactSchema>;

/** Create, or update when `id` is given or `email` matches the user's contact. Null clears a field; omitted keeps it. */
export const ContactSaveInputSchema = z.object({
  id: Id.optional(),
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().pipe(z.email()).nullish(),
  organization: z.string().trim().max(200).nullish(),
  kind: ContactKindSchema.optional(),
  notes: z.string().trim().max(5000).nullish(),
});
export type ContactSaveInput = z.infer<typeof ContactSaveInputSchema>;

export const ContactListInputSchema = z.object({ kind: ContactKindSchema.optional() });
export type ContactListInput = z.infer<typeof ContactListInputSchema>;
