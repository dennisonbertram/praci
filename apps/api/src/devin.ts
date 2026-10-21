import { randomUUID } from "node:crypto";
import { ORPCError } from "@orpc/server";
import type { JobPublisher } from "@rakazo/adapter-kit";
import type { DevinCallTool, McpConnector } from "@rakazo/adapters";
import { buildMcpCredentialBlob, refreshDevinConnection } from "@rakazo/adapters";
import type { Actor, Bot, DevinSessionsOutput } from "@rakazo/contracts";
import {
  actorScope,
  DEVIN_MCP_ENDPOINT,
  DEVIN_SESSION_KINDS,
  isDevinEndpoint,
} from "@rakazo/contracts";
import type { NotificationEvents, Prisma, PrismaClient } from "@rakazo/db";
import { isSpaceOwnerRole, requireSpaceOwner } from "./space-owner.js";

export interface DevinDeps {
  prisma: PrismaClient;
  jobs: JobPublisher;
  secrets: { put(plaintext: string, context: never): Promise<{ id: string; ciphertext: string }> };
  mcp: Pick<McpConnector, "listServerTools">;
  /** The one reader of Devin for the page; fakes stand in for it in tests. */
  callTool: DevinCallTool;
  /** Live signal for the alert a page-triggered refresh sends. */
  notificationEvents?: NotificationEvents;
  /** The integration agent of a server in the actor's scope, made exclusive and read-only. */
  provisionAgent: (actor: Actor, serverId: string) => Promise<Bot>;
  archiveBot: (actor: Actor, botId: string) => Promise<void>;
}

/** A page read older than this runs the refresh operation itself. */
const CACHE_TTL_MS = 60_000;
const CONFLICT_MESSAGE = "Devin is already connected in this space";
const REFUSED_MESSAGE = "The key was refused.";

