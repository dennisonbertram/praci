import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { companyForActor, createDb } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createNorthwindCompanyFixture } from "../../../packages/testkit/src/fixtures/company/corpus.js";
import { northwindGroundTruth } from "../../../packages/testkit/src/fixtures/company/ground-truth.js";
import { companyCalendar } from "./company-calendar.js";
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
    await prisma.legalDeadline.deleteMany({
      where: { spaceId: { in: [spaceId, otherSpaceId] }, userId: { in: [userId, otherUserId] } },
    });
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await close();
  });

  it("reads open Legal renewal and notice dates through with owner and space isolation", async () => {
    const ids = [
      `notice-${suffix}`,
      `renewal-${suffix}`,
      `other-owner-${suffix}`,
      `other-space-${suffix}`,
    ];
    await prisma.legalDeadline.createMany({
      data: ids.map((id, index) => ({
        id,
        spaceId: index === 3 ? otherSpaceId : spaceId,
        userId: index === 2 ? otherUserId : userId,
        title: id,
        dueDate: new Date("2026-10-01T00:00:00Z"),
        kind: index === 1 ? "renewal" : "notice",
      })),
    });
    const input = { month: "2026-10", anniversaries: false };
    const before = await companyCalendar(prisma, owner, input);
    expect(before.map((item) => item.legalDeadlineId)).toEqual(ids.slice(0, 2));
    expect(before.every((item) => item.date === "2026-10-01")).toBe(true);
    await prisma.legalDeadline.update({ where: { id: ids[0]! }, data: { status: "done" } });
    expect(
      (await companyCalendar(prisma, owner, input)).map((item) => item.legalDeadlineId),
    ).toEqual([ids[1]]);
    expect(
      (await companyCalendar(prisma, otherOwner, input)).map((item) => item.legalDeadlineId),
    ).toEqual([ids[2]]);
    expect(
      (await companyCalendar(prisma, otherSpaceOwner, input)).map((item) => item.legalDeadlineId),
    ).toEqual([ids[3]]);
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
    await company.importEdge({
      edge: { fromId: lowConfidence, toId: root, relation: "works_at", confidence: 0.95 },
      evidence: rootInput.evidence,
    });
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
        edges: [],
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

  it("nests shared relationships into shared entity rows", async () => {
    const sharedOwner = companyForActor(prisma, otherOwner);
    const evidence = (sourceItemId: string) => ({
      stance: "supports" as const,
      sourceKind: "slack" as const,
      sourceItemId,
      quote: "Synthetic shared fact.",
      contentHash: `${sourceItemId}-hash`,
      extractedAt: "2026-01-02T03:04:05.000Z",
      extractorModel: null,
      confidence: 0.9,
    });
    const first = entityId(
      await sharedOwner.importEntity({
        entity: {
          kind: "person",
          displayName: "Shared page person one",
          attrs: { workEmails: ["shared-page-one@example.test"] },
          confidence: 0.9,
        },
        evidence: evidence("shared-page-person-one"),
      }),
    );
    const second = entityId(
      await sharedOwner.importEntity({
        entity: {
          kind: "person",
          displayName: "Shared page person two",
          attrs: { workEmails: ["shared-page-two@example.test"] },
          confidence: 0.9,
        },
        evidence: evidence("shared-page-person-two"),
      }),
    );
    for (const id of [first, second]) {
      await sharedOwner.confirm(id);
      await sharedOwner.visibility({ kind: "entity", id, visibility: "team" });
    }
    const edge = await sharedOwner.importEdge({
      edge: {
        fromId: first,
        toId: second,
        relation: "works_at",
        startsOn: null,
        endsOn: null,
        role: "Shared page role",
        confidence: 0.9,
      },
      evidence: evidence("shared-page-edge"),
    });
    if ("deferred" in edge || "suppressed" in edge) throw new Error("Expected shared edge");
    await sharedOwner.confirmEdge(edge.id);
    await sharedOwner.visibility({ kind: "edge", id: edge.id, visibility: "team" });
    const event = await sharedOwner.importEvent({
      event: {
        stream: "people",
        kind: "hire",
        title: "Shared page event",
        occursOn: null,
        endsOn: null,
        entityIds: [first],
        amountCents: null,
        currency: null,
        confidence: 0.9,
      },
      evidence: evidence("shared-page-event"),
    });
    if ("deferred" in event || "suppressed" in event) throw new Error("Expected shared event");
    await sharedOwner.confirmEvent(event.id);
    await sharedOwner.visibility({ kind: "event", id: event.id, visibility: "team" });

    const page = await companyPage(prisma, owner);
    const sharedFirst = page.entities.find((row) => row.id === first);
    expect(sharedFirst?.edges.map((row) => row.id)).toContain(edge.id);
    expect(sharedFirst?.events.map((row) => row.id)).toContain(event.id);
  });
});
