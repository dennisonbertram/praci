import { createHash } from "node:crypto";
import type {
  AdapterContext,
  CompanyConnectionReader,
  CompanyImportSourceDescriptor,
  ConnectedConnector,
  ConnectorCall,
  ConnectorProvider,
  ConnectorTool,
} from "@rakazo/adapter-kit";
import {
  companyImporterSpawnKey,
  companyPrivacySourceKey,
  integrationPresetForEndpoint,
  isReadTool,
} from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { CompanyImportWorkerError } from "./company-import-engine.js";
import { COMPANY_SLACK_READ_TOOLS, COMPANY_SLACK_WRITE_TOOLS } from "./company-slack-source.js";
import { unwrapToolResult } from "./finance-call-tool.js";
import { assertConnectorToolArgs } from "./lazy-tool-catalog.js";
import type { McpConnector } from "./mcp-connector.js";
import { assignmentAllowsTool } from "./mcp-connector.js";

type ReaderDeps = {
  prisma: PrismaClient;
  connectors: ConnectorProvider;
  mcp: Pick<McpConnector, "listServerTools" | "callServerTool">;
};

const MIN_RETRY_MS = 60_000;
const WRAPPER_NAME =
  /(?:execute|multi|batch|router|proxy|api_call|generic_api|tool_call|search[_-]?(?:tools|catalog)|list[_-]?tools|control|\bapi\b|\bhttp\b|request)/i;
const WRAPPER_NAME_PARTS = new Set([
  "api",
  "batch",
  "catalog",
  "control",
  "http",
  "multi",
  "proxy",
  "request",
  "router",
  "tool",
  "tools",
]);
const SAFE_NAME_VERBS = new Set([
  "list",
  "get",
  "fetch",
  "retrieve",
  "read",
  "search",
  "find",
  "lookup",
  "describe",
  "inspect",
  "query",
  "count",
  "check",
  "download",
  "view",
  "show",
]);
const WRITE_NAME_VERBS = new Set([
  "accept",
  "add",
  "archive",
  "assign",
  "approve",
  "buy",
  "cancel",
  "charge",
  "checkout",
  "close",
  "commit",
  "connect",
  "copy",
  "create",
  "delete",
  "deploy",
  "disable",
  "deny",
  "disconnect",
  "enable",
  "edit",
  "execute",
  "forward",
  "grant",
  "insert",
  "invite",
  "join",
  "link",
  "mark",
  "merge",
  "modify",
  "move",
  "open",
  "patch",
  "pay",
  "post",
  "publish",
  "purchase",
  "put",
  "register",
  "react",
  "reject",
  "remove",
  "rename",
  "replace",
  "reply",
  "reset",
  "revoke",
  "run",
  "schedule",
  "send",
  "set",
  "share",
  "start",
  "stop",
  "submit",
  "subscribe",
  "trigger",
  "unassign",
  "unlink",
  "unsubscribe",
  "update",
  "upload",
  "write",
  "upsert",
]);

function denied(message = "Company source access is not available"): never {
  throw new CompanyImportWorkerError(message);
}

function blockedSource(
  rows: Array<{
    sourceKind: string;
    connectionId: string | null;
    mcpServerId: string | null;
    sourceKey: string;
  }>,
  source: CompanyImportSourceDescriptor,
) {
  const key = companyPrivacySourceKey({
    sourceKind: source.sourceKind as never,
    connectionId: source.connectionId,
    mcpServerId: source.mcpServerId ?? null,
  });
  return rows.some(
    (row) =>
      row.sourceKey === key ||
      (row.sourceKind === source.sourceKind &&
        row.connectionId === null &&
        row.mcpServerId === null),
  );
}

function slackToolAllowed(name: string) {
  if ((COMPANY_SLACK_WRITE_TOOLS as readonly string[]).includes(name)) return false;
  return (COMPANY_SLACK_READ_TOOLS as readonly string[]).includes(name);
}

function toolNameTokens(name: string) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, stableValue(entry)]),
  );
}

