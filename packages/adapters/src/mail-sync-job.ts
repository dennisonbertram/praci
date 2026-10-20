import type {
  AdapterContext,
  BackgroundJobPayloads,
  JobPublisher,
  MailAccount,
  MailProvider,
} from "@rakazo/adapter-kit";
import { mailSyncJob } from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";
import { Prisma } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import { applyPendingSenderRules } from "./mail-sender-rules.js";
import { applySkipInbox } from "./mail-skip-inbox.js";
import { syncMailbox } from "./mail-sync.js";

type Scope = { spaceId: string; userId: string };
type ConnectionScope = BackgroundJobPayloads["mail.sync"];

/** Stored timestamps are UTC without a zone, so compare against Postgres' UTC clock. */
const DB_NOW = Prisma.sql`timezone('utc', now())`;
/** A claim older than this is a dead sync (the same limit `syncMailbox` uses). */
const CLAIM_LIVE = Prisma.sql`interval '5 minutes'`;
/** A queued request older than this is assumed lost, so a new one is queued. */
const REQUEST_LIVE = Prisma.sql`interval '2 minutes'`;
/** Same as the throttle in `syncMailbox`. */
const THROTTLE_MS = 60_000;
/** Pause before a chained backfill job; just past the throttle. */
const CHAIN_DELAY_MS = THROTTLE_MS + 1_000;
/** Covers clock drift between this process and Postgres, so a delayed job is never early. */
const CLOCK_MARGIN_MS = 500;
const POLL_MS = 200;
/** Longest a sync job runs; shorter than graphile's lock expiry and longer than a window listing. */
const JOB_TIMEOUT_MS = 250_000;

/**
 * `refresh`: a page load or the agent asking. Skips inside the throttle, waits out a rate limit.
 * `wake`: the provider says mail changed. Like refresh, but inside the throttle it runs when the throttle ends.
 * `now`: the user just sent mail. Clears the throttle.
 */
export type MailSyncRequestMode = "refresh" | "wake" | "now";

interface RequestState {
  claimed: boolean;
  requested: boolean;
  throttleMs: number;
  backoffMs: number;
}

/**
 * Queues the connection's `mail.sync` job unless one is already waiting or running (`refresh`), and
 * returns whether a sync is now on its way. Only the caller's own connected mail connection is
 * touched: anything else queues nothing and creates no state row. `syncRequestedAt` is set before
 * the enqueue, so a job that finishes at once cannot leave a stale "syncing" flag behind it.
 */
export async function requestMailSync(
  deps: { prisma: PrismaClient; jobs: JobPublisher },
  scope: ConnectionScope,
  mode: MailSyncRequestMode,
): Promise<{ syncing: boolean }> {
  const { prisma } = deps;
  const { spaceId, userId, connectionId } = scope;
  await prisma.$executeRaw`
    INSERT INTO mail_sync_states ("connectionId")
    SELECT id FROM connections
    WHERE id = ${connectionId} AND "spaceId" = ${spaceId} AND "userId" = ${userId}
      AND status = 'connected'
    ON CONFLICT DO NOTHING`;
  const [row] = await prisma.$queryRaw<
    Array<{ claimed: boolean; requested: boolean; throttleMs: number; backoffMs: number }>
  >`
    SELECT
      (s."syncStartedAt" IS NOT NULL AND s."syncStartedAt" > ${DB_NOW} - ${CLAIM_LIVE}) AS "claimed",
      (s."syncRequestedAt" IS NOT NULL AND s."syncRequestedAt" > ${DB_NOW} - ${REQUEST_LIVE}) AS "requested",
      COALESCE(GREATEST(0, EXTRACT(EPOCH FROM (GREATEST(s."lastSyncedAt", s."lastErrorAt") + interval '60 seconds' - ${DB_NOW})) * 1000), 0)::float8 AS "throttleMs",
      COALESCE(GREATEST(0, EXTRACT(EPOCH FROM (s."backoffUntil" - ${DB_NOW})) * 1000), 0)::float8 AS "backoffMs"
    FROM mail_sync_states s
    JOIN connections c ON c.id = s."connectionId"
    WHERE s."connectionId" = ${connectionId} AND c."spaceId" = ${spaceId}
      AND c."userId" = ${userId} AND c.status = 'connected'`;
  if (!row) return { syncing: false };
  const state: RequestState = {
    claimed: row.claimed,
    requested: row.requested,
    throttleMs: Number(row.throttleMs),
    backoffMs: Number(row.backoffMs),
  };

  const delayMs = plannedDelay(mode, state);
  if (delayMs === null) return { syncing: state.claimed || state.requested };

  // Postgres' clock set the throttle, so the new flag and the delay both come from it.
  await prisma.$executeRaw`
    UPDATE mail_sync_states
    SET "syncRequestedAt" = ${DB_NOW}
      ${mode === "now" ? Prisma.sql`, "lastSyncedAt" = NULL` : Prisma.empty}
    WHERE "connectionId" = ${connectionId}`;
  try {
    await deps.jobs.enqueue(
      mailSyncJob(
        scope,
        delayMs > 0 ? new Date(Date.now() + delayMs + CLOCK_MARGIN_MS) : undefined,
      ),
    );
  } catch (error) {
    await prisma.$executeRaw`
      UPDATE mail_sync_states SET "syncRequestedAt" = NULL WHERE "connectionId" = ${connectionId}`;
    throw error;
  }
  return { syncing: true };
}

