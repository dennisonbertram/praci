import type { AdapterContext, MailAccount, MailProvider } from "@rakazo/adapter-kit";
import { MailProviderError } from "@rakazo/adapter-kit";
import type { Prisma, PrismaClient } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";

/** Each check costs two Gmail calls (list, then hydrate the one hit), so a sync checks only a few senders. */
export const MAX_PRIOR_CONTACT_CHECKS = 10;
const RECHECK_AFTER_MS = 86_400_000;
const SEARCHABLE_ADDRESS = /^[^\s"()<>]+@[^\s"()<>]+$/;

export interface SenderScope {
  spaceId: string;
  userId: string;
  connectionId: string;
}

/** `priorContact: null` means the address was tried and could not be answered. */
export interface PriorContactResult {
  address: string;
  priorContact: boolean | null;
}

/**
 * Recomputes the stats of every sender seen in the window from the cached messages, so fetching a
 * message again cannot count it twice. Messages the user sent and spam are not counted. The
 * unsubscribe target comes from the newest message that has one. `priorContact` is never touched.
 */
export async function refreshSenderStats(
  tx: Prisma.TransactionClient,
  scope: SenderScope,
  windowStart: Date,
): Promise<void> {
  const { spaceId, userId, connectionId } = scope;
  await tx.$executeRaw`
    WITH win AS (
      SELECT lower("fromAddress") AS addr, "receivedAt", unread, signals
      FROM mail_messages
      WHERE "connectionId" = ${connectionId} AND "spaceId" = ${spaceId} AND "userId" = ${userId}
        AND "fromSelf" = false AND "isSpam" = false AND "fromAddress" <> ''
        AND "receivedAt" >= ${windowStart}
    ),
    agg AS (
      SELECT addr, count(*)::int AS n, (count(*) FILTER (WHERE NOT unread))::int AS read,
             max("receivedAt") AS last
      FROM win GROUP BY addr
    ),
    newest AS (
      SELECT DISTINCT ON (addr) addr,
        (COALESCE((signals->>'bulk')::boolean, false)
          OR signals->>'listId' IS NOT NULL
          OR COALESCE(jsonb_array_length(signals->'listUnsubscribe') > 0, false)) AS bulk
      FROM win ORDER BY addr, "receivedAt" DESC
    ),
    unsub AS (
      SELECT DISTINCT ON (addr) addr, signals->'listUnsubscribe'->>0 AS target,
        COALESCE((signals->>'oneClick')::boolean, false) AS one_click
      FROM win WHERE signals->'listUnsubscribe'->>0 IS NOT NULL
      ORDER BY addr, "receivedAt" DESC
    )
    INSERT INTO mail_sender_stats (
      id, "spaceId", "userId", "connectionId", "senderAddress", "messageCount", "readCount",
      "lastReceivedAt", "unsubscribeTarget", "oneClick", bulk)
    SELECT gen_random_uuid()::text, ${spaceId}, ${userId}, ${connectionId}, agg.addr, agg.n, agg.read,
           agg.last, unsub.target, COALESCE(unsub.one_click, false), newest.bulk
    FROM agg JOIN newest USING (addr) LEFT JOIN unsub USING (addr)
    ON CONFLICT ("connectionId", "senderAddress") DO UPDATE SET
      "messageCount" = EXCLUDED."messageCount",
      "readCount" = EXCLUDED."readCount",
      "lastReceivedAt" = EXCLUDED."lastReceivedAt",
      "unsubscribeTarget" = EXCLUDED."unsubscribeTarget",
      "oneClick" = EXCLUDED."oneClick",
      bulk = EXCLUDED.bulk`;
  // Senders whose messages all left the window keep their row (and priorContact) with zero counts.
  await tx.$executeRaw`
    UPDATE mail_sender_stats s SET "messageCount" = 0, "readCount" = 0
    WHERE s."connectionId" = ${connectionId} AND s."spaceId" = ${spaceId} AND s."userId" = ${userId}
      AND s."messageCount" > 0
      AND NOT EXISTS (
        SELECT 1 FROM mail_messages m
        WHERE m."connectionId" = s."connectionId" AND lower(m."fromAddress") = s."senderAddress"
          AND m."fromSelf" = false AND m."isSpam" = false AND m."receivedAt" >= ${windowStart})`;
}

