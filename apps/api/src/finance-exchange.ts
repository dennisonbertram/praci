import { ORPCError } from "@orpc/server";
import { connectExchange, ExchangeError, syncExchanges } from "@rakazo/adapters";
import type { Actor, FinanceExchange, FinanceExchangeConnectInput } from "@rakazo/contracts";
import { actorScope } from "@rakazo/contracts";
import { exchangeParts } from "@rakazo/core";
import type { Prisma } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import type { FinanceDeps } from "./finance.js";
import { notFound } from "./inbox.js";

const syncDeps = (deps: FinanceDeps) => ({
  prisma: deps.prisma,
  secrets: deps.secrets,
  fetch: deps.exchangeFetch,
  now: deps.now,
});

type Connection = Prisma.FinanceExchangeConnectionGetPayload<{ include: { balances: true } }>;

/** The secret reference and the key never leave the server. */
const toExchange = (row: Connection): FinanceExchange => {
  const parts = exchangeParts(row.balances);
  return {
    id: row.id,
    provider: row.provider as FinanceExchange["provider"],
    connected: row.lastSyncedAt !== null,
    lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
    lastError: row.lastError,
    totalCents: Number(parts.stablecoinCents + parts.otherCryptoCents),
    balances: row.balances
      .map((b) => ({
        asset: b.asset,
        amount: b.amount,
        usdPrice: b.usdPrice,
        usdValueCents: b.usdValueCents === null ? null : Number(b.usdValueCents),
      }))
      .sort((a, b) => (b.usdValueCents ?? -1) - (a.usdValueCents ?? -1)),
  };
};

export async function financeExchanges(
  deps: FinanceDeps,
  actor: Actor,
): Promise<FinanceExchange[]> {
  const rows = await deps.prisma.financeExchangeConnection.findMany({
    where: actorScope(actor),
    orderBy: { createdAt: "asc" },
    include: { balances: true },
  });
  return rows.map(toExchange);
}

/** Reads balances with the given key first; a key that fails leaves nothing stored. */
export async function financeExchangeConnect(
  deps: FinanceDeps,
  actor: Actor,
  input: FinanceExchangeConnectInput,
  signal?: AbortSignal,
): Promise<FinanceExchange> {
  let id: string;
  try {
    ({ id } = await connectExchange(
      syncDeps(deps),
      actorScope(actor),
      input.provider,
      { key: input.key, secret: input.secret },
      signal,
    ));
  } catch (error) {
    if (error instanceof ExchangeError)
      throw new ORPCError("BAD_REQUEST", { message: error.message });
    getLogger().warn("exchange connect failed", {
      reason: error instanceof Error ? error.name : "error",
    });
    throw new ORPCError("BAD_GATEWAY", {
      message:
        error instanceof Error && /^Prices:/.test(error.message)
          ? error.message
          : "Could not connect",
    });
  }
  const row = await deps.prisma.financeExchangeConnection.findFirst({
    where: { id, ...actorScope(actor) },
    include: { balances: true },
  });
  if (!row) throw notFound();
  return toExchange(row);
}

/** Balances and snapshots go with the connection (foreign key cascade); the key is deleted with it. */
export async function financeExchangeRemove(
  deps: FinanceDeps,
  actor: Actor,
  input: { id: string },
): Promise<{ ok: true }> {
  const where = { id: input.id, ...actorScope(actor) };
  const row = await deps.prisma.financeExchangeConnection.findFirst({ where });
  if (!row) throw notFound();
  await deps.prisma.$transaction(async (tx) => {
    await tx.financeExchangeConnection.deleteMany({ where });
    await tx.secret.deleteMany({ where: { id: row.secretId, ...actorScope(actor) } });
  });
  return { ok: true };
}

/** Best effort, like the crypto sync: a failure is recorded on the connection and shown on the page. */
export async function syncExchangesQuietly(
  deps: FinanceDeps,
  actor: Actor,
  signal?: AbortSignal,
): Promise<void> {
  try {
    await syncExchanges(syncDeps(deps), actorScope(actor), { force: true, signal });
  } catch (error) {
    getLogger().warn("exchange sync failed", {
      reason: error instanceof Error ? error.name : "error",
    });
  }
}

/** Daily exchange rows in the wallet-snapshot shape, with the connection id as the source id. */
export async function loadExchangeSnapshotRows(deps: FinanceDeps, actor: Actor) {
  const rows = await deps.prisma.financeExchangeSnapshot.findMany({ where: actorScope(actor) });
  return rows.map((r) => ({
    walletId: r.connectionId,
    day: r.day,
    stablecoinCents: Number(r.stablecoinCents),
    otherCryptoCents: Number(r.otherCryptoCents),
  }));
}

/** A page load starts the background job when an exchange is older than 15 minutes (a failure backs off one minute). */
export async function exchangesDue(deps: FinanceDeps, actor: Actor): Promise<boolean> {
  const now = (deps.now?.() ?? new Date()).getTime();
  const rows = await deps.prisma.financeExchangeConnection.findMany({
    where: actorScope(actor),
    select: { lastSyncedAt: true, lastError: true, updatedAt: true },
  });
  return rows.some(
    (r) =>
      (!r.lastSyncedAt || now - r.lastSyncedAt.getTime() > 15 * 60_000) &&
      !(r.lastError && now - r.updatedAt.getTime() < 60_000),
  );
}
