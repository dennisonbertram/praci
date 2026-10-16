import { ORPCError } from "@orpc/server";
import {
  ALCHEMY_MESSAGE_PREFIX,
  AlchemyError,
  buildMcpCredentialBlob,
  hasAlchemyKey,
  persistPreparedSecret,
  removeAlchemyKey,
  storeAlchemyKey,
  validateAlchemyKey,
} from "@rakazo/adapters";
import type {
  Actor,
  CryptoHolding,
  FinanceCryptoConnectInput,
  FinanceCryptoConnectOutput,
  FinanceCryptoOutput,
  FinanceCryptoProviderConnectInput,
  FinanceWallet,
  FinanceWalletAddInput,
  FinanceWalletUpdateInput,
} from "@rakazo/contracts";
import {
  actorScope,
  CRYPTO_API_KEY_HEADER,
  CRYPTO_MCP_ENDPOINT,
  financeAgentSpawnKey,
  isCryptoEndpoint,
} from "@rakazo/contracts";
import { exchangeParts, parseWalletInput, summarizeCrypto } from "@rakazo/core";
import type { Prisma } from "@rakazo/db";
import { isUniqueViolation } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import type { FinanceDeps } from "./finance.js";
import { assignFinanceServers } from "./finance-agent.js";
import { notFound } from "./inbox.js";

const toWallet = (row: Prisma.FinanceWalletGetPayload<object>): FinanceWallet => ({
  id: row.id,
  address: row.address,
  ensName: row.ensName,
  label: row.label,
  type: row.type as FinanceWallet["type"],
  safeOwners: (row.safeOwners as string[] | null) ?? null,
  safeThreshold: row.safeThreshold,
});

/** The database stores "" for the native coin (Postgres uniques treat NULLs as distinct); the contract says null. */
const toHolding = (row: Prisma.FinanceCryptoHoldingGetPayload<object>): CryptoHolding => ({
  walletId: row.walletId,
  chainId: row.chainId,
  tokenAddress: row.tokenAddress === "" ? null : row.tokenAddress,
  symbol: row.symbol,
  name: row.name,
  decimals: row.decimals,
  rawBalance: row.rawBalance,
  usdPrice: row.usdPrice,
  usdValueCents: row.usdValueCents === null ? null : Number(row.usdValueCents),
  syncedAt: row.syncedAt.toISOString(),
});

