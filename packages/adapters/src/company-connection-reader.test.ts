import type {
  AdapterContext,
  ConnectorCall,
  ConnectorProvider,
  ConnectorTool,
} from "@rakazo/adapter-kit";
import { companyImporterSpawnKey } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCompanyConnectionReader } from "./company-connection-reader.js";
import type { McpConnector } from "./mcp-connector.js";

const context: AdapterContext = {
  operationId: "company-import-test",
  traceId: "company-import-test",
  spaceId: "space-1",
  userId: "owner-1",
  signal: new AbortController().signal,
};
const source = {
  id: "source-1",
  sourceKind: "crm",
  connectionId: "connection-1",
  scope: {},
};
const argsSchema = {
  type: "object",
  properties: { query: { type: "string" } },
  required: ["query"],
  additionalProperties: false,
};
const connection = {
  id: source.connectionId,
  connectorId: "composio",
  provider: "crm",
  providerRef: "account-1",
  displayName: "Synthetic CRM",
  allAgents: true,
  privateByDefault: false,
  status: "connected",
};

function managedTool(name = "list_records", readOnly?: boolean): ConnectorTool {
  return {
    name,
    description: `Synthetic ${name}`,
    inputSchema: argsSchema,
    ...(readOnly === undefined ? {} : { readOnly }),
    route: { connectorId: connection.connectorId, toolName: name },
  };
}

function harness(
  options: {
    connectorId?: string;
    provider?: string;
    connectionLookup?: () => unknown;
    discover?: () => ConnectorTool[];
    blockRows?: unknown[];
    memberLookup?: () => unknown;
    mcpEndpoint?: string;
    mcpTools?: () => unknown[];
  } = {},
) {
  const selectedConnection = {
    ...connection,
    connectorId: options.connectorId ?? connection.connectorId,
    provider: options.provider ?? connection.provider,
  };
  const findConnection = vi.fn(async () =>
    options.connectionLookup ? options.connectionLookup() : selectedConnection,
  );
  const findBlocks = vi.fn(async () => options.blockRows ?? []);
  const findMember = vi.fn(async () =>
    options.memberLookup ? options.memberLookup() : { userId: context.userId },
  );
  const prisma = {
    companySourceBlock: { findMany: findBlocks },
    connection: { findFirst: findConnection },
    spaceMember: { findUnique: findMember },
  } as unknown as PrismaClient;
  const calls: ConnectorCall[] = [];
  let dispatched = 0;
  const discoverTools = vi.fn(async (received: AdapterContext, only?: readonly string[]) => {
    expect(received.connectedAppAgentConnectionId).toBe(source.connectionId);
    expect(received.connectedConnections).toEqual([
      expect.objectContaining({
        id: source.connectionId,
        connectorId: selectedConnection.connectorId,
        externalId: selectedConnection.provider,
        providerRef: selectedConnection.providerRef,
      }),
    ]);
    expect(only).toEqual([selectedConnection.connectorId]);
    return (
      options.discover?.() ?? [
        {
          ...managedTool("list_records", true),
          route: { connectorId: selectedConnection.connectorId, toolName: "list_records" },
        },
      ]
    );
  });
  const execute = vi.fn(async function* (call: ConnectorCall) {
    calls.push(call);
    const denial = await call.beforeDispatch?.();
    if (denial) {
      yield { type: "error" as const, message: denial };
      return;
    }
    dispatched++;
    yield { type: "result" as const, data: { records: [] } };
  });
  const connectors = { discoverTools, execute } as unknown as ConnectorProvider;
  const server = {
    id: "server-1",
    spaceId: context.spaceId,
    userId: context.userId,
    enabled: true,
    endpoint: options.mcpEndpoint ?? "https://synthetic.example.test/mcp",
    secretId: "synthetic-secret-reference",
    revision: 3,
    name: "Synthetic MCP",
    agentExclusive: false,
    agentBotId: null,
    writesEnabled: false,
  };
  const assignment = {
    id: "assignment-1",
    botId: "importer-1",
    serverId: server.id,
    spaceId: context.spaceId,
    userId: context.userId,
    allowAllTools: true,
    allowedTools: [],
    server,
    bot: {
      id: "importer-1",
      spawnKey: companyImporterSpawnKey(context.userId),
      spaceId: context.spaceId,
      userId: context.userId,
      archivedAt: null,
    },
  };
  const findBot = vi.fn(async () => ({
    id: assignment.bot.id,
    spawnKey: assignment.bot.spawnKey,
    spaceId: context.spaceId,
    userId: context.userId,
    archivedAt: null,
  }));
  const findAssignment = vi.fn(async () => assignment);
  Object.assign(prisma, {
    bot: { findFirst: findBot },
    botMcpServer: { findFirst: findAssignment },
  });
  const mcpList = vi.fn(async () =>
    options.mcpTools
      ? options.mcpTools()
      : [
          {
            name: "get_records",
            description: "Read synthetic records",
            inputSchema: argsSchema,
            annotations: { readOnlyHint: true },
          },
          {
            name: "delete_records",
            description: "Delete synthetic records",
            inputSchema: argsSchema,
            annotations: { readOnlyHint: true },
          },
        ],
  );
  const mcpCall = vi.fn(
    async (
      _server: unknown,
      _context: AdapterContext,
      _name: string,
      _args: Record<string, unknown>,
      options?: { beforeCall?: () => Promise<void> },
    ) => {
      await options?.beforeCall?.();
      return { content: [{ type: "text" as const, text: '{"records":[]}' }] };
    },
  );
  const mcp = {
    listServerTools: mcpList,
    callServerTool: mcpCall,
  } as unknown as Pick<McpConnector, "listServerTools" | "callServerTool">;
  return {
    reader: createCompanyConnectionReader({ prisma, connectors, mcp }),
    prisma,
    findConnection,
    findMember,
    discoverTools,
    calls,
    get dispatched() {
      return dispatched;
    },
    findBot,
    findAssignment,
    mcpList,
    mcpCall,
    assignment,
  };
}

