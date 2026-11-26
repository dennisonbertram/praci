import * as z from "zod";
import { Id, IsoDate } from "../ids.js";
import {
  EquityCents,
  EquityDate,
  EquityDecimal,
  EquityEmail,
  EquityLongText,
  EquityRecordBaseSchema,
  EquityRequestKey,
  EquityShares,
  EquityText,
  equityListInput,
  equityPage,
} from "./common.js";

/** Certificate statuses, in the reference's order. */
export const EQUITY_CERTIFICATE_STATUSES = [
  "outstanding",
  "repurchased",
  "transferred",
  "converted",
  "canceled",
  "performance_recognized",
  "repurchase_period_ending",
  "not_purchased",
  "waiting_for_payment",
  "waiting_for_acceptance",
] as const;
export const EquityCertificateStatusSchema = z.enum(EQUITY_CERTIFICATE_STATUSES);
export type EquityCertificateStatus = z.infer<typeof EquityCertificateStatusSchema>;
export const EQUITY_CERTIFICATE_STATUS_LABELS: Record<EquityCertificateStatus, string> = {
  outstanding: "Outstanding",
  repurchased: "Repurchased",
  transferred: "Transferred",
  converted: "Converted",
  canceled: "Canceled",
  performance_recognized: "Performance recognized",
  repurchase_period_ending: "Repurchase period ending",
  not_purchased: "Not purchased",
  waiting_for_payment: "Waiting for payment",
  waiting_for_acceptance: "Waiting for acceptance",
};
/** Statuses that still count as issued and outstanding shares. */
export const EQUITY_OUTSTANDING_CERTIFICATE_STATUSES: readonly EquityCertificateStatus[] = [
  "outstanding",
  "performance_recognized",
  "repurchase_period_ending",
  "waiting_for_payment",
  "waiting_for_acceptance",
];

export const EQUITY_ACCEPTANCE_STATUSES = [
  "awaiting_officer_signature",
  "awaiting_holder_signature",
  "awaiting_witness_signature",
  "awaiting_spouse_signature",
  "awaiting_cosigner_signature",
  "accepted",
] as const;
export const EquityAcceptanceStatusSchema = z.enum(EQUITY_ACCEPTANCE_STATUSES);
export type EquityAcceptanceStatus = z.infer<typeof EquityAcceptanceStatusSchema>;
export const EQUITY_ACCEPTANCE_STATUS_LABELS: Record<EquityAcceptanceStatus, string> = {
  awaiting_officer_signature: "Awaiting officer signature",
  awaiting_holder_signature: "Awaiting holder signature",
  awaiting_witness_signature: "Awaiting witness signature",
  awaiting_spouse_signature: "Awaiting spouse signature",
  awaiting_cosigner_signature: "Awaiting cosigner signature",
  accepted: "Accepted",
};

export const EQUITY_PAPER_STATUSES = ["paper", "electronic"] as const;
export const EquityPaperStatusSchema = z.enum(EQUITY_PAPER_STATUSES);

/** The holder's details as of the issue date. */
export const EquityPersonnelSnapshotSchema = z.object({
  name: EquityText,
  email: EquityEmail.nullable().default(null),
  dateOfBirth: EquityDate.nullable().default(null),
  relationship: z.string().max(100).nullable().default(null),
  taxId: z.string().max(50).nullable().default(null),
  employeeId: z.string().max(100).nullable().default(null),
  payrollId: z.string().max(100).nullable().default(null),
});

const CertificateFields = {
  /** Security ID, e.g. CS-12. Left out on create, the next free label of the class prefix is used. */
  label: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[A-Z0-9]+-\d+$/, "a prefix and a number, e.g. CS-12"),
  stakeholderId: Id,
  shareClassId: Id,
  planId: Id.nullable().optional(),
  status: EquityCertificateStatusSchema.optional(),
  acceptanceStatus: EquityAcceptanceStatusSchema.optional(),
  paperStatus: EquityPaperStatusSchema.optional(),
  quantity: EquityShares,
  /** Company-provided price per share. */
  pricePerShare: EquityDecimal.nullable().optional(),
  pricePaidPerShare: EquityDecimal.nullable().optional(),
  cashPaidCents: EquityCents.optional(),
  debtCanceledCents: EquityCents.optional(),
  ipTransferredCents: EquityCents.optional(),
  otherConsiderationCents: EquityCents.optional(),
  costBasisCents: EquityCents.nullable().optional(),
  issueDate: EquityDate,
  originalAcquisitionDate: EquityDate.nullable().optional(),
  issuedBy: EquityText.nullable().optional(),
  boardApprovedOn: EquityDate.nullable().optional(),
  rule144Date: EquityDate.nullable().optional(),
  federalExemption: EquityText.nullable().optional(),
  stateExemption: EquityText.nullable().optional(),
  stateOfResidency: EquityText.nullable().optional(),
  legend: EquityLongText.nullable().optional(),
  personnel: EquityPersonnelSnapshotSchema.nullable().optional(),
  collateralized: z.boolean().optional(),
  vestingScheduleId: Id.nullable().optional(),
  parentId: Id.nullable().optional(),
  roundId: Id.nullable().optional(),
  canceledOn: EquityDate.nullable().optional(),
  adminNotes: EquityLongText.nullable().optional(),
} as const;

