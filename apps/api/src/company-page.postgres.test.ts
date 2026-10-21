import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { companyForActor, createDb } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createNorthwindCompanyFixture } from "../../../packages/testkit/src/fixtures/company/corpus.js";
import { northwindGroundTruth } from "../../../packages/testkit/src/fixtures/company/ground-truth.js";
import { companyFact, companyPage } from "./company-page.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE === "1" && databaseUrl ? describe.sequential : describe.skip;

describePostgres("company page (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `company-page-org-${suffix}`;
  const spaceId = `company-page-space-${suffix}`;
  const otherSpaceId = `company-page-other-space-${suffix}`;
  const userId = `company-page-user-${suffix}`;
  const otherUserId = `company-page-other-user-${suffix}`;
  const actor = (userId: string, spaceId: string): Actor => ({
    userId,
    spaceId,
    email: `${userId}@example.test`,
    isDeploymentOwner: false,
  });
  const owner = actor(userId, spaceId);
  const otherOwner = actor(otherUserId, spaceId);
  const otherSpaceOwner = actor(userId, otherSpaceId);
  const fixtureItems = new Map(
    createNorthwindCompanyFixture().map((item) => [
      `${item.sourceKind}:${item.sourceItemId}`,
      item,
    ]),
  );
  type FixtureFact = (typeof northwindGroundTruth.entities)[number];
  const fact = (id: string): FixtureFact => {
    const found = northwindGroundTruth.entities.find((item) => item.id === id);
    if (!found) throw new Error(`Missing authored Northwind fixture fact: ${id}`);
    return found;
  };
  const inputFor = (
    companyFact: FixtureFact,
    options: { confidence?: number; contentHash?: string } = {},
  ) => {
    const source = companyFact.sources[0]!;
    const item = fixtureItems.get(`${source.sourceKind}:${source.sourceItemId}`)!;
    const confidence = options.confidence ?? companyFact.input.confidence;
    return {
      entity: { ...companyFact.input, confidence },
      evidence: {
        stance: "supports" as const,
        sourceKind: source.sourceKind,
        sourceItemId: source.sourceItemId,
        sourceUrl: item.sourceUrl,
        quote: companyFact.statement,
        contentHash: options.contentHash ?? item.contentHash,
        extractedAt: item.updatedAt,
        extractorModel: null,
        confidence,
      },
    };
  };
  const entityId = (
    result: Awaited<ReturnType<ReturnType<typeof companyForActor>["importEntity"]>>,
  ) => {
    if ("suppressed" in result || "deferred" in result)
      throw new Error("Expected a persisted company entity");
    return result.id;
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
      data: [
        { id: userId, name: userId, email: `${userId}@example.test` },
        { id: otherUserId, name: otherUserId, email: `${otherUserId}@example.test` },
      ],
    });
    await prisma.organization.create({
      data: { id: organizationId, name: organizationId, slug: organizationId, createdAt },
    });
    await prisma.space.createMany({
      data: [
        { id: spaceId, organizationId, name: "Company Page Test Space" },
        { id: otherSpaceId, organizationId, name: "Other Company Page Space" },
      ],
    });
    await prisma.member.createMany({
      data: [
        { id: `company-page-member-${suffix}`, organizationId, userId, role: "owner", createdAt },
        {
          id: `company-page-other-member-${suffix}`,
          organizationId,
          userId: otherUserId,
          role: "member",
          createdAt,
        },
      ],
    });
    await prisma.spaceMember.createMany({
      data: [
        {
          id: `company-page-sm-a-${suffix}`,
          spaceId,
          organizationId,
          userId,
          role: "owner",
          createdAt,
        },
        {
          id: `company-page-sm-b-${suffix}`,
          spaceId,
          organizationId,
          userId: otherUserId,
          role: "member",
          createdAt,
        },
        {
          id: `company-page-sm-c-${suffix}`,
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

  it("isolates owners and spaces, filters hidden facts, and preserves review after replay", async () => {
    const company = companyForActor(prisma, owner);
    const rootInput = inputFor(fact("northwind"));
    const root = entityId(await company.importEntity(rootInput));
    const sameSpaceFact = entityId(
      await companyForActor(prisma, otherOwner).importEntity(rootInput),
    );
    const otherSpaceFact = entityId(
      await companyForActor(prisma, otherSpaceOwner).importEntity(rootInput),
    );

    await company.confirm(root);
    await company.edit({
      entityId: root,
      kind: "company",
      attrs: { whatWeDo: "Owner-corrected Northwind description." },
    });
    const replay = await company.importEntity(
      inputFor(fact("northwind"), { contentHash: `${rootInput.evidence.contentHash}-replay` }),
    );
    expect(replay).toMatchObject({
      id: root,
      status: "confirmed",
      attrs: { whatWeDo: "Owner-corrected Northwind description." },
    });

    const lowConfidence = entityId(
      await company.importEntity(inputFor(fact("nw-person-1"), { confidence: 0.4 })),
    );
    const rejected = entityId(await company.importEntity(inputFor(fact("nw-person-2"))));
    await company.reject(rejected, "Rejected synthetic company fact");
    expect(
      await company.importEntity(
        inputFor(fact("nw-person-2"), { contentHash: "northwind-rejected-replay" }),
      ),
    ).toMatchObject({ suppressed: true, record: null });

    const page = await companyPage(prisma, owner);
    expect(page.entities.map((record) => record.id)).toEqual([root]);
    expect(page.entities[0]).toMatchObject({
      status: "confirmed",
      attrs: { whatWeDo: "Owner-corrected Northwind description." },
    });
    expect(await companyFact(prisma, owner, { kind: "entity", id: root })).toMatchObject({
      kind: "entity",
      record: {
        status: "confirmed",
        attrs: { whatWeDo: "Owner-corrected Northwind description." },
      },
    });
    expect(await companyFact(prisma, owner, { kind: "entity", id: lowConfidence })).toBeNull();
    expect(await companyFact(prisma, owner, { kind: "entity", id: rejected })).toBeNull();
    expect(await companyFact(prisma, owner, { kind: "entity", id: sameSpaceFact })).toBeNull();
    expect(await companyFact(prisma, owner, { kind: "entity", id: otherSpaceFact })).toBeNull();
    expect(await company.detail(rejected, { includeRejected: true })).toMatchObject({
      status: "rejected",
    });
    expect((await companyPage(prisma, otherOwner)).entities.map((record) => record.id)).toEqual([
      sameSpaceFact,
    ]);
    expect(
      (await companyPage(prisma, otherSpaceOwner)).entities.map((record) => record.id),
    ).toEqual([otherSpaceFact]);
  });
});