describe("Company connection reader", () => {
  beforeEach(() => vi.clearAllMocks());

  it("authorizes only documented GitHub reads without annotations", async () => {
    const github = { ...source, sourceKind: "github", scope: { reader: "github", allTime: true } };
    let readOnly: boolean | undefined;
    const state = harness({
      provider: "github",
      discover: () => [
        managedTool("GITHUB_GET_A_USER", readOnly),
        managedTool("GITHUB_CREATE_AN_ISSUE", true),
        managedTool("GITHUB_RUN_QUERY_OR_MUTATION", true),
      ],
    });
    expect((await state.reader.listTools(github, context)).map((tool) => tool.name)).toEqual([
      "GITHUB_GET_A_USER",
    ]);
    await state.reader.callTool(github, "GITHUB_GET_A_USER", { query: "synthetic" }, context);
    expect(state.calls[0]?.authorizeUnannotatedRead?.(managedTool("GITHUB_GET_A_USER"))).toBe(true);
    readOnly = false;
    expect(await state.reader.listTools(github, context)).toEqual([]);
    await expect(
      state.reader.callTool(github, "GITHUB_GET_A_USER", { query: "synthetic" }, context),
    ).rejects.toThrow();
    expect(state.calls).toHaveLength(1);
    await expect(harness().reader.listTools(github, context)).rejects.toThrow();
  });

  it.each(["composio", "pipedream"])("pins one %s account for direct read tools", async (id) => {
    const state = harness({ connectorId: id });
    const result = await state.reader.callTool(
      source,
      "list_records",
      { query: "synthetic" },
      context,
    );
    expect(result).toEqual({ records: [] });
    expect(state.discoverTools).toHaveBeenCalledTimes(2);
    expect(state.calls[0]?.route).toMatchObject({
      connectorId: id,
      connectionId: source.connectionId,
      toolName: "list_records",
      discoveredReadOnly: true,
    });
    expect(state.dispatched).toBe(1);
  });

  it("filters writes, unknown tools, control wrappers, and foreign routes", async () => {
    const state = harness({
      discover: () => [
        managedTool("list_records", true),
        managedTool("delete_records", true),
        managedTool("list_records", false),
        managedTool("read_unknown"),
        managedTool("search_tools", true),
        {
          ...managedTool("list_foreign"),
          route: { connectorId: "pipedream", toolName: "list_foreign" },
        },
      ],
    });
    await expect(state.reader.listTools(source, context)).resolves.toEqual([
      expect.objectContaining({ name: "list_records" }),
    ]);
    await expect(
      state.reader.callTool(source, "delete_records", { query: "x" }, context),
    ).rejects.toThrow("Company tool is not an approved read");
    expect(state.dispatched).toBe(0);
  });

  it("classifies prefixed reads and canonical preset reads without widening writes", async () => {
    const state = harness({
      discover: () => [
        managedTool("linear-list-issues", true),
        managedTool("CRM_FETCH_RECORDS", true),
        managedTool("CRM_CREATE_RECORDS", true),
        managedTool("CRM_GET_API_STATUS", true),
        managedTool("search_tools", true),
        managedTool("CRM_LIST_ISSUES_AND_CREATE", true),
      ],
    });
    await expect(state.reader.listTools(source, context)).resolves.toEqual([
      expect.objectContaining({ name: "linear-list-issues" }),
      expect.objectContaining({ name: "CRM_FETCH_RECORDS" }),
    ]);

    const mcpSource = {
      id: "box-source",
      sourceKind: "mcp",
      connectionId: null,
      mcpServerId: "server-1",
      scope: {},
    };
    const preset = harness({
      mcpEndpoint: "https://mcp.box.com/mcp",
      mcpTools: () => [
        { name: "search_files_keyword", inputSchema: argsSchema },
        {
          name: "create_folder",
          inputSchema: argsSchema,
          annotations: { readOnlyHint: true },
        },
      ],
    });
    await expect(preset.reader.listTools(mcpSource, context)).resolves.toEqual([
      expect.objectContaining({ name: "search_files_keyword", readOnly: true }),
    ]);
  });

  it("supplies a server classifier for only the selected missing-annotation Slack read", async () => {
    const state = harness({
      provider: "slack",
      discover: () => [
        managedTool("SLACK_FETCH_CONVERSATION_HISTORY"),
        managedTool("SLACK_SEND_MESSAGE", true),
      ],
    });
    const slackSource = { ...source, sourceKind: "slack" };
    await state.reader.callTool(
      slackSource,
      "SLACK_FETCH_CONVERSATION_HISTORY",
      { query: "synthetic" },
      context,
    );
    const authorize = state.calls[0]?.authorizeUnannotatedRead;
    expect(authorize?.(managedTool("SLACK_FETCH_CONVERSATION_HISTORY"))).toBe(true);
    expect(authorize?.(managedTool("SLACK_SEND_MESSAGE", true))).toBe(false);
    expect(
      authorize?.({
        ...managedTool("SLACK_FETCH_CONVERSATION_HISTORY"),
        route: { connectorId: "pipedream", toolName: "SLACK_FETCH_CONVERSATION_HISTORY" },
      }),
    ).toBe(false);
  });

  it("stops dispatch when a selected connection is revoked after discovery", async () => {
    let checks = 0;
    const state = harness({
      connectionLookup: () => (checks++ === 0 ? connection : null),
    });
    await expect(
      state.reader.callTool(source, "list_records", { query: "synthetic" }, context),
    ).rejects.toThrow("Connected source access is denied");
    expect(state.findConnection).toHaveBeenCalledTimes(2);
    expect(state.dispatched).toBe(0);
  });

  it("stops dispatch when space membership is revoked after discovery", async () => {
    let checks = 0;
    const state = harness({
      memberLookup: () => (checks++ < 2 ? { userId: context.userId } : null),
    });
    await expect(state.reader.listTools(source, context)).resolves.toHaveLength(1);
    await expect(
      state.reader.callTool(source, "list_records", { query: "synthetic" }, context),
    ).rejects.toThrow("Company source access is denied");
    expect(state.findMember).toHaveBeenCalledTimes(3);
    expect(state.dispatched).toBe(0);
  });

  it("uses the assigned importer bot for fresh MCP reads and blocks revoked assignments", async () => {
    const state = harness();
    const mcpSource = {
      id: "mcp-source",
      sourceKind: "mcp",
      connectionId: null,
      mcpServerId: "server-1",
      scope: {},
    };
    const tools = await state.reader.listTools(mcpSource, context);
    expect(tools.map((tool) => tool.name)).toEqual(["get_records"]);
    expect(state.mcpList).toHaveBeenCalledWith(state.assignment.server, context, { fresh: true });
    expect(state.findBot).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          spawnKey: companyImporterSpawnKey(context.userId),
          spaceId: context.spaceId,
          userId: context.userId,
          archivedAt: null,
        }),
      }),
    );
    await expect(
      state.reader.callTool(mcpSource, "get_records", { query: "synthetic" }, context),
    ).resolves.toEqual({ records: [] });

    state.findAssignment.mockImplementationOnce(async () => null as never);
    await expect(
      state.reader.callTool(mcpSource, "get_records", { query: "synthetic" }, context),
    ).rejects.toThrow("MCP source access is denied");
    expect(state.mcpCall).toHaveBeenCalledTimes(1);
  });

  it("rechecks fresh MCP metadata immediately before dispatch", async () => {
    const state = harness();
    const mcpSource = {
      id: "mcp-source",
      sourceKind: "mcp",
      connectionId: null,
      mcpServerId: "server-1",
      scope: {},
    };
    let listings = 0;
    state.mcpList.mockImplementation(async () => {
      listings++;
      return [
        {
          name: "get_records",
          description: "Read synthetic records",
          inputSchema: listings === 1 ? argsSchema : { ...argsSchema, description: "changed" },
          annotations: { readOnlyHint: true },
        },
      ];
    });
    await expect(
      state.reader.callTool(mcpSource, "get_records", { query: "synthetic" }, context),
    ).rejects.toThrow("MCP tool authorization changed");
    expect(listings).toBe(2);
    expect(state.mcpCall).toHaveBeenCalledTimes(1);
  });
});