export const EquityCertificateSchema = EquityRecordBaseSchema.extend({
  ...z.object(CertificateFields).required().shape,
  stakeholderName: z.string(),
  shareClassName: z.string(),
  /** Derived: cash, debt, IP and other consideration together. */
  transactionValueCents: EquityCents,
});
export type EquityCertificate = z.infer<typeof EquityCertificateSchema>;
export const EquityCertificateCreateInputSchema = z.object({
  ...CertificateFields,
  label: CertificateFields.label.optional(),
  requestKey: EquityRequestKey,
});
export type EquityCertificateCreateInput = z.input<typeof EquityCertificateCreateInputSchema>;
/** A clerical fix or an amendment of the record; recorded as a modify transaction. */
export const EquityCertificateUpdateInputSchema = z
  .object(CertificateFields)
  .partial()
  .extend({
    id: Id,
    reason: z.enum(["clerical_error", "amendment"]).default("clerical_error"),
    note: EquityLongText.optional(),
  });
export type EquityCertificateUpdateInput = z.input<typeof EquityCertificateUpdateInputSchema>;
export const EQUITY_CERTIFICATE_SORT_FIELDS = [
  "label",
  "stakeholderName",
  "status",
  "quantity",
  "issueDate",
  "pricePerShare",
] as const;
export const EquityCertificateListInputSchema = equityListInput(EQUITY_CERTIFICATE_SORT_FIELDS, {
  stakeholderId: Id.optional(),
  shareClassId: z.array(Id).optional(),
  planId: z.array(Id).optional(),
  status: z.array(EquityCertificateStatusSchema).optional(),
  acceptanceStatus: z.array(EquityAcceptanceStatusSchema).optional(),
  paperStatus: EquityPaperStatusSchema.optional(),
  issuedFrom: EquityDate.optional(),
  issuedTo: EquityDate.optional(),
  canceledFrom: EquityDate.optional(),
  canceledTo: EquityDate.optional(),
});
export type EquityCertificateListInput = z.input<typeof EquityCertificateListInputSchema>;
export const EquityCertificatePageSchema = equityPage(EquityCertificateSchema);

export const EQUITY_CONVERTIBLE_KINDS = ["safe", "note"] as const;
export const EquityConvertibleKindSchema = z.enum(EQUITY_CONVERTIBLE_KINDS);
/** The reference shows only Converted (ledger) and Canceled (SAFE tracker); the rest are the record's states. */
export const EQUITY_CONVERTIBLE_STATUSES = [
  "outstanding",
  "converted",
  "canceled",
  "repaid",
] as const;
export const EquityConvertibleStatusSchema = z.enum(EQUITY_CONVERTIBLE_STATUSES);
export type EquityConvertibleStatus = z.infer<typeof EquityConvertibleStatusSchema>;
export const EQUITY_VALUATION_CAP_TYPES = ["pre_money", "post_money"] as const;
export const EquityValuationCapTypeSchema = z.enum(EQUITY_VALUATION_CAP_TYPES);
export const EQUITY_INTEREST_TYPES = ["simple", "compound"] as const;
export const EquityInterestTypeSchema = z.enum(EQUITY_INTEREST_TYPES);

export const EquityConvertibleBlockSchema = EquityRecordBaseSchema.extend({
  name: EquityText,
  kind: EquityConvertibleKindSchema,
});
export type EquityConvertibleBlock = z.infer<typeof EquityConvertibleBlockSchema>;
const ConvertibleBlockFields = { name: EquityText, kind: EquityConvertibleKindSchema };
export const EquityConvertibleBlockCreateInputSchema = z.object({
  ...ConvertibleBlockFields,
  requestKey: EquityRequestKey,
});
export const EquityConvertibleBlockUpdateInputSchema = z
  .object(ConvertibleBlockFields)
  .partial()
  .extend({ id: Id });

