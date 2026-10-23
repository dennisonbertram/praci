import { createHash } from "node:crypto";
import type {
  CompanyImportWorkerContext,
  ConnectorProxyRequest,
  JobPublisher,
  ManagedConnectorProvider,
  RealtimeFanout,
} from "@rakazo/adapter-kit";
import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { companyForActor, createDb } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCompanyImportEngine } from "./company-import-engine.js";
import { createCompanySourceWorker } from "./company-import-sources.js";
import type { EmulatedMessage } from "./gmail-api-emulator.js";
import { GmailApiEmulator } from "./gmail-api-emulator.js";
import { createMailProvider } from "./gmail-mail-provider.js";
import type { CompanyCompletion, CompanyCompletionRequest } from "./llm-company-extractor.js";
import { LlmCompanyExtractor } from "./llm-company-extractor.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

const content =
  "Avery Chen works at Northwind Robotics. Avery's work email is avery@northwind.example. Northwind Robotics raised a seed round in 2024.";
const extraction = {
  entities: [
    {
      ref: "avery",
      entity: {
        kind: "person" as const,
        displayName: "Avery Chen",
        attrs: { workEmails: ["avery@northwind.example"] },
        confidence: 0.94,
      },
      quote: "Avery Chen works at Northwind Robotics.",
    },
    {
      ref: "northwind",
      entity: {
        kind: "organisation" as const,
        displayName: "Northwind Robotics",
        attrs: { domain: "northwind.example" },
        confidence: 0.94,
      },
      quote: "Northwind Robotics raised a seed round in 2024.",
    },
  ],
  edges: [
    {
      fromRef: "avery",
      toRef: "northwind",
      relation: "works_at" as const,
      startsOn: null,
      endsOn: null,
      role: "CTO",
      confidence: 0.91,
      quote: "Avery Chen works at Northwind Robotics.",
    },
  ],
  events: [
    {
      stream: "funding" as const,
      kind: "funding_round" as const,
      title: "Northwind Robotics seed round",
      occursOn: { date: "2024-01-01", precision: "year" as const },
      endsOn: null,
      entityRefs: ["northwind"],
      confidence: 0.9,
      quote: "Northwind Robotics raised a seed round in 2024.",
    },
  ],
};

const message = (id: string): EmulatedMessage => ({
  id,
  date: "2026-01-04T12:00:00.000Z",
  labels: ["INBOX", "CATEGORY_PERSONAL"],
  from: "Avery Chen <avery@northwind.example>",
  to: "owner@example.test",
  subject: "Northwind update",
  snippet: "Northwind update",
  text: content,
});

