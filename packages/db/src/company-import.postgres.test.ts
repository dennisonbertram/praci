import type { Actor } from "@rakazo/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";
import { companyForActor, companyWriter } from "./company.js";
import {
  CompanyImportError,
  claimCompanyImportUnit,
  completeCompanyImportUnit,
  createCompanyImportRun,
  getCompanyImportProgress,
  reserveCompanyImportCall,
  startCompanyImportRun,
  updateCompanyImportRun,
} from "./company-import.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("company import engine persistence (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `company-import-org-${suffix}`;
  const spaceId = `company-import-space-${suffix}`;
  const otherSpaceId = `company-import-other-space-${suffix}`;
  const userId = `company-import-user-${suffix}`;
  const otherUserId = `company-import-other-user-${suffix}`;
  const actor: Actor = {
    spaceId,
    userId,
    email: "owner@example.test",
    isDeploymentOwner: true,
  };
  const otherActor: Actor = {
    spaceId,
    userId: otherUserId,
    email: "other@example.test",
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
    await prisma.user.createMany({
      data: [
        { id: userId, name: userId, email: `${userId}@example.test` },
        { id: otherUserId, name: otherUserId, email: `${otherUserId}@example.test` },
      ],
    });
    await prisma.organization.create({
      data: {
        id: organizationId,
        name: "Company import test org",
        slug: organizationId,
        createdAt: new Date(),
      },
    });
    await prisma.space.createMany({
      data: [
        { id: spaceId, organizationId, name: "Company import test space" },
        { id: otherSpaceId, organizationId, name: "Company import other space" },
      ],
    });
    await prisma.member.createMany({
      data: [
        {
          id: `company-import-member-a-${suffix}`,
          organizationId,
          userId,
          role: "owner",
          createdAt: new Date(),
        },
        {
          id: `company-import-member-b-${suffix}`,
          organizationId,
          userId: otherUserId,
          role: "member",
          createdAt: new Date(),
        },
      ],
    });
    await prisma.spaceMember.createMany({
      data: [
        {
          id: `company-import-space-member-a-${suffix}`,
          spaceId,
          organizationId,
          userId,
          role: "owner",
          createdAt: new Date(),
        },
        {
          id: `company-import-space-member-b-${suffix}`,
          spaceId,
          organizationId,
          userId: otherUserId,
          role: "member",
          createdAt: new Date(),
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

  async function runWithSources(tokenCap: number, count = 1) {
    const run = await createCompanyImportRun(prisma, actor, {
      tokenCap,
      sources: Array.from({ length: count }, () => ({
        sourceKind: "data_room" as const,
        scope: {},
      })),
    });
    await startCompanyImportRun(prisma, actor, run.id);
    const units = await prisma.companyImportUnit.findMany({
      where: { spaceId, ownerUserId: userId, runId: run.id },
      orderBy: { createdAt: "asc" },
    });
    const claims = await Promise.all(
      units.map((unit) =>
        claimCompanyImportUnit(prisma, actor, { runId: run.id, unitId: unit.id }),
      ),
    );
    return {
      runId: run.id,
      claims: claims.filter((claim): claim is NonNullable<typeof claim> => claim !== null),
    };
  }

  it("reclaims expired claims with a new fence and rejects stale completion", async () => {
    const { runId, claims } = await runWithSources(100);
    const first = claims[0]!;
    await prisma.companyImportUnit.update({
      where: { id: first.id },
      data: { claimExpiresAt: new Date(Date.now() - 1_000) },
    });
    const reclaimed = await claimCompanyImportUnit(prisma, actor, {
      runId,
      unitId: first.id,
    });
    expect(reclaimed).not.toBeNull();
    expect(reclaimed!.claimToken).not.toBe(first.claimToken);
    await expect(
      completeCompanyImportUnit(prisma, actor, {
        runId,
        sourceId: first.sourceId,
        unitId: first.id,
        claimToken: first.claimToken,
        nextCursor: null,
        done: true,
        itemsDiscovered: 0,
        itemsRead: 0,
        facts: [],
      }),
    ).rejects.toMatchObject({ code: "stale_claim" });
  });

  it("serializes reservations across sources and resumes after raising the cap", async () => {
    const { runId, claims } = await runWithSources(10, 2);
    expect(claims).toHaveLength(2);
    const reservationInput = (claim: (typeof claims)[number]) => ({
      runId,
      sourceId: claim.sourceId,
      unitId: claim.id,
      claimToken: claim.claimToken,
      recipientKey: "synthetic-recipient",
      disclosureVersion: "2026-01",
      callId: `synthetic-call-${claim.id}`,
      inputTokenBound: 4,
      maxOutputTokens: 2,
    });
    const results = await Promise.allSettled(
      claims.map((claim) => reserveCompanyImportCall(prisma, actor, reservationInput(claim))),
    );
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(
      results.filter(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected" &&
          result.reason instanceof CompanyImportError &&
          result.reason.code === "budget_reached",
      ),
    ).toHaveLength(1);
    expect((await getCompanyImportProgress(prisma, actor, runId)).status).toBe("budget_reached");

    const reserved = await prisma.companyImportCall.findMany({
      where: { spaceId, ownerUserId: userId, runId },
      select: { unitId: true },
    });
    await updateCompanyImportRun(prisma, actor, {
      runId,
      action: "resume",
      tokenCap: 20,
    });
    const second = claims.find((claim) => claim.id !== reserved[0]?.unitId)!;
    await expect(
      reserveCompanyImportCall(prisma, actor, reservationInput(second)),
    ).resolves.toMatchObject({ reservedInput: 4, reservedOutput: 2 });
  });

  it("isolates progress and discard evidence by owner and import run", async () => {
    const first = await runWithSources(100);
    const firstClaim = first.claims[0]!;
    const fact = {
      entity: {
        kind: "person" as const,
        displayName: "Synthetic import person",
        attrs: {},
        confidence: 0.8,
      },
      evidence: {
        stance: "supports" as const,
        sourceKind: "data_room" as const,
        sourceItemId: "synthetic-item",
        quote: "Synthetic source quote.",
        contentHash: "synthetic-hash",
        extractedAt: "2026-01-02T03:04:05.000Z",
        extractorModel: null,
        confidence: 0.8,
      },
    };
    await completeCompanyImportUnit(prisma, actor, {
      runId: first.runId,
      sourceId: firstClaim.sourceId,
      unitId: firstClaim.id,
      claimToken: firstClaim.claimToken,
      nextCursor: null,
      done: true,
      itemsDiscovered: 1,
      itemsRead: 1,
      facts: [{ kind: "entity", input: fact }],
    });
    const other = await runWithSources(100);
    const otherClaim = other.claims[0]!;
    await completeCompanyImportUnit(prisma, actor, {
      runId: other.runId,
      sourceId: otherClaim.sourceId,
      unitId: otherClaim.id,
      claimToken: otherClaim.claimToken,
      nextCursor: null,
      done: true,
      itemsDiscovered: 1,
      itemsRead: 1,
      facts: [
        {
          kind: "entity",
          input: { ...fact, evidence: { ...fact.evidence, sourceItemId: "other-item" } },
        },
      ],
    });
    const manual = await companyWriter(prisma, actor).importEntity({
      ...fact,
      evidence: { ...fact.evidence, sourceItemId: "manual-item", sourceKind: "manual" },
    });
    expect("id" in manual).toBe(true);
    const firstEvidence = await prisma.companyEvidence.findFirst({
      where: { extractorRunId: first.runId },
      select: { factId: true },
    });
    expect(firstEvidence).not.toBeNull();
    const company = companyForActor(prisma, actor);
    await company.edit({
      entityId: firstEvidence!.factId,
      kind: "person",
      displayName: "Owner-corrected import person",
    });
    await company.reject(firstEvidence!.factId, "Owner rejection preserved after discard");
    await expect(getCompanyImportProgress(prisma, otherActor, first.runId)).rejects.toMatchObject({
      code: "not_found",
    });
    await updateCompanyImportRun(prisma, actor, { runId: first.runId, action: "discard" });
    expect(await prisma.companyEvidence.count({ where: { extractorRunId: first.runId } })).toBe(0);
    expect(await prisma.companyEvidence.count({ where: { extractorRunId: other.runId } })).toBe(1);
    expect(await company.detail(firstEvidence!.factId, { includeRejected: true })).toMatchObject({
      displayName: "Owner-corrected import person",
      status: "rejected",
    });
    expect(
      await prisma.companyEvidence.count({
        where: { sourceItemId: "manual-item", extractorRunId: null },
      }),
    ).toBe(1);
  });
});