function fingerprint(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(stableValue(value)))
    .digest("hex");
}

function managedRouteMatches(tool: ConnectorTool, row: { id: string; connectorId: string }) {
  const route = tool.route;
  return (
    !route ||
    (route.connectorId === row.connectorId &&
      (!route.connectionId || route.connectionId === row.id) &&
      (!route.toolName || route.toolName === tool.name) &&
      !route.authorizationFingerprint)
  );
}

function readToolAllowed(
  source: CompanyImportSourceDescriptor,
  tool: ConnectorTool,
  endpoint = tool.route?.endpoint,
) {
  if (tool.route?.discoveredReadOnly === false) return false;
  if (tool.readOnly === false) return false;
  if (
    source.sourceKind === "slack" ||
    (source.sourceKind === "mcp" && source.scope.reader === "slack")
  ) {
    return slackToolAllowed(tool.name);
  }
  const preset = integrationPresetForEndpoint(endpoint);
  if (preset) {
    return isReadTool(
      { name: tool.name, annotations: { readOnlyHint: tool.readOnly === true } },
      preset,
    );
  }
  const tokens = toolNameTokens(tool.name);
  const hasReadVerb = tokens.some((token) => SAFE_NAME_VERBS.has(token));
  if (
    WRAPPER_NAME.test(tool.name) ||
    tokens.some((token) => WRAPPER_NAME_PARTS.has(token)) ||
    tokens.some((token) => WRITE_NAME_VERBS.has(token)) ||
    tokens.some((token) => ["and", "or", "then"].includes(token))
  )
    return false;
  return (
    isReadTool({ name: tool.name, annotations: { readOnlyHint: tool.readOnly === true } }) &&
    hasReadVerb
  );
}

function retryError(error: unknown): CompanyImportWorkerError {
  const message = error instanceof Error ? error.message : "Company source request failed";
  if (/\b429\b|rate.?limit|too many requests|quota/i.test(message)) {
    return new CompanyImportWorkerError("rate_limited", MIN_RETRY_MS);
  }
  return new CompanyImportWorkerError("source_request_failed");
}

function executionId(source: CompanyImportSourceDescriptor) {
  return `company-import:${source.id}:${Date.now()}`;
}

function connectionContext(
  context: AdapterContext,
  row: {
    id: string;
    connectorId: string;
    provider: string;
    externalId?: string | null;
    displayName: string;
    providerRef: string | null;
  },
): AdapterContext {
  const connected: ConnectedConnector = {
    id: row.id,
    connectorId: row.connectorId,
    externalId: row.provider,
    displayName: row.displayName,
    ...(row.providerRef ? { providerRef: row.providerRef } : {}),
  };
  return {
    ...context,
    connectedConnections: [connected],
    connectedAppAgentConnectionId: row.id,
  };
}