/** How long to hold the job back, or null when nothing needs queuing. */
function plannedDelay(mode: MailSyncRequestMode, state: RequestState): number | null {
  if (mode === "refresh") {
    if (state.claimed || state.requested) return null;
    if (state.backoffMs > 0) return state.backoffMs;
    return state.throttleMs > 0 ? null : 0;
  }
  if (mode === "wake") {
    // A job is waiting and will see the change; one running may have read the mailbox before it.
    if (state.requested && !state.claimed) return null;
    if (state.claimed) return Math.max(state.backoffMs, CHAIN_DELAY_MS);
    return Math.max(state.backoffMs, state.throttleMs);
  }
  // A running sync has detached from the job key, so a second job is queued behind its claim. The
  // running job also sees the request flag and syncs once more when it finishes.
  return state.claimed ? Math.max(state.backoffMs, CHAIN_DELAY_MS) : state.backoffMs;
}

export interface MailSyncStatus {
  connectionId: string;
  syncing: boolean;
  lastSyncedAt: Date | null;
  /** The last sync failed outright. */
  failed: boolean;
}

/** Where each connection's sync stands. `syncing` covers a job that is queued as well as one running. */
export async function mailSyncStatus(
  prisma: PrismaClient,
  scope: Scope,
  connectionIds: string[],
): Promise<MailSyncStatus[]> {
  if (connectionIds.length === 0) return [];
  const rows = await prisma.$queryRaw<
    Array<{ connectionId: string; syncing: boolean; lastSyncedAt: Date | null; failed: boolean }>
  >`
    SELECT s."connectionId",
      ((s."syncStartedAt" IS NOT NULL AND s."syncStartedAt" > ${DB_NOW} - ${CLAIM_LIVE})
        OR (s."syncRequestedAt" IS NOT NULL AND s."syncRequestedAt" > ${DB_NOW} - ${REQUEST_LIVE})) AS "syncing",
      s."lastSyncedAt", (s."lastErrorAt" IS NOT NULL) AS "failed"
    FROM mail_sync_states s
    JOIN connections c ON c.id = s."connectionId"
    WHERE s."connectionId" IN (${Prisma.join(connectionIds)})
      AND c."spaceId" = ${scope.spaceId} AND c."userId" = ${scope.userId}`;
  const byId = new Map(rows.map((r) => [r.connectionId, r]));
  return connectionIds.map(
    (connectionId) =>
      byId.get(connectionId) ?? { connectionId, syncing: false, lastSyncedAt: null, failed: false },
  );
}

/**
 * Waits until none of the connections is syncing, or `timeoutMs` passes. Never throws on a timeout;
 * the caller answers from the cache either way.
 */
export async function waitForMailSync(
  prisma: PrismaClient,
  scope: Scope,
  connectionIds: string[],
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<{ timedOut: boolean }> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const statuses = await mailSyncStatus(prisma, scope, connectionIds);
    if (!statuses.some((s) => s.syncing)) return { timedOut: false };
    const left = deadline - Date.now();
    if (left <= 0 || signal?.aborted) return { timedOut: true };
    await new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", done);
        resolve();
      };
      const timer = setTimeout(done, Math.min(POLL_MS, left));
      signal?.addEventListener("abort", done, { once: true });
    });
  }
}

export interface MailSyncJobDeps {
  prisma: PrismaClient;
  mail: MailProvider;
  jobs: JobPublisher;
  /** Runs after each sync, for example to renew a push watch. Failures are logged, never thrown. */
  afterSync?: (account: MailAccount, context: AdapterContext) => Promise<void>;
  /** MAIL_WRITES_DISABLED: no mail is changed in the provider, so skip-inbox senders are not archived. */
  mailWritesDisabled?: boolean;
}

/**
 * The `mail.sync` job. Provider errors are recorded on the sync state by `syncMailbox`, so the job
 * still succeeds; a database error propagates and the queue retries. While older mail is waiting to
 * be cached, it queues itself again just past the throttle.
 */
