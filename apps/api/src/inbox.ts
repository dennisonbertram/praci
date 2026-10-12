import { ORPCError } from "@orpc/server";
import type {
  AdapterContext,
  JobPublisher,
  MailAccount,
  MailAddress,
  MailAttachment,
  MailProvider,
} from "@rakazo/adapter-kit";
import { inboxTriageJob, MailProviderError } from "@rakazo/adapter-kit";
import type { TriageReadinessDeps } from "@rakazo/adapters";
import { isMailConnection, syncMailbox, triageReadiness, triageStatus } from "@rakazo/adapters";
import type {
  Actor,
  InboxFeedbackInput,
  InboxListInput,
  InboxListOutput,
  InboxMark,
  InboxTodo,
  MailRow,
} from "@rakazo/contracts";
import { InboxCategorySchema, inboxAgentSpawnKey } from "@rakazo/contracts";
import { applySenderMark, senderMarkMap, TRIAGE_VERSION } from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";
import { Prisma } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";

export interface InboxDeps {
  prisma: PrismaClient;
  mail: MailProvider;
  jobs: JobPublisher;
  /** The executor's resolver, for the same readiness check the triage job makes. */
  resolveModel?: TriageReadinessDeps["resolveModel"];
}

const WINDOW_MS = 14 * 86_400_000;
const MAX_ROWS = 200;
const DONE_VISIBLE_MS = 86_400_000;
const SYNC_PARALLELISM = 4;
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
/** Messages asked of Gmail per account for one page of a filtered or searched list. */
const SEARCH_PAGE_SIZE = 50;

const FILTER_QUERY = {
  unread: "is:unread",
  starred: "is:starred",
  important: "is:important",
  attachment: "has:attachment",
  primary: "category:primary",
  promotions: "category:promotions",
  social: "category:social",
  updates: "category:updates",
} as const;

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

/** True when the triage job would pick at least one message of these accounts (Job flow step 4). */
async function hasUntriaged(
  prisma: PrismaClient,
  actor: Actor,
  connectionIds: string[],
): Promise<boolean> {
  const row = await prisma.cachedMailMessage.findFirst({
    where: {
      spaceId: actor.spaceId,
      userId: actor.userId,
      connectionId: { in: connectionIds },
      inInbox: true,
      fromSelf: false,
      receivedAt: { gte: new Date(Date.now() - WINDOW_MS) },
      OR: [{ triagedAt: null }, { triageVersion: { lt: TRIAGE_VERSION } }],
    },
    select: { id: true },
  });
  return row !== null;
}

/** The job key merges repeats; a lost enqueue only delays triage until the next trigger. */
async function enqueueTriage(deps: InboxDeps, actor: Actor): Promise<void> {
  await deps.jobs.enqueue(inboxTriageJob(actor.userId, actor.spaceId)).catch((error) => {
    getLogger().warn("inbox triage enqueue failed", {
      reason: error instanceof Error ? error.name : "error",
    });
  });
}

const PRIORITIES = ["critical", "important", "normal", "low"] as const;
const asPriority = (value: string | null) => PRIORITIES.find((p) => p === value) ?? null;

/** True when the triage job would run for this user: the one check the job itself makes. */
async function triageEnabled(deps: InboxDeps, actor: Actor): Promise<boolean> {
  return (await triageReadiness(deps, actor)) !== null;
}

function formatAddress(address: MailAddress | null | undefined): string {
  if (!address) return "";
  return address.name ? `${address.name} <${address.address}>` : address.address;
}

type CachedMessage = Prisma.CachedMailMessageGetPayload<object>;

/** Newest first in, newest of each thread out. */
function oneRowPerThread(messages: CachedMessage[]): CachedMessage[] {
  const seen = new Set<string>();
  return messages.filter((m) => {
    const thread = `${m.connectionId}:${m.threadId}`;
    if (seen.has(thread)) return false;
    seen.add(thread);
    return true;
  });
}

