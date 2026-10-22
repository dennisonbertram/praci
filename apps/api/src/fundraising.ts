import type { McpOAuthBroker, SafeSyncDeps } from "@rakazo/adapters";
import { syncSafesForUser } from "@rakazo/adapters";
import type { Actor, FundraisingOverview, MercurySafeState } from "@rakazo/contracts";
import { actorScope, financeProviderForEndpoint } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { getFundraisingOverview } from "@rakazo/db";

export interface FundraisingDeps {
  prisma: PrismaClient;
  mcpOAuth: Pick<McpOAuthBroker, "statusFor">;
  /** Unset where MCP is off: the page then shows the rows as last synced. */
  safeCallToolFor?: SafeSyncDeps["callToolFor"];
}

/** Waits at most this long for Mercury before the page loads with what is already stored. */
const PAGE_SYNC_MS = 20_000;

/** The Fundraising header's Mercury state, read from the connection and the last sync. */
async function mercuryState(deps: FundraisingDeps, actor: Actor): Promise<MercurySafeState> {
  const scope = actorScope(actor);
  const servers = await deps.prisma.mcpServer.findMany({
    where: { ...scope, enabled: true },
    orderBy: { createdAt: "asc" },
  });
  const server = servers.find((s) => financeProviderForEndpoint(s.endpoint) === "mercury");
  const state = await deps.prisma.safeSyncState.findUnique({
    where: { spaceId_userId: scope },
  });
  const lastSyncedAt = state?.lastSyncedAt?.toISOString() ?? null;
  const unreadable = state?.unreadable ?? 0;
  if (!server) return { status: "not_connected", lastSyncedAt, unreadable };
  const login = await deps.mcpOAuth.statusFor(server, actor);
  let status: MercurySafeState["status"] = "ok";
  if (login === "none") status = "not_connected";
  else if (login === "reconnect" || state?.needsReconnect) status = "needs_reconnect";
  else if (state?.lastErrorAt && (!state.lastSyncedAt || state.lastErrorAt > state.lastSyncedAt))
    status = "error";
  return { status, lastSyncedAt, unreadable };
}

async function syncQuietly(
  deps: FundraisingDeps,
  actor: Actor,
  force: boolean,
  signal?: AbortSignal,
) {
  if (!deps.safeCallToolFor) return;
  // The outcome is recorded on the sync state row; a database error must not hide the page.
  await syncSafesForUser(
    { prisma: deps.prisma, callToolFor: deps.safeCallToolFor },
    actorScope(actor),
    {
      force,
      signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(PAGE_SYNC_MS)]),
    },
  ).catch(() => undefined);
}

/** The Fundraising page data, after a throttled Mercury SAFE sync. */
export async function fundraisingOverview(
  deps: FundraisingDeps,
  actor: Actor,
): Promise<FundraisingOverview> {
  await syncQuietly(deps, actor, false);
  const overview = await getFundraisingOverview(deps.prisma, actorScope(actor));
  return { ...overview, mercury: await mercuryState(deps, actor) };
}

/** Syncs now; the 15-minute throttle does not apply, the in-flight claim still does. */
export async function fundraisingRefresh(
  deps: FundraisingDeps,
  actor: Actor,
  signal?: AbortSignal,
): Promise<{ ok: true }> {
  await syncQuietly(deps, actor, true, signal);
  return { ok: true };
}
