import type {
  CompanyImportDiscoveryPage,
  CompanyImportReadPage,
  CompanyImportWorker,
  JobPublisher,
  RealtimeFanout,
} from "@rakazo/adapter-kit";
import { createCompanyImportEngine } from "@rakazo/adapters";
import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { companyForActor, createDb } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCompanyImportPage } from "./company-import-page.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE === "1" && databaseUrl ? describe.sequential : describe.skip;

describePostgres("company import page (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `company-import-page-org-${suffix}`;
  const spaceId = `company-import-page-space-${suffix}`;
  const userId = `company-import-page-user-${suffix}`;
  const otherUserId = `company-import-page-other-user-${suffix}`;
  const actor = (id: string): Actor => ({
    spaceId,
    userId: id,
    email: `${id}@example.test`,
    isDeploymentOwner: false,
  });
  const owner = actor(userId);
  const otherOwner = actor(otherUserId);
  const ownFolderId = `company-import-page-folder-${suffix}`;
  const otherFolderId = `company-import-page-other-folder-${suffix}`;
  const availableItemId = `company-import-page-item-${suffix}`;
  const deniedItemId = `company-import-page-denied-item-${suffix}`;
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let page: ReturnType<typeof createCompanyImportPage>;

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
    await prisma.space.create({ data: { id: spaceId, organizationId, name: spaceId } });
    await prisma.member.createMany({
      data: [
        {
          id: `company-import-page-member-${suffix}`,
          organizationId,
          userId,
          role: "owner",
          createdAt,
        },
        {
          id: `company-import-page-other-member-${suffix}`,
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
          id: `company-import-page-sm-${suffix}`,
          spaceId,
          organizationId,
          userId,
          role: "owner",
          createdAt,
        },
        {
          id: `company-import-page-other-sm-${suffix}`,
          spaceId,
          organizationId,
          userId: otherUserId,
          role: "member",
          createdAt,
        },
      ],
    });
    await prisma.dataRoomFolder.createMany({
      data: [
        {
          id: ownFolderId,
          spaceId,
          userId,
          name: "Owner folder",
          createdBy: "user",
        },
        {
          id: otherFolderId,
          spaceId,
          userId: otherUserId,
          name: "Other owner folder",
          createdBy: "user",
        },
      ],
    });
    const deniedConnection = await prisma.connection.create({
      data: {
        id: `company-import-page-private-connection-${suffix}`,
        spaceId,
        userId,
        provider: "gmail",
        connectorId: "synthetic",
        displayName: "Private synthetic Gmail",
        status: "connected",
        providerRef: "synthetic-private-reference",
        allAgents: false,
        privateByDefault: true,
      },
    });
    await prisma.connection.create({
      data: {
        id: `company-import-page-unsupported-connection-${suffix}`,
        spaceId,
        userId,
        provider: "unknown-provider",
        connectorId: "synthetic",
        displayName: "Unsupported synthetic source",
        status: "connected",
      },
    });
    await prisma.dataRoomItem.createMany({
      data: [
        {
          id: availableItemId,
          spaceId,
          userId,
          folderId: ownFolderId,
          source: "upload",
          sha256: "available-item-hash",
          name: "Available synthetic item",
          mimeType: "text/plain",
          size: 10n,
          status: "ready",
        },
        {
          id: deniedItemId,
          spaceId,
          userId,
          folderId: ownFolderId,
          source: "gmail",
          sourceConnectionId: deniedConnection.id,
          sha256: "denied-item-hash",
          name: "Denied synthetic item",
          mimeType: "text/plain",
          size: 10n,
          status: "ready",
        },
      ],
    });
    const jobs = { enqueue: async () => undefined } as unknown as JobPublisher;
    const realtime = { publish: async () => undefined } as unknown as RealtimeFanout;
    const worker: CompanyImportWorker = {
      discover: async (): Promise<CompanyImportDiscoveryPage> => ({
        units: [],
        nextCursor: null,
        done: true,
      }),
      read: async (): Promise<CompanyImportReadPage> => ({
        items: [],
        facts: [],
        nextCursor: null,
        done: true,
      }),
    };
    const engine = createCompanyImportEngine({
      prisma,
      jobs,
      realtime,
      resolveModel: async () => ({ provider: "synthetic", id: "synthetic-model" }),
      worker,
    });
    page = createCompanyImportPage({ prisma, engine });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await close();
  });

  it("scopes the catalog, source plans, sessions, samples, and consent guards", async () => {
    const catalog = await page.catalog(owner);
    expect(catalog.folders).toEqual([{ id: ownFolderId, name: "Owner folder" }]);
    expect(catalog.sources[0]).toMatchObject({
      sourceKind: "data_room",
      available: true,
      itemCount: 1,
    });
    expect(catalog.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKind: "gmail",
          available: false,
          reason: "access_denied",
        }),
        expect.objectContaining({
          sourceKind: "composio",
          available: false,
          reason: "unsupported",
        }),
      ]),
    );
    expect(JSON.stringify(catalog)).not.toContain("synthetic-private-reference");
    const otherCatalog = await page.catalog(otherOwner);
    expect(otherCatalog.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "gmail:connect",
          reason: "not_connected",
          connectPath: "/app/integrations?connect=gmail&returnTo=%2Fapp%2Fcompany%2Fimport",
        }),
      ]),
    );
    expect(otherCatalog.folders).toEqual([{ id: otherFolderId, name: "Other owner folder" }]);

    await expect(
      page.create(owner, {
        mode: "sample",
        tokenCap: 200,
        sources: [{ sourceKind: "data_room", scope: { folderIds: [otherFolderId] } }],
      }),
    ).rejects.toThrow();
    const created = await page.create(owner, {
      mode: "sample",
      tokenCap: 200,
      sources: [{ sourceKind: "data_room", scope: { folderIds: [ownFolderId] } }],
    });
    const session = await page.session(owner, created.runId);
    expect(session).toMatchObject({
      mode: "sample",
      sources: [{ plan: { itemCount: 1, estimateBasis: "budget_cap" } }],
    });
    expect(await page.session(otherOwner, created.runId)).toBeNull();
    await expect(page.start(owner, created.runId)).rejects.toThrow("Consent is required");
    expect((await page.session(owner, created.runId))?.progress.status).toBe("draft");

    const entity = await companyForActor(prisma, owner).importEntity({
      entity: {
        kind: "person",
        displayName: "Synthetic sample person",
        attrs: { workEmails: ["sample@example.test"] },
        confidence: 0.9,
      },
      evidence: {
        stance: "supports",
        sourceKind: "data_room",
        sourceItemId: availableItemId,
        quote: "Synthetic sample quote.",
        contentHash: "available-item-hash",
        extractedAt: new Date().toISOString(),
        extractorModel: null,
        confidence: 0.9,
      },
    });
    if ("suppressed" in entity || "deferred" in entity) {
      throw new Error("Expected synthetic sample entity to be persisted");
    }
    const evidence = await prisma.companyEvidence.findFirstOrThrow({
      where: {
        spaceId,
        ownerUserId: userId,
        factKind: "entity",
        factId: entity.id,
        sourceItemId: availableItemId,
      },
      select: { id: true },
    });
    await prisma.companyEvidence.update({
      where: { id: evidence.id, spaceId, ownerUserId: userId },
      data: { extractorRunId: created.runId },
    });
    await prisma.companyImportEvidence.create({
      data: {
        runId: created.runId,
        evidenceId: evidence.id,
        spaceId,
        ownerUserId: userId,
      },
    });
    expect(await page.sample(owner, created.runId)).toEqual([
      {
        sourceId: session!.sources[0]!.id,
        items: [
          {
            sourceItemId: availableItemId,
            facts: [
              {
                kind: "entity",
                title: "Synthetic sample person",
                confidence: 0.9,
                quote: "Synthetic sample quote.",
              },
            ],
          },
        ],
      },
    ]);
    await expect(page.sample(otherOwner, created.runId)).rejects.toThrow();
  });
});
