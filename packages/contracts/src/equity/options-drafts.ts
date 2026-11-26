import * as z from "zod";
import { Id } from "../ids.js";
import { EquityOptionGrantSchema } from "./options.js";

/** Creates every grant of a draft set at once, so the whole set is issued or none of it is. */
export const EquityIssueDraftSetInputSchema = z.object({
  id: Id,
  expectedRevision: z.number().int().positive().max(2_147_483_647),
});
export type EquityIssueDraftSetInput = z.infer<typeof EquityIssueDraftSetInputSchema>;

export const EquityIssueDraftSetResultSchema = z.object({
  draftSetId: Id,
  grants: z.array(EquityOptionGrantSchema),
});
export type EquityIssueDraftSetResult = z.infer<typeof EquityIssueDraftSetResultSchema>;
