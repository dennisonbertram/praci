import type { AgentUsage } from "@rakazo/adapter-kit";
import type { Actor } from "@rakazo/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";
import { companyForActor } from "./company.js";
import {
  CompanyImportError,
  claimCompanyImportUnit,
  completeCompanyImportUnit,
  createCompanyImportRun,
  failCompanyImportUnit,
  getCompanyImportProgress,
  releaseCompanyImportCall,
  reserveCompanyImportCall,
  settleCompanyImportCall,
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
      sources: Array.from({ length: count }, (_, index) => ({
        sourceKind: "data_room" as const,
        scope: { index },
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
    await updateCompanyImportRun(prisma, actor, { runId, action: "cancel" });
    await expect(
      completeCompanyImportUnit(prisma, actor, {
        runId,
        sourceId: first.sourceId,
        unitId: first.id,
        claimToken: reclaimed!.claimToken,
        nextCursor: null,
        done: true,
        itemsDiscovered: 0,
        itemsRead: 0,
        facts: [],
      }),
    ).rejects.toMatchObject({ code: "stale_claim" });
    await expect(
      updateCompanyImportRun(prisma, actor, { runId, action: "cancel" }),
    ).rejects.toMatchObject({
      code: "invalid_state",
    });
    expect((await getCompanyImportProgress(prisma, actor, runId)).status).toBe("cancelled");
  });

  it("rejects duplicate source input rather than relying on a database conflict", async () => {
    await expect(
      createCompanyImportRun(prisma, actor, {
        tokenCap: 100,
        sources: [
          { sourceKind: "data_room", scope: { folderId: "same" } },
          { sourceKind: "data_room", scope: { folderId: "same" } },
        ],
      }),
    ).rejects.toMatchObject({ code: "invalid_state" });
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
    const second = await claimCompanyImportUnit(prisma, actor, {
      runId,
      unitId: claims.find((claim) => claim.id !== reserved[0]?.unitId)!.id,
    });
    expect(second).not.toBeNull();
    await expect(
      reserveCompanyImportCall(prisma, actor, reservationInput(second!)),
    ).resolves.toMatchObject({ reservedInput: 4, reservedOutput: 2 });
  });

  it("settles a reservation once, charges actual usage, and records late known usage", async () => {
    const { runId, claims } = await runWithSources(100);
    const claim = claims[0]!;
    const reservation = await reserveCompanyImportCall(prisma, actor, {
      runId,
      sourceId: claim.sourceId,
      unitId: claim.id,
      claimToken: claim.claimToken,
      recipientKey: "synthetic-recipient",
      disclosureVersion: "2026-01",
      callId: "untrusted-provider-call-id",
      inputTokenBound: 10,
      maxOutputTokens: 5,
    });
    const settlement = {
      reservationId: reservation.reservationId,
      runId,
      sourceId: claim.sourceId,
      unitId: claim.id,
      claimToken: claim.claimToken,
      provider: "synthetic",
      model: "synthetic-model",
      callId: "untrusted-provider-call-id",
      usage: {
        type: "usage" as const,
        provider: "synthetic",
        model: "synthetic-model",
        callId: "untrusted-provider-call-id",
        operationKind: "company_import" as const,
        inputTokens: 3,
        outputTokens: 2,
      },
    };
    const settled = await Promise.all([
      settleCompanyImportCall(prisma, actor, settlement),
      settleCompanyImportCall(prisma, actor, settlement),
    ]);
    expect(settled.sort()).toEqual([false, true]);
    const run = await prisma.companyImportRun.findUniqueOrThrow({ where: { id: runId } });
    const source = await prisma.companyImportSource.findUniqueOrThrow({
      where: { id: claim.sourceId },
    });
    const unit = await prisma.companyImportUnit.findUniqueOrThrow({ where: { id: claim.id } });
    expect(run.reservedTokens).toBe(0n);
    expect(run.inputTokensUsed).toBe(3n);
    expect(run.outputTokensUsed).toBe(2n);
    expect(source.tokensReserved).toBe(0n);
    expect(source.inputTokensUsed).toBe(3n);
    expect(unit.tokensReserved).toBe(0n);
    expect(unit.outputTokensUsed).toBe(2n);
    const usage = await prisma.usageRecord.findFirstOrThrow({
      where: { callId: reservation.reservationId },
    });
    expect(usage.callId).toBe(reservation.reservationId);
    expect(usage.operationId).toBe(
      `${runId}:${claim.sourceId}:${claim.id}:${reservation.reservationId}`,
    );

    const late = await reserveCompanyImportCall(prisma, actor, {
      runId,
      sourceId: claim.sourceId,
      unitId: claim.id,
      claimToken: claim.claimToken,
      recipientKey: "synthetic-recipient",
      disclosureVersion: "2026-01",
      callId: "another-untrusted-call-id",
      inputTokenBound: 4,
      maxOutputTokens: 4,
    });
    await updateCompanyImportRun(prisma, actor, { runId, action: "cancel" });
    await expect(
      settleCompanyImportCall(prisma, actor, {
        ...settlement,
        reservationId: late.reservationId,
        usage: { ...settlement.usage, inputTokens: 5, outputTokens: 1 },
      }),
    ).resolves.toBe(false);
    const cancelledRun = await prisma.companyImportRun.findUniqueOrThrow({ where: { id: runId } });
    expect(cancelledRun.status).toBe("cancelled");
    expect(cancelledRun.reservedTokens).toBe(0n);
    expect(cancelledRun.inputTokensUsed).toBe(8n);
    expect(cancelledRun.outputTokensUsed).toBe(3n);
  });

  it("releases a pre-invocation reservation once without usage", async () => {
    const { runId, claims } = await runWithSources(100);
    const claim = claims[0]!;
    const reservation = await reserveCompanyImportCall(prisma, actor, {
      runId,
      sourceId: claim.sourceId,
      unitId: claim.id,
      claimToken: claim.claimToken,
      recipientKey: "synthetic-recipient",
      disclosureVersion: "2026-01",
      callId: "synthetic-call",
      inputTokenBound: 4,
      maxOutputTokens: 3,
    });
    const release = {
      reservationId: reservation.reservationId,
      runId,
      sourceId: claim.sourceId,
      unitId: claim.id,
      claimToken: claim.claimToken,
    };

    await expect(
      releaseCompanyImportCall(prisma, actor, { ...release, unitId: "wrong-unit" }),
    ).resolves.toBe(false);
    await expect(releaseCompanyImportCall(prisma, actor, release)).resolves.toBe(true);
    await expect(releaseCompanyImportCall(prisma, actor, release)).resolves.toBe(false);

    const run = await prisma.companyImportRun.findUniqueOrThrow({ where: { id: runId } });
    const source = await prisma.companyImportSource.findUniqueOrThrow({
      where: { id: claim.sourceId },
    });
    const unit = await prisma.companyImportUnit.findUniqueOrThrow({ where: { id: claim.id } });
    const call = await prisma.companyImportCall.findUniqueOrThrow({
      where: { reservationId: reservation.reservationId },
    });
    expect(run.reservedTokens).toBe(0n);
    expect(source.tokensReserved).toBe(0n);
    expect(unit.tokensReserved).toBe(0n);
    expect(call.status).toBe("released");
    expect(await prisma.usageRecord.count({ where: { callId: reservation.reservationId } })).toBe(
      0,
    );
  });

  it("records known over-bound usage and pauses the run instead of dropping billing", async () => {
    const { runId, claims } = await runWithSources(100);
    const claim = claims[0]!;
    const reservation = await reserveCompanyImportCall(prisma, actor, {
      runId,
      sourceId: claim.sourceId,
      unitId: claim.id,
      claimToken: claim.claimToken,
      recipientKey: "synthetic-recipient",
      disclosureVersion: "2026-01",
      callId: "provider-call",
      inputTokenBound: 2,
      maxOutputTokens: 2,
    });
    await expect(
      settleCompanyImportCall(prisma, actor, {
        reservationId: reservation.reservationId,
        runId,
        sourceId: claim.sourceId,
        unitId: claim.id,
        claimToken: claim.claimToken,
        provider: "synthetic",
        model: "synthetic-model",
        callId: "provider-call",
        usage: {
          provider: "synthetic",
          model: "synthetic-model",
          callId: "provider-call",
          operationKind: "company_import",
          inputTokens: 3,
          outputTokens: 1,
        } as AgentUsage,
      }),
    ).resolves.toBe(false);
    const run = await prisma.companyImportRun.findUniqueOrThrow({ where: { id: runId } });
    expect(run.status).toBe("budget_reached");
    expect(run.reservedTokens).toBe(0n);
    expect(run.inputTokensUsed).toBe(3n);
    expect(await prisma.usageRecord.count({ where: { callId: reservation.reservationId } })).toBe(
      1,
    );
  });

  it("finalizes a run when its final claim expires at the attempt limit", async () => {
    const { runId, claims } = await runWithSources(100);
    const claim = claims[0]!;
    await prisma.companyImportUnit.update({
      where: { id: claim.id },
      data: { attempts: 3, claimExpiresAt: new Date(Date.now() - 1_000) },
    });
    await expect(
      claimCompanyImportUnit(prisma, actor, { runId, unitId: claim.id }),
    ).resolves.toBeNull();
    expect((await getCompanyImportProgress(prisma, actor, runId)).status).toBe("failed");
  });

  it("requires retry_failed for partial runs and completes the retried unit", async () => {
    const { runId, claims } = await runWithSources(100, 2);
    const done = claims[0]!;
    const failed = claims[1]!;
    await completeCompanyImportUnit(prisma, actor, {
      runId,
      sourceId: done.sourceId,
      unitId: done.id,
      claimToken: done.claimToken,
      nextCursor: null,
      done: true,
      itemsDiscovered: 0,
      itemsRead: 0,
      facts: [],
    });
    await prisma.companyImportUnit.update({
      where: { id: failed.id },
      data: { attempts: 3 },
    });
    await failCompanyImportUnit(prisma, actor, {
      runId,
      sourceId: failed.sourceId,
      unitId: failed.id,
      claimToken: failed.claimToken,
      errorCode: "synthetic_failure",
    });

    expect((await getCompanyImportProgress(prisma, actor, runId)).status).toBe("partial");
    await expect(
      updateCompanyImportRun(prisma, actor, { runId, action: "resume" }),
    ).rejects.toMatchObject({ code: "invalid_state" });
    expect((await getCompanyImportProgress(prisma, actor, runId)).status).toBe("partial");
    await updateCompanyImportRun(prisma, actor, { runId, action: "retry_failed" });
    const retried = await prisma.companyImportUnit.findUniqueOrThrow({ where: { id: failed.id } });
    expect(retried).toMatchObject({ status: "waiting", attempts: 0, lastError: null });
    const claim = await claimCompanyImportUnit(prisma, actor, { runId, unitId: failed.id });
    expect(claim).not.toBeNull();
    await completeCompanyImportUnit(prisma, actor, {
      runId,
      sourceId: failed.sourceId,
      unitId: failed.id,
      claimToken: claim!.claimToken,
      nextCursor: null,
      done: true,
      itemsDiscovered: 0,
      itemsRead: 0,
      facts: [],
    });
    expect((await getCompanyImportProgress(prisma, actor, runId)).status).toBe("completed");
  });

  it("allows a claimed unit to finish after the run is paused", async () => {
    const { runId, claims } = await runWithSources(100);
    const claim = claims[0]!;
    await updateCompanyImportRun(prisma, actor, { runId, action: "pause" });
    await completeCompanyImportUnit(prisma, actor, {
      runId,
      sourceId: claim.sourceId,
      unitId: claim.id,
      claimToken: claim.claimToken,
      nextCursor: null,
      done: true,
      itemsDiscovered: 0,
      itemsRead: 0,
      facts: [],
    });
    expect((await getCompanyImportProgress(prisma, actor, runId)).status).toBe("completed");
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
        sourceKind: "slack" as const,
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
        where: {
          factId: firstEvidence!.factId,
          factKind: "entity",
          sourceKind: "manual",
          extractorRunId: null,
        },
      }),
    ).toBeGreaterThan(0);
  });

  it("retains shared evidence until every observing run is discarded", async () => {
    const fact = {
      entity: {
        kind: "person" as const,
        displayName: "Synthetic shared import person",
        attrs: { workEmails: ["shared-import@example.test"] },
        confidence: 0.8,
      },
      evidence: {
        stance: "supports" as const,
        sourceKind: "slack" as const,
        sourceItemId: "shared-synthetic-item",
        quote: "Shared synthetic source quote.",
        contentHash: "shared-synthetic-hash",
        extractedAt: "2026-01-02T03:04:05.000Z",
        extractorModel: null,
        confidence: 0.8,
      },
    };
    const importFact = async () => {
      const run = await runWithSources(100);
      const claim = run.claims[0]!;
      await completeCompanyImportUnit(prisma, actor, {
        runId: run.runId,
        sourceId: claim.sourceId,
        unitId: claim.id,
        claimToken: claim.claimToken,
        nextCursor: null,
        done: true,
        itemsDiscovered: 1,
        itemsRead: 1,
        facts: [{ kind: "entity", input: fact }],
      });
      return run.runId;
    };

    const firstRunId = await importFact();
    const secondRunId = await importFact();
    const evidence = await prisma.companyEvidence.findFirstOrThrow({
      where: { spaceId, ownerUserId: userId, extractorRunId: firstRunId },
      select: { id: true, factId: true },
    });
    expect(
      await prisma.companyEvidence.count({
        where: { spaceId, ownerUserId: userId, contentHash: "shared-synthetic-hash" },
      }),
    ).toBe(1);
    expect(await prisma.companyImportEvidence.count({ where: { evidenceId: evidence.id } })).toBe(
      2,
    );

    await updateCompanyImportRun(prisma, actor, { runId: firstRunId, action: "discard" });
    expect(await prisma.companyEvidence.count({ where: { id: evidence.id } })).toBe(1);
    expect(
      await prisma.companyImportEvidence.count({
        where: { evidenceId: evidence.id, runId: secondRunId },
      }),
    ).toBe(1);
    expect(await prisma.companyIdentity.count({ where: { entityId: evidence.factId } })).toBe(1);

    await updateCompanyImportRun(prisma, actor, { runId: secondRunId, action: "discard" });
    expect(await prisma.companyEvidence.count({ where: { id: evidence.id } })).toBe(0);
    expect(await prisma.companyEntity.count({ where: { id: evidence.factId } })).toBe(0);
    expect(await prisma.companyIdentity.count({ where: { entityId: evidence.factId } })).toBe(0);
  });
});
