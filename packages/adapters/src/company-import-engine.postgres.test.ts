import type {
  CompanyImportDiscoveryPage,
  CompanyImportReadPage,
  CompanyImportWorker,
  JobPublisher,
  RealtimeFanout,
} from "@rakazo/adapter-kit";
import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCompanyImportEngine } from "./company-import-engine.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("company import engine workflow (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `company-import-engine-org-${suffix}`;
  const spaceId = `company-import-engine-space-${suffix}`;
  const userId = `company-import-engine-user-${suffix}`;
  const actor: Actor = {
    spaceId,
    userId,
    email: "owner@example.test",
    isDeploymentOwner: true,
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
    await prisma.user.create({
      data: { id: userId, name: userId, email: `${userId}@example.test` },
    });
    await prisma.organization.create({
      data: {
        id: organizationId,
        name: organizationId,
        slug: organizationId,
        createdAt: new Date(),
      },
    });
    await prisma.space.create({ data: { id: spaceId, organizationId, name: spaceId } });
    await prisma.member.create({
      data: {
        id: `company-import-engine-member-${suffix}`,
        organizationId,
        userId,
        role: "owner",
        createdAt: new Date(),
      },
    });
    await prisma.spaceMember.create({
      data: {
        id: `company-import-engine-space-member-${suffix}`,
        spaceId,
        organizationId,
        userId,
        role: "owner",
        createdAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await close();
  });

  it("requires displayed consent, pauses at budget, and resumes only after cap raise and regrant", async () => {
    const jobs = { enqueue: async () => undefined } as unknown as JobPublisher;
    const realtime = { publish: async () => undefined } as unknown as RealtimeFanout;
    let modelCalls = 0;
    let modelId = "synthetic-model";
    const worker: CompanyImportWorker = {
      discover: async (): Promise<CompanyImportDiscoveryPage> => ({
        units: [{ unitKey: "read:synthetic", cursor: null }],
        nextCursor: null,
        done: true,
      }),
      read: async (_input, context): Promise<CompanyImportReadPage> => {
        await context.executeModelCall({
          inputTokenBound: 4,
          maxOutputTokens: 3,
          invoke: async (model, signal) => {
            expect(context.actor).toEqual({ spaceId, userId });
            expect(model.id).toBe("synthetic-model");
            expect(signal.aborted).toBe(false);
            modelCalls++;
            return {
              value: "synthetic result",
              provider: "synthetic",
              model: "synthetic-model",
              callId: `synthetic-provider-call-${modelCalls}`,
              usage: {
                type: "usage",
                provider: "synthetic",
                model: "synthetic-model",
                callId: `synthetic-provider-call-${modelCalls}`,
                operationKind: "company_import",
                inputTokens: 3,
                outputTokens: 2,
              },
            };
          },
        });
        return {
          items: [
            {
              sourceItemId: "synthetic-item",
              contentHash: "synthetic-hash",
              content: "Synthetic data.",
            },
          ],
          facts: [
            {
              kind: "entity",
              input: {
                entity: {
                  kind: "person",
                  displayName: "Synthetic imported person",
                  attrs: { workEmails: ["synthetic-imported@example.test"] },
                  confidence: 0.9,
                },
                evidence: {
                  stance: "supports",
                  sourceKind: "slack",
                  sourceItemId: "synthetic-item",
                  quote: "Synthetic source quote.",
                  contentHash: "synthetic-hash",
                  extractedAt: new Date().toISOString(),
                  extractorModel: null,
                  confidence: 0.9,
                },
              },
            },
          ],
          nextCursor: null,
          done: true,
        };
      },
    };
    const engine = createCompanyImportEngine({
      prisma,
      jobs,
      realtime,
      resolveModel: async () => ({ provider: "synthetic", id: modelId }),
      worker,
    });
    const created = await engine.create(actor, {
      tokenCap: 5,
      sources: [{ sourceKind: "slack", scope: {} }],
    });
    await prisma.companyImportRun.update({
      where: { id: created.runId },
      data: { disclosureVersion: "old-disclosure-version" },
    });
    const source = await prisma.companyImportSource.findFirstOrThrow({
      where: { runId: created.runId, spaceId, ownerUserId: userId },
    });

    const displayedConsent = await engine.consentStatus(actor, created.runId, source.id);
    expect(displayedConsent.allowed).toBe(false);
    expect(displayedConsent.recipient).not.toBeNull();
    const displayedGrant = {
      runId: created.runId,
      sourceId: source.id,
      consentKey: displayedConsent.consentKey!,
      version: displayedConsent.version,
      sourceKind: displayedConsent.sourceKind,
      recipient: displayedConsent.recipient!,
    };
    modelId = "changed-model";
    await expect(engine.grantConsent(actor, displayedGrant)).rejects.toMatchObject({
      code: "consent_changed",
    });
    modelId = "synthetic-model";
    await engine.grantConsent(actor, {
      ...displayedGrant,
    });
    expect((await engine.consentStatus(actor, created.runId, source.id)).allowed).toBe(true);
    expect((await engine.progress(actor, created.runId)).status).toBe("draft");

    await engine.start(actor, created.runId);
    const runPayload = { spaceId, userId, runId: created.runId };
    const runUnits = async () => {
      await engine.runJob(runPayload);
      return prisma.companyImportUnit.findMany({
        where: { runId: created.runId, spaceId, ownerUserId: userId, status: "waiting" },
      });
    };
    const discoveryUnit = (await runUnits()).find((unit) => unit.unitKey.startsWith("discover:"))!;
    await engine.unitJob({ ...runPayload, unitId: discoveryUnit.id });
    const readUnit = (
      await prisma.companyImportUnit.findMany({
        where: { runId: created.runId, spaceId, ownerUserId: userId, status: "waiting" },
      })
    ).find((unit) => unit.unitKey === "read:synthetic")!;

    await engine.unitJob({ ...runPayload, unitId: readUnit.id });
    expect((await engine.progress(actor, created.runId)).status).toBe("budget_reached");
    expect(modelCalls).toBe(0);
    await engine.action(actor, created.runId, "resume", 20);
    await prisma.aiDataConsent.deleteMany({ where: { userId, spaceId } });

    const consentWaitUnit = (await runUnits()).find((unit) => unit.id === readUnit.id)!;
    await engine.unitJob({ ...runPayload, unitId: consentWaitUnit.id });
    expect((await engine.progress(actor, created.runId)).status).toBe("awaiting_consent");
    const refreshedConsent = await engine.consentStatus(actor, created.runId, source.id);
    await engine.grantConsent(actor, {
      runId: created.runId,
      sourceId: source.id,
      consentKey: refreshedConsent.consentKey!,
      version: refreshedConsent.version,
      sourceKind: refreshedConsent.sourceKind,
      recipient: refreshedConsent.recipient!,
    });
    expect((await engine.progress(actor, created.runId)).status).toBe("running");

    const regrantedUnit = (await runUnits()).find((unit) => unit.id === readUnit.id)!;
    await engine.unitJob({ ...runPayload, unitId: regrantedUnit.id });
    const progress = await engine.progress(actor, created.runId);
    expect(progress.status).toBe("completed");
    expect(progress.sources[0]).toMatchObject({ itemsDiscovered: 1, itemsRead: 1 });
    expect(
      await prisma.companyEvidence.count({
        where: { spaceId, ownerUserId: userId, extractorRunId: created.runId },
      }),
    ).toBe(1);
    expect(progress.inputTokensUsed).toBe(3);
    expect(progress.outputTokensUsed).toBe(2);
    expect(modelCalls).toBe(1);
  });
});
