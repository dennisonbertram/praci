import { z } from "zod";

// Bank statements uploaded by the user (CSV, OFX/QFX, PDF). A parser turns a file into a
// ParsedStatement; the API checks it, shows it for review, and imports it into an account.

const Cents = z.number().int();
const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const StatementFormatSchema = z.enum(["csv", "ofx", "pdf"]);
export type StatementFormat = z.infer<typeof StatementFormatSchema>;

/** One line of a statement. Money out is negative, money in is positive. */
export const ParsedStatementTxnSchema = z.object({
  date: Day,
  description: z.string().min(1).max(500),
  amountCents: Cents,
  /** Running balance after this line, when the statement prints one. */
  balanceCents: Cents.nullable(),
  /** The bank's own transaction id (OFX FITID), when the file has one. */
  externalId: z.string().max(200).nullable(),
});
export type ParsedStatementTxn = z.infer<typeof ParsedStatementTxnSchema>;

export const ParsedStatementSchema = z.object({
  /** Parser id, e.g. "ofx", "csv", "wells-fargo-pdf", "model-pdf". */
  parser: z.string().min(1),
  institution: z.string().min(1).max(200),
  /** Account name as printed, e.g. "Navigate Business Checking". */
  accountName: z.string().max(200).nullable(),
  /** Last 4 digits of the account number; never the full number. */
  accountLast4: z
    .string()
    .regex(/^\d{4}$/)
    .nullable(),
  currency: z.literal("USD"),
  periodStart: Day,
  periodEnd: Day,
  openingBalanceCents: Cents.nullable(),
  closingBalanceCents: Cents.nullable(),
  transactions: z.array(ParsedStatementTxnSchema),
  /** Parser notes for the review step, e.g. "2 lines could not be read". */
  warnings: z.array(z.string().max(300)),
});
export type ParsedStatement = z.infer<typeof ParsedStatementSchema>;

/**
 * opening + sum(transactions) === closing. `null` when the statement has no opening or closing
 * balance to check against. A failed check blocks import until the user confirms.
 */
export const StatementCheckSchema = z.object({
  balances: z.enum(["match", "mismatch", "unavailable"]),
  differenceCents: Cents.nullable(),
});
export type StatementCheck = z.infer<typeof StatementCheckSchema>;

export const StatementStatusSchema = z.enum(["review", "imported", "failed"]);
export type StatementStatus = z.infer<typeof StatementStatusSchema>;

export const FinanceStatementSchema = z.object({
  id: z.string(),
  accountId: z.string().nullable(),
  fileName: z.string(),
  format: StatementFormatSchema,
  status: StatementStatusSchema,
  institution: z.string().nullable(),
  accountLast4: z.string().nullable(),
  periodStart: Day.nullable(),
  periodEnd: Day.nullable(),
  openingBalanceCents: Cents.nullable(),
  closingBalanceCents: Cents.nullable(),
  transactionCount: z.number().int(),
  check: StatementCheckSchema.nullable(),
  /** True when importing creates a new account (no existing account matched). */
  createsAccount: z.boolean(),
  /** Transactions already present from an overlapping statement; skipped on import. */
  duplicateCount: z.number().int(),
  warnings: z.array(z.string()),
  error: z.string().nullable(),
  uploadedAt: z.string(),
});
export type FinanceStatement = z.infer<typeof FinanceStatementSchema>;

/** An account fed by statements whose newest statement is getting old. */
export const StatementReminderSchema = z.object({
  accountId: z.string(),
  accountName: z.string(),
  /** Last day covered by the newest imported statement. */
  coveredThrough: Day,
  /** The first month-end not yet covered, e.g. "2026-10-31". */
  dueFor: Day,
});
export type StatementReminder = z.infer<typeof StatementReminderSchema>;

export const FinanceStatementUploadInputSchema = z.object({
  fileName: z.string().min(1).max(255),
  /** base64 file contents; the API enforces the size limit. */
  contentBase64: z.string().min(1),
});
export const FinanceStatementConfirmInputSchema = z.object({
  id: z.string(),
  /** Required when check.balances is "mismatch". */
  acceptMismatch: z.boolean().optional(),
});
export const FinanceStatementsOutputSchema = z.object({
  statements: z.array(FinanceStatementSchema),
  reminders: z.array(StatementReminderSchema),
});

/** Upload limits, shared by the API check and the picker. */
export const STATEMENT_MAX_BYTES = 10 * 1024 * 1024;
export const STATEMENT_EXTENSIONS = ["pdf", "csv", "ofx", "qfx"] as const;
export const FinanceStatementDiscardInputSchema = z.object({ id: z.string() });