/** A message the user sent proves contact. Existing rows only: a sender row appears when they write to us. */
export async function markPriorContactFromSent(
  tx: Prisma.TransactionClient,
  scope: SenderScope,
  addresses: string[],
  now: Date,
): Promise<void> {
  if (addresses.length === 0) return;
  await tx.mailSenderStat.updateMany({
    where: { ...scope, senderAddress: { in: addresses } },
    data: { priorContact: true, priorContactCheckedAt: now },
  });
}

/**
 * Senders to look up this sync, at most `limit`: senders of the messages just merged first (newest
 * first), then the backlog of senders never answered, newest first. A sender answered true or false,
 * or tried within the last day, is skipped. A sender with no row yet counts as not checked.
 */
export async function pickPriorContactCandidates(
  prisma: Pick<PrismaClient, "mailSenderStat">,
  scope: SenderScope,
  freshAddresses: string[],
  limit: number,
  now: Date,
): Promise<string[]> {
  const retryBefore = new Date(now.getTime() - RECHECK_AFTER_MS);
  const open = {
    priorContact: null,
    OR: [{ priorContactCheckedAt: null }, { priorContactCheckedAt: { lt: retryBefore } }],
  };
  const fresh = [...new Set(freshAddresses)];
  const known = new Map(
    (
      await prisma.mailSenderStat.findMany({
        where: { ...scope, senderAddress: { in: fresh } },
        select: { senderAddress: true, priorContact: true, priorContactCheckedAt: true },
      })
    ).map((row) => [row.senderAddress, row]),
  );
  const picked = fresh
    .filter((address) => {
      const row = known.get(address);
      return (
        !row ||
        (row.priorContact === null &&
          (row.priorContactCheckedAt === null || row.priorContactCheckedAt < retryBefore))
      );
    })
    .slice(0, limit);
  if (picked.length >= limit) return picked;
  const backlog = await prisma.mailSenderStat.findMany({
    where: { ...scope, ...open, senderAddress: { notIn: [...picked, ...fresh] } },
    orderBy: { lastReceivedAt: "desc" },
    take: limit - picked.length,
    select: { senderAddress: true },
  });
  return [...picked, ...backlog.map((row) => row.senderAddress)];
}

/**
 * Asks the provider, one address at a time, whether the user ever sent mail to it. Stops at the
 * first rate limit, unhydrated page or abort and leaves the rest unknown. Any other error also stops
 * the loop, and records that address as tried so a bad address cannot block the queue for a day.
 * Never throws. The search skips the metadata cache, because a cached sent message would look like
 * received mail.
 */
export async function checkPriorContact(
  mail: MailProvider,
  account: MailAccount,
  context: AdapterContext,
  addresses: string[],
): Promise<PriorContactResult[]> {
  const results: PriorContactResult[] = [];
  for (const address of addresses) {
    if (context.signal.aborted) break;
    if (!SEARCHABLE_ADDRESS.test(address)) {
      results.push({ address, priorContact: null });
      continue;
    }
    try {
      const page = await mail.listMessages(
        account,
        { query: `in:sent to:"${address}"`, pageSize: 1, useCache: false },
        context,
      );
      if (page.messages.length > 0) results.push({ address, priorContact: true });
      else if (page.unhydratedIds?.length) break;
      else results.push({ address, priorContact: false });
    } catch (error) {
      if (!(error instanceof MailProviderError && error.kind === "rate_limited")) {
        if (!context.signal.aborted) results.push({ address, priorContact: null });
        getLogger().warn("prior contact check failed", {
          connectionId: account.id,
          reason: error instanceof MailProviderError ? error.kind : "error",
        });
      }
      break;
    }
  }
  return results;
}

/** Writes lookup results. A true is final; a false never replaces a true another path just set. */
export async function storePriorContact(
  tx: Prisma.TransactionClient,
  scope: SenderScope,
  results: PriorContactResult[],
  now: Date,
): Promise<void> {
  const named = (value: boolean | null) =>
    results.filter((r) => r.priorContact === value).map((r) => r.address);
  const stamp = { priorContactCheckedAt: now };
  if (named(true).length)
    await tx.mailSenderStat.updateMany({
      where: { ...scope, senderAddress: { in: named(true) } },
      data: { priorContact: true, ...stamp },
    });
  if (named(false).length)
    await tx.mailSenderStat.updateMany({
      where: {
        ...scope,
        senderAddress: { in: named(false) },
        OR: [{ priorContact: null }, { priorContact: false }],
      },
      data: { priorContact: false, ...stamp },
    });
  if (named(null).length)
    await tx.mailSenderStat.updateMany({
      where: { ...scope, senderAddress: { in: named(null) } },
      data: stamp,
    });
}
