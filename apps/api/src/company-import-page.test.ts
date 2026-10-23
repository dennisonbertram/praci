import type {
  CompanyDocumentReader,
  CompanyImportEngine,
  CompanySlackReader,
  CompanyTrackerReader,
} from "@rakazo/adapters";
import { CompanyImportWorkerError } from "@rakazo/adapters";
import type { Actor, CompanyImportChannelsInput } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { describe, expect, it, vi } from "vitest";
import { createCompanyImportPage } from "./company-import-page.js";

const actor: Actor = {
  spaceId: "space-1",
  userId: "owner-1",
  email: "owner@example.test",
  isDeploymentOwner: false,
};

function page(blocks: unknown[] = []) {
  const findBlocks = vi.fn(async () => blocks);
  const prisma = {
    spaceMember: { findUnique: vi.fn(async () => ({ id: "member-1" })) },
    companySourceBlock: { findMany: findBlocks },
  } as unknown as PrismaClient;
  const channels = vi.fn(async () => ({
    channels: [],
    nextCursor: null,
  }));
  const slack = { channels } as unknown as CompanySlackReader;
  const result = createCompanyImportPage({
    prisma,
    engine: {} as CompanyImportEngine,
    slack,
  });
  return { result, channels, findBlocks };
}

describe("Company import page channels", () => {
  it("catalogs only the bounded GitHub and dedicated Linear MCP readers", async () => {
    const supports = vi.fn(async () => true);
    const prisma = {
      spaceMember: { findUnique: async () => ({ id: "member-1" }) },
      companySourceBlock: { findMany: async () => [] },
      dataRoomItem: { count: async () => 0 },
      dataRoomFolder: { findMany: async () => [] },
      connection: {
        findMany: async () => [
          {
            id: "github-1",
            provider: "github",
            displayName: "GitHub",
            status: "connected",
            allAgents: true,
            privateByDefault: false,
          },
        ],
      },
      mcpServer: {
        findMany: async () => [{ id: "linear-1", name: "Linear MCP", enabled: true }],
      },
    } as unknown as PrismaClient;
    const result = await createCompanyImportPage({
      prisma,
      engine: {} as CompanyImportEngine,
      slack: { supports: async () => false } as unknown as CompanySlackReader,
      tracker: { supports } as unknown as CompanyTrackerReader,
    }).catalog(actor);

    expect(result.sources).toContainEqual(
      expect.objectContaining({
        sourceKind: "github",
        connectionId: "github-1",
        available: true,
        defaultScope: { reader: "github", allTime: true },
      }),
    );
    expect(result.sources).toContainEqual(
      expect.objectContaining({
        sourceKind: "mcp",
        mcpServerId: "linear-1",
        available: true,
        defaultScope: { reader: "linear", allTime: true },
      }),
    );
    expect(supports.mock.calls.map(([source]) => source)).toEqual([
      expect.objectContaining({ sourceKind: "github", scope: { reader: "github", allTime: true } }),
      expect.objectContaining({
        sourceKind: "mcp",
        mcpServerId: "linear-1",
        scope: { reader: "linear", allTime: true },
      }),
    ]);
  });

  it("validates tracker source kinds against their provider routes before creating a run", async () => {
    const supports = vi.fn(async () => true);
    const engineCreate = vi.fn(async () => ({ runId: "run-1" }));
    const connectionFindFirst = vi.fn(async () => ({
      provider: "github",
      status: "connected",
      allAgents: true,
      privateByDefault: false,
    }));
    const prisma = {
      spaceMember: { findUnique: async () => ({ id: "member-1" }) },
      companySourceBlock: { findMany: async () => [] },
      connection: { findFirst: connectionFindFirst },
      mcpServer: { findFirst: async () => ({ id: "linear-1" }) },
      companyImportSource: { findMany: async () => [] },
    } as unknown as PrismaClient;
    const result = createCompanyImportPage({
      prisma,
      engine: { create: engineCreate } as unknown as CompanyImportEngine,
      tracker: { supports } as unknown as CompanyTrackerReader,
    });
    const input = {
      tokenCap: 100_000,
      sources: [
        {
          sourceKind: "github" as const,
          connectionId: "github-1",
          scope: { reader: "github" as const, allTime: true as const },
        },
        {
          sourceKind: "mcp" as const,
          mcpServerId: "linear-1",
          scope: { reader: "linear" as const, allTime: true as const },
        },
      ],
    };

    await expect(result.create(actor, input)).resolves.toEqual({ runId: "run-1" });
    expect(connectionFindFirst).toHaveBeenCalledTimes(2);
    expect(supports.mock.calls.map(([source]) => source)).toEqual([
      expect.objectContaining({
        sourceKind: "github",
        connectionId: "github-1",
        scope: { reader: "github", allTime: true },
      }),
      expect.objectContaining({
        sourceKind: "mcp",
        connectionId: null,
        mcpServerId: "linear-1",
        scope: { reader: "linear", allTime: true },
      }),
    ]);
    expect(engineCreate).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({
        sources: [
          expect.objectContaining({
            sourceKind: "github",
            scope: { reader: "github", allTime: true },
          }),
          expect.objectContaining({
            sourceKind: "mcp",
            scope: { reader: "linear", allTime: true },
          }),
        ],
      }),
    );
  });

  it("lists supported Slack sources without querying nonexistent folder fields", async () => {
    const folders = vi.fn(async () => [{ id: "folder-1", name: "Company" }]);
    const prisma = {
      spaceMember: { findUnique: async () => ({ id: "member-1" }) },
      companySourceBlock: { findMany: async () => [] },
      dataRoomItem: { count: async () => 0 },
      dataRoomFolder: { findMany: folders },
      connection: {
        findMany: async () => [
          {
            id: "slack-1",
            provider: "slack",
            displayName: "Slack",
            status: "connected",
            allAgents: true,
            privateByDefault: false,
          },
        ],
      },
      mcpServer: { findMany: async () => [] },
    } as unknown as PrismaClient;
    const result = await createCompanyImportPage({
      prisma,
      engine: {} as CompanyImportEngine,
      slack: { supports: async () => true } as unknown as CompanySlackReader,
    }).catalog(actor);
    expect(folders).toHaveBeenCalledWith({
      where: { spaceId: actor.spaceId, userId: actor.userId },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: { id: true, name: true },
    });
    expect(result.folders).toEqual([{ id: "folder-1", name: "Company" }]);
    expect(result.sources).toContainEqual(
      expect.objectContaining({ sourceKind: "slack", connectionId: "slack-1", available: true }),
    );
  });

  it("passes an owner-scoped MCP source and explicit metadata-only request to the Slack reader", async () => {
    const state = page();
    const input: CompanyImportChannelsInput = {
      sourceKind: "mcp",
      mcpServerId: "server-1",
      includePrivate: true,
      cursor: "cursor-1",
    };
    await expect(state.result.channels(actor, input)).resolves.toEqual({
      channels: [],
      nextCursor: null,
    });
    expect(state.channels).toHaveBeenCalledWith(
      expect.objectContaining({
        source: {
          id: "channels:server-1",
          sourceKind: "mcp",
          connectionId: null,
          mcpServerId: "server-1",
          scope: { reader: "slack" },
        },
        cursor: "cursor-1",
        includePrivate: true,
        limit: 100,
      }),
      expect.objectContaining({ spaceId: actor.spaceId, userId: actor.userId }),
    );
  });

  it("does not disclose metadata when the exact source locator is blocked", async () => {
    const state = page([
      {
        sourceKind: "mcp",
        connectionId: null,
        mcpServerId: "server-1",
        sourceKey: JSON.stringify(["mcp", null, "server-1"]),
      },
    ]);
    const input: CompanyImportChannelsInput = {
      sourceKind: "mcp",
      mcpServerId: "server-1",
      includePrivate: false,
    };
    await expect(state.result.channels(actor, input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.channels).not.toHaveBeenCalled();
  });
});

