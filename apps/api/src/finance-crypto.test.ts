import type { Actor } from "@rakazo/contracts";
import { CRYPTO_API_KEY_HEADER, CRYPTO_MCP_ENDPOINT, CRYPTO_READ_TOOLS } from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";

// The secret writer's cleanup needs a real database; here the commit just runs.
vi.mock("@rakazo/adapters", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@rakazo/adapters")>()),
  persistPreparedSecret: async (_p: unknown, _s: unknown, _w: unknown, commit: () => unknown) =>
    commit(),
}));

import type { FinanceDeps } from "./finance.js";
import {
  financeCrypto,
  financeCryptoConnect,
  financeWalletAdd,
  financeWalletRemove,
  financeWallets,
  financeWalletUpdate,
} from "./finance-crypto.js";

const a: Actor = {
  userId: "user-a",
  spaceId: "space-1",
  email: "a@rakazo.test",
  isDeploymentOwner: false,
};
const b: Actor = { ...a, userId: "user-b", email: "b@rakazo.test" };
const ADDR = `0x${"ab".repeat(20)}`;
const ADDR2 = `0x${"cd".repeat(20)}`;
const KEY = "pro-key-123";

type Row = Record<string, unknown>;
const matches = (row: Row, where: Row = {}) =>
  Object.entries(where).every(([k, v]) => row[k] === v);

function table(rows: Row[], prefix: string) {
  return {
    rows,
    findMany: vi.fn(async ({ where }: { where?: Row } = {}) =>
      rows.filter((r) => matches(r, where)),
    ),
    findFirst: vi.fn(
      async ({ where }: { where?: Row } = {}) => rows.find((r) => matches(r, where)) ?? null,
    ),
    create: vi.fn(async ({ data }: { data: Row }) => {
      const row = {
        id: `${prefix}-${rows.length + 1}`,
        createdAt: new Date(),
        headers: {},
        ...data,
      };
      rows.push(row);
      return row;
    }),
    update: vi.fn(async ({ where, data }: { where: Row; data: Row }) => {
      const row = rows.find((r) => matches(r, where)) as Row;
      const { revision: _r, ...rest } = data;
      return Object.assign(row, rest);
    }),
    updateMany: vi.fn(async ({ where, data }: { where: Row; data: Row }) => {
      const found = rows.filter((r) => matches(r, where));
      for (const r of found) Object.assign(r, data);
      return { count: found.length };
    }),
    deleteMany: vi.fn(async ({ where }: { where: Row }) => {
      const found = rows.filter((r) => matches(r, where));
      for (const r of found) rows.splice(rows.indexOf(r), 1);
      return { count: found.length };
    }),
    upsert: vi.fn(async () => ({})),
  };
}

function setup(
  data: { wallets?: Row[]; holdings?: Row[]; servers?: Row[]; bots?: Row[]; states?: Row[] } = {},
) {
  const prisma = {
    financeWallet: table(data.wallets ?? [], "w"),
    financeCryptoHolding: table(data.holdings ?? [], "h"),
    mcpServer: table(data.servers ?? [], "srv"),
    bot: table(data.bots ?? [], "bot"),
    botMcpServer: table([], "bms"),
    financeSyncState: table(data.states ?? [], "st"),
    secret: table([], "sec"),
    $transaction: async (fn: (tx: unknown) => unknown) => fn(prisma),
  };
  const sync = vi.fn(async () => ({
    ok: true as const,
    outcome: "synced" as const,
    failedChains: [],
  }));
  const resolveEns = vi.fn(async (): Promise<string | null> => ADDR2);
  const put = vi.fn(async () => ({ id: "sec-new", ciphertext: "ct" }));
  const deps = { prisma, secrets: { put }, crypto: { sync, resolveEns } } as unknown as FinanceDeps;
  return { prisma, deps, sync, resolveEns, put };
}

const wallet = (actor: Actor, over: Row = {}): Row => ({
  id: "w-x",
  spaceId: actor.spaceId,
  userId: actor.userId,
  address: ADDR,
  ensName: null,
  label: null,
  type: "personal",
  safeOwners: null,
  safeThreshold: null,
  createdAt: new Date(),
  ...over,
});

