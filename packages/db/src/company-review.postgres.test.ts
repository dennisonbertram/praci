import type {
  Actor,
  CompanyEventInput,
  CompanyEvidenceInput,
  CompanyExtraction,
} from "@rakazo/contracts";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";
import { companyForActor } from "./company.js";
import { persistCompanyExtraction } from "./company-import-extraction.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE === "1" && databaseUrl ? describe.sequential : describe.skip;

describePostgres("company review (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `company-review-org-${suffix}`;
  const spaceId = `company-review-space-${suffix}`;
  const userId = `company-review-user-${suffix}`;
  const otherUserId = `company-review-other-${suffix}`;
  const actor: Actor = {
    spaceId,
    userId,
    email: "owner@example.test",
    isDeploymentOwner: false,
  };
  let prisma: PrismaClient;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    const createdAt = new Date();
    await prisma.user.createMany({
      data: [userId, otherUserId].map((id) => ({ id, name: id, email: `${id}@example.test` })),
    });
    await prisma.organization.create({
      data: { id: organizationId, name: organizationId, slug: organizationId, createdAt },
    });
    await prisma.space.create({
      data: { id: spaceId, organizationId, name: "Review test space" },
    });
    await prisma.member.create({
      data: {
        id: `company-review-member-${suffix}`,
        organizationId,
        userId,
        role: "owner",
        createdAt,
      },
    });
    await prisma.spaceMember.create({
      data: {
        id: `company-review-space-member-${suffix}`,
        spaceId,
        organizationId,
        userId,
        role: "owner",
        createdAt,
      },
    });
    await prisma.member.create({
      data: {
        id: `company-review-other-member-${suffix}`,
        organizationId,
        userId: otherUserId,
        role: "member",
        createdAt,
      },
    });
    await prisma.spaceMember.create({
      data: {
        id: `company-review-other-space-member-${suffix}`,
        spaceId,
        organizationId,
        userId: otherUserId,
        role: "member",
        createdAt,
      },
    });
  });

  beforeEach(async () => {
    await companyForActor(prisma, actor).eraseMap();
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await close();
  });

  it("queues low-confidence and contradictory facts, acknowledges contradictions, and tombstones rejected candidates", async () => {
    const company = companyForActor(prisma, actor);
    const entity = await company.importEntity({
      entity: {
        kind: "person",
        displayName: "Synthetic Review Person",
        attrs: { workEmails: ["review-person@example.test"] },
        confidence: 0.3,
      },
      evidence: {
        stance: "supports",
        sourceKind: "slack",
        sourceItemId: "review-source-item",
        quote: "Synthetic low-confidence evidence.",
        contentHash: "review-source-hash",
        extractedAt: "2026-01-02T03:04:05.000Z",
        extractorModel: null,
        confidence: 0.3,
      },
    });
    if ("suppressed" in entity || "deferred" in entity) throw new Error("Expected a fact");
    expect(await company.review()).toMatchObject({
      items: [{ kind: "fact", id: entity.id, reason: "low_confidence" }],
    });

    await company.importEntity({
      entity: {
        kind: "person",
        displayName: "Synthetic Review Person",
        attrs: { workEmails: ["review-person@example.test"] },
        confidence: 0.9,
      },
      evidence: {
        stance: "contradicts",
        sourceKind: "slack",
        sourceItemId: "review-contradiction-item",
        quote: "Synthetic contradictory evidence.",
        contentHash: "review-contradiction-hash",
        extractedAt: "2026-01-03T03:04:05.000Z",
        extractorModel: null,
        confidence: 0.9,
      },
    });
    expect(await company.review()).toMatchObject({
      items: [{ kind: "fact", id: entity.id, reason: "contradiction" }],
    });
    await company.confirm(entity.id);
    expect(await company.review()).toMatchObject({ items: [] });
    expect(
      await prisma.companyEvidence.findMany({
        where: { spaceId, ownerUserId: userId, factId: entity.id },
        select: { reviewedAt: true, reviewedByUserId: true },
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reviewedAt: expect.any(Date), reviewedByUserId: userId }),
      ]),
    );

    const candidate = await prisma.companyCandidate.create({
      data: {
        spaceId,
        ownerUserId: userId,
        kind: "person",
        reason: "name_only_person_candidate",
        entityIds: [],
        proposedFact: {},
        sourceKind: "slack",
        sourceItemId: "review-candidate-item",
        sourceKey: "review-exact-source-key",
        quote: "Synthetic candidate quote.",
        contentHash: "review-candidate-hash",
      },
    });
    const queued = await company.review();
    const item = queued.items.find(
      (entry) => entry.kind === "candidate" && entry.id === candidate.id,
    );
    if (!item || item.kind !== "candidate") throw new Error("Expected a review candidate");
    await company.resolveCandidate({
      action: "reject",
      candidateId: candidate.id,
      version: item.candidate.version,
    });
    expect(
      await prisma.companyCandidateResolution.findUnique({
        where: {
          spaceId_ownerUserId_sourceKey_reason: {
            spaceId,
            ownerUserId: userId,
            sourceKey: candidate.sourceKey,
            reason: candidate.reason,
          },
        },
      }),
    ).toMatchObject({ outcome: "rejected", claimKey: candidate.sourceKey });
    expect((await company.review()).items).toEqual([]);
  });

  it("requires the current version and applies a separate title through owner edits", async () => {
    const company = companyForActor(prisma, actor);
    const candidate = await prisma.companyCandidate.create({
      data: {
        spaceId,
        ownerUserId: userId,
        kind: "organisation",
        reason: "ambiguous_organisation_name",
        entityIds: [],
        proposedFact: {
          entity: {
            kind: "organisation",
            displayName: "Synthetic Separate Organisation",
            attrs: { domain: "separate.example.test" },
            confidence: 0.8,
          },
        },
        sourceKind: "slack",
        sourceItemId: "review-title-item",
        sourceKey: "review-title-source-key",
        quote: "Synthetic organisation proposal.",
        contentHash: "review-title-hash",
      },
    });
    const queued = await company.review();
    const item = queued.items.find(
      (entry) => entry.kind === "candidate" && entry.id === candidate.id,
    );
    if (!item || item.kind !== "candidate") throw new Error("Expected a title candidate");
    await expect(
      company.resolveCandidate({
        action: "reject",
        candidateId: candidate.id,
        version: `${item.candidate.version}-stale`,
      }),
    ).rejects.toThrow(/changed|reload/i);
    await company.resolveCandidate({
      action: "confirm",
      candidateId: candidate.id,
      version: item.candidate.version,
      separate: true,
      title: "Synthetic Separate Organisation (edited)",
      subjects: {},
    });
    const entity = await prisma.companyEntity.findFirst({
      where: {
        spaceId,
        ownerUserId: userId,
        displayName: "Synthetic Separate Organisation (edited)",
      },
    });
    expect(entity).toMatchObject({
      kind: "organisation",
      displayName: "Synthetic Separate Organisation (edited)",
    });
  });

  it("does not suppress the original person import when an identity suggestion is rejected", async () => {
    const company = companyForActor(prisma, actor);
    const evidence = (item: string, hash: string) => ({
      stance: "supports" as const,
      sourceKind: "slack" as const,
      sourceItemId: item,
      quote: "Synthetic person identity claim.",
      contentHash: hash,
      extractedAt: "2026-01-05T03:04:05.000Z",
      extractorModel: null,
      confidence: 0.8,
    });
    const input = {
      entity: {
        kind: "person" as const,
        displayName: "Synthetic Replay Person",
        attrs: {},
        confidence: 0.8,
      },
      evidence: evidence("review-person-original", "review-person-original-hash"),
    };
    const first = await company.importEntity(input);
    if ("suppressed" in first || "deferred" in first) throw new Error("Expected original person");
    const replayInput = {
      ...input,
      evidence: evidence("review-person-replay", "review-person-replay-hash"),
    };
    const second = await company.importEntity(replayInput);
    if ("suppressed" in second || "deferred" in second)
      throw new Error("Expected replay person to remain importable");
    const candidate = await prisma.companyCandidate.findFirst({
      where: { spaceId, ownerUserId: userId, sourceItemId: "review-person-replay" },
    });
    if (!candidate) throw new Error("Expected identity suggestion");
    const candidateItem = (await company.review()).items.find(
      (entry) => entry.kind === "candidate" && entry.id === candidate.id,
    );
    if (!candidateItem || candidateItem.kind !== "candidate")
      throw new Error("Expected the identity suggestion in review");
    await company.resolveCandidate({
      action: "reject",
      candidateId: candidate.id,
      version: candidateItem.candidate.version,
    });
    const replay = await company.importEntity(replayInput);
    expect("suppressed" in replay || "deferred" in replay).toBe(false);
    expect(await prisma.companyCandidate.findUnique({ where: { id: candidate.id } })).toBeNull();
  });

  it("binds deferred subjects explicitly and retains exact decisions through replay and disconnect", async () => {
    const company = companyForActor(prisma, actor);
    const target = await company.importEntity({
      entity: {
        kind: "person",
        displayName: "Avery Synthetic",
        attrs: { workEmails: ["avery-target@example.test"] },
        confidence: 0.9,
      },
      evidence: {
        stance: "supports",
        sourceKind: "slack",
        sourceItemId: "deferred-employment-target",
        quote: "Synthetic target person.",
        contentHash: "deferred-employment-target",
        extractedAt: "2026-01-05T00:00:00.000Z",
        extractorModel: null,
        confidence: 0.9,
      },
    });
    if ("suppressed" in target || "deferred" in target)
      throw new Error("Expected target person fixture");
    const original = await company.importEntity({
      entity: {
        kind: "person",
        displayName: "Avery Synthetic",
        attrs: {},
        confidence: 0.9,
      },
      evidence: {
        stance: "supports",
        sourceKind: "slack",
        sourceItemId: "deferred-employment",
        quote: "Avery's original synthetic claim.",
        contentHash: "deferred-employment-original",
        extractedAt: "2026-01-05T00:00:00.000Z",
        extractorModel: null,
        confidence: 0.9,
      },
    });
    if ("suppressed" in original || "deferred" in original)
      throw new Error("Expected original person fixture");
    await company.reject(original.id);
    const first = await company.importEntity({
      entity: {
        kind: "organisation",
        displayName: "Shared Name",
        attrs: { domain: "shared.example.test" },
        confidence: 0.9,
      },
      evidence: {
        stance: "supports",
        sourceKind: "slack",
        sourceItemId: "deferred-employment-company",
        quote: "Synthetic organisation fixture.",
        contentHash: "deferred-employment-company",
        extractedAt: "2026-01-05T00:00:00.000Z",
        extractorModel: null,
        confidence: 0.9,
      },
    });
    if ("suppressed" in first || "deferred" in first)
      throw new Error("Expected organisation fixture");
    await company.confirm(first.id);
    const raw: CompanyExtraction = {
      entities: [
        {
          ref: "person",
          entity: { kind: "person", displayName: "Avery Synthetic", attrs: {}, confidence: 0.8 },
          quote: "Avery works at Shared Name.",
        },
        {
          ref: "company",
          entity: { kind: "organisation", displayName: "Shared Name", attrs: {}, confidence: 0.8 },
          quote: "Avery works at Shared Name.",
        },
      ],
      edges: [
        {
          fromRef: "person",
          toRef: "company",
          relation: "works_at",
          role: "Engineer",
          startsOn: null,
          endsOn: null,
          confidence: 0.8,
          quote: "Avery works at Shared Name.",
        },
      ],
      events: [],
    };
    const persist = (extraction: CompanyExtraction, hash: string) =>
      prisma.$transaction((tx) =>
        persistCompanyExtraction(
          tx,
          actor,
          {
            sourceItemId: "deferred-employment",
            contentHash: hash,
            extraction,
            model: { provider: "synthetic", model: "recorded" },
          },
          { sourceKind: "slack", connectionId: null, runId: "synthetic-review-run" },
        ),
      );
    const relationCard = async () =>
      (await company.review()).items.find(
        (item) =>
          item.kind === "candidate" && item.candidate.reason === "unresolved_import_subjects",
      );
    await persist(raw, "first-content");
    const pending = await relationCard();
    if (!pending || pending.kind !== "candidate") throw new Error("Expected deferred employment");
    await company.resolveCandidate({
      action: "reject",
      candidateId: pending.id,
      version: pending.candidate.version,
    });
    const replay = structuredClone(raw);
    replay.entities.reverse();
    for (const entity of replay.entities) entity.entity.confidence = 0.7;
    replay.edges[0]!.confidence = 0.7;
    await persist(replay, "changed-metadata");
    expect(await relationCard()).toBeUndefined();
    expect(await company.listEdges()).toHaveLength(0);
    replay.edges[0]!.role = "Principal Engineer";
    await persist(replay, "changed-semantic-claim");
    const changed = await relationCard();
    if (!changed || changed.kind !== "candidate") throw new Error("Expected changed employment");
    const person = (await company.list({ kind: "person" }))[0]!;
    await company.confirm(target.id);
    await expect(
      company.resolveCandidate({
        action: "confirm",
        candidateId: changed.id,
        version: changed.candidate.version,
        separate: false,
        subjects: { person: first.id, company: person.id },
      }),
    ).rejects.toThrow(/type/i);
    await company.resolveCandidate({
      action: "confirm",
      candidateId: changed.id,
      version: changed.candidate.version,
      separate: false,
      subjects: { person: target.id, company: first.id },
    });
    expect(await company.listEdges()).toMatchObject([
      { fromId: target.id, toId: first.id, role: "Principal Engineer", status: "confirmed" },
    ]);
    const confirmedEdge = (await company.listEdges())[0]!;
    await company.sourceControl(
      { sourceKind: "slack", connectionId: null, mcpServerId: null },
      false,
    );
    expect(await prisma.companyEdge.findUnique({ where: { id: confirmedEdge.id } })).not.toBeNull();
    await expect(persist(replay, "blocked-replay")).rejects.toThrow();
    await company.sourceControl(
      { sourceKind: "slack", connectionId: null, mcpServerId: null },
      true,
    );
    await persist(replay, "reconnected-replay");
    expect(await company.listEdges()).toHaveLength(1);
    expect(await relationCard()).toBeUndefined();
    await company.eraseMap();
    expect(
      await prisma.companyCandidateResolution.count({ where: { spaceId, ownerUserId: userId } }),
    ).toBe(0);
  });

  it("resolves an event only for its owner and only to an owner-scoped existing event", async () => {
    const company = companyForActor(prisma, actor);
    const other = companyForActor(prisma, { ...actor, userId: otherUserId });
    const evidence: CompanyEvidenceInput = {
      stance: "supports",
      sourceKind: "slack",
      sourceItemId: "event-item",
      quote: "Synthetic launch.",
      contentHash: "event-content",
      extractedAt: "2026-01-05T00:00:00.000Z",
      extractorModel: null,
      confidence: 0.9,
    };
    const event: CompanyEventInput = {
      stream: "product",
      kind: "launch",
      title: "Synthetic launch",
      occursOn: { date: "2026-01-05", precision: "day" },
      entityIds: [],
      confidence: 0.9,
    };
    const own = await company.importEvent({ event, evidence });
    const foreign = await other.importEvent({ event, evidence });
    if (
      "suppressed" in own ||
      "deferred" in own ||
      "suppressed" in foreign ||
      "deferred" in foreign
    )
      throw new Error("Expected events");
    const candidate = await prisma.companyCandidate.create({
      data: {
        spaceId,
        ownerUserId: userId,
        kind: "event",
        reason: "ambiguous_event_subjects",
        entityIds: [],
        proposedFact: { event, matchingEventIds: [own.id, foreign.id] },
        sourceKind: "slack",
        sourceItemId: "ambiguous-event-item",
        sourceKey: "synthetic-ambiguous-event-key",
        quote: "Synthetic launch.",
        contentHash: "ambiguous-event-content",
      },
    });
    const item = (await company.review()).items.find((value) => value.id === candidate.id);
    if (!item || item.kind !== "candidate") throw new Error("Expected event choice");
    expect(item.candidate.choices.map((choice) => choice.id)).toEqual([own.id]);
    expect((await other.review()).items.some((value) => value.id === candidate.id)).toBe(false);
    const input = {
      action: "confirm" as const,
      candidateId: candidate.id,
      version: item.candidate.version,
      separate: false,
      subjects: {},
      targetId: own.id,
    };
    await expect(other.resolveCandidate(input)).rejects.toThrow();
    await expect(company.resolveCandidate({ ...input, targetId: foreign.id })).rejects.toThrow();
    await company.resolveCandidate(input);
    expect(await prisma.companyEvent.findUnique({ where: { id: own.id } })).toMatchObject({
      status: "confirmed",
    });
    expect(await prisma.companyEvent.findUnique({ where: { id: foreign.id } })).toMatchObject({
      status: "suggested",
    });
    expect(await prisma.companyCandidate.findUnique({ where: { id: candidate.id } })).toBeNull();
  });

  it("keeps a rejected name-only claim rejected while an explicit distinct claim survives replay", async () => {
    const company = companyForActor(prisma, actor);
    const entity = {
      kind: "person" as const,
      displayName: "Synthetic Same Name",
      attrs: {},
      confidence: 0.8,
    };
    const evidence: CompanyEvidenceInput = {
      stance: "supports",
      sourceKind: "slack",
      sourceItemId: "rejected-name-original",
      quote: "Synthetic Same Name joined one team.",
      contentHash: "original",
      extractedAt: "2026-01-05T00:00:00.000Z",
      extractorModel: null,
      confidence: 0.8,
    };
    const original = await company.importEntity({ entity, evidence });
    if ("suppressed" in original || "deferred" in original)
      throw new Error("Expected original person");
    await company.reject(original.id);
    const distinct = {
      entity,
      evidence: {
        ...evidence,
        quote: "Synthetic Same Name joined a different team.",
        contentHash: "distinct",
      },
    };
    const candidate = await company.importEntity(distinct);
    if (!("deferred" in candidate)) throw new Error("Expected owner decision for a distinct claim");
    const item = (await company.review()).items.find((value) => value.id === candidate.candidateId);
    if (!item || item.kind !== "candidate") throw new Error("Expected rejected-name review card");
    await company.resolveCandidate({
      action: "confirm",
      candidateId: item.id,
      version: item.candidate.version,
      separate: true,
      subjects: {},
    });
    const replay = await company.importEntity({
      ...distinct,
      evidence: { ...distinct.evidence, contentHash: "distinct-updated-content" },
    });
    expect(replay).toMatchObject({ status: "confirmed" });
    expect(await company.importEntity({ entity, evidence })).toMatchObject({ suppressed: true });
    expect(await company.detail(original.id, { includeRejected: true })).toMatchObject({
      status: "rejected",
    });
  });
});
