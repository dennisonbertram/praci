import * as z from "zod";
import type { CompanyEntityInput } from "./company.js";
import {
  CompanyEdgeRecordSchema,
  CompanyEntityRecordSchema,
  CompanyEventRecordSchema,
  CompanyEvidenceRecordSchema,
  CompanySourceKindSchema,
  CompanyVisibilitySchema,
  companyEntityIdentifiers,
  normalizeCompanyName,
} from "./company.js";
import { CompanyFactRefSchema } from "./company-page.js";

export const CompanySourceLocatorSchema = z.strictObject({
  sourceKind: CompanySourceKindSchema.refine((kind) => kind !== "manual"),
  connectionId: z.string().min(1).nullable(),
  mcpServerId: z.string().min(1).nullable(),
});
export const CompanySourceControlSchema = CompanySourceLocatorSchema.extend({
  connected: z.boolean(),
});
export const CompanyPrivacySchema = z.object({
  sources: z.array(
    CompanySourceLocatorSchema.extend({
      label: z.string(),
      evidenceCount: z.number().int().nonnegative(),
      blocked: z.boolean(),
    }),
  ),
});
export const CompanyVisibilityInputSchema = CompanyFactRefSchema.extend({
  visibility: CompanyVisibilitySchema,
});
export const CompanyExportSchema = z.object({
  version: z.literal(1),
  exportedAt: z.iso.datetime(),
  entities: z.array(CompanyEntityRecordSchema),
  edges: z.array(CompanyEdgeRecordSchema),
  events: z.array(CompanyEventRecordSchema),
  evidence: z.array(CompanyEvidenceRecordSchema),
});
export type CompanySourceLocator = z.infer<typeof CompanySourceLocatorSchema>;
export type CompanyPrivacy = z.infer<typeof CompanyPrivacySchema>;
export type CompanyExport = z.infer<typeof CompanyExportSchema>;

export function companyPrivacySourceKey(source: CompanySourceLocator): string {
  return JSON.stringify([source.sourceKind, source.connectionId, source.mcpServerId]);
}

export function companyExcludedPersonAliases(entity: CompanyEntityInput): string[] {
  if (entity.kind !== "person") return [];
  return [
    ...new Set([
      ...companyEntityIdentifiers(entity).map((value) => `person:${value}`),
      ...[entity.displayName, ...(entity.attrs.aliases ?? [])]
        .map(normalizeCompanyName)
        .filter(Boolean)
        .map((value) => `person:name:${value}`),
    ]),
  ].sort();
}
