import { oc } from "@orpc/contract";
import * as z from "zod";
import { Id } from "../ids.js";
import { EquityDate, EquityText, equityListInput, equityPage } from "./common.js";
import {
  EquityAddressSchema,
  EquityStakeholderCreateInputSchema,
  EquityStakeholderDetailSchema,
  EquityStakeholderSchema,
  EquityStakeholderUpdateInputSchema,
} from "./stakeholders.js";

/** Rows of one spreadsheet. The whole batch is refused when any row is invalid. */
export const EquityStakeholderBulkCreateInputSchema = z.object({
  rows: z.array(EquityStakeholderCreateInputSchema).min(1).max(1000),
});
export const EquityStakeholderBulkUpdateInputSchema = z.object({
  rows: z.array(EquityStakeholderUpdateInputSchema).min(1).max(1000),
});
export const EquityStakeholderBulkResultSchema = z.object({
  items: z.array(EquityStakeholderSchema),
});
export type EquityStakeholderBulkResult = z.infer<typeof EquityStakeholderBulkResultSchema>;

/**
 * Merge two stakeholders: `fromId`'s securities move to `intoId`, and `fromId` stays readable
 * with `mergedIntoId` set. Refused when both hold accepted securities under different portfolio
 * emails.
 */
export const EquityStakeholderMergeInputSchema = z.object({
  intoId: Id,
  fromId: Id,
});

/**
 * Terminate: sets the termination date and adds the matching ex- relationship as of the day
 * after. What happens to the holder's grants belongs to the options area.
 */
export const EquityStakeholderTerminateInputSchema = z.object({
  ids: z.array(Id).min(1).max(500),
  terminationDate: EquityDate,
});

/** The fields a change can propose. */
export const EQUITY_CHANGE_FIELDS = [
  "firstName",
  "lastName",
  "contactEmail",
  "dateOfBirth",
  "taxId",
  "jobTitle",
  "costCenter",
  "department",
  "address",
] as const;
export const EquityChangeFieldSchema = z.enum(EQUITY_CHANGE_FIELDS);
export type EquityChangeField = z.infer<typeof EquityChangeFieldSchema>;

export const EquityChangeProposedSchema = z.object({
  firstName: z.string().trim().max(200).optional(),
  lastName: z.string().trim().max(200).optional(),
  contactEmail: z.string().trim().toLowerCase().max(320).optional(),
  dateOfBirth: EquityDate.optional(),
  taxId: z.string().trim().max(50).optional(),
  jobTitle: z.string().trim().max(200).optional(),
  costCenter: z.string().trim().max(200).optional(),
  department: z.string().trim().max(200).optional(),
  address: EquityAddressSchema.optional(),
});
export type EquityChangeProposed = z.infer<typeof EquityChangeProposedSchema>;

export const EQUITY_CHANGE_KINDS = ["match", "termination", "profile"] as const;
export const EquityChangeKindSchema = z.enum(EQUITY_CHANGE_KINDS);
export type EquityChangeKind = z.infer<typeof EquityChangeKindSchema>;
/** "portal": the holder proposed it from the investor portal (access area). */
export const EQUITY_CHANGE_SOURCES = ["file", "portfolio", "portal"] as const;
export const EquityChangeSourceSchema = z.enum(EQUITY_CHANGE_SOURCES);
export const EQUITY_CHANGE_STATUSES = ["pending", "accepted", "rejected"] as const;
export const EquityChangeStatusSchema = z.enum(EQUITY_CHANGE_STATUSES);