describe("wallets", () => {
  it("lists only the actor's wallets", async () => {
    const { deps } = setup({ wallets: [wallet(a, { id: "w-a" }), wallet(b, { id: "w-b" })] });
    expect((await financeWallets(deps, a)).map((w) => w.id)).toEqual(["w-a"]);
  });

  it("adds an address (lowercased), stores it, and force-syncs just that wallet", async () => {
    const { deps, sync, prisma } = setup();
    const out = await financeWalletAdd(deps, a, {
      addressOrEns: ADDR.toUpperCase().replace("0X", "0x"),
      type: "personal",
    });
    expect(out).toMatchObject({ address: ADDR, ensName: null, label: null });
    expect(prisma.financeWallet.create.mock.calls[0]?.[0].data).toMatchObject({
      spaceId: "space-1",
      userId: "user-a",
    });
    expect(sync).toHaveBeenCalledWith(
      { spaceId: "space-1", userId: "user-a" },
      expect.objectContaining({ walletIds: [out.id], force: true }),
    );
  });

  it("connects Blockscout on the first wallet so the Finance agent gets its crypto tool", async () => {
    const { deps, prisma } = setup();
    await financeWalletAdd(deps, a, { addressOrEns: ADDR, type: "personal" });
    await financeWalletAdd(deps, a, { addressOrEns: ADDR2, type: "safe" });
    expect(prisma.mcpServer.rows).toHaveLength(1);
    expect(prisma.mcpServer.rows[0]).toMatchObject({
      endpoint: CRYPTO_MCP_ENDPOINT,
      userId: "user-a",
    });
  });

  it("resolves an ENS name and keeps the name", async () => {
    const { deps, resolveEns } = setup();
    const out = await financeWalletAdd(deps, a, {
      addressOrEns: "Vitalik.eth",
      type: "personal",
      label: "Main",
    });
    expect(resolveEns).toHaveBeenCalledWith(
      { spaceId: "space-1", userId: "user-a" },
      "vitalik.eth",
      undefined,
    );
    expect(out).toMatchObject({ address: ADDR2, ensName: "vitalik.eth", label: "Main" });
  });

  it("rejects invalid input and unknown names with BAD_REQUEST", async () => {
    const { deps, resolveEns } = setup();
    await expect(
      financeWalletAdd(deps, a, { addressOrEns: "nope", type: "personal" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    resolveEns.mockResolvedValueOnce(null);
    await expect(
      financeWalletAdd(deps, a, { addressOrEns: "ghost.eth", type: "personal" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects a duplicate address with CONFLICT, but allows another user to add it", async () => {
    const { deps } = setup({ wallets: [wallet(a)] });
    await expect(
      financeWalletAdd(deps, a, { addressOrEns: ADDR, type: "personal" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      financeWalletAdd(deps, b, { addressOrEns: ADDR, type: "personal" }),
    ).resolves.toMatchObject({ address: ADDR });
  });

  it("still adds the wallet when the sync fails", async () => {
    const { deps, sync } = setup();
    sync.mockRejectedValueOnce(new Error("boom"));
    await expect(
      financeWalletAdd(deps, a, { addressOrEns: ADDR, type: "personal" }),
    ).resolves.toMatchObject({ address: ADDR });
  });

  it("updates and removes only the actor's own wallet", async () => {
    const { deps, prisma } = setup({
      wallets: [wallet(a, { id: "w-a" }), wallet(b, { id: "w-b", address: ADDR2 })],
    });
    await expect(financeWalletUpdate(deps, b, { id: "w-a", label: "x" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(financeWalletRemove(deps, b, { id: "w-a" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(prisma.financeWallet.rows.map((r) => r.id)).toEqual(["w-a", "w-b"]);

    await expect(
      financeWalletUpdate(deps, a, { id: "w-a", label: "Cold", type: "safe" }),
    ).resolves.toMatchObject({ label: "Cold", type: "safe" });
    await expect(financeWalletRemove(deps, a, { id: "w-a" })).resolves.toEqual({ ok: true });
    expect(prisma.financeWallet.rows.map((r) => r.id)).toEqual(["w-b"]);
  });
});

describe("finance.crypto", () => {
  const holding = (actor: Actor, over: Row = {}): Row => ({
    spaceId: actor.spaceId,
    userId: actor.userId,
    walletId: "w-a",
    chainId: 1,
    tokenAddress: "",
    symbol: "ETH",
    name: "Ether",
    decimals: 18,
    rawBalance: "1000000000000000000",
    usdPrice: "2000",
    usdValueCents: 200_000n,
    syncedAt: new Date("2026-10-14T00:00:00Z"),
    ...over,
  });

  it("maps native to null and BigInt to number, scoped to the actor, with a summary", async () => {
    const { deps } = setup({
      wallets: [wallet(a, { id: "w-a" })],
      holdings: [holding(a), holding(b, { symbol: "SECRET" })],
      servers: [
        {
          id: "srv-1",
          spaceId: "space-1",
          userId: "user-a",
          enabled: true,
          endpoint: CRYPTO_MCP_ENDPOINT,
          headers: { [CRYPTO_API_KEY_HEADER]: true },
        },
      ],
      states: [
        { mcpServerId: "srv-1", spaceId: "space-1", userId: "user-a", lastError: "rate limited" },
      ],
    });
    const out = await financeCrypto(deps, a);
    expect(out.holdings).toEqual([
      expect.objectContaining({ symbol: "ETH", tokenAddress: null, usdValueCents: 200_000 }),
    ]);
    expect(out).toMatchObject({
      connected: true,
      hasApiKey: true,
      lastError: "rate limited",
      summary: { totalCents: 200_000 },
    });
    expect(JSON.stringify(out)).not.toContain("SECRET");
  });

  it("reports not connected without a server", async () => {
    const { deps } = setup();
    expect(await financeCrypto(deps, a)).toMatchObject({
      connected: false,
      hasApiKey: false,
      lastError: null,
    });
  });
});

describe("finance.cryptoConnect", () => {
  it("creates one keyless Blockscout server, idempotently", async () => {
    const { deps, prisma, put, sync } = setup();
    const first = await financeCryptoConnect(deps, a, {});
    expect(sync).not.toHaveBeenCalled();
    const second = await financeCryptoConnect(deps, a, {});
    expect(second).toEqual(first);
    expect(first.hasApiKey).toBe(false);
    expect(prisma.mcpServer.rows).toHaveLength(1);
    expect(prisma.mcpServer.rows[0]).toMatchObject({
      endpoint: CRYPTO_MCP_ENDPOINT,
      enabled: true,
      userId: "user-a",
    });
    expect(put).not.toHaveBeenCalled();
  });

  it("stores the key as an encrypted header secret and never returns it", async () => {
    const { deps, prisma, put, sync } = setup();
    const out = await financeCryptoConnect(deps, a, { apiKey: KEY });
    expect(out.hasApiKey).toBe(true);
    expect(sync).toHaveBeenCalledWith(expect.anything(), { force: true });
    expect(JSON.stringify(out)).not.toContain(KEY);
    expect(JSON.parse(put.mock.calls[0]?.[0] as string).headers).toEqual({
      [CRYPTO_API_KEY_HEADER]: KEY,
    });
    // The server row keeps only the header name.
    expect(prisma.mcpServer.rows[0]).toMatchObject({
      secretId: "sec-new",
      headers: { [CRYPTO_API_KEY_HEADER]: true },
    });
    expect(JSON.stringify(prisma.mcpServer.rows)).not.toContain(KEY);
    expect(prisma.secret.rows).toHaveLength(1);
    // Connecting again without a key keeps the stored one.
    expect((await financeCryptoConnect(deps, a, {})).hasApiKey).toBe(true);
  });

  it("replaces a stored key and removes the old secret", async () => {
    const { deps, prisma, put } = setup({
      servers: [
        {
          id: "srv-1",
          spaceId: "space-1",
          userId: "user-a",
          enabled: true,
          endpoint: CRYPTO_MCP_ENDPOINT,
          secretId: "sec-old",
          headers: { [CRYPTO_API_KEY_HEADER]: true },
          createdAt: new Date(),
        },
      ],
    });
    put.mockResolvedValueOnce({ id: "sec-2", ciphertext: "ct2" });
    await financeCryptoConnect(deps, a, { apiKey: "other-key" });
    expect(prisma.mcpServer.rows).toHaveLength(1);
    expect(prisma.mcpServer.rows[0]?.secretId).toBe("sec-2");
    expect(prisma.secret.deleteMany).toHaveBeenCalledWith({
      where: { id: "sec-old", spaceId: "space-1", userId: "user-a" },
    });
  });

  it("gives an existing Finance agent the server with only the crypto read tools", async () => {
    const { deps, prisma } = setup({
      bots: [
        {
          id: "bot-1",
          spaceId: "space-1",
          userId: "user-a",
          spawnKey: "finance-agent:user-a",
          archivedAt: null,
        },
      ],
    });
    const { financeAgentSpawnKey } = await import("@rakazo/contracts");
    prisma.bot.rows[0]!.spawnKey = financeAgentSpawnKey("user-a");
    const out = await financeCryptoConnect(deps, a, {});
    expect(prisma.botMcpServer.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          botId: "bot-1",
          serverId: out.serverId,
          allowAllTools: false,
          allowedTools: [...CRYPTO_READ_TOOLS],
        }),
      }),
    );
  });
});
