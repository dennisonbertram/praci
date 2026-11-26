import * as z from "zod";
import { Id, IsoDate } from "../ids.js";
import {
  EquityCents,
  EquityDate,
  EquityDecimal,
  EquityRecordBaseSchema,
  EquityShares,
  EquityText,
  equityListInput,
  equityPage,
} from "./common.js";

/** Views area: the cap table by stakeholder, cash raised, round modeling, reports, value. */

const AsOfInput = z.object({ asOf: EquityDate.optional() }).default({});

// ---- cap table by stakeholder ----

export const EQUITY_HOLDING_KINDS = ["certificate", "option_grant", "convertible"] as const;
export const EquityHoldingKindSchema = z.enum(EQUITY_HOLDING_KINDS);

export const EquityCapTableByStakeholderInputSchema = AsOfInput;

/** One security behind a stakeholder row, shown when the row is expanded. */
export const EquityStakeholderHoldingSchema = z.object({
  kind: EquityHoldingKindSchema,
  id: Id,
  /** Security ID, e.g. CS-12 (null for a grant or convertible without one). */
  label: z.string().nullable(),
  classOrPlanName: z.string(),
  quantity: EquityShares,
  principalCents: EquityCents,
  issueDate: EquityDate,
});
export type EquityStakeholderHolding = z.infer<typeof EquityStakeholderHoldingSchema>;

const HoldingTotals = {
  options: EquityShares,
  outstandingShares: EquityShares,
  outstandingPercent: EquityDecimal,
  fullyDilutedShares: EquityShares,
  fullyDilutedPercent: EquityDecimal,
  convertiblePrincipalCents: EquityCents,
  cashPaidCents: EquityCents,
} as const;

export const EquityCapTableStakeholderRowSchema = z.object({
  stakeholderId: Id,
  name: z.string(),
  type: z.string(),
  /** Outstanding shares per share class id. */
  sharesByClass: z.record(z.string(), EquityShares),
  ...HoldingTotals,
  securities: z.array(EquityStakeholderHoldingSchema),
});
export type EquityCapTableStakeholderRow = z.infer<typeof EquityCapTableStakeholderRowSchema>;

export const EquityCapTableByStakeholderSchema = z.object({
  asOf: EquityDate,
  classes: z.array(z.object({ id: Id, name: z.string() })),
  rows: z.array(EquityCapTableStakeholderRowSchema),
  totals: z.object({ sharesByClass: z.record(z.string(), EquityShares), ...HoldingTotals }),
  unallocatedPoolShares: EquityShares,
});
export type EquityCapTableByStakeholder = z.infer<typeof EquityCapTableByStakeholderSchema>;

// ---- financing: cash raised and round membership ----

export const EquityCashRaisedInputSchema = AsOfInput;

export const EquityCashRaisedSecuritySchema = z.object({
  kind: z.enum(["certificate", "convertible"]),
  id: Id,
  label: z.string().nullable(),
  stakeholderId: Id,
  stakeholderName: z.string(),
  roundId: Id.nullable(),
  issueDate: EquityDate,
  cashPaidCents: EquityCents,
  debtCanceledCents: EquityCents,
  ipTransferredCents: EquityCents,
  otherConsiderationCents: EquityCents,
  shares: EquityShares,
});
export type EquityCashRaisedSecurity = z.infer<typeof EquityCashRaisedSecuritySchema>;

export const EquityCashRaisedSchema = z.object({
  asOf: EquityDate,
  totalCents: EquityCents,
  /** One bar per share class in issue order, then convertibles (shareClassId null). */
  byClass: z.array(
    z.object({ shareClassId: Id.nullable(), name: z.string(), cashRaisedCents: EquityCents }),
  ),
  byHolder: z.array(
    z.object({ stakeholderId: Id, name: z.string(), cashRaisedCents: EquityCents }),
  ),
  securities: z.array(EquityCashRaisedSecuritySchema),
});
export type EquityCashRaised = z.infer<typeof EquityCashRaisedSchema>;

/** Adds securities to a round, or (roundId null) takes them out of whatever round they are in. */
export const EquityRoundAttachInputSchema = z.object({
  roundId: Id.nullable(),
  certificateIds: z.array(Id).max(500).default([]),
  convertibleIds: z.array(Id).max(500).default([]),
});
export type EquityRoundAttachInput = z.input<typeof EquityRoundAttachInputSchema>;
export const EquityRoundAttachResultSchema = z.object({
  certificates: z.number().int().nonnegative(),
  convertibles: z.number().int().nonnegative(),
});

// ---- round modeling (scenarios never change the ledger) ----

export const EquityScenarioInvestmentSchema = z.object({
  name: EquityText,
  amountCents: EquityCents,
});

const ScenarioFields = {
  name: EquityText,
  preMoneyValuationCents: EquityCents,
  /** Unallocated pool as a percent of post-money fully diluted; null keeps the pool as is. */
  targetPoolPercent: EquityDecimal.nullable().optional(),
  investments: z.array(EquityScenarioInvestmentSchema).max(100),
  /** Outstanding convertibles to convert; omitted converts every outstanding one. */
  convertibleIds: z.array(Id).max(500).nullable().optional(),
} as const;

