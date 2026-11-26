import * as z from "zod";
import { Id } from "../ids.js";
import {
  EquityCents,
  EquityDate,
  EquityDecimal,
  EquityLongText,
  EquityPositiveShares,
  EquityRecordBaseSchema,
  EquityRequestKey,
  EquityShares,
  EquityText,
  equityListInput,
  equityPage,
} from "./common.js";
import { EquityAcceptanceStatusSchema } from "./securities.js";

/** One custom vesting tranche: a percent of the total vesting `monthOffset` months after the start. */
export const EquityVestingTrancheSchema = z.object({
  monthOffset: z.number().int().min(0).max(600),
  percent: EquityDecimal,
});
export type EquityVestingTranche = z.infer<typeof EquityVestingTrancheSchema>;

const TRANCHE_SCALE = 10n ** 10n;
/** Percents sum to exactly 100 and month offsets strictly increase, so no tranche is hidden or merged. */
const EquityVestingTranchesSchema = z
  .array(EquityVestingTrancheSchema)
  .max(600)
  .superRefine((tranches, context) => {
    if (tranches.length === 0) return;
    let total = 0n;
    for (const { percent } of tranches) {
      const [whole = "0", fraction = ""] = percent.split(".");
      total += BigInt(whole) * TRANCHE_SCALE + BigInt(fraction.padEnd(10, "0"));
    }
    if (total !== 100n * TRANCHE_SCALE)
      context.addIssue({
        code: "custom",
        message: "tranche percents must sum to 100",
      });
    for (let index = 1; index < tranches.length; index += 1) {
      if (tranches[index]!.monthOffset <= tranches[index - 1]!.monthOffset) {
        context.addIssue({
          code: "custom",
          message: "tranche month offsets must be strictly increasing",
        });
        break;
      }
    }
  });

/** An even rule (total, cliff, frequency) or custom tranches that sum to 100 percent. */
const VestingRuleFields = {
  totalMonths: z.number().int().min(0).max(600),
  cliffMonths: z.number().int().min(0).max(600).optional(),
  /** Months between vesting events after the cliff; 1 is monthly. */
  frequencyMonths: z.number().int().min(1).max(120).optional(),
  tranches: EquityVestingTranchesSchema.nullable().optional(),
} as const;

export const EquityVestingTemplateSchema = EquityRecordBaseSchema.extend({
  name: EquityText,
  ...z.object(VestingRuleFields).required().shape,
});
export type EquityVestingTemplate = z.infer<typeof EquityVestingTemplateSchema>;
export const EquityVestingTemplateCreateInputSchema = z.object({
  name: EquityText,
  ...VestingRuleFields,
});
export type EquityVestingTemplateCreateInput = z.input<
  typeof EquityVestingTemplateCreateInputSchema
>;
export const EquityVestingTemplateUpdateInputSchema =
  EquityVestingTemplateCreateInputSchema.partial().extend({ id: Id });
export const EquityVestingTemplateListInputSchema = equityListInput(["name", "createdAt"], {});
export const EquityVestingTemplatePageSchema = equityPage(EquityVestingTemplateSchema);

const VestingScheduleFields = {
  templateId: Id.nullable().optional(),
  startDate: EquityDate,
  totalMonths: z.number().int().min(0).max(600).optional(),
  cliffMonths: z.number().int().min(0).max(600).optional(),
  frequencyMonths: z.number().int().min(1).max(120).optional(),
  tranches: EquityVestingTranchesSchema.nullable().optional(),
  acceleratedShares: EquityShares.nullable().optional(),
  acceleratedOn: EquityDate.nullable().optional(),
  stoppedOn: EquityDate.nullable().optional(),
} as const;
export const EquityVestingScheduleSchema = EquityRecordBaseSchema.extend({
  ...z.object(VestingScheduleFields).required().shape,
  /** Human summary, e.g. "1/48 monthly, 1 year cliff". */
  description: z.string(),
});
export type EquityVestingSchedule = z.infer<typeof EquityVestingScheduleSchema>;
/** A schedule input: from a template (its rule is copied) or a rule of its own. */
export const EquityVestingScheduleInputSchema = z
  .object(VestingScheduleFields)
  .superRefine((value, ctx) => {
    if (value.totalMonths === undefined && !value.templateId)
      ctx.addIssue({
        code: "custom",
        path: ["totalMonths"],
        message: "Required without a template",
      });
  });
export type EquityVestingScheduleInput = z.input<typeof EquityVestingScheduleInputSchema>;

/** Option statuses; the reference showed Forfeited and Canceled, the others are the grant's life. */
export const EQUITY_OPTION_STATUSES = [
  "outstanding",
  "exercised",
  "forfeited",
  "canceled",
  "expired",
] as const;
export const EquityOptionStatusSchema = z.enum(EQUITY_OPTION_STATUSES);
export type EquityOptionStatus = z.infer<typeof EquityOptionStatusSchema>;
export const EQUITY_OPTION_TYPES = ["iso", "nso"] as const;
export const EquityOptionTypeSchema = z.enum(EQUITY_OPTION_TYPES);