const ConvertibleFields = {
  label: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[A-Z0-9]+-\d+$/, "a prefix and a number, e.g. SAFE-3"),
  stakeholderId: Id,
  blockId: Id.nullable().optional(),
  kind: EquityConvertibleKindSchema,
  status: EquityConvertibleStatusSchema.optional(),
  principalCents: EquityCents,
  issueDate: EquityDate,
  issuedBy: EquityText.nullable().optional(),
  boardApprovedOn: EquityDate.nullable().optional(),
  /** Percent per year. */
  interestRate: EquityDecimal.nullable().optional(),
  interestStartDate: EquityDate.nullable().optional(),
  interestType: EquityInterestTypeSchema.nullable().optional(),
  dayCountConvention: z.enum(["actual_365", "actual_360", "30_360"]).nullable().optional(),
  maturityDate: EquityDate.nullable().optional(),
  valuationCapCents: EquityCents.nullable().optional(),
  valuationCapType: EquityValuationCapTypeSchema.nullable().optional(),
  /** Percent off the round price. */
  discountPercent: EquityDecimal.nullable()
    .optional()
    .refine(
      (value) =>
        value == null ||
        !EquityDecimal.safeParse(value).success ||
        BigInt(value.split(".")[0]!) < 100n,
      "a discount below 100 percent",
    ),
  conversionPriceBasis: EquityText.nullable().optional(),
  liquidityPriority: EquityText.nullable().optional(),
  convertsToShareClassId: Id.nullable().optional(),
  cashoutMultiplier: EquityDecimal.nullable().optional(),
  mfn: z.boolean().optional(),
  proRata: z.boolean().optional(),
  federalExemption: EquityText.nullable().optional(),
  stateExemption: EquityText.nullable().optional(),
  stateOfResidency: EquityText.nullable().optional(),
  canceledOn: EquityDate.nullable().optional(),
  closedOn: EquityDate.nullable().optional(),
  cancellationReason: EquityText.nullable().optional(),
  convertedToId: Id.nullable().optional(),
  roundId: Id.nullable().optional(),
  adminNotes: EquityLongText.nullable().optional(),
} as const;

export const EquityConvertibleSchema = EquityRecordBaseSchema.extend({
  ...z.object(ConvertibleFields).required().shape,
  stakeholderName: z.string(),
  blockName: z.string().nullable(),
  convertedToLabel: z.string().nullable(),
  /** Derived as of today; unknown for interest-bearing closed notes without closure evidence. */
  interestAccruedCents: EquityCents.nullable(),
  totalCents: EquityCents.nullable(),
});
export type EquityConvertible = z.infer<typeof EquityConvertibleSchema>;
type CapTerms = {
  valuationCapCents?: string | null;
  valuationCapType?: string | null;
};
/** A cap amount is positive when given: "0" is rejected, not silently read as no cap. */
const capIsPositive = (value: CapTerms) =>
  value.valuationCapCents == null || /[1-9]/.test(value.valuationCapCents);
const CAP_POSITIVE = {
  message: "a valuation cap above zero",
  path: ["valuationCapCents"],
};
const CAP_TYPE_REQUIRED = {
  message: "a valuation cap needs a cap type",
  path: ["valuationCapType"],
};
export const EquityConvertibleCreateInputSchema = z
  .object({
    ...ConvertibleFields,
    label: ConvertibleFields.label.optional(),
    requestKey: EquityRequestKey,
  })
  .refine(capIsPositive, CAP_POSITIVE)
  .refine(
    (value) => value.valuationCapCents == null || value.valuationCapType != null,
    CAP_TYPE_REQUIRED,
  );
export type EquityConvertibleCreateInput = z.input<typeof EquityConvertibleCreateInputSchema>;
export const EquityConvertibleUpdateInputSchema = z
  .object(ConvertibleFields)
  .partial()
  .extend({
    id: Id,
    reason: z.enum(["clerical_error", "amendment"]).default("clerical_error"),
    note: EquityLongText.optional(),
  })
  // A partial update may omit the type (the stored row has it); only an explicit null is wrong.
  .refine(capIsPositive, CAP_POSITIVE)
  .refine(
    (value) => value.valuationCapType !== null || value.valuationCapCents == null,
    CAP_TYPE_REQUIRED,
  );
