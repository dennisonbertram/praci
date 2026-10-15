import { randomUUID } from "node:crypto";
import { CRYPTO_CHAINS } from "@rakazo/contracts";
import { holdingParts, usdValueCents } from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";
import { Prisma } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import { findCryptoServer } from "./blockscout-crypto-call-tool.js";
import type { TokenRow } from "./crypto-token-list.js";
import type {
  ChainSnapshot,
  RpcClientOptions,
  RpcFailureKind,
  SafeDetails,
} from "./rpc-crypto-source.js";
import {
  classifyRpcError,
  createRpcClient,
  fetchChainSnapshot,
  fetchPrices,
  fetchSafeDetails,
  mostActionable,
  rpcFailureMessage,
} from "./rpc-crypto-source.js";

export interface CryptoSyncDeps extends Pick<RpcClientOptions, "fetch" | "urls"> {
  prisma: PrismaClient;
  now?: () => Date;
  /** Minimum gap between requests to one RPC host (default 200 ms). */
  callGapMs?: number;
  /** First wait before retrying a 429 or 5xx; doubles per retry (default 1000 ms). */
  retryDelayMs?: number;
}

export interface CryptoSyncOptions {
  /** Only these wallets (the add-wallet flow). */
  walletIds?: string[];
  /** Skip the 15-minute throttle. The in-flight claim still applies. */
  force?: boolean;
  signal?: AbortSignal;
}

export type CryptoSyncResult =
  | { ok: true; outcome: "synced" | "skipped"; failedChains: number[] }
  | { ok: false; error: "not_connected" | "failed"; message: string };

const DB_NOW = Prisma.sql`timezone('utc', now())`;
/** Shorter than the 2-minute stale claim. */
const DEADLINE_MS = 100_000;

/**
 * Replaces every tracked wallet's holdings with current balances read from public EVM JSON-RPC on
 * each chain, priced by DefiLlama. No vendor account or key is needed. The throttle and claim use
 * `finance_sync_states`, which is keyed by an McpServer id, so the user's Blockscout server row
 * (created with the first wallet) is reused as that key; Blockscout itself is never called. A chain
 * that fails keeps its previous rows and is listed in `failedChains`; the sync fails only when no
 * chain could be read. Without that row it returns `not_connected`.
 */
