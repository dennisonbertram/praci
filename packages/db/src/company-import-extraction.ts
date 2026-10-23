import type { CompanyImportReadPage } from "@rakazo/adapter-kit";
import type { Actor, CompanyEvidenceInput } from "@rakazo/contracts";
import { CompanyExtractionSchema } from "@rakazo/contracts";
import type { Prisma } from "./client.js";
import { companyWriter } from "./company.js";

export async function persistCompanyExtraction(
  tx: Prisma.TransactionClient,
  actor: Actor,
  input: NonNullable<CompanyImportReadPage["extractions"]>[number],
  source: {
    sourceKind: CompanyEvidenceInput["sourceKind"];
    connectionId: string | null;
    runId: string;
  },
) {
  const extraction = CompanyExtractionSchema.parse(input.extraction);
  const writer = companyWriter(tx, actor);
  const refs = new Map<string, string>();
  const suppressed = new Set<string>();
  const deferred = new Map<string, string>();
  let count = 0;
  const evidence = (quote: string, confidence: number): CompanyEvidenceInput => ({
    stance: "supports",
    sourceKind: source.sourceKind,
    connectionId: source.connectionId,
    dataRoomItemId: source.sourceKind === "data_room" ? input.sourceItemId : null,
    sourceItemId: input.sourceItemId,
    contentHash: input.contentHash,
    sourceUrl: input.sourceUrl,
    quote,
    confidence,
    extractorRunId: source.runId,
    extractorModel: input.model,
    extractedAt: new Date().toISOString(),
  });
  for (const fact of extraction.entities) {
    const result = await writer.importEntity({
      entity: fact.entity,
      evidence: evidence(fact.quote, fact.entity.confidence),
    });
    if ("suppressed" in result) suppressed.add(fact.ref);
    else if ("deferred" in result) deferred.set(fact.ref, result.candidateId);
    else {
      refs.set(fact.ref, result.id);
      count++;
    }
  }
  const defer = async (
    kind: "edge" | "event",
    subjects: string[],
    fact: unknown,
    quote: string,
    confidence: number,
  ) => {
    await writer.deferImportRelation({
      kind,
      entityIds: subjects.flatMap((ref) => (refs.has(ref) ? [refs.get(ref)!] : [])),
      proposedFact: {
        fact,
        entities: extraction.entities.filter((entity) => subjects.includes(entity.ref)),
        resolvedRefs: Object.fromEntries(
          subjects.filter((ref) => refs.has(ref)).map((ref) => [ref, refs.get(ref)]),
        ),
        candidateRefs: Object.fromEntries(
          subjects.filter((ref) => deferred.has(ref)).map((ref) => [ref, deferred.get(ref)]),
        ),
      },
      evidence: evidence(quote, confidence),
    });
  };
  for (const fact of extraction.edges) {
    const subjects = [fact.fromRef, fact.toRef];
    if (subjects.some((ref) => suppressed.has(ref))) continue;
    if (subjects.some((ref) => deferred.has(ref))) {
      await defer("edge", subjects, fact, fact.quote, fact.confidence);
      continue;
    }
    const { fromRef, toRef, quote, ...edge } = fact;
    const result = await writer.importEdge({
      edge: { ...edge, fromId: refs.get(fromRef)!, toId: refs.get(toRef)! },
      evidence: evidence(quote, fact.confidence),
    });
    if (!("suppressed" in result) && !("deferred" in result)) count++;
  }
  for (const fact of extraction.events) {
    if (fact.entityRefs.some((ref) => suppressed.has(ref))) continue;
    if (fact.entityRefs.some((ref) => deferred.has(ref))) {
      await defer("event", fact.entityRefs, fact, fact.quote, fact.confidence);
      continue;
    }
    const { entityRefs, quote, ...event } = fact;
    const result = await writer.importEvent({
      event: { ...event, entityIds: entityRefs.map((ref) => refs.get(ref)!) },
      evidence: evidence(quote, fact.confidence),
    });
    if (!("suppressed" in result) && !("deferred" in result)) count++;
  }
  return count;
}
