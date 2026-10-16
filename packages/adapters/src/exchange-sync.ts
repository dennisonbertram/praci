import type { SecretStore } from "@rakazo/adapter-kit";
import type { ExchangeProvider } from "@rakazo/contracts";
import type { ExchangeBucket } from "@rakazo/core";
import {
  addAmounts,
  exchangeBucket,
  exchangeFixedPrice,
  exchangeParts,
  exchangePriceKey,
  exchangeValueCents,
  isZeroAmount,
  normalizeExchangeAsset,
} from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import type { ExchangeCredentials } from "./exchange-clients.js";
import { ExchangeError, fetchExchangeBalances } from "./exchange-clients.js";
import {
  classifyRpcError,
  createRpcClient,
  fetchPrices,
  rpcFailureMessage,
} from "./rpc-crypto-source.js";
import { persistPreparedSecret } from "./secret-persistence.js";

export interface ExchangeSyncDeps {
  prisma: PrismaClient;
  secrets: SecretStore;
  fetch?: typeof fetch;
  now?: () => Date;
}

export interface PricedBalance {
  asset: string;
  amount: string;
  usdPrice: string | null;
  usdValueCents: bigint | null;
  bucket: ExchangeBucket;
}

type Scope = { spaceId: string; userId: string };
export type ExchangeSyncResult = { ok: true } | { ok: false; message: string };

const STALE_MS = 15 * 60_000;
const scopeOf = ({ spaceId, userId }: Scope) => ({ spaceId, userId });

/** Reads, merges (staked/earn suffixes fold into the base asset) and prices one exchange's balances. */
export async function readExchangeBalances(
  deps: Pick<ExchangeSyncDeps, "fetch" | "now">,
  provider: ExchangeProvider,
  creds: ExchangeCredentials,
  signal?: AbortSignal,
): Promise<PricedBalance[]> {
  const raw = await fetchExchangeBalances(provider, creds, { ...deps, signal });
  const merged = new Map<string, string>();
  for (const { code, amount } of raw) {
    const asset = normalizeExchangeAsset(provider, code);
    const sum = addAmounts(merged.get(asset) ?? "0", amount);
    // A malformed amount leaves that asset out rather than guessing.
    if (sum !== null) merged.set(asset, sum);
  }
  const held = [...merged].filter(([, amount]) => !isZeroAmount(amount));
  const keys = held.flatMap(([asset]) => {
    const key = exchangeFixedPrice(asset) === null ? exchangePriceKey(asset) : null;
    return key ? [key] : [];
  });
  let prices = new Map<string, string>();
  if (keys.length) {
    try {
      prices = await fetchPrices(createRpcClient({ fetch: deps.fetch, signal }), keys);
    } catch (error) {
      throw new Error(rpcFailureMessage(classifyRpcError(error), ["Prices"], "the price service"));
    }
  }
  return held.map(([asset, amount]) => {
    const key = exchangePriceKey(asset);
    const usdPrice = exchangeFixedPrice(asset) ?? (key ? (prices.get(key) ?? null) : null);
    return {
      asset,
      amount,
      usdPrice,
      usdValueCents: exchangeValueCents(amount, usdPrice),
      bucket: exchangeBucket(asset),
    };
  });
}

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/** Replaces the connection's balances, upserts today's snapshot, and marks the sync good. */
async function storeBalances(
  tx: Tx,
  scope: Scope,
  connectionId: string,
  rows: PricedBalance[],
  syncedAt: Date,
) {
  await tx.financeExchangeBalance.deleteMany({ where: { connectionId, ...scopeOf(scope) } });
  await tx.financeExchangeBalance.createMany({
    data: rows.map((r) => ({ ...scopeOf(scope), connectionId, ...r, syncedAt })),
  });
  const parts = exchangeParts(rows);
  const day = syncedAt.toISOString().slice(0, 10);
  await tx.financeExchangeSnapshot.upsert({
    where: { connectionId_day: { connectionId, day } },
    create: { ...scopeOf(scope), connectionId, day, ...parts },
    update: parts,
  });
  await tx.financeExchangeConnection.updateMany({
    where: { id: connectionId, ...scopeOf(scope) },
    data: { lastSyncedAt: syncedAt, lastError: null },
  });
}

const messageOf = (error: unknown) =>
  error instanceof ExchangeError || (error instanceof Error && /^Prices:/.test(error.message))
    ? error.message
    : "The sync failed";

/**
 * Validates the key by reading balances first; only then stores the secret and the connection, so a
 * bad key leaves nothing behind. Connecting a provider again replaces its key. Throws ExchangeError.
 */