/** The caller's marks by lowercased sender address. */
async function senderMarks(prisma: PrismaClient, actor: Actor): Promise<Map<string, InboxMark>> {
  return senderMarkMap(
    await prisma.inboxSenderFeedback.findMany({
      where: { spaceId: actor.spaceId, userId: actor.userId },
      select: { senderAddress: true, mark: true },
    }),
  );
}

/** Matches a sender address whatever its case; Gmail returns the address as the sender wrote it. */
const fromAddressIs = (addresses: string[]) =>
  addresses.map((address) => ({ fromAddress: { equals: address, mode: "insensitive" as const } }));

function toMailRow(m: CachedMessage, enabled: boolean, marks: Map<string, InboxMark>): MailRow {
  const mark = enabled ? (marks.get(m.fromAddress.toLowerCase()) ?? null) : null;
  // Triage fields stay hidden while triage is off, and an answered thread needs no reply.
  const triage = applySenderMark(
    {
      needsReply: enabled && m.needsReply !== null ? m.needsReply && !m.alreadyHandled : null,
      priority: enabled ? asPriority(m.priority) : null,
    },
    mark,
  );
  return {
    id: m.id,
    connectionId: m.connectionId,
    threadId: m.threadId,
    from: m.fromName || m.fromAddress,
    subject: m.subject,
    snippet: m.snippet,
    receivedAt: m.receivedAt.toISOString(),
    unread: m.unread,
    needsReply: triage.needsReply,
    priority: asPriority(triage.priority),
    reason: enabled ? m.reason : null,
    category: enabled ? (InboxCategorySchema.options.find((c) => c === m.category) ?? null) : null,
    feedback: mark,
  };
}

/** One opaque token carries each account's Gmail page token; an account missing from it is done. */
const encodePageToken = (tokens: Record<string, string>) =>
  Buffer.from(JSON.stringify(tokens)).toString("base64url");

function decodePageToken(token: string): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(token, "base64url").toString());
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      Object.values(parsed).every((value) => typeof value === "string")
    )
      return parsed as Record<string, string>;
  } catch {
    // Falls through to the error below.
  }
  throw new ORPCError("BAD_REQUEST", { message: "Invalid page token" });
}

/**
 * Asks Gmail live, once per account, and returns the matches that Postgres now has rows for
 * (the provider caches the metadata it hydrates). Newest first across accounts within the page.
 * Only the actor's own connected accounts are queried; a page token can only narrow that set.
 * ponytail: each account pages on its own, so a later page can hold mail newer than the previous
 * page's oldest row from another account; merge by date across accounts if that is noticed.
 */
async function searchMail(
  deps: InboxDeps,
  actor: Actor,
  connections: Array<{ id: string }>,
  request: { query: string; pageToken: string | undefined; signal: AbortSignal | undefined },
): Promise<{
  messages: CachedMessage[];
  failed: string[];
  reconnect: string[];
  nextPageToken: string | undefined;
}> {
  const tokens = request.pageToken ? decodePageToken(request.pageToken) : undefined;
  const targets = connections.filter((c) => !tokens || Object.hasOwn(tokens, c.id));
  const context = mailContext(actor, "inbox.list", request.signal);
  const accounts = await deps.mail.listAccounts(
    { spaceId: actor.spaceId, userId: actor.userId },
    context,
  );
  const next: Record<string, string> = {};
  const failed: string[] = [];
  const reconnect: string[] = [];
  const pages = await Promise.all(
    targets.map(async ({ id }): Promise<CachedMessage[]> => {
      const account = accounts.find((a) => a.id === id);
      try {
        if (!account) throw new MailProviderError("unavailable", "Mail account unavailable");
        const page = await deps.mail.listMessages(
          account,
          {
            query: request.query,
            pageSize: SEARCH_PAGE_SIZE,
            ...(tokens?.[id] ? { pageToken: tokens[id] } : {}),
          },
          context,
        );
        if (page.nextPageToken) next[id] = page.nextPageToken;
        if (page.unhydratedIds?.length) failed.push(id);
        const cached = await deps.prisma.cachedMailMessage.findMany({
          where: {
            spaceId: actor.spaceId,
            userId: actor.userId,
            connectionId: id,
            providerMessageId: { in: page.messages.map((m) => m.id) },
          },
        });
        return cached;
      } catch (error) {
        if (!(error instanceof MailProviderError)) throw error;
        getLogger().warn("inbox.list search failed", { connectionId: id, reason: error.kind });
        failed.push(id);
        if (error.kind === "auth") reconnect.push(id);
        return [];
      }
    }),
  );
  const messages = oneRowPerThread(
    pages
      .flat()
      .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime() || b.id.localeCompare(a.id)),
  );
  return {
    messages,
    failed,
    reconnect,
    nextPageToken: Object.keys(next).length ? encodePageToken(next) : undefined,
  };
}

