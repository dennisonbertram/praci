import { randomUUID } from "node:crypto";
import type {
  BackgroundJobPayloads,
  JobPublisher,
  MeetingSource,
  SecretStore,
} from "@rakazo/adapter-kit";
import { MeetingSourceError, meetingsSyncJob } from "@rakazo/adapter-kit";
import { GRANOLA_API_CONNECTOR_ID } from "@rakazo/contracts";
import type { MeetingSourceRef, PrismaClient } from "@rakazo/db";
import { getMeetingSyncState, upsertMeetingSyncState } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import { runMeetingSyncPass } from "./meeting-sync.js";

type SyncPayload = BackgroundJobPayloads["meetings.sync"];
type Scope = { spaceId: string; userId: string };

/** A claim older than this is a dead sync. A run stops well before it (RUN_BUDGET_MS). */
const CLAIM_STALE_MS = 5 * 60_000;
const RUN_BUDGET_MS = 120_000;
/** An agent asking for a refresh inside this window gets the stored meetings. */
const MIN_INTERVAL_MS = 60_000;
/** The scheduler queues a source whose sync state has been idle this long. */
export const MEETINGS_SYNC_INTERVAL_MS = 5 * 60_000;
const CHAIN_DELAY_MS = 1_000;
const MIN_RATE_LIMIT_DELAY_MS = 60_000;
const PAGES_PER_RUN = 2;

/** What a registry entry needs to build a source for one connection or MCP server. */
export interface MeetingSourceInput extends Scope {
  /** The connection's stored secret, for a source bound by `connectionId`. */
  apiKey?: string;
  connectionId?: string;
  mcpServerId?: string;
}

/**
 * Provider to MeetingSource. A new provider is one entry. `connectorId` limits the entry to
 * connections of that connector, so another connection's secret is never sent to the provider.
 */
export type MeetingSourceRegistry = Record<
  string,
  { connectorId?: string; create(input: MeetingSourceInput): MeetingSource }
>;

export interface MeetingSyncJobDeps {
  prisma: PrismaClient;
  jobs: JobPublisher;
  secrets: SecretStore;
  registry: MeetingSourceRegistry;
  /** Pages read in one run; for tests. */
  pagesPerRun?: number;
}

const refOf = (p: { connectionId?: string; mcpServerId?: string }): MeetingSourceRef | null =>
  p.connectionId && !p.mcpServerId
    ? { connectionId: p.connectionId }
    : p.mcpServerId && !p.connectionId
      ? { mcpServerId: p.mcpServerId }
      : null;

const whereOf = (ref: MeetingSourceRef) =>
  "connectionId" in ref ? { connectionId: ref.connectionId } : { mcpServerId: ref.mcpServerId };

/**
 * Loads the source row for the payload's owner and returns its input, or null when the row is not
 * theirs or not usable. Nothing secret is read before the owner check passes.
 */
async function resolveInput(
  deps: MeetingSyncJobDeps,
  payload: SyncPayload,
  ref: MeetingSourceRef,
  entry: MeetingSourceRegistry[string],
): Promise<MeetingSourceInput | null> {
  const { prisma } = deps;
  const scope = { spaceId: payload.spaceId, userId: payload.userId };
  if ("mcpServerId" in ref) {
    const server = await prisma.mcpServer.findFirst({
      where: { id: ref.mcpServerId, ...scope },
      select: { id: true },
    });
    return server ? { ...scope, mcpServerId: server.id } : null;
  }
  const connection = await prisma.connection.findFirst({
    where: { id: ref.connectionId, ...scope },
    select: { id: true, connectorId: true, status: true, secretId: true },
  });
  if (connection?.status !== "connected" || !connection.secretId) return null;
  if (entry.connectorId && connection.connectorId !== entry.connectorId) return null;
  const secret = await prisma.secret.findFirst({
    where: { id: connection.secretId, ...scope },
    select: { id: true, ciphertext: true },
  });
  if (!secret) return null;
  const apiKey = (await deps.secrets.load(secret.ciphertext, secret.id)).trim();
  return { ...scope, connectionId: connection.id, apiKey };
}

/** Takes the source's sync claim, or returns null when another worker holds a live one. */
async function claim(
  prisma: PrismaClient,
  scope: Scope,
  ref: MeetingSourceRef,
  provider: string,
  token: string,
) {
  try {
    await upsertMeetingSyncState(prisma, scope, ref, provider);
  } catch (error) {
    // Another worker created the row first.
    if ((error as { code?: string }).code !== "P2002") throw error;
  }
  const now = new Date();
  const { count } = await prisma.meetingSyncState.updateMany({
    where: {
      ...whereOf(ref),
      ...scope,
      OR: [{ claimToken: null }, { claimedAt: { lt: new Date(now.getTime() - CLAIM_STALE_MS) } }],
    },
    data: { claimToken: token, claimedAt: now },
  });
  return count ? getMeetingSyncState(prisma, scope, ref) : null;
}

/**
 * The `meetings.sync` job: one bounded run of a source's sync. Source errors are recorded on the
 * sync state and the job still succeeds; a database error propagates and the queue retries. A pass
 * that needs more pages queues itself again. Stored meetings are never deleted here.
 */
