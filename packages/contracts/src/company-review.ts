import * as z from "zod";
import { CompanyFactSchema } from "./company-page.js";

const choice = z.object({ id: z.string().min(1), title: z.string() });
export const CompanyReviewCandidateSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  reason: z.string(),
  title: z.string(),
  quote: z.string(),
  sourceKind: z.string(),
  details: z.array(z.object({ label: z.string(), value: z.string() })),
  choices: z.array(choice),
  allowSeparate: z.boolean(),
  editableTitle: z.boolean(),
  subjects: z.array(
    z.object({ ref: z.string(), title: z.string(), entityId: z.string().nullable() }),
  ),
  subjectChoices: z.array(choice),
});
export const CompanyReviewItemSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("fact"),
    id: z.string(),
    reason: z.enum(["low_confidence", "contradiction"]),
    fact: CompanyFactSchema,
  }),
  z.object({
    kind: z.literal("candidate"),
    id: z.string(),
    candidate: CompanyReviewCandidateSchema,
  }),
]);
export const CompanyReviewSchema = z.object({ items: z.array(CompanyReviewItemSchema) });
export const CompanyReviewResolveSchema = z.discriminatedUnion("action", [
  z.strictObject({
    candidateId: z.string().min(1),
    version: z.string().min(1),
    action: z.literal("reject"),
  }),
  z.strictObject({
    candidateId: z.string().min(1),
    version: z.string().min(1),
    action: z.literal("confirm"),
    title: z.string().trim().min(1).max(240).optional(),
    targetId: z.string().min(1).optional(),
    separate: z.boolean().default(false),
    subjects: z.record(z.string(), z.string().min(1)).default({}),
  }),
]);
export type CompanyReviewCandidate = z.infer<typeof CompanyReviewCandidateSchema>;
export type CompanyReviewItem = z.infer<typeof CompanyReviewItemSchema>;
export type CompanyReview = z.infer<typeof CompanyReviewSchema>;
export type CompanyReviewResolve = z.infer<typeof CompanyReviewResolveSchema>;
