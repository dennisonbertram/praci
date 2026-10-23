import { createHash } from "node:crypto";
import type { CompanyImportReadPage } from "@rakazo/adapter-kit";
import type { Actor, CompanyEvidenceInput } from "@rakazo/contracts";
import { CompanyExtractionSchema, keepOwnCompany } from "@rakazo/contracts";
import type { Prisma } from "./client.js";
import { companyWriter } from "./company.js";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonical(item)]),
  );
}

function relationClaimKey(
  kind: "edge" | "event",
  fact: Record<string, unknown>,
  entities: { ref: string; entity: unknown }[],
) {
  const { quote: _quote, confidence: _confidence, ...rawFact } = fact;
  if (kind === "event" && Array.isArray(rawFact.entityRefs))
    rawFact.entityRefs = [...rawFact.entityRefs].sort();
  const rawEntities = entities
    .map(({ ref, entity }) => {
      if (!entity || typeof entity !== "object" || Array.isArray(entity)) return { ref, entity };
      const { confidence: _entityConfidence, ...rawEntity } = entity as Record<string, unknown>;
      return { ref, entity: rawEntity };
    })
    .sort((left, right) => left.ref.localeCompare(right.ref));
  return createHash("sha256")
    .update(JSON.stringify(canonical({ kind, fact: rawFact, entities: rawEntities })))
    .digest("hex");
}

export async function persistCompanyExtraction(
  tx: Prisma.TransactionClient,
  actor: Actor,
  input: NonNullable<CompanyImportReadPage["extractions"]>[number],
  source: {
    sourceKind: CompanyEvidenceInput["sourceKind"];
    connectionId: string | null;
    mcpServerId?: string | null;
    runId: string;
  },
) {
  const space = await tx.space.findUniqueOrThrow({
    where: { id: actor.spaceId },
    select: { name: true },
  });
  const extraction = keepOwnCompany(CompanyExtractionSchema.parse(input.extraction), space.name);
  const writer = companyWriter(tx, actor);
  const refs = new Map<string, string>();
  const suppressed = new Set<string>();
  const deferred = new Map<string, string>();
  let count = 0;
  const evidence = (quote: string, confidence: number): CompanyEvidenceInput => ({
    stance: "supports",
    sourceKind: source.sourceKind,
    connectionId: source.connectionId,
    mcpServerId: source.mcpServerId ?? null,
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
    const evidenceInput = evidence(quote, confidence);
    const entityFacts = extraction.entities
      .filter((entity) => subjects.includes(entity.ref))
      .map(({ ref, entity }) => ({ ref, entity }));
    const claimKey = relationClaimKey(kind, fact as Record<string, unknown>, entityFacts);
    const resolution = await writer.resolveImportClaim({ kind, claimKey, evidence: evidenceInput });
    if (resolution) {
      if (!("suppressed" in resolution)) count++;
      return;
    }
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
      evidence: evidenceInput,
      claimKey,
    });
  };
  for (const fact of extraction.edges) {
    const subjects = [fact.fromRef, fact.toRef];
    if (subjects.some((ref) => suppressed.has(ref))) continue;
    if (subjects.some((ref) => deferred.has(ref))) {
      await defer("edge", subjects, fact, fact.quote, fact.confidence);
      continue;
    }
    const claimKey = relationClaimKey(
      "edge",
      fact as unknown as Record<string, unknown>,
      extraction.entities
        .filter((entity) => subjects.includes(entity.ref))
        .map(({ ref, entity }) => ({ ref, entity })),
    );
    const resolution = await writer.resolveImportClaim({
      kind: "edge",
      claimKey,
      evidence: evidence(fact.quote, fact.confidence),
    });
    if (resolution) {
      if (!("suppressed" in resolution)) count++;
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
    const claimKey = relationClaimKey(
      "event",
      fact as unknown as Record<string, unknown>,
      extraction.entities
        .filter((entity) => fact.entityRefs.includes(entity.ref))
        .map(({ ref, entity }) => ({ ref, entity })),
    );
    const resolution = await writer.resolveImportClaim({
      kind: "event",
      claimKey,
      evidence: evidence(fact.quote, fact.confidence),
    });
    if (resolution) {
      if (!("suppressed" in resolution)) count++;
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