export async function runMeetingSyncJob(
  deps: MeetingSyncJobDeps,
  payload: SyncPayload,
  signal: AbortSignal = AbortSignal.timeout(RUN_BUDGET_MS),
): Promise<void> {
  const { prisma } = deps;
  const scope = { spaceId: payload.spaceId, userId: payload.userId };
  const ref = refOf(payload);
  const entry = deps.registry[payload.provider];
  if (!ref || !entry) return;
  const input = await resolveInput(deps, payload, ref, entry);
  if (!input) return;

  const token = randomUUID();
  const state = await claim(prisma, scope, ref, payload.provider, token);
  if (!state) return;
  const mine = { ...whereOf(ref), ...scope, claimToken: token };
  const release = (data: Record<string, unknown> = {}) =>
    prisma.meetingSyncState.updateMany({
      where: mine,
      data: { claimToken: null, claimedAt: null, ...data },
    });

  // A pass in progress continues; a fresh one waits out the minimum interval.
  if (
    !state.cursor &&
    state.lastSyncedAt &&
    Date.now() - state.lastSyncedAt.getTime() < MIN_INTERVAL_MS
  ) {
    await release();
    return;
  }

  let more = false;
  let retryAt: Date | undefined;
  try {
    const result = await runMeetingSyncPass(
      {
        prisma,
        scope,
        ref,
        provider: payload.provider,
        source: entry.create(input),
        maxPages: deps.pagesPerRun ?? PAGES_PER_RUN,
        signal,
        save: async (patch) =>
          (
            await prisma.meetingSyncState.updateMany({
              where: mine,
              data: { ...patch, claimedAt: new Date() },
            })
          ).count === 1,
      },
      state,
    );
    if (result.lostClaim) return;
    more = !result.done;
    await release({ lastSyncedAt: new Date(), error: null });
  } catch (error) {
    if (!(error instanceof MeetingSourceError)) {
      await release();
      throw error;
    }
    if (error.kind === "auth") {
      // The key stops working until someone reconnects; no retry until then.
      if ("connectionId" in ref)
        await prisma.connection.updateMany({
          where: { id: ref.connectionId, ...scope, status: "connected" },
          data: { status: "needs_reconnect" },
        });
      await release({ error: "Key rejected" });
      return;
    }
    if (error.kind === "rate_limit")
      retryAt = new Date(Date.now() + Math.max(error.retryAfterMs ?? 0, MIN_RATE_LIMIT_DELAY_MS));
    // Only the short reason is stored, never a vendor payload. The scheduler retries later.
    getLogger().warn("meetings sync failed", { provider: payload.provider, kind: error.kind });
    await release({ error: error.message.slice(0, 200) });
  }
  if (more)
    await deps.jobs.enqueue(meetingsSyncJob(payload, new Date(Date.now() + CHAIN_DELAY_MS)));
  else if (retryAt) await deps.jobs.enqueue(meetingsSyncJob(payload, retryAt));
}

/**
 * An agent asks for fresh meetings. Queues a sync unless one is running or the last one finished
 * inside the minimum interval. Only the caller's own connected source is touched.
 */
export async function requestMeetingSync(
  deps: Pick<MeetingSyncJobDeps, "prisma" | "jobs">,
  scope: Scope,
  ref: MeetingSourceRef,
  provider: string,
): Promise<{ syncing: boolean }> {
  const { prisma } = deps;
  const owned =
    "mcpServerId" in ref
      ? await prisma.mcpServer.findFirst({ where: { id: ref.mcpServerId, ...scope } })
      : await prisma.connection.findFirst({
          where: { id: ref.connectionId, ...scope, status: "connected" },
        });
  if (!owned) return { syncing: false };
  const state = await getMeetingSyncState(prisma, scope, ref);
  const now = Date.now();
  if (state?.claimedAt && now - state.claimedAt.getTime() < CLAIM_STALE_MS)
    return { syncing: true };
  if (state?.lastSyncedAt && !state.cursor && now - state.lastSyncedAt.getTime() < MIN_INTERVAL_MS)
    return { syncing: false };
  await deps.jobs.enqueue(
    meetingsSyncJob({
      ...scope,
      provider,
      ...("mcpServerId" in ref
        ? { mcpServerId: ref.mcpServerId }
        : { connectionId: ref.connectionId }),
    }),
  );
  return { syncing: true };
}

/**
 * Scheduler step, run by the elected reconciler: queues a sync for each connected Granola key whose
 * sync state has been idle for 5 minutes (or does not exist yet). A source that failed is retried by
 * the same rule. `keepExisting` leaves a job that is already waiting alone.
 */
export async function reconcileMeetingSyncs(
  deps: Pick<MeetingSyncJobDeps, "prisma" | "jobs">,
  options: { now?: Date; batchSize?: number } = {},
): Promise<number> {
  const now = options.now ?? new Date();
  const batchSize = options.batchSize ?? 200;
  const idleBefore = new Date(now.getTime() - MEETINGS_SYNC_INTERVAL_MS);
  let queued = 0;
  let after: string | undefined;
  for (;;) {
    const page = await deps.prisma.connection.findMany({
      where: {
        connectorId: GRANOLA_API_CONNECTOR_ID,
        status: "connected",
        OR: [{ meetingSyncState: null }, { meetingSyncState: { updatedAt: { lt: idleBefore } } }],
      },
      select: { id: true, spaceId: true, userId: true },
      orderBy: { id: "asc" },
      take: batchSize,
      ...(after ? { cursor: { id: after }, skip: 1 } : {}),
    });
    for (const c of page) {
      await deps.jobs.enqueue({
        ...meetingsSyncJob({
          spaceId: c.spaceId,
          userId: c.userId,
          provider: "granola",
          connectionId: c.id,
        }),
        keepExisting: true,
      });
      queued++;
    }
    if (page.length < batchSize) return queued;
    after = page[page.length - 1]?.id;
  }
}
