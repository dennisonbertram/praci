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
