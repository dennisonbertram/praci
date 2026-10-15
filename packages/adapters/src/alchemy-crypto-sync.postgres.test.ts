import { randomUUID } from "node:crypto";
import type { SecretStore } from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  hasAlchemyKey,
  loadAlchemyKey,
  removeAlchemyKey,
  storeAlchemyKey,
} from "./alchemy-crypto-key.js";
import { fakeRpc, WALLET_A } from "./rpc-crypto-fake-fetch.js";
import { syncCryptoHoldings } from "./rpc-crypto-sync.js";

const KEY = "alch-secret-key";
const TOKEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// A secret store that "encrypts" by prefixing, so the tests can see that only ciphertext is stored.
const secrets = {
  put: async (plaintext: string) => ({ id: randomUUID(), ciphertext: `enc:${plaintext}` }),
  load: async (ciphertext: string) => ciphertext.replace(/^enc:/, ""),
  delete: async () => undefined,
} as unknown as SecretStore;

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("crypto sync with an Alchemy key (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `alc-org-${suffix}`;
  const spaceId = `alc-space-${suffix}`;
  const userId = `alc-user-${suffix}`;
  const otherUserId = `alc-other-${suffix}`;
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let alchemyCalls: string[] = [];
  let alchemyReply: () => Response = () => json({ data: { tokens: [] } });
  let rpc = fakeRpc();
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.host === "api.g.alchemy.com") {
      alchemyCalls.push(url.pathname.split("/")[3] ?? "");
      return alchemyReply();
    }
    return rpc.fetch(input, init);
  }) as typeof fetch;
  const sync = (user = userId) =>
    syncCryptoHoldings(
      { prisma, secrets, fetch: fetchFn, callGapMs: 0, retryDelayMs: 0 },
      { spaceId, userId: user },
      { force: true },
    );
  const rows = (owner = userId) =>
    prisma.financeCryptoHolding.findMany({
      where: { spaceId, userId: owner },
      orderBy: [{ chainId: "asc" }, { tokenAddress: "asc" }],
    });
  const stateOf = async (owner = userId) =>
    prisma.financeSyncState.findFirstOrThrow({ where: { spaceId, userId: owner } });
  const setup = async (owner: string) => {
    await prisma.mcpServer.create({
      data: {
        spaceId,
        userId: owner,
        slug: `bs-${randomUUID().slice(0, 6)}`,
        name: "Blockscout",
        transport: "streamable-http",
        endpoint: "https://mcp.blockscout.com/mcp",
      },
    });
    await prisma.financeWallet.create({
      data: { spaceId, userId: owner, address: WALLET_A, type: "personal" },
    });
  };
  const holding = (
    network: string,
    tokenAddress: string | null,
    balance: string,
    price?: string,
  ) => ({
    address: WALLET_A,
    network,
    tokenAddress,
    tokenBalance: balance,
    tokenMetadata: {
      decimals: 18,
      name: tokenAddress ? "Dollar" : "Ether",
      symbol: tokenAddress ? "USD" : "ETH",
    },
    tokenPrices: price ? [{ currency: "usd", value: price }] : [],
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
      data: {
        id: organizationId,
        name: "Alchemy Org",
        slug: organizationId,
        createdAt: new Date(),
      },
    });
    await prisma.space.create({
      data: { id: spaceId, organizationId, name: "General", isDefault: true },
    });
    await setup(userId);
    await setup(otherUserId);
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await close();
  });

  it("stores the key encrypted, per user, and removes it", async () => {
    await storeAlchemyKey(prisma, secrets, { spaceId, userId }, KEY);
    const [row, ...rest] = await prisma.secret.findMany({
      where: { spaceId, userId, kind: "finance-alchemy" },
    });
    expect(rest).toHaveLength(0);
    expect(row?.ciphertext).toBe(`enc:${KEY}`);
    expect(await loadAlchemyKey(prisma, secrets, { spaceId, userId })).toBe(KEY);
    // Replacing keeps one row; another user sees nothing.
    await storeAlchemyKey(prisma, secrets, { spaceId, userId }, "second");
    expect(await prisma.secret.count({ where: { spaceId, userId, kind: "finance-alchemy" } })).toBe(
      1,
    );
    expect(await hasAlchemyKey(prisma, { spaceId, userId: otherUserId })).toBe(false);
    expect(await loadAlchemyKey(prisma, secrets, { spaceId, userId: otherUserId })).toBeNull();
    await removeAlchemyKey(prisma, { spaceId, userId });
    expect(await hasAlchemyKey(prisma, { spaceId, userId })).toBe(false);
  });

  it("uses Alchemy for holdings, falls back to DefiLlama for unpriced tokens, and writes the snapshot", async () => {
    await storeAlchemyKey(prisma, secrets, { spaceId, userId }, KEY);
    alchemyCalls = [];
    alchemyReply = () =>
      json({
        data: {
          tokens: [
            holding("eth-mainnet", null, "0xde0b6b3a7640000", "2000"),
            holding("base-mainnet", TOKEN, "0xde0b6b3a7640000"),
            holding("eth-mainnet", "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "0x5"),
          ],
        },
      });
    rpc = fakeRpc({ prices: { [`base:${TOKEN}`]: { price: 3, confidence: 0.99 } } });
    expect(await sync()).toEqual({ ok: true, outcome: "synced", failedChains: [] });
    expect(alchemyCalls).toEqual([KEY]);
    // No chain was read over RPC for balances.
    expect(rpc.calls.filter((c) => c.endsWith("eth_getBalance"))).toEqual([]);
    expect(
      (await rows()).map((r) => [r.chainId, r.tokenAddress, r.usdPrice, r.usdValueCents]),
    ).toEqual([
      [1, "", "2000", 200000n],
      [1, "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", null, null],
      [8453, TOKEN, "3", 300n],
    ]);
    const snapshot = await prisma.financeCryptoSnapshot.findFirstOrThrow({
      where: { spaceId, userId },
    });
    expect((snapshot.stablecoinCents ?? 0n) + (snapshot.otherCryptoCents ?? 0n)).toBe(200300n);
    expect((await stateOf()).lastError).toBeNull();
  });

  it.each([
    [401, "Alchemy rejected the API key; using public RPC"],
    [429, "Alchemy rate limit reached; using public RPC"],
    [503, "Alchemy is unavailable; using public RPC"],
  ])("on HTTP %i it syncs from public RPC and records why", async (status, message) => {
    alchemyReply = () => json({}, status);
    rpc = fakeRpc({
      prices: { "coingecko:ethereum": { price: 1000, confidence: 0.99 } },
      chains: { 1: { balances: { [WALLET_A]: 1_000_000_000_000_000_000n } } },
    });
    expect(await sync()).toEqual({ ok: true, outcome: "synced", failedChains: [] });
    expect((await rows()).map((r) => [r.chainId, r.tokenAddress, r.usdValueCents])).toEqual([
      [1, "", 100000n],
    ]);
    expect((await stateOf()).lastError).toBe(message);
    const snapshot = await prisma.financeCryptoSnapshot.findFirstOrThrow({
      where: { spaceId, userId },
    });
    expect((snapshot.stablecoinCents ?? 0n) + (snapshot.otherCryptoCents ?? 0n)).toBe(100000n);
  });

  it("keeps a chain's old rows when Alchemy fails for that chain", async () => {
    alchemyReply = () =>
      json({
        data: { tokens: [holding("eth-mainnet", null, "0xde0b6b3a7640000", "2000")] },
        error: { partialErrors: [{ network: "base-mainnet", message: "boom" }] },
      });
    rpc = fakeRpc({
      prices: { "coingecko:ethereum": { price: 1000, confidence: 0.99 } },
      chains: { 8453: { balances: { [WALLET_A]: 1_000_000_000_000_000_000n } } },
    });
    // Seed Base through the RPC fallback first.
    alchemyReply = () => json({}, 503);
    await sync();
    alchemyReply = () =>
      json({
        data: { tokens: [holding("eth-mainnet", null, "0xde0b6b3a7640000", "2000")] },
        error: { partialErrors: [{ network: "base-mainnet", message: "boom" }] },
      });
    expect(await sync()).toEqual({ ok: true, outcome: "synced", failedChains: [8453] });
    const held = await rows();
    expect(held.map((r) => [r.chainId, r.usdValueCents])).toEqual([
      [1, 200000n],
      [8453, 100000n],
    ]);
  });

  it("does not use one user's key for another user, and never calls Alchemy without a key", async () => {
    alchemyCalls = [];
    alchemyReply = () => json({ data: { tokens: [holding("eth-mainnet", null, "0x1", "1")] } });
    rpc = fakeRpc({ chains: { 1: { balances: { [WALLET_A]: 5n } } }, prices: {} });
    await sync(otherUserId);
    expect(alchemyCalls).toEqual([]);
    expect((await rows(otherUserId)).map((r) => r.rawBalance)).toEqual(["5"]);
  });
});