export async function syncCryptoHoldings(
  deps: CryptoSyncDeps,
  scope: { spaceId: string; userId: string },
  opts: CryptoSyncOptions = {},
): Promise<CryptoSyncResult> {
  const { prisma } = deps;
  const { spaceId, userId } = scope;
  const server = await findCryptoServer(prisma, scope);
  if (!server) return { ok: false, error: "not_connected", message: "Crypto is not connected" };
  const wallets = await prisma.financeWallet.findMany({
    where: { spaceId, userId, ...(opts.walletIds ? { id: { in: opts.walletIds } } : {}) },
    select: { id: true, address: true, type: true },
  });
  if (wallets.length === 0) return { ok: true, outcome: "skipped", failedChains: [] };

  const token = randomUUID();
  const force = opts.force === true;
  await prisma.$executeRaw`
    INSERT INTO finance_sync_states ("mcpServerId", "spaceId", "userId")
    SELECT id, "spaceId", "userId" FROM mcp_servers
    WHERE id = ${server.id} AND "spaceId" = ${spaceId} AND "userId" = ${userId} AND enabled
    ON CONFLICT DO NOTHING`;
  const claimed = await prisma.$queryRaw<unknown[]>`
    UPDATE finance_sync_states
    SET "syncStartedAt" = ${DB_NOW}, "claimToken" = ${token}
    WHERE "mcpServerId" = ${server.id} AND "spaceId" = ${spaceId} AND "userId" = ${userId}
      AND (${force}
        OR (("lastSyncedAt" IS NULL OR "lastSyncedAt" < ${DB_NOW} - interval '15 minutes')
          AND ("lastErrorAt" IS NULL OR "lastErrorAt" < ${DB_NOW} - interval '1 minute')))
      AND ("syncStartedAt" IS NULL OR "syncStartedAt" < ${DB_NOW} - interval '2 minutes')
    RETURNING "mcpServerId"`;
  if (claimed.length === 0) return { ok: true, outcome: "skipped", failedChains: [] };

  const release = (message: string) => {
    if (opts.signal?.aborted)
      return prisma.$executeRaw`
        UPDATE finance_sync_states SET "syncStartedAt" = NULL, "claimToken" = NULL
        WHERE "mcpServerId" = ${server.id} AND "claimToken" = ${token}`;
    getLogger().warn("crypto sync failed", { serverId: server.id, reason: message });
    return prisma.$executeRaw`
      UPDATE finance_sync_states
      SET "lastErrorAt" = ${DB_NOW}, "lastError" = ${message},
          "needsReconnect" = false, "syncStartedAt" = NULL, "claimToken" = NULL
      WHERE "mcpServerId" = ${server.id} AND "claimToken" = ${token}`;
  };
  const fail = async (message: string): Promise<CryptoSyncResult> => {
    await release(message);
    if (opts.signal?.aborted) return { ok: true, outcome: "skipped", failedChains: [] };
    return { ok: false, error: "failed", message };
  };

  const signal = AbortSignal.any([
    ...(opts.signal ? [opts.signal] : []),
    AbortSignal.timeout(DEADLINE_MS),
  ]);
  const rpc = createRpcClient({
    fetch: deps.fetch,
    urls: deps.urls,
    gapMs: deps.callGapMs,
    retryDelayMs: deps.retryDelayMs,
    signal,
  });
  type WalletRead = {
    id: string;
    snapshots: Map<number, ChainSnapshot>;
    failed: number[];
    safe: SafeDetails | null;
  };
  const reads: WalletRead[] = [];
  const problems: Array<{ chainId: number; kind: RpcFailureKind }> = [];
  try {
    // Tokens already stored for a wallet are always re-read, even when the bundled list lacks them.
    const stored = await prisma.financeCryptoHolding.findMany({
      where: {
        spaceId,
        userId,
        walletId: { in: wallets.map((w) => w.id) },
        tokenAddress: { not: "" },
      },
      select: {
        walletId: true,
        chainId: true,
        tokenAddress: true,
        symbol: true,
        name: true,
        decimals: true,
      },
    });
    for (const wallet of wallets) {
      const read: WalletRead = { id: wallet.id, snapshots: new Map(), failed: [], safe: null };
      // Chains are started together; requests to one host still run one at a time.
      await Promise.all(
        CRYPTO_CHAINS.map(async ({ id }) => {
          const extra: TokenRow[] = stored
            .filter((s) => s.walletId === wallet.id && s.chainId === id)
            .map((s) => [s.tokenAddress, s.symbol, s.name, s.decimals]);
          try {
            read.snapshots.set(id, await fetchChainSnapshot(rpc, id, wallet.address, extra));
          } catch (error) {
            read.failed.push(id);
            problems.push({ chainId: id, kind: classifyRpcError(error) });
          }
        }),
      );
      signal.throwIfAborted();
      if (wallet.type !== "exchange") {
        for (const [chainId, snapshot] of read.snapshots) {
          if (!snapshot.isContract) continue;
          try {
            read.safe = await fetchSafeDetails(rpc, chainId, wallet.address);
          } catch (error) {
            problems.push({ chainId, kind: classifyRpcError(error) });
          }
          if (read.safe) break;
        }
      }
      reads.push(read);
    }
  } catch (error) {
    return fail(rpcFailureMessage(classifyRpcError(error), []));
  }
  const problem = describeProblems(problems);
  if (reads.every((r) => r.snapshots.size === 0))
    return fail(problem ?? rpcFailureMessage("failed", []));

  // One price request for everything held. Without prices the sync fails and the old rows stay.
  try {
    const keys = reads.flatMap((r) =>
      [...r.snapshots.values()].flatMap((s) => s.holdings.map((h) => h.llamaKey)),
    );
    const prices = await fetchPrices(rpc, keys);
    for (const read of reads)
      for (const snapshot of read.snapshots.values())
        for (const h of snapshot.holdings)
          h.usdPrice = prices.get(h.llamaKey.toLowerCase()) ?? null;
  } catch (error) {
    return fail(rpcFailureMessage(classifyRpcError(error), ["Prices"], "the price service"));
  }

  const failedChains = [...new Set(reads.flatMap((r) => r.failed))].sort((a, b) => a - b);
  const syncedAt = (deps.now ?? (() => new Date()))();
  try {
    const outcome = await prisma.$transaction(
      async (tx) => {
        const owned = await tx.$queryRaw<unknown[]>`
          SELECT 1 FROM finance_sync_states
          WHERE "mcpServerId" = ${server.id} AND "claimToken" = ${token}
          FOR UPDATE`;
        if (owned.length === 0) return "skipped" as const;
        // A wallet removed while the chains were read is simply not written.
        const live = new Set(
          (
            await tx.financeWallet.findMany({
              where: { spaceId, userId, id: { in: reads.map((r) => r.id) } },
              select: { id: true },
            })
          ).map((w) => w.id),
        );
        for (const read of reads) {
          if (!live.has(read.id)) continue;
          for (const [chainId, snapshot] of read.snapshots) {
            await tx.financeCryptoHolding.deleteMany({
              where: { spaceId, userId, walletId: read.id, chainId },
            });
            await tx.financeCryptoHolding.createMany({
              data: snapshot.holdings.map(({ llamaKey: _key, ...h }) => ({
                spaceId,
                userId,
                walletId: read.id,
                chainId,
                ...h,
                usdValueCents: usdValueCents(h.rawBalance, h.decimals, h.usdPrice),
                syncedAt,
              })),
            });
          }
          // One row per wallet and UTC day: later syncs that day overwrite it. Taken from the stored
          // rows, so a chain that failed this time still counts at its old value.
          if (read.snapshots.size > 0) {
            const parts = holdingParts(
              await tx.financeCryptoHolding.findMany({
                where: { spaceId, userId, walletId: read.id },
                select: { chainId: true, tokenAddress: true, usdValueCents: true },
              }),
            );
            const day = syncedAt.toISOString().slice(0, 10);
            await tx.financeCryptoSnapshot.upsert({
              where: { walletId_day: { walletId: read.id, day } },
              create: { spaceId, userId, walletId: read.id, day, ...parts },
              update: parts,
            });
          }
          // Safe details only fill in; the user's chosen type is never changed here.
          if (read.safe)
            await tx.financeWallet.updateMany({
              where: { id: read.id, spaceId, userId },
              data: { safeOwners: read.safe.owners, safeThreshold: read.safe.threshold },
            });
        }
        await tx.$executeRaw`
          UPDATE finance_sync_states
          SET "lastSyncedAt" = ${DB_NOW}, "lastErrorAt" = ${problem ? DB_NOW : null},
              "lastError" = ${problem}, "needsReconnect" = false,
              "syncStartedAt" = NULL, "claimToken" = NULL
          WHERE "mcpServerId" = ${server.id} AND "claimToken" = ${token}`;
        return "synced" as const;
      },
      { timeout: 60_000, maxWait: 10_000 },
    );
    return { ok: true, outcome, failedChains };
  } catch (error) {
    return fail(rpcFailureMessage(classifyRpcError(error), []));
  }
}

/** The one message for the page: the most actionable reason, naming the chains that failed for it. */
function describeProblems(
  problems: Array<{ chainId: number; kind: RpcFailureKind }>,
): string | null {
  if (problems.length === 0) return null;
  const kind = mostActionable(problems.map((p) => p.kind));
  const failed = new Set(problems.filter((p) => p.kind === kind).map((p) => p.chainId));
  return rpcFailureMessage(
    kind,
    CRYPTO_CHAINS.filter((c) => failed.has(c.id)).map((c) => c.name),
  );
}
