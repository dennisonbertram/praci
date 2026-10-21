import { z } from "zod";
import { CompanySourceKindSchema } from "./company.js";

const identifier = z.string().min(1).max(200);

export const CompanyImportSourceInputSchema = z.strictObject({
  sourceKind: CompanySourceKindSchema.exclude(["manual"]),
  connectionId: identifier.nullable().optional(),
  scope: z
    .record(z.string(), z.unknown())
    .default({})
    .refine(
      (value) => new TextEncoder().encode(JSON.stringify(value)).byteLength <= 16_384,
      "scope too large",
    ),
});

export const CompanyImportCreateInputSchema = z.strictObject({
  tokenCap: z.number().int().positive().safe(),
  mode: z.enum(["sample", "full"]).optional(),
  sources: z.array(CompanyImportSourceInputSchema).min(1).max(20),
});

export const CompanyImportRunIdInputSchema = z.strictObject({ runId: identifier });
export const CompanyImportRetryInputSchema = z.strictObject({ runId: identifier });
export const CompanyImportConsentInputSchema = z.strictObject({
  runId: identifier,
  sourceId: identifier,
});
export const CompanyImportConsentRecipientSchema = z.strictObject({
  key: identifier,
  name: z.string().min(1).max(200),
  detail: z.string().max(500),
  privacyUrl: z.string().url().nullable(),
});
export const CompanyImportGrantConsentInputSchema = CompanyImportConsentInputSchema.extend({
  consentKey: identifier,
  version: identifier,
  sourceKind: CompanySourceKindSchema.exclude(["manual"]),
  recipient: CompanyImportConsentRecipientSchema,
});
export const CompanyImportActionInputSchema = z
  .strictObject({
    runId: identifier,
    action: z.enum(["pause", "resume", "continue", "retry_failed", "cancel", "discard"]),
    tokenCap: z.number().int().positive().safe().optional(),
  })
  .refine((input) => input.tokenCap === undefined || input.action === "resume");

export const CompanyImportSourceProgressSchema = z.strictObject({
  id: identifier,
  sourceKind: CompanySourceKindSchema,
  status: z.string(),
  units: z.number().int().nonnegative(),
  itemsDiscovered: z.number().int().nonnegative(),
  itemsRead: z.number().int().nonnegative(),
  factsFound: z.number().int().nonnegative(),
  reservedTokens: z.number().int().nonnegative(),
  inputTokensUsed: z.number().int().nonnegative(),
  outputTokensUsed: z.number().int().nonnegative(),
  lastError: z.string().nullable(),
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
  consentKey: identifier.nullable(),
  sourceKind: CompanySourceKindSchema.exclude(["manual"]),
  recipient: CompanyImportConsentRecipientSchema.nullable(),
  version: z.string(),
});

export type CompanyImportCreateInput = z.infer<typeof CompanyImportCreateInputSchema>;
export type CompanyImportSourceInput = z.infer<typeof CompanyImportSourceInputSchema>;
export type CompanyImportProgress = z.infer<typeof CompanyImportProgressSchema>;
export type CompanyImportEvent = z.infer<typeof CompanyImportEventSchema>;
export type CompanyImportModelConsentStatus = z.infer<typeof CompanyImportModelConsentStatusSchema>;
export type CompanyImportGrantConsentInput = z.infer<typeof CompanyImportGrantConsentInputSchema>;
export type CompanyImportConsentRecipient = z.infer<typeof CompanyImportConsentRecipientSchema>;

export const CompanyImportPlanSchema = z.object({
  itemCount: z.number().int().nonnegative().nullable(),
  tokensLower: z.number().int().nonnegative().safe(),
  tokensUpper: z.number().int().nonnegative().safe(),
  estimateBasis: z.enum(["budget_cap", "sample"]),
});
export const CompanyImportCatalogSourceSchema = z.object({
  key: identifier,
  sourceKind: CompanySourceKindSchema.exclude(["manual"]),
  connectionId: identifier.nullable(),
  label: z.string(),
  available: z.boolean(),
  reason: z.enum(["not_connected", "unsupported", "access_denied"]).nullable(),
  itemCount: z.number().int().nonnegative().nullable(),
  defaultScope: z.record(z.string(), z.unknown()),
  connectPath: z.string().nullable(),
});
export const CompanyImportCatalogSchema = z.object({
  sources: z.array(CompanyImportCatalogSourceSchema),
  folders: z.array(z.object({ id: identifier, name: z.string() })),
});
export const CompanyImportSessionInputSchema = z.object({ runId: identifier.optional() });
export const CompanyImportSessionSchema = z.object({
  mode: z.enum(["sample", "full"]),
  progress: CompanyImportProgressSchema,
  sources: z.array(
    z.object({
      id: identifier,
      label: z.string(),
      sourceKind: CompanySourceKindSchema,
      connectionId: identifier.nullable(),
      scope: z.record(z.string(), z.unknown()),
      plan: CompanyImportPlanSchema,
    }),
  ),
});
export const CompanyImportSampleSchema = z.array(
  z.object({
    sourceId: identifier,
    items: z
      .array(
        z.object({
          sourceItemId: z.string(),
          facts: z.array(
            z.object({
              kind: z.enum(["entity", "edge", "event"]),
              title: z.string(),
              confidence: z.number(),
              quote: z.string(),
            }),
          ),
        }),
      )
      .max(25),
  }),
);
export type CompanyImportPlan = z.infer<typeof CompanyImportPlanSchema>;
export type CompanyImportCatalog = z.infer<typeof CompanyImportCatalogSchema>;
export type CompanyImportCatalogSource = z.infer<typeof CompanyImportCatalogSourceSchema>;
export type CompanyImportSession = z.infer<typeof CompanyImportSessionSchema>;
export type CompanyImportSample = z.infer<typeof CompanyImportSampleSchema>;
