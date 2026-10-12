import { randomUUID } from "node:crypto";
import type {
  AdapterContext,
  MailAccount,
  MailMessageSummary,
  MailProvider,
} from "@rakazo/adapter-kit";
import { MailProviderError } from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";
import { Prisma } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";

const WINDOW_MS = 14 * 86_400_000;
const PAGE_SIZE = 100;
/** Most messages kept from one list; Gmail pages are 100, so this is two pages. */
const MAX_MESSAGES = 200;
const DEADLINE_MS = 90_000;
const TEXT_CAP = 500;
const UPSERT_CHUNK = 200;

/** Stored timestamps are UTC without a zone, so compare against Postgres' UTC clock. */
const DB_NOW = Prisma.sql`timezone('utc', now())`;

export interface MailSyncDeps {
  prisma: PrismaClient;
  mail: MailProvider;
  /** Clock for the 14-day window; defaults to the system clock. */
  now?: () => Date;
  /** Provider deadline; defaults to 90 seconds, which is shorter than the 2-minute stale claim. */
  deadlineMs?: number;
}

/** `skipped`: throttled, claimed elsewhere, revoked, or this sync lost its claim. */
export type MailSyncOutcome = "synced" | "skipped" | "failed";

interface Listed {
  messages: MailMessageSummary[];
  /** More messages exist beyond the ones kept. */
  capped: boolean;
  /** Some listed ids could not be hydrated. */
  partial: boolean;
}

/**
 * Syncs one account's inbox and sent mail for the last 14 days into the Postgres cache.
 * One conditional UPDATE is both the 60-second throttle and the in-flight claim; the write
 * transaction re-checks the claim token under a row lock, so a sync that lost its claim writes
 * nothing. Provider errors are recorded on the state row, never thrown.
 */
export async function syncMailbox(
  deps: MailSyncDeps,
  account: MailAccount,
  context: AdapterContext,
): Promise<MailSyncOutcome> {
  const { prisma } = deps;
  const { spaceId, userId } = context;
  const token = randomUUID();
  const started = Date.now();

  await prisma.$executeRaw`
    INSERT INTO mail_sync_states ("connectionId")
    SELECT id FROM connections
    WHERE id = ${account.id} AND "spaceId" = ${spaceId} AND "userId" = ${userId}
      AND status = 'connected'
    ON CONFLICT DO NOTHING`;
  const claimed = await prisma.$queryRaw<Array<{ connectionId: string }>>`
    UPDATE mail_sync_states s
    SET "syncStartedAt" = ${DB_NOW}, "claimToken" = ${token}
    FROM connections c
    WHERE s."connectionId" = ${account.id} AND c.id = s."connectionId"
      AND c."spaceId" = ${spaceId} AND c."userId" = ${userId} AND c.status = 'connected'
      AND (s."lastSyncedAt" IS NULL OR s."lastSyncedAt" < ${DB_NOW} - interval '60 seconds')
      AND (s."syncStartedAt" IS NULL OR s."syncStartedAt" < ${DB_NOW} - interval '2 minutes')
    RETURNING s."connectionId"`;
  if (claimed.length === 0) return "skipped";

  const fail = async (error: unknown): Promise<"failed"> => {
    // The token check keeps a sync that lost its claim from clearing its replacement's.
    await prisma.$executeRaw`
      UPDATE mail_sync_states
      SET "lastErrorAt" = ${DB_NOW}, "syncStartedAt" = NULL, "claimToken" = NULL
      WHERE "connectionId" = ${account.id} AND "claimToken" = ${token}`;
    getLogger().warn("mail sync failed", {
      connectionId: account.id,
      durationMs: Date.now() - started,
      reason: error instanceof MailProviderError ? error.kind : "error",
    });
    return "failed";
  };

  const now = (deps.now ?? (() => new Date()))();
  const windowStart = new Date(now.getTime() - WINDOW_MS);
  const after = windowStart.toISOString().slice(0, 10);
  const timed: AdapterContext = {
    ...context,
    signal: AbortSignal.any([context.signal, AbortSignal.timeout(deps.deadlineMs ?? DEADLINE_MS)]),
  };

  let inbox: Listed;
  let sent: Listed;
  try {
    inbox = await listWindow(deps.mail, account, timed, "in:inbox", after, windowStart);
    sent = await listWindow(deps.mail, account, timed, "in:sent", after, windowStart);
  } catch (error) {
    return fail(error);
  }
  const partial = inbox.partial || sent.partial;

  const merged = new Map<
    string,
    { message: MailMessageSummary; inInbox: boolean; fromSelf: boolean }
  >();
  for (const [listed, flag] of [
    [inbox, "inInbox"],
    [sent, "fromSelf"],
  ] as const) {
    for (const message of listed.messages) {
      const entry = merged.get(message.id) ?? { message, inInbox: false, fromSelf: false };
      entry[flag] = true;
      merged.set(message.id, entry);
    }
  }

  try {
    const outcome = await prisma.$transaction(
      async (tx) => {
        const owned = await tx.$queryRaw<unknown[]>`
          SELECT 1 FROM mail_sync_states
          WHERE "connectionId" = ${account.id} AND "claimToken" = ${token}
          FOR UPDATE`;
        if (owned.length === 0) return "skipped" as const;

        const entries = [...merged.values()];
        for (let i = 0; i < entries.length; i += UPSERT_CHUNK) {
          const values = entries.slice(i, i + UPSERT_CHUNK).map(
            ({ message: m, inInbox, fromSelf }) => Prisma.sql`(
              ${randomUUID()}, ${spaceId}, ${userId}, ${account.id}, ${m.id}, ${m.threadId},
              ${m.from?.name ?? null}, ${m.from?.address ?? ""},
              ${m.to.map((a) => a.address)}::text[], ${m.cc.map((a) => a.address)}::text[],
              ${m.subject.slice(0, TEXT_CAP)}, ${m.snippet.slice(0, TEXT_CAP)},
              ${new Date(m.date)}, ${m.unread}, ${inInbox}, ${fromSelf}, ${now})`,
          );
          // Metadata only: triage columns are never in the update list, and the flags only turn on.
          await tx.$executeRaw`
            INSERT INTO mail_messages (
              id, "spaceId", "userId", "connectionId", "providerMessageId", "threadId",
              "fromName", "fromAddress", "toAddresses", "ccAddresses", subject, snippet,
              "receivedAt", unread, "inInbox", "fromSelf", "seenAt")
            VALUES ${Prisma.join(values)}
            ON CONFLICT ("connectionId", "providerMessageId") DO UPDATE SET
              "threadId" = EXCLUDED."threadId",
              "fromName" = EXCLUDED."fromName",
              "fromAddress" = EXCLUDED."fromAddress",
              "toAddresses" = EXCLUDED."toAddresses",
              "ccAddresses" = EXCLUDED."ccAddresses",
              subject = EXCLUDED.subject,
              snippet = EXCLUDED.snippet,
              "receivedAt" = EXCLUDED."receivedAt",
              unread = EXCLUDED.unread,
              "inInbox" = mail_messages."inInbox" OR EXCLUDED."inInbox",
              "fromSelf" = mail_messages."fromSelf" OR EXCLUDED."fromSelf",
              "seenAt" = EXCLUDED."seenAt"`;
        }

        const scope = { connectionId: account.id, spaceId, userId };
        await tx.cachedMailMessage.updateMany({
          where: { ...scope, inInbox: true, receivedAt: { lt: windowStart } },
          data: { inInbox: false },
        });
        if (!partial) {
          // A capped list shows only the newest 200, so older rows cannot be judged.
          const oldest = inbox.messages.at(-1);
          await tx.cachedMailMessage.updateMany({
            where: {
              ...scope,
              inInbox: true,
              providerMessageId: { notIn: inbox.messages.map((m) => m.id) },
              ...(inbox.capped && oldest ? { receivedAt: { gte: new Date(oldest.date) } } : {}),
            },
            data: { inInbox: false },
          });
        }
        // Also expires metadata that mail searches cached.
        await tx.cachedMailMessage.deleteMany({
          where: { ...scope, inInbox: false, seenAt: { lt: windowStart } },
        });

        if (partial) {
          await tx.$executeRaw`
            UPDATE mail_sync_states
            SET "lastErrorAt" = ${DB_NOW}, "syncStartedAt" = NULL, "claimToken" = NULL
            WHERE "connectionId" = ${account.id} AND "claimToken" = ${token}`;
          return "failed" as const;
        }
        await tx.$executeRaw`
          UPDATE mail_sync_states
          SET "lastSyncedAt" = ${DB_NOW}, "lastErrorAt" = NULL,
              "syncStartedAt" = NULL, "claimToken" = NULL
          WHERE "connectionId" = ${account.id} AND "claimToken" = ${token}`;
        return "synced" as const;
      },
      { timeout: 60_000, maxWait: 10_000 },
    );
    if (outcome === "failed") {
      getLogger().warn("mail sync was incomplete", {
        connectionId: account.id,
        durationMs: Date.now() - started,
      });
    }
    return outcome;
  } catch (error) {
    return fail(error);
  }
}

