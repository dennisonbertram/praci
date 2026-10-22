import { ORPCError } from "@orpc/server";
import type { AdapterContext, CompanyConnectionReader } from "@rakazo/adapter-kit";
import type {
  CompanyDocumentReader,
  CompanyImportEngine,
  CompanySlackReader,
  CompanyTrackerReader,
} from "@rakazo/adapters";
import { CompanyImportWorkerError, companySourceScope } from "@rakazo/adapters";
import type {
  Actor,
  CompanyImportCatalog,
  CompanyImportChannels,
  CompanyImportChannelsInput,
  CompanyImportCreateInput,
  CompanyImportPlan,
  CompanyImportSample,
  CompanyImportSession,
  CompanyImportSourceInput,
} from "@rakazo/contracts";
import {
  CompanyDataRoomScopeSchema,
  CompanyGenericScopeSchema,
  CompanyImportPlanSchema,
  CompanySourceKindSchema,
  CompanyTrackerScopeSchema,
  companyPrivacySourceKey,
} from "@rakazo/contracts";
import type { Prisma, PrismaClient } from "@rakazo/db";
import { companyImportEstimate } from "./company-import-estimate.js";

const GMAIL_CONNECT_PATH = "/app/integrations?connect=gmail&returnTo=%2Fapp%2Fcompany%2Fimport";

type PageDeps = {
  prisma: PrismaClient;
  engine: CompanyImportEngine;
  reader?: CompanyConnectionReader;
  slack?: CompanySlackReader;
  tracker?: CompanyTrackerReader;
  documents?: CompanyDocumentReader;
};

function sourceKind(provider: string): CompanyImportCatalog["sources"][number]["sourceKind"] {
  const value = provider.toLowerCase();
  if (value === "slack" || value === "slack_v2") return "slack";
  if (CompanySourceKindSchema.options.includes(value as never))
    return value as CompanyImportCatalog["sources"][number]["sourceKind"];
  return value === "mcp" ? "mcp" : "composio";
}

function planFor(itemCount: number | null, tokenCap: number): CompanyImportPlan {
  return companyImportEstimate(itemCount, tokenCap);
}

function mapSourceValidationError(error: unknown): never {
  if (!(error instanceof CompanyImportWorkerError)) throw error;
  if (error.code === "invalid_source_scope" || error.code === "source_tool_arguments_invalid")
    throw new ORPCError("BAD_REQUEST", {
      message: "Selected source tools or arguments are invalid",
    });
  if (
    error.code === "source_tool_unavailable" ||
    error.code === "source_capability_unavailable" ||
    error.code === "source_pagination_unavailable"
  )
    throw new ORPCError("PRECONDITION_FAILED", {
      message: "Selected source tools are unavailable",
    });
  throw error;
}

function availableConnection(connection: {
  status: string;
  allAgents: boolean;
  privateByDefault: boolean;
}) {
  return connection.status === "connected" && connection.allAgents && !connection.privateByDefault;
}

async function assertMember(prisma: PrismaClient, actor: Actor) {
  const member = await prisma.spaceMember.findUnique({
    where: { spaceId_userId: { spaceId: actor.spaceId, userId: actor.userId } },
    select: { id: true },
  });
  if (!member) throw new ORPCError("NOT_FOUND");
}

async function dataRoomWhere(
  prisma: PrismaClient,
  actor: Actor,
  scope: Record<string, unknown>,
): Promise<Prisma.DataRoomItemWhereInput> {
  const parsed = CompanyDataRoomScopeSchema.parse(scope);
  const blockedConnections = await prisma.companySourceBlock.findMany({
    where: {
      spaceId: actor.spaceId,
      ownerUserId: actor.userId,
      sourceKind: "data_room",
      connectionId: { not: null },
    },
    select: { connectionId: true },
  });
  if (parsed.folderIds) {
    const folders = await prisma.dataRoomFolder.findMany({
      where: {
        spaceId: actor.spaceId,
        userId: actor.userId,
        id: { in: [...new Set(parsed.folderIds)] },
      },
      select: { id: true },
    });
    if (folders.length !== new Set(parsed.folderIds).size) throw new ORPCError("NOT_FOUND");
  }
  return {
    spaceId: actor.spaceId,
    userId: actor.userId,
    ...(parsed.itemIds ? { id: { in: [...new Set(parsed.itemIds)] } } : {}),
    ...(parsed.folderIds ? { folderId: { in: [...new Set(parsed.folderIds)] } } : {}),
    OR: [
      { sourceConnectionId: null },
      {
        sourceConnection: {
          spaceId: actor.spaceId,
          userId: actor.userId,
          status: "connected",
          allAgents: true,
          privateByDefault: false,
          ...(blockedConnections.length
            ? {
                id: {
                  notIn: blockedConnections.flatMap((row) =>
                    row.connectionId ? [row.connectionId] : [],
                  ),
                },
              }
            : {}),
        },
      },
    ],
  };
}

