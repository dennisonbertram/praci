import * as z from "zod";
import { ContactSchema, ContactStageSchema } from "./contacts.js";
import { Id, IsoDate } from "./ids.js";

/** Money is integer cents. */
const Cents = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

export const SafeStatusSchema = z.enum([
  "draft",
  "sent",
  "signed",
  "funded",
  "expired",
  "canceled",
]);
export type SafeStatus = z.infer<typeof SafeStatusSchema>;

export const SafeSchema = z.object({
  id: Id,
  source: z.enum(["native", "mercury"]),
  contactId: Id.nullable(),
  roundId: Id.nullable(),
  investorName: z.string(),
  investorEmail: z.string().nullable(),
  amountCents: z.number().int(),
  valuationType: z.string(),
  capCents: z.number().int().nullable(),
  discountPercent: z.number().nullable(),
  mfn: z.boolean(),
  proRata: z.boolean(),
  governingState: z.string().nullable(),
  investmentDate: IsoDate.nullable(),
  expiresAt: IsoDate.nullable(),
  canceledAt: IsoDate.nullable(),
  sentAt: IsoDate.nullable(),
  signedByOwnerAt: IsoDate.nullable(),
  signedByInvestorAt: IsoDate.nullable(),
  paidAt: IsoDate.nullable(),
  documentUrl: z.string().nullable(),
  /** The matched Finance deposit (Mercury SAFEs only). */
  financeTransactionId: Id.nullish(),
  /** Derived from the dates, never stored. */
  status: SafeStatusSchema,
  createdAt: IsoDate,
});
export type Safe = z.infer<typeof SafeSchema>;

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
export const MercurySafeStateSchema = z.object({
  status: z.enum(["not_connected", "ok", "error", "needs_reconnect"]),
  lastSyncedAt: IsoDate.nullable(),
  /** Rows in Mercury's last answer that could not be read; none were written. */
  unreadable: z.number().int().min(0),
});
export type MercurySafeState = z.infer<typeof MercurySafeStateSchema>;

export const FundraisingOverviewSchema = z.object({
  mercury: MercurySafeStateSchema,
  round: FundraiseRoundSchema.nullable(),
  /** The round's Committed prospects without a SAFE (check size) plus its Sent and Draft SAFEs. */
  pendingCents: z.number().int(),
  /** SAFE money of the shown round that is signed, and that is paid. */
  signedCents: z.number().int(),
  fundedCents: z.number().int(),
  /** Prospects still in the pipeline: those with an active SAFE have left it. */
  prospects: z.array(ContactSchema),
  safes: z.array(SafeSchema),
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

/**
 * Adds a native SAFE as a Draft: always the YC post-money valuation-cap form (no discount, no
 * MFN). `capCents` defaults to the open round's cap. With `contactId` the SAFE belongs to that
 * contact and takes its name and email.
 */
export const SafeSaveInputSchema = z.object({
  contactId: Id.optional(),
  investorName: z.string().trim().min(1).max(200),
  investorEmail: z.string().trim().toLowerCase().email().nullish(),
  amountCents: Cents.min(1),
  capCents: Cents.min(1).optional(),
  proRata: z.boolean().default(false),
  governingState: z.string().trim().max(100).nullish(),
  investmentDate: IsoDate.nullish(),
});
export type SafeSaveInput = z.infer<typeof SafeSaveInputSchema>;

/**
 * Records a step on a native SAFE with its date; `at: null` clears it (Undo). Signed sets both
 * signatures. Cancel is refused once the SAFE is Funded.
 */
export const SafeMarkInputSchema = z.object({
  id: Id,
  action: z.enum(["sent", "signed", "funded", "cancel"]),
  at: IsoDate.nullable(),
});
export type SafeMarkInput = z.infer<typeof SafeMarkInputSchema>;

/** Attaches an unattached Mercury SAFE to a prospect or investor contact. */
export const SafeAssignInputSchema = z.object({ id: Id, contactId: Id });
export type SafeAssignInput = z.infer<typeof SafeAssignInputSchema>;