export const EquityRoundScenarioSchema = EquityRecordBaseSchema.extend({
  ...z.object(ScenarioFields).required().shape,
});
export type EquityRoundScenario = z.infer<typeof EquityRoundScenarioSchema>;
export const EquityRoundScenarioCreateInputSchema = z.object(ScenarioFields);
export type EquityRoundScenarioCreateInput = z.input<typeof EquityRoundScenarioCreateInputSchema>;
export const EquityRoundScenarioUpdateInputSchema = z
  .object(ScenarioFields)
  .partial()
  .extend({ id: Id });
export const EquityRoundScenarioListInputSchema = equityListInput(["updatedAt", "name"], {});
export const EquityRoundScenarioPageSchema = equityPage(EquityRoundScenarioSchema);

/** Model unsaved terms, or a saved scenario by id. */
export const EquityRoundModelInputSchema = z.union([
  z.object({ scenarioId: Id }),
  z.object(ScenarioFields).omit({ name: true }),
]);
export type EquityRoundModelInput = z.input<typeof EquityRoundModelInputSchema>;

export const EQUITY_PRO_FORMA_ROW_KINDS = ["existing", "new_money", "conversion", "pool"] as const;
export const EquityRoundModelSchema = z.object({
  asOf: EquityDate,
  pricePerShare: EquityDecimal,
  preMoneyFullyDilutedShares: EquityShares,
  poolIncreaseShares: EquityShares,
  newMoneyShares: EquityShares,
  conversionShares: EquityShares,
  postMoneyFullyDilutedShares: EquityShares,
  postMoneyValuationCents: EquityCents,
  rows: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      kind: z.enum(EQUITY_PRO_FORMA_ROW_KINDS),
      preShares: EquityShares,
      postShares: EquityShares,
      prePercent: EquityDecimal,
      postPercent: EquityDecimal,
    }),
  ),
});
export type EquityRoundModel = z.infer<typeof EquityRoundModelSchema>;

// ---- reports ----

export const EQUITY_REPORT_KINDS = [
  "cap_table",
  "stakeholder_ledger",
  "securities_ledger",
  "option_holders",
  "vesting",
  "cash_raised",
  "voting_rights",
] as const;
export const EquityReportKindSchema = z.enum(EQUITY_REPORT_KINDS);
export type EquityReportKind = z.infer<typeof EquityReportKindSchema>;

export const EQUITY_REPORT_FORMATS = [
  "text",
  "shares",
  "cents",
  "price",
  "decimal",
  "percent",
  "status",
] as const;
export type EquityReportFormat = (typeof EQUITY_REPORT_FORMATS)[number];

export const EquityReportInputSchema = z.object({
  kind: EquityReportKindSchema,
  asOf: EquityDate.optional(),
  /** Cap table report options. */
  groupBy: z.enum(["share_class", "stakeholder"]).default("share_class"),
  fullyDiluted: z.boolean().default(true),
  includeConvertibles: z.boolean().default(true),
  /** Adds this report to the history (a download, not every on-screen refresh). */
  record: z.boolean().default(false),
});
export type EquityReportInput = z.input<typeof EquityReportInputSchema>;

export const EquityReportSchema = z.object({
  kind: EquityReportKindSchema,
  asOf: EquityDate,
  columns: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      numeric: z.boolean().default(false),
      /** How the screen shows the cell; cents and prices are exact strings on the wire. */
      format: z.enum(EQUITY_REPORT_FORMATS).default("text"),
    }),
  ),
  /** Cell values as display-ready strings (integer and decimal strings stay unformatted). */
  rows: z.array(z.record(z.string(), z.string().nullable())),
  /** The same table as RFC 4180 CSV. */
  csv: z.string(),
});
export type EquityReport = z.infer<typeof EquityReportSchema>;

/** One generated report in the history, with what is needed to open it again. */
export const EquityReportRunSchema = z.object({
  id: Id,
  kind: EquityReportKindSchema,
  asOf: EquityDate,
  groupBy: z.enum(["share_class", "stakeholder"]),
  fullyDiluted: z.boolean(),
  includeConvertibles: z.boolean(),
  createdAt: IsoDate,
});
export type EquityReportRun = z.infer<typeof EquityReportRunSchema>;

// ---- health checks ----

export const EQUITY_HEALTH_RECORD_KINDS = [
  "stakeholder",
  "share_class",
  "certificate",
  "plan",
  "option_grant",
  "convertible",
] as const;
export const EquityHealthRecordKindSchema = z.enum(EQUITY_HEALTH_RECORD_KINDS);

/** Reruns one check by its key (e.g. "class-over-issued"); omitted reruns every check. */
export const EquityHealthRunInputSchema = z
  .object({ check: z.string().max(100).optional() })
  .default({});

/** Runs every check, records new findings, resolves ones that no longer apply. */
export const EquityHealthRunResultSchema = z.object({
  ranAt: IsoDate,
  open: z.number().int().nonnegative(),
  resolved: z.number().int().nonnegative(),
});

// ---- estimated value ----

export const EQUITY_ESTIMATED_VALUE_VISIBILITY = ["hidden", "holders"] as const;
export const EquityEstimatedValueSettingsSchema = z.object({
  visibility: z.enum(EQUITY_ESTIMATED_VALUE_VISIBILITY),
  /** Price per share used to value holdings; null until set. */
  pricePerShare: EquityDecimal.nullable(),
  effectiveDate: EquityDate.nullable(),
  updatedAt: IsoDate.nullable(),
});
export type EquityEstimatedValueSettings = z.infer<typeof EquityEstimatedValueSettingsSchema>;
export const EquityEstimatedValueSettingsInputSchema = EquityEstimatedValueSettingsSchema.omit({
  updatedAt: true,
});