async function sourcePlan(
  prisma: PrismaClient,
  actor: Actor,
  source: CompanyImportSourceInput,
  tokenCap: number,
  documents?: CompanyDocumentReader,
) {
  const normalizedScope = companySourceScope(source.sourceKind, source.scope);
  if (source.sourceKind === "data_room") {
    const parsedScope = CompanyDataRoomScopeSchema.parse(normalizedScope);
    const where = await dataRoomWhere(prisma, actor, parsedScope);
    const itemCount = await prisma.dataRoomItem.count({ where });
    if (parsedScope.itemIds) {
      const requested = new Set(parsedScope.itemIds);
      if (itemCount !== requested.size) throw new ORPCError("NOT_FOUND");
    }
    return { normalizedScope, plan: planFor(itemCount, tokenCap) };
  }
  const plan = planFor(null, tokenCap);
  if (documents && (source.sourceKind === "notion" || source.sourceKind === "composio")) {
    let tools: Awaited<ReturnType<CompanyDocumentReader["validate"]>>;
    try {
      tools = await documents.validate(
        {
          ...source,
          id: `plan:${source.connectionId ?? source.sourceKind}`,
          connectionId: source.connectionId ?? null,
          scope: normalizedScope,
        },
        {
          operationId: `company.import.plan:${source.connectionId ?? source.sourceKind}`,
          traceId: `company.import.plan:${source.connectionId ?? source.sourceKind}`,
          spaceId: actor.spaceId,
          userId: actor.userId,
          signal: new AbortController().signal,
        },
      );
    } catch (error) {
      mapSourceValidationError(error);
    }
    const names =
      source.sourceKind === "notion"
        ? tools.tools.map((tool) => tool.name)
        : CompanyGenericScopeSchema.parse(normalizedScope).tools.map((tool) => tool.name);
    const perCallCosts = tools.tools
      .filter((tool) => names.includes(tool.name) && tool.reportedCost)
      .map((tool) => ({ toolName: tool.name, ...tool.reportedCost! }));
    if (perCallCosts.length) return { normalizedScope, plan: { ...plan, perCallCosts } };
  }
  return { normalizedScope, plan };
}