export const EquityStakeholderChangeSchema = z.object({
  id: Id,
  kind: EquityChangeKindSchema,
  source: EquityChangeSourceSchema,
  stakeholderId: Id.nullable(),
  /** The matched stakeholder's name, for the list. */
  stakeholderName: z.string().nullable(),
  employeeId: z.string().nullable(),
  externalName: z.string().nullable(),
  externalEmail: z.string().nullable(),
  proposed: EquityChangeProposedSchema,
  terminationDate: EquityDate.nullable(),
  status: EquityChangeStatusSchema,
  acceptedFields: z.array(EquityChangeFieldSchema),
  resolvedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type EquityStakeholderChange = z.infer<typeof EquityStakeholderChangeSchema>;

export const EquityStakeholderChangeListInputSchema = equityListInput(["createdAt"], {
  kind: EquityChangeKindSchema.optional(),
  status: EquityChangeStatusSchema.default("pending"),
});
export const EquityStakeholderChangePageSchema = equityPage(EquityStakeholderChangeSchema);

/** Pending counts per kind, for the tab badges and the list header. */
export const EquityStakeholderChangeCountsSchema = z.object({
  match: z.number().int().nonnegative(),
  termination: z.number().int().nonnegative(),
  profile: z.number().int().nonnegative(),
  lastProposedAt: z.string().nullable(),
});

/**
 * One row of an imported employee file. The store matches it to a stakeholder by employee ID,
 * then contact email; a match with different values becomes a profile change, a row with a
 * termination date a termination, and an unmatched row a match to review.
 */
export const EquityChangeImportRowSchema = z.object({
  employeeId: z.string().trim().max(100).optional(),
  name: EquityText,
  email: z.string().trim().toLowerCase().max(320).optional(),
  terminationDate: EquityDate.optional(),
  proposed: EquityChangeProposedSchema.default({}),
});
export const EquityChangeImportInputSchema = z.object({
  rows: z.array(EquityChangeImportRowSchema).min(1).max(2000),
});
export const EquityChangeImportResultSchema = z.object({
  match: z.number().int(),
  termination: z.number().int(),
  profile: z.number().int(),
  unchanged: z.number().int(),
  /** Profile changes applied at once by the automation preferences. */
  applied: z.number().int().optional(),
  /** Unmatched employees added as stakeholders by auto creation. */
  created: z.number().int().optional(),
});

/**
 * Resolve one change. profile: apply `fields` (at least one) or reject. match: link to
 * `stakeholderId`, create a new stakeholder (`create: true`), or reject. termination: accept
 * terminates the matched stakeholder on the change's date.
 */
export const EquityStakeholderChangeResolveInputSchema = z.object({
  id: Id,
  decision: z.enum(["accept", "reject"]),
  fields: z.array(EquityChangeFieldSchema).optional(),
  stakeholderId: Id.optional(),
  create: z.boolean().optional(),
});

export const EQUITY_HRIS_AUTO_FIELDS = [
  "address",
  "cost_center",
  "department",
  "hire_date",
  "job_title",
  "tax_id",
] as const;
export const EquityHrisPreferencesSchema = z.object({
  autoUpdates: z.boolean(),
  autoFields: z.array(z.enum(EQUITY_HRIS_AUTO_FIELDS)),
  autoCreate: z.boolean(),
});
export type EquityHrisPreferences = z.infer<typeof EquityHrisPreferencesSchema>;

/** equity.stakeholderActions, equity.stakeholderChanges and equity.hrisPreferences. */
export const equityStakeholderAreaContract = {
  stakeholderActions: {
    bulkCreate: oc
      .input(EquityStakeholderBulkCreateInputSchema)
      .output(EquityStakeholderBulkResultSchema),
    bulkUpdate: oc
      .input(EquityStakeholderBulkUpdateInputSchema)
      .output(EquityStakeholderBulkResultSchema),
    merge: oc.input(EquityStakeholderMergeInputSchema).output(EquityStakeholderDetailSchema),
    /** Removes a custom property and its value from every stakeholder. */
    deleteCustomProperty: oc.input(z.object({ id: Id })).output(z.object({ id: Id })),
    terminate: oc
      .input(EquityStakeholderTerminateInputSchema)
      .output(EquityStakeholderBulkResultSchema),
  },
  stakeholderChanges: {
    list: oc
      .input(EquityStakeholderChangeListInputSchema)
      .output(EquityStakeholderChangePageSchema),
    counts: oc.output(EquityStakeholderChangeCountsSchema),
    import: oc.input(EquityChangeImportInputSchema).output(EquityChangeImportResultSchema),
    resolve: oc
      .input(EquityStakeholderChangeResolveInputSchema)
      .output(EquityStakeholderChangeSchema),
  },
  hrisPreferences: {
    get: oc.output(EquityHrisPreferencesSchema),
    set: oc.input(EquityHrisPreferencesSchema).output(EquityHrisPreferencesSchema),
  },
};