/** Collects up to 200 messages of one query inside the window, newest first. */
async function listWindow(
  mail: MailProvider,
  account: MailAccount,
  context: AdapterContext,
  query: string,
  after: string,
  windowStart: Date,
): Promise<Listed> {
  const messages: MailMessageSummary[] = [];
  let pageToken: string | undefined;
  let partial = false;
  do {
    const page = await mail.listMessages(
      account,
      { query, after, pageSize: PAGE_SIZE, pageToken, useCache: false },
      context,
    );
    messages.push(...page.messages);
    partial = (page.unhydratedIds?.length ?? 0) > 0;
    pageToken = page.nextPageToken;
  } while (pageToken && !partial && messages.length < MAX_MESSAGES);

  const capped = messages.length > MAX_MESSAGES || (messages.length >= MAX_MESSAGES && !!pageToken);
  const inWindow = messages
    .slice(0, MAX_MESSAGES)
    .filter((m) => new Date(m.date).getTime() >= windowStart.getTime());
  return { messages: inWindow, capped, partial };
}

/**
 * Deletes a connection's cached mail, to-dos and sync state. `connections.revoke` only marks the row,
 * so no cascade fires; the revoke handler calls this in the same transaction.
 */
export async function deleteMailConnectionData(
  tx: Prisma.TransactionClient,
  scope: { spaceId: string; userId: string; connectionId: string },
): Promise<void> {
  const { spaceId, userId, connectionId } = scope;
  // Done to-dos quote the account's mail too, so every to-do goes, not just open ones.
  await tx.inboxTodo.deleteMany({ where: { spaceId, userId, connectionId } });
  await tx.cachedMailMessage.deleteMany({ where: { connectionId, spaceId, userId } });
  await tx.mailSyncState.deleteMany({ where: { connectionId, connection: { spaceId, userId } } });
}