const OptionGrantFields = {
  /** Security ID, e.g. ES-40. Left out on create, the next free ES label is used. */
  label: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[A-Z0-9]+-\d+$/, "a prefix and a number, e.g. ES-40"),
  stakeholderId: Id,
  planId: Id,
  /** Defaults to the plan's class. */
  shareClassId: Id.optional(),
  status: EquityOptionStatusSchema.optional(),
  optionType: EquityOptionTypeSchema,
  quantity: EquityPositiveShares,
  exercisePrice: EquityDecimal,
  grantDate: EquityDate,
  expirationDate: EquityDate.nullable().optional(),
  boardApprovedOn: EquityDate.nullable().optional(),
  postTerminationExerciseMonths: z.number().int().min(0).max(600).nullable().optional(),
  earlyExercise: z.boolean().optional(),
  acceptanceStatus: EquityAcceptanceStatusSchema.optional(),
  canceledOn: EquityDate.nullable().optional(),
  adminNotes: EquityLongText.nullable().optional(),
} as const;

export const EquityOptionGrantSchema = EquityRecordBaseSchema.extend({
  ...z.object(OptionGrantFields).required().shape,
  quantity: EquityShares,
  stakeholderName: z.string(),
  planName: z.string(),
  exercisedQuantity: EquityShares,
  canceledQuantity: EquityShares,
  /** Derived: quantity less exercised and canceled; vested as of today from the schedule. */
  outstandingQuantity: EquityShares,
  vestedQuantity: EquityShares,
  vestingSchedule: EquityVestingScheduleSchema.nullable(),
});
export type EquityOptionGrant = z.infer<typeof EquityOptionGrantSchema>;
export const EquityOptionGrantCreateInputSchema = z.object({
  ...OptionGrantFields,
  label: OptionGrantFields.label.optional(),
  vesting: EquityVestingScheduleInputSchema.nullable().optional(),
  requestKey: EquityRequestKey,
});
export type EquityOptionGrantCreateInput = z.input<typeof EquityOptionGrantCreateInputSchema>;
export const EquityOptionGrantUpdateInputSchema = z
  .object(OptionGrantFields)
  .partial()
  .extend({
    id: Id,
    /** Replaces the vesting schedule (a vesting_change transaction); null removes it. */
    vesting: EquityVestingScheduleInputSchema.nullable().optional(),
    reason: z.enum(["clerical_error", "amendment"]).default("clerical_error"),
    note: EquityLongText.optional(),
  });
export type EquityOptionGrantUpdateInput = z.input<typeof EquityOptionGrantUpdateInputSchema>;
export const EQUITY_OPTION_GRANT_SORT_FIELDS = [
  "label",
  "stakeholderName",
  "status",
  "quantity",
  "exercisePrice",
  "grantDate",
] as const;
export const EquityOptionGrantListInputSchema = equityListInput(EQUITY_OPTION_GRANT_SORT_FIELDS, {
  stakeholderId: Id.optional(),
  planId: z.array(Id).optional(),
  status: z.array(EquityOptionStatusSchema).optional(),
  optionType: EquityOptionTypeSchema.optional(),
  grantedFrom: EquityDate.optional(),
  grantedTo: EquityDate.optional(),
});
export type EquityOptionGrantListInput = z.input<typeof EquityOptionGrantListInputSchema>;
export const EquityOptionGrantPageSchema = equityPage(EquityOptionGrantSchema);

export const EQUITY_EXERCISE_STATUSES = ["pending", "completed", "canceled"] as const;
export const EquityExerciseStatusSchema = z.enum(EQUITY_EXERCISE_STATUSES);
export const EquityExerciseSchema = EquityRecordBaseSchema.extend({
  optionGrantId: Id,
  optionGrantLabel: z.string(),
  quantity: EquityShares,
  exerciseDate: EquityDate,
  status: EquityExerciseStatusSchema,
  paymentCents: EquityCents,
  requestKey: z.string().uuid().nullable(),
  certificateId: Id.nullable(),
});
export type EquityExercise = z.infer<typeof EquityExerciseSchema>;
/** Records a pending exercise. Completing it (and issuing the certificate) belongs to the options area. */
export const EquityExerciseCreateInputSchema = z.object({
  optionGrantId: Id,
  quantity: EquityPositiveShares,
  exerciseDate: EquityDate,
  requestKey: z.string().uuid(),
  paymentCents: EquityCents.optional(),
});
export const EquityExerciseUpdateInputSchema = z.object({
  id: Id,
  exerciseDate: EquityDate.optional(),
  paymentCents: EquityCents.optional(),
  status: EquityExerciseStatusSchema.optional(),
});
export const EquityExerciseListInputSchema = equityListInput(
  ["exerciseDate", "quantity", "status"],
  {
    optionGrantId: Id.optional(),
    status: z.array(EquityExerciseStatusSchema).optional(),
  },
);
export const EquityExercisePageSchema = equityPage(EquityExerciseSchema);
