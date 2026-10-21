import * as z from "zod";
import {
  CompanyEdgeRecordSchema,
  CompanyEntityRecordSchema,
  CompanyEventRecordSchema,
  CompanyFactKindSchema,
} from "./company.js";

export const CompanyFactRefSchema = z.object({
  kind: CompanyFactKindSchema,
  id: z.string().min(1),
});
export const CompanyFactSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("entity"), record: CompanyEntityRecordSchema }),
  z.object({ kind: z.literal("edge"), record: CompanyEdgeRecordSchema }),
  z.object({ kind: z.literal("event"), record: CompanyEventRecordSchema }),
]);
export const CompanyPageSchema = z.object({
  entities: z.array(CompanyEntityRecordSchema),
  edges: z.array(CompanyEdgeRecordSchema),
  events: z.array(CompanyEventRecordSchema),
  latestRun: z.object({ id: z.string(), status: z.string() }).nullable(),
});
export type CompanyFact = z.infer<typeof CompanyFactSchema>;
export type CompanyPageData = z.infer<typeof CompanyPageSchema>;

export function companyFactIsVisible(fact: {
  status: string;
  confidence: number;
  evidence: { sourceKind: string; sourceItemId: string }[];
}): boolean {
  if (fact.status === "rejected") return false;
  return (
    fact.status === "confirmed" ||
    fact.confidence >= 0.8 ||
    fact.evidence.some((a) =>
      fact.evidence.some((b) => a.sourceKind !== b.sourceKind && a.sourceItemId !== b.sourceItemId),
    )
  );
}