describe("Company import page sample", () => {
  it("keeps MCP evidence with the source server that produced it", async () => {
    const sources = [
      {
        id: "source-server-one",
        sourceKind: "mcp",
        connectionId: null,
        mcpServerId: "server-one",
      },
      {
        id: "source-server-two",
        sourceKind: "mcp",
        connectionId: null,
        mcpServerId: "server-two",
      },
    ];
    const observations = [
      {
        evidence: {
          sourceKind: "mcp",
          connectionId: null,
          mcpServerId: "server-one",
          sourceItemId: "shared-item",
          quote: "Quote from server one",
          confidence: 0.9,
          factKind: "entity",
          factId: "entity-one",
        },
      },
      {
        evidence: {
          sourceKind: "mcp",
          connectionId: null,
          mcpServerId: "server-two",
          sourceItemId: "shared-item",
          quote: "Quote from server two",
          confidence: 0.8,
          factKind: "entity",
          factId: "entity-two",
        },
      },
    ];
    const findSources = vi.fn(async () => sources);
    const findObservations = vi.fn(async () => observations);
    const prisma = {
      spaceMember: { findUnique: vi.fn(async () => ({ id: "member-1" })) },
      companyImportRun: { findFirst: vi.fn(async () => ({ id: "run-1" })) },
      companyImportSource: { findMany: findSources },
      companyImportEvidence: { findMany: findObservations },
      companyEntity: {
        findMany: vi.fn(async () => [
          { id: "entity-one", displayName: "Fact from server one" },
          { id: "entity-two", displayName: "Fact from server two" },
        ]),
      },
      companyEvent: { findMany: vi.fn(async () => []) },
      companyEdge: { findMany: vi.fn(async () => []) },
    } as unknown as PrismaClient;
    const result = await createCompanyImportPage({
      prisma,
      engine: {} as CompanyImportEngine,
      slack: {} as CompanySlackReader,
    }).sample(actor, "run-1");

    expect(findSources).toHaveBeenCalledWith({
      where: { runId: "run-1", spaceId: actor.spaceId, ownerUserId: actor.userId },
      select: { id: true, sourceKind: true, connectionId: true, mcpServerId: true },
    });
    expect(findObservations).toHaveBeenCalledWith({
      where: { runId: "run-1", spaceId: actor.spaceId, ownerUserId: actor.userId },
      select: {
        evidence: {
          select: {
            sourceKind: true,
            connectionId: true,
            mcpServerId: true,
            sourceItemId: true,
            quote: true,
            confidence: true,
            factKind: true,
            factId: true,
          },
        },
      },
    });
    expect(result).toEqual([
      {
        sourceId: "source-server-one",
        items: [
          {
            sourceItemId: "shared-item",
            facts: [
              {
                kind: "entity",
                title: "Fact from server one",
                confidence: 0.9,
                quote: "Quote from server one",
              },
            ],
          },
        ],
      },
      {
        sourceId: "source-server-two",
        items: [
          {
            sourceItemId: "shared-item",
            facts: [
              {
                kind: "entity",
                title: "Fact from server two",
                confidence: 0.8,
                quote: "Quote from server two",
              },
            ],
          },
        ],
      },
    ]);
  });
});