export async function inboxList(
  deps: InboxDeps,
  actor: Actor,
  input: InboxListInput,
  signal?: AbortSignal,
): Promise<InboxListOutput> {
  const { prisma } = deps;
  const search = [
    input.filter ? FILTER_QUERY[input.filter] : "",
    input.query?.trim() ? `(${input.query.trim()})` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const important = input.view === "important";
  if ((important || input.category) && search) {
    throw new ORPCError("BAD_REQUEST", {
      message: "A view or category cannot be combined with a filter or search",
    });
  }
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
  const { ready, blocked: triageBlocked } = await triageStatus(deps, actor);
  const enabled = ready !== null;
  const marks = enabled ? await senderMarks(prisma, actor) : new Map<string, InboxMark>();
  if (ids.length === 0) {
    return {
      accounts,
      agent: agentOut,
      rows: [],
      syncedAt: null,
      failedAccounts: [],
      reconnectAccounts: [],
      enabled,
      triageBlocked,
      triagePending: false,
    };
  }

  if (search) {
    const result = await searchMail(deps, actor, selected, {
      query: search,
      pageToken: input.pageToken,
      signal,
    });
    return {
      accounts,
      agent: agentOut,
      rows: result.messages.map((m) => toMailRow(m, enabled, marks)),
      syncedAt: null,
      failedAccounts: result.failed,
      reconnectAccounts: result.reconnect,
      enabled,
      triageBlocked,
      triagePending: false,
      ...(result.nextPageToken ? { nextPageToken: result.nextPageToken } : {}),
    };
  }

  // The views read the whole cache window, not the newest rows of it. Triage must be on for them.
  const narrow: Prisma.CachedMailMessageWhereInput[] = [];
  if (enabled && input.category) narrow.push({ category: input.category });
  if (enabled && important) {
    const marked = (mark: InboxMark) =>
      [...marks].flatMap(([address, value]) => (value === mark ? [address] : []));
    // ponytail: one OR term per marked sender; fine for hundreds, use a lowercase column if it grows.
    narrow.push({
      OR: [
        { priority: { in: ["critical", "important"] } },
        { needsReply: true, alreadyHandled: false },
        ...fromAddressIs(marked("important")),
      ],
    });
    const noise = marked("noise");
    if (noise.length > 0) narrow.push({ NOT: { OR: fromAddressIs(noise) } });
  }

  const [messages, states, untriaged] = await Promise.all([
    prisma.cachedMailMessage.findMany({
      where: {
        spaceId: actor.spaceId,
        userId: actor.userId,
        connectionId: { in: ids },
        inInbox: true,
        receivedAt: { gte: new Date(Date.now() - WINDOW_MS) },
        AND: narrow,
      },
      orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
      take: MAX_ROWS,
    }),
    prisma.mailSyncState.findMany({ where: { connectionId: { in: ids } } }),
    // The rows Job flow step 4 of the triage job would select, across all the user's accounts.
    enabled
      ? hasUntriaged(
          prisma,
          actor,
          connections.map((c) => c.id),
        )
      : false,
  ]);

  const rows = oneRowPerThread(messages).map((m) => toMailRow(m, enabled, marks));
  const synced = states.flatMap((s) => (s.lastSyncedAt ? [s.lastSyncedAt.getTime()] : []));
  return {
    accounts,
    agent: agentOut,
    rows,
    syncedAt: synced.length ? new Date(Math.max(...synced)).toISOString() : null,
    failedAccounts: states.filter((s) => s.lastErrorAt).map((s) => s.connectionId),
    reconnectAccounts: states
      .filter((s) => s.lastErrorAt && s.needsReconnect)
      .map((s) => s.connectionId),
    enabled,
    triageBlocked,
    triagePending: untriaged,
  };
}

/**
 * Marks or unmarks the sender of one of the caller's cached messages. The mark belongs to the
 * sender address, so it covers all the caller's accounts. Nothing is written to Gmail.
 */
export async function inboxFeedbackSet(
  deps: InboxDeps,
  actor: Actor,
  input: InboxFeedbackInput,
): Promise<{ mark: InboxMark | null }> {
  const message = await deps.prisma.cachedMailMessage.findFirst({
    where: { id: input.messageId, spaceId: actor.spaceId, userId: actor.userId },
    select: { fromAddress: true },
  });
  if (!message) throw notFound();
  const senderAddress = message.fromAddress.trim().toLowerCase();
  if (!senderAddress) throw new ORPCError("BAD_REQUEST", { message: "Message has no sender" });
  const key = { spaceId: actor.spaceId, userId: actor.userId, senderAddress };
  if (input.mark) {
    await deps.prisma.inboxSenderFeedback.upsert({
      where: { spaceId_userId_senderAddress: key },
      create: { ...key, mark: input.mark },
      update: { mark: input.mark },
    });
  } else {
    await deps.prisma.inboxSenderFeedback.deleteMany({ where: key });
  }
  // A triage run with nothing new to classify still re-syncs the to-dos under the new mark.
  if (await triageEnabled(deps, actor)) await enqueueTriage(deps, actor);
  return { mark: input.mark };
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

  // A sync only queues triage when it ran. One throttled, or incomplete before the user allowed the
  // model, would leave cached mail untriaged, so refresh queues it whenever mail is waiting.
  if (
    (await triageEnabled(deps, actor)) &&
    (await hasUntriaged(
      deps.prisma,
      actor,
      mine.map((a) => a.id),
    ))
  ) {
    await enqueueTriage(deps, actor);
  }
  return { ok: true };
}

/** The caller's cached message and the connected account it came from, or NOT_FOUND. */
async function ownMessage(
  deps: InboxDeps,
  actor: Actor,
  messageId: string,
  context: AdapterContext,
) {
  const row = await deps.prisma.cachedMailMessage.findFirst({
    where: { id: messageId, spaceId: actor.spaceId, userId: actor.userId },
  });
  if (!row) throw notFound();
  // The account comes from the actor's own connections, never from client input.
  const accounts = await deps.mail.listAccounts(
    { spaceId: actor.spaceId, userId: actor.userId },
    context,
  );
  const account: MailAccount | undefined = accounts.find((a) => a.id === row.connectionId);
  if (!account) throw notFound();
  return { account, providerMessageId: row.providerMessageId };
}

function providerFailure(error: unknown, operation: string, connectionId: string): never {
  if (error instanceof MailProviderError) {
    getLogger().warn(`${operation} failed`, { connectionId, reason: error.kind });
    if (error.kind === "not_found") throw notFound();
    if (error.kind === "too_large") {
      throw new ORPCError("PAYLOAD_TOO_LARGE", { message: "Attachment is too large" });
    }
    if (error.kind === "auth") {
      throw new ORPCError("PRECONDITION_FAILED", { message: error.message });
    }
    throw new ORPCError("SERVICE_UNAVAILABLE", { message: "Mail is unavailable" });
  }
  throw error;
}

export async function inboxGet(
  deps: InboxDeps,
  actor: Actor,
  input: { messageId: string },
  signal?: AbortSignal,
) {
  const context = mailContext(actor, "inbox.get", signal);
  const { account, providerMessageId } = await ownMessage(deps, actor, input.messageId, context);
  try {
    const message = await deps.mail.getMessage(account, providerMessageId, context);
    return {
      from: formatAddress(message.from),
      to: message.to.map(formatAddress).join(", "),
      date: message.date,
      subject: message.subject,
      html: message.html ?? null,
      text: message.text,
      attachments: message.attachments
        .filter((a) => !a.inline && a.id)
        .map(({ id, filename, mimeType, size }) => ({ id, filename, mimeType, size })),
    };
  } catch (error) {
    providerFailure(error, "inbox.get", account.id);
  }
}

/** One attachment of the caller's own message. The bytes go to the caller only, never to a model. */
export async function inboxAttachment(
  deps: InboxDeps,
  actor: Actor,
  input: { messageId: string; attachmentId: string },
  signal?: AbortSignal,
): Promise<MailAttachment> {
  const context = mailContext(actor, "inbox.attachment", signal);
  const { account, providerMessageId } = await ownMessage(deps, actor, input.messageId, context);
  try {
    return await deps.mail.getAttachment(
      account,
      providerMessageId,
      input.attachmentId,
      MAX_ATTACHMENT_BYTES,
      context,
    );
  } catch (error) {
    providerFailure(error, "inbox.attachment", account.id);
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

const todoInclude = {
  message: { select: { priority: true, fromName: true, fromAddress: true } },
} satisfies Prisma.InboxTodoInclude;

function todoOut(row: Prisma.InboxTodoGetPayload<{ include: typeof todoInclude }>): InboxTodo {
  return {
    id: row.id,
    connectionId: row.connectionId,
    messageId: row.messageId,
    text: row.text,
    detail: row.detail,
    from: row.message ? row.message.fromName || row.message.fromAddress : null,
    priority: asPriority(row.message?.priority ?? null),
    dueOn: row.dueOn ? row.dueOn.toISOString().slice(0, 10) : null,
    doneAt: row.doneAt ? row.doneAt.toISOString() : null,
  };
}

export async function inboxTodosList(
  deps: InboxDeps,
  actor: Actor,
  input: { connectionId?: string },
): Promise<{ enabled: boolean; todos: InboxTodo[] }> {
  const connections = await connectedMailConnections(deps.prisma, actor);
  if (input.connectionId && !connections.some((c) => c.id === input.connectionId)) {
    throw notFound();
  }
  const enabled = await triageEnabled(deps, actor);
  if (!enabled) return { enabled, todos: [] };
  const rows = await deps.prisma.inboxTodo.findMany({
    where: {
      spaceId: actor.spaceId,
      userId: actor.userId,
      connectionId: input.connectionId ?? { in: connections.map((c) => c.id) },
      OR: [{ doneAt: null }, { doneAt: { gte: new Date(Date.now() - DONE_VISIBLE_MS) } }],
    },
    include: todoInclude,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return { enabled, todos: rows.map(todoOut) };
}

export async function inboxTodoSetDone(
  deps: Pick<InboxDeps, "prisma">,
  actor: Actor,
  input: { id: string; done: boolean },
): Promise<InboxTodo> {
  const now = new Date();
  const scope = {
    id: input.id,
    spaceId: actor.spaceId,
    userId: actor.userId,
    connection: { status: "connected" },
  };
  // Any user action marks the to-do touched, so triage never replaces or re-creates it.
  const { count } = await deps.prisma.inboxTodo.updateMany({
    where: scope,
    data: { doneAt: input.done ? now : null, touchedAt: now },
  });
  const row = count
    ? await deps.prisma.inboxTodo.findFirst({ where: scope, include: todoInclude })
    : null;
  if (!row) throw notFound();
  return todoOut(row);
}
