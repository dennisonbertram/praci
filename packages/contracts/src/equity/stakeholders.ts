import * as z from "zod";
import { Id } from "../ids.js";
import {
  EquityDate,
  EquityEmail,
  EquityRecordBaseSchema,
  EquityRequestKey,
  EquityText,
  equityListInput,
  equityPage,
} from "./common.js";

export const EQUITY_STAKEHOLDER_TYPES = ["individual", "organization"] as const;
export const EquityStakeholderTypeSchema = z.enum(EQUITY_STAKEHOLDER_TYPES);
export type EquityStakeholderType = z.infer<typeof EquityStakeholderTypeSchema>;

/** The 16 relationship values, in the reference's order. */
export const EQUITY_RELATIONSHIPS = [
  "advisor",
  "board_member",
  "consultant",
  "employee",
  "executive",
  "founder",
  "international_employee",
  "investor",
  "officer",
  "other",
  "ex_advisor",
  "ex_board_member",
  "ex_consultant",
  "ex_employee",
  "ex_international_employee",
  "ex_founder",
] as const;
export const EquityRelationshipSchema = z.enum(EQUITY_RELATIONSHIPS);
export type EquityRelationship = z.infer<typeof EquityRelationshipSchema>;
export const EQUITY_RELATIONSHIP_LABELS: Record<EquityRelationship, string> = {
  advisor: "Advisor",
  board_member: "Board member",
  consultant: "Consultant",
  employee: "Employee",
  executive: "Executive",
  founder: "Founder",
  international_employee: "International Employee",
  investor: "Investor",
  officer: "Officer",
  other: "Other",
  ex_advisor: "Ex-Advisor",
  ex_board_member: "Ex-Board member",
  ex_consultant: "Ex-Consultant",
  ex_employee: "Ex-Employee",
  ex_international_employee: "Ex-International Employee",
  ex_founder: "Ex-Founder",
};

/** Properties kept as a history of (effective date, value). */
export const EQUITY_DATED_PROPERTY_KINDS = [
  "relationship",
  "job_title",
  "cost_center",
  "department",
] as const;
export const EquityDatedPropertyKindSchema = z.enum(EQUITY_DATED_PROPERTY_KINDS);
export type EquityDatedPropertyKind = z.infer<typeof EquityDatedPropertyKindSchema>;

export const EquityAddressSchema = z.object({
  country: z.string().trim().max(100).nullable().default(null),
  street: z.string().trim().max(300).nullable().default(null),
  city: z.string().trim().max(100).nullable().default(null),
  state: z.string().trim().max(100).nullable().default(null),
  postalCode: z.string().trim().max(30).nullable().default(null),
});
export type EquityAddress = z.infer<typeof EquityAddressSchema>;

/** complete: every field; incomplete: some; none: no address. */
export const EQUITY_ADDRESS_COMPLETENESS = ["complete", "incomplete", "none"] as const;
export const EquityAddressCompletenessSchema = z.enum(EQUITY_ADDRESS_COMPLETENESS);

export const EquityDatedPropertySchema = z.object({
  id: Id,
  kind: EquityDatedPropertyKindSchema,
  effectiveDate: EquityDate,
  value: EquityText,
});
export type EquityDatedProperty = z.infer<typeof EquityDatedPropertySchema>;

export const EquityDatedPropertyInputSchema = z.object({
  kind: EquityDatedPropertyKindSchema,
  effectiveDate: EquityDate,
  value: EquityText,
});
export type EquityDatedPropertyInput = z.infer<typeof EquityDatedPropertyInputSchema>;

const StakeholderFields = {
  type: EquityStakeholderTypeSchema,
  /** "First Last" for a person; the one name for an organization. */
  name: EquityText,
  firstName: EquityText.nullable().optional(),
  lastName: EquityText.nullable().optional(),
  contactEmail: EquityEmail.nullable().optional(),
  portfolioEmail: EquityEmail.nullable().optional(),
  otherEmails: z.array(EquityEmail).max(10).optional(),
  dateOfBirth: EquityDate.nullable().optional(),
  taxId: z.string().trim().max(50).nullable().optional(),
  employeeId: z.string().trim().max(100).nullable().optional(),
  payrollId: z.string().trim().max(100).nullable().optional(),
  addresses: z.array(EquityAddressSchema).max(10).optional(),
  /** { [custom property id]: value } */
  customValues: z.record(z.string(), z.string().max(1000)).optional(),
  parentId: Id.nullable().optional(),
  contactId: Id.nullable().optional(),
  majorInvestor: z.boolean().optional(),
} as const;

