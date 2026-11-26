import * as z from "zod";
import {
  ContactEmailSchema,
  ContactSchema,
  ContactStageSchema,
  PipelineCallOutcomeSchema,
  PipelineInterestSchema,
  PipelineStatusSchema,
} from "./contacts.js";
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
  /** One row per record still in the pipeline, as its primary contact: those with an active SAFE have left it. */
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

/** Rows one `pipeline_import_stage` call takes; a longer list is split across calls. */
export const PIPELINE_IMPORT_STAGE_MAX = 60;
/** Rows one import holds, across all its calls. */
export const PIPELINE_IMPORT_MAX = 1000;
export const PIPELINE_IMPORT_STAGE_TOOL = "pipeline_import_stage";
export const PIPELINE_IMPORT_REVIEW_TOOL = "pipeline_import_review";

const importText = (max: number) => z.string().trim().min(1).max(max);
const ImportPersonSchema = z.strictObject({
  name: importText(200).refine((name) => !/[,;/&+]|\s(and|or)\s/i.test(name), {
    message: "Each person needs their own entry in people.",
  }),
  email: ContactEmailSchema.optional(),
});

/**
 * One row of a list. Strict and with no kind, id, round or amount, so a spreadsheet row cannot reach
 * anything else: Possible amount is the owner's, and a check size is text in `details`.
 */
export const PipelineImportRowSchema = z.strictObject({
  firm: importText(200),
  people: z.array(ImportPersonSchema).max(20).optional(),
  /** The Wave filter: the list's wave, or its priority tier. */
  group: importText(60).optional(),
  /** Breaks ties when sorting. */
  order: z.number().int().min(0).max(1_000_000).optional(),
  nextStep: importText(500).optional(),
  /** A date `YYYY-MM-DD`, date only: the next call or meeting the list gives for this firm. */
  nextCallAt: z.iso.date().optional(),
  details: z
    .array(z.strictObject({ label: importText(60), value: importText(1000) }))
    .max(20)
    .optional(),
  introPath: importText(1000).optional(),
  /** Only when the intro path clearly names one person. */
  referrer: ImportPersonSchema.optional(),
});
export type PipelineImportRow = z.infer<typeof PipelineImportRowSchema>;

/** One saved contact, or a person earlier on the list, a question offers. */
export const PipelineImportCandidateSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  organization: z.string().nullable(),
  /** The prospect this person stays on if chosen: a contact sits in one record per pipeline. */
  stays: z.string().nullable(),
});

/** A question on the card. Nothing is pre-answered, and the server checks every answer. */
export const PipelineImportQuestionSchema = z.object({
  id: z.string(),
  /** The list row a person belongs to; people of one row are skipped together. Null for a referrer. */
  row: z.number().int().nullable(),
  kind: z.enum(["person", "referrer"]),
  name: z.string(),
  /** A person's firm. */
  firm: z.string().nullable(),
  /** The prospects a referrer introduced. */
  referred: z.number().int().nonnegative(),
  /** Skipping this row adds one prospect fewer. */
  newRecord: z.boolean(),
  candidates: z.array(PipelineImportCandidateSchema),
  /** False when a new contact would repeat an email. */
  allowNew: z.boolean(),
});

/** Answers beside a contact candidate's id. */
export const PIPELINE_IMPORT_NEW = "new";
export const PIPELINE_IMPORT_SKIP = "skip";

export const PipelineImportResultSchema = z.object({
  added: z.number().int().nonnegative(),
  updated: z.number().int().nonnegative(),
  newContacts: z.number().int().nonnegative(),
  savedContacts: z.number().int().nonnegative(),
  failed: z.array(z.object({ firm: z.string(), reason: z.string() })),
});
export type PipelineImportResult = z.infer<typeof PipelineImportResultSchema>;

/** What an import card shows, as the server reads it now. */
export const PipelineImportCardSchema = z.object({
  /** `closed` is a card a newer one replaced, or one that was declined. */
  status: z.enum(["reviewing", "applying", "done", "closed"]),
  /** Press sends it back: a list or contact that changed since then rejects the press. */
  hash: z.string(),
  add: z.number().int().nonnegative(),
  update: z.number().int().nonnegative(),
  questions: z.array(PipelineImportQuestionSchema),
  newContacts: z.array(z.string()),
  savedContacts: z.array(z.string()),
  noPerson: z.array(z.string()),
  existing: z.array(z.string()),
  result: PipelineImportResultSchema.nullable(),
});
export type PipelineImportCard = z.infer<typeof PipelineImportCardSchema>;

/**
 * Changes only the pipeline fields of an existing prospect, named by its contact or, for a record
 * with no person yet, by the record. Null clears the check size or next step.
 */
export const ProspectSaveInputSchema = z.object({
  id: Id,
  stage: ContactStageSchema.optional(),
  status: PipelineStatusSchema.optional(),
  /** Out also moves the record to Passed and clears the next call; null clears the stance. */
  interest: PipelineInterestSchema.nullish(),
  nextCallAt: IsoDate.nullish(),
  nextCallHasTime: z.boolean().optional(),
  referredByContactId: Id.nullish(),
  /** An Undo's guard: the save applies only while the record still has these values. */
  expect: z
    .object({
      status: PipelineStatusSchema.optional(),
      interest: PipelineInterestSchema.nullable().optional(),
      nextCallAt: IsoDate.nullable().optional(),
    })
    .optional(),
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

/** Logs one call on a record named by its contact or, for a record with no person, by the record. */
export const PipelineCallLogInputSchema = z.object({
  id: Id,
  outcome: PipelineCallOutcomeSchema,
  note: z.string().trim().max(2000).nullish(),
  /** "keep" leaves the next call alone, so the row stays due until the founder picks a date. */
  nextCall: z.union([
    z.literal("keep"),
    z.object({ at: IsoDate.nullable(), hasTime: z.boolean().default(false) }),
  ]),
});
export type PipelineCallLogInput = z.infer<typeof PipelineCallLogInputSchema>;

export const PipelineCallLogResultSchema = z.object({
  eventId: Id,
  /** Spoke moved the record from before Met to Met. */
  movedToMet: z.boolean(),
});
export type PipelineCallLogResult = z.infer<typeof PipelineCallLogResultSchema>;

/** Undoes one automatic change: each field goes back only while it still holds what the job set. */
export const PipelineAutoUndoInputSchema = z.object({ eventId: Id });
export type PipelineAutoUndoInput = z.infer<typeof PipelineAutoUndoInputSchema>;
