import { createHash } from "node:crypto";
import type {
  AdapterContext,
  CompanyConnectionReader,
  CompanyExtractor,
  CompanyImportWorkerContext,
  ConnectorCall,
  ConnectorProvider,
  ConnectorProxyRequest,
  ConnectorTool,
  JobPublisher,
  ManagedConnectorProvider,
  RealtimeFanout,
} from "@rakazo/adapter-kit";
import type { Actor } from "@rakazo/contracts";
import { companyImporterSpawnKey } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { companyForActor, createDb } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createCompanyConnectionReader } from "./company-connection-reader.js";
import { createCompanyDocumentReader } from "./company-document-source.js";
import { createCompanyImportEngine } from "./company-import-engine.js";
import { createCompanySourceWorker } from "./company-import-sources.js";
import { COMPANY_SLACK_READ_TOOLS, createCompanySlackReader } from "./company-slack-source.js";
import { createCompanyTrackerReader } from "./company-tracker-source.js";
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
  const deniedItemId = `company-source-denied-item-${suffix}`;
  const actor: Actor = {
    spaceId,
    userId,
    email: "owner@example.test",
    isDeploymentOwner: true,
  };
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let connectionId: string;
  let deniedConnectionId: string;
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
    deniedConnectionId = (
      await prisma.connection.create({
        data: {
          spaceId,
          userId,
          connectorId: "emulator",
          provider: "box",
          displayName: "Private synthetic file source",
          status: "connected",
          providerRef: "private-file-source",
          allAgents: false,
          privateByDefault: true,
        },
      })
    ).id;
    await prisma.dataRoomItem.create({
      data: {
        id: deniedItemId,
        spaceId,
        userId,
        source: "box",
        sourceConnectionId: deniedConnectionId,
        sha256: createHash("sha256").update("Private synthetic document.").digest("hex"),
        name: "private-file.txt",
        mimeType: "text/plain",
        size: BigInt(Buffer.byteLength("Private synthetic document.")),
        status: "ready",
      },
    });
    await prisma.dataRoomItemText.create({
      data: { itemId: deniedItemId, spaceId, userId, text: "Private synthetic document." },
    });
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

  async function runToCompletion(
    engine: Awaited<ReturnType<typeof createEngine>>,
    runId: string,
    advanceClock = false,
    alreadyStarted = false,
  ) {
    const payload = { spaceId, userId, runId };
    if (!alreadyStarted) await engine.start(actor, runId);
    let lastProgress: unknown;
    for (let step = 0; step < 30; step++) {
      await engine.runJob(payload);
      const waiting = await prisma.companyImportUnit.findMany({
        where: { runId, spaceId, ownerUserId: userId, status: "waiting" },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          availableAt: true,
          source: { select: { backoffUntil: true } },
        },
      });
      for (const unit of waiting) {
        const availableAt = Math.max(
          unit.availableAt.getTime(),
          unit.source.backoffUntil?.getTime() ?? 0,
        );
        if (advanceClock && availableAt > Date.now()) vi.setSystemTime(new Date(availableAt));
        await engine.unitJob({ ...payload, unitId: unit.id });
      }
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
    const entities = await prisma.companyEntity.findMany({
      where: { spaceId, ownerUserId: userId },
      select: { displayName: true },
    });
    expect(entities.map((entity) => entity.displayName)).toEqual(
      expect.arrayContaining(["Avery Chen", "Northwind Robotics"]),
    );
    expect(await prisma.companyEdge.count({ where: { spaceId, ownerUserId: userId } })).toBe(1);
    expect(await prisma.companyEvent.count({ where: { spaceId, ownerUserId: userId } })).toBe(1);
    const avery = await prisma.companyEntity.findFirstOrThrow({
      where: { spaceId, ownerUserId: userId, displayName: "Avery Chen" },
      select: { id: true, attrs: true },
    });
    expect(avery.attrs).toMatchObject({ workEmails: ["avery@northwind.example"] });
    expect(
      await prisma.companyEvidence.findMany({
        where: { spaceId, ownerUserId: userId, factKind: "entity", factId: avery.id },
        select: { sourceKind: true },
      }),
    ).toEqual(expect.arrayContaining([{ sourceKind: "data_room" }, { sourceKind: "gmail" }]));
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
    const ownerContext = {
      actor: { spaceId, userId },
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
            scope: { itemIds: [deniedItemId] },
          },
          unitKey: `data_room:${deniedItemId}`,
          cursor: { itemId: deniedItemId },
          maxBytes: 1_000_000,
        },
        ownerContext,
      ),
    ).rejects.toThrow("source_item_unavailable");
    const visibleDataRoom = await sourceWorker.discover(
      {
        source: {
          id: dataRoomSource.id,
          sourceKind: "data_room",
          connectionId: null,
          scope: {},
        },
        cursor: null,
        maxUnits: 100,
      },
      ownerContext,
    );
    expect(
      visibleDataRoom.units.some(
        (unit) => (unit.cursor as { itemId?: unknown } | null)?.itemId === deniedItemId,
      ),
    ).toBe(false);

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
    expect(await prisma.companyEntity.count({ where: { spaceId, ownerUserId: userId } })).toBe(
      entities.length,
    );
    await engine.action(actor, secondCreated.runId, "discard");
    expect(await prisma.companyEvidence.count({ where: { spaceId, ownerUserId: userId } })).toBe(0);
    expect(await prisma.companyEntity.count({ where: { spaceId, ownerUserId: userId } })).toBe(0);
    await expect(
      engine.progress({ ...actor, userId: "different-owner" }, created.runId),
    ).rejects.toThrow();
  });

  it("merges Slack and Gmail evidence for one owner person with source-specific provenance", async () => {
    const quote = "Morgan Vale joined Northwind Robotics on 2024-04-02.";
    const timestamp = "1712016000.000001";
    const gmailAccountRef = `morgan-mailbox-${suffix}`;
    const slackEmail = "morgan@northwind.example";
    const gmailEmulator = new GmailApiEmulator({
      now: new Date("2024-04-03T12:00:00.000Z"),
      mailboxes: {
        [gmailAccountRef]: {
          address: "owner@example.test",
          messages: [
            {
              id: "morgan-gmail-1",
              date: "2024-04-02T12:00:00.000Z",
              labels: ["INBOX"],
              from: `Morgan Vale <${slackEmail}>`,
              to: "owner@example.test",
              subject: "Northwind update",
              snippet: quote,
              text: `${quote}\nWork email: ${slackEmail}`,
            },
          ],
        },
      },
    });
    const gmailConnection = await prisma.connection.create({
      data: {
        spaceId,
        userId,
        connectorId: "emulator",
        provider: "gmail",
        displayName: "Synthetic Morgan mailbox",
        status: "connected",
        providerRef: gmailAccountRef,
        allAgents: true,
        privateByDefault: false,
      },
    });
    const slackConnection = await prisma.connection.create({
      data: {
        spaceId,
        userId,
        connectorId: "composio",
        provider: "slack",
        displayName: "Synthetic Slack",
        status: "connected",
        providerRef: "synthetic-slack-account",
        allAgents: true,
        privateByDefault: false,
      },
    });
    const argumentNames = [
      "types",
      "limit",
      "cursor",
      "channel",
      "oldest",
      "latest",
      "inclusive",
      "ts",
      "user",
    ];
    const slackTools: ConnectorTool[] = COMPANY_SLACK_READ_TOOLS.slice(0, 5).map((name) => ({
      name,
      description: name,
      inputSchema: {
        type: "object",
        properties: Object.fromEntries(argumentNames.map((key) => [key, {}])),
      },
      route: { connectorId: "composio", toolName: name },
    }));
    const slackCalls: string[] = [];
    const provider = {
      discoverTools: async (received: AdapterContext) => {
        expect(received.connectedAppAgentConnectionId).toBe(slackConnection.id);
        return slackTools;
      },
      async *execute(call: ConnectorCall) {
        const fresh = slackTools.find((tool) => tool.name === call.tool);
        if (
          !fresh ||
          fresh.readOnly === false ||
          (fresh.readOnly !== true && call.authorizeUnannotatedRead?.(fresh) !== true)
        ) {
          yield { type: "error" as const, message: "Company source authorization changed" };
          return;
        }
        const denied = await call.beforeDispatch?.();
        if (denied) {
          yield { type: "error" as const, message: denied };
          return;
        }
        slackCalls.push(call.tool);
        const data =
          call.tool === "SLACK_RETRIEVE_CONVERSATION_INFORMATION"
            ? { channel: { id: "CPUBLIC1", name: "general", is_channel: true, is_private: false } }
            : call.tool === "SLACK_FETCH_CONVERSATION_HISTORY"
              ? {
                  messages: [
                    {
                      ts: timestamp,
                      text: quote,
                      user: "USYNTHETIC1",
                      reply_count: 0,
                    },
                  ],
                }
              : {
                  user: {
                    id: "USYNTHETIC1",
                    profile: { real_name: "Morgan Vale", email: slackEmail },
                  },
                };
        yield { type: "result" as const, data };
      },
    } as unknown as ConnectorProvider;
    const reader = createCompanyConnectionReader({
      prisma,
      connectors: provider,
      mcp: {} as never,
    });
    const slack = createCompanySlackReader(reader);
    const mailConnector = {
      proxy: async (request: ConnectorProxyRequest) =>
        gmailEmulator.handle(request.accountRef, request.url, request.method, request.body),
    } as unknown as ManagedConnectorProvider;
    const mail = createMailProvider({
      prisma,
      connectors: { managed: () => mailConnector },
      sleep: async () => undefined,
      random: () => 0,
    });
    const extractor: CompanyExtractor = {
      relevant: async () => true,
      extract: async () => ({
        extraction: {
          entities: [
            {
              ref: "morgan",
              entity: {
                kind: "person",
                displayName: "Morgan Vale",
                attrs: { workEmails: [slackEmail] },
                confidence: 0.95,
              },
              quote,
            },
          ],
          edges: [],
          events: [],
        },
        model: { provider: "synthetic", model: "stub-extractor" },
      }),
    };
    const worker = createCompanySourceWorker({ prisma, mail, slack, extractor });
    const jobs: JobPublisher = {
      enqueue: async () => undefined,
      cancel: async () => undefined,
      close: async () => undefined,
    };
    const realtime = { publish: async () => undefined } as unknown as RealtimeFanout;
    const engine = createCompanyImportEngine({
      prisma,
      jobs,
      realtime,
      resolveModel: async () => ({ provider: "synthetic", id: "synthetic-model" }),
      worker,
    });
    const created = await engine.create(actor, {
      tokenCap: 1_000_000,
      sources: [
        {
          sourceKind: "gmail",
          connectionId: gmailConnection.id,
          scope: { allTime: true, labelIds: ["INBOX"] },
        },
        {
          sourceKind: "slack",
          connectionId: slackConnection.id,
          scope: { channelIds: ["CPUBLIC1"], allTime: true },
        },
      ],
    });
    await grantAll(engine, created.runId);
    vi.useFakeTimers({ toFake: ["Date"] });
    let progress: Awaited<ReturnType<typeof engine.progress>>;
    try {
      progress = await runToCompletion(engine, created.runId, true);
    } finally {
      vi.useRealTimers();
    }
    expect(progress.status).toBe("completed");

    const people = await prisma.companyEntity.findMany({
      where: { spaceId, ownerUserId: userId, kind: "person", displayName: "Morgan Vale" },
      select: { id: true, attrs: true },
    });
    expect(people).toHaveLength(1);
    expect(people[0]?.attrs).toMatchObject({ workEmails: [slackEmail] });
    const evidence = await prisma.companyEvidence.findMany({
      where: {
        spaceId,
        ownerUserId: userId,
        factKind: "entity",
        factId: people[0]!.id,
        extractorRunId: created.runId,
      },
      select: {
        sourceKind: true,
        connectionId: true,
        sourceItemId: true,
        sourceKey: true,
        contentHash: true,
        quote: true,
      },
    });
    const sourceRows = await prisma.companyImportSource.findMany({
      where: { runId: created.runId, spaceId, ownerUserId: userId },
      select: { sourceKind: true, connectionId: true, sourceKey: true },
    });
    const slackTitle = `Slack #general · ${new Date(Number(timestamp) * 1000).toISOString()}`;
    const slackText = [
      "Slack user: USYNTHETIC1",
      "Author: Morgan Vale",
      `Work email: ${slackEmail}`,
      quote,
    ].join("\n");
    const expectedHashes = {
      slack: createHash("sha256").update(`${slackTitle}\n${slackText}`).digest("hex"),
      gmail: createHash("sha256")
        .update(`Northwind update\n${quote}\nWork email: ${slackEmail}`)
        .digest("hex"),
    };
    expect(evidence).toHaveLength(2);
    expect(evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKind: "gmail",
          connectionId: gmailConnection.id,
          sourceItemId: "morgan-gmail-1",
          contentHash: expectedHashes.gmail,
          quote,
        }),
        expect.objectContaining({
          sourceKind: "slack",
          connectionId: slackConnection.id,
          sourceItemId: `CPUBLIC1:${timestamp}`,
          contentHash: expectedHashes.slack,
          quote,
        }),
      ]),
    );
    expect(sourceRows).toHaveLength(2);
    expect(sourceRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceKind: "gmail", connectionId: gmailConnection.id }),
        expect.objectContaining({ sourceKind: "slack", connectionId: slackConnection.id }),
      ]),
    );
    expect(
      await prisma.companyEntity.count({
        where: { spaceId, ownerUserId: otherUserId, kind: "person", displayName: "Morgan Vale" },
      }),
    ).toBe(0);
    expect(
      await prisma.companyEvidence.count({
        where: { spaceId, ownerUserId: otherUserId, factKind: "entity", factId: people[0]!.id },
      }),
    ).toBe(0);
    expect(slackCalls.length).toBeGreaterThan(0);
    expect(slackCalls.every((name) => COMPANY_SLACK_READ_TOOLS.includes(name as never))).toBe(true);
    expect(gmailEmulator.requests.every((request) => request.method === "GET")).toBe(true);
  });

  it("merges mail, GitHub, and Linear identities through the tracker source pipeline", async () => {
    const email = "morgan@northwind.example";
    const gmailAccountRef = `morgan-tracker-mailbox-${suffix}`;
    const gmailEmulator = new GmailApiEmulator({
      now: new Date("2026-04-03T12:00:00.000Z"),
      mailboxes: {
        [gmailAccountRef]: {
          address: "owner@example.test",
          messages: [
            {
              id: "tracker-mail-1",
              date: "2026-04-02T12:00:00.000Z",
              labels: ["INBOX"],
              from: `Morgan Vale <${email}>`,
              to: "owner@example.test",
              subject: "Morgan's work identity",
              snippet: `Work email: ${email}`,
              text: `Morgan Vale's Work email: ${email}. GitHub login: morgan.`,
            },
          ],
        },
      },
    });
    const gmailConnection = await prisma.connection.create({
      data: {
        spaceId,
        userId,
        connectorId: "emulator",
        provider: "gmail",
        displayName: "Synthetic tracker mailbox",
        status: "connected",
        providerRef: gmailAccountRef,
        allAgents: true,
        privateByDefault: false,
      },
    });
    const githubConnection = await prisma.connection.create({
      data: {
        spaceId,
        userId,
        connectorId: "composio",
        provider: "github",
        displayName: "Synthetic GitHub",
        status: "connected",
        providerRef: "synthetic-github-account",
        allAgents: true,
        privateByDefault: false,
      },
    });
    const mcpServer = await prisma.mcpServer.create({
      data: {
        spaceId,
        userId,
        slug: `linear-${suffix}`,
        name: "Synthetic Linear",
        transport: "http",
        endpoint: "https://linear.example.test/mcp",
      },
    });
    const importer = await prisma.bot.create({
      data: {
        spaceId,
        userId,
        name: "Company importer",
        color: "company",
        spawnKey: companyImporterSpawnKey(userId),
      },
    });
    await prisma.botMcpServer.create({
      data: { spaceId, botId: importer.id, serverId: mcpServer.id, userId },
    });
    const githubDefinitions: Record<string, string[]> = {
      GITHUB_LIST_ORGANIZATIONS_FOR_THE_AUTHENTICATED_USER: ["page", "per_page"],
      GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER: [
        "page",
        "per_page",
        "sort",
        "direction",
        "type",
      ],
      GITHUB_LIST_ORGANIZATION_MEMBERS: ["org", "page", "per_page"],
      GITHUB_GET_A_USER: ["username"],
      GITHUB_GET_A_REPOSITORY: ["owner", "repo"],
      GITHUB_LIST_MILESTONES: ["owner", "repo", "page", "per_page", "state"],
      GITHUB_LIST_REPOSITORY_ISSUES: [
        "owner",
        "repo",
        "page",
        "per_page",
        "state",
        "sort",
        "direction",
      ],
      GITHUB_LIST_ORGANIZATION_PROJECTS: ["org", "after", "per_page"],
    };
    const linearDefinitions: Record<string, string[]> = {
      list_users: ["limit", "cursor"],
      list_teams: ["limit", "cursor"],
      list_projects: ["limit", "cursor"],
      get_project: ["query"],
      list_issues: ["limit", "cursor"],
      get_issue: ["id"],
      list_milestones: ["project", "limit", "cursor"],
    };
    const makeTool = (name: string, args: string[], connectorId: "composio" | "mcp") => ({
      name,
      description: name === "list_milestones" ? "List all milestones in a Linear project." : name,
      readOnly: true,
      inputSchema: {
        type: "object",
        properties: Object.fromEntries(
          args.map((key) => [
            key,
            key === "per_page" || key === "limit"
              ? { type: "integer", minimum: 1, maximum: 100 }
              : key === "page"
                ? { type: "integer", minimum: 1 }
                : key === "after" && connectorId === "composio"
                  ? { type: "string" }
                  : key === "after" || key === "cursor"
                    ? { type: ["string", "null"] }
                    : { type: "string" },
          ]),
        ),
        required:
          connectorId === "composio"
            ? name === "GITHUB_LIST_ORGANIZATION_MEMBERS" ||
              name === "GITHUB_LIST_ORGANIZATION_PROJECTS"
              ? ["org"]
              : name === "GITHUB_GET_A_USER"
                ? ["username"]
                : name === "GITHUB_GET_A_REPOSITORY" ||
                    name === "GITHUB_LIST_MILESTONES" ||
                    name === "GITHUB_LIST_REPOSITORY_ISSUES"
                  ? ["owner", "repo"]
                  : []
            : name === "get_project" || name === "get_issue"
              ? [args[0]!]
              : name === "list_milestones"
                ? ["project"]
                : args,
      },
      route: { connectorId, toolName: name },
    });
    const githubTools = Object.entries(githubDefinitions).map(([name, args]) =>
      makeTool(name, args, "composio"),
    );
    const linearTools = Object.entries(linearDefinitions).map(([name, args]) =>
      makeTool(name, args, "mcp"),
    );
    const trackerCalls: string[] = [];
    let memberReadAttempts = 0;
    const genericReader: CompanyConnectionReader = {
      listTools: async (source) => (source.sourceKind === "mcp" ? linearTools : githubTools),
      callTool: async (source, name: string, _args: Record<string, unknown>) => {
        trackerCalls.push(`${source.sourceKind}:${name}`);
        if (name === "GITHUB_LIST_ORGANIZATIONS_FOR_THE_AUTHENTICATED_USER")
          return { organizations: [{ id: 501, login: "northwind" }], has_next: false };
        if (name === "GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER")
          return { repositories: [], has_next: false };
        if (name === "GITHUB_LIST_ORGANIZATION_MEMBERS") {
          memberReadAttempts++;
          if (memberReadAttempts === 1)
            throw Object.assign(new Error("HTTP 429 rate limit"), { status: 429 });
          return { members: [{ id: 77, login: "morgan" }], has_next: false };
        }
        if (name === "GITHUB_LIST_ORGANIZATION_PROJECTS")
          return {
            organization: {
              projectsV2: { nodes: [], pageInfo: { hasNextPage: false } },
            },
          };
        if (name === "GITHUB_GET_A_USER")
          return {
            user: {
              id: 77,
              login: "morgan",
              name: "Morgan Vale",
              email: "personal@example.test",
              bio: "private profile text",
              html_url: "https://github.example.test/morgan",
            },
          };
        if (name === "list_users")
          return {
            users: [{ id: "linear-user-1", name: "Morgan Vale", email }],
            pageInfo: { hasNextPage: false },
          };
        if (name === "list_teams" || name === "list_projects" || name === "list_issues")
          return { [name.slice(5)]: [], pageInfo: { hasNextPage: false } };
        throw new Error(`Unexpected tracker call: ${source.sourceKind}:${name}`);
      },
    };
    const tracker = createCompanyTrackerReader(genericReader);
    const mailConnector = {
      proxy: async (request: ConnectorProxyRequest) =>
        gmailEmulator.handle(request.accountRef, request.url, request.method, request.body),
    } as unknown as ManagedConnectorProvider;
    const mail = createMailProvider({
      prisma,
      connectors: { managed: () => mailConnector },
      sleep: async () => undefined,
      random: () => 0,
    });
    const extractedDocuments: string[] = [];
    const completion: CompanyCompletion = async (request, model) => {
      if (request.instructions.startsWith("Classify"))
        return {
          text: JSON.stringify({ relevant: true }),
          valid: true,
          provider: model.provider,
          model: model.id,
          usage: { inputTokens: 10, outputTokens: 2 },
        };
      const document = JSON.parse(request.prompt).untrustedSource as {
        title: string;
        text: string;
      };
      extractedDocuments.push(document.text);
      const emailSource = document.text.includes(`Work email: ${email}`);
      const githubSource = document.text.toLowerCase().includes("login: morgan");
      const linearSource = document.text.includes("User ID: linear-user-1");
      const attrs = {
        ...(emailSource ? { workEmails: [email] } : {}),
        ...(githubSource ? { githubLogin: "morgan" } : {}),
        ...(linearSource ? { linearId: "linear-user-1" } : {}),
      };
      const quote = document.text.includes("GitHub login: morgan")
        ? "GitHub login: morgan"
        : githubSource
          ? "Login: morgan"
          : `Work email: ${email}`;
      return {
        text: JSON.stringify({
          entities: [
            {
              ref: "morgan",
              entity: {
                kind: "person",
                displayName: "Morgan Vale",
                attrs,
                confidence: 0.95,
              },
              quote,
            },
          ],
          edges: [],
          events: [],
        }),
        valid: true,
        provider: model.provider,
        model: model.id,
        usage: { inputTokens: 100, outputTokens: 40 },
      };
    };
    const worker = createCompanySourceWorker({
      prisma,
      mail,
      extractor: new LlmCompanyExtractor(completion),
      tracker,
    });
    const jobs: JobPublisher = {
      enqueue: async () => undefined,
      cancel: async () => undefined,
      close: async () => undefined,
    };
    const engine = createCompanyImportEngine({
      prisma,
      jobs,
      realtime: { publish: async () => undefined } as unknown as RealtimeFanout,
      resolveModel: async () => ({ provider: "synthetic", id: "synthetic-model" }),
      worker,
    });
    const created = await engine.create(actor, {
      tokenCap: 1_000_000,
      sources: [
        { sourceKind: "gmail", connectionId: gmailConnection.id, scope: { allTime: true } },
        {
          sourceKind: "github",
          connectionId: githubConnection.id,
          scope: { reader: "github", allTime: true },
        },
        {
          sourceKind: "mcp",
          mcpServerId: mcpServer.id,
          scope: { reader: "linear", allTime: true },
        },
      ],
    });
    await grantAll(engine, created.runId);
    const payload = { spaceId, userId, runId: created.runId };
    vi.useFakeTimers({ toFake: ["Date"] });
    let progress: Awaited<ReturnType<typeof engine.progress>>;
    try {
      await engine.start(actor, created.runId);
      let rateLimitedUnitId: string | undefined;
      for (let step = 0; step < 10 && !rateLimitedUnitId; step++) {
        await engine.runJob(payload);
        const waiting = await prisma.companyImportUnit.findMany({
          where: { runId: created.runId, spaceId, ownerUserId: userId, status: "waiting" },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            availableAt: true,
            source: { select: { backoffUntil: true } },
          },
        });
        for (const unit of waiting) {
          const availableAt = Math.max(
            unit.availableAt.getTime(),
            unit.source.backoffUntil?.getTime() ?? 0,
          );
          if (availableAt > Date.now()) vi.setSystemTime(new Date(availableAt));
          await engine.unitJob({ ...payload, unitId: unit.id });
          const rateLimited = await prisma.companyImportUnit.findFirst({
            where: {
              id: unit.id,
              runId: created.runId,
              spaceId,
              ownerUserId: userId,
              status: "waiting",
              lastError: "source_rate_limited",
            },
            select: {
              id: true,
              availableAt: true,
              source: { select: { backoffUntil: true } },
            },
          });
          if (rateLimited) {
            rateLimitedUnitId = rateLimited.id;
            const now = Date.now();
            expect(rateLimited.availableAt.getTime() - now).toBeGreaterThanOrEqual(60_000);
            expect(rateLimited.source.backoffUntil!.getTime() - now).toBeGreaterThanOrEqual(60_000);
            const attemptsBeforeImmediateRetry = memberReadAttempts;
            await engine.unitJob({ ...payload, unitId: rateLimited.id });
            expect(memberReadAttempts).toBe(attemptsBeforeImmediateRetry);
            const retryAt = Math.max(
              rateLimited.availableAt.getTime(),
              rateLimited.source.backoffUntil!.getTime(),
            );
            vi.setSystemTime(new Date(retryAt));
            await engine.unitJob({ ...payload, unitId: rateLimited.id });
            expect(memberReadAttempts).toBe(attemptsBeforeImmediateRetry + 1);
            break;
          }
        }
      }
      expect(rateLimitedUnitId).toBeDefined();
      progress = await runToCompletion(engine, created.runId, true, true);
    } finally {
      vi.useRealTimers();
    }
    expect(progress.status).toBe("completed");

    const people = await prisma.companyEntity.findMany({
      where: { spaceId, ownerUserId: userId, kind: "person", displayName: "Morgan Vale" },
      select: { id: true, attrs: true },
    });
    expect(people).toHaveLength(1);
    const person = people[0]!;
    expect(person.attrs).toMatchObject({
      workEmails: [email],
      githubLogin: "morgan",
      linearId: "linear-user-1",
    });
    const evidence = await prisma.companyEvidence.findMany({
      where: { spaceId, ownerUserId: userId, factKind: "entity", factId: person.id },
      select: { sourceKind: true, sourceItemId: true },
    });
    expect(new Set(evidence.map((item) => item.sourceKind))).toEqual(
      new Set(["gmail", "github", "mcp"]),
    );
    expect(extractedDocuments).toHaveLength(3);
    expect(extractedDocuments.join("\n")).not.toContain("personal@example.test");
    expect(extractedDocuments.join("\n")).not.toContain("private profile text");
    expect(trackerCalls).toEqual(
      expect.arrayContaining([
        "github:GITHUB_LIST_ORGANIZATIONS_FOR_THE_AUTHENTICATED_USER",
        "github:GITHUB_LIST_ORGANIZATION_MEMBERS",
        "github:GITHUB_GET_A_USER",
        "mcp:list_users",
      ]),
    );
  });

  it("samples 25 real Data Room items then continues the same run without rereading them", async () => {
    const sampleItems = Array.from({ length: 30 }, (_, index) => {
      const id = `company-source-sample-${suffix}-${index.toString().padStart(2, "0")}`;
      const text = `Synthetic Data Room sample item ${index}. ${content}`;
      return {
        id,
        text,
        sha256: createHash("sha256").update(text).digest("hex"),
      };
    });
    await prisma.dataRoomItem.createMany({
      data: sampleItems.map((item) => ({
        id: item.id,
        spaceId,
        userId,
        source: "upload",
        sha256: item.sha256,
        name: `${item.id}.txt`,
        mimeType: "text/plain",
        size: BigInt(Buffer.byteLength(item.text)),
        status: "ready",
      })),
    });
    await prisma.dataRoomItemText.createMany({
      data: sampleItems.map((item) => ({
        itemId: item.id,
        spaceId,
        userId,
        text: item.text,
      })),
    });

    const engine = await createEngine();
    const before = completionCalls;
    const created = await engine.create(actor, {
      tokenCap: 1_000_000,
      mode: "sample",
      sources: [
        { sourceKind: "data_room", scope: { itemIds: sampleItems.map((item) => item.id) } },
      ],
    });
    await grantAll(engine, created.runId);
    const payload = { spaceId, userId, runId: created.runId };
    const processWaiting = async () => {
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
      await processWaiting();
      if ((await engine.progress(actor, created.runId)).status === "preview_ready") break;
    }
    const preview = await engine.progress(actor, created.runId);
    expect(preview.status).toBe("preview_ready");
    expect(preview.tokenCap).toBe(1_000_000);
    expect(preview.sources[0]?.itemsDiscovered).toBe(25);
    expect(preview.sources[0]?.itemsRead).toBe(25);
    expect(completionCalls - before).toBe(50);

    await engine.action(actor, created.runId, "continue");
    for (let step = 0; step < 10; step++) {
      await processWaiting();
      if ((await engine.progress(actor, created.runId)).status === "completed") break;
    }
    const completed = await engine.progress(actor, created.runId);
    expect(completed.status).toBe("completed");
    expect(completed.tokenCap).toBe(1_000_000);
    expect(completed.sources[0]?.itemsDiscovered).toBe(30);
    expect(completed.sources[0]?.itemsRead).toBe(30);
    expect(completionCalls - before).toBe(60);
  });

  it("persists Notion and selected generic documents through the scoped source worker", async () => {
    const notionConnection = await prisma.connection.create({
      data: {
        spaceId,
        userId,
        connectorId: "composio",
        provider: "notion",
        displayName: "Synthetic Notion",
        status: "connected",
        providerRef: "synthetic-notion-account",
        allAgents: true,
        privateByDefault: false,
      },
    });
    const genericConnection = await prisma.connection.create({
      data: {
        spaceId,
        userId,
        connectorId: "composio",
        provider: "acme_crm",
        displayName: "Synthetic CRM",
        status: "connected",
        providerRef: "synthetic-crm-account",
        allAgents: true,
        privateByDefault: false,
      },
    });
    const notionPageId = "11111111-1111-4111-8111-111111111111";
    const notionTools: ConnectorTool[] = [
      {
        name: "NOTION_SEARCH_NOTION_PAGE",
        description: "Search pages",
        inputSchema: {
          type: "object",
          properties: { filter_value: {}, page_size: {}, start_cursor: {} },
        },
        route: { connectorId: "composio", toolName: "NOTION_SEARCH_NOTION_PAGE" },
      },
      {
        name: "NOTION_RETRIEVE_PAGE",
        description: "Retrieve page metadata",
        inputSchema: {
          type: "object",
          properties: { page_id: {} },
          required: ["page_id"],
        },
        route: { connectorId: "composio", toolName: "NOTION_RETRIEVE_PAGE" },
      },
      {
        name: "NOTION_FETCH_BLOCK_CONTENTS",
        description: "Read page blocks",
        inputSchema: {
          type: "object",
          properties: { block_id: {}, page_size: {}, start_cursor: {} },
          required: ["block_id"],
        },
        route: { connectorId: "composio", toolName: "NOTION_FETCH_BLOCK_CONTENTS" },
      },
    ];
    const genericTool: ConnectorTool = {
      name: "ACME_LIST_RECORDS",
      description: "Read selected records",
      readOnly: true,
      inputSchema: { type: "object", properties: {} },
      route: { connectorId: "composio", toolName: "ACME_LIST_RECORDS" },
    };
    const calls: string[] = [];
    const documents = createCompanyDocumentReader({
      listTools: async (source: Parameters<CompanyConnectionReader["listTools"]>[0]) =>
        source.sourceKind === "notion" ? notionTools : [genericTool],
      callTool: async (
        _source: Parameters<CompanyConnectionReader["callTool"]>[0],
        name: Parameters<CompanyConnectionReader["callTool"]>[1],
        args: Parameters<CompanyConnectionReader["callTool"]>[2],
      ) => {
        calls.push(name);
        if (name === "NOTION_SEARCH_NOTION_PAGE")
          return { results: [{ id: notionPageId }], has_more: false };
        if (name === "NOTION_RETRIEVE_PAGE")
          return {
            id: args.page_id,
            properties: { Name: { type: "title", title: [{ plain_text: "Northwind Robotics" }] } },
          };
        if (name === "NOTION_FETCH_BLOCK_CONTENTS")
          return {
            results: [
              {
                id: "22222222-2222-4222-8222-222222222222",
                type: "paragraph",
                paragraph: { rich_text: [{ plain_text: content }] },
                has_children: false,
              },
            ],
            has_more: false,
          };
        return { records: [{ title: "Northwind Robotics", text: content }] };
      },
    } as unknown as CompanyConnectionReader);
    let extractionCalls = 0;
    const extractor: CompanyExtractor = {
      relevant: async ({ text }) => text.includes("Avery Chen"),
      extract: async (document) => {
        extractionCalls++;
        return {
          extraction: document.text.includes("Avery Chen")
            ? extraction
            : { entities: [], edges: [], events: [] },
          model: { provider: "synthetic", model: "stub-extractor" },
        };
      },
    };
    const worker = createCompanySourceWorker({ prisma, documents, extractor });
    const jobs: JobPublisher = {
      enqueue: async () => undefined,
      cancel: async () => undefined,
      close: async () => undefined,
    };
    const realtime = { publish: async () => undefined } as unknown as RealtimeFanout;
    const engine = createCompanyImportEngine({
      prisma,
      jobs,
      realtime,
      resolveModel: async () => ({ provider: "synthetic", id: "synthetic-model" }),
      worker,
    });
    const sources = [
      {
        sourceKind: "notion" as const,
        connectionId: notionConnection.id,
        scope: { reader: "notion" as const, allTime: true as const },
      },
      {
        sourceKind: "composio" as const,
        connectionId: genericConnection.id,
        scope: {
          reader: "generic" as const,
          tools: [{ name: "ACME_LIST_RECORDS", args: {} }],
        },
      },
    ];
    const first = await engine.create(actor, { tokenCap: 1_000_000, sources });
    await grantAll(engine, first.runId);
    const firstProgress = await runToCompletion(engine, first.runId);
    expect(firstProgress.status).toBe("completed");
    expect(firstProgress.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceKind: "notion", itemsDiscovered: 1, itemsRead: 2 }),
        expect.objectContaining({ sourceKind: "composio", itemsDiscovered: 1, itemsRead: 1 }),
      ]),
    );

    const evidence = await prisma.companyEvidence.findMany({
      where: { extractorRunId: first.runId, spaceId, ownerUserId: userId },
      select: { sourceKind: true, connectionId: true, factId: true, factKind: true },
    });
    expect(evidence).toHaveLength(8);
    expect(new Set(evidence.map((row) => row.sourceKind))).toEqual(new Set(["notion", "composio"]));
    expect(
      evidence.every((row) =>
        row.sourceKind === "notion"
          ? row.connectionId === notionConnection.id
          : row.connectionId === genericConnection.id,
      ),
    ).toBe(true);
    expect(await prisma.companyImportEvidence.count({ where: { runId: first.runId } })).toBe(8);
    expect(
      calls.every((name) =>
        [
          "NOTION_SEARCH_NOTION_PAGE",
          "NOTION_RETRIEVE_PAGE",
          "NOTION_FETCH_BLOCK_CONTENTS",
          "ACME_LIST_RECORDS",
        ].includes(name),
      ),
    ).toBe(true);
    expect(calls).not.toContain("ACME_CREATE_RECORD");
    expect(await prisma.companyEntity.count({ where: { spaceId, ownerUserId: userId } })).toBe(2);
    const firstPerson = evidence.find((row) => row.factKind === "entity")?.factId;
    expect(
      await companyForActor(prisma, {
        ...actor,
        userId: otherUserId,
        email: `${otherUserId}@example.test`,
      }).detail(firstPerson!),
    ).toBeNull();

    const second = await engine.create(actor, { tokenCap: 1_000_000, sources });
    await grantAll(engine, second.runId);
    const callsBeforeReplay = extractionCalls;
    expect((await runToCompletion(engine, second.runId)).status).toBe("completed");
    expect(extractionCalls).toBe(callsBeforeReplay);
    expect(await prisma.companyEvidence.count({ where: { spaceId, ownerUserId: userId } })).toBe(8);
    expect(await prisma.companyImportEvidence.count({ where: { runId: second.runId } })).toBe(8);
    await expect(engine.progress({ ...actor, userId: otherUserId }, first.runId)).rejects.toThrow();
  });

  it("samples and resumes paginated Notion and selected documents on the same run", async () => {
    const notionConnection = await prisma.connection.create({
      data: {
        spaceId,
        userId,
        connectorId: "composio",
        provider: "notion",
        displayName: "Synthetic Notion sample",
        status: "connected",
        providerRef: `synthetic-notion-sample-${suffix}`,
        allAgents: true,
        privateByDefault: false,
      },
    });
    const genericConnection = await prisma.connection.create({
      data: {
        spaceId,
        userId,
        connectorId: "composio",
        provider: "acme_crm",
        displayName: "Synthetic CRM sample",
        status: "connected",
        providerRef: `synthetic-crm-sample-${suffix}`,
        allAgents: true,
        privateByDefault: false,
      },
    });
    const pageId = "77777777-7777-4777-8777-777777777777";
    const blockIds = Array.from(
      { length: 30 },
      (_, index) => `70000000-0000-4000-8000-${index.toString().padStart(12, "0")}`,
    );
    const notionTools: ConnectorTool[] = [
      {
        name: "NOTION_SEARCH_NOTION_PAGE",
        description: "Search pages",
        inputSchema: {
          type: "object",
          properties: { filter_value: {}, page_size: {}, start_cursor: {} },
        },
        route: { connectorId: "composio", toolName: "NOTION_SEARCH_NOTION_PAGE" },
      },
      {
        name: "NOTION_RETRIEVE_PAGE",
        description: "Retrieve page metadata",
        inputSchema: {
          type: "object",
          properties: { page_id: {} },
          required: ["page_id"],
        },
        route: { connectorId: "composio", toolName: "NOTION_RETRIEVE_PAGE" },
      },
      {
        name: "NOTION_FETCH_BLOCK_CONTENTS",
        description: "Read page blocks",
        inputSchema: {
          type: "object",
          properties: { block_id: {}, page_size: {}, start_cursor: {} },
          required: ["block_id"],
        },
        route: { connectorId: "composio", toolName: "NOTION_FETCH_BLOCK_CONTENTS" },
      },
    ];
    const genericTool: ConnectorTool = {
      name: "ACME_LIST_RECORDS",
      description: "Read selected records",
      readOnly: true,
      inputSchema: { type: "object", properties: {} },
      route: { connectorId: "composio", toolName: "ACME_LIST_RECORDS" },
    };
    const calls: string[] = [];
    const documents = createCompanyDocumentReader({
      listTools: async (source: Parameters<CompanyConnectionReader["listTools"]>[0]) =>
        source.sourceKind === "notion" ? notionTools : [genericTool],
      callTool: async (
        _source: Parameters<CompanyConnectionReader["callTool"]>[0],
        name: Parameters<CompanyConnectionReader["callTool"]>[1],
        args: Parameters<CompanyConnectionReader["callTool"]>[2],
      ) => {
        calls.push(name);
        if (name === "NOTION_SEARCH_NOTION_PAGE")
          return { results: [{ id: pageId }], has_more: false };
        if (name === "NOTION_RETRIEVE_PAGE")
          return {
            id: args.page_id,
            properties: { Name: { type: "title", title: [{ plain_text: "Sample page" }] } },
          };
        if (name === "NOTION_FETCH_BLOCK_CONTENTS")
          return {
            results: blockIds.map((id) => ({
              id,
              type: "paragraph",
              paragraph: { rich_text: [{ plain_text: `Notion block ${id}` }] },
              has_children: false,
            })),
            has_more: false,
          };
        return {
          records: Array.from({ length: 30 }, (_, index) => ({
            id: `generic-record-${index}`,
            title: `Generic record ${index}`,
          })),
          has_more: false,
        };
      },
    } as unknown as CompanyConnectionReader);
    const extracted = new Map<string, number>();
    const extractor: CompanyExtractor = {
      relevant: async () => true,
      extract: async (document) => {
        const item = `${document.title}\n${document.text}`;
        extracted.set(item, (extracted.get(item) ?? 0) + 1);
        return {
          extraction: { entities: [], edges: [], events: [] },
          model: { provider: "synthetic", model: "stub-extractor" },
        };
      },
    };
    const worker = createCompanySourceWorker({ prisma, documents, extractor });
    const engine = createCompanyImportEngine({
      prisma,
      jobs: {
        enqueue: async () => undefined,
        cancel: async () => undefined,
        close: async () => undefined,
      },
      realtime: { publish: async () => undefined } as unknown as RealtimeFanout,
      resolveModel: async () => ({ provider: "synthetic", id: "synthetic-model" }),
      worker,
    });
    const created = await engine.create(actor, {
      tokenCap: 1_000_000,
      mode: "sample",
      sources: [
        {
          sourceKind: "notion",
          connectionId: notionConnection.id,
          scope: { reader: "notion", allTime: true },
        },
        {
          sourceKind: "composio",
          connectionId: genericConnection.id,
          scope: { reader: "generic", tools: [{ name: genericTool.name, args: {} }] },
        },
      ],
    });
    await grantAll(engine, created.runId);
    const payload = { spaceId, userId, runId: created.runId };
    const processWaiting = async () => {
      await engine.runJob(payload);
      const waiting = await prisma.companyImportUnit.findMany({
        where: { runId: created.runId, spaceId, ownerUserId: userId, status: "waiting" },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      for (const unit of waiting) await engine.unitJob({ ...payload, unitId: unit.id });
    };
    await engine.start(actor, created.runId);
    for (let step = 0; step < 5; step++) {
      await processWaiting();
      if ((await engine.progress(actor, created.runId)).status === "preview_ready") break;
    }
    const preview = await engine.progress(actor, created.runId);
    expect(preview.status).toBe("preview_ready");
    expect(preview.sources.map((source) => source.itemsRead)).toEqual([1, 1]);
    const sourceStates = await prisma.companyImportSource.findMany({
      where: { runId: created.runId, spaceId, ownerUserId: userId },
      select: { cursor: true },
    });
    expect(sourceStates.every((source) => source.cursor === null)).toBe(true);
    const pausedReads = await prisma.companyImportUnit.findMany({
      where: {
        runId: created.runId,
        spaceId,
        ownerUserId: userId,
        status: "done",
        unitKey: { not: "discover:0" },
      },
      select: { cursor: true },
    });
    expect(pausedReads).toHaveLength(2);
    expect(
      pausedReads.every(
        ({ cursor }) => (cursor as Record<string, unknown> | null)?.companySampleResume === true,
      ),
    ).toBe(true);

    await engine.action(actor, created.runId, "continue");
    for (let step = 0; step < 40; step++) {
      await processWaiting();
      if ((await engine.progress(actor, created.runId)).status === "completed") break;
    }
    const completed = await engine.progress(actor, created.runId);
    expect(completed.status).toBe("completed");
    expect(completed.sources.map((source) => source.itemsRead)).toEqual([31, 30]);
    expect(extracted.size).toBe(61);
    expect([...extracted.values()].every((count) => count === 1)).toBe(true);
    expect(calls).not.toContain("ACME_CREATE_RECORD");
  });

  it("resumes a durable Notion block cursor after a provider rate limit", async () => {
    const notionConnection = await prisma.connection.create({
      data: {
        spaceId,
        userId,
        connectorId: "composio",
        provider: "notion",
        displayName: "Synthetic Notion resume",
        status: "connected",
        providerRef: "synthetic-notion-resume-account",
        allAgents: true,
        privateByDefault: false,
      },
    });
    const pageId = "44444444-4444-4444-8444-444444444444";
    const firstBlockId = "55555555-5555-4555-8555-555555555555";
    const secondBlockId = "66666666-6666-4666-8666-666666666666";
    const notionTools: ConnectorTool[] = [
      {
        name: "NOTION_SEARCH_NOTION_PAGE",
        description: "Search pages",
        inputSchema: {
          type: "object",
          properties: { filter_value: {}, page_size: {}, start_cursor: {} },
        },
        route: { connectorId: "composio", toolName: "NOTION_SEARCH_NOTION_PAGE" },
      },
      {
        name: "NOTION_RETRIEVE_PAGE",
        description: "Retrieve metadata",
        inputSchema: {
          type: "object",
          properties: { page_id: {} },
          required: ["page_id"],
        },
        route: { connectorId: "composio", toolName: "NOTION_RETRIEVE_PAGE" },
      },
      {
        name: "NOTION_FETCH_BLOCK_CONTENTS",
        description: "Read blocks",
        inputSchema: {
          type: "object",
          properties: { block_id: {}, page_size: {}, start_cursor: {} },
          required: ["block_id"],
        },
        route: { connectorId: "composio", toolName: "NOTION_FETCH_BLOCK_CONTENTS" },
      },
    ];
    let searchCalls = 0;
    let metadataCalls = 0;
    let blockCalls = 0;
    const extractedDocuments: string[] = [];
    const reader = {
      listTools: async () => notionTools,
      callTool: async (_source: unknown, name: string) => {
        if (name === "NOTION_SEARCH_NOTION_PAGE") {
          searchCalls++;
          return { results: [{ id: pageId }], has_more: false };
        }
        if (name === "NOTION_RETRIEVE_PAGE") {
          metadataCalls++;
          return {
            id: pageId,
            properties: { Name: { type: "title", title: [{ plain_text: "Northwind Robotics" }] } },
          };
        }
        blockCalls++;
        if (blockCalls === 2)
          return { successful: false, status: 429, error: { message: "provider rate limit" } };
        return {
          results: [
            {
              id: firstBlockId,
              type: "paragraph",
              paragraph: { rich_text: [{ plain_text: content }] },
              has_children: false,
            },
            {
              id: secondBlockId,
              type: "paragraph",
              paragraph: { rich_text: [{ plain_text: content }] },
              has_children: false,
            },
          ],
          has_more: false,
        };
      },
    } as unknown as CompanyConnectionReader;
    const documents = createCompanyDocumentReader(reader);
    const extractor: CompanyExtractor = {
      relevant: async () => true,
      extract: async (document) => {
        extractedDocuments.push(document.text);
        return {
          extraction: document.text.includes("Avery Chen")
            ? extraction
            : { entities: [], edges: [], events: [] },
          model: { provider: "synthetic", model: "stub-extractor" },
        };
      },
    };
    const jobs: JobPublisher = {
      enqueue: async () => undefined,
      cancel: async () => undefined,
      close: async () => undefined,
    };
    const realtime = { publish: async () => undefined } as unknown as RealtimeFanout;
    const makeEngine = (sourceReader: ReturnType<typeof createCompanyDocumentReader>) =>
      createCompanyImportEngine({
        prisma,
        jobs,
        realtime,
        resolveModel: async () => ({ provider: "synthetic", id: "synthetic-model" }),
        worker: createCompanySourceWorker({ prisma, documents: sourceReader, extractor }),
      });
    const engine = makeEngine(documents);
    const created = await engine.create(actor, {
      tokenCap: 1_000_000,
      sources: [
        {
          sourceKind: "notion",
          connectionId: notionConnection.id,
          scope: { reader: "notion", allTime: true },
        },
      ],
    });
    await grantAll(engine, created.runId);
    await engine.start(actor, created.runId);
    const payload = { spaceId, userId, runId: created.runId };
    for (let step = 0; step < 10 && blockCalls < 2; step++) {
      await engine.runJob(payload);
      const waiting = await prisma.companyImportUnit.findMany({
        where: { runId: created.runId, spaceId, ownerUserId: userId, status: "waiting" },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      for (const unit of waiting) {
        await engine.unitJob({ ...payload, unitId: unit.id });
        if (blockCalls >= 2) break;
      }
    }
    expect(blockCalls).toBe(2);
    expect(searchCalls).toBe(1);
    expect(metadataCalls).toBe(1);
    const source = await prisma.companyImportSource.findFirstOrThrow({
      where: { runId: created.runId, spaceId, ownerUserId: userId },
      select: { id: true },
    });
    const failed = await prisma.companyImportUnit.findFirstOrThrow({
      where: {
        runId: created.runId,
        sourceId: source.id,
        spaceId,
        ownerUserId: userId,
        unitKey: { startsWith: "notion:" },
      },
      select: { status: true, lastError: true, cursor: true },
    });
    expect(failed).toMatchObject({ status: "waiting", lastError: "rate_limited" });
    expect(JSON.stringify(failed.cursor)).not.toContain(content);
    expect(extractedDocuments.filter((document) => document.includes("Avery Chen"))).toHaveLength(
      1,
    );

    const before = Date.now();
    try {
      const restarted = makeEngine(createCompanyDocumentReader(reader));
      const resumed = await runToCompletion(restarted, created.runId, true, true);
      expect(resumed.status).toBe("completed");
    } finally {
      vi.setSystemTime(before);
    }
    expect(searchCalls).toBe(1);
    expect(metadataCalls).toBe(1);
    expect(blockCalls).toBe(3);
    expect(extractedDocuments.filter((document) => document.includes("Avery Chen"))).toHaveLength(
      2,
    );
    const persistedItems = await prisma.companyEvidence.findMany({
      where: {
        extractorRunId: created.runId,
        spaceId,
        ownerUserId: userId,
        sourceKind: "notion",
      },
      select: { sourceItemId: true },
    });
    expect(new Set(persistedItems.map((item) => item.sourceItemId))).toEqual(
      new Set([`notion:${pageId}:${firstBlockId}`, `notion:${pageId}:${secondBlockId}`]),
    );
  });
});