describe("Company document imports", () => {
  it("catalogs only safe generic tools and exposes their reported rates", async () => {
    const tools = [
      {
        name: "ACME_LIST_RECORDS",
        description: "Read records",
        readOnly: true,
        inputSchema: { type: "object", properties: { status: { type: "string" } } },
        reportedCost: { description: "Synthetic rate", discount: "Synthetic discount" },
      },
      {
        name: "ACME_CREATE_RECORD",
        description: "Create records",
        readOnly: false,
        inputSchema: { type: "object", properties: {} },
      },
    ];
    const prisma = {
      spaceMember: { findUnique: async () => ({ id: "member-1" }) },
      companySourceBlock: { findMany: async () => [] },
      dataRoomItem: { count: async () => 0 },
      dataRoomFolder: { findMany: async () => [] },
      connection: {
        findMany: async () => [
          {
            id: "notion-1",
            provider: "notion",
            displayName: "Notion",
            status: "connected",
            allAgents: true,
            privateByDefault: false,
          },
          {
            id: "crm-1",
            provider: "acme_crm",
            displayName: "Acme CRM",
            status: "connected",
            allAgents: true,
            privateByDefault: false,
          },
        ],
      },
      mcpServer: { findMany: async () => [] },
    } as unknown as PrismaClient;
    const notionTools = [
      "NOTION_SEARCH_NOTION_PAGE",
      "NOTION_RETRIEVE_PAGE",
      "NOTION_FETCH_BLOCK_CONTENTS",
    ].map((name) => ({
      name,
      description: `Read with ${name}`,
      inputSchema: { type: "object", properties: {} },
      route: { connectorId: "composio", toolName: name },
    }));
    const documents = {
      listTools: async (source: { sourceKind: string }) =>
        source.sourceKind === "notion" ? notionTools : tools,
    } as unknown as CompanyDocumentReader;
    const result = await createCompanyImportPage({
      prisma,
      engine: {} as CompanyImportEngine,
      documents,
    }).catalog(actor);
    expect(result.sources).toContainEqual(
      expect.objectContaining({
        sourceKind: "composio",
        available: true,
        defaultScope: { reader: "generic", tools: [] },
        tools: [
          expect.objectContaining({
            name: "ACME_LIST_RECORDS",
            reportedCost: { description: "Synthetic rate", discount: "Synthetic discount" },
          }),
        ],
      }),
    );
    expect(result.sources).toContainEqual(
      expect.objectContaining({
        sourceKind: "notion",
        available: true,
        tools: expect.arrayContaining([
          expect.objectContaining({
            name: "NOTION_SEARCH_NOTION_PAGE",
            description: expect.stringContaining("may be incomplete"),
          }),
        ]),
      }),
    );
  });

  it("validates fresh selected tools before creation and stores server-reported rates", async () => {
    const reportedCost = { description: "Synthetic rate", discount: "Synthetic discount" };
    const validate = vi.fn(async () => ({
      tools: [{ name: "ACME_LIST_RECORDS", reportedCost }],
    }));
    const createRun = vi.fn(async () => ({ runId: "run-1" }));
    const updateSource = vi.fn(async () => undefined);
    const prisma = {
      spaceMember: { findUnique: async () => ({ id: "member-1" }) },
      companySourceBlock: { findMany: async () => [] },
      connection: {
        findFirst: async () => ({
          provider: "acme_crm",
          status: "connected",
          allAgents: true,
          privateByDefault: false,
        }),
      },
      companyImportSource: {
        findMany: async () => [
          {
            id: "source-1",
            sourceKind: "composio",
            connectionId: "crm-1",
            mcpServerId: null,
          },
        ],
        update: updateSource,
      },
    } as unknown as PrismaClient;
    const documents = { validate } as unknown as CompanyDocumentReader;
    const page = createCompanyImportPage({
      prisma,
      engine: { create: createRun } as unknown as CompanyImportEngine,
      documents,
    });
    const input = {
      tokenCap: 10_000,
      mode: "sample" as const,
      sources: [
        {
          sourceKind: "composio" as const,
          connectionId: "crm-1",
          scope: {
            reader: "generic" as const,
            tools: [{ name: "ACME_LIST_RECORDS", args: { status: "active" } }],
          },
        },
      ],
    };

    await expect(page.create(actor, input)).resolves.toEqual({ runId: "run-1" });
    expect(validate).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceKind: "composio",
        scope: input.sources[0]!.scope,
      }),
      expect.objectContaining({ spaceId: actor.spaceId, userId: actor.userId }),
    );
    expect(updateSource).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          plan: expect.objectContaining({
            perCallCosts: [{ toolName: "ACME_LIST_RECORDS", ...reportedCost }],
          }),
        },
      }),
    );

    validate.mockRejectedValueOnce(new Error("source_tool_arguments_invalid"));
    await expect(page.create(actor, input)).rejects.toThrow("source_tool_arguments_invalid");
    expect(createRun).toHaveBeenCalledTimes(1);
  });

  it("returns safe client errors for write and incomplete generic selections", async () => {
    const dispatch = vi.fn();
    const createRun = vi.fn();
    const validate = vi.fn(
      async (source: { scope: { tools: Array<{ name: string; args: object }> } }) => {
        const selection = source.scope.tools[0];
        if (selection?.name === "ACME_CREATE_RECORD") {
          const error = new CompanyImportWorkerError("source_tool_unavailable");
          error.message = "provider secret details";
          throw error;
        }
        if (selection?.name === "ACME_GET_RECORD")
          throw new CompanyImportWorkerError("source_tool_arguments_invalid");
        return [];
      },
    );
    const prisma = {
      spaceMember: { findUnique: async () => ({ id: "member-1" }) },
      companySourceBlock: { findMany: async () => [] },
      connection: {
        findFirst: async () => ({
          provider: "acme_crm",
          status: "connected",
          allAgents: true,
          privateByDefault: false,
        }),
      },
    } as unknown as PrismaClient;
    const result = createCompanyImportPage({
      prisma,
      engine: { create: createRun } as unknown as CompanyImportEngine,
      documents: { validate, callTool: dispatch } as unknown as CompanyDocumentReader,
    });
    const inputFor = (name: string) =>
      ({
        tokenCap: 10_000,
        mode: "sample" as const,
        sources: [
          {
            sourceKind: "composio" as const,
            connectionId: "crm-1",
            scope: { reader: "generic" as const, tools: [{ name, args: {} }] },
          },
        ],
      }) as never;

    await expect(result.create(actor, inputFor("ACME_CREATE_RECORD"))).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    await expect(result.create(actor, inputFor("ACME_GET_RECORD"))).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(createRun).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
    expect(validate).toHaveBeenCalledTimes(2);
  });

  it("preserves reported tool rates when sample plans are re-estimated", async () => {
    const perCallCosts = [{ toolName: "ACME_LIST_RECORDS", description: "Synthetic rate" }];
    const updateSource = vi.fn(async () => undefined);
    const prisma = {
      spaceMember: { findUnique: async () => ({ id: "member-1" }) },
      companyImportRun: {
        findFirst: async () => ({
          id: "run-1",
          mode: "sample",
          tokenCap: 10_000,
          sources: [
            {
              id: "source-1",
              sourceKind: "composio",
              connectionId: "crm-1",
              mcpServerId: null,
              scope: { reader: "generic", tools: [{ name: "ACME_LIST_RECORDS", args: {} }] },
              plan: {
                itemCount: null,
                tokensLower: 0,
                tokensUpper: 10_000,
                estimateBasis: "budget_cap",
                perCallCosts,
              },
            },
          ],
        }),
      },
      companyImportUnit: {
        aggregate: async () => ({
          _sum: { itemsRead: 0, inputTokensUsed: 0n, outputTokensUsed: 0n },
        }),
      },
      companyImportSource: { update: updateSource },
      connection: { findMany: async () => [] },
      mcpServer: { findMany: async () => [] },
    } as unknown as PrismaClient;
    const engine = {
      progress: async () => ({
        runId: "run-1",
        status: "paused",
        tokenCap: 10_000,
        reservedTokens: 0,
        inputTokensUsed: 0,
        outputTokensUsed: 0,
        budgetWarning: false,
        counts: {},
        sources: [
          {
            id: "source-1",
            sourceKind: "mcp",
            status: "running",
            units: 1,
            itemsDiscovered: 1,
            itemsRead: 0,
            factsFound: 0,
            reservedTokens: 0,
            inputTokensUsed: 0,
            outputTokensUsed: 0,
            lastError: null,
          },
          {
            id: "source-2",
            sourceKind: "mcp",
            status: "running",
            units: 1,
            itemsDiscovered: 1,
            itemsRead: 0,
            factsFound: 0,
            reservedTokens: 0,
            inputTokensUsed: 0,
            outputTokensUsed: 0,
            lastError: null,
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    } as unknown as CompanyImportEngine;

    const result = await createCompanyImportPage({ prisma, engine }).session(actor, "run-1");
    expect(result?.sources[0]?.plan.perCallCosts).toEqual(perCallCosts);
    expect(updateSource).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { plan: expect.objectContaining({ perCallCosts }) },
      }),
    );
  });

  it("labels each MCP import source from its actor-scoped server", async () => {
    const serverFindMany = vi.fn(async () => [
      { id: "server-1", name: "Linear workspace" },
      { id: "server-2", name: "Slack workspace" },
    ]);
    const prisma = {
      spaceMember: { findUnique: async () => ({ id: "member-1" }) },
      companyImportRun: {
        findFirst: async () => ({
          id: "run-1",
          mode: "full",
          tokenCap: 100,
          sources: [
            {
              id: "source-1",
              sourceKind: "mcp",
              connectionId: null,
              mcpServerId: "server-1",
              scope: {},
              plan: {},
            },
            {
              id: "source-2",
              sourceKind: "mcp",
              connectionId: null,
              mcpServerId: "server-2",
              scope: {},
              plan: {},
            },
          ],
        }),
      },
      connection: { findMany: async () => [] },
      mcpServer: { findMany: serverFindMany },
    } as unknown as PrismaClient;
    const engine = {
      progress: async () => ({
        runId: "run-1",
        status: "paused",
        tokenCap: 100,
        reservedTokens: 0,
        inputTokensUsed: 0,
        outputTokensUsed: 0,
        budgetWarning: false,
        counts: {},
        sources: [
          {
            id: "source-1",
            sourceKind: "mcp",
            status: "running",
            units: 1,
            itemsDiscovered: 1,
            itemsRead: 0,
            factsFound: 0,
            reservedTokens: 0,
            inputTokensUsed: 0,
            outputTokensUsed: 0,
            lastError: null,
          },
          {
            id: "source-2",
            sourceKind: "mcp",
            status: "running",
            units: 1,
            itemsDiscovered: 1,
            itemsRead: 0,
            factsFound: 0,
            reservedTokens: 0,
            inputTokensUsed: 0,
            outputTokensUsed: 0,
            lastError: null,
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    } as unknown as CompanyImportEngine;

    const result = await createCompanyImportPage({ prisma, engine }).session(actor, "run-1");

    expect(result?.sources.map(({ label }) => label)).toEqual([
      "Linear workspace",
      "Slack workspace",
    ]);
    expect(result?.progress.sources.map(({ id }) => id)).toEqual(["source-1", "source-2"]);
    expect(serverFindMany).toHaveBeenCalledWith({
      where: { spaceId: actor.spaceId, userId: actor.userId, id: { in: ["server-1", "server-2"] } },
      select: { id: true, name: true },
    });
  });
});