export async function runMailSyncJob(
  deps: MailSyncJobDeps,
  payload: ConnectionScope,
  signal: AbortSignal = AbortSignal.timeout(JOB_TIMEOUT_MS),
): Promise<void> {
  const { prisma } = deps;
  const { spaceId, userId, connectionId } = payload;
  const [clock] = await prisma.$queryRaw<Array<{ startedAt: Date }>>`
    SELECT ${DB_NOW} AS "startedAt"`;
  let startedAt = clock?.startedAt as Date;
  // A request made while this job runs is newer than startedAt, so it stays set.
  const clearRequest = () =>
    prisma.$executeRaw`
      UPDATE mail_sync_states s SET "syncRequestedAt" = NULL
      FROM connections c
      WHERE s."connectionId" = ${connectionId} AND c.id = s."connectionId"
        AND c."spaceId" = ${spaceId} AND c."userId" = ${userId}
        AND s."syncRequestedAt" <= ${startedAt}`;

  const operationId = `mail.sync:${connectionId}`;
  const context: AdapterContext = { operationId, traceId: operationId, spaceId, userId, signal };
  const accounts = await deps.mail.listAccounts({ spaceId, userId }, context);
  const account = accounts.find((a) => a.id === connectionId);
  if (!account) {
    await clearRequest();
    return;
  }

  let outcome = await syncMailbox(deps, account, context);
  // A sync requested while this one ran (a send, or mail that arrived mid-sync) was skipped by the
  // claim, and this sync may have read the mailbox before it. Run once more, without the throttle.
  const [late] = await prisma.$queryRaw<Array<{ late: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM mail_sync_states s JOIN connections c ON c.id = s."connectionId"
      WHERE s."connectionId" = ${connectionId} AND c."spaceId" = ${spaceId}
        AND c."userId" = ${userId} AND s."syncRequestedAt" > ${startedAt}) AS "late"`;
  if (outcome === "synced" && late?.late && !signal.aborted) {
    await prisma.$executeRaw`
      UPDATE mail_sync_states SET "lastSyncedAt" = NULL WHERE "connectionId" = ${connectionId}`;
    await clearRequest();
    const [again] = await prisma.$queryRaw<Array<{ startedAt: Date }>>`
      SELECT ${DB_NOW} AS "startedAt"`;
    startedAt = again?.startedAt as Date;
    outcome = await syncMailbox(deps, account, context);
  }
  await clearRequest();

  if (outcome === "synced") {
    await applySkipInbox(
      { prisma, mail: deps.mail, writesDisabled: deps.mailWritesDisabled },
      account,
      context,
    ).catch((error: unknown) => {
      getLogger().warn("skip inbox failed", {
        connectionId,
        reason: error instanceof Error ? error.name : "error",
      });
    });
  }

  // Filters that waited for the account to be reconnected with the permission. Not tied to the
  // sync's outcome: a throttled run right after the reconnect is the one that should make them.
  await applyPendingSenderRules(
    { prisma, mail: deps.mail, writesDisabled: deps.mailWritesDisabled },
    account,
    context,
  ).catch((error: unknown) => {
    getLogger().warn("sender rules failed", {
      connectionId,
      reason: error instanceof Error ? error.name : "error",
    });
  });

  await deps.afterSync?.(account, context).catch((error: unknown) => {
    getLogger().warn("mail sync follow-up failed", {
      connectionId,
      reason: error instanceof Error ? error.name : "error",
    });
  });

  if (outcome === "failed") return;
  const [state] = await prisma.$queryRaw<Array<{ backfill: unknown; needsReconnect: boolean }>>`
    SELECT s."backfill", s."needsReconnect"
    FROM mail_sync_states s JOIN connections c ON c.id = s."connectionId"
    WHERE s."connectionId" = ${connectionId} AND c."spaceId" = ${spaceId}
      AND c."userId" = ${userId} AND c.status = 'connected'`;
  if (state?.backfill && !state.needsReconnect) {
    // Not through requestMailSync: this is no user request, so it sets no "syncing" flag.
    await deps.jobs.enqueue(mailSyncJob(payload, new Date(Date.now() + CHAIN_DELAY_MS)));
  }
}

/**
 * Syncs the account again right after a send, so the sent message is in the cache and triage can
 * see the thread was answered. A send is a real change, so it skips the 60-second throttle. Waits
 * at most `waitMs` for the job; it carries on in the background after that. Never throws.
 */
export async function syncAfterSend(
  deps: { prisma: PrismaClient; jobs: JobPublisher },
  account: MailAccount,
  context: AdapterContext,
  waitMs = 4_000,
): Promise<void> {
  const scope = { spaceId: context.spaceId, userId: context.userId };
  try {
    await requestMailSync(deps, { ...scope, connectionId: account.id }, "now");
    await waitForMailSync(deps.prisma, scope, [account.id], waitMs, context.signal);
  } catch (error) {
    getLogger().warn("mail sync after send failed", {
      reason: error instanceof Error ? error.name : "error",
    });
  }
}
