import { randomUUID } from "node:crypto";
import type {
  AdapterContext,
  JobPublisher,
  MailAccount,
  MailMessageSummary,
  MailProvider,
} from "@rakazo/adapter-kit";
import { inboxTriageJob, MAIL_REQUEST_ABORTED, MailProviderError } from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";
import { Prisma } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";

const WINDOW_MS = 14 * 86_400_000;
const PAGE_SIZE = 100;
/** Most messages kept from one list; Gmail pages are 100, so this is two pages. */
const MAX_MESSAGES = 200;
const DEADLINE_MS = 90_000;
/** A re-list chain older than this starts over, since its cursor may no longer be replayable. */
const CHAIN_MAX_MS = 60 * 60_000;
const TEXT_CAP = 500;
const UPSERT_CHUNK = 200;
/** Most changes applied one by one; more than this is cheaper to take from the window lists. */
const MAX_CHANGES = 500;

/** Stored timestamps are UTC without a zone, so compare against Postgres' UTC clock. */
const DB_NOW = Prisma.sql`timezone('utc', now())`;
/** After a rate limit, no sync of the connection starts for this long, so page loads do not keep hitting Gmail. */
const RATE_LIMIT_BACKOFF = Prisma.sql`interval '30 seconds'`;

export interface MailSyncDeps {
  prisma: PrismaClient;
  mail: MailProvider;
  /** Queues triage after each successful sync. */
  jobs: JobPublisher;
  /** Clock for the 14-day window; defaults to the system clock. */
  now?: () => Date;
  /** Provider deadline; defaults to 90 seconds, which is shorter than the 2-minute stale claim. */
  deadlineMs?: number;
}

/** `skipped`: throttled, claimed elsewhere, revoked, this sync lost its claim, or the caller left. */
export type MailSyncOutcome = "synced" | "skipped" | "failed";

interface Listed {
  messages: MailMessageSummary[];
  /** More messages exist beyond the ones kept. */
  capped: boolean;
  /** Some listed ids could not be hydrated. */
  partial: boolean;
}