export type EquityConvertibleUpdateInput = z.input<typeof EquityConvertibleUpdateInputSchema>;
export const EQUITY_CONVERTIBLE_SORT_FIELDS = [
  "label",
  "stakeholderName",
  "status",
  "principalCents",
  "issueDate",
] as const;
export const EquityConvertibleListInputSchema = equityListInput(EQUITY_CONVERTIBLE_SORT_FIELDS, {
  stakeholderId: Id.optional(),
  blockId: z.array(Id).optional(),
  kind: EquityConvertibleKindSchema.optional(),
  status: z.array(EquityConvertibleStatusSchema).optional(),
  issuedFrom: EquityDate.optional(),
  issuedTo: EquityDate.optional(),
});
export type EquityConvertibleListInput = z.input<typeof EquityConvertibleListInputSchema>;
export const EquityConvertiblePageSchema = equityPage(EquityConvertibleSchema);

/** Every change to a holding. Append-only. */
export const EQUITY_TRANSACTION_KINDS = [
  "issue",
  "modify",
  "transfer",
  "repurchase",
  "cancel",
  "reverse_cancellation",
  "convert",
  "exercise",
  "vesting_change",
  "stock_split",
  "pool_change",
  "import",
] as const;
export const EquityTransactionKindSchema = z.enum(EQUITY_TRANSACTION_KINDS);
export type EquityTransactionKind = z.infer<typeof EquityTransactionKindSchema>;

export const EQUITY_TRANSFER_REASONS = [
  "death",
  "divorce",
  "donation",
  "gift",
  "other",
  "secondary",
  "tender_offer",
  "transfer_to_affiliated_entity",
] as const;
export const EquityTransferReasonSchema = z.enum(EQUITY_TRANSFER_REASONS);
export const EQUITY_REPURCHASE_REASONS = [
  "buyback",
  "early_exercise_termination",
  "relationship_change",
  "tender_offer",
] as const;
export const EquityRepurchaseReasonSchema = z.enum(EQUITY_REPURCHASE_REASONS);
export const EQUITY_CANCELLATION_REASONS = [
  "acquisition",
  "conversion",
  "dissolved",
  "merger",
  "public_offering",
  "recapitalization",
  "secondary",
  "spinoff",
  "swap",
  "write_off_cancel",
] as const;
export const EquityCancellationReasonSchema = z.enum(EQUITY_CANCELLATION_REASONS);
export const EQUITY_MODIFICATION_REASONS = ["clerical_error", "amendment"] as const;
export const EquityModificationReasonSchema = z.enum(EQUITY_MODIFICATION_REASONS);
export const EQUITY_REASON_LABELS: Record<string, string> = {
  death: "Death",
  divorce: "Divorce",
  donation: "Donation",
  gift: "Gift",
  other: "Other",
  secondary: "Secondary",
  tender_offer: "Tender offer",
  transfer_to_affiliated_entity: "Transfer to affiliated entity",
  buyback: "Buyback",
  early_exercise_termination: "Early exercise termination",
  relationship_change: "Relationship change",
  acquisition: "Acquisition",
  conversion: "Conversion",
  dissolved: "Dissolved",
  merger: "Merger",
  public_offering: "Public offering",
  recapitalization: "Recapitalization",
  spinoff: "Spinoff",
  swap: "Swap",
  write_off_cancel: "Write off cancel",
  clerical_error: "Clerical error",
  amendment: "Amendment",
};

export const EquityTransactionSchema = z.object({
  id: Id,
  kind: EquityTransactionKindSchema,
  effectiveDate: EquityDate,
  reason: z.string().nullable(),
  certificateId: Id.nullable(),
  convertibleId: Id.nullable(),
  optionGrantId: Id.nullable(),
  planId: Id.nullable(),
  /** The label of the security it touched, for the activity list. */
  securityLabel: z.string().nullable(),
  quantity: EquityShares.nullable(),
  valueCents: EquityCents.nullable(),
  before: z.unknown().nullable(),
  after: z.unknown().nullable(),
  resulting: z.array(Id),
  note: z.string().nullable(),
  actorName: z.string().nullable(),
  createdAt: IsoDate,
});
export type EquityTransaction = z.infer<typeof EquityTransactionSchema>;
export const EQUITY_TRANSACTION_SORT_FIELDS = ["createdAt", "effectiveDate", "kind"] as const;
export const EquityTransactionListInputSchema = equityListInput(EQUITY_TRANSACTION_SORT_FIELDS, {
  kind: z.array(EquityTransactionKindSchema).optional(),
  certificateId: Id.optional(),
  convertibleId: Id.optional(),
  optionGrantId: Id.optional(),
  planId: Id.optional(),
  from: EquityDate.optional(),
  to: EquityDate.optional(),
});
export type EquityTransactionListInput = z.input<typeof EquityTransactionListInputSchema>;
export const EquityTransactionPageSchema = equityPage(EquityTransactionSchema);
