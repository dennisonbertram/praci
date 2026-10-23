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
  let slackConnectionId: string;

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
    slackConnectionId = (
      await prisma.connection.create({
        data: {
          spaceId,
          userId,
          connectorId: "synthetic",
          provider: "slack",
          displayName: "Synthetic Slack",
          status: "connected",
          providerRef: `synthetic-slack-${suffix}`,
          allAgents: true,
          privateByDefault: false,
        },
      })
    ).id;
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
                  connectionId: slackConnectionId,
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
      sources: [{ sourceKind: "slack", connectionId: slackConnectionId, scope: {} }],
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

  it("previews at most 25 sample items and continues the same run from its saved cursor", async () => {
    const jobs = { enqueue: async () => undefined } as unknown as JobPublisher;
    const realtime = { publish: async () => undefined } as unknown as RealtimeFanout;
    const readCounts = new Map<string, number>();
    const discoveryLimits: number[] = [];
    const worker: CompanyImportWorker = {
      discover: async ({ cursor, maxUnits }): Promise<CompanyImportDiscoveryPage> => {
        discoveryLimits.push(maxUnits);
        const start = Number((cursor as { offset?: number } | null)?.offset ?? 0);
        const end = Math.min(start + maxUnits, 30);
        return {
          units: Array.from({ length: end - start }, (_, index) => {
            const itemIndex = start + index;
            return { unitKey: `read:${itemIndex}`, cursor: { itemIndex } };
          }),
          nextCursor: end < 30 ? { offset: end } : null,
          done: end === 30,
        };
      },
      read: async ({ cursor, maxItems }): Promise<CompanyImportReadPage> => {
        const itemIndex = (cursor as { itemIndex: number }).itemIndex;
        expect(maxItems).toBe(itemIndex < 25 ? 1 : 100);
        const sourceItemId = `sample-item-${itemIndex}`;
        readCounts.set(sourceItemId, (readCounts.get(sourceItemId) ?? 0) + 1);
        return {
          items: [{ sourceItemId, contentHash: `hash-${itemIndex}`, content: "Synthetic item." }],
          facts: [],
          nextCursor: null,
          done: true,
        };
      },
    };
    const engine = createCompanyImportEngine({
      prisma,
      jobs,
      realtime,
      resolveModel: async () => ({ provider: "synthetic", id: "sample-model" }),
      worker,
    });
    const created = await engine.create(actor, {
      tokenCap: 2_500,
      mode: "sample",
      sources: [{ sourceKind: "slack", connectionId: slackConnectionId, scope: {} }],
    });
    const source = await prisma.companyImportSource.findFirstOrThrow({
      where: { runId: created.runId, spaceId, ownerUserId: userId },
    });
    const consent = await engine.consentStatus(actor, created.runId, source.id);
    await engine.grantConsent(actor, {
      runId: created.runId,
      sourceId: source.id,
      consentKey: consent.consentKey!,
      version: consent.version,
      sourceKind: consent.sourceKind,
      recipient: consent.recipient!,
    });

    const payload = { spaceId, userId, runId: created.runId };
    const processWaitingUnits = async () => {
      await engine.runJob(payload);
      const waiting = await prisma.companyImportUnit.findMany({
        where: { runId: created.runId, spaceId, ownerUserId: userId, status: "waiting" },
        orderBy: { unitKey: "asc" },
        select: { id: true },
      });
      for (const unit of waiting) await engine.unitJob({ ...payload, unitId: unit.id });
    };
    await engine.start(actor, created.runId);
    for (let step = 0; step < 10; step++) {
      await processWaitingUnits();
      if ((await engine.progress(actor, created.runId)).status === "preview_ready") break;
    }
    const preview = await engine.progress(actor, created.runId);
    expect(preview.status).toBe("preview_ready");
    expect(preview.sources[0]?.itemsRead).toBe(25);
    expect(discoveryLimits).toEqual([25]);
    expect(
      (
        await prisma.companyImportSource.findFirstOrThrow({
          where: { id: source.id, spaceId, ownerUserId: userId },
        })
      ).cursor,
    ).toEqual({ offset: 25 });

    await engine.action(actor, created.runId, "continue");
    for (let step = 0; step < 10; step++) {
      await processWaitingUnits();
      if ((await engine.progress(actor, created.runId)).status === "completed") break;
    }
    const completed = await engine.progress(actor, created.runId);
    const unitsAfterContinue = await prisma.companyImportUnit.findMany({
      where: { runId: created.runId, spaceId, ownerUserId: userId },
      select: { unitKey: true, status: true, lastError: true },
      orderBy: { unitKey: "asc" },
    });
    expect(completed.status, JSON.stringify(unitsAfterContinue)).toBe("completed");
    expect(completed.tokenCap).toBe(2_500);
    expect(completed.sources[0]?.itemsRead).toBe(30);
    expect(discoveryLimits).toEqual([25, 100]);
    expect([...readCounts.values()].every((count) => count === 1)).toBe(true);
    expect(readCounts.size).toBe(30);
  });

  it("rejects an oversized sample read before persisting any facts", async () => {
    const jobs = { enqueue: async () => undefined } as unknown as JobPublisher;
    const realtime = { publish: async () => undefined } as unknown as RealtimeFanout;
    const worker: CompanyImportWorker = {
      discover: async (): Promise<CompanyImportDiscoveryPage> => ({
        units: [{ unitKey: "read:oversized", cursor: null }],
        nextCursor: null,
        done: true,
      }),
      read: async (): Promise<CompanyImportReadPage> => ({
        items: [
          { sourceItemId: "oversized-1", contentHash: "hash-1", content: "First item." },
          { sourceItemId: "oversized-2", contentHash: "hash-2", content: "Second item." },
        ],
        facts: [],
        nextCursor: null,
        done: true,
      }),
    };
    const engine = createCompanyImportEngine({
      prisma,
      jobs,
      realtime,
      resolveModel: async () => ({ provider: "synthetic", id: "sample-model" }),
      worker,
    });
    const created = await engine.create(actor, {
      tokenCap: 2_500,
      mode: "sample",
      sources: [{ sourceKind: "slack", connectionId: slackConnectionId, scope: {} }],
    });
    const source = await prisma.companyImportSource.findFirstOrThrow({
      where: { runId: created.runId, spaceId, ownerUserId: userId },
    });
    const consent = await engine.consentStatus(actor, created.runId, source.id);
    await engine.grantConsent(actor, {
      runId: created.runId,
      sourceId: source.id,
      consentKey: consent.consentKey!,
      version: consent.version,
      sourceKind: consent.sourceKind,
      recipient: consent.recipient!,
    });
    await engine.start(actor, created.runId);
    const payload = { spaceId, userId, runId: created.runId };
    await engine.runJob(payload);
    const discovery = await prisma.companyImportUnit.findFirstOrThrow({
      where: { runId: created.runId, spaceId, ownerUserId: userId, unitKey: "discover:0" },
    });
    await engine.unitJob({ ...payload, unitId: discovery.id });
    const read = await prisma.companyImportUnit.findFirstOrThrow({
      where: { runId: created.runId, spaceId, ownerUserId: userId, unitKey: "read:oversized" },
    });
    await engine.unitJob({ ...payload, unitId: read.id });
    expect(
      await prisma.companyImportEvidence.count({
        where: { runId: created.runId, spaceId, ownerUserId: userId },
      }),
    ).toBe(0);
    expect((await engine.progress(actor, created.runId)).sources[0]?.itemsRead).toBe(0);
  });
});
