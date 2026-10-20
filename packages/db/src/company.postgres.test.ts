import { CompanyEntityRecordSchema, normalizeCompanyName } from "@rakazo/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createNorthwindCompanyFixture } from "../../testkit/src/fixtures/company/corpus.js";
import { northwindGroundTruth } from "../../testkit/src/fixtures/company/ground-truth.js";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";
import type {
  CompanyDeferredResult,
  CompanySuppressedResult,
  CompanyWriteResult,
} from "./company.js";
import { companyForActor } from "./company.js";
import { IsolationError } from "./scope.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("company foundation (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `company-org-${suffix}`;
  const spaceId = `company-space-${suffix}`;
  const otherSpaceId = `company-other-space-${suffix}`;
  const fixtureSpaceId = `company-fixture-space-${suffix}`;
  const userId = `company-user-${suffix}`;
  const otherUserId = `company-other-user-${suffix}`;
  let prisma: PrismaClient;
  let close: () => Promise<void>;

  const actor = { spaceId, userId, email: "ignored@example.test", isDeploymentOwner: true };
  const otherActor = {
    spaceId,
    userId: otherUserId,
    email: "other@example.test",
    isDeploymentOwner: false,
  };
  const otherSpaceActor = {
    spaceId: otherSpaceId,
    userId,
    email: "owner@example.test",
    isDeploymentOwner: true,
  };
  const evidence = (sourceItemId: string, contentHash: string) => ({
    stance: "supports" as const,
    sourceKind: "slack" as const,
    sourceItemId,
    quote: "The company source says this.",
    contentHash,
    extractedAt: "2026-01-02T03:04:05.000Z",
    extractorModel: null,
    confidence: 0.9,
  });
  const person = (
    displayName: string,
    sourceItemId: string,
    contentHash: string,
    email?: string,
  ) => ({
    entity: {
      kind: "person" as const,
      displayName,
      attrs: email ? { workEmails: [email] } : {},
      confidence: 0.9,
    },
    evidence: evidence(sourceItemId, contentHash),
  });
  const entityId = (result: CompanyWriteResult): string => {
    if ("suppressed" in result) throw new Error("Expected a company entity");
    return result.id;
  };
  const persisted = <T extends object>(
    result: T,
  ): Exclude<T, CompanySuppressedResult | CompanyDeferredResult> => {
    if ("suppressed" in result || "deferred" in result) {
      throw new Error("Expected a persisted fact");
    }
    return result as Exclude<T, CompanySuppressedResult | CompanyDeferredResult>;
  };
  const candidate = (
    sourceKind: string,
    sourceItemId: string,
    locator: { connectionId?: string; mcpServerId?: string; dataRoomItemId?: string } = {},
  ) =>
    prisma.companyCandidate.create({
      data: {
        spaceId,
        ownerUserId: userId,
        kind: "person",
        reason: "test",
        entityIds: [],
        proposedFact: {},
        sourceKind,
        connectionId: locator.connectionId ?? null,
        mcpServerId: locator.mcpServerId ?? null,
        dataRoomItemId: locator.dataRoomItemId ?? null,
        sourceItemId,
        sourceKey: `test:${sourceItemId}`,
        quote: "Synthetic candidate source.",
        contentHash: `hash:${sourceItemId}`,
      },
    });

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    const createdAt = new Date();
    await prisma.user.createMany({
      data: [
        { id: userId, name: userId, email: `${userId}@example.test` },
        { id: otherUserId, name: otherUserId, email: `${otherUserId}@example.test` },
      ],
    });
    await prisma.organization.create({
      data: { id: organizationId, name: "Company Test Org", slug: organizationId, createdAt },
    });
    await prisma.space.createMany({
      data: [
        { id: spaceId, organizationId, name: "Company Test Space" },
        { id: otherSpaceId, organizationId, name: "Other Company Space" },
        { id: fixtureSpaceId, organizationId, name: "Fixture Company Space" },
      ],
    });
    await prisma.member.createMany({
      data: [
        { id: `company-member-${suffix}`, organizationId, userId, role: "owner", createdAt },
        {
          id: `company-other-member-${suffix}`,
          organizationId,
          userId: otherUserId,
          role: "member",
          createdAt,
        },
      ],
    });
    await prisma.spaceMember.createMany({
      data: [
        { id: `company-sm-a-${suffix}`, spaceId, organizationId, userId, role: "owner", createdAt },
        {
          id: `company-sm-b-${suffix}`,
          spaceId,
          organizationId,
          userId: otherUserId,
          role: "member",
          createdAt,
        },
        {
          id: `company-sm-c-${suffix}`,
          spaceId: otherSpaceId,
          organizationId,
          userId,
          role: "owner",
          createdAt,
        },
        {
          id: `company-sm-d-${suffix}`,
          spaceId: fixtureSpaceId,
          organizationId,
          userId,
          role: "owner",
          createdAt,
        },
      ],
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await close();
  });

  it("scopes list, search, count, detail, evidence and writes to the actor membership", async () => {
    const company = companyForActor(prisma, actor);
    const saved = await company.importEntity(
      person("Northwind", "scope-item", "scope-hash", "owner@example.test"),
    );
    expect(saved).not.toHaveProperty("suppressed");
    expect(await company.count()).toBe(1);
    expect((await company.search("north")).map((row) => row.displayName)).toEqual(["Northwind"]);
    expect((await company.detail(entityId(saved)))?.evidence).toHaveLength(1);
    for (const other of [otherActor, otherSpaceActor]) {
      const isolated = companyForActor(prisma, other);
      expect(await isolated.list()).toEqual([]);
      expect(await isolated.search("Northwind")).toEqual([]);
      expect(await isolated.count()).toBe(0);
      expect(await isolated.detail(entityId(saved))).toBeNull();
      expect(await isolated.evidence(entityId(saved))).toEqual([]);
      await expect(
        isolated.edit({
          entityId: entityId(saved),
          kind: "person",
          displayName: "Should not edit",
        }),
      ).rejects.toThrow();
    }
    await prisma.spaceMember.delete({
      where: { spaceId_userId: { spaceId, userId: otherUserId } },
    });
    await expect(companyForActor(prisma, otherActor).list()).rejects.toBeInstanceOf(IsolationError);
  });

  it("makes replay idempotent, including concurrent writes, while re-extraction adds evidence", async () => {
    const company = companyForActor(prisma, actor);
    const input = person("Replay Person", "replay-item", "replay-hash", "replay@example.test");
    const [first, second] = await Promise.all([
      company.importEntity(input),
      company.importEntity(input),
    ]);
    expect(entityId(first)).toBe(entityId(second));
    await company.importEntity({
      ...input,
      entity: { ...input.entity, attrs: { ...input.entity.attrs, timezone: "UTC" } },
      evidence: evidence("replay-item-2", "replay-hash-2"),
    });
    expect(await prisma.companyEntity.count({ where: { spaceId, ownerUserId: userId } })).toBe(2);
    expect(await company.evidence(entityId(first))).toHaveLength(2);
    expect((await company.detail(entityId(first)))?.attrs).toMatchObject({ timezone: "UTC" });
  });

  it("replays same-source name-only claims after content changes without merging source items", async () => {
    const company = companyForActor(prisma, actor);
    const input = {
      entity: {
        kind: "person" as const,
        displayName: "Name Replay Person",
        attrs: {},
        confidence: 0.9,
      },
      evidence: {
        ...evidence("name-replay-source", "name-replay-original-hash"),
        quote: "Name Replay Person joined the team.",
      },
    };
    const first = persisted(await company.importEntity(input));
    const replay = persisted(
      await company.importEntity({
        ...input,
        evidence: { ...input.evidence, contentHash: "name-replay-edited-hash" },
      }),
    );
    expect(replay.id).toBe(first.id);
    expect(replay.evidence.map((item) => item.contentHash)).toEqual(
      expect.arrayContaining(["name-replay-original-hash", "name-replay-edited-hash"]),
    );
    const differentSource = persisted(
      await company.importEntity({
        ...input,
        evidence: {
          ...input.evidence,
          sourceItemId: "name-replay-different-source",
          contentHash: "name-replay-different-source-hash",
        },
      }),
    );
    expect(differentSource.id).not.toBe(first.id);
    expect(
      await prisma.companyEntity.count({
        where: {
          spaceId,
          ownerUserId: userId,
          kind: "person",
          normalizedName: "name replay person",
        },
      }),
    ).toBe(2);
    expect(CompanyEntityRecordSchema.parse(first)).toMatchObject({ id: first.id, kind: "person" });
  });

  it("keeps same-name organisations separate when domains conflict", async () => {
    const company = companyForActor(prisma, actor);
    const organisation = (domain: string | undefined, sourceItemId: string) => ({
      entity: {
        kind: "organisation" as const,
        displayName: "Shared organisation",
        attrs: domain ? { domain } : {},
        confidence: 0.9,
      },
      evidence: evidence(sourceItemId, `${sourceItemId}-hash`),
    });
    const first = persisted(
      await company.importEntity(organisation("one.example.test", "organisation-one")),
    );
    const second = persisted(
      await company.importEntity(organisation("two.example.test", "organisation-two")),
    );
    expect(second.id).not.toBe(first.id);
    expect(
      await company.importEntity(organisation("one.example.test", "organisation-one-replay")),
    ).toMatchObject({ id: first.id });
    expect(
      (await company.candidates()).some(
        (item) =>
          item.kind === "organisation" &&
          item.reason === "conflicting_organisation_domain" &&
          item.entityIds.includes(first.id),
      ),
    ).toBe(true);

    const ambiguousNameOnly = persisted(
      await company.importEntity(organisation(undefined, "organisation-name-only")),
    );
    expect([first.id, second.id]).not.toContain(ambiguousNameOnly.id);
    expect(
      (await company.candidates()).some(
        (item) =>
          item.kind === "organisation" &&
          item.reason === "ambiguous_organisation_name" &&
          item.entityIds.includes(first.id),
      ),
    ).toBe(true);

    const nameOnly = organisation(undefined, "organisation-name-only-safe");
    nameOnly.entity.displayName = "Unambiguous organisation";
    const nameOnlyFirst = persisted(await company.importEntity(nameOnly));
    const nameOnlyReplay = persisted(
      await company.importEntity({
        ...nameOnly,
        evidence: evidence(
          "organisation-name-only-safe-replay",
          "organisation-name-only-safe-replay-hash",
        ),
      }),
    );
    expect(nameOnlyReplay.id).toBe(nameOnlyFirst.id);

    const mixedName = `Mixed domain organisation ${suffix}`;
    const domainBearing = persisted(
      await company.importEntity({
        entity: {
          kind: "organisation",
          displayName: mixedName,
          attrs: { domain: `mixed-${suffix}.example.test` },
          confidence: 0.9,
        },
        evidence: evidence("mixed-domain-bearing", "mixed-domain-bearing-hash"),
      }),
    );
    const domainless = persisted(
      await company.importEntity({
        entity: {
          kind: "organisation",
          displayName: mixedName,
          attrs: {},
          confidence: 0.9,
        },
        evidence: evidence("mixed-domainless-first", "mixed-domainless-first-hash"),
      }),
    );
    expect(domainless.id).not.toBe(domainBearing.id);
    expect(
      persisted(
        await company.importEntity({
          entity: {
            kind: "organisation",
            displayName: mixedName,
            attrs: {},
            confidence: 0.9,
          },
          evidence: evidence("mixed-domainless-second", "mixed-domainless-second-hash"),
        }),
      ).id,
    ).toBe(domainless.id);
  });

  it("reconciles edited identity rows and preserves locked identities on replay", async () => {
    const company = companyForActor(prisma, actor);
    const oldEmail = `identity-old-${suffix}@example.test`;
    const newEmail = `identity-new-${suffix}@example.test`;
    const originalInput = person(
      `Identity edit ${suffix}`,
      "identity-edit-source",
      "identity-edit-original-hash",
      oldEmail,
    );
    const original = persisted(await company.importEntity(originalInput));
    await company.edit({
      entityId: original.id,
      kind: "person",
      attrs: { workEmails: [newEmail] },
    });
    const replay = persisted(
      await company.importEntity({
        ...originalInput,
        evidence: {
          ...originalInput.evidence,
          contentHash: "identity-edit-replay-hash",
        },
      }),
    );
    expect(replay.id).toBe(original.id);
    expect(replay.attrs).toMatchObject({ workEmails: [newEmail] });
    expect(replay.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          contentHash: "identity-edit-replay-hash",
          stance: "contradicts",
        }),
      ]),
    );
    expect(
      await prisma.companyIdentity.findMany({
        where: { spaceId, ownerUserId: userId, entityId: original.id, identityType: "email" },
        select: { identityValue: true },
      }),
    ).toEqual([{ identityValue: newEmail }]);

    const oldEmailImport = persisted(
      await company.importEntity({
        ...originalInput,
        evidence: evidence("identity-old-new-source", "identity-old-new-source-hash"),
      }),
    );
    expect(oldEmailImport.id).not.toBe(original.id);
    const newEmailImport = persisted(
      await company.importEntity({
        ...originalInput,
        entity: { ...originalInput.entity, attrs: { workEmails: [newEmail] } },
        evidence: evidence("identity-new-source", "identity-new-source-hash"),
      }),
    );
    expect(newEmailImport.id).toBe(original.id);

    const collisionEmail = `identity-collision-${suffix}@example.test`;
    const collisionTarget = persisted(
      await company.importEntity(
        person(
          "Identity collision target",
          "identity-collision-target",
          "identity-collision-target-hash",
          collisionEmail,
        ),
      ),
    );
    const evidenceCount = await prisma.companyEvidence.count({
      where: { spaceId, ownerUserId: userId, factKind: "entity", factId: original.id },
    });
    await expect(
      company.edit({
        entityId: original.id,
        kind: "person",
        attrs: { workEmails: [collisionEmail] },
      }),
    ).rejects.toThrow(/email identity.*already belongs/i);
    expect((await company.detail(original.id))?.attrs).toMatchObject({ workEmails: [newEmail] });
    expect(
      await prisma.companyIdentity.findMany({
        where: { spaceId, ownerUserId: userId, entityId: original.id, identityType: "email" },
        select: { identityValue: true },
      }),
    ).toEqual([{ identityValue: newEmail }]);
    expect(
      await prisma.companyEvidence.count({
        where: { spaceId, ownerUserId: userId, factKind: "entity", factId: original.id },
      }),
    ).toBe(evidenceCount);
    expect(
      persisted(
        await company.importEntity({
          ...originalInput,
          entity: { ...originalInput.entity, attrs: { workEmails: [newEmail] } },
          evidence: evidence("identity-edit-still-resolves", "identity-edit-still-resolves-hash"),
        }),
      ).id,
    ).toBe(original.id);
    expect(
      persisted(
        await company.importEntity(
          person(
            "Identity collision target",
            "identity-collision-target-replay",
            "identity-collision-target-replay-hash",
            collisionEmail,
          ),
        ),
      ).id,
    ).toBe(collisionTarget.id);
  });

  it("scopes name-only person rejection aliases to their source", async () => {
    const company = companyForActor(prisma, actor);
    const rejectedInput = person(
      `Rejected same-name ${suffix}`,
      "rejected-name-source",
      "rejected-name-original-hash",
    );
    const rejected = persisted(await company.importEntity(rejectedInput));
    await company.reject(rejected.id, "Synthetic name-only rejection");
    const otherSource = persisted(
      await company.importEntity({
        ...rejectedInput,
        evidence: evidence("other-name-source", "other-name-source-hash"),
      }),
    );
    expect(otherSource.id).not.toBe(rejected.id);

    await company.disconnect("slack", "rejected-name-source");
    expect(
      await company.importEntity({
        ...rejectedInput,
        evidence: {
          ...rejectedInput.evidence,
          quote: "A changed quotation for the same person.",
          contentHash: "rejected-name-after-disconnect-hash",
        },
      }),
    ).toMatchObject({ suppressed: true });
    const differentNameSameDocument = persisted(
      await company.importEntity({
        ...rejectedInput,
        entity: { ...rejectedInput.entity, displayName: `Different name ${suffix}` },
        evidence: {
          ...rejectedInput.evidence,
          quote: "A different person in the same document.",
          contentHash: "rejected-name-different-name-hash",
        },
      }),
    );
    expect(differentNameSameDocument.id).not.toBe(rejected.id);
    const sameNameDifferentDocument = persisted(
      await company.importEntity({
        ...rejectedInput,
        evidence: evidence("rejected-name-other-document", "rejected-name-other-document-hash"),
      }),
    );
    expect(sameNameDifferentDocument.id).not.toBe(rejected.id);
  });

  it("keeps same-document claims separate and namespaces identities by entity kind", async () => {
    const company = companyForActor(prisma, actor);
    const sharedEvidence = evidence("shared-document", "shared-document-hash");
    const first = await company.importEntity({
      entity: {
        kind: "person",
        displayName: "Alex Shared",
        attrs: { workEmails: ["alex.one@example.test"] },
        confidence: 0.9,
      },
      evidence: sharedEvidence,
    });
    const second = await company.importEntity({
      entity: {
        kind: "person",
        displayName: "Blair Shared",
        attrs: { workEmails: ["blair.two@example.test"] },
        confidence: 0.9,
      },
      evidence: sharedEvidence,
    });
    expect(entityId(first)).not.toBe(entityId(second));
    expect(
      entityId(
        await company.importEntity({
          entity: {
            kind: "person",
            displayName: "Blair Shared",
            attrs: { workEmails: ["blair.two@example.test"] },
            confidence: 0.9,
          },
          evidence: sharedEvidence,
        }),
      ),
    ).toBe(entityId(second));

    const nameOnlyOne = await company.importEntity({
      entity: { kind: "person", displayName: "Sam Shared", attrs: {}, confidence: 0.9 },
      evidence: { ...sharedEvidence, quote: "Sam joined the product team." },
    });
    const nameOnlyTwoInput = {
      entity: { kind: "person" as const, displayName: "Sam Shared", attrs: {}, confidence: 0.9 },
      evidence: { ...sharedEvidence, quote: "Sam led the customer rollout." },
    };
    const nameOnlyTwo = await company.importEntity(nameOnlyTwoInput);
    expect(entityId(nameOnlyOne)).not.toBe(entityId(nameOnlyTwo));
    expect(entityId(await company.importEntity(nameOnlyTwoInput))).toBe(entityId(nameOnlyTwo));

    const sameNameCompany = await company.importEntity({
      entity: {
        kind: "company",
        displayName: "Kind Collision",
        attrs: {},
        confidence: 0.9,
      },
      evidence: evidence("kind-company", "kind-company-hash"),
    });
    const sameNameProduct = await company.importEntity({
      entity: {
        kind: "product",
        displayName: "Kind Collision",
        attrs: {},
        confidence: 0.9,
      },
      evidence: evidence("kind-product", "kind-product-hash"),
    });
    expect(entityId(sameNameCompany)).not.toBe(entityId(sameNameProduct));

    const samOne = await company.importEntity(
      person("Sam Reed", "sam-one", "sam-one-hash", "sam.one@example.test"),
    );
    const samTwo = await company.importEntity(
      person("Sam Reed", "sam-two", "sam-two-hash", "sam.two@example.test"),
    );
    const samEdge = persisted(
      await company.importEdge({
        edge: {
          fromId: entityId(samOne),
          toId: entityId(samTwo),
          relation: "works_at",
          startsOn: null,
          endsOn: null,
          role: "Engineer",
          confidence: 0.9,
        },
        evidence: evidence("sam-edge", "sam-edge-hash"),
      }),
    );
    const samEvent = persisted(
      await company.importEvent({
        event: {
          stream: "people",
          kind: "hire",
          title: "Sam joined",
          occursOn: null,
          endsOn: null,
          entityIds: [entityId(samOne)],
          amountCents: null,
          currency: null,
          confidence: 0.9,
        },
        evidence: evidence("sam-event", "sam-event-hash"),
      }),
    );
    const samEdgeId = samEdge.id;
    const samEventId = samEvent.id;
    const visibleEntityCount = await company.count();
    const visibleEdgeCount = await company.countEdges();
    const visibleEventCount = await company.countEvents();
    const inclusiveEntityCount = await company.count({ includeRejected: true });
    const inclusiveEdgeCount = await company.countEdges({ includeRejected: true });
    const inclusiveEventCount = await company.countEvents({ includeRejected: true });
    await company.reject(entityId(samOne), "Wrong Sam");
    const remainingSam = await company.importEntity(
      person("Sam Reed", "sam-two-replay", "sam-two-replay-hash", "sam.two@example.test"),
    );
    expect("suppressed" in remainingSam).toBe(false);
    expect(entityId(remainingSam)).toBe(entityId(samTwo));
    expect(await company.detail(entityId(samOne))).toBeNull();
    const rejectedSam = await company.detail(entityId(samOne), { includeRejected: true });
    expect(rejectedSam).toMatchObject({
      status: "rejected",
    });
    expect(rejectedSam?.edges).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: samEdgeId })]),
    );
    expect(rejectedSam?.events).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: samEventId })]),
    );
    expect((await company.list()).some((record) => record.id === entityId(samOne))).toBe(false);
    expect(
      (await company.search("Sam Reed")).some((record) => record.id === entityId(samOne)),
    ).toBe(false);
    expect(
      (await company.list({ includeRejected: true })).some(
        (record) => record.id === entityId(samOne),
      ),
    ).toBe(true);
    expect(await company.count()).toBe(visibleEntityCount - 1);
    expect(await company.count({ includeRejected: true })).toBe(inclusiveEntityCount);
    expect(await company.edgeDetail(samEdgeId)).toBeNull();
    expect(await company.eventDetail(samEventId)).toBeNull();
    expect((await company.listEdges()).some((record) => record.id === samEdgeId)).toBe(false);
    expect((await company.listEvents()).some((record) => record.id === samEventId)).toBe(false);
    expect(await company.countEdges()).toBe(visibleEdgeCount - 1);
    expect(await company.countEdges({ includeRejected: true })).toBe(inclusiveEdgeCount);
    expect(await company.countEvents()).toBe(visibleEventCount - 1);
    expect(await company.countEvents({ includeRejected: true })).toBe(inclusiveEventCount);
  });

  it("replays all authored company entities twice with their actual source hashes", async () => {
    const fixtureActor = { ...actor, spaceId: fixtureSpaceId };
    const company = companyForActor(prisma, fixtureActor);
    const sourceItems = new Map(
      createNorthwindCompanyFixture().map((item) => [
        `${item.sourceKind}:${item.sourceItemId}`,
        item,
      ]),
    );
    const fixtureFacts = northwindGroundTruth.entities;
    const dataRoomSources = new Set(
      fixtureFacts.flatMap((fact) =>
        fact.sources
          .filter((source) => source.sourceKind === "data_room")
          .map((source) => source.sourceItemId),
      ),
    );
    await prisma.dataRoomItem.createMany({
      data: [...dataRoomSources].map((sourceItemId, index) => ({
        id: `fixture-${sourceItemId}`,
        spaceId: fixtureSpaceId,
        userId,
        source: "upload",
        sha256: `${index.toString(16).padStart(2, "0")}${"a".repeat(62)}`,
        name: `${sourceItemId}.txt`,
        mimeType: "text/plain",
        size: 1n,
      })),
    });
    const inputFor = (fact: (typeof fixtureFacts)[number]) => {
      const source = fact.sources[0]!;
      const item = sourceItems.get(`${source.sourceKind}:${source.sourceItemId}`)!;
      return {
        entity: fact.input,
        evidence: {
          stance: "supports" as const,
          sourceKind: source.sourceKind,
          sourceItemId: source.sourceItemId,
          ...(source.sourceKind === "data_room"
            ? { dataRoomItemId: `fixture-${source.sourceItemId}` }
            : {}),
          sourceUrl: item.sourceUrl,
          quote: fact.statement,
          contentHash: item.contentHash,
          extractedAt: item.updatedAt,
          extractorModel: null,
          confidence: fact.input.confidence,
        },
      };
    };
    const firstPass = await Promise.all(
      fixtureFacts.map((fact) => company.importEntity(inputFor(fact))),
    );
    const secondPass = await Promise.all(
      fixtureFacts.map((fact) => company.importEntity(inputFor(fact))),
    );
    expect(firstPass).toHaveLength(50);
    expect(secondPass).toHaveLength(50);
    expect(firstPass.map(entityId)).toEqual(secondPass.map(entityId));
    expect(await company.count()).toBe(50);
    expect(
      await prisma.companyEvidence.count({
        where: { spaceId: fixtureSpaceId, ownerUserId: userId, factKind: "entity" },
      }),
    ).toBe(50);
  });

  it("rejects direct facts without evidence and deletes a fact when its last evidence is removed", async () => {
    const id = `company-no-evidence-${suffix}`;
    await prisma.$transaction(async (tx) => {
      await tx.companyEntity.create({
        data: {
          id: `${id}-discarded`,
          spaceId,
          ownerUserId: userId,
          kind: "person",
          displayName: "Discarded before commit",
          normalizedName: "discarded before commit",
          attrs: {},
          confidence: 0.5,
        },
      });
      await tx.companyEntity.delete({ where: { id: `${id}-discarded` } });
    });
    await expect(
      prisma.$transaction((tx) =>
        tx.companyEntity.create({
          data: {
            id,
            spaceId,
            ownerUserId: userId,
            kind: "person",
            displayName: "No Evidence",
            normalizedName: "no evidence",
            attrs: {},
            confidence: 0.5,
          },
        }),
      ),
    ).rejects.toThrow(/evidence/i);

    const company = companyForActor(prisma, actor);
    const edgeFrom = await company.importEntity(
      person("No-evidence edge from", "no-evidence-edge-from", "no-evidence-edge-from-hash"),
    );
    const edgeTo = await company.importEntity(
      person("No-evidence edge to", "no-evidence-edge-to", "no-evidence-edge-to-hash"),
    );
    await expect(
      prisma.$transaction((tx) =>
        tx.companyEdge.create({
          data: {
            spaceId,
            ownerUserId: userId,
            fromId: entityId(edgeFrom),
            toId: entityId(edgeTo),
            relation: "works_at",
            confidence: 0.5,
          },
        }),
      ),
    ).rejects.toThrow(/evidence/i);
    await expect(
      prisma.$transaction((tx) =>
        tx.companyEvent.create({
          data: {
            spaceId,
            ownerUserId: userId,
            stream: "company",
            kind: "other",
            title: "No evidence event",
            normalizedTitle: "no evidence event",
            subjectKey: "source:test-no-evidence",
            occursOn: null,
            occursPrecision: null,
            endsOn: null,
            endsPrecision: null,
            amountCents: null,
            currency: null,
            confidence: 0.5,
          },
        }),
      ),
    ).rejects.toThrow(/evidence/i);

    const saved = await companyForActor(prisma, actor).importEntity(
      person("Orphan", "orphan-item", "orphan-hash"),
    );
    const retained = await company.importEntity(
      person("Retained fact", "retained-item", "retained-hash"),
    );
    const evidenceRow = await prisma.companyEvidence.findFirstOrThrow({
      where: { spaceId, ownerUserId: userId, factId: entityId(saved), factKind: "entity" },
    });
    await expect(
      prisma.companyEvidence.update({
        where: { id: evidenceRow.id },
        data: { factId: entityId(retained) },
      }),
    ).rejects.toThrow(/immutable/i);
    await prisma.companyEvidence.deleteMany({
      where: { factId: entityId(saved), factKind: "entity" },
    });
    expect(
      await prisma.companyEntity.findFirst({
        where: { id: entityId(saved), spaceId, ownerUserId: userId },
      }),
    ).toBeNull();
    const parentDelete = await company.importEntity(
      person("Parent delete", "parent-delete-item", "parent-delete-hash"),
    );
    await prisma.companyEntity.delete({ where: { id: entityId(parentDelete) } });
    expect(
      await prisma.companyEvidence.count({
        where: {
          factId: entityId(parentDelete),
          factKind: "entity",
          spaceId,
          ownerUserId: userId,
        },
      }),
    ).toBe(0);
  });

  it("serializes concurrent evidence deletion so no orphan fact survives", async () => {
    const company = companyForActor(prisma, actor);
    const first = await company.importEntity(
      person(
        "Concurrent deletion",
        "concurrent-evidence-one",
        "concurrent-hash-one",
        "concurrent@example.test",
      ),
    );
    const entity = await company.importEntity(
      person(
        "Concurrent deletion",
        "concurrent-evidence-two",
        "concurrent-hash-two",
        "concurrent@example.test",
      ),
    );
    expect(entityId(entity)).toBe(entityId(first));
    const evidenceRows = await prisma.companyEvidence.findMany({
      where: { spaceId, ownerUserId: userId, factKind: "entity", factId: entityId(first) },
      select: { id: true },
    });
    expect(evidenceRows).toHaveLength(2);
    await Promise.all(
      evidenceRows.map(({ id }) =>
        prisma.$transaction((tx) => tx.companyEvidence.delete({ where: { id } })),
      ),
    );
    expect(
      await prisma.companyEntity.findFirst({
        where: { id: entityId(first), spaceId, ownerUserId: userId },
      }),
    ).toBeNull();
  });

  it("isolates external links and disconnects source evidence without blocking native deletes", async () => {
    const company = companyForActor(prisma, actor);
    const foreignContact = await prisma.contact.create({
      data: {
        id: `foreign-contact-${suffix}`,
        spaceId,
        userId: otherUserId,
        name: "Foreign contact",
      },
    });
    const foreignRoomItem = await prisma.dataRoomItem.create({
      data: {
        id: `foreign-room-${suffix}`,
        spaceId,
        userId: otherUserId,
        source: "upload",
        sha256: "f".repeat(64),
        name: "foreign.txt",
        mimeType: "text/plain",
        size: 1n,
      },
    });
    const foreignConnection = await prisma.connection.create({
      data: {
        id: `foreign-connection-${suffix}`,
        spaceId,
        userId: otherUserId,
        provider: "google",
        displayName: "Foreign connection",
        status: "connected",
      },
    });
    const foreignMcp = await prisma.mcpServer.create({
      data: {
        id: `foreign-mcp-${suffix}`,
        spaceId,
        userId: otherUserId,
        slug: `foreign-${suffix}`,
        name: "Foreign MCP",
        transport: "stdio",
      },
    });

    await expect(
      company.importEntity({
        entity: {
          kind: "product",
          displayName: "Foreign contact link",
          attrs: {},
          contactId: foreignContact.id,
          confidence: 0.9,
        },
        evidence: evidence("foreign-contact-link", "foreign-contact-hash"),
      }),
    ).rejects.toThrow();
    await expect(
      company.importEntity({
        entity: {
          kind: "person",
          displayName: "Foreign room link",
          attrs: {},
          confidence: 0.9,
        },
        evidence: {
          ...evidence(foreignRoomItem.id, "foreign-room-hash"),
          sourceKind: "data_room",
          dataRoomItemId: foreignRoomItem.id,
        },
      }),
    ).rejects.toBeInstanceOf(IsolationError);
    await expect(
      company.importEntity({
        entity: {
          kind: "person",
          displayName: "Foreign connection link",
          attrs: {},
          confidence: 0.9,
        },
        evidence: {
          ...evidence("foreign-connection-link", "foreign-connection-hash"),
          sourceKind: "gmail",
          connectionId: foreignConnection.id,
        },
      }),
    ).rejects.toThrow();
    await expect(
      company.importEntity({
        entity: {
          kind: "person",
          displayName: "Foreign MCP link",
          attrs: {},
          confidence: 0.9,
        },
        evidence: {
          ...evidence("foreign-mcp-link", "foreign-mcp-hash"),
          sourceKind: "mcp",
          mcpServerId: foreignMcp.id,
        },
      }),
    ).rejects.toThrow();
    await expect(
      candidate("gmail", "foreign-connection-candidate", {
        connectionId: foreignConnection.id,
      }),
    ).rejects.toThrow();
    await expect(
      candidate("mcp", "foreign-mcp-candidate", { mcpServerId: foreignMcp.id }),
    ).rejects.toThrow();
    await expect(
      candidate("data_room", foreignRoomItem.id, { dataRoomItemId: foreignRoomItem.id }),
    ).rejects.toThrow();

    const [connectionOne, connectionTwo] = await Promise.all([
      prisma.connection.create({
        data: {
          id: `connection-one-${suffix}`,
          spaceId,
          userId,
          provider: "google",
          displayName: "Connection one",
          status: "connected",
        },
      }),
      prisma.connection.create({
        data: {
          id: `connection-two-${suffix}`,
          spaceId,
          userId,
          provider: "google",
          displayName: "Connection two",
          status: "connected",
        },
      }),
    ]);
    const connectionOneFact = await company.importEntity({
      entity: {
        kind: "person",
        displayName: "Shared connection person",
        attrs: { workEmails: ["shared-connection@example.test"] },
        confidence: 0.9,
      },
      evidence: {
        ...evidence("shared-message-id", "shared-connection-hash"),
        sourceKind: "gmail",
        connectionId: connectionOne.id,
      },
    });
    const connectionTwoFact = await company.importEntity({
      entity: {
        kind: "person",
        displayName: "Shared connection person",
        attrs: { workEmails: ["shared-connection@example.test"] },
        confidence: 0.9,
      },
      evidence: {
        ...evidence("shared-message-id", "shared-connection-hash"),
        sourceKind: "gmail",
        connectionId: connectionTwo.id,
      },
    });
    expect(entityId(connectionOneFact)).toBe(entityId(connectionTwoFact));
    expect(await company.evidence(entityId(connectionOneFact))).toHaveLength(2);
    await candidate("gmail", "shared-message-id", { connectionId: connectionOne.id });
    await company.disconnect("gmail", "shared-message-id", { connectionId: connectionOne.id });
    expect(await company.detail(entityId(connectionOneFact))).not.toBeNull();
    expect(await company.evidence(entityId(connectionOneFact))).toMatchObject([
      expect.objectContaining({ connectionId: connectionTwo.id }),
    ]);
    expect(
      await prisma.companyCandidate.count({
        where: { spaceId, ownerUserId: userId, connectionId: connectionOne.id },
      }),
    ).toBe(0);

    const connectionDeleteFact = await company.importEntity({
      entity: {
        kind: "person",
        displayName: "Native connection delete",
        attrs: {},
        confidence: 0.9,
      },
      evidence: {
        ...evidence("native-connection-delete", "native-connection-hash"),
        sourceKind: "gmail",
        connectionId: connectionOne.id,
      },
    });
    await candidate("gmail", "native-connection-delete", { connectionId: connectionOne.id });
    await prisma.connection.delete({ where: { id: connectionOne.id } });
    expect(await company.detail(entityId(connectionDeleteFact))).toBeNull();
    expect(
      await prisma.companyCandidate.count({
        where: { spaceId, ownerUserId: userId, connectionId: connectionOne.id },
      }),
    ).toBe(0);

    const mcpServer = await prisma.mcpServer.create({
      data: {
        id: `mcp-server-${suffix}`,
        spaceId,
        userId,
        slug: `mcp-${suffix}`,
        name: "Scoped MCP",
        transport: "stdio",
      },
    });
    const mcpFact = await company.importEntity({
      entity: { kind: "person", displayName: "Native MCP delete", attrs: {}, confidence: 0.9 },
      evidence: {
        ...evidence("native-mcp-delete", "native-mcp-hash"),
        sourceKind: "mcp",
        mcpServerId: mcpServer.id,
      },
    });
    await candidate("mcp", "native-mcp-delete", { mcpServerId: mcpServer.id });
    await prisma.mcpServer.delete({ where: { id: mcpServer.id } });
    expect(await company.detail(entityId(mcpFact))).toBeNull();
    expect(
      await prisma.companyCandidate.count({
        where: { spaceId, ownerUserId: userId, mcpServerId: mcpServer.id },
      }),
    ).toBe(0);

    const disconnectedRoomItem = await prisma.dataRoomItem.create({
      data: {
        id: `disconnected-room-item-${suffix}`,
        spaceId,
        userId,
        source: "upload",
        sha256: "b".repeat(64),
        name: "disconnected-room.txt",
        mimeType: "text/plain",
        size: 1n,
      },
    });
    const disconnectedRoomFact = await company.importEntity({
      entity: {
        kind: "person",
        displayName: "Disconnected room source",
        attrs: {},
        confidence: 0.9,
      },
      evidence: {
        ...evidence(disconnectedRoomItem.id, "disconnected-room-hash"),
        sourceKind: "data_room",
        dataRoomItemId: disconnectedRoomItem.id,
      },
    });
    await candidate("data_room", disconnectedRoomItem.id, {
      dataRoomItemId: disconnectedRoomItem.id,
    });
    await company.disconnect("data_room", disconnectedRoomItem.id, {
      dataRoomItemId: disconnectedRoomItem.id,
    });
    expect(await company.detail(entityId(disconnectedRoomFact))).toBeNull();
    expect(
      await prisma.companyCandidate.count({
        where: { spaceId, ownerUserId: userId, dataRoomItemId: disconnectedRoomItem.id },
      }),
    ).toBe(0);

    const roomItem = await prisma.dataRoomItem.create({
      data: {
        id: `room-item-${suffix}`,
        spaceId,
        userId,
        source: "upload",
        sha256: "a".repeat(64),
        name: "room.txt",
        mimeType: "text/plain",
        size: 1n,
      },
    });
    const roomFact = await company.importEntity({
      entity: { kind: "person", displayName: "Native room delete", attrs: {}, confidence: 0.9 },
      evidence: {
        ...evidence(roomItem.id, "native-room-hash"),
        sourceKind: "data_room",
        dataRoomItemId: roomItem.id,
      },
    });
    await candidate("data_room", roomItem.id, { dataRoomItemId: roomItem.id });
    await prisma.dataRoomItem.delete({ where: { id: roomItem.id } });
    expect(await company.detail(entityId(roomFact))).toBeNull();
    expect(
      await prisma.companyCandidate.count({
        where: { spaceId, ownerUserId: userId, dataRoomItemId: roomItem.id },
      }),
    ).toBe(0);

    const contact = await prisma.contact.create({
      data: { id: `company-contact-${suffix}`, spaceId, userId, name: "Company contact" },
    });
    const contactFact = await company.importEntity({
      entity: {
        kind: "product",
        displayName: "Contact link",
        attrs: {},
        contactId: contact.id,
        confidence: 0.9,
      },
      evidence: evidence("contact-delete", "contact-delete-hash"),
    });
    await prisma.contact.delete({ where: { id: contact.id } });
    expect((await company.detail(entityId(contactFact)))?.contactId).toBeNull();
  });

  it("persists editable facts, locks empty event links, and suppresses rejected replays", async () => {
    const company = companyForActor(prisma, actor);
    const from = await company.importEntity(
      person("Lifecycle source", "lifecycle-from", "lifecycle-from-hash"),
    );
    const to = await company.importEntity(
      person("Lifecycle target", "lifecycle-to", "lifecycle-to-hash"),
    );
    const baselineEdges = await company.countEdges();
    const baselineEvents = await company.countEvents();
    const edgeInput = {
      edge: {
        fromId: entityId(from),
        toId: entityId(to),
        relation: "works_at" as const,
        startsOn: { date: "2021-01-01", precision: "year" as const },
        endsOn: null,
        role: "Engineer",
        confidence: 0.8,
      },
      evidence: evidence("lifecycle-edge", "lifecycle-edge-hash"),
    };
    const edge = persisted(await company.importEdge(edgeInput));
    expect(edge).toMatchObject({
      id: expect.any(String),
      startsOn: { date: "2021-01-01", precision: "year" },
      evidence: [expect.objectContaining({ contentHash: "lifecycle-edge-hash" })],
    });
    await company.editEdge({ edgeId: edge.id, role: "Owner corrected" });
    const edgeReplay = persisted(
      await company.importEdge({
        ...edgeInput,
        edge: { ...edgeInput.edge, confidence: 0.65 },
        evidence: evidence("lifecycle-edge-replay", "lifecycle-edge-replay-hash"),
      }),
    );
    expect(edgeReplay).toMatchObject({
      id: edge.id,
      role: "Owner corrected",
      confidence: 0.65,
    });
    expect(edgeReplay.evidence.some((item) => item.stance === "contradicts")).toBe(true);
    await company.editEdge({ edgeId: edge.id, confidence: 0.9 });
    const lockedConfidenceReplay = persisted(
      await company.importEdge({
        ...edgeInput,
        edge: { ...edgeInput.edge, confidence: 0.6 },
        evidence: evidence("lifecycle-edge-locked-replay", "lifecycle-edge-locked-hash"),
      }),
    );
    expect(lockedConfidenceReplay).toMatchObject({ id: edge.id, confidence: 0.9 });
    expect(lockedConfidenceReplay.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          contentHash: "lifecycle-edge-locked-hash",
          stance: "contradicts",
        }),
      ]),
    );
    await company.confirmEdge(edge.id);
    expect(await company.edgeDetail(edge.id)).toMatchObject({
      status: "confirmed",
      confirmedByUserId: userId,
      confirmedAt: expect.any(String),
      lockedFields: expect.arrayContaining(["role"]),
    });
    await company.rejectEdge(edge.id, "Incorrect employment");
    expect(await company.edgeDetail(edge.id)).toBeNull();
    expect(await company.edgeDetail(edge.id, { includeRejected: true })).toMatchObject({
      status: "rejected",
    });
    expect(await company.importEdge(edgeInput)).toMatchObject({ suppressed: true });
    expect(await company.countEdges()).toBe(baselineEdges);

    const eventInput = {
      event: {
        stream: "people" as const,
        kind: "hire" as const,
        title: "Joined the team",
        occursOn: { date: "2020-01-01", precision: "year" as const },
        endsOn: { date: "2021-01-01", precision: "year" as const },
        entityIds: [entityId(from)],
        amountCents: 10_000,
        currency: "USD",
        confidence: 0.75,
      },
      evidence: evidence("lifecycle-event", "lifecycle-event-hash"),
    };
    const event = persisted(await company.importEvent(eventInput));
    expect(event).toMatchObject({
      id: expect.any(String),
      entityIds: [entityId(from)],
      occursOn: { date: "2020-01-01", precision: "year" },
      endsOn: { date: "2021-01-01", precision: "year" },
    });
    expect(await company.eventDetail(event.id)).toMatchObject({
      id: event.id,
      entityIds: [entityId(from)],
    });
    await company.editEvent({
      eventId: event.id,
      title: "Owner corrected event",
      entityIds: [],
    });
    await company.editEvent({
      eventId: event.id,
      amountCents: 25_000,
      currency: "GBP",
    });
    const lockedLinkReplay = persisted(
      await company.importEvent({
        ...eventInput,
        event: {
          ...eventInput.event,
          endsOn: { date: "2022-01-01", precision: "year" },
          amountCents: 20_000,
          currency: "EUR",
          confidence: 0.7,
        },
        evidence: evidence("lifecycle-event-linked-replay", "lifecycle-event-linked-hash"),
      }),
    );
    expect(lockedLinkReplay).toMatchObject({
      id: event.id,
      title: "Owner corrected event",
      entityIds: [],
      endsOn: { date: "2022-01-01", precision: "year" },
      amountCents: 25_000,
      currency: "GBP",
      confidence: 0.7,
    });
    expect(lockedLinkReplay.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          contentHash: "lifecycle-event-linked-hash",
          stance: "contradicts",
        }),
      ]),
    );
    const lockedAmountReplay = persisted(
      await company.importEvent({
        ...eventInput,
        event: {
          ...eventInput.event,
          amountCents: 30_000,
          currency: "CAD",
        },
        evidence: evidence("lifecycle-event-amount-replay", "lifecycle-event-amount-hash"),
      }),
    );
    expect(lockedAmountReplay).toMatchObject({
      id: event.id,
      amountCents: 25_000,
      currency: "GBP",
    });
    expect(lockedAmountReplay.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          contentHash: "lifecycle-event-amount-hash",
          stance: "contradicts",
        }),
      ]),
    );

    const linkUnionInput = {
      event: {
        ...eventInput.event,
        title: "Subject-specific event",
        entityIds: [entityId(from)],
      },
      evidence: evidence("lifecycle-link-union-first", "lifecycle-link-union-first-hash"),
    };
    const linkUnion = persisted(await company.importEvent(linkUnionInput));
    const clearedEventAmounts = persisted(
      await company.importEvent({
        ...linkUnionInput,
        event: {
          ...linkUnionInput.event,
          endsOn: null,
          amountCents: null,
          currency: null,
          confidence: 0.6,
        },
        evidence: evidence("lifecycle-event-cleared-scalars", "lifecycle-event-cleared-hash"),
      }),
    );
    expect(clearedEventAmounts).toMatchObject({
      id: linkUnion.id,
      endsOn: null,
      amountCents: null,
      currency: null,
      confidence: 0.6,
    });
    const linkReplay = persisted(
      await company.importEvent({
        ...linkUnionInput,
        event: { ...linkUnionInput.event, entityIds: [entityId(to)] },
        evidence: evidence("lifecycle-link-union-second", "lifecycle-link-union-second-hash"),
      }),
    );
    expect(linkReplay.id).not.toBe(linkUnion.id);
    expect(linkReplay.entityIds).toEqual([entityId(to)]);
    await company.disconnect("slack", "lifecycle-event");
    await company.disconnect("slack", "lifecycle-event-linked-replay");
    await company.rejectEvent(event.id, "Incorrect event");
    expect(await company.eventDetail(event.id)).toBeNull();
    expect(await company.eventDetail(event.id, { includeRejected: true })).toMatchObject({
      status: "rejected",
      confirmedByUserId: null,
    });
    await company.disconnect("slack", "lifecycle-event-amount-replay");
    expect(
      await company.importEvent({
        ...eventInput,
        evidence: {
          ...eventInput.evidence,
          contentHash: "lifecycle-event-after-disconnect-rejection-hash",
        },
      }),
    ).toMatchObject({ suppressed: true });
    expect(await company.countEvents()).toBe(baselineEvents + 2);
  });

  it("keeps edge and event claim aliases through edits, disconnects, and rejection", async () => {
    const company = companyForActor(prisma, actor);
    const from = await company.importEntity(
      person("Alias replay source", "claim-alias-from", "claim-alias-from-hash"),
    );
    const to = await company.importEntity(
      person("Alias replay target", "claim-alias-to", "claim-alias-to-hash"),
    );
    const edgeInput = {
      edge: {
        fromId: entityId(from),
        toId: entityId(to),
        relation: "works_at" as const,
        startsOn: { date: "2022-01-01", precision: "year" as const },
        endsOn: null,
        role: "Engineer",
        confidence: 0.8,
      },
      evidence: evidence("claim-alias-edge-original", "claim-alias-edge-original-hash"),
    };
    const edge = persisted(await company.importEdge(edgeInput));
    await company.editEdge({ edgeId: edge.id, role: "Owner corrected" });
    const edgeReplay = persisted(
      await company.importEdge({
        ...edgeInput,
        evidence: evidence("claim-alias-edge-replay", "claim-alias-edge-replay-hash"),
      }),
    );
    expect(edgeReplay).toMatchObject({ id: edge.id, role: "Owner corrected" });
    expect(edgeReplay.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          contentHash: "claim-alias-edge-replay-hash",
          stance: "contradicts",
        }),
      ]),
    );
    await company.disconnect("slack", "claim-alias-edge-original");
    await company.disconnect("slack", "claim-alias-edge-replay");
    const edgeAfterDisconnect = persisted(
      await company.importEdge({
        ...edgeInput,
        evidence: evidence("claim-alias-edge-after-disconnect", "claim-alias-edge-disconnect-hash"),
      }),
    );
    expect(edgeAfterDisconnect).toMatchObject({ id: edge.id, role: "Owner corrected" });
    await company.rejectEdge(edge.id, "Incorrect edge");
    await company.disconnect("slack", "claim-alias-edge-after-disconnect");
    expect(
      await company.importEdge({
        ...edgeInput,
        evidence: evidence("claim-alias-edge-after-rejection", "claim-alias-edge-rejected-hash"),
      }),
    ).toMatchObject({ suppressed: true });

    const eventInput = {
      event: {
        stream: "people" as const,
        kind: "hire" as const,
        title: "Alias original event",
        occursOn: { date: "2022-01-01", precision: "year" as const },
        endsOn: null,
        entityIds: [entityId(from)],
        amountCents: null,
        currency: null,
        confidence: 0.8,
      },
      evidence: evidence("claim-alias-event-original", "claim-alias-event-original-hash"),
    };
    const event = persisted(await company.importEvent(eventInput));
    await company.editEvent({ eventId: event.id, title: "Alias corrected event" });
    const eventReplay = persisted(
      await company.importEvent({
        ...eventInput,
        evidence: evidence("claim-alias-event-replay", "claim-alias-event-replay-hash"),
      }),
    );
    expect(eventReplay).toMatchObject({ id: event.id, title: "Alias corrected event" });
    expect(eventReplay.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          contentHash: "claim-alias-event-replay-hash",
          stance: "contradicts",
        }),
      ]),
    );
    await company.disconnect("slack", "claim-alias-event-original");
    await company.disconnect("slack", "claim-alias-event-replay");
    const eventAfterDisconnect = persisted(
      await company.importEvent({
        ...eventInput,
        evidence: evidence(
          "claim-alias-event-after-disconnect",
          "claim-alias-event-disconnect-hash",
        ),
      }),
    );
    expect(eventAfterDisconnect).toMatchObject({ id: event.id, title: "Alias corrected event" });
    await company.rejectEvent(event.id, "Incorrect event");
    await company.disconnect("slack", "claim-alias-event-after-disconnect");
    expect(
      await company.importEvent({
        ...eventInput,
        evidence: evidence("claim-alias-event-after-rejection", "claim-alias-event-rejected-hash"),
      }),
    ).toMatchObject({ suppressed: true });
  });

  it("uses canonical subjects to isolate and corroborate event identities", async () => {
    const company = companyForActor(prisma, actor);
    const firstPerson = await company.importEntity(
      person(
        `Subject A ${suffix}`,
        "subject-person-a",
        "subject-person-a-hash",
        `subject-a-${suffix}@example.test`,
      ),
    );
    const secondPerson = await company.importEntity(
      person(
        `Subject B ${suffix}`,
        "subject-person-b",
        "subject-person-b-hash",
        `subject-b-${suffix}@example.test`,
      ),
    );
    const thirdPerson = await company.importEntity(
      person(
        `Subject C ${suffix}`,
        "subject-person-c",
        "subject-person-c-hash",
        `subject-c-${suffix}@example.test`,
      ),
    );
    const otherOwnerEntity = await companyForActor(prisma, otherActor).importEntity(
      person(`Other owner subject ${suffix}`, "other-owner-subject", "other-owner-subject-hash"),
    );
    await expect(
      company.importEvent({
        event: {
          stream: "people",
          kind: "hire",
          title: `Out of scope subject ${suffix}`,
          occursOn: { date: "2021-01-01", precision: "year" },
          endsOn: null,
          entityIds: [entityId(otherOwnerEntity)],
          amountCents: null,
          currency: null,
          confidence: 0.8,
        },
        evidence: evidence("out-of-scope-subject", "out-of-scope-subject-hash"),
      }),
    ).rejects.toThrow(/scoped company entities/i);
    const personAEventInput = {
      event: {
        stream: "people" as const,
        kind: "hire" as const,
        title: `Person-specific event ${suffix}`,
        occursOn: { date: "2021-01-01", precision: "year" as const },
        endsOn: null,
        entityIds: [entityId(firstPerson)],
        amountCents: null,
        currency: null,
        confidence: 0.8,
      },
      evidence: evidence("subject-event-person-a", "subject-event-person-a-hash"),
    };
    const personAEvent = persisted(await company.importEvent(personAEventInput));
    const personBEvent = persisted(
      await company.importEvent({
        ...personAEventInput,
        event: { ...personAEventInput.event, entityIds: [entityId(secondPerson)] },
        evidence: evidence("subject-event-person-b", "subject-event-person-b-hash"),
      }),
    );
    expect(personBEvent.id).not.toBe(personAEvent.id);
    await company.rejectEvent(personAEvent.id, "Different person");
    expect(
      await company.importEvent({
        ...personAEventInput,
        event: { ...personAEventInput.event, entityIds: [entityId(secondPerson)] },
        evidence: evidence("subject-event-person-b-replay", "subject-event-person-b-replay-hash"),
      }),
    ).toMatchObject({ id: personBEvent.id });

    const sharedEventInput = {
      event: {
        stream: "people" as const,
        kind: "hire" as const,
        title: `Same date and title ${suffix}`,
        occursOn: { date: "2021-01-01", precision: "year" as const },
        endsOn: null,
        entityIds: [entityId(firstPerson), entityId(secondPerson), entityId(firstPerson)],
        amountCents: null,
        currency: null,
        confidence: 0.8,
      },
      evidence: evidence("subject-event-first-source", "subject-event-first-hash"),
    };
    const firstEvent = persisted(await company.importEvent(sharedEventInput));
    const corroboratingEvent = persisted(
      await company.importEvent({
        ...sharedEventInput,
        event: {
          ...sharedEventInput.event,
          entityIds: [entityId(secondPerson), entityId(firstPerson)],
        },
        evidence: evidence("subject-event-second-source", "subject-event-second-hash"),
      }),
    );
    expect(corroboratingEvent.id).toBe(firstEvent.id);
    expect(corroboratingEvent.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ contentHash: "subject-event-second-hash" }),
      ]),
    );

    const thirdPersonEvent = persisted(
      await company.importEvent({
        ...sharedEventInput,
        event: { ...sharedEventInput.event, entityIds: [entityId(thirdPerson)] },
        evidence: evidence("subject-event-third-source", "subject-event-third-hash"),
      }),
    );
    expect(thirdPersonEvent.id).not.toBe(firstEvent.id);
    await company.rejectEvent(firstEvent.id, "Different subject set");
    const thirdPersonReplay = await company.importEvent({
      ...sharedEventInput,
      event: { ...sharedEventInput.event, entityIds: [entityId(thirdPerson)] },
      evidence: evidence("subject-event-third-replay", "subject-event-third-replay-hash"),
    });
    expect(thirdPersonReplay).toMatchObject({ id: thirdPersonEvent.id });

    const changedSubjectEventInput = {
      event: {
        ...sharedEventInput.event,
        title: `Owner changed subjects ${suffix}`,
        entityIds: [entityId(firstPerson)],
      },
      evidence: evidence("owner-changed-subject-source", "owner-changed-subject-hash"),
    };
    const changedSubjectEvent = persisted(await company.importEvent(changedSubjectEventInput));
    await company.editEvent({
      eventId: changedSubjectEvent.id,
      entityIds: [entityId(secondPerson)],
    });
    const oldSubjectReplay = persisted(
      await company.importEvent({
        ...changedSubjectEventInput,
        evidence: {
          ...changedSubjectEventInput.evidence,
          contentHash: "owner-changed-subject-replay-hash",
        },
      }),
    );
    expect(oldSubjectReplay).toMatchObject({
      id: changedSubjectEvent.id,
      entityIds: [entityId(secondPerson)],
    });
    expect(oldSubjectReplay.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          contentHash: "owner-changed-subject-replay-hash",
          stance: "contradicts",
        }),
      ]),
    );
    expect(
      await prisma.companyEvent.findUniqueOrThrow({ where: { id: changedSubjectEvent.id } }),
    ).toMatchObject({
      subjectKey: `entities:${JSON.stringify([entityId(secondPerson)])}`,
    });
    const independentOldSubject = persisted(
      await company.importEvent({
        ...changedSubjectEventInput,
        evidence: evidence(
          "owner-changed-subject-independent-a",
          "owner-changed-subject-independent-a-hash",
        ),
      }),
    );
    expect(independentOldSubject.id).not.toBe(changedSubjectEvent.id);
    await company.disconnect("slack", "owner-changed-subject-source");
    const replayAfterDisconnect = persisted(
      await company.importEvent({
        ...changedSubjectEventInput,
        evidence: {
          ...changedSubjectEventInput.evidence,
          contentHash: "owner-changed-subject-after-disconnect-hash",
        },
      }),
    );
    expect(replayAfterDisconnect).toMatchObject({
      id: changedSubjectEvent.id,
      entityIds: [entityId(secondPerson)],
    });
    await company.rejectEvent(changedSubjectEvent.id, "Corrected subject B");
    expect(
      await company.importEvent({
        ...changedSubjectEventInput,
        evidence: {
          ...changedSubjectEventInput.evidence,
          contentHash: "owner-changed-subject-after-rejection-hash",
        },
      }),
    ).toMatchObject({ suppressed: true });
    expect(
      await company.importEvent({
        ...changedSubjectEventInput,
        event: { ...changedSubjectEventInput.event, entityIds: [entityId(secondPerson)] },
        evidence: evidence("owner-changed-subject-fresh-b", "owner-changed-subject-fresh-b-hash"),
      }),
    ).toMatchObject({ suppressed: true });
    const newIndependentOldSubject = persisted(
      await company.importEvent({
        ...changedSubjectEventInput,
        evidence: evidence("owner-changed-subject-fresh-a", "owner-changed-subject-fresh-a-hash"),
      }),
    );
    expect(newIndependentOldSubject.id).not.toBe(changedSubjectEvent.id);

    const unknownInput = {
      event: {
        ...sharedEventInput.event,
        title: `Unknown subject event ${suffix}`,
        entityIds: [],
      },
      evidence: evidence("unknown-subject-source-one", "unknown-subject-hash-one"),
    };
    const unknownFirst = persisted(await company.importEvent(unknownInput));
    await expect(
      company.editEvent({
        eventId: unknownFirst.id,
        entityIds: [entityId(otherOwnerEntity)],
      }),
    ).rejects.toThrow(/scoped company entities/i);
    await company.editEvent({
      eventId: unknownFirst.id,
      title: `Owner corrected unknown subject ${suffix}`,
      entityIds: [entityId(firstPerson)],
    });
    const unknownReplay = persisted(
      await company.importEvent({
        ...unknownInput,
        evidence: {
          ...unknownInput.evidence,
          contentHash: "unknown-subject-hash-changed",
        },
      }),
    );
    expect(unknownReplay).toMatchObject({
      id: unknownFirst.id,
      title: `Owner corrected unknown subject ${suffix}`,
      entityIds: [entityId(firstPerson)],
    });
    expect(
      await prisma.companyEvent.findUniqueOrThrow({ where: { id: unknownFirst.id } }),
    ).toMatchObject({
      subjectKey: `entities:${JSON.stringify([entityId(firstPerson)])}`,
    });
    const unknownOtherSource = persisted(
      await company.importEvent({
        ...unknownInput,
        evidence: evidence("unknown-subject-source-two", "unknown-subject-hash-two"),
      }),
    );
    expect(unknownOtherSource.id).not.toBe(unknownFirst.id);
    await company.rejectEvent(unknownFirst.id, "Unknown subject was corrected");
    const rejectedKnownSubject = await company.importEvent({
      event: {
        ...unknownInput.event,
        title: `Owner corrected unknown subject ${suffix}`,
        entityIds: [entityId(firstPerson)],
      },
      evidence: evidence("unknown-subject-fresh-known-a", "unknown-subject-fresh-known-a-hash"),
    });
    expect(rejectedKnownSubject).toMatchObject({ suppressed: true });
    expect(
      await company.importEvent({
        ...unknownInput,
        evidence: {
          ...unknownInput.evidence,
          contentHash: "unknown-subject-original-source-after-rejection",
        },
      }),
    ).toMatchObject({ suppressed: true });
    const distinctKnownSubject = persisted(
      await company.importEvent({
        event: {
          ...unknownInput.event,
          title: `Owner corrected unknown subject ${suffix}`,
          entityIds: [entityId(secondPerson)],
        },
        evidence: evidence("unknown-subject-fresh-known-b", "unknown-subject-fresh-known-b-hash"),
      }),
    );
    expect(distinctKnownSubject.id).not.toBe(unknownFirst.id);

    const mergeRoot = await company.importEntity(
      person(
        `Subject merge root ${suffix}`,
        "subject-merge-root",
        "subject-merge-root-hash",
        `subject-merge-root-${suffix}@example.test`,
      ),
    );
    const mergeChild = await company.importEntity(
      person(
        `Subject merge child ${suffix}`,
        "subject-merge-child",
        "subject-merge-child-hash",
        `subject-merge-child-${suffix}@example.test`,
      ),
    );
    const childEventInput = {
      event: {
        ...sharedEventInput.event,
        title: `Canonicalized subject ${suffix}`,
        entityIds: [entityId(mergeChild)],
      },
      evidence: evidence("canonical-subject-child-source", "canonical-subject-child-hash"),
    };
    const childEvent = persisted(await company.importEvent(childEventInput));
    await company.merge(entityId(mergeChild), entityId(mergeRoot));
    const rootSubjectReplay = persisted(
      await company.importEvent({
        ...childEventInput,
        event: { ...childEventInput.event, entityIds: [entityId(mergeRoot)] },
        evidence: evidence("canonical-subject-root-source", "canonical-subject-root-hash"),
      }),
    );
    expect(rootSubjectReplay.id).toBe(childEvent.id);
    expect(
      await prisma.companyEventEntity.findMany({
        where: { spaceId, ownerUserId: userId, eventId: childEvent.id },
        select: { entityId: true },
      }),
    ).toEqual(
      expect.arrayContaining([
        { entityId: entityId(mergeChild) },
        { entityId: entityId(mergeRoot) },
      ]),
    );

    const secondMergeChild = await company.importEntity(
      person(
        `Second subject merge child ${suffix}`,
        "subject-merge-child-second",
        "subject-merge-child-second-hash",
        `subject-merge-child-second-${suffix}@example.test`,
      ),
    );
    const secondChildEventInput = {
      event: {
        ...childEventInput.event,
        entityIds: [entityId(secondMergeChild)],
      },
      evidence: evidence(
        "canonical-subject-child-second-source",
        "canonical-subject-child-second-hash",
      ),
    };
    const secondChildEvent = persisted(await company.importEvent(secondChildEventInput));
    expect(secondChildEvent.id).not.toBe(childEvent.id);
    await company.merge(entityId(secondMergeChild), entityId(mergeRoot));
    const ambiguousMergeInput = {
      ...secondChildEventInput,
      event: { ...secondChildEventInput.event, entityIds: [entityId(mergeRoot)] },
      evidence: evidence("canonical-subject-new-source", "canonical-subject-new-hash"),
    };
    const eventsBeforeDeferral = await prisma.companyEvent.count({
      where: { spaceId, ownerUserId: userId },
    });
    const eventEvidenceBeforeDeferral = await prisma.companyEvidence.count({
      where: { spaceId, ownerUserId: userId, factKind: "event" },
    });
    const deferred = await company.importEvent(ambiguousMergeInput);
    if (!("deferred" in deferred)) throw new Error("Expected an ambiguous event candidate");
    expect(deferred).toMatchObject({
      deferred: true,
      record: null,
      candidateId: expect.any(String),
    });
    expect(await prisma.companyEvent.count({ where: { spaceId, ownerUserId: userId } })).toBe(
      eventsBeforeDeferral,
    );
    expect(
      await prisma.companyEvidence.count({
        where: { spaceId, ownerUserId: userId, factKind: "event" },
      }),
    ).toBe(eventEvidenceBeforeDeferral);
    const deferredCandidate = await company.candidates();
    expect(deferredCandidate).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: deferred.candidateId,
          kind: "event",
          reason: "ambiguous_event_subjects",
          entityIds: [entityId(mergeRoot)],
          proposedFact: expect.objectContaining({
            event: ambiguousMergeInput.event,
            matchingEventIds: expect.arrayContaining([childEvent.id, secondChildEvent.id]),
          }),
        }),
      ]),
    );
    expect(await company.importEvent(ambiguousMergeInput)).toEqual(deferred);
    expect(
      (await company.candidates()).filter(
        (candidate) => candidate.reason === "ambiguous_event_subjects",
      ),
    ).toHaveLength(1);
    const originalChildReplay = persisted(
      await company.importEvent({
        ...childEventInput,
        evidence: {
          ...childEventInput.evidence,
          contentHash: "canonical-subject-child-replay-hash",
        },
      }),
    );
    expect(originalChildReplay.id).toBe(childEvent.id);

    const historicalSubjectEventInput = {
      event: {
        ...sharedEventInput.event,
        title: `Historical subject event ${suffix}`,
        entityIds: [entityId(firstPerson)],
      },
      evidence: evidence("historical-subject-event-source", "historical-subject-event-hash"),
    };
    const historicalSubjectEvent = persisted(
      await company.importEvent(historicalSubjectEventInput),
    );
    await company.editEvent({
      eventId: historicalSubjectEvent.id,
      confidence: 0.7,
    });
    await company.disconnect("slack", "subject-person-a");
    const liveSubjectEvent = persisted(
      await company.importEvent({
        ...historicalSubjectEventInput,
        event: {
          ...historicalSubjectEventInput.event,
          entityIds: [entityId(secondPerson)],
        },
        evidence: evidence(
          "historical-subject-event-live-b",
          "historical-subject-event-live-b-hash",
        ),
      }),
    );
    expect(liveSubjectEvent.id).not.toBe(historicalSubjectEvent.id);
    await company.rejectEvent(historicalSubjectEvent.id, "Historical subject is gone");
    expect(
      await company.eventDetail(historicalSubjectEvent.id, { includeRejected: true }),
    ).toMatchObject({ status: "rejected" });
  });

  it("rejects edits and confirmations for rejected entities without adding evidence", async () => {
    const company = companyForActor(prisma, actor);
    const saved = await company.importEntity(
      person("Rejected entity guard", "rejected-entity-guard", "rejected-entity-guard-hash"),
    );
    await company.reject(entityId(saved), "Synthetic rejection");
    const evidenceCount = await prisma.companyEvidence.count({
      where: { spaceId, ownerUserId: userId, factKind: "entity", factId: entityId(saved) },
    });
    await expect(
      company.edit({
        entityId: entityId(saved),
        kind: "person",
        displayName: "Should not edit",
      }),
    ).rejects.toThrow(/rejected/i);
    await expect(company.confirm(entityId(saved))).rejects.toThrow(/rejected/i);
    expect(
      await prisma.companyEvidence.count({
        where: { spaceId, ownerUserId: userId, factKind: "entity", factId: entityId(saved) },
      }),
    ).toBe(evidenceCount);
    expect((await company.detail(entityId(saved), { includeRejected: true }))?.status).toBe(
      "rejected",
    );
  });

  it("keeps owner corrections through disconnect and erases corrections and rejections", async () => {
    const company = companyForActor(prisma, actor);
    const correctionEntity = {
      kind: "person" as const,
      displayName: "Correction Person",
      attrs: { workEmails: ["source@example.test"], slackId: "correction-slack" },
      confidence: 0.9,
    };
    const saved = await company.importEntity({
      entity: correctionEntity,
      evidence: evidence("correction-item", "correction-hash"),
    });
    const edited = await company.edit({
      entityId: entityId(saved),
      kind: "person",
      attrs: { workEmails: [] },
    });
    expect(edited.lockedFields).toContain("attrs.workEmails");
    expect(edited.attrs).toMatchObject({ workEmails: [] });
    await company.confirm(entityId(saved));
    await company.importEntity({
      entity: correctionEntity,
      evidence: evidence("conflicting-item", "conflicting-hash"),
    });
    expect(
      await prisma.companyEvidence.count({
        where: { factId: entityId(saved), factKind: "entity", stance: "contradicts" },
      }),
    ).toBe(1);
    expect((await company.detail(entityId(saved)))?.status).toBe("confirmed");
    expect((await company.detail(entityId(saved)))?.attrs).toMatchObject({
      workEmails: [],
    });
    const ownerAddedIdentity = await company.edit({
      entityId: entityId(saved),
      kind: "person",
      attrs: { workEmails: ["owner-added@example.test"] },
    });
    expect(ownerAddedIdentity.lockedFields).toContain("attrs.workEmails");
    const identityReplay = await company.importEntity(
      person(
        "Correction Person",
        "owner-added-replay",
        "owner-added-hash",
        "owner-added@example.test",
      ),
    );
    expect(entityId(identityReplay)).toBe(entityId(saved));
    await company.disconnect("slack", "correction-item");
    expect(await company.detail(entityId(saved))).not.toBeNull();
    const rejected = await company.reject(entityId(saved), "Not a company fact");
    expect(rejected.status).toBe("rejected");
    const replay = await company.importEntity(
      person("Correction Person", "new-alias", "new-alias-hash", "owner-added@example.test"),
    );
    expect(replay).toMatchObject({ suppressed: true });
    const rejectionCountBeforeErase = await prisma.companyRejection.count({
      where: { spaceId, ownerUserId: userId },
    });
    await company.erase(entityId(saved));
    expect(await company.detail(entityId(saved))).toBeNull();
    expect(await prisma.companyRejection.count({ where: { spaceId, ownerUserId: userId } })).toBe(
      rejectionCountBeforeErase - 1,
    );
  });

  it("allows same-name people, separates employment periods, and reversibly merges references", async () => {
    const company = companyForActor(prisma, actor);
    const one = await company.importEntity({
      entity: {
        kind: "person",
        displayName: "Same Name",
        attrs: { workEmails: ["one@example.test"], timezone: "UTC" },
        confidence: 0.9,
      },
      evidence: evidence("same-one", "same-one-hash"),
    });
    const two = await company.importEntity({
      entity: {
        kind: "person",
        displayName: "Same Name",
        attrs: { workEmails: ["two@example.test"], timezone: "Europe/London" },
        confidence: 0.9,
      },
      evidence: evidence("same-two", "same-two-hash"),
    });
    expect(entityId(one)).not.toBe(entityId(two));
    await company.edit({
      entityId: entityId(one),
      kind: "person",
      attrs: { timezone: "UTC" },
    });
    const edge = {
      edge: {
        fromId: entityId(one),
        toId: entityId(two),
        relation: "works_at" as const,
        startsOn: { date: "2020-01-01", precision: "year" as const },
        endsOn: { date: "2021-01-01", precision: "year" as const },
        role: "Engineer",
        confidence: 0.8,
      },
      evidence: evidence("employment-one", "employment-one-hash"),
    };
    await company.importEdge(edge);
    await company.importEdge({
      ...edge,
      edge: {
        ...edge.edge,
        startsOn: { date: "2023-01-01", precision: "year" as const },
        endsOn: null,
      },
      evidence: evidence("employment-two", "employment-two-hash"),
    });
    expect(
      await prisma.companyEdge.count({
        where: { spaceId, ownerUserId: userId, fromId: entityId(one) },
      }),
    ).toBe(2);
    await company.importEvent({
      event: {
        stream: "people",
        kind: "hire",
        title: "Joined Northwind",
        occursOn: { date: "2020-01-01", precision: "year" },
        endsOn: null,
        entityIds: [entityId(one), entityId(two)],
        amountCents: null,
        currency: null,
        confidence: 0.8,
      },
      evidence: evidence("event-item", "event-hash"),
    });
    await company.merge(entityId(two), entityId(one));
    expect((await company.list()).some((row) => row.id === entityId(two))).toBe(false);
    const merged = await company.detail(entityId(one));
    expect(merged?.mergedFrom).toContain(entityId(two));
    expect(merged?.attrs).toMatchObject({
      workEmails: expect.arrayContaining(["one@example.test", "two@example.test"]),
      timezone: "UTC",
    });
    expect(merged?.events[0]?.entityIds).toEqual([entityId(one)]);
    expect(merged?.edges[0]).toMatchObject({ fromId: entityId(one), toId: entityId(one) });
    const childAliasImport = await company.importEntity(
      person("Same Name", "merged-child-alias", "merged-child-hash", "two@example.test"),
    );
    expect(entityId(childAliasImport)).toBe(entityId(one));
    expect(
      await prisma.companyEvidence.findFirst({
        where: {
          spaceId,
          ownerUserId: userId,
          factKind: "entity",
          factId: entityId(two),
          contentHash: "merged-child-hash",
        },
      }),
    ).not.toBeNull();
    expect((await company.detail(entityId(one)))?.identities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ identityType: "email", identityValue: "two@example.test" }),
      ]),
    );
    await company.split(entityId(two));
    expect((await company.detail(entityId(two)))?.id).toBe(entityId(two));
    expect(await company.evidence(entityId(two))).toEqual(
      expect.arrayContaining([expect.objectContaining({ contentHash: "merged-child-hash" })]),
    );
    expect((await company.detail(entityId(two)))?.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fromId: entityId(one), toId: entityId(two) }),
      ]),
    );
    expect((await company.detail(entityId(two)))?.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entityIds: [entityId(one), entityId(two)] }),
      ]),
    );
    await company.merge(entityId(two), entityId(one));
    await company.reject(entityId(one), "Rejected merged group");
    expect(
      await company.importEntity(
        person("Same Name", "rejected-child-alias", "rejected-child-hash", "two@example.test"),
      ),
    ).toMatchObject({ suppressed: true });
  });

  it("preserves locked child values in merged views and rejects conflicting locks", async () => {
    const company = companyForActor(prisma, actor);
    const rootName = `Manual Root ${suffix}`;
    const childName = `Owner Corrected Child ${suffix}`;
    const root = await company.importEntity({
      entity: {
        kind: "person",
        displayName: rootName,
        attrs: { aliases: ["Root alias"], timezone: "UTC" },
        confidence: 0.9,
      },
      evidence: evidence("locked-child-root", "locked-child-root-hash"),
    });
    const childInput = {
      entity: {
        kind: "person" as const,
        displayName: "Original child name",
        attrs: { aliases: ["Child alias"], timezone: "UTC" },
        confidence: 0.9,
      },
      evidence: evidence("locked-child-source", "locked-child-source-hash"),
    };
    const child = await company.importEntity(childInput);
    await company.edit({
      entityId: entityId(child),
      kind: "person",
      displayName: childName,
      attrs: { aliases: [], timezone: "Europe/London" },
    });
    const merged = await company.merge(entityId(child), entityId(root));
    expect(merged).toMatchObject({
      displayName: childName,
      normalizedName: normalizeCompanyName(childName),
      attrs: { aliases: [], timezone: "Europe/London" },
      lockedFields: expect.arrayContaining(["displayName", "attrs.aliases", "attrs.timezone"]),
      mergedFrom: [entityId(child)],
    });

    expect((await company.search(rootName)).map((record) => record.id)).toEqual([entityId(root)]);
    expect((await company.search(childName)).map((record) => record.id)).toEqual([entityId(root)]);
    expect(
      (await company.search(childName.replaceAll(" ", "   "))).map((record) => record.id),
    ).toEqual([entityId(root)]);
    expect(await company.list({ kind: "company", text: childName })).toEqual([]);
    expect(await companyForActor(prisma, otherActor).search(childName)).toEqual([]);
    const childRaw = await company.detail(entityId(child), { includeMerged: true });
    expect(childRaw).toMatchObject({
      id: entityId(child),
      displayName: childName,
      attrs: { aliases: [], timezone: "Europe/London" },
      mergedFrom: [],
    });
    expect(childRaw?.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ contentHash: "locked-child-source-hash" }),
      ]),
    );
    expect(childRaw?.evidence).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ contentHash: "locked-child-root-hash" })]),
    );
    const includeMergedRows = await company.list({ includeMerged: true });
    expect(includeMergedRows.filter((record) => record.id === entityId(root))).toHaveLength(1);
    expect(includeMergedRows.filter((record) => record.id === entityId(child))).toHaveLength(1);
    expect(await company.count({ includeMerged: true })).toBe(includeMergedRows.length);

    await company.split(entityId(child));
    expect(await company.detail(entityId(child))).toMatchObject({
      id: entityId(child),
      displayName: childName,
      normalizedName: normalizeCompanyName(childName),
      attrs: { aliases: [], timezone: "Europe/London" },
    });
    expect(await company.detail(entityId(root))).toMatchObject({
      displayName: rootName,
      normalizedName: normalizeCompanyName(rootName),
      attrs: { aliases: ["Root alias"], timezone: "UTC" },
    });

    const replayRootName = `Locked Value Root ${suffix}`;
    const replayChildName = `Locked Value Child ${suffix}`;
    const replayRootEmail = `locked-value-root-${suffix}@example.test`;
    const replayRoot = await company.importEntity({
      entity: {
        kind: "person",
        displayName: replayRootName,
        attrs: { timezone: "UTC", workEmails: [replayRootEmail] },
        confidence: 0.9,
      },
      evidence: evidence("locked-value-root", "locked-value-root-hash"),
    });
    const replayChildInput = {
      entity: {
        kind: "person" as const,
        displayName: replayChildName,
        attrs: { timezone: "UTC" },
        confidence: 0.9,
      },
      evidence: evidence("locked-value-child", "locked-value-child-hash"),
    };
    const replayChild = await company.importEntity(replayChildInput);
    await company.edit({
      entityId: entityId(replayChild),
      kind: "person",
      attrs: { timezone: "Europe/London" },
    });
    const replayMerge = await company.merge(entityId(replayChild), entityId(replayRoot));
    expect(replayMerge).toMatchObject({
      attrs: { timezone: "Europe/London" },
      lockedFields: expect.arrayContaining(["attrs.timezone"]),
    });

    const rootConflictHash = "locked-child-root-utc-replay-hash";
    const rootConflict = persisted(
      await company.importEntity({
        entity: {
          kind: "person",
          displayName: replayRootName,
          attrs: { timezone: "UTC", workEmails: [replayRootEmail] },
          confidence: 0.9,
        },
        evidence: evidence("locked-child-root-utc-replay", rootConflictHash),
      }),
    );
    expect(rootConflict.id).toBe(entityId(replayRoot));
    expect(rootConflict.attrs).toMatchObject({ timezone: "Europe/London" });
    expect(
      await prisma.companyEvidence.findFirst({
        where: {
          spaceId,
          ownerUserId: userId,
          factKind: "entity",
          factId: entityId(replayRoot),
          contentHash: rootConflictHash,
        },
        select: { stance: true },
      }),
    ).toEqual({ stance: "contradicts" });

    const rootSupportHash = "locked-child-root-london-replay-hash";
    const rootSupport = persisted(
      await company.importEntity({
        entity: {
          kind: "person",
          displayName: replayRootName,
          attrs: { timezone: "Europe/London", workEmails: [replayRootEmail] },
          confidence: 0.9,
        },
        evidence: evidence("locked-child-root-london-replay", rootSupportHash),
      }),
    );
    expect(rootSupport.id).toBe(entityId(replayRoot));
    expect(
      await prisma.companyEvidence.findFirst({
        where: {
          spaceId,
          ownerUserId: userId,
          factKind: "entity",
          factId: entityId(replayRoot),
          contentHash: rootSupportHash,
        },
        select: { stance: true },
      }),
    ).toEqual({ stance: "supports" });

    const childSupportHash = "locked-child-name-only-replay-hash";
    const childReplay = persisted(
      await company.importEntity({
        ...replayChildInput,
        entity: { ...replayChildInput.entity, attrs: { timezone: "Europe/London" } },
        evidence: { ...replayChildInput.evidence, contentHash: childSupportHash },
      }),
    );
    expect(childReplay.id).toBe(entityId(replayRoot));
    expect(
      await prisma.companyEvidence.findFirst({
        where: {
          spaceId,
          ownerUserId: userId,
          factKind: "entity",
          factId: entityId(replayChild),
          contentHash: childSupportHash,
        },
        select: { stance: true },
      }),
    ).toEqual({ stance: "supports" });

    await company.split(entityId(replayChild));
    expect(await company.detail(entityId(replayChild))).toMatchObject({
      id: entityId(replayChild),
      displayName: replayChildName,
      normalizedName: normalizeCompanyName(replayChildName),
      attrs: { timezone: "Europe/London" },
    });
    expect(await company.detail(entityId(replayRoot))).toMatchObject({
      id: entityId(replayRoot),
      displayName: replayRootName,
      normalizedName: normalizeCompanyName(replayRootName),
      attrs: { timezone: "Europe/London", workEmails: [replayRootEmail] },
    });

    const conflictingRoot = await company.importEntity({
      entity: {
        kind: "person",
        displayName: "Conflicting lock root",
        attrs: { timezone: "UTC" },
        confidence: 0.9,
      },
      evidence: evidence("conflicting-lock-root", "conflicting-lock-root-hash"),
    });
    const conflictingChild = await company.importEntity({
      entity: {
        kind: "person",
        displayName: "Conflicting lock child",
        attrs: { timezone: "Asia/Tokyo" },
        confidence: 0.9,
      },
      evidence: evidence("conflicting-lock-child", "conflicting-lock-child-hash"),
    });
    await company.edit({
      entityId: entityId(conflictingRoot),
      kind: "person",
      attrs: { timezone: "UTC" },
    });
    await company.edit({
      entityId: entityId(conflictingChild),
      kind: "person",
      attrs: { timezone: "Europe/London" },
    });
    await expect(
      company.merge(entityId(conflictingChild), entityId(conflictingRoot)),
    ).rejects.toThrow(/conflicting locked values/i);
    expect(
      await prisma.companyMerge.findFirst({
        where: {
          spaceId,
          ownerUserId: userId,
          sourceEntityId: entityId(conflictingChild),
          survivorEntityId: entityId(conflictingRoot),
        },
      }),
    ).toBeNull();
  });

  it("eraseMap removes all facts, evidence, candidates, corrections, rejections and merges", async () => {
    const company = companyForActor(prisma, actor);
    const survivor = await company.importEntity(
      person(
        "Erase survivor",
        "erase-survivor",
        "erase-survivor-hash",
        "erase-survivor@example.test",
      ),
    );
    const child = await company.importEntity(
      person("Erase child", "erase-child", "erase-child-hash", "erase-child@example.test"),
    );
    const rejected = await company.importEntity(
      person("Erase rejected", "erase-rejected", "erase-rejected-hash"),
    );
    await company.edit({
      entityId: entityId(survivor),
      kind: "person",
      attrs: { aliases: ["owner alias"] },
    });
    await company.merge(entityId(child), entityId(survivor));
    await company.importEdge({
      edge: {
        fromId: entityId(survivor),
        toId: entityId(child),
        relation: "works_at",
        startsOn: null,
        endsOn: null,
        role: "Owner",
        confidence: 0.9,
      },
      evidence: evidence("erase-edge", "erase-edge-hash"),
    });
    await company.importEvent({
      event: {
        stream: "company",
        kind: "milestone",
        title: "Erase milestone",
        occursOn: null,
        endsOn: null,
        entityIds: [],
        amountCents: null,
        currency: null,
        confidence: 0.8,
      },
      evidence: evidence("erase-event", "erase-event-hash"),
    });
    await company.reject(entityId(rejected), "Erase rejection");
    await candidate("slack", "erase-candidate");

    expect(
      await prisma.companyCorrection.count({ where: { spaceId, ownerUserId: userId } }),
    ).toBeGreaterThan(0);
    expect(
      await prisma.companyRejection.count({ where: { spaceId, ownerUserId: userId } }),
    ).toBeGreaterThan(0);
    expect(
      await prisma.companyMerge.count({ where: { spaceId, ownerUserId: userId } }),
    ).toBeGreaterThan(0);
    expect(
      await prisma.companyCandidate.count({ where: { spaceId, ownerUserId: userId } }),
    ).toBeGreaterThan(0);
    await company.eraseMap();

    expect(await prisma.companyEntity.count({ where: { spaceId, ownerUserId: userId } })).toBe(0);
    expect(await prisma.companyIdentity.count({ where: { spaceId, ownerUserId: userId } })).toBe(0);
    expect(await prisma.companyEdge.count({ where: { spaceId, ownerUserId: userId } })).toBe(0);
    expect(await prisma.companyEvent.count({ where: { spaceId, ownerUserId: userId } })).toBe(0);
    expect(await prisma.companyEventEntity.count({ where: { spaceId, ownerUserId: userId } })).toBe(
      0,
    );
    expect(await prisma.companyEvidence.count({ where: { spaceId, ownerUserId: userId } })).toBe(0);
    expect(await prisma.companyCandidate.count({ where: { spaceId, ownerUserId: userId } })).toBe(
      0,
    );
    expect(await prisma.companyCorrection.count({ where: { spaceId, ownerUserId: userId } })).toBe(
      0,
    );
    expect(await prisma.companyRejection.count({ where: { spaceId, ownerUserId: userId } })).toBe(
      0,
    );
    expect(await prisma.companyMerge.count({ where: { spaceId, ownerUserId: userId } })).toBe(0);
  });

  it("rejects chained and confirmed or rejected merge conflicts", async () => {
    const company = companyForActor(prisma, actor);
    const survivor = await company.importEntity(
      person("Merge root", "merge-root", "merge-root-hash"),
    );
    const child = await company.importEntity(
      person("Merge child", "merge-child", "merge-child-hash"),
    );
    const destination = await company.importEntity(
      person("Merge destination", "merge-destination", "merge-destination-hash"),
    );
    await company.merge(entityId(child), entityId(survivor));
    await expect(company.merge(entityId(survivor), entityId(destination))).rejects.toThrow(
      /children|chain/i,
    );
    await expect(company.merge(entityId(destination), entityId(child))).rejects.toThrow(/chain/i);

    const confirmed = await company.importEntity(
      person("Confirmed merge fact", "confirmed-merge", "confirmed-merge-hash"),
    );
    const suggested = await company.importEntity(
      person("Suggested merge fact", "suggested-merge", "suggested-merge-hash"),
    );
    await company.confirm(entityId(confirmed));
    await expect(company.merge(entityId(suggested), entityId(confirmed))).rejects.toThrow(
      /status/i,
    );

    const rejected = await company.importEntity(
      person("Rejected merge fact", "rejected-merge", "rejected-merge-hash"),
    );
    const otherSuggested = await company.importEntity(
      person("Other suggested merge fact", "other-suggested-merge", "other-suggested-merge-hash"),
    );
    await company.reject(entityId(rejected), "Not a company fact");
    await expect(company.merge(entityId(otherSuggested), entityId(rejected))).rejects.toThrow(
      /status/i,
    );
  });

  it("allows company data to cascade with space deletion", async () => {
    const otherSpaceCompany = companyForActor(prisma, otherSpaceActor);
    const saved = await otherSpaceCompany.importEntity(
      person("Delete space company", "delete-space", "delete-space-hash"),
    );
    await otherSpaceCompany.reject(entityId(saved), "Space deletion test");
    await prisma.space.delete({ where: { id: otherSpaceId } });
    expect(
      await prisma.companyEntity.count({
        where: { spaceId: otherSpaceId, ownerUserId: userId },
      }),
    ).toBe(0);
  });

  it("rejects forbidden attributes at the helper boundary", async () => {
    await expect(
      companyForActor(prisma, actor).importEntity({
        entity: {
          kind: "person",
          displayName: "Forbidden",
          attrs: { performanceReview: "secret" },
          confidence: 0.2,
        },
        evidence: evidence("forbidden-item", "forbidden-hash"),
      } as never),
    ).rejects.toThrow();
  });
});
