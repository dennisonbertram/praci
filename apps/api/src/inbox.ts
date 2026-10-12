import { ORPCError } from "@orpc/server";
import type { AdapterContext, MailAccount, MailAddress, MailProvider } from "@rakazo/adapter-kit";
import { MailProviderError } from "@rakazo/adapter-kit";
import { isMailConnection, syncMailbox } from "@rakazo/adapters";
import type { Actor, InboxListOutput } from "@rakazo/contracts";
import { inboxAgentSpawnKey } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { Prisma } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";

export interface InboxDeps {
  prisma: PrismaClient;
  mail: MailProvider;
}

const WINDOW_MS = 14 * 86_400_000;
const MAX_ROWS = 200;
const SYNC_PARALLELISM = 4;

const notFound = () => new ORPCError("NOT_FOUND", { message: "Not found" });

function mailContext(actor: Actor, operationId: string, signal?: AbortSignal): AdapterContext {
  return {
    operationId,
    traceId: operationId,
    spaceId: actor.spaceId,
    userId: actor.userId,
    signal: signal ?? new AbortController().signal,
  };
}

/** The actor's connected mail connections, read from Postgres only. */
async function connectedMailConnections(prisma: PrismaClient, actor: Actor) {
  const rows = await prisma.connection.findMany({
    where: { spaceId: actor.spaceId, userId: actor.userId, status: "connected" },
    orderBy: { createdAt: "asc" },
  });
  return rows.filter(isMailConnection);
}

function formatAddress(address: MailAddress | null | undefined): string {
  if (!address) return "";
  return address.name ? `${address.name} <${address.address}>` : address.address;
}

export async function inboxList(
  deps: InboxDeps,
  actor: Actor,
  input: { connectionId?: string },
): Promise<InboxListOutput> {
  const { prisma } = deps;
  const connections = await connectedMailConnections(prisma, actor);
  if (input.connectionId && !connections.some((c) => c.id === input.connectionId)) {
    throw notFound();
  }
  const selected = connections.filter((c) => !input.connectionId || c.id === input.connectionId);
  const ids = selected.map((c) => c.id);

  const agent = await prisma.bot.findFirst({
    where: {
      spaceId: actor.spaceId,
      userId: actor.userId,
      spawnKey: inboxAgentSpawnKey(actor.userId),
      archivedAt: null,
    },
    select: { id: true, name: true },
  });
  const accounts = connections.map((c) => ({ connectionId: c.id, label: c.displayName }));
  const agentOut = agent ? { botId: agent.id, name: agent.name } : null;
  if (ids.length === 0) {
    return { accounts, agent: agentOut, rows: [], syncedAt: null, failedAccounts: [] };
  }

  const [messages, states] = await Promise.all([
    prisma.cachedMailMessage.findMany({
      where: {
        spaceId: actor.spaceId,
        userId: actor.userId,
        connectionId: { in: ids },
        inInbox: true,
        receivedAt: { gte: new Date(Date.now() - WINDOW_MS) },
      },
      orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
      take: MAX_ROWS,
    }),
    prisma.mailSyncState.findMany({ where: { connectionId: { in: ids } } }),
  ]);

  const seen = new Set<string>();
  const rows = messages.flatMap((m) => {
    const thread = `${m.connectionId}:${m.threadId}`;
    if (seen.has(thread)) return [];
    seen.add(thread);
    return [
      {
        id: m.id,
        connectionId: m.connectionId,
        threadId: m.threadId,
        from: m.fromName || m.fromAddress,
        subject: m.subject,
        snippet: m.snippet,
        receivedAt: m.receivedAt.toISOString(),
        unread: m.unread,
        needsReply: m.needsReply,
      },
    ];
  });
  const synced = states.flatMap((s) => (s.lastSyncedAt ? [s.lastSyncedAt.getTime()] : []));
  return {
    accounts,
    agent: agentOut,
    rows,
    syncedAt: synced.length ? new Date(Math.max(...synced)).toISOString() : null,
    failedAccounts: states.filter((s) => s.lastErrorAt).map((s) => s.connectionId),
  };
}

export async function inboxRefresh(
  deps: InboxDeps,
  actor: Actor,
  input: { connectionId?: string },
  signal?: AbortSignal,
): Promise<{ ok: true }> {
  const context = mailContext(actor, "inbox.refresh", signal);
  const mine = await deps.mail.listAccounts(
    { spaceId: actor.spaceId, userId: actor.userId },
    context,
  );
  if (input.connectionId && !mine.some((a) => a.id === input.connectionId)) throw notFound();
  const accounts = mine.filter((a) => !input.connectionId || a.id === input.connectionId);

  // At most four accounts at a time; syncMailbox records provider errors instead of throwing.
  const queue = [...accounts];
  const worker = async () => {
    for (let account = queue.shift(); account; account = queue.shift()) {
      await syncMailbox(deps, account, context);
    }
  };
  await Promise.all(Array.from({ length: Math.min(SYNC_PARALLELISM, accounts.length) }, worker));
  return { ok: true };
}

export async function inboxGet(
  deps: InboxDeps,
  actor: Actor,
  input: { messageId: string },
  signal?: AbortSignal,
) {
  const row = await deps.prisma.cachedMailMessage.findFirst({
    where: { id: input.messageId, spaceId: actor.spaceId, userId: actor.userId },
  });
  if (!row) throw notFound();
  const context = mailContext(actor, "inbox.get", signal);
  // The account comes from the actor's own connections, never from client input.
  const accounts = await deps.mail.listAccounts(
    { spaceId: actor.spaceId, userId: actor.userId },
    context,
  );
  const account: MailAccount | undefined = accounts.find((a) => a.id === row.connectionId);
  if (!account) throw notFound();
  try {
    const message = await deps.mail.getMessage(account, row.providerMessageId, context);
    return {
      from: formatAddress(message.from),
      to: message.to.map(formatAddress).join(", "),
      date: message.date,
      subject: message.subject,
      html: message.html ?? null,
      text: message.text,
    };
  } catch (error) {
    if (error instanceof MailProviderError) {
      getLogger().warn("inbox.get failed", { connectionId: account.id, reason: error.kind });
      if (error.kind === "not_found") throw notFound();
      if (error.kind === "auth") {
        throw new ORPCError("PRECONDITION_FAILED", { message: error.message });
      }
      throw new ORPCError("SERVICE_UNAVAILABLE", { message: "Mail is unavailable" });
    }
    throw error;
  }
}

export async function inboxUnreadCount(
  deps: Pick<InboxDeps, "prisma">,
  actor: Actor,
): Promise<{ count: number }> {
  const since = new Date(Date.now() - WINDOW_MS);
  const [row] = await deps.prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    SELECT COUNT(*)::int AS count FROM (
      SELECT DISTINCT m."connectionId", m."threadId"
      FROM mail_messages m
      JOIN connections c ON c.id = m."connectionId"
      WHERE m."spaceId" = ${actor.spaceId} AND m."userId" = ${actor.userId}
        AND c."spaceId" = ${actor.spaceId} AND c."userId" = ${actor.userId}
        AND c.status = 'connected'
        AND m."inInbox" AND m.unread AND m."receivedAt" >= ${since}
    ) threads`);
  return { count: row?.count ?? 0 };
}