/**
 * Fields with no defaults: a create leaves out what it does not set (the store fills null, [] or
 * false) and an update's `.partial()` must never reset a field it did not name.
 */
export const EquityStakeholderSchema = EquityRecordBaseSchema.extend({
  ...z.object(StakeholderFields).required().shape,
  portfolioEmailLocked: z.boolean(),
  /** Current values: the latest dated property of each kind on or before today. */
  relationship: EquityRelationshipSchema.nullable(),
  jobTitle: z.string().nullable(),
  costCenter: z.string().nullable(),
  department: z.string().nullable(),
  terminatedOn: EquityDate.nullable(),
  mergedIntoId: Id.nullable(),
  addressCompleteness: EquityAddressCompletenessSchema,
});
export type EquityStakeholder = z.infer<typeof EquityStakeholderSchema>;

/** The profile: the record and every dated property, newest first. */
export const EquityStakeholderDetailSchema = EquityStakeholderSchema.extend({
  properties: z.array(EquityDatedPropertySchema),
});
export type EquityStakeholderDetail = z.infer<typeof EquityStakeholderDetailSchema>;

export const EquityStakeholderCreateInputSchema = z.object({
  ...StakeholderFields,
  /** The first dated values, e.g. the relationship as of the start date. */
  properties: z.array(EquityDatedPropertyInputSchema).max(50).optional(),
  requestKey: EquityRequestKey,
});
export type EquityStakeholderCreateInput = z.input<typeof EquityStakeholderCreateInputSchema>;

/** Changes the fields given. The portfolio email is refused once it is locked. */
export const EquityStakeholderUpdateInputSchema = z
  .object(StakeholderFields)
  .partial()
  .extend({
    id: Id,
    /** Replaces the dated properties of the kinds listed (all of a kind at once). */
    properties: z.array(EquityDatedPropertyInputSchema).max(200).optional(),
    /** Adds dated entries and keeps the existing history (bulk update uses this). */
    addProperties: z.array(EquityDatedPropertyInputSchema).max(50).optional(),
  });
export type EquityStakeholderUpdateInput = z.input<typeof EquityStakeholderUpdateInputSchema>;

export const EQUITY_STAKEHOLDER_SORT_FIELDS = [
  "name",
  "contactEmail",
  "relationship",
  "costCenter",
  "createdAt",
] as const;
export const EquityStakeholderListInputSchema = equityListInput(EQUITY_STAKEHOLDER_SORT_FIELDS, {
  type: EquityStakeholderTypeSchema.optional(),
  /** "none" matches stakeholders with no relationship entered. */
  relationship: z.array(z.union([EquityRelationshipSchema, z.literal("none")])).optional(),
  costCenter: z.array(z.string().max(200)).optional(),
  addressCompleteness: z.array(EquityAddressCompletenessSchema).optional(),
  createdFrom: EquityDate.optional(),
  createdTo: EquityDate.optional(),
  /** has: holds at least one certificate, convertible or option grant. */
  holdings: z.array(z.enum(["has", "none"])).optional(),
  /**
   * By the vesting schedules of their grants and certificates: active (still vesting), ending
   * (vesting ends within 12 months), ended (every schedule done), none (no schedule).
   */
  vesting: z.array(z.enum(["active", "ending", "ended", "none"])).optional(),
  /** Only stakeholders whose employee ID another stakeholder also has (the notice). */
  duplicateEmployeeId: z.boolean().optional(),
  /** Country of the primary address; "none" matches no address. */
  country: z.array(z.string().max(100)).optional(),
  /** Leave out stakeholders merged into another (default). */
  includeMerged: z.boolean().default(false),
});
export type EquityStakeholderListInput = z.input<typeof EquityStakeholderListInputSchema>;
export const EquityStakeholderPageSchema = equityPage(EquityStakeholderSchema);
export type EquityStakeholderPage = z.infer<typeof EquityStakeholderPageSchema>;

export const EquityCustomPropertySchema = EquityRecordBaseSchema.extend({
  name: EquityText,
  hrisField: EquityText.nullable(),
});
export type EquityCustomProperty = z.infer<typeof EquityCustomPropertySchema>;
export const EquityCustomPropertyCreateInputSchema = z.object({
  name: EquityText,
  hrisField: EquityText.nullable().optional(),
});
export const EquityCustomPropertyUpdateInputSchema =
  EquityCustomPropertyCreateInputSchema.partial().extend({ id: Id });
