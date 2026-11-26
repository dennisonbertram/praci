import * as z from "zod";
import { Id } from "../ids.js";
import { EquityCents, EquityShares } from "./common.js";
import { EquityDraftSetSchema } from "./rounds.js";

export const EquityDraftSetIssueInputSchema = z.object({
  id: Id,
  expectedRevision: z.number().int().positive().max(2_147_483_647),
});

/** A draft set checked against the ledger as it is now; nothing is written. */
export const EquityDraftSetReviewSchema = z.object({
  setId: Id,
  revision: z.number().int().positive().max(2_147_483_647),
  items: z.array(z.object({ index: z.number().int(), problems: z.array(z.string()) })),
  totalShares: EquityShares,
  totalPrincipalCents: EquityCents,
  ready: z.boolean(),
});
export type EquityDraftSetReview = z.infer<typeof EquityDraftSetReviewSchema>;

export const EquityDraftSetIssueResultSchema = z.object({
  set: EquityDraftSetSchema,
  issuedIds: z.array(Id),
});
export type EquityDraftSetIssueResult = z.infer<typeof EquityDraftSetIssueResultSchema>;
