import { z } from "zod";
import { CompanySourceKindSchema } from "./company.js";

const identifier = z.string().min(1).max(200);

export const CompanyImportSourceInputSchema = z.strictObject({
  sourceKind: CompanySourceKindSchema.exclude(["manual"]),
  connectionId: identifier.nullable().optional(),
  scope: z.record(z.string(), z.unknown()).default({}),
});

export const CompanyImportCreateInputSchema = z.strictObject({
  tokenCap: z.number().int().positive().safe(),
  sources: z.array(CompanyImportSourceInputSchema).min(1).max(20),
});

export const CompanyImportRunIdInputSchema = z.strictObject({ runId: identifier });
export const CompanyImportRetryInputSchema = z.strictObject({ runId: identifier });
export const CompanyImportConsentInputSchema = z.strictObject({
  runId: identifier,
  sourceId: identifier,
});
export const CompanyImportActionInputSchema = z
  .strictObject({
    runId: identifier,
    action: z.enum(["pause", "resume", "retry_failed", "cancel", "discard"]),
    tokenCap: z.number().int().positive().safe().optional(),
  })
  .refine((input) => input.tokenCap === undefined || input.action === "resume");

export const CompanyImportSourceProgressSchema = z.strictObject({
  id: identifier,
  sourceKind: CompanySourceKindSchema,
  status: z.string(),
  units: z.number().int().nonnegative(),
});

export const CompanyImportProgressSchema = z.strictObject({
  runId: identifier,
  status: z.string(),
  tokenCap: z.number().int().positive(),
  reservedTokens: z.number().int().nonnegative(),
  inputTokensUsed: z.number().int().nonnegative(),
  outputTokensUsed: z.number().int().nonnegative(),
  budgetWarning: z.boolean(),
  counts: z.record(z.string(), z.number().int().nonnegative()),
  sources: z.array(CompanyImportSourceProgressSchema),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const CompanyImportEventSchema = CompanyImportProgressSchema;

export const CompanyImportModelConsentStatusSchema = z.strictObject({
  allowed: z.boolean(),
  recipient: z.string().nullable(),
  version: z.string(),
});

export type CompanyImportCreateInput = z.infer<typeof CompanyImportCreateInputSchema>;
export type CompanyImportSourceInput = z.infer<typeof CompanyImportSourceInputSchema>;
export type CompanyImportProgress = z.infer<typeof CompanyImportProgressSchema>;
export type CompanyImportEvent = z.infer<typeof CompanyImportEventSchema>;
export type CompanyImportModelConsentStatus = z.infer<typeof CompanyImportModelConsentStatusSchema>;
