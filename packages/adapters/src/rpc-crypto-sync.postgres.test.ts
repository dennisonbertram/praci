import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CRYPTO_TOKEN_LIST } from "./crypto-token-list.js";
import type { FakeWorld } from "./rpc-crypto-fake-fetch.js";
import {
  fakeRpc,
  OWNER_1,
  OWNER_2,
  SAFE_WALLET,
  TOKEN_UNLISTED,
  WALLET_A,
  WALLET_B,
} from "./rpc-crypto-fake-fetch.js";
import { syncCryptoHoldings } from "./rpc-crypto-sync.js";

const LISTED = CRYPTO_TOKEN_LIST[1]?.[0]?.[0] as string;
const PRICES = {
  "coingecko:ethereum": { price: 2000, confidence: 0.99 },
  [`ethereum:${LISTED}`]: { price: 1, confidence: 0.99 },
};

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("crypto sync (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `cry-org-${suffix}`;
  const spaceId = `cry-space-${suffix}`;
  const userId = `cry-user-${suffix}`;
  const otherUserId = `cry-other-${suffix}`;
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let fake = fakeRpc();
  const sync = (opts: { force?: boolean; user?: string; walletIds?: string[] } = {}) =>
    syncCryptoHoldings(
      { prisma, fetch: fake.fetch, callGapMs: 0, retryDelayMs: 0 },
      { spaceId, userId: opts.user ?? userId },
      opts,
    );
  const addServer = (owner: string) =>
    prisma.mcpServer.create({
      data: {
        spaceId,
        userId: owner,
        slug: `bs-${randomUUID().slice(0, 6)}`,
        name: "Blockscout",
        transport: "streamable-http",
        endpoint: "https://mcp.blockscout.com/mcp",
      },
    });
  const addWallet = (owner: string, address: string, type = "personal") =>
    prisma.financeWallet.create({ data: { spaceId, userId: owner, address, type } });
  const rows = (owner = userId) =>
    prisma.financeCryptoHolding.findMany({
      where: { spaceId, userId: owner },
      orderBy: [{ chainId: "asc" }, { tokenAddress: "asc" }],
    });

  beforeAll(async () => {
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await db.prisma.$disconnect();
      await db.pool.end();
    };
    for (const id of [userId, otherUserId])
      await prisma.user.create({
        data: { id, name: id, email: `${id}@rakazo.test`, emailVerified: false },
      });
    await prisma.organization.create({
      data: { id: organizationId, name: "Crypto Org", slug: organizationId, createdAt: new Date() },
    });
    await prisma.space.create({
      data: { id: spaceId, organizationId, name: "General", isDefault: true },
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await close();
  });

  it("is not_connected without a server row", async () => {
    expect(await sync()).toMatchObject({ ok: false, error: "not_connected" });
  });

  it("stores priced and unpriced holdings, replaces the snapshot, keeps a failing chain with a named message, and throttles", async () => {
    const server = await addServer(userId);
    await addWallet(userId, WALLET_A);
    // A stored holding for an unlisted token is read again; its low-confidence price leaves it unpriced (a 18-decimals listed token is priced).
    await prisma.financeCryptoHolding.create({
      data: {
        spaceId,
        userId,
        walletId: (
          await prisma.financeWallet.findFirstOrThrow({
            where: { spaceId, userId, address: WALLET_A },
          })
        ).id,
        chainId: 1,
        tokenAddress: TOKEN_UNLISTED,
        symbol: "UNL",
        name: "Unlisted",
        decimals: 18,
        rawBalance: "1",
        usdPrice: null,
        usdValueCents: null,
        syncedAt: new Date(0),
      },
    });
    const world: FakeWorld = {
      prices: { ...PRICES, [`ethereum:${TOKEN_UNLISTED}`]: { price: 5, confidence: 0.5 } },
      chains: {
        1: {
          balances: { [WALLET_A]: 1_500_000_000_000_000_000n },
          tokens: {
            [LISTED]: { [WALLET_A]: 2_500_000_000_000_000_000n },
            [TOKEN_UNLISTED]: { [WALLET_A]: 7n },
          },
        },
        8453: { balances: { [WALLET_A]: 1_000_000_000_000_000_000n } },
      },
    };
    fake = fakeRpc(world);
    expect(await sync()).toEqual({ ok: true, outcome: "synced", failedChains: [] });
    let held = await rows();
    expect(held.map((r) => [r.chainId, r.tokenAddress, r.usdValueCents])).toEqual(
      [
        [1, "", 300000n],
        [1, LISTED, 250n],
        [1, TOKEN_UNLISTED, null],
        [8453, "", 200000n],
      ].sort(
        (a, b) => (a[0] as number) - (b[0] as number) || String(a[1]).localeCompare(String(b[1])),
      ),
    );
    expect(
      (await prisma.financeSyncState.findUniqueOrThrow({ where: { mcpServerId: server.id } }))
        .lastSyncedAt,
    ).not.toBeNull();

    const calls = fake.calls.length;
    expect(await sync()).toMatchObject({ outcome: "skipped" });
    expect(fake.calls).toHaveLength(calls);

    // Ethereum drops its tokens; Base fails and must keep its old row.
    fake = fakeRpc({
      prices: PRICES,
      chains: {
        1: { balances: { [WALLET_A]: 1_000_000_000_000_000_000n } },
        8453: { alwaysStatus: 503 },
      },
    });
    expect(await sync({ force: true })).toEqual({
      ok: true,
      outcome: "synced",
      failedChains: [8453],
    });
    held = await rows();
    expect(held.map((r) => [r.chainId, r.tokenAddress, r.usdValueCents])).toEqual([
      [1, "", 200000n],
      [8453, "", 200000n],
    ]);
    const state = await prisma.financeSyncState.findUniqueOrThrow({
      where: { mcpServerId: server.id },
    });
    expect(state.lastError).toBe("Base: the RPC endpoint is not responding");
  });

  it("fails and keeps rows when prices cannot be read", async () => {
    const owner = `${userId}-price`;
    await prisma.user.create({
      data: { id: owner, name: owner, email: `${owner}@rakazo.test`, emailVerified: false },
    });
    const server = await addServer(owner);
    await addWallet(owner, WALLET_A);
    const chains = { 1: { balances: { [WALLET_A]: 1_000_000_000_000_000_000n } } };
    fake = fakeRpc({ prices: PRICES, chains });
    await sync({ user: owner });
    fake = fakeRpc({ chains, priceStatus: 503 });
    expect(await sync({ user: owner, force: true })).toEqual({
      ok: false,
      error: "failed",
      message: "Prices: the price service is not responding",
    });
    expect(await rows(owner)).toHaveLength(1);
    expect(
      (await prisma.financeSyncState.findUniqueOrThrow({ where: { mcpServerId: server.id } }))
        .lastError,
    ).toBe("Prices: the price service is not responding");
  });

  it("records a Safe's owners and threshold without changing the user's type, and never touches an exchange", async () => {
    const safe = await addWallet(userId, SAFE_WALLET, "contract");
    const exchange = await addWallet(userId, WALLET_B, "exchange");
    fake = fakeRpc({
      prices: PRICES,
      chains: { 1: { contracts: [SAFE_WALLET, WALLET_B] } },
      safe: { owners: [OWNER_1, OWNER_2], threshold: 2 },
    });
    await sync({ force: true });
    const after = await prisma.financeWallet.findUniqueOrThrow({ where: { id: safe.id } });
    expect([after.type, after.safeOwners, after.safeThreshold]).toEqual([
      "contract",
      [OWNER_1, OWNER_2],
      2,
    ]);
    expect(
      (await prisma.financeWallet.findUniqueOrThrow({ where: { id: exchange.id } })).safeOwners,
    ).toBeNull();
  });

  it("never reads or writes another user's wallets", async () => {
    await addServer(otherUserId);
    const theirs = await addWallet(otherUserId, WALLET_A);
    fake = fakeRpc({
      prices: PRICES,
      chains: { 1: { balances: { [WALLET_A]: 5n } } },
    });
    const mine = await rows();
    await sync({ force: true, user: otherUserId, walletIds: [theirs.id] });
    expect(await rows(otherUserId)).toHaveLength(1);
    expect(await rows()).toEqual(mine);
    // Asking for the other user's wallet id as myself syncs nothing.
    const before = fake.calls.length;
    expect(await sync({ force: true, walletIds: [theirs.id] })).toMatchObject({
      outcome: "skipped",
    });
    expect(fake.calls).toHaveLength(before);
  });
});
