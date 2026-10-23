import * as z from "zod";
import {
  CompanyDateSchema,
  CompanyEdgeEditInputSchema,
  CompanyEdgeInputSchema,
  CompanyEntityEditInputSchema,
  CompanyEntityInputSchema,
  CompanyEventEditInputSchema,
  CompanyEventInputSchema,
  CompanyFactKindSchema,
} from "./company.js";
import { CompanyImportRunIdInputSchema } from "./company-import.js";

export const CompanySearchInputSchema = z.strictObject({
  text: z.string().trim().max(200).optional(),
  kind: CompanyFactKindSchema.optional(),
  limit: z.number().int().min(1).max(20).default(10),
});
export const CompanyGetInputSchema = z.strictObject({
  kind: CompanyFactKindSchema,
  id: z.string().trim().min(1).max(300),
});
const DateRangeInputSchema = z.strictObject({
  from: CompanyDateSchema,
  to: CompanyDateSchema,
  stream: z.string().trim().min(1).max(50).optional(),
  entityId: z.string().trim().min(1).max(300).optional(),
  limit: z.number().int().min(1).max(50).default(20),
});
export const TimelineQueryInputSchema = DateRangeInputSchema;
export const CalendarQueryInputSchema = DateRangeInputSchema;
export const CompanyReviewNextInputSchema = z.strictObject({});

const provenance = z.string().trim().min(1).max(240);
export const CompanyFactUpsertInputSchema = z.union([
  z.strictObject({
    operation: z.literal("create"),
    kind: z.literal("entity"),
    fact: CompanyEntityInputSchema,
    provenance,
  }),
  z.strictObject({
    operation: z.literal("create"),
    kind: z.literal("edge"),
    fact: CompanyEdgeInputSchema,
    provenance,
  }),
  z.strictObject({
    operation: z.literal("create"),
    kind: z.literal("event"),
    fact: CompanyEventInputSchema,
    provenance,
  }),
  z.strictObject({
    operation: z.literal("edit"),
    kind: z.literal("entity"),
    patch: CompanyEntityEditInputSchema,
    provenance,
  }),
  z.strictObject({
    operation: z.literal("edit"),
    kind: z.literal("edge"),
    patch: CompanyEdgeEditInputSchema,
    provenance,
  }),
  z.strictObject({
    operation: z.literal("edit"),
    kind: z.literal("event"),
    patch: CompanyEventEditInputSchema,
    provenance,
  }),
]);
export const CompanyImportPlanInputSchema = z.strictObject({});
export const CompanyImportStatusInputSchema = z.strictObject({
  runId: z.string().trim().min(1).max(200).optional(),
});
export const CompanyImportStartInputSchema = CompanyImportRunIdInputSchema;
export const CompanyImportActionToolInputSchema = CompanyImportRunIdInputSchema;

export type CompanySearchInput = z.infer<typeof CompanySearchInputSchema>;
export type CompanyGetInput = z.infer<typeof CompanyGetInputSchema>;
export type TimelineQueryInput = z.infer<typeof TimelineQueryInputSchema>;
export type CalendarQueryInput = z.infer<typeof CalendarQueryInputSchema>;
export type CompanyFactUpsertInput = z.infer<typeof CompanyFactUpsertInputSchema>;
