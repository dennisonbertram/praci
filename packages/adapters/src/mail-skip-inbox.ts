import type { AdapterContext, MailAccount, MailProvider } from "@rakazo/adapter-kit";
import { MailProviderError } from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";
import { Prisma } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import { logMailAction } from "./mail-action-log.js";

/** Mail archived by one run; a sender with more waits for the next sync. */
const MAX_ROWS = 100;
const CONCURRENCY = 2;

export interface SkipInboxDeps {
  prisma: PrismaClient;
  mail: MailProvider;
  /** MAIL_WRITES_DISABLED: archive nothing. */
  writesDisabled?: boolean;
}

/**
 * Archives new inbox mail from senders the user chose to skip. It runs after a sync, outside the
 * sync's write transaction, because it calls the provider. Only mail received after the decision is
 * touched, and never mail that is spam or spam-like, failed authentication, from a sender marked
 * important, or already handled (`skipAppliedAt`), so an undo is not archived again. Each run is
 * one `auto` entry in the action log. Returns how many conversations it archived.
 */
export async function applySkipInbox(
  deps: SkipInboxDeps,
  account: MailAccount,
  context: AdapterContext,
): Promise<number> {
  if (deps.writesDisabled) return 0;
  const { prisma } = deps;
  const { spaceId, userId } = context;
  const rows = await prisma.$queryRaw<Array<{ id: string; threadId: string; sender: string }>>(
    Prisma.sql`
      SELECT m.id, m."threadId", lower(m."fromAddress") AS sender
      FROM mail_messages m
      JOIN mail_sender_decisions d
        ON d."connectionId" = m."connectionId" AND d."senderAddress" = lower(m."fromAddress")
        AND d."spaceId" = m."spaceId" AND d."userId" = m."userId"
        AND d."skipInboxAt" IS NOT NULL AND m."receivedAt" >= d."skipInboxAt"
      WHERE m."connectionId" = ${account.id} AND m."spaceId" = ${spaceId} AND m."userId" = ${userId}
        AND m."inInbox" AND NOT m."fromSelf" AND NOT m."isSpam" AND m."skipAppliedAt" IS NULL
        AND COALESCE(m.pile, '') <> 'spam'
        AND COALESCE(m.category, '') NOT IN ('spam', 'scam', 'suspicious')
        AND COALESCE(m.signals->'categories'->>'spam', 'false') <> 'true'
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_each_text(COALESCE(m.signals->'auth', '{}'::jsonb)) a WHERE a.value = 'fail')
        AND NOT EXISTS (
          SELECT 1 FROM inbox_sender_feedback f
          WHERE f."spaceId" = m."spaceId" AND f."userId" = m."userId"
            AND f."senderAddress" = lower(m."fromAddress") AND f.mark = 'important')
      ORDER BY m."receivedAt" DESC
      LIMIT ${MAX_ROWS}`,
  );
  if (rows.length === 0) return 0;

  const idsByThread = new Map<string, string[]>();
  for (const row of rows)
    idsByThread.set(row.threadId, [...(idsByThread.get(row.threadId) ?? []), row.id]);
  const queue = [...idsByThread.keys()];
  const archived: string[] = [];
  let stopped = false;
  const scope = { spaceId, userId, connectionId: account.id };

  const worker = async () => {
    for (let threadId = queue.shift(); threadId !== undefined; threadId = queue.shift()) {
      if (stopped || context.signal.aborted) return;
      try {
        await deps.mail.modifyThread(account, threadId, { removeLabelIds: ["INBOX"] }, context);
      } catch (error) {
        // Gone from Gmail already: nothing to archive, and the next sync prunes the row.
        if (!(error instanceof MailProviderError && error.kind === "not_found")) {
          if (error instanceof MailProviderError && ["rate_limited", "auth"].includes(error.kind)) {
            stopped = true;
            if (error.kind === "auth") await flagReconnect(prisma, account.id);
          }
          getLogger().warn("skip inbox archive failed", {
            connectionId: account.id,
            reason: error instanceof MailProviderError ? error.kind : "error",
          });
          continue;
        }
      }
      await prisma.cachedMailMessage.updateMany({
        where: { ...scope, threadId, inInbox: true },
        data: { inInbox: false },
      });
      await prisma.cachedMailMessage.updateMany({
        where: { ...scope, id: { in: idsByThread.get(threadId) ?? [] } },
        data: { skipAppliedAt: new Date() },
      });
      archived.push(threadId);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));

  if (archived.length > 0) {
    const archivedSet = new Set(archived);
    const senders = [
      ...new Set(rows.filter((r) => archivedSet.has(r.threadId)).map((r) => r.sender)),
    ];
    await logMailAction(prisma, scope, {
      batchId: crypto.randomUUID(),
      kind: "skip_inbox",
      source: "auto",
      reason: "skip_inbox",
      senders,
      threadIds: archived,
    });
  }
  return archived.length;
}

async function flagReconnect(prisma: PrismaClient, connectionId: string): Promise<void> {
  const now = new Date();
  await prisma.mailSyncState
    .upsert({
      where: { connectionId },
      create: { connectionId, lastErrorAt: now, needsReconnect: true, lastErrorKind: "auth" },
      update: { lastErrorAt: now, needsReconnect: true, lastErrorKind: "auth" },
    })
    .catch(() => undefined);
}