export function createCompanyConnectionReader(deps: ReaderDeps): CompanyConnectionReader {
  async function sourceBlock(source: CompanyImportSourceDescriptor, context: AdapterContext) {
    const member = await deps.prisma.spaceMember.findUnique({
      where: { spaceId_userId: { spaceId: context.spaceId, userId: context.userId } },
      select: { userId: true },
    });
    if (!member) denied("Company source access is denied");
    const rows = await deps.prisma.companySourceBlock.findMany({
      where: { spaceId: context.spaceId, ownerUserId: context.userId },
      select: { sourceKind: true, connectionId: true, mcpServerId: true, sourceKey: true },
    });
    if (blockedSource(rows, source)) denied("Company source access is blocked");
  }

  async function managedConnection(source: CompanyImportSourceDescriptor, context: AdapterContext) {
    if (!source.connectionId || source.sourceKind === "mcp") denied();
    await sourceBlock(source, context);
    const row = await deps.prisma.connection.findFirst({
      where: {
        id: source.connectionId,
        spaceId: context.spaceId,
        userId: context.userId,
        status: "connected",
        allAgents: true,
        privateByDefault: false,
      },
      select: {
        id: true,
        connectorId: true,
        provider: true,
        providerRef: true,
        displayName: true,
        allAgents: true,
        privateByDefault: true,
        status: true,
      },
    });
    if (!row) denied("Connected source access is denied");
    if (!["composio", "pipedream"].includes(row.connectorId)) denied();
    if (source.sourceKind === "slack" && !["slack", "slack_v2"].includes(row.provider)) denied();
    return row;
  }

  async function mcpAssignment(source: CompanyImportSourceDescriptor, context: AdapterContext) {
    if (source.sourceKind !== "mcp" || !source.mcpServerId || source.connectionId) denied();
    await sourceBlock(source, context);
    const bot = await deps.prisma.bot.findFirst({
      where: {
        spaceId: context.spaceId,
        userId: context.userId,
        spawnKey: companyImporterSpawnKey(context.userId),
        archivedAt: null,
      },
      select: { id: true, spawnKey: true, spaceId: true, userId: true, archivedAt: true },
    });
    if (!bot) denied("Company importer is not available");
    const assignment = await deps.prisma.botMcpServer.findFirst({
      where: {
        botId: bot.id,
        serverId: source.mcpServerId,
        spaceId: context.spaceId,
        userId: context.userId,
        server: {
          id: source.mcpServerId,
          spaceId: context.spaceId,
          userId: context.userId,
          enabled: true,
        },
      },
      include: { server: true, bot: true },
    });
    if (!assignment?.server || !assignment.bot || assignment.bot.archivedAt)
      denied("MCP source access is denied");
    return assignment;
  }

  async function listManaged(source: CompanyImportSourceDescriptor, context: AdapterContext) {
    const row = await managedConnection(source, context);
    const scoped = connectionContext(context, row);
    const tools = await deps.connectors.discoverTools(scoped, [row.connectorId]);
    return {
      row,
      scoped,
      tools: tools.filter(
        (tool) => managedRouteMatches(tool, row) && readToolAllowed(source, tool),
      ),
    };
  }

  async function listMcp(source: CompanyImportSourceDescriptor, context: AdapterContext) {
    const assignment = await mcpAssignment(source, context);
    const tools = await deps.mcp.listServerTools(assignment.server, context, { fresh: true });
    return {
      assignment,
      tools: tools
        .filter((tool) => assignmentAllowsTool(assignment, tool.name, tool.annotations))
        .filter((tool) => {
          if (
            tool.annotations?.readOnlyHint === false ||
            tool.annotations?.destructiveHint === true
          )
            return false;
          const candidate = {
            name: tool.name,
            description: tool.description ?? "",
            inputSchema: (tool.inputSchema ?? {}) as Record<string, unknown>,
            readOnly: isReadTool(tool, integrationPresetForEndpoint(assignment.server.endpoint)),
            route: {
              connectorId: "mcp",
              toolName: tool.name,
              endpoint: assignment.server.endpoint ?? undefined,
            },
          };
          return (
            candidate.readOnly &&
            readToolAllowed(source, candidate, assignment.server.endpoint ?? undefined)
          );
        })
        .map((tool) => ({
          name: tool.name,
          description: tool.description ?? "",
          inputSchema: (tool.inputSchema ?? {}) as Record<string, unknown>,
          readOnly: true,
          route: {
            connectorId: "mcp",
            toolName: tool.name,
            endpoint: assignment.server.endpoint ?? undefined,
            resourceId: assignment.server.secretId ?? undefined,
            serverName: assignment.server.name,
            resourceRevision: assignment.server.revision,
            discoveredReadOnly: true,
            authorizationFingerprint: fingerprint({
              name: tool.name,
              description: tool.description ?? "",
              inputSchema: tool.inputSchema ?? {},
              annotations: tool.annotations ?? null,
              serverId: assignment.server.id,
              endpoint: assignment.server.endpoint,
              secretId: assignment.server.secretId,
              revision: assignment.server.revision,
            }),
          },
        })),
    };
  }

  async function listTools(source: CompanyImportSourceDescriptor, context: AdapterContext) {
    if (source.sourceKind === "mcp") return (await listMcp(source, context)).tools;
    return (await listManaged(source, context)).tools;
  }

  async function callTool(
    source: CompanyImportSourceDescriptor,
    name: string,
    args: Record<string, unknown>,
    context: AdapterContext,
  ) {
    if (source.sourceKind === "mcp") {
      const listed = await listMcp(source, context);
      const tool = listed.tools.find((candidate) => candidate.name === name);
      if (!tool) denied("Company tool is not an approved read");
      const trustedRoute = tool.route;
      assertConnectorToolArgs(tool.inputSchema, args);
      try {
        const result = await deps.mcp.callServerTool(
          listed.assignment.server,
          context,
          name,
          args,
          {
            beforeCall: async () => {
              const current = await listMcp(source, context);
              const live = current.tools.find((candidate) => candidate.name === name);
              if (
                current.assignment.server.id !== listed.assignment.server.id ||
                !live ||
                live.route?.endpoint !== trustedRoute?.endpoint ||
                live.route?.resourceId !== trustedRoute?.resourceId ||
                live.route?.resourceRevision !== trustedRoute?.resourceRevision ||
                live.route?.authorizationFingerprint !== trustedRoute?.authorizationFingerprint ||
                fingerprint({
                  route: live.route,
                  description: live.description,
                  inputSchema: live.inputSchema,
                  readOnly: live.readOnly,
                }) !==
                  fingerprint({
                    route: tool.route,
                    description: tool.description,
                    inputSchema: tool.inputSchema,
                    readOnly: tool.readOnly,
                  })
              )
                denied("MCP tool authorization changed");
            },
          },
        );
        return unwrapToolResult(result);
      } catch (error) {
        if (error instanceof CompanyImportWorkerError) throw error;
        throw retryError(error);
      }
    }

    const listed = await listManaged(source, context);
    const tool = listed.tools.find((candidate) => candidate.name === name);
    if (!tool) denied("Company tool is not an approved read");
    if (
      tool.route &&
      (tool.route.connectorId !== listed.row.connectorId ||
        (tool.route.connectionId && tool.route.connectionId !== listed.row.id) ||
        (tool.route.toolName && tool.route.toolName !== name))
    )
      denied("Company tool route is not available");
    assertConnectorToolArgs(tool.inputSchema, args);
    const route = {
      connectorId: listed.row.connectorId,
      toolName: name,
      connectionId: listed.row.id,
      discoveredReadOnly: true,
    };
    const call: ConnectorCall = {
      tool: name,
      args,
      executionId: executionId(source),
      route,
      authorizeUnannotatedRead: (fresh) =>
        fresh.name === name &&
        managedRouteMatches(fresh, listed.row) &&
        readToolAllowed(source, fresh),
      beforeDispatch: async () => {
        const current = await listManaged(source, context);
        const live = current.tools.find((candidate) => candidate.name === name);
        if (
          !live ||
          current.row.id !== route.connectionId ||
          current.row.connectorId !== route.connectorId ||
          current.row.provider !== listed.row.provider ||
          current.row.providerRef !== listed.row.providerRef ||
          fingerprint({
            route: live.route,
            description: live.description,
            inputSchema: live.inputSchema,
            readOnly: live.readOnly,
          }) !==
            fingerprint({
              route: tool.route,
              description: tool.description,
              inputSchema: tool.inputSchema,
              readOnly: tool.readOnly,
            }) ||
          !readToolAllowed(source, live)
        ) {
          return "Company tool authorization changed";
        }
        return null;
      },
    };
    try {
      for await (const event of deps.connectors.execute(call, listed.scoped)) {
        if (event.type === "error") throw new Error(event.message);
        if (event.type === "result") return event.data;
      }
    } catch (error) {
      if (error instanceof CompanyImportWorkerError) throw error;
      throw retryError(error);
    }
    throw new CompanyImportWorkerError("source_request_failed");
  }

  return { listTools, callTool };
}