export async function loadWallets(deps: FinanceDeps, actor: Actor): Promise<FinanceWallet[]> {
  const rows = await deps.prisma.financeWallet.findMany({
    where: actorScope(actor),
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toWallet);
}

async function loadHoldings(deps: FinanceDeps, actor: Actor): Promise<CryptoHolding[]> {
  const rows = await deps.prisma.financeCryptoHolding.findMany({ where: actorScope(actor) });
  return rows.map(toHolding);
}

/** The Blockscout server is not a finance provider, so it is found by its endpoint. */
async function cryptoServer(deps: FinanceDeps, actor: Actor) {
  const rows = await deps.prisma.mcpServer.findMany({
    where: actorScope(actor),
    orderBy: { createdAt: "asc" },
  });
  const own = rows.filter((row) => isCryptoEndpoint(row.endpoint));
  return own.find((row) => row.enabled) ?? own[0];
}

/**
 * Adds exchange balances to a wallet summary's totals only. `byWallet` and `byChain` stay
 * wallet-only because they feed the per-wallet and per-chain rows.
 */
function withExchanges(
  summary: ReturnType<typeof summarizeCrypto>,
  exchange: readonly { bucket: string; usdValueCents: bigint | null }[],
) {
  if (exchange.length === 0) return summary;
  const parts = exchangeParts(exchange);
  return {
    ...summary,
    totalCents: summary.totalCents + Number(parts.stablecoinCents + parts.otherCryptoCents),
    stablecoinCents: (summary.stablecoinCents ?? 0) + Number(parts.stablecoinCents),
    unpricedTokenCount:
      summary.unpricedTokenCount + exchange.filter((b) => b.usdValueCents === null).length,
  };
}

/**
 * The card for the overview: null with no wallet and no exchange, so the page shows no crypto card
 * at all. Exchange balances are added to the totals here, so every reader of this summary (overview,
 * runway, history's today) counts them through the same cash rule.
 */
export async function loadCryptoSummary(deps: FinanceDeps, actor: Actor) {
  const [wallets, holdings, exchange] = await Promise.all([
    loadWallets(deps, actor),
    loadHoldings(deps, actor),
    deps.prisma.financeExchangeBalance.findMany({ where: actorScope(actor) }),
  ]);
  if (wallets.length === 0 && exchange.length === 0) return null;
  return withExchanges(summarizeCrypto(holdings), exchange);
}

/** Best effort: a failed sync never fails the call that asked for it; the error is on the crypto page. */
export async function syncCryptoQuietly(
  deps: FinanceDeps,
  actor: Actor,
  opts: { walletIds?: string[]; signal?: AbortSignal } = {},
): Promise<void> {
  try {
    await deps.crypto?.sync(actorScope(actor), { ...opts, force: true });
  } catch (error) {
    getLogger().warn("crypto sync failed", {
      reason: error instanceof Error ? error.name : "error",
    });
  }
}

export async function financeWallets(deps: FinanceDeps, actor: Actor) {
  return loadWallets(deps, actor);
}

export async function financeWalletAdd(
  deps: FinanceDeps,
  actor: Actor,
  input: FinanceWalletAddInput,
  signal?: AbortSignal,
): Promise<FinanceWallet> {
  const parsed = parseWalletInput(input.addressOrEns);
  if (!parsed) {
    throw new ORPCError("BAD_REQUEST", { message: "Enter a 0x address or an ENS name" });
  }
  // The first wallet creates the user's keyless Blockscout server row (no network call; a stored key
  // is kept): the Finance agent's detail lookups use it and the sync throttle is keyed by it.
  if (!(await cryptoServer(deps, actor))) await financeCryptoConnect(deps, actor, {});
  let address: string;
  let ensName: string | null = null;
  if (parsed.kind === "address") {
    address = parsed.address;
  } else {
    if (!deps.crypto) {
      throw new ORPCError("SERVICE_UNAVAILABLE", { message: "ENS lookup is not available" });
    }
    let resolved: string | null;
    try {
      resolved = await deps.crypto.resolveEns(actorScope(actor), parsed.name, signal);
    } catch (error) {
      getLogger().warn("ens lookup failed", {
        reason: error instanceof Error ? error.name : "error",
      });
      throw new ORPCError("BAD_GATEWAY", { message: "Could not look up that ENS name" });
    }
    if (!resolved) throw new ORPCError("BAD_REQUEST", { message: "That ENS name was not found" });
    address = resolved;
    ensName = parsed.name;
  }
  const conflict = () => new ORPCError("CONFLICT", { message: "That wallet is already added" });
  if (await deps.prisma.financeWallet.findFirst({ where: { ...actorScope(actor), address } })) {
    throw conflict();
  }
  const row = await deps.prisma.financeWallet
    .create({
      data: {
        ...actorScope(actor),
        address,
        ensName,
        label: input.label ?? null,
        type: input.type,
      },
    })
    // A concurrent add of the same address hits the unique index.
    .catch((error: unknown) => {
      throw isUniqueViolation(error) ? conflict() : error;
    });
  await syncCryptoQuietly(deps, actor, { walletIds: [row.id], signal });
  return toWallet(row);
}

export async function financeWalletUpdate(
  deps: FinanceDeps,
  actor: Actor,
  input: FinanceWalletUpdateInput,
): Promise<FinanceWallet> {
  const where = { id: input.id, ...actorScope(actor) };
  const { count } = await deps.prisma.financeWallet.updateMany({
    where,
    data: {
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
    },
  });
  const row = count ? await deps.prisma.financeWallet.findFirst({ where }) : null;
  if (!row) throw notFound();
  return toWallet(row);
}

/** Holdings go with the wallet (foreign key cascade). */
export async function financeWalletRemove(
  deps: FinanceDeps,
  actor: Actor,
  input: { id: string },
): Promise<{ ok: true }> {
  const { count } = await deps.prisma.financeWallet.deleteMany({
    where: { id: input.id, ...actorScope(actor) },
  });
  if (!count) throw notFound();
  return { ok: true };
}

export async function financeCrypto(deps: FinanceDeps, actor: Actor): Promise<FinanceCryptoOutput> {
  const [wallets, holdings, server, alchemyConnected, exchange] = await Promise.all([
    loadWallets(deps, actor),
    loadHoldings(deps, actor),
    cryptoServer(deps, actor),
    hasAlchemyKey(deps.prisma, actorScope(actor)),
    deps.prisma.financeExchangeBalance.findMany({ where: actorScope(actor) }),
  ]);
  const state = server
    ? await deps.prisma.financeSyncState.findFirst({
        where: { mcpServerId: server.id, ...actorScope(actor) },
        select: { lastError: true },
      })
    : null;
  return {
    connected: Boolean(server?.enabled),
    // Headers keep only the names (value true); the key itself stays in the encrypted secret.
    hasApiKey: Boolean(
      (server?.headers as Record<string, unknown> | null)?.[CRYPTO_API_KEY_HEADER],
    ),
    summary: withExchanges(summarizeCrypto(holdings), exchange),
    holdings,
    wallets,
    lastError: state?.lastError ?? null,
    // The sync records its Alchemy fallback reason in the shared lastError, always starting "Alchemy".
    alchemy: {
      connected: alchemyConnected,
      lastError:
        alchemyConnected && state?.lastError?.startsWith(ALCHEMY_MESSAGE_PREFIX)
          ? state.lastError
          : null,
    },
  };
}

const ALCHEMY_REJECTION: Record<string, string> = {
  rejected: "Alchemy rejected the API key",
  rate_limit: "Alchemy rate limit reached, try again shortly",
  unavailable: "Could not reach Alchemy, try again shortly",
};

/** Checks the key with one request, stores it encrypted (replacing any earlier key), then re-syncs. */
export async function financeCryptoProviderConnect(
  deps: FinanceDeps,
  actor: Actor,
  input: FinanceCryptoProviderConnectInput,
): Promise<{ ok: true }> {
  try {
    await validateAlchemyKey(input.apiKey, { fetch: deps.fetch });
  } catch (error) {
    if (!(error instanceof AlchemyError)) throw error;
    throw new ORPCError(error.kind === "rejected" ? "BAD_REQUEST" : "BAD_GATEWAY", {
      message: ALCHEMY_REJECTION[error.kind] ?? "Could not check the Alchemy key",
    });
  }
  await storeAlchemyKey(deps.prisma, deps.secrets, actorScope(actor), input.apiKey);
  await syncCryptoQuietly(deps, actor);
  return { ok: true };
}

export async function financeCryptoProviderRemove(
  deps: FinanceDeps,
  actor: Actor,
): Promise<{ ok: true }> {
  await removeAlchemyKey(deps.prisma, actorScope(actor));
  await syncCryptoQuietly(deps, actor);
  return { ok: true };
}

/**
 * Idempotent: one Blockscout server per user. A given key replaces the stored one; no key leaves
 * the current key as it is. The key is stored like any custom MCP header and never returned.
 */
export async function financeCryptoConnect(
  deps: FinanceDeps,
  actor: Actor,
  input: FinanceCryptoConnectInput,
): Promise<FinanceCryptoConnectOutput> {
  const find = () => cryptoServer(deps, actor);
  const server =
    (await find()) ??
    (await deps.prisma.mcpServer
      .create({
        data: {
          ...actorScope(actor),
          slug: "crypto-blockscout",
          name: "Blockscout",
          transport: "streamable_http",
          endpoint: CRYPTO_MCP_ENDPOINT,
          enabled: true,
        },
      })
      // A concurrent connect may have created it first; use that one.
      .catch(async (error: unknown) => {
        const raced = await find();
        if (!raced) throw error;
        return raced;
      }));
  const previousSecretId = server.secretId;
  let current = server;
  if (input.apiKey !== undefined) {
    const blob = buildMcpCredentialBlob({ headers: { [CRYPTO_API_KEY_HEADER]: input.apiKey } });
    const stored = await deps.secrets.put(blob ?? "", {
      operationId: "finance.crypto.connect",
      traceId: "finance.crypto.connect",
      ...actorScope(actor),
      botId: "mcp",
      signal: new AbortController().signal,
    });
    current = await persistPreparedSecret(deps.prisma, deps.secrets, stored, () =>
      deps.prisma.$transaction(async (tx) => {
        await tx.secret.create({
          data: { id: stored.id, ...actorScope(actor), kind: "mcp", ciphertext: stored.ciphertext },
        });
        const updated = await tx.mcpServer.update({
          where: { id: server.id },
          data: {
            enabled: true,
            secretId: stored.id,
            headers: { [CRYPTO_API_KEY_HEADER]: true },
            revision: { increment: 1 },
          },
        });
        if (previousSecretId) {
          await tx.secret.deleteMany({ where: { id: previousSecretId, ...actorScope(actor) } });
        }
        return updated;
      }),
    );
  } else if (!server.enabled) {
    current = await deps.prisma.mcpServer.update({
      where: { id: server.id },
      data: { enabled: true, revision: { increment: 1 } },
    });
  }
  const bot = await deps.prisma.bot.findFirst({
    where: { ...actorScope(actor), spawnKey: financeAgentSpawnKey(actor.userId), archivedAt: null },
    select: { id: true },
  });
  if (bot) await assignFinanceServers(deps.prisma, actor, bot.id);
  // A new or replaced key should show results right away.
  if (input.apiKey !== undefined) await syncCryptoQuietly(deps, actor);
  return {
    serverId: current.id,
    hasApiKey: Boolean(
      (current.headers as Record<string, unknown> | null)?.[CRYPTO_API_KEY_HEADER],
    ),
  };
}
