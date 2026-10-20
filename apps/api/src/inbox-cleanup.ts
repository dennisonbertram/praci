import { ORPCError } from "@orpc/server";
import {
  ensureSenderRule,
  isMailConnection,
  logMailAction,
  MAIL_CACHE_WINDOW_DAYS,
  removeSenderRules,
} from "@rakazo/adapters";
import type {
  Actor,
  CleanupArchiveInput,
  CleanupArchiveOutput,
  CleanupForgetInput,
  CleanupListOutput,
  CleanupSender,
  InboxPile,
  MailSignals,
} from "@rakazo/contracts";
import {
  InboxPileSchema,
  MAX_CLEANUP_SENDERS,
  MailSignalsSchema,
  SenderRuleStatusSchema,
} from "@rakazo/contracts";
import {
  isCleanupPreselected,
  planUnsubscribe,
  rankCleanupSenders,
  senderMarkMap,
} from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";
import { Prisma } from "@rakazo/db";
import type { InboxDeps } from "./inbox.js";
import { connectedMailConnections, mailAccountsOf, mailContext, notFound } from "./inbox.js";
import { inboxCleanupMove, type ModifyDeps } from "./inbox-modify.js";

/** Conversations one cleanup call changes. */
const PAGE = 50;
const WINDOW_MS = MAIL_CACHE_WINDOW_DAYS * 86_400_000;

export interface SenderFacts {
  connectionId: string;
  address: string;
  name: string | null;
  inboxThreads: number;
  newestPile: InboxPile | null;
  /** Signals of the newest message that has a List-Unsubscribe entry. */
  signals: MailSignals | null;
  /** Some window mail is spam, scam or suspicious, or failed authentication. */
  spamLike: boolean;
}

/**
 * What the cache says about each sender with inbox mail in the 90-day window, from Postgres only.
 * `address` limits it to one sender. Self-sent mail is left out.
 */
export async function senderFacts(
  prisma: PrismaClient,
  actor: Actor,
  connectionIds: string[],
  address?: string,
  /** False: also senders whose mail has all left the Inbox. */
  inboxOnly = true,
  /** With `inboxOnly`: senders listed anyway on their own connection, such as those the user skips. */
  also: Array<{ connectionId: string; address: string }> = [],
): Promise<SenderFacts[]> {
  if (connectionIds.length === 0) return [];
  const since = new Date(Date.now() - WINDOW_MS);
  const rows = await prisma.$queryRaw<
    Array<{
      connectionId: string;
      sender: string;
      name: string | null;
      inboxThreads: number;
      newestPile: string | null;
      signals: unknown;
      spamLike: boolean;
    }>
  >(Prisma.sql`
    WITH win AS (
      SELECT m.*, lower(m."fromAddress") AS sender,
        (m."isSpam" OR COALESCE(m.pile = 'spam', false)
          OR COALESCE(m.category IN ('spam', 'scam', 'suspicious'), false)
          OR COALESCE(m.signals->'categories'->>'spam' = 'true', false)
          OR EXISTS (
            SELECT 1 FROM jsonb_each_text(COALESCE(m.signals->'auth', '{}'::jsonb)) a WHERE a.value = 'fail')
        ) AS junk
      FROM mail_messages m
      WHERE m."spaceId" = ${actor.spaceId} AND m."userId" = ${actor.userId}
        AND m."connectionId" IN (${Prisma.join(connectionIds)})
        AND NOT m."fromSelf" AND m."fromAddress" <> '' AND m."receivedAt" >= ${since}
        ${address ? Prisma.sql`AND lower(m."fromAddress") = ${address}` : Prisma.empty}
    )
    SELECT "connectionId", sender,
      (array_agg("fromName" ORDER BY "receivedAt" DESC) FILTER (WHERE "fromName" IS NOT NULL))[1] AS name,
      (COUNT(DISTINCT "threadId") FILTER (WHERE "inInbox"))::int AS "inboxThreads",
      (array_agg(pile ORDER BY "receivedAt" DESC) FILTER (WHERE "inInbox"))[1] AS "newestPile",
      (array_agg(signals ORDER BY "receivedAt" DESC)
        FILTER (WHERE signals->'listUnsubscribe'->>0 IS NOT NULL))[1] AS signals,
      bool_or(junk) AS "spamLike"
    FROM win
    GROUP BY "connectionId", sender
    ${
      inboxOnly
        ? Prisma.sql`HAVING COUNT(*) FILTER (WHERE "inInbox") > 0
          ${
            also.length
              ? Prisma.sql`OR ("connectionId", sender) IN (${Prisma.join(
                  also.map((a) => Prisma.sql`(${a.connectionId}, ${a.address})`),
                )})`
              : Prisma.empty
          }`
        : Prisma.empty
    }`);
  return rows.map((row) => {
    const signals = MailSignalsSchema.safeParse(row.signals);
    const pile = InboxPileSchema.safeParse(row.newestPile);
    return {
      connectionId: row.connectionId,
      address: row.sender,
      name: row.name,
      inboxThreads: row.inboxThreads,
      newestPile: pile.success ? pile.data : null,
      signals: signals.success ? signals.data : null,
      spamLike: row.spamLike,
    };
  });
}

