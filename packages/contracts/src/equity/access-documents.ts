import * as z from "zod";
import { Id, IsoDate } from "../ids.js";

/** What a Data room document is attached to: one stakeholder, certificate or funding round. */
export const EquityDocumentTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("stakeholder"), id: Id }),
  z.object({ kind: z.literal("certificate"), id: Id }),
  z.object({ kind: z.literal("round"), id: Id }),
]);
export type EquityDocumentTarget = z.infer<typeof EquityDocumentTargetSchema>;

export const EquityDocumentLinkSchema = z.object({
  id: Id,
  dataRoomItemId: Id,
  name: z.string(),
  target: EquityDocumentTargetSchema,
  /** The stakeholder's name, the certificate's label or the round's name. */
  targetLabel: z.string(),
  createdAt: IsoDate,
});
export type EquityDocumentLink = z.infer<typeof EquityDocumentLinkSchema>;

export const EquityDocumentLinkCreateInputSchema = z.object({
  dataRoomItemId: Id,
  target: EquityDocumentTargetSchema,
});
/** Every link, or only those of one target. */
export const EquityDocumentLinkListInputSchema = z.object({
  target: EquityDocumentTargetSchema.optional(),
});