/**
 * Syncs one account's inbox and sent mail for the last 14 days into the Postgres cache. With a
 * stored change cursor it fetches only what changed since; with none, with an expired one or with
 * too many changes it lists the 14-day window and stores a fresh cursor.
 * One conditional UPDATE is both the 60-second throttle and the in-flight claim; the write
 * transaction re-checks the claim token under a row lock, so a sync that lost its claim writes
 * nothing. Provider errors are recorded on the state row, never thrown. A successful sync, with or
 * without new mail, and an incomplete one that stored rows enqueue the user's `inbox.triage` job;
 * the job key merges repeats.
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
  const claimed = await prisma.$queryRaw<
    Array<{
      connectionId: string;
      changeCursor?: string | null;
      resumeCursor?: string | null;
      resumeStartedAt?: Date | null;
    }>
  >`
    UPDATE mail_sync_states s
    SET "syncStartedAt" = ${DB_NOW}, "claimToken" = ${token}
    FROM connections c
    WHERE s."connectionId" = ${account.id} AND c.id = s."connectionId"
      AND c."spaceId" = ${spaceId} AND c."userId" = ${userId} AND c.status = 'connected'
      AND (s."lastSyncedAt" IS NULL OR s."lastSyncedAt" < ${DB_NOW} - interval '60 seconds')
      AND (s."backoffUntil" IS NULL OR s."backoffUntil" < ${DB_NOW})
      AND (s."syncStartedAt" IS NULL OR s."syncStartedAt" < ${DB_NOW} - interval '2 minutes')
    RETURNING s."connectionId", s."changeCursor", s."resumeCursor", s."resumeStartedAt"`;
  if (claimed.length === 0) return "skipped";
  const previousCursor = claimed[0]?.changeCursor ?? null;
  const resumeCursor = claimed[0]?.resumeCursor ?? null;
  const resumeStartedAt = claimed[0]?.resumeStartedAt ?? null;

  const fail = async (error: unknown): Promise<"failed" | "skipped"> => {
    // The token check keeps a sync that lost its claim from clearing its replacement's.
    if (context.signal.aborted) {
      // The caller left (a page reload or navigation), which says nothing about the provider.
      await prisma.$executeRaw`
        UPDATE mail_sync_states
        SET "syncStartedAt" = NULL, "claimToken" = NULL
        WHERE "connectionId" = ${account.id} AND "claimToken" = ${token}`;
      getLogger().info("mail sync cancelled", {
        connectionId: account.id,
        durationMs: Date.now() - started,
      });
      return "skipped";
    }
    const needsReconnect = error instanceof MailProviderError && error.kind === "auth";
    const lastErrorKind = error instanceof MailProviderError ? error.kind : "unknown";
    await prisma.$executeRaw`
      UPDATE mail_sync_states
      SET "lastErrorAt" = ${DB_NOW}, "needsReconnect" = ${needsReconnect},
          "lastErrorKind" = ${lastErrorKind},
          "backoffUntil" = CASE WHEN ${lastErrorKind} = 'rate_limited'
            THEN ${DB_NOW} + ${RATE_LIMIT_BACKOFF} ELSE NULL END,
          "syncStartedAt" = NULL, "claimToken" = NULL
      WHERE "connectionId" = ${account.id} AND "claimToken" = ${token}`;
    getLogger().warn("mail sync failed", {
      connectionId: account.id,
      durationMs: Date.now() - started,
      reason: error instanceof MailProviderError ? error.kind : "error",
      ...(error instanceof MailProviderError && error.detail ? { detail: error.detail } : {}),
      ...(error instanceof MailProviderError
        ? error.kind === "unavailable" && !error.detail
          ? { errorMessage: error.message }
          : {}
        : { errorName: errorName(error) }),
    });
    return "failed";
  };

  const now = (deps.now ?? (() => new Date()))();
  const windowStart = new Date(now.getTime() - WINDOW_MS);
  const after = windowStart.toISOString().slice(0, 10);
  const deadline = AbortSignal.timeout(deps.deadlineMs ?? DEADLINE_MS);
  const timed: AdapterContext = { ...context, signal: AbortSignal.any([context.signal, deadline]) };

  const merged = new Map<
    string,
    { message: MailMessageSummary; inInbox: boolean; fromSelf: boolean }
  >();
  const deletedIds: string[] = [];
  /** Stored after a complete sync; undefined keeps the stored one. */
  let nextCursor: string | undefined;
  /** Set when the window was listed, also to refill a full inbox: clears messages no longer in it. */
  let inbox: Listed | undefined;
  let partial = false;
  /** The change cursor and start time of the window re-list chain this run belongs to. */
  let chain: { cursor: string; startedAt: Date } | undefined;
  /** True when the labels of the fetched messages are the truth, as in a change sync. */
  let incremental = false;
  try {
    const changes = previousCursor
      ? await deps.mail.listChanges(account, previousCursor, timed)
      : null;
    if (changes && changes.changedIds.length + changes.deletedIds.length <= MAX_CHANGES) {
      // Only what changed since the last sync: fetch the new and relabelled messages.
      const page = changes.changedIds.length
        ? await deps.mail.listMessages(
            account,
            { query: "", pageSize: PAGE_SIZE, ids: changes.changedIds, useCache: false },
            timed,
          )
        : { messages: [], unhydratedIds: [] };
      const unhydrated = new Set(page.unhydratedIds ?? []);
      const returned = new Set(page.messages.map((m) => m.id));
      partial = unhydrated.size > 0;
      for (const message of page.messages) {
        // The window lists skip trash and spam, so a message moved there is gone from the cache.
        if (message.labelIds.includes("TRASH") || message.labelIds.includes("SPAM"))
          deletedIds.push(message.id);
        else
          merged.set(message.id, {
            message,
            inInbox: message.labelIds.includes("INBOX"),
            fromSelf: message.labelIds.includes("SENT"),
          });
      }
      // Deleted since it was listed: the provider no longer has it.
      deletedIds.push(
        ...changes.deletedIds,
        ...changes.changedIds.filter((id) => !returned.has(id) && !unhydrated.has(id)),
      );
      nextCursor = changes.cursor;
      incremental = true;
      // The first sync keeps at most 200 inbox messages, so a full cache may hide older ones.
      // When mail leaves a full inbox, list the window again to bring the next ones in.
      const leaving = deletedIds.length > 0 || [...merged.values()].some((e) => !e.inInbox);
      if (
        leaving &&
        (await deps.prisma.cachedMailMessage.count({
          where: { connectionId: account.id, spaceId, userId, inInbox: true },
        })) >= MAX_MESSAGES
      ) {
        inbox = await listWindow(deps.mail, account, timed, "in:inbox", after, windowStart);
        partial = partial || inbox.partial;
        for (const message of inbox.messages)
          merged.set(message.id, {
            message,
            inInbox: true,
            fromSelf: merged.get(message.id)?.fromSelf ?? false,
          });
      }
    } else {
      if (previousCursor)
        getLogger().info("mail sync is listing the window again", {
          connectionId: account.id,
          reason: changes ? "many changes" : "cursor expired",
        });
      // Taken before the lists, so mail that arrives while they run is replayed next time.
      // Deletions the changes already name are not lost when the window is listed instead.
      if (changes) deletedIds.push(...changes.deletedIds);
      // An interrupted re-list resumes under the cursor its first run took, so the incremental sync
      // that follows replays every change since mail was first stored, and that mail can be reused.
      chain =
        resumeCursor && resumeStartedAt && now.getTime() - resumeStartedAt.getTime() < CHAIN_MAX_MS
          ? { cursor: resumeCursor, startedAt: resumeStartedAt }
          : { cursor: await deps.mail.getCursor(account, timed), startedAt: now };
      nextCursor = chain.cursor;
      const reuseSince = chain.startedAt;
      inbox = await listWindow(
        deps.mail,
        account,
        timed,
        "in:inbox",
        after,
        windowStart,
        reuseSince,
      );
      // Out of time: keep what loaded and list sent mail on a later run.
      const sent: Listed =
        inbox.partial || timed.signal.aborted
          ? { messages: [], capped: false, partial: true }
          : await listWindow(deps.mail, account, timed, "in:sent", after, windowStart, reuseSince);
      partial = inbox.partial || sent.partial;
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
    }
  } catch (error) {
    // Running out of our own time is an incomplete sync, not a provider failure: store what loaded.
    // Any other error, even one that arrives after the deadline, is a failure.
    const ranOutOfTime =
      deadline.aborted &&
      error instanceof MailProviderError &&
      error.kind === "unavailable" &&
      error.message === MAIL_REQUEST_ABORTED;
    if (!ranOutOfTime || context.signal.aborted) return fail(error);
    partial = true;
  }
  // The caller left, wherever that landed (a hydrate returns a partial page instead of throwing).
  if (context.signal.aborted) return fail(undefined);

  try {
    const outcome = await prisma.$transaction(
      async (tx) => {
        const owned = await tx.$queryRaw<unknown[]>`
          SELECT 1 FROM mail_sync_states
          WHERE "connectionId" = ${account.id} AND "claimToken" = ${token}
          FOR UPDATE`;
        if (owned.length === 0) return "skipped" as const;

        // A window sync turns the flag on here and clears it below for mail that left the list.
        // A change sync sees every label change, so the labels are the truth.
        const inInboxUpdate = !incremental
          ? Prisma.sql`mail_messages."inInbox" OR EXCLUDED."inInbox"`
          : Prisma.sql`EXCLUDED."inInbox"`;
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
              "inInbox" = ${inInboxUpdate},
              "fromSelf" = mail_messages."fromSelf" OR EXCLUDED."fromSelf",
              "seenAt" = EXCLUDED."seenAt"`;
        }

        const scope = { connectionId: account.id, spaceId, userId };
        if (deletedIds.length) {
          await tx.cachedMailMessage.deleteMany({
            where: { ...scope, providerMessageId: { in: deletedIds } },
          });
        }
        await tx.cachedMailMessage.updateMany({
          where: { ...scope, inInbox: true, receivedAt: { lt: windowStart } },
          data: { inInbox: false },
        });
        if (inbox && !partial) {
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

        // An incomplete sync is not an error: the mail that loaded is shown. It leaves lastSyncedAt
        // alone, so the 60-second throttle does not start, but it is usually a rate limit, so the
        // next sync waits out a short pause instead of retrying at once.
        if (partial) {
          await tx.$executeRaw`
            UPDATE mail_sync_states
            SET "lastErrorAt" = NULL, "needsReconnect" = false, "lastErrorKind" = NULL,
                "backoffUntil" = ${DB_NOW} + ${RATE_LIMIT_BACKOFF},
                "resumeCursor" = COALESCE(${chain?.cursor ?? null}::text, "resumeCursor"),
                "resumeStartedAt" = COALESCE(${chain?.startedAt ?? null}, "resumeStartedAt"),
                "syncStartedAt" = NULL, "claimToken" = NULL
            WHERE "connectionId" = ${account.id} AND "claimToken" = ${token}`;
          return "failed" as const;
        }
        await tx.$executeRaw`
          UPDATE mail_sync_states
          SET "lastSyncedAt" = ${DB_NOW}, "lastErrorAt" = NULL, "needsReconnect" = false, "lastErrorKind" = NULL, "backoffUntil" = NULL,
              "changeCursor" = COALESCE(${nextCursor ?? null}::text, "changeCursor"),
              "resumeCursor" = NULL, "resumeStartedAt" = NULL,
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
    // Rows an incomplete sync stored are usable, so they are triaged too.
    if (outcome === "synced" || (outcome === "failed" && merged.size > 0)) {
      // The mail is already cached; a lost enqueue only delays triage until the next sync.
      await deps.jobs.enqueue(inboxTriageJob(userId, spaceId)).catch((error) => {
        getLogger().warn("inbox triage enqueue failed", {
          connectionId: account.id,
          reason: error instanceof Error ? error.name : "error",
        });
      });
    }
    return outcome;
  } catch (error) {
    return fail(error);
  }
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "unknown";
}

/** Collects up to 200 messages of one query inside the window, newest first. */
async function listWindow(
  mail: MailProvider,
  account: MailAccount,
  context: AdapterContext,
  query: string,
  after: string,
  windowStart: Date,
  reuseSince?: Date,
): Promise<Listed> {
  const messages: MailMessageSummary[] = [];
  let pageToken: string | undefined;
  let partial = false;
  do {
    const page = await mail.listMessages(
      account,
      {
        query,
        after,
        pageSize: PAGE_SIZE,
        pageToken,
        useCache: false,
        ...(reuseSince ? { reuseCachedSince: reuseSince } : {}),
      },
      context,
    );
    messages.push(...page.messages);
    partial = (page.unhydratedIds?.length ?? 0) > 0;
    pageToken = page.nextPageToken;
  } while (pageToken && !partial && !context.signal.aborted && messages.length < MAX_MESSAGES);
  // Stopped by the deadline with pages left, which the provider cannot report as unhydrated.
  if (pageToken && context.signal.aborted && messages.length < MAX_MESSAGES) partial = true;

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

/**
 * Syncs the account again right after a send, so the sent message is in the cache and triage can
 * see the thread was answered. A send is a real change, so it skips the 60-second throttle. Waits
 * at most `waitMs`; the sync carries on in the background after that. Never throws.
 */
export async function syncAfterSend(
  deps: MailSyncDeps,
  account: MailAccount,
  context: AdapterContext,
  waitMs = 4_000,
): Promise<void> {
  const sync = (async () => {
    await deps.prisma.mailSyncState.updateMany({
      where: { connectionId: account.id },
      data: { lastSyncedAt: null },
    });
    await syncMailbox(deps, account, context);
  })().catch((error: unknown) => {
    getLogger().warn("mail sync after send failed", {
      reason: error instanceof Error ? error.name : "error",
    });
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([sync, new Promise<void>((resolve) => (timer = setTimeout(resolve, waitMs)))]);
  clearTimeout(timer);
}
