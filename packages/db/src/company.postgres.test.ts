import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";
import type { CompanyWriteResult } from "./company.js";
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

  it("rejects direct facts without evidence and deletes a fact when its last evidence is removed", async () => {
    const id = `company-no-evidence-${suffix}`;
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

    const saved = await companyForActor(prisma, actor).importEntity(
      person("Orphan", "orphan-item", "orphan-hash"),
    );
    await prisma.companyEvidence.deleteMany({
      where: { factId: entityId(saved), factKind: "entity" },
    });
    expect(
      await prisma.companyEntity.findFirst({
        where: { id: entityId(saved), spaceId, ownerUserId: userId },
      }),
    ).toBeNull();
  });

  it("keeps owner corrections through disconnect and erases corrections and rejections", async () => {
    const company = companyForActor(prisma, actor);
    const saved = await company.importEntity(
      person("Correction Person", "correction-item", "correction-hash", "source@example.test"),
    );
    const edited = await company.edit({
      entityId: entityId(saved),
      kind: "person",
      attrs: { workEmails: ["edited@example.test"] },
    });
    expect(edited.lockedFields).toContain("attrs.workEmails[0]");
    await company.confirm(entityId(saved));
    await company.importEntity(
      person("Correction Person", "conflicting-item", "conflicting-hash", "source@example.test"),
    );
    expect(
      await prisma.companyEvidence.count({
        where: { factId: entityId(saved), factKind: "entity", stance: "contradicts" },
      }),
    ).toBe(1);
    expect((await company.detail(entityId(saved)))?.status).toBe("confirmed");
    expect((await company.detail(entityId(saved)))?.attrs).toMatchObject({
      workEmails: ["edited@example.test"],
    });
    await company.disconnect("slack", "correction-item");
    expect(await company.detail(entityId(saved))).not.toBeNull();
    const rejected = await company.reject(entityId(saved), "Not a company fact");
    expect(rejected.status).toBe("rejected");
    const replay = await company.importEntity(
      person("Correction Person", "new-alias", "new-alias-hash"),
    );
    expect(replay).toMatchObject({ suppressed: true });
    await company.erase(entityId(saved));
    expect(await company.detail(entityId(saved))).toBeNull();
    expect(await prisma.companyRejection.count({ where: { spaceId, ownerUserId: userId } })).toBe(
      0,
    );
  });

  it("allows same-name people, separates employment periods, and reversibly merges references", async () => {
    const company = companyForActor(prisma, actor);
    const one = await company.importEntity(
      person("Same Name", "same-one", "same-one-hash", "one@example.test"),
    );
    const two = await company.importEntity(
      person("Same Name", "same-two", "same-two-hash", "two@example.test"),
    );
    expect(entityId(one)).not.toBe(entityId(two));
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
    expect(merged?.events[0]?.entityIds).toEqual([entityId(one)]);
    expect(merged?.edges[0]).toMatchObject({ fromId: entityId(one), toId: entityId(one) });
    await company.split(entityId(two));
    expect((await company.detail(entityId(two)))?.id).toBe(entityId(two));
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