export async function connectExchange(
  deps: ExchangeSyncDeps,
  scope: Scope,
  provider: ExchangeProvider,
  creds: ExchangeCredentials,
  signal?: AbortSignal,
): Promise<{ id: string }> {
  let rows: PricedBalance[];
  try {
    rows = await readExchangeBalances(deps, provider, creds, signal);
  } catch (error) {
    if (error instanceof ExchangeError) throw error;
    throw new Error(messageOf(error));
  }
  const stored = await deps.secrets.put(JSON.stringify(creds), {
    operationId: "finance.exchange.connect",
    traceId: "finance.exchange.connect",
    ...scopeOf(scope),
    botId: "finance",
    signal: signal ?? new AbortController().signal,
  });
  const syncedAt = (deps.now ?? (() => new Date()))();
  return persistPreparedSecret(deps.prisma, deps.secrets, stored, () =>
    deps.prisma.$transaction(
      async (tx) => {
        await tx.secret.create({
          data: {
            id: stored.id,
            ...scopeOf(scope),
            kind: "exchange",
            ciphertext: stored.ciphertext,
          },
        });
        const previous = await tx.financeExchangeConnection.findFirst({
          where: { ...scopeOf(scope), provider },
        });
        const connection = previous
          ? await tx.financeExchangeConnection.update({
              where: { id: previous.id },
              data: { secretId: stored.id },
            })
          : await tx.financeExchangeConnection.create({
              data: { ...scopeOf(scope), provider, secretId: stored.id },
            });
        if (previous) {
          await tx.secret.deleteMany({ where: { id: previous.secretId, ...scopeOf(scope) } });
        }
        await storeBalances(tx, scope, connection.id, rows, syncedAt);
        return { id: connection.id };
      },
      { timeout: 30_000 },
    ),
  );
}

/**
 * Re-reads every connection of the user (or `connectionIds`). Skips a connection synced in the last
 * 15 minutes unless `force`. A failed connection keeps its old balances and records the reason.
 * ponytail: no cross-process claim; two simultaneous syncs both write the same current balances.
 */
export async function syncExchanges(
  deps: ExchangeSyncDeps,
  scope: Scope,
  opts: { connectionIds?: string[]; force?: boolean; signal?: AbortSignal } = {},
): Promise<ExchangeSyncResult[]> {
  const now = (deps.now ?? (() => new Date()))();
  const connections = await deps.prisma.financeExchangeConnection.findMany({
    where: { ...scopeOf(scope), ...(opts.connectionIds ? { id: { in: opts.connectionIds } } : {}) },
  });
  const results: ExchangeSyncResult[] = [];
  for (const c of connections) {
    if (
      !opts.force &&
      c.lastSyncedAt &&
      !c.lastError &&
      now.getTime() - c.lastSyncedAt.getTime() < STALE_MS
    )
      continue;
    try {
      const secret = await deps.prisma.secret.findFirst({
        where: { id: c.secretId, ...scopeOf(scope) },
      });
      if (!secret) throw new ExchangeError(c.provider as ExchangeProvider, "invalid_key");
      const creds = JSON.parse(
        await deps.secrets.load(secret.ciphertext, secret.id),
      ) as ExchangeCredentials;
      const rows = await readExchangeBalances(
        deps,
        c.provider as ExchangeProvider,
        creds,
        opts.signal,
      );
      // The connection row is the version: reconnecting swaps secretId. The guarded update locks the
      // row until commit, so a reconnect cannot slip in between this check and the balance write.
      const kept = await deps.prisma.$transaction(
        async (tx) => {
          const own = await tx.financeExchangeConnection.updateMany({
            where: { id: c.id, secretId: c.secretId, ...scopeOf(scope) },
            data: { lastError: null },
          });
          if (own.count === 0) return false;
          await storeBalances(tx, scope, c.id, rows, now);
          return true;
        },
        { timeout: 30_000 },
      );
      // The key was replaced while we fetched; the result belongs to the old account, so drop it.
      if (kept) results.push({ ok: true });
    } catch (error) {
      if (opts.signal?.aborted) continue;
      const message = messageOf(error);
      getLogger().warn("exchange sync failed", { provider: c.provider, reason: message });
      await deps.prisma.financeExchangeConnection.updateMany({
        where: { id: c.id, secretId: c.secretId, ...scopeOf(scope) },
        data: { lastError: message },
      });
      results.push({ ok: false, message });
    }
  }
  return results;
}
