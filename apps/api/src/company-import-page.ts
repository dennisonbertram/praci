import { ORPCError } from "@orpc/server";
import type { CompanyImportEngine } from "@rakazo/adapters";
import { companySourceScope } from "@rakazo/adapters";
import type {
  Actor,
  CompanyImportCatalog,
  CompanyImportCreateInput,
  CompanyImportPlan,
  CompanyImportSample,
  CompanyImportSession,
  CompanyImportSourceInput,
} from "@rakazo/contracts";
import {
  CompanyDataRoomScopeSchema,
  CompanyImportPlanSchema,
  CompanySourceKindSchema,
} from "@rakazo/contracts";
import type { Prisma, PrismaClient } from "@rakazo/db";
import { companyImportEstimate } from "./company-import-estimate.js";

const GMAIL_CONNECT_PATH = "/app/integrations?connect=gmail&returnTo=%2Fapp%2Fcompany%2Fimport";

type PageDeps = { prisma: PrismaClient; engine: CompanyImportEngine };

function sourceKind(provider: string): CompanyImportCatalog["sources"][number]["sourceKind"] {
  const value = provider.toLowerCase();
  if (CompanySourceKindSchema.options.includes(value as never))
    return value as CompanyImportCatalog["sources"][number]["sourceKind"];
  return value === "mcp" ? "mcp" : "composio";
}

function planFor(itemCount: number | null, tokenCap: number): CompanyImportPlan {
  return companyImportEstimate(itemCount, tokenCap);
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
  return { normalizedScope, plan: planFor(null, tokenCap) };
}

export function createCompanyImportPage(deps: PageDeps) {
  async function catalog(actor: Actor): Promise<CompanyImportCatalog> {
    await assertMember(deps.prisma, actor);
    const dataRoomScope = await dataRoomWhere(deps.prisma, actor, {});
    const [items, folders, connections, mcpServers] = await Promise.all([
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
        select: { id: true, name: true },
      }),
    ]);
    const sources: CompanyImportCatalog["sources"] = [
      {
        key: "data-room",
        sourceKind: "data_room",
        connectionId: null,
        label: "Data Room",
        available: true,
        reason: null,
        itemCount: items,
        defaultScope: {},
        connectPath: null,
      },
    ];
    let hasGmail = false;
    for (const connection of connections) {
      const kind = sourceKind(connection.provider);
      const gmail = kind === "gmail";
      hasGmail ||= gmail;
      const access = availableConnection(connection);
      sources.push({
        key: `${kind}:${connection.id}`,
        sourceKind: kind,
        connectionId: connection.id,
        label: connection.displayName,
        available: gmail && access,
        reason: !access ? "access_denied" : gmail ? null : "unsupported",
        itemCount: null,
        defaultScope: {},
        connectPath: gmail ? null : "/app/integrations",
      });
    }
    for (const server of mcpServers) {
      sources.push({
        key: `mcp:${server.id}`,
        sourceKind: "mcp",
        connectionId: null,
        label: server.name,
        available: false,
        reason: "unsupported",
        itemCount: null,
        defaultScope: {},
        connectPath: "/app/integrations",
      });
    }
    if (!hasGmail) {
      sources.push({
        key: "gmail:connect",
        sourceKind: "gmail",
        connectionId: null,
        label: "Gmail",
        available: false,
        reason: "not_connected",
        itemCount: null,
        defaultScope: {},
        connectPath: GMAIL_CONNECT_PATH,
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
      const key = `${source.sourceKind}:${source.connectionId ?? ""}`;
      if (seen.has(key)) throw new ORPCError("BAD_REQUEST", { message: "Duplicate source" });
      seen.add(key);
      if (source.sourceKind !== "data_room" && source.sourceKind !== "gmail") {
        throw new ORPCError("PRECONDITION_FAILED", { message: "Source is unsupported" });
      }
      if (source.sourceKind === "gmail" && !source.connectionId) {
        throw new ORPCError("PRECONDITION_FAILED", { message: "Gmail is not connected" });
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
      const planned = await sourcePlan(deps.prisma, actor, source, input.tokenCap);
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
      select: { id: true, sourceKind: true, connectionId: true },
    });
    const plans = new Map(
      sources.map(({ source, plan }) => [
        `${source.sourceKind}:${source.connectionId ?? ""}`,
        plan,
      ]),
    );
    await Promise.all(
      sourceRows.map((row) =>
        deps.prisma.companyImportSource.update({
          where: { id: row.id, spaceId: actor.spaceId, ownerUserId: actor.userId },
          data: { plan: plans.get(`${row.sourceKind}:${row.connectionId ?? ""}`)! },
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
        const next = companyImportEstimate(itemCount, Number(run.tokenCap), {
          itemsRead: usage._sum.itemsRead ?? 0,
          tokensUsed: Number(
            (usage._sum.inputTokensUsed ?? 0n) + (usage._sum.outputTokensUsed ?? 0n),
          ),
        });
        if (JSON.stringify(source.plan) !== JSON.stringify(next)) {
          await deps.prisma.companyImportSource.update({
            where: { id: source.id, spaceId: actor.spaceId, ownerUserId: actor.userId },
            data: { plan: next },
          });
          source.plan = next;
        }
      }
    }
    const connections = await deps.prisma.connection.findMany({
      where: {
        spaceId: actor.spaceId,
        userId: actor.userId,
        id: {
          in: run.sources.flatMap((source) => (source.connectionId ? [source.connectionId] : [])),
        },
      },
      select: { id: true, displayName: true },
    });
    const labels = new Map(
      connections.map((connection) => [connection.id, connection.displayName]),
    );
    const progress = await deps.engine.progress(actor, run.id);
    return {
      mode: run.mode === "sample" ? "sample" : "full",
      progress,
      sources: run.sources.map((source) => ({
        id: source.id,
        label:
          (source.connectionId ? labels.get(source.connectionId) : undefined) ??
          (source.sourceKind === "data_room" ? "Data Room" : source.sourceKind),
        sourceKind: source.sourceKind as CompanyImportSession["sources"][number]["sourceKind"],
        connectionId: source.connectionId,
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
        select: { id: true, sourceKind: true, connectionId: true },
      }),
      deps.prisma.companyImportEvidence.findMany({
        where: { runId, spaceId: actor.spaceId, ownerUserId: actor.userId },
        select: {
          evidence: {
            select: {
              sourceKind: true,
              connectionId: true,
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
            candidate.connectionId === evidence.connectionId,
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

  return {
    catalog,
    create,
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