export function createCompanyImportPage(deps: PageDeps) {
  async function isBlocked(
    actor: Actor,
    sourceKind: string,
    connectionId: string | null,
    mcpServerId: string | null = null,
  ): Promise<boolean> {
    const locator = {
      sourceKind: sourceKind as CompanyImportCatalog["sources"][number]["sourceKind"],
      connectionId,
      mcpServerId,
    };
    const blocks = await deps.prisma.companySourceBlock.findMany({
      where: { spaceId: actor.spaceId, ownerUserId: actor.userId },
      select: { sourceKind: true, connectionId: true, mcpServerId: true, sourceKey: true },
    });
    return blocks.some(
      (block) =>
        block.sourceKey === companyPrivacySourceKey(locator) ||
        (block.sourceKind === sourceKind &&
          block.connectionId === null &&
          block.mcpServerId === null),
    );
  }

  async function catalog(actor: Actor): Promise<CompanyImportCatalog> {
    await assertMember(deps.prisma, actor);
    const dataRoomScope = await dataRoomWhere(deps.prisma, actor, {});
    const [items, folders, connections, mcpServers, blocks] = await Promise.all([
      deps.prisma.dataRoomItem.count({ where: dataRoomScope }),
      deps.prisma.dataRoomFolder.findMany({
        where: { spaceId: actor.spaceId, userId: actor.userId },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        select: { id: true, name: true },
      }),
      deps.prisma.connection.findMany({
        where: { spaceId: actor.spaceId, userId: actor.userId, status: "connected" },
        orderBy: [{ displayName: "asc" }, { id: "asc" }],
        select: {
          id: true,
          connectorId: true,
          provider: true,
          displayName: true,
          status: true,
          allAgents: true,
          privateByDefault: true,
        },
      }),
      deps.prisma.mcpServer.findMany({
        where: { spaceId: actor.spaceId, userId: actor.userId },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        select: { id: true, name: true, enabled: true },
      }),
      deps.prisma.companySourceBlock.findMany({
        where: { spaceId: actor.spaceId, ownerUserId: actor.userId },
        select: { sourceKind: true, connectionId: true, mcpServerId: true, sourceKey: true },
      }),
    ]);
    const blocked = (
      kind: string,
      connectionId: string | null,
      mcpServerId: string | null = null,
    ) => {
      const locator = {
        sourceKind: kind as CompanyImportCatalog["sources"][number]["sourceKind"],
        connectionId,
        mcpServerId,
      };
      return blocks.some(
        (block) =>
          block.sourceKey === companyPrivacySourceKey(locator) ||
          (block.sourceKind === kind && block.connectionId === null && block.mcpServerId === null),
      );
    };
    const sources: CompanyImportCatalog["sources"] = [
      {
        key: "data-room",
        sourceKind: "data_room",
        connectionId: null,
        label: "Data Room",
        available: !blocked("data_room", null),
        reason: blocked("data_room", null) ? "access_denied" : null,
        itemCount: items,
        defaultScope: {},
        connectPath: null,
      },
    ];
    let hasGmail = false;
    for (const connection of connections) {
      const kind = sourceKind(connection.provider);
      const gmail = kind === "gmail";
      const slack = kind === "slack";
      const github = kind === "github";
      const notion = kind === "notion";
      const generic = kind === "composio";
      hasGmail ||= gmail;
      const access = availableConnection(connection);
      const isSourceBlocked = blocked(kind, connection.id);
      let slackSupported = false;
      let trackerSupported = false;
      let documentSupported = false;
      let documentTools: NonNullable<CompanyImportCatalog["sources"][number]["tools"]> = [];
      if (slack && access && !isSourceBlocked && deps.slack) {
        try {
          slackSupported = await deps.slack.supports(
            {
              id: `catalog:${connection.id}`,
              sourceKind: kind,
              connectionId: connection.id,
              scope: { reader: "slack" },
            },
            {
              operationId: "company.import.catalog",
              traceId: `company.import.catalog:${connection.id}`,
              spaceId: actor.spaceId,
              userId: actor.userId,
              signal: new AbortController().signal,
            },
          );
        } catch {
          slackSupported = false;
        }
      }
      if (github && access && !isSourceBlocked && deps.tracker) {
        try {
          trackerSupported = await deps.tracker.supports(
            {
              id: `catalog:${connection.id}`,
              sourceKind: "github",
              connectionId: connection.id,
              scope: { reader: "github", allTime: true },
            },
            {
              operationId: "company.import.catalog",
              traceId: `company.import.catalog:${connection.id}`,
              spaceId: actor.spaceId,
              userId: actor.userId,
              signal: new AbortController().signal,
            },
          );
        } catch {
          trackerSupported = false;
        }
      }
      if ((notion || generic) && access && !isSourceBlocked && deps.documents) {
        try {
          const source = {
            id: `catalog:${connection.id}`,
            sourceKind: kind,
            connectionId: connection.id,
            scope: notion ? { reader: "notion", allTime: true } : { reader: "generic", tools: [] },
          };
          const tools = await deps.documents.listTools(source, {
            operationId: "company.import.catalog",
            traceId: `company.import.catalog:${connection.id}`,
            spaceId: actor.spaceId,
            userId: actor.userId,
            signal: new AbortController().signal,
          });
          documentSupported = notion
            ? [
                "NOTION_SEARCH_NOTION_PAGE",
                "NOTION_RETRIEVE_PAGE",
                "NOTION_FETCH_BLOCK_CONTENTS",
              ].every((name) => tools.some((tool) => tool.name === name))
            : tools.some((tool) => tool.readOnly === true);
          documentTools = tools
            .filter((tool) => notion || tool.readOnly === true)
            .map((tool) => ({
              name: tool.name,
              description:
                notion && tool.name === "NOTION_SEARCH_NOTION_PAGE"
                  ? `${tool.description} Search results are index-based and may be incomplete.`
                  : tool.description,
              inputSchema: tool.inputSchema,
              ...(tool.reportedCost ? { reportedCost: tool.reportedCost } : {}),
            }));
        } catch {
          documentSupported = false;
          documentTools = [];
        }
      }
      sources.push({
        key: `${kind}:${connection.id}`,
        sourceKind: kind,
        connectionId: connection.id,
        label: connection.displayName,
        available:
          (gmail || slackSupported || trackerSupported || documentSupported) &&
          access &&
          !isSourceBlocked,
        reason:
          isSourceBlocked || !access
            ? "access_denied"
            : gmail || slackSupported || trackerSupported || documentSupported
              ? null
              : "unsupported",
        itemCount: null,
        defaultScope: github
          ? CompanyTrackerScopeSchema.parse({ reader: "github" })
          : notion
            ? { reader: "notion", allTime: true }
            : generic
              ? { reader: "generic", tools: [] }
              : {},
        ...(documentTools.length ? { tools: documentTools } : {}),
        connectPath: gmail ? null : "/app/integrations",
      });
    }
    for (const server of mcpServers) {
      let mcpSupported = false;
      let mcpReader: "slack" | "linear" = "slack";
      const isSourceBlocked = blocked("mcp", null, server.id);
      if (server.enabled && deps.tracker && !isSourceBlocked) {
        try {
          mcpSupported = await deps.tracker.supports(
            {
              id: `catalog:${server.id}`,
              sourceKind: "mcp",
              connectionId: null,
              mcpServerId: server.id,
              scope: CompanyTrackerScopeSchema.parse({ reader: "linear" }),
            },
            {
              operationId: "company.import.catalog",
              traceId: `company.import.catalog:${server.id}`,
              spaceId: actor.spaceId,
              userId: actor.userId,
              signal: new AbortController().signal,
            },
          );
          if (mcpSupported) mcpReader = "linear";
        } catch {
          mcpSupported = false;
        }
      }
      if (!mcpSupported && server.enabled && deps.slack && !isSourceBlocked) {
        try {
          mcpSupported = await deps.slack.supports(
            {
              id: `catalog:${server.id}`,
              sourceKind: "mcp",
              connectionId: null,
              mcpServerId: server.id,
              scope: { reader: "slack" },
            },
            {
              operationId: "company.import.catalog",
              traceId: `company.import.catalog:${server.id}`,
              spaceId: actor.spaceId,
              userId: actor.userId,
              signal: new AbortController().signal,
            },
          );
        } catch {
          mcpSupported = false;
        }
      }
      sources.push({
        key: `mcp:${server.id}`,
        sourceKind: "mcp",
        connectionId: null,
        mcpServerId: server.id,
        label: server.name,
        available: mcpSupported && !isSourceBlocked,
        reason:
          isSourceBlocked || !server.enabled
            ? "access_denied"
            : mcpSupported
              ? null
              : "unsupported",
        itemCount: null,
        defaultScope:
          mcpReader === "linear"
            ? CompanyTrackerScopeSchema.parse({ reader: "linear" })
            : { reader: mcpReader },
        connectPath: "/app/integrations",
      });
    }
    if (!hasGmail) {
      const sourceBlocked = blocked("gmail", null);
      sources.push({
        key: "gmail:connect",
        sourceKind: "gmail",
        connectionId: null,
        label: "Gmail",
        available: false,
        reason: sourceBlocked ? "access_denied" : "not_connected",
        itemCount: null,
        defaultScope: {},
        connectPath: sourceBlocked ? null : GMAIL_CONNECT_PATH,
      });
    }
    return { sources, folders };
  }

  async function create(actor: Actor, input: CompanyImportCreateInput) {
    await assertMember(deps.prisma, actor);
    const seen = new Set<string>();
    const sources: Array<{
      source: CompanyImportSourceInput;
      normalizedScope: Record<string, unknown>;
      plan: CompanyImportPlan;
    }> = [];
    for (const source of input.sources) {
      const key = `${source.sourceKind}:${source.connectionId ?? source.mcpServerId ?? ""}`;
      if (seen.has(key)) throw new ORPCError("BAD_REQUEST", { message: "Duplicate source" });
      seen.add(key);
      if (
        await isBlocked(
          actor,
          source.sourceKind,
          source.connectionId ?? null,
          source.mcpServerId ?? null,
        )
      )
        throw new ORPCError("FORBIDDEN", { message: "Source access is denied" });
      if (
        source.sourceKind !== "data_room" &&
        source.sourceKind !== "gmail" &&
        source.sourceKind !== "slack" &&
        source.sourceKind !== "github" &&
        source.sourceKind !== "mcp" &&
        source.sourceKind !== "notion" &&
        source.sourceKind !== "composio"
      ) {
        throw new ORPCError("PRECONDITION_FAILED", { message: "Source is unsupported" });
      }
      if (source.sourceKind === "mcp") {
        const trackerSource = source.scope.reader === "linear";
        if (
          !source.mcpServerId ||
          source.connectionId ||
          (trackerSource ? !deps.tracker : source.scope.reader !== "slack" || !deps.slack)
        ) {
          throw new ORPCError("FORBIDDEN", { message: "MCP source access is denied" });
        }
        const server = await deps.prisma.mcpServer.findFirst({
          where: {
            id: source.mcpServerId,
            spaceId: actor.spaceId,
            userId: actor.userId,
            enabled: true,
          },
          select: { id: true },
        });
        if (!server) throw new ORPCError("FORBIDDEN", { message: "MCP source access is denied" });
        const supported = trackerSource
          ? await deps.tracker!.supports(
              {
                id: `create:${server.id}`,
                sourceKind: "mcp",
                connectionId: null,
                mcpServerId: server.id,
                scope: source.scope,
              },
              {
                operationId: "company.import.create",
                traceId: `company.import.create:${server.id}`,
                spaceId: actor.spaceId,
                userId: actor.userId,
                signal: new AbortController().signal,
              },
            )
          : await deps.slack!.supports(
              {
                id: `create:${server.id}`,
                sourceKind: "mcp",
                connectionId: null,
                mcpServerId: server.id,
                scope: source.scope,
              },
              {
                operationId: "company.import.create",
                traceId: `company.import.create:${server.id}`,
                spaceId: actor.spaceId,
                userId: actor.userId,
                signal: new AbortController().signal,
              },
            );
        if (!supported)
          throw new ORPCError("PRECONDITION_FAILED", { message: "Source is unsupported" });
      }
      if (source.sourceKind === "gmail" && !source.connectionId) {
        throw new ORPCError("PRECONDITION_FAILED", { message: "Gmail is not connected" });
      }
      if (source.sourceKind === "slack") {
        if (!source.connectionId || !deps.slack)
          throw new ORPCError("PRECONDITION_FAILED", { message: "Slack is not connected" });
        const connection = await deps.prisma.connection.findFirst({
          where: {
            id: source.connectionId,
            spaceId: actor.spaceId,
            userId: actor.userId,
            status: "connected",
          },
          select: {
            provider: true,
            status: true,
            allAgents: true,
            privateByDefault: true,
          },
        });
        if (
          !connection ||
          !["slack", "slack_v2"].includes(connection.provider) ||
          !availableConnection(connection)
        )
          throw new ORPCError("FORBIDDEN", { message: "Slack source access is denied" });
        const supported = await deps.slack.supports(
          {
            id: `create:${source.connectionId}`,
            sourceKind: "slack",
            connectionId: source.connectionId,
            scope: source.scope,
          },
          {
            operationId: "company.import.create",
            traceId: `company.import.create:${source.connectionId}`,
            spaceId: actor.spaceId,
            userId: actor.userId,
            signal: new AbortController().signal,
          },
        );
        if (!supported)
          throw new ORPCError("PRECONDITION_FAILED", { message: "Source is unsupported" });
      }
      if (source.sourceKind === "github") {
        if (!source.connectionId || !deps.tracker)
          throw new ORPCError("PRECONDITION_FAILED", { message: "GitHub is not connected" });
        const connection = await deps.prisma.connection.findFirst({
          where: {
            id: source.connectionId,
            spaceId: actor.spaceId,
            userId: actor.userId,
            status: "connected",
          },
          select: {
            provider: true,
            status: true,
            allAgents: true,
            privateByDefault: true,
          },
        });
        if (
          !connection ||
          sourceKind(connection.provider) !== "github" ||
          !availableConnection(connection)
        )
          throw new ORPCError("FORBIDDEN", { message: "GitHub source access is denied" });
        const supported = await deps.tracker.supports(
          {
            id: `create:${source.connectionId}`,
            sourceKind: "github",
            connectionId: source.connectionId,
            scope: source.scope,
          },
          {
            operationId: "company.import.create",
            traceId: `company.import.create:${source.connectionId}`,
            spaceId: actor.spaceId,
            userId: actor.userId,
            signal: new AbortController().signal,
          },
        );
        if (!supported)
          throw new ORPCError("PRECONDITION_FAILED", { message: "Source is unsupported" });
      }
      if (source.connectionId) {
        const connection = await deps.prisma.connection.findFirst({
          where: {
            id: source.connectionId,
            spaceId: actor.spaceId,
            userId: actor.userId,
            status: "connected",
          },
          select: { provider: true, status: true, allAgents: true, privateByDefault: true },
        });
        if (!connection || sourceKind(connection.provider) !== source.sourceKind) {
          throw new ORPCError("NOT_FOUND");
        }
        if (!availableConnection(connection)) {
          throw new ORPCError("FORBIDDEN", { message: "Source access is denied" });
        }
      }
      const planned = await sourcePlan(deps.prisma, actor, source, input.tokenCap, deps.documents);
      sources.push({ source, ...planned });
    }
    const created = await deps.engine.create(actor, {
      ...input,
      sources: sources.map(({ source, normalizedScope }) => ({
        ...source,
        scope: normalizedScope,
      })),
    });
    const sourceRows = await deps.prisma.companyImportSource.findMany({
      where: { runId: created.runId, spaceId: actor.spaceId, ownerUserId: actor.userId },
      select: { id: true, sourceKind: true, connectionId: true, mcpServerId: true },
    });
    const plans = new Map(
      sources.map(({ source, plan }) => [
        `${source.sourceKind}:${source.connectionId ?? ""}:${source.mcpServerId ?? ""}`,
        plan,
      ]),
    );
    await Promise.all(
      sourceRows.map((row) =>
        deps.prisma.companyImportSource.update({
          where: { id: row.id, spaceId: actor.spaceId, ownerUserId: actor.userId },
          data: {
            plan: plans.get(
              `${row.sourceKind}:${row.connectionId ?? ""}:${row.mcpServerId ?? ""}`,
            )!,
          },
        }),
      ),
    );
    return created;
  }

  async function session(actor: Actor, runId?: string): Promise<CompanyImportSession | null> {
    await assertMember(deps.prisma, actor);
    const run = await deps.prisma.companyImportRun.findFirst({
      where: {
        spaceId: actor.spaceId,
        ownerUserId: actor.userId,
        ...(runId ? { id: runId } : { status: { not: "discarded" } }),
      },
      orderBy: { createdAt: "desc" },
      include: {
        sources: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            sourceKind: true,
            connectionId: true,
            mcpServerId: true,
            scope: true,
            plan: true,
          },
        },
      },
    });
    if (!run) return null;
    if (run.mode === "sample") {
      for (const source of run.sources) {
        const usage = await deps.prisma.companyImportUnit.aggregate({
          where: {
            runId: run.id,
            sourceId: source.id,
            spaceId: actor.spaceId,
            ownerUserId: actor.userId,
          },
          _sum: { itemsRead: true, inputTokensUsed: true, outputTokensUsed: true },
        });
        const current = CompanyImportPlanSchema.safeParse(source.plan);
        const itemCount = current.success ? current.data.itemCount : null;
        const next = {
          ...companyImportEstimate(itemCount, Number(run.tokenCap), {
            itemsRead: usage._sum.itemsRead ?? 0,
            tokensUsed: Number(
              (usage._sum.inputTokensUsed ?? 0n) + (usage._sum.outputTokensUsed ?? 0n),
            ),
          }),
          ...(current.success && current.data.perCallCosts
            ? { perCallCosts: current.data.perCallCosts }
            : {}),
        };
        if (JSON.stringify(source.plan) !== JSON.stringify(next)) {
          await deps.prisma.companyImportSource.update({
            where: { id: source.id, spaceId: actor.spaceId, ownerUserId: actor.userId },
            data: { plan: next },
          });
          source.plan = next;
        }
      }
    }
    const [connections, mcpServers] = await Promise.all([
      deps.prisma.connection.findMany({
        where: {
          spaceId: actor.spaceId,
          userId: actor.userId,
          id: {
            in: run.sources.flatMap((source) => (source.connectionId ? [source.connectionId] : [])),
          },
        },
        select: { id: true, displayName: true },
      }),
      deps.prisma.mcpServer.findMany({
        where: {
          spaceId: actor.spaceId,
          userId: actor.userId,
          id: {
            in: run.sources.flatMap((source) => (source.mcpServerId ? [source.mcpServerId] : [])),
          },
        },
        select: { id: true, name: true },
      }),
    ]);
    const labels = new Map(
      connections.map((connection) => [connection.id, connection.displayName]),
    );
    const serverLabels = new Map(mcpServers.map((server) => [server.id, server.name]));
    const progress = await deps.engine.progress(actor, run.id);
    return {
      mode: run.mode === "sample" ? "sample" : "full",
      progress,
      sources: run.sources.map((source) => ({
        id: source.id,
        label:
          (source.connectionId ? labels.get(source.connectionId) : undefined) ??
          (source.mcpServerId ? serverLabels.get(source.mcpServerId) : undefined) ??
          (source.sourceKind === "data_room" ? "Data Room" : source.sourceKind),
        sourceKind: source.sourceKind as CompanyImportSession["sources"][number]["sourceKind"],
        connectionId: source.connectionId,
        mcpServerId: source.mcpServerId,
        scope: source.scope as Record<string, unknown>,
        plan: CompanyImportPlanSchema.safeParse(source.plan).success
          ? (source.plan as CompanyImportPlan)
          : planFor(null, Number(run.tokenCap)),
      })),
    };
  }

  async function sample(actor: Actor, runId: string): Promise<CompanyImportSample> {
    await assertMember(deps.prisma, actor);
    const run = await deps.prisma.companyImportRun.findFirst({
      where: { id: runId, spaceId: actor.spaceId, ownerUserId: actor.userId, mode: "sample" },
      select: { id: true },
    });
    if (!run) throw new ORPCError("NOT_FOUND");
    const [sources, observations] = await Promise.all([
      deps.prisma.companyImportSource.findMany({
        where: { runId, spaceId: actor.spaceId, ownerUserId: actor.userId },
        select: { id: true, sourceKind: true, connectionId: true, mcpServerId: true },
      }),
      deps.prisma.companyImportEvidence.findMany({
        where: { runId, spaceId: actor.spaceId, ownerUserId: actor.userId },
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
      }),
    ]);
    const rows = observations
      .map(({ evidence }) => {
        const source = sources.find(
          (candidate) =>
            candidate.sourceKind === evidence.sourceKind &&
            candidate.connectionId === evidence.connectionId &&
            candidate.mcpServerId === evidence.mcpServerId,
        );
        return source ? { sourceId: source.id, evidence } : null;
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
    const entities = await deps.prisma.companyEntity.findMany({
      where: {
        spaceId: actor.spaceId,
        ownerUserId: actor.userId,
        id: {
          in: rows
            .filter(({ evidence }) => evidence.factKind === "entity")
            .map(({ evidence }) => evidence.factId),
        },
      },
      select: { id: true, displayName: true },
    });
    const events = await deps.prisma.companyEvent.findMany({
      where: {
        spaceId: actor.spaceId,
        ownerUserId: actor.userId,
        id: {
          in: rows
            .filter(({ evidence }) => evidence.factKind === "event")
            .map(({ evidence }) => evidence.factId),
        },
      },
      select: { id: true, title: true },
    });
    const edges = await deps.prisma.companyEdge.findMany({
      where: {
        spaceId: actor.spaceId,
        ownerUserId: actor.userId,
        id: {
          in: rows
            .filter(({ evidence }) => evidence.factKind === "edge")
            .map(({ evidence }) => evidence.factId),
        },
      },
      select: {
        id: true,
        relation: true,
        fromEntity: { select: { displayName: true } },
        toEntity: { select: { displayName: true } },
      },
    });
    const entityNames = new Map(entities.map((row) => [row.id, row.displayName]));
    const eventNames = new Map(events.map((row) => [row.id, row.title]));
    const edgeTitles = new Map(
      edges.map((row) => [
        row.id,
        `${row.fromEntity.displayName} ${row.relation.replaceAll("_", " ")} ${row.toEntity.displayName}`,
      ]),
    );
    const grouped = new Map<string, CompanyImportSample[number]>();
    for (const { sourceId, evidence } of rows) {
      const key = `${sourceId}:${evidence.sourceItemId}`;
      const group = grouped.get(key) ?? { sourceId, items: [] };
      let title = evidence.factKind;
      if (evidence.factKind === "entity") title = entityNames.get(evidence.factId) ?? title;
      if (evidence.factKind === "event") title = eventNames.get(evidence.factId) ?? title;
      if (evidence.factKind === "edge") title = edgeTitles.get(evidence.factId) ?? title;
      let item = group.items.find((candidate) => candidate.sourceItemId === evidence.sourceItemId);
      if (!item) {
        if (group.items.length >= 25) continue;
        item = { sourceItemId: evidence.sourceItemId, facts: [] };
        group.items.push(item);
      }
      item.facts.push({
        kind: evidence.factKind as "entity" | "edge" | "event",
        title,
        confidence: evidence.confidence,
        quote: evidence.quote,
      });
      grouped.set(key, group);
    }
    const bySource = new Map<string, CompanyImportSample[number]>();
    for (const group of grouped.values()) {
      const existing = bySource.get(group.sourceId);
      if (existing) existing.items.push(...group.items);
      else bySource.set(group.sourceId, group);
    }
    return [...bySource.values()].map((group) => ({ ...group, items: group.items.slice(0, 25) }));
  }

  async function requireConsent(actor: Actor, runId: string) {
    const current = await session(actor, runId);
    if (!current) throw new ORPCError("NOT_FOUND");
    for (const source of current.sources) {
      const consent = await deps.engine.consentStatus(actor, runId, source.id);
      if (!consent.allowed)
        throw new ORPCError("PRECONDITION_FAILED", { message: "Consent is required" });
    }
  }

  async function channels(
    actor: Actor,
    input: CompanyImportChannelsInput,
  ): Promise<CompanyImportChannels> {
    await assertMember(deps.prisma, actor);
    if (!deps.slack) {
      throw new ORPCError("PRECONDITION_FAILED", { message: "Slack reader is unavailable" });
    }
    if (
      await isBlocked(
        actor,
        input.sourceKind,
        input.connectionId ?? null,
        input.mcpServerId ?? null,
      )
    )
      throw new ORPCError("FORBIDDEN", { message: "Source access is denied" });
    const source = {
      id: `channels:${input.connectionId ?? input.mcpServerId}`,
      sourceKind: input.sourceKind,
      connectionId: input.connectionId ?? null,
      mcpServerId: input.mcpServerId ?? null,
      scope: { reader: "slack" },
    };
    const context: AdapterContext = {
      operationId: "company.import.channels",
      traceId: `company.import.channels:${source.id}`,
      spaceId: actor.spaceId,
      userId: actor.userId,
      signal: new AbortController().signal,
    };
    return deps.slack.channels(
      { source, cursor: input.cursor ?? null, includePrivate: input.includePrivate, limit: 100 },
      context,
    );
  }

  return {
    catalog,
    create,
    channels,
    session,
    sample,
    start: async (actor: Actor, runId: string) => {
      await requireConsent(actor, runId);
      return deps.engine.start(actor, runId);
    },
    action: async (
      actor: Actor,
      runId: string,
      action: "pause" | "resume" | "continue" | "retry_failed" | "cancel" | "discard",
      tokenCap?: number,
    ) => {
      if (action === "resume" || action === "continue" || action === "retry_failed")
        await requireConsent(actor, runId);
      return deps.engine.action(actor, runId, action, tokenCap);
    },
  };
}

export type CompanyImportPage = ReturnType<typeof createCompanyImportPage>;