const lockConnection = (tx: Prisma.TransactionClient, spaceId: string) =>
  tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('devin-connect'), hashtext(${spaceId}))`;

/** Every Devin RPC needs a current membership; returns whether the member owns the space. */
async function memberRole(deps: DevinDeps, actor: Actor): Promise<{ owner: boolean }> {
  const member = await deps.prisma.spaceMember.findUnique({
    where: { spaceId_userId: { spaceId: actor.spaceId, userId: actor.userId } },
    select: { role: true },
  });
  if (!member) throw new ORPCError("FORBIDDEN");
  return { owner: isSpaceOwnerRole(member.role) };
}

const activeState = (deps: Pick<DevinDeps, "prisma">, spaceId: string) =>
  deps.prisma.devinConnectionState.findUnique({
    where: { spaceId },
    include: { server: { select: { userId: true, agentBotId: true } } },
  });

type DeletedServer = {
  userId: string;
  spaceId: string;
  secretId: string | null;
  agentBotId: string | null;
};

/**
 * Deletes a server row (the cascade removes the connection state and cached sessions), its key
 * and its agent's record, scoped by the row's own owner because the acting owner may not be the
 * one who connected. The deleted row says which agent it had at that moment.
 */
async function deleteServerRows(
  tx: Prisma.TransactionClient,
  serverId: string,
): Promise<DeletedServer | null> {
  const [row] = await tx.$queryRaw<DeletedServer[]>`
    DELETE FROM mcp_servers WHERE id = ${serverId}
    RETURNING "userId", "spaceId", "secretId", "agentBotId"`;
  if (!row) return null;
  const scope = actorScope(row);
  if (row.secretId) await tx.secret.deleteMany({ where: { id: row.secretId, ...scope } });
  if (row.agentBotId)
    await tx.bot.updateMany({
      where: { id: row.agentBotId, ...scope, archivedAt: null },
      data: { archivedAt: new Date(), pinned: false },
    });
  return row;
}

/** Cleans up what archiving the agent leaves behind (runs, computer); the archive itself is done. */
async function finishAgentArchive(deps: DevinDeps, row: DeletedServer | null): Promise<void> {
  if (!row?.agentBotId) return;
  const owner: Actor = { ...actorScope(row), email: "", isDeploymentOwner: false };
  await deps.archiveBot(owner, row.agentBotId).catch(() => undefined);
}

async function removeServer(deps: DevinDeps, serverId: string): Promise<void> {
  await finishAgentArchive(
    deps,
    await deps.prisma.$transaction((tx) => deleteServerRows(tx, serverId)),
  );
}

/**
 * Stores the key on a new server row in the acting owner's scope and checks it: the tool list and
 * one search, so a key without session access is refused now. A refused key leaves nothing.
 */
async function createCheckedServer(deps: DevinDeps, actor: Actor, secret: string) {
  const blob = buildMcpCredentialBlob({ secret });
  const stored = await deps.secrets.put(
    blob as string,
    {
      operationId: "devin.connect",
      traceId: "devin.connect",
      spaceId: actor.spaceId,
      userId: actor.userId,
      botId: "mcp",
      signal: new AbortController().signal,
    } as never,
  );
  const row = await deps.prisma.$transaction(async (tx) => {
    await tx.secret.create({
      data: {
        id: stored.id,
        ...actorScope(actor),
        kind: "mcp",
        ciphertext: stored.ciphertext,
      },
    });
    return tx.mcpServer.create({
      data: {
        ...actorScope(actor),
        slug: `devin-${randomUUID().slice(0, 8)}`,
        name: "Devin",
        description: "",
        transport: "streamable_http",
        endpoint: DEVIN_MCP_ENDPOINT,
        secretId: stored.id,
        enabled: true,
      },
    });
  });
  try {
    await deps.mcp.listServerTools(
      row,
      {
        operationId: "devin.connect",
        traceId: "devin.connect",
        spaceId: actor.spaceId,
        userId: actor.userId,
        botId: "mcp",
        signal: new AbortController().signal,
      },
      { fresh: true },
    );
    await deps.callTool(row.id, "devin_session_search", { first: 1 }, AbortSignal.timeout(15_000));
  } catch {
    await removeServer(deps, row.id);
    throw new ORPCError("BAD_REQUEST", { message: REFUSED_MESSAGE });
  }
  return row;
}

const refreshJob = (serverId: string) =>
  ({
    name: "devin.refresh",
    payload: { serverId },
    replaceKey: `devin.refresh:${serverId}`,
    maxAttempts: 3,
  }) as const;

/**
 * Connects the space: a checked server in the owner's scope with its agent, then the one state row.
 * The state row decides a race: the loser's server and agent are removed.
 */
export async function devinConnect(deps: DevinDeps, actor: Actor, secret: string): Promise<void> {
  await requireSpaceOwner(deps.prisma, actor);
  if (await activeState(deps, actor.spaceId)) {
    throw new ORPCError("CONFLICT", { message: CONFLICT_MESSAGE });
  }
  const row = await createCheckedServer(deps, actor, secret);
  try {
    await deps.provisionAgent(actor, row.id);
    await deps.prisma.$transaction(async (tx) => {
      await lockConnection(tx, actor.spaceId);
      if (await tx.devinConnectionState.findUnique({ where: { spaceId: actor.spaceId } })) {
        throw new ORPCError("CONFLICT", { message: CONFLICT_MESSAGE });
      }
      await tx.devinConnectionState.create({ data: { serverId: row.id, spaceId: actor.spaceId } });
    });
  } catch (error) {
    await removeServer(deps, row.id);
    throw error;
  }
  await deps.jobs.enqueue(refreshJob(row.id));
}

/**
 * Replaces the key. The candidate is checked on a separate server first, so a refused key changes
 * nothing. The cache is deleted with the old server: a key for another organization must never mix
 * with the old rows or alert state.
 */
export async function devinReplaceKey(
  deps: DevinDeps,
  actor: Actor,
  secret: string,
): Promise<void> {
  await requireSpaceOwner(deps.prisma, actor);
  if (!(await activeState(deps, actor.spaceId))) {
    throw new ORPCError("NOT_FOUND", { message: "Devin is not connected in this space" });
  }
  const row = await createCheckedServer(deps, actor, secret);
  let oldServerId: string;
  try {
    await deps.provisionAgent(actor, row.id);
    oldServerId = await deps.prisma.$transaction(async (tx) => {
      await lockConnection(tx, actor.spaceId);
      const current = await tx.devinConnectionState.findUnique({
        where: { spaceId: actor.spaceId },
      });
      if (!current) throw new ORPCError("CONFLICT", { message: "Devin was disconnected" });
      // State first, then rows: the refresh takes its locks in that order.
      await tx.devinConnectionState.update({
        where: { serverId: current.serverId },
        data: {
          serverId: row.id,
          version: { increment: 1 },
          leaseToken: null,
          leaseUntil: null,
          lastSucceededAt: null,
          complete: false,
          skipped: 0,
          backoffUntil: null,
          backoffStep: 0,
          rejectedAt: null,
          lastError: null,
        },
      });
      await tx.devinSession.deleteMany({ where: { serverId: current.serverId } });
      return current.serverId;
    });
  } catch (error) {
    await removeServer(deps, row.id);
    throw error;
  }
  await removeServer(deps, oldServerId);
  await deps.jobs.enqueue(refreshJob(row.id));
}

/**
 * Disconnects the space. With `serverId`, only if that server is still the active connection, so a
 * stale request cannot remove the connection that replaced it.
 */
export async function devinDisconnect(
  deps: DevinDeps,
  actor: Actor,
  serverId?: string,
): Promise<void> {
  await requireSpaceOwner(deps.prisma, actor);
  const removed = await deps.prisma.$transaction(async (tx) => {
    await lockConnection(tx, actor.spaceId);
    const state = await tx.devinConnectionState.findUnique({ where: { spaceId: actor.spaceId } });
    if (!state || (serverId && state.serverId !== serverId)) return null;
    return deleteServerRows(tx, state.serverId);
  });
  await finishAgentArchive(deps, removed);
}

/** The connector's agent, or null for every other member. */
export async function devinAgent(deps: DevinDeps, actor: Actor): Promise<{ bot: Bot } | null> {
  await memberRole(deps, actor);
  const state = await activeState(deps, actor.spaceId);
  if (!state || state.server.userId !== actor.userId) return null;
  return { bot: await deps.provisionAgent(actor, state.serverId) };
}

const GROUP = { needs_you: 0, error: 1, working: 2 } as const;
const kindOf = (kind: string) =>
  (DEVIN_SESSION_KINDS as readonly string[]).includes(kind)
    ? (kind as (typeof DEVIN_SESSION_KINDS)[number])
    : "unknown";

function prsOf(value: unknown): Array<{ url: string; state: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) =>
    item && typeof item.url === "string" && typeof item.state === "string"
      ? [{ url: item.url, state: item.state }]
      : [],
  );
}

/** The cached sessions for any member; a read older than a minute runs the refresh operation first. */
export async function devinSessions(deps: DevinDeps, actor: Actor): Promise<DevinSessionsOutput> {
  const { owner } = await memberRole(deps, actor);
  let state = await activeState(deps, actor.spaceId);
  if (!state) {
    return {
      connection: {
        status: "none",
        manage: owner,
        canConnect: owner,
        isConnector: false,
        agentBotId: null,
      },
      fetchedAt: null,
      stale: false,
      partial: false,
      sessions: [],
    };
  }
  const now = Date.now();
  if (
    !state.rejectedAt &&
    !(state.backoffUntil && state.backoffUntil.getTime() > now) &&
    (!state.lastSucceededAt || now - state.lastSucceededAt.getTime() > CACHE_TTL_MS)
  ) {
    await refreshDevinConnection(
      { prisma: deps.prisma, callTool: deps.callTool, notificationEvents: deps.notificationEvents },
      state.serverId,
    ).catch(() => undefined);
    state = (await activeState(deps, actor.spaceId)) ?? state;
  }
  const rows = await deps.prisma.devinSession.findMany({
    where: { serverId: state.serverId, spaceId: actor.spaceId },
    orderBy: { devinUpdatedAt: "desc" },
  });
  const status = state.rejectedAt
    ? "rejected"
    : state.lastError === "connector_gone" ||
        state.lastError === "rate_limited" ||
        state.lastError === "unreachable"
      ? state.lastError
      : "ok";
  const sessions = rows
    .map((row) => ({
      id: row.sessionId,
      title: row.title,
      kind: kindOf(row.kind),
      status: row.status,
      statusDetail: row.statusDetail,
      question: row.question,
      prs: prsOf(row.prs),
      origin: row.origin,
      updatedAt: row.devinUpdatedAt.toISOString(),
    }))
    // Array.sort is stable, so the newest-first order holds inside a group.
    .sort(
      (a, b) =>
        (GROUP[a.kind as keyof typeof GROUP] ?? 3) - (GROUP[b.kind as keyof typeof GROUP] ?? 3),
    );
  return {
    connection: {
      status,
      manage: owner,
      canConnect: false,
      isConnector: state.server.userId === actor.userId,
      agentBotId: state.server.agentBotId,
    },
    fetchedAt: state.lastSucceededAt?.toISOString() ?? null,
    stale: status !== "ok",
    partial: state.lastSucceededAt !== null && (!state.complete || state.skipped > 0),
    sessions,
  };
}

/** Whether the space has a Devin connection, whatever its health. */
export async function devinConnected(
  deps: Pick<DevinDeps, "prisma">,
  actor: Actor,
): Promise<boolean> {
  return (await deps.prisma.devinConnectionState.count({ where: { spaceId: actor.spaceId } })) > 0;
}

/**
 * Sessions that need a person on the space's active connection. Zero while alerts are paused:
 * a rejected key or a connector who left.
 */
export async function devinNeedsYouCount(
  deps: Pick<DevinDeps, "prisma">,
  actor: Actor,
): Promise<number> {
  const state = await deps.prisma.devinConnectionState.findUnique({
    where: { spaceId: actor.spaceId },
    select: { serverId: true, rejectedAt: true, lastError: true },
  });
  if (!state || state.rejectedAt || state.lastError === "connector_gone") return 0;
  return deps.prisma.devinSession.count({
    where: {
      serverId: state.serverId,
      spaceId: actor.spaceId,
      kind: { in: ["needs_you", "error"] },
    },
  });
}

/**
 * Guard for the generic `mcp.servers.*` routes. The space's active Devin row may be changed only
 * by a space owner, whoever connected it. Returns whether `serverId` is that row.
 */
export async function requireOwnerForActiveDevinRow(
  prisma: PrismaClient,
  actor: Actor,
  serverId: string,
): Promise<boolean> {
  const state = await prisma.devinConnectionState.findUnique({
    where: { serverId },
    select: { spaceId: true },
  });
  if (state?.spaceId !== actor.spaceId) return false;
  await requireSpaceOwner(prisma, actor);
  return true;
}

/**
 * A second enabled Devin endpoint in a space whose connection is another server is refused.
 * A private Devin row is still allowed while the space has no connection.
 */
export async function assertNoOtherDevinConnection(
  prisma: PrismaClient,
  actor: Actor,
  next: { endpoint: string | null; enabled: boolean },
  serverId?: string,
): Promise<void> {
  if (!next.enabled || !isDevinEndpoint(next.endpoint)) return;
  const state = await prisma.devinConnectionState.findUnique({
    where: { spaceId: actor.spaceId },
    select: { serverId: true },
  });
  if (state && state.serverId !== serverId) {
    throw new ORPCError("CONFLICT", { message: CONFLICT_MESSAGE });
  }
}