/** The caller's own connected mail connection, or NOT_FOUND. */
export async function ownConnection(prisma: PrismaClient, actor: Actor, connectionId: string) {
  const row = await prisma.connection.findFirst({
    where: { id: connectionId, spaceId: actor.spaceId, userId: actor.userId, status: "connected" },
  });
  if (!row || !isMailConnection(row)) throw notFound();
  return row;
}

/** Senders worth cleaning up, ranked, with the user's earlier decisions. Makes no provider call. */
export async function inboxCleanupList(
  deps: InboxDeps,
  actor: Actor,
  input: { connectionId?: string },
): Promise<CleanupListOutput> {
  const { prisma } = deps;
  const connections = await connectedMailConnections(prisma, actor);
  if (input.connectionId && !connections.some((c) => c.id === input.connectionId)) throw notFound();
  const selected = connections.filter((c) => !input.connectionId || c.id === input.connectionId);
  const ids = selected.map((c) => c.id);
  const accounts = mailAccountsOf(connections);
  if (ids.length === 0) return { accounts, senders: [], syncedAt: null };

  const where = { spaceId: actor.spaceId, userId: actor.userId, connectionId: { in: ids } };
  const [decisions, stats, feedback, states] = await Promise.all([
    prisma.mailSenderDecision.findMany({ where }),
    prisma.mailSenderStat.findMany({ where: { ...where, messageCount: { gt: 0 } } }),
    prisma.inboxSenderFeedback.findMany({
      where: { spaceId: actor.spaceId, userId: actor.userId },
      select: { senderAddress: true, mark: true },
    }),
    prisma.mailSyncState.findMany({ where: { connectionId: { in: ids } } }),
  ]);
  // A sender the user skips stays listed after its mail is archived, so the decision can be undone.
  const skipped = decisions
    .filter((d) => d.skipInboxAt)
    .map((d) => ({ connectionId: d.connectionId, address: d.senderAddress }));
  const facts = await senderFacts(prisma, actor, ids, undefined, true, skipped);
  const key = (connectionId: string, address: string) => `${connectionId}:${address}`;
  const statOf = new Map(stats.map((s) => [key(s.connectionId, s.senderAddress), s]));
  const decisionOf = new Map(decisions.map((d) => [key(d.connectionId, d.senderAddress), d]));
  const marks = senderMarkMap(feedback);

  const senders = facts.flatMap((fact): CleanupSender[] => {
    const stat = statOf.get(key(fact.connectionId, fact.address));
    if (!stat) return [];
    const decision = decisionOf.get(key(fact.connectionId, fact.address));
    const skipInbox = Boolean(decision?.skipInboxAt);
    const rule = SenderRuleStatusSchema.safeParse(decision?.ruleStatus);
    const plan = planUnsubscribe(fact.signals, fact.spamLike);
    return [
      {
        connectionId: fact.connectionId,
        address: fact.address,
        name: fact.name ?? fact.address,
        messageCount: stat.messageCount,
        readCount: stat.readCount,
        lastReceivedAt: stat.lastReceivedAt?.toISOString() ?? null,
        inboxThreads: fact.inboxThreads,
        preselected: isCleanupPreselected({
          messageCount: stat.messageCount,
          readCount: stat.readCount,
          bulk: stat.bulk,
          newestPile: fact.newestPile,
          priorContact: stat.priorContact,
          mark: marks.get(fact.address) ?? null,
          spamLike: fact.spamLike,
          skipInbox,
        }),
        spamLike: fact.spamLike,
        unsubscribe: plan.method,
        skipInbox,
        unsubscribeStatus: parseStatus(decision?.unsubscribeStatus),
        ...(skipInbox && rule.success ? { rule: rule.data } : {}),
      },
    ];
  });
  const synced = states.flatMap((s) => (s.lastSyncedAt ? [s.lastSyncedAt.getTime()] : []));
  return {
    accounts,
    senders: rankCleanupSenders(senders).slice(0, MAX_CLEANUP_SENDERS),
    syncedAt: synced.length ? new Date(Math.max(...synced)).toISOString() : null,
  };
}

const STATUSES = ["done", "opened", "sent", "unknown", "failed", "refused"] as const;
const parseStatus = (value: string | null | undefined) =>
  STATUSES.find((status) => status === value) ?? null;

/**
 * Applies one cleanup choice to one sender's inbox conversations, at most 50 per call. The client
 * calls again with the returned `batchId` while `remaining` is above 0, and stops on `done: 0`.
 * Skip inbox first records the decision, so mail that arrives later is archived by sync.
 */
