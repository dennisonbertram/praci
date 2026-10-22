import * as z from "zod";
import { ContactSchema, ContactStageSchema } from "./contacts.js";
import { Id, IsoDate } from "./ids.js";

/** Money is integer cents. */
const Cents = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

export const FundraiseRoundSchema = z.object({
  id: Id,
  name: z.string(),
  targetCents: z.number().int(),
  capCents: z.number().int(),
  /** Null while the round is open. */
  closedAt: IsoDate.nullable(),
});
export type FundraiseRound = z.infer<typeof FundraiseRoundSchema>;

/**
 * The Fundraising page: the open round, else the latest closed one, and the prospect pipeline.
 * `pendingCents` is the check size of the open round's Committed prospects (zero with no open round).
 */
export const FundraisingOverviewSchema = z.object({
  round: FundraiseRoundSchema.nullable(),
  pendingCents: z.number().int(),
  prospects: z.array(ContactSchema),
});
export type FundraisingOverview = z.infer<typeof FundraisingOverviewSchema>;

/** Starts a round, or edits the open round when `id` is given. */
export const FundraiseRoundSaveInputSchema = z.object({
  id: Id.optional(),
  name: z.string().trim().min(1).max(200),
  targetCents: Cents,
  capCents: Cents,
});
export type FundraiseRoundSaveInput = z.infer<typeof FundraiseRoundSaveInputSchema>;

/** Changes only the pipeline fields of an existing prospect. Null clears the check size or next step. */
export const ProspectSaveInputSchema = z.object({
  id: Id,
  stage: ContactStageSchema.optional(),
  checkSizeCents: Cents.nullish(),
  nextStep: z.string().trim().max(500).nullish(),
});
export type ProspectSaveInput = z.infer<typeof ProspectSaveInputSchema>;