describePostgres("company source pipeline (PostgreSQL + Gmail emulator)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `company-source-org-${suffix}`;
  const spaceId = `company-source-space-${suffix}`;
  const userId = `company-source-user-${suffix}`;
  const otherUserId = `company-source-other-user-${suffix}`;
  const itemId = `company-source-item-${suffix}`;
  const actor: Actor = {
    spaceId,
    userId,
    email: "owner@example.test",
    isDeploymentOwner: true,
  };
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let connectionId: string;
  let gmail: GmailApiEmulator;
  let completionCalls = 0;

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
    await prisma.user.create({
      data: { id: otherUserId, name: otherUserId, email: `${otherUserId}@example.test` },
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
        id: `company-source-member-${suffix}`,
        organizationId,
        userId,
        role: "owner",
        createdAt: new Date(),
      },
    });
    await prisma.member.create({
      data: {
        id: `company-source-member-other-${suffix}`,
        organizationId,
        userId: otherUserId,
        role: "member",
        createdAt: new Date(),
      },
    });
    await prisma.spaceMember.create({
      data: {
        id: `company-source-space-member-${suffix}`,
        spaceId,
        organizationId,
        userId,
        role: "owner",
        createdAt: new Date(),
      },
    });
    await prisma.spaceMember.create({
      data: {
        id: `company-source-space-member-other-${suffix}`,
        spaceId,
        organizationId,
        userId: otherUserId,
        role: "member",
        createdAt: new Date(),
      },
    });
    const item = await prisma.dataRoomItem.create({
      data: {
        id: itemId,
        spaceId,
        userId,
        source: "upload",
        sha256: createHash("sha256").update(content).digest("hex"),
        name: "northwind-brief.txt",
        mimeType: "text/plain",
        size: BigInt(Buffer.byteLength(content)),
        status: "ready",
      },
    });
    await prisma.dataRoomItemText.create({
      data: { itemId: item.id, spaceId, userId, text: content },
    });
    connectionId = (
      await prisma.connection.create({
        data: {
          spaceId,
          userId,
          connectorId: "emulator",
          provider: "gmail",
          displayName: "Synthetic mailbox",
          status: "connected",
          providerRef: "mailbox-1",
          metadata: { mailAddress: "owner@example.test" },
        },
      })
    ).id;
    gmail = new GmailApiEmulator({
      now: new Date("2026-01-05T12:00:00.000Z"),
      mailboxes: { "mailbox-1": { address: "owner@example.test", messages: [message("gmail-1")] } },
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await close();
  });

  async function createEngine() {
    const connector = {
      proxy: async (request: ConnectorProxyRequest) =>
        gmail.handle(request.accountRef, request.url, request.method, request.body),
    } as unknown as ManagedConnectorProvider;
    const mail = createMailProvider({
      prisma,
      connectors: { managed: () => connector },
      sleep: async () => undefined,
      random: () => 0,
    });
    const completion: CompanyCompletion = async (request: CompanyCompletionRequest, model) => {
      completionCalls++;
      if (request.instructions.startsWith("Classify")) {
        return {
          text: JSON.stringify({ relevant: true }),
          valid: true,
          provider: model.provider,
          model: model.id,
          usage: { inputTokens: 10, outputTokens: 2 },
        };
      }
      return {
        text: JSON.stringify(extraction),
        valid: true,
        provider: model.provider,
        model: model.id,
        usage: { inputTokens: 100, outputTokens: 80 },
      };
    };
    const worker = createCompanySourceWorker({
      prisma,
      mail,
      extractor: new LlmCompanyExtractor(completion),
    });
    const jobs: JobPublisher = {
      enqueue: async () => undefined,
      cancel: async () => undefined,
      close: async () => undefined,
    };
    const realtime = { publish: async () => undefined } as unknown as RealtimeFanout;
    return createCompanyImportEngine({
      prisma,
      jobs,
      realtime,
      resolveModel: async () => ({ provider: "synthetic", id: "synthetic-model" }),
      worker,
    });
  }

  async function runToCompletion(engine: Awaited<ReturnType<typeof createEngine>>, runId: string) {
    const payload = { spaceId, userId, runId };
    await engine.start(actor, runId);
    let lastProgress: unknown;
    for (let step = 0; step < 30; step++) {
      await engine.runJob(payload);
      const waiting = await prisma.companyImportUnit.findMany({
        where: { runId, spaceId, ownerUserId: userId, status: "waiting" },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      for (const unit of waiting) await engine.unitJob({ ...payload, unitId: unit.id });
      const progress = await engine.progress(actor, runId);
      lastProgress = progress;
      if (["completed", "failed", "cancelled", "discarded"].includes(progress.status))
        return progress;
    }
    const errors = await prisma.companyImportUnit.findMany({
      where: { runId },
      select: { id: true, status: true, lastError: true },
    });
    throw new Error(
      `Synthetic company source run did not reach a terminal state: ${JSON.stringify({ lastProgress, errors })}`,
    );
  }

  async function grantAll(engine: Awaited<ReturnType<typeof createEngine>>, runId: string) {
    const sources = await prisma.companyImportSource.findMany({
      where: { runId, spaceId, ownerUserId: userId },
      orderBy: { createdAt: "asc" },
    });
    for (const source of sources) {
      const status = await engine.consentStatus(actor, runId, source.id);
      await engine.grantConsent(actor, {
        runId,
        sourceId: source.id,
        consentKey: status.consentKey!,
        version: status.version,
        sourceKind: status.sourceKind,
        recipient: status.recipient!,
      });
    }
  }

  it("runs real Data Room and Gmail sources, persists facts, and reuses unchanged evidence", async () => {
    const engine = await createEngine();
    const created = await engine.create(actor, {
      tokenCap: 1_000_000,
      sources: [
        { sourceKind: "data_room", scope: { itemIds: [itemId] } },
        { sourceKind: "gmail", connectionId, scope: { allTime: true, labelIds: ["INBOX"] } },
      ],
    });
    await grantAll(engine, created.runId);
    const first = await runToCompletion(engine, created.runId);
    expect(first.status).toBe("completed");
    expect(first.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceKind: "data_room", itemsDiscovered: 1, itemsRead: 1 }),
        expect.objectContaining({ sourceKind: "gmail", itemsDiscovered: 1, itemsRead: 1 }),
      ]),
    );
    const firstEvidence = await prisma.companyEvidence.findMany({
      where: { extractorRunId: created.runId },
      select: {
        id: true,
        factId: true,
        factKind: true,
        sourceKind: true,
        connectionId: true,
        extractorRunId: true,
        spaceId: true,
        ownerUserId: true,
      },
    });
    expect(firstEvidence).toHaveLength(8);
    expect(
      firstEvidence.every(
        (row) =>
          row.spaceId === spaceId &&
          row.ownerUserId === userId &&
          row.extractorRunId === created.runId,
      ),
    ).toBe(true);
    expect(new Set(firstEvidence.map((row) => row.sourceKind))).toEqual(
      new Set(["data_room", "gmail"]),
    );
    expect(
      firstEvidence.every((row) =>
        row.sourceKind === "data_room"
          ? row.connectionId === null
          : row.connectionId === connectionId,
      ),
    ).toBe(true);
    expect(await prisma.companyEntity.count({ where: { spaceId, ownerUserId: userId } })).toBe(2);
    expect(await prisma.companyEdge.count({ where: { spaceId, ownerUserId: userId } })).toBe(1);
    expect(await prisma.companyEvent.count({ where: { spaceId, ownerUserId: userId } })).toBe(1);
    const firstObservations = await prisma.companyImportEvidence.findMany({
      where: { runId: created.runId },
      select: { evidenceId: true, spaceId: true, ownerUserId: true },
    });
    expect(firstObservations).toHaveLength(firstEvidence.length);
    expect(
      firstObservations.every((row) => row.spaceId === spaceId && row.ownerUserId === userId),
    ).toBe(true);
    expect(new Set(firstObservations.map((row) => row.evidenceId))).toEqual(
      new Set(firstEvidence.map((row) => row.id)),
    );
    expect(await prisma.cachedMailMessage.count({ where: { spaceId, userId, connectionId } })).toBe(
      0,
    );
    expect(gmail.requests.every((request) => request.method === "GET")).toBe(true);
    const query = gmail.requests.find((request) => request.url.includes("/messages?"));
    expect(query).toBeDefined();
    expect(new URL(query!.url).searchParams.getAll("labelIds")).toEqual(["INBOX"]);
    const firstPersonEvidence = firstEvidence.find((row) => row.factKind === "entity")!;
    expect(
      await companyForActor(prisma, {
        ...actor,
        userId: otherUserId,
        email: `${otherUserId}@example.test`,
      }).detail(firstPersonEvidence.factId),
    ).toBeNull();
    const dataRoomSource = await prisma.companyImportSource.findFirstOrThrow({
      where: { runId: created.runId, spaceId, ownerUserId: userId, sourceKind: "data_room" },
      select: { id: true },
    });
    const sourceWorker = createCompanySourceWorker({ prisma, extractor: {} as never });
    const foreignContext = {
      actor: { spaceId, userId: otherUserId },
      signal: AbortSignal.timeout(10_000),
      executeModelCall: async () => {
        throw new Error("Unexpected model execution");
      },
    } as unknown as CompanyImportWorkerContext;
    await expect(
      sourceWorker.read(
        {
          source: {
            id: dataRoomSource.id,
            sourceKind: "data_room",
            connectionId: null,
            scope: { itemIds: [itemId] },
          },
          unitKey: `data_room:${itemId}`,
          cursor: { itemId },
          maxBytes: 1_000_000,
        },
        foreignContext,
      ),
    ).rejects.toThrow("source_item_unavailable");

    const secondCreated = await engine.create(actor, {
      tokenCap: 1_000_000,
      sources: [
        { sourceKind: "data_room", scope: { itemIds: [itemId] } },
        { sourceKind: "gmail", connectionId, scope: { allTime: true, labelIds: ["INBOX"] } },
      ],
    });
    await grantAll(engine, secondCreated.runId);
    const callsBeforeReplay = completionCalls;
    const second = await runToCompletion(engine, secondCreated.runId);
    expect(second.status).toBe("completed");
    expect(completionCalls).toBe(callsBeforeReplay);
    expect(await prisma.companyEvidence.count({ where: { spaceId, ownerUserId: userId } })).toBe(
      firstEvidence.length,
    );
    const secondObservations = await prisma.companyImportEvidence.findMany({
      where: { runId: secondCreated.runId },
      select: { evidenceId: true },
    });
    expect(secondObservations).toHaveLength(firstEvidence.length);
    expect(new Set(secondObservations.map((row) => row.evidenceId))).toEqual(
      new Set(firstEvidence.map((row) => row.id)),
    );

    await engine.action(actor, created.runId, "discard");
    expect(await prisma.companyImportEvidence.count({ where: { runId: created.runId } })).toBe(0);
    expect(
      await prisma.companyImportEvidence.count({ where: { runId: secondCreated.runId } }),
    ).toBe(firstEvidence.length);
    expect(await prisma.companyEntity.count({ where: { spaceId, ownerUserId: userId } })).toBe(2);
    expect(await prisma.companyEvidence.count({ where: { spaceId, ownerUserId: userId } })).toBe(8);
    await engine.action(actor, secondCreated.runId, "discard");
    expect(await prisma.companyEvidence.count({ where: { spaceId, ownerUserId: userId } })).toBe(0);
    expect(await prisma.companyEntity.count({ where: { spaceId, ownerUserId: userId } })).toBe(0);
    await expect(
      engine.progress({ ...actor, userId: "different-owner" }, created.runId),
    ).rejects.toThrow();
  });
});
