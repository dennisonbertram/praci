import type { CompanyImportEngine, CompanySlackReader } from "@rakazo/adapters";
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