export async function inboxCleanupArchive(
  deps: ModifyDeps,
  actor: Actor,
  input: CleanupArchiveInput,
  signal?: AbortSignal,
): Promise<CleanupArchiveOutput> {
  if (deps.mailWritesDisabled)
    throw new ORPCError("BAD_REQUEST", { message: "Changing mail is turned off." });
  const { prisma } = deps;
  await ownConnection(prisma, actor, input.connectionId);
  const address = input.address.trim().toLowerCase();
  const scope = {
    spaceId: actor.spaceId,
    userId: actor.userId,
    connectionId: input.connectionId,
  };

  if (input.kind === "skip_inbox" || input.kind === "unsubscribe") {
    const [fact] = await senderFacts(prisma, actor, [input.connectionId], address);
    if (fact?.spamLike)
      throw new ORPCError("BAD_REQUEST", { message: "This sender looks like spam." });
  }
  if (input.kind === "skip_inbox") {
    const existing = await prisma.mailSenderDecision.findUnique({
      where: {
        connectionId_senderAddress: { connectionId: input.connectionId, senderAddress: address },
      },
    });
    if (!existing?.skipInboxAt)
      await prisma.mailSenderDecision.upsert({
        where: {
          connectionId_senderAddress: { connectionId: input.connectionId, senderAddress: address },
        },
        create: { ...scope, senderAddress: address, skipInboxAt: new Date() },
        update: { skipInboxAt: new Date() },
      });
  }

  // The Gmail filter is made on the first call only, so the later pages do not repeat provider calls.
  // A failure is kept on the decision and shown on the sender; pressing Skip inbox again retries it.
  if (input.kind === "skip_inbox" && input.batchId === undefined) {
    const context = mailContext(actor, "inbox.cleanup.rule", signal);
    const account = await deps.mail
      .listAccounts({ spaceId: actor.spaceId, userId: actor.userId }, context)
      .then((accounts) => accounts.find((a) => a.id === input.connectionId))
      .catch(() => undefined);
    if (account)
      await ensureSenderRule(
        { prisma, mail: deps.mail, writesDisabled: deps.mailWritesDisabled },
        account,
        context,
        address,
      );
  }

  // One representative message per conversation. Archive and skip leave spam-like mail alone.
  const op = input.kind === "spam" ? "spam" : "archive";
  const waitingWhere = Prisma.sql`
    "spaceId" = ${scope.spaceId} AND "userId" = ${scope.userId}
    AND "connectionId" = ${scope.connectionId} AND lower("fromAddress") = ${address}
    AND "inInbox" AND NOT "fromSelf" AND NOT "isSpam"
    ${op === "archive" ? Prisma.sql`AND COALESCE(pile, '') <> 'spam'` : Prisma.empty}`;
  const page = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT DISTINCT ON ("threadId") id FROM mail_messages
    WHERE ${waitingWhere} ORDER BY "threadId", "receivedAt" DESC LIMIT ${PAGE}`);
  const batchId = input.batchId ?? crypto.randomUUID();
  if (page.length === 0) return { batchId, done: 0, failed: 0, remaining: 0 };

  const { result, rows } = await inboxCleanupMove(
    deps,
    actor,
    op,
    page.map((row) => row.id),
    signal,
  );
  if (result.done.length > 0)
    await logMailAction(prisma, scope, {
      batchId,
      kind: input.kind,
      source: "user",
      reason: "cleanup",
      senders: [address],
      threadIds: [...new Set(result.done.map((id) => rows.get(id)?.threadId ?? ""))].filter(
        Boolean,
      ),
    });
  const [left] = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    SELECT COUNT(DISTINCT "threadId")::int AS count FROM mail_messages WHERE ${waitingWhere}`);
  return {
    batchId,
    done: result.done.length,
    failed: result.failed.length,
    remaining: left?.count ?? 0,
  };
}

/**
 * Forgets the sender's skip and unsubscribe decision. Mail already archived stays archived. The
 * Gmail filter Rakazo made for the sender is deleted first, and if that fails the decision stays so
 * the user can try again.
 */
export async function inboxCleanupForget(
  deps: ModifyDeps,
  actor: Actor,
  input: CleanupForgetInput,
  signal?: AbortSignal,
): Promise<{ ok: true }> {
  const where = {
    spaceId: actor.spaceId,
    userId: actor.userId,
    connectionId: input.connectionId,
    senderAddress: input.address.trim().toLowerCase(),
  };
  const withRule = await deps.prisma.mailSenderDecision.findMany({
    where: { ...where, ruleId: { not: null } },
  });
  if (withRule.length > 0) {
    if (deps.mailWritesDisabled)
      throw new ORPCError("BAD_REQUEST", { message: "Changing mail is turned off." });
    const context = mailContext(actor, "inbox.cleanup.forget", signal);
    const account = await deps.mail
      .listAccounts({ spaceId: actor.spaceId, userId: actor.userId }, context)
      .then((accounts) => accounts.find((a) => a.id === input.connectionId))
      .catch(() => undefined);
    const { failed } = await removeSenderRules(
      { prisma: deps.prisma, mail: deps.mail },
      account,
      context,
      withRule,
    );
    if (failed > 0)
      throw new ORPCError("BAD_GATEWAY", { message: "Couldn't remove the Gmail filter" });
  }
  await deps.prisma.mailSenderDecision.deleteMany({ where });
  return { ok: true };
}
