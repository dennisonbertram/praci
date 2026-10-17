import type { Actor } from "@rakazo/contracts";
import { FINANCE_MCP_ENDPOINTS, financeAgentSpawnKey } from "@rakazo/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notFound } from "./inbox.js";

// The calculations are tested in @rakazo/core. Here they are stand-ins that record what they were
// given, so these tests are about what the handlers load, scope and pass on.
const metrics = vi.hoisted(() => ({
  balanceHistory: vi.fn(() => []),
  breakdown: vi.fn((): unknown[] => []),
  cashSummary: vi.fn(() => ({
    cashCents: 0,
    checkingCents: 0,
    savingsCents: 0,
    treasuryCents: 0,
    cardOwedCents: null,
  })),
  detectRecurring: vi.fn(() => []),
  monthlyBurn: vi.fn(() => ({ monthlyCents: 0, months: [] })),
  cashSeries: vi.fn(() => []),
  monthlySeries: vi.fn(() => []),
  monthlySpend: vi.fn(() => []),
  projectCash: vi.fn(() => []),
  runway: vi.fn(() => ({ months: null, runOutDate: null })),
  spendTotals: vi.fn((_t: unknown, period: string) => ({
    period,
    currentCents: 0,
    previousCents: 0,
    changePct: null,
    start: "2026-10-01",
    end: "2026-10-15",
    previousStart: "2026-09-01",
    previousEnd: "2026-10-01",
  })),
  subscriptions: vi.fn(() => ({ items: [], totalMonthlyCents: 0 })),
  upcoming: vi.fn(() => ({ items: [], totalCents: 0 })),
}));
vi.mock("@rakazo/core", async (importOriginal) => {
  const original = await importOriginal<typeof import("@rakazo/core")>();
  // cashSummary stays real so stablecoin cash is tested end to end; the others are stand-ins.
  metrics.cashSummary.mockImplementation(((...args: Parameters<typeof original.cashSummary>) =>
    original.cashSummary(...args)) as never);
  return { ...original, ...metrics };
});

const adapters = vi.hoisted(() => ({
  syncFinanceForUser: vi.fn(async () => ({})),
  receiptUrl: vi.fn(async (): Promise<unknown> => null),
}));
vi.mock("@rakazo/adapters", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@rakazo/adapters")>()),
  syncFinanceForUser: adapters.syncFinanceForUser,
  createMercuryFinanceSource: () => ({ receiptUrl: adapters.receiptUrl }),
  createBrexFinanceSource: () => ({ receiptUrl: adapters.receiptUrl }),
}));

import {
  type FinanceDeps,
  financeAccountDetail,
  financeAccounts,
  financeBalanceSeries,
  financeBurn,
  financeCategory,
  financeConnect,
  financeCryptoHistory,
  financeMonth,
  financeOverview,
  financePreferences,
  financeReceiptUrl,
  financeRecurring,
  financeRefresh,
  financeRunway,
  financeSetPreferences,
  financeSpend,
  financeTransaction,
  financeVendor,
} from "./finance.js";

const NOW = new Date("2026-10-14T12:00:00Z");
const a: Actor = {
  userId: "user-a",
  spaceId: "space-1",
  email: "a@rakazo.test",
  isDeploymentOwner: false,
};
const b: Actor = {
  userId: "user-b",
  spaceId: "space-1",
  email: "b@rakazo.test",
  isDeploymentOwner: false,
};

type Row = Record<string, unknown>;

/** A table that applies the equality filters of a `where`, so a row of another user is never returned. */
function table(rows: Row[]) {
  const matches = (row: Row, where: Row = {}) =>
    Object.entries(where).every(([key, value]) => row[key] === value);
  return {
    rows,
    findMany: vi.fn(async ({ where }: { where?: Row } = {}) =>
      rows.filter((r) => matches(r, where)),
    ),
    findFirst: vi.fn(
      async ({ where }: { where?: Row } = {}) => rows.find((r) => matches(r, where)) ?? null,
    ),
    create: vi.fn(async ({ data }: { data: Row }) => {
      const row = { id: `srv-${rows.length + 1}`, createdAt: new Date(), ...data };
      rows.push(row);
      return row;
    }),
    upsert: vi.fn(async ({ where, create, update }: { where: Row; create: Row; update: Row }) => {
      // A compound key such as { spaceId_userId: {...} } is flattened to its fields.
      const flat = Object.assign(
        {},
        ...Object.values(where).map((v) => (v && typeof v === "object" ? v : {})),
      );
      const row = rows.find((r) => matches(r, flat));
      if (row) return Object.assign(row, update);
      const made = { id: `row-${rows.length + 1}`, ...create };
      rows.push(made);
      return made;
    }),
    update: vi.fn(async ({ where, data }: { where: Row; data: Row }) => {
      const row = rows.find((r) => matches(r, where));
      const { revision: _revision, ...rest } = data;
      return Object.assign(row ?? {}, rest);
    }),
  };
}

const scope = (actor: Actor) => ({ spaceId: actor.spaceId, userId: actor.userId });
const account = (actor: Actor, over: Row = {}): Row => ({
  id: "acc-1",
  ...scope(actor),
  mcpServerId: "srv-1",
  provider: "mercury",
  externalId: "ext-acc",
  name: "Checking",
  lastFour: "1111",
  kind: "checking",
  balanceCents: 5_000n,
  currency: "USD",
  ...over,
});
const txn = (actor: Actor, over: Row = {}): Row => ({
  id: "t-1",
  ...scope(actor),
  mcpServerId: "srv-1",
  provider: "mercury",
  externalId: "ext-t",
  accountExternalId: "ext-acc",
  postedAt: new Date("2026-10-02T00:00:00Z"),
  purchasedAt: null,
  amountCents: -1_200n,
  currency: "USD",
  counterparty: "Acme Inc.",
  vendorKey: "acme",
  category: "Software",
  status: "posted",
  kind: "other",
  classification: "spend",
  cardLastFour: null,
  cardholder: null,
  memo: null,
  hasReceipt: false,
  dashboardUrl: null,
  ...over,
});
const server = (actor: Actor, over: Row = {}): Row => ({
  id: "srv-1",
  ...scope(actor),
  enabled: true,
  endpoint: FINANCE_MCP_ENDPOINTS.mercury,
  secretId: "sec-1",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  ...over,
});

function setup(
  data: Partial<
    Record<
      | "mcpServer"
      | "financeAccount"
      | "financeTransaction"
      | "financeBill"
      | "financeTreasuryYield"
      | "financeSyncState"
      | "bot"
      | "botMcpServer"
      | "financeWallet"
      | "financeCryptoHolding"
      | "financePreference"
      | "financeCryptoSnapshot"
      | "financeExchangeConnection"
      | "financeExchangeBalance"
      | "financeExchangeSnapshot",
      Row[]
    >
  > = {},
  login: "none" | "connected" | "reconnect" = "connected",
) {
  const t = (name: keyof typeof data) => table(data[name] ?? []);
  const prisma = {
    mcpServer: t("mcpServer"),
    financeAccount: t("financeAccount"),
    financeTransaction: t("financeTransaction"),
    financeBill: t("financeBill"),
    financeTreasuryYield: t("financeTreasuryYield"),
    financeSyncState: t("financeSyncState"),
    bot: t("bot"),
    botMcpServer: t("botMcpServer"),
    financeWallet: t("financeWallet"),
    financeCryptoHolding: t("financeCryptoHolding"),
    financePreference: t("financePreference"),
    financeCryptoSnapshot: t("financeCryptoSnapshot"),
    financeExchangeConnection: t("financeExchangeConnection"),
    financeExchangeBalance: t("financeExchangeBalance"),
    financeExchangeSnapshot: t("financeExchangeSnapshot"),
  };
  const enqueue = vi.fn(async () => undefined);
  const beginMcpOAuth = vi.fn(async (input: { serverId: string }) => ({
    status: "authorization_required" as const,
    sessionId: "session-1",
    authorizationUrl: `https://auth.example.com/authorize?server=${input.serverId}`,
  }));
  const statusFor = vi.fn(async () => login);
  const callToolFor = vi.fn(async () => vi.fn(async () => ({})));
  const deps = {
    prisma,
    jobs: { enqueue },
    repos: { createBot: vi.fn() },
    mcpOAuth: { statusFor },
    beginMcpOAuth,
    callToolFor,
    now: () => NOW,
  } as unknown as FinanceDeps;
  return { prisma, deps, enqueue, beginMcpOAuth, statusFor, callToolFor };
}

beforeEach(() => vi.clearAllMocks());

describe("finance overview crypto", () => {
  const wallet = (actor: Actor) => ({
    id: "w-1",
    ...scope(actor),
    address: `0x${"ab".repeat(20)}`,
    type: "personal",
    createdAt: new Date(),
  });
  const holding = (actor: Actor) => ({
    ...scope(actor),
    walletId: "w-1",
    chainId: 1,
    tokenAddress: "",
    symbol: "ETH",
    name: "Ether",
    decimals: 18,
    rawBalance: "1",
    usdPrice: "1",
    usdValueCents: 12_345n,
    syncedAt: new Date("2026-10-14T00:00:00Z"),
  });

  it("is null without a wallet, even when another user has one", async () => {
    const { deps } = setup({ financeWallet: [wallet(b)], financeCryptoHolding: [holding(b)] });
    expect((await financeOverview(deps, a)).crypto).toBeNull();
  });

  it("is the summary of the actor's holdings, and never touches cash, burn or runway", async () => {
    const { deps } = setup({
      financeWallet: [wallet(a), wallet(b)],
      financeCryptoHolding: [holding(a), { ...holding(b), usdValueCents: 999_999n }],
    });
    const overview = await financeOverview(deps, a);
    expect(overview.crypto).toMatchObject({
      totalCents: 12_345,
      byChain: [{ chainId: 1, cents: 12_345 }],
    });
    expect(overview.cash.cashCents).toBe(0);
    expect(overview.burn.monthlyCents).toBe(0);
  });
});

describe("finance overview stablecoins as cash", () => {
  const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
  const wallet = {
    id: "w-1",
    ...scope(a),
    address: `0x${"ab".repeat(20)}`,
    type: "personal",
    createdAt: new Date(),
  };
  const holding = (over: Record<string, unknown>) => ({
    ...scope(a),
    walletId: "w-1",
    chainId: 1,
    tokenAddress: "",
    symbol: "ETH",
    name: "Ether",
    decimals: 6,
    rawBalance: "1",
    usdPrice: "1",
    usdValueCents: 0n,
    syncedAt: new Date("2026-10-14T00:00:00Z"),
    ...over,
  });
  const bank = account(a, { id: "acc-a", kind: "checking", balanceCents: 100_000 });
  const run = async (holdings: unknown[]) => {
    const { deps } = setup({
      financeAccount: [bank],
      financeWallet: [wallet],
      financeCryptoHolding: holdings,
      financePreference: [{ ...scope(a), runwayCrypto: "stablecoins" }],
    });
    metrics.runway.mockClear();
    const overview = await financeOverview(deps, a);
    const cashInputs = metrics.runway.mock.calls.map((call) => (call as unknown as number[])[0]);
    return { overview, cashInputs };
  };

  it("adds a canonical USDC holding to cash and to runway, and keeps bank-only figures", async () => {
    const { overview, cashInputs } = await run([
      holding({ symbol: "USDC", tokenAddress: USDC, usdValueCents: 25_000n }),
      holding({ symbol: "ETH", usdValueCents: 40_000n }),
    ]);
    expect(overview.cash).toMatchObject({
      cashCents: 125_000,
      bankCashCents: 100_000,
      stablecoinCents: 25_000,
      // ETH is held but not counted under the default scope; the crypto card still shows it.
      otherCryptoCents: 0,
    });
    expect(overview.crypto?.totalCents).toBe(65_000);
    // Runway sees stablecoins but not ETH; the bank-only runway sees neither.
    expect(cashInputs).toEqual([125_000, 100_000]);
  });

  it("does not count a fake USDC at another address, an unpriced stablecoin, or ETH", async () => {
    const { overview, cashInputs } = await run([
      holding({ symbol: "USDC", tokenAddress: `0x${"1".repeat(40)}`, usdValueCents: 9_000n }),
      holding({
        symbol: "USDC",
        tokenAddress: USDC,
        usdPrice: null,
        usdValueCents: null,
        rawBalance: "5",
      }),
      holding({ symbol: "ETH", usdValueCents: 7_000n }),
    ]);
    expect(overview.cash.cashCents).toBe(100_000);
    expect(overview.cash.stablecoinCents).toBe(0);
    expect(cashInputs).toEqual([100_000, 100_000]);
  });
});

describe("finance overview", () => {
  it("passes the calculations only the actor's own rows", async () => {
    const { deps } = setup({
      financeTransaction: [txn(a, { id: "t-a" }), txn(b, { id: "t-b" })],
      financeAccount: [account(a, { id: "acc-a" }), account(b, { id: "acc-b" })],
    });

    await financeOverview(deps, a);

    const ids = (metrics.monthlyBurn.mock.calls[0] as unknown as [{ id: string }[]])[0].map(
      (t) => t.id,
    );
    expect(ids).toEqual(["t-a"]);
    const accounts = (metrics.cashSummary.mock.calls[0] as unknown as [{ id: string }[]])[0];
    expect(accounts.map((x) => x.id)).toEqual(["acc-a"]);
  });

  it("reports no runway when only card accounts exist (Brex only), and one when cash exists", async () => {
    const brexOnly = setup({
      financeAccount: [account(a, { id: "acc-card", provider: "brex", kind: "card" })],
    });
    metrics.runway.mockClear();
    const brexOverview = await financeOverview(brexOnly.deps, a);
    expect(brexOverview.runway).toEqual({ months: null, runOutDate: null });
    expect(brexOverview.hasCashAccounts).toBe(false);
    expect(metrics.runway).not.toHaveBeenCalled();

    const withCash = setup({ financeAccount: [account(a)] });
    expect((await financeOverview(withCash.deps, a)).hasCashAccounts).toBe(true);
    expect(metrics.runway).toHaveBeenCalledTimes(2);
  });

  it("shows the empty state when nothing is connected, and starts no sync", async () => {
    const { deps, enqueue } = setup();

    const overview = await financeOverview(deps, a);

    expect(overview.sources).toEqual([
      { provider: "mercury", serverId: null, status: "not_connected", lastSyncedAt: null },
      { provider: "brex", serverId: null, status: "not_connected", lastSyncedAt: null },
    ]);
    expect(overview.agent).toBeNull();
    expect(overview.lastSyncedAt).toBeNull();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("enqueues a background sync when a connected source is stale or never synced, not when fresh", async () => {
    const stale = setup({
      mcpServer: [server(a)],
      financeSyncState: [
        { mcpServerId: "srv-1", ...scope(a), lastSyncedAt: new Date(NOW.getTime() - 20 * 60_000) },
      ],
    });
    const overview = await financeOverview(stale.deps, a);
    expect(stale.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "finance.sync",
        payload: { userId: "user-a", spaceId: "space-1" },
      }),
    );
    expect(overview.sources[0]).toMatchObject({ status: "ok", serverId: "srv-1" });
    expect(overview.lastSyncedAt).toBe("2026-10-14T11:40:00.000Z");

    const never = setup({ mcpServer: [server(a)] });
    expect((await financeOverview(never.deps, a)).lastSyncedAt).toBeNull();
    expect(never.enqueue).toHaveBeenCalledTimes(1);

    const fresh = setup({
      mcpServer: [server(a)],
      financeSyncState: [
        { mcpServerId: "srv-1", ...scope(a), lastSyncedAt: new Date(NOW.getTime() - 60_000) },
      ],
    });
    await financeOverview(fresh.deps, a);
    expect(fresh.enqueue).not.toHaveBeenCalled();
  });

  it("reports a lost login and a failed sync without syncing again straight away", async () => {
    const lost = setup({ mcpServer: [server(a)] }, "reconnect");
    expect((await financeOverview(lost.deps, a)).sources[0]?.status).toBe("needs_reconnect");
    expect(lost.enqueue).not.toHaveBeenCalled();

    const failed = setup({
      mcpServer: [server(a)],
      financeSyncState: [
        {
          mcpServerId: "srv-1",
          ...scope(a),
          lastSyncedAt: new Date(NOW.getTime() - 3_600_000),
          lastErrorAt: new Date(NOW.getTime() - 60_000),
          lastError: "x",
        },
      ],
    });
    expect((await financeOverview(failed.deps, a)).sources[0]?.status).toBe("error");
    expect(failed.enqueue).not.toHaveBeenCalled();
  });

  it("does not show another user's server or sync state", async () => {
    const { deps } = setup({
      mcpServer: [server(b)],
      financeSyncState: [{ mcpServerId: "srv-1", ...scope(b), lastSyncedAt: NOW }],
    });
    const overview = await financeOverview(deps, a);
    expect(overview.sources.every((s) => s.status === "not_connected")).toBe(true);
  });
});

describe("finance detail lookups", () => {
  it("answer NOT_FOUND for another user's account, transaction and receipt", async () => {
    const { deps } = setup({
      financeAccount: [account(b)],
      financeTransaction: [txn(b, { hasReceipt: true })],
      mcpServer: [server(b)],
    });
    await expect(financeAccountDetail(deps, a, { id: "acc-1" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(financeTransaction(deps, a, { id: "t-1" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(financeReceiptUrl(deps, a, { transactionId: "t-1" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(adapters.receiptUrl).not.toHaveBeenCalled();
  });

  it("answer NOT_FOUND for a vendor, recurring charge, category or month the user has no data for", async () => {
    const { deps } = setup({ financeTransaction: [txn(b)] });
    await expect(financeVendor(deps, a, { key: "acme" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(financeRecurring(deps, a, { key: "acme" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(financeCategory(deps, a, { slug: "software" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(financeMonth(deps, a, { month: "2026-10" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("returns the user's own transaction with its account", async () => {
    const { deps } = setup({ financeAccount: [account(a)], financeTransaction: [txn(a)] });
    const out = await financeTransaction(deps, a, { id: "t-1" });
    expect(out.transaction).toMatchObject({
      id: "t-1",
      amountCents: -1200,
      postedAt: "2026-10-02T00:00:00.000Z",
    });
    expect(out.account).toMatchObject({ id: "acc-1", balanceCents: 5000 });
    expect(out.vendorName).toBe("Acme Inc.");
    expect(out.vendorIsSubscription).toBe(false);
  });

  it("builds a category page from its own spend only", async () => {
    const { deps } = setup({
      financeTransaction: [
        txn(a, { id: "t-1" }),
        txn(a, { id: "t-2", category: "Travel", vendorKey: "air" }),
        txn(a, { id: "t-3", classification: "internal_transfer" }),
      ],
    });
    const out = await financeCategory(deps, a, { slug: "software" });
    expect(out.label).toBe("Software");
    expect(out.recent.map((r) => r.id)).toEqual(["t-1"]);
    const given = (metrics.breakdown.mock.calls[0] as unknown as [{ id: string }[]])[0];
    expect(given.map((r) => r.id)).toEqual(["t-1"]);
  });

  it("lists only spend of the chosen category for the period", async () => {
    const { deps } = setup({
      financeTransaction: [
        txn(a, { id: "t-1" }),
        txn(a, { id: "t-2", category: "Travel" }),
        txn(a, { id: "t-3", classification: "revenue", amountCents: 900n }),
        txn(a, { id: "t-4", postedAt: new Date("2026-09-20T00:00:00Z") }),
      ],
    });
    const out = await financeSpend(deps, a, { period: "month", category: "software" });
    expect(out.transactions.map((r) => r.id)).toEqual(["t-1"]);
  });

  it("counts and lists only the chosen source's spend", async () => {
    const { deps } = setup({
      financeTransaction: [
        txn(a, { id: "t-1" }),
        txn(a, { id: "t-2", provider: "brex", accountExternalId: "brex-card" }),
      ],
    });
    metrics.breakdown.mockClear();
    const out = await financeSpend(deps, a, { period: "month", source: "brex" });
    expect(out.transactions.map((r) => r.id)).toEqual(["t-2"]);
    // The total and the category chips are worked out from the same Brex-only list.
    const given = (metrics.breakdown.mock.calls[0] as unknown as [{ id: string }[]])[0];
    expect(given.map((r) => r.id)).toEqual(["t-2"]);
  });
});

describe("finance connect", () => {
  const input = {
    provider: "mercury" as const,
    redirectUri: "https://app.example.com/mcp/oauth/callback",
  };

  it("creates the provider's server once and starts OAuth on it", async () => {
    const { deps, prisma, beginMcpOAuth } = setup();

    const first = await financeConnect(deps, a, input);
    const second = await financeConnect(deps, a, input);

    expect(prisma.mcpServer.rows).toHaveLength(1);
    expect(prisma.mcpServer.rows[0]).toMatchObject({
      ...scope(a),
      endpoint: FINANCE_MCP_ENDPOINTS.mercury,
      transport: "streamable_http",
      enabled: true,
    });
    expect(first).toMatchObject({
      status: "authorization_required",
      serverId: "srv-1",
      sessionId: "session-1",
    });
    expect(second.serverId).toBe("srv-1");
    expect(beginMcpOAuth).toHaveBeenCalledWith({
      serverId: "srv-1",
      ...scope(a),
      redirectUri: input.redirectUri,
    });
  });

  it("reuses a disabled server and turns it back on instead of creating a second one", async () => {
    const { deps, prisma } = setup({ mcpServer: [server(a, { enabled: false })] });
    const out = await financeConnect(deps, a, input);
    expect(out.serverId).toBe("srv-1");
    expect(prisma.mcpServer.rows).toHaveLength(1);
    expect(prisma.mcpServer.rows[0]).toMatchObject({ enabled: true });
  });

  it("asks for a new sign-in when the source needs a reconnect or the client says so", async () => {
    const reauthorized = (beginMcpOAuth: { mock: { calls: unknown[][] } }) =>
      (beginMcpOAuth.mock.calls.at(-1)?.[0] as { reauthorize?: boolean } | undefined)?.reauthorize;

    const fresh = setup({ mcpServer: [server(a)] });
    await financeConnect(fresh.deps, a, input);
    expect(reauthorized(fresh.beginMcpOAuth)).toBeUndefined();

    const flagged = setup({
      mcpServer: [server(a)],
      financeSyncState: [{ mcpServerId: "srv-1", ...scope(a), needsReconnect: true }],
    });
    await financeConnect(flagged.deps, a, input);
    expect(reauthorized(flagged.beginMcpOAuth)).toBe(true);

    const refused = setup({ mcpServer: [server(a)] }, "reconnect");
    await financeConnect(refused.deps, a, input);
    expect(reauthorized(refused.beginMcpOAuth)).toBe(true);

    const asked = setup({ mcpServer: [server(a)] });
    await financeConnect(asked.deps, a, { ...input, reconnect: true });
    expect(reauthorized(asked.beginMcpOAuth)).toBe(true);
  });

  it("does not reuse another user's server", async () => {
    const { deps, prisma } = setup({ mcpServer: [server(b)] });
    const out = await financeConnect(deps, a, input);
    expect(out.serverId).not.toBe("srv-1");
    expect(prisma.mcpServer.rows).toHaveLength(2);
  });

  it("turns a failed sign-in start into BAD_REQUEST with plain copy, not the vendor's error", async () => {
    const { deps, beginMcpOAuth } = setup();
    beginMcpOAuth.mockRejectedValueOnce(
      new Error("Could not reach mcp.mercury.com: emulator received unexpected URL"),
    );
    await expect(financeConnect(deps, a, input)).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Could not connect to Mercury. Try again, or upload a statement instead.",
    });
  });

  it("gives an existing Finance agent the new server, read tools only", async () => {
    const { deps, prisma } = setup({
      bot: [
        { id: "bot-1", ...scope(a), spawnKey: financeAgentSpawnKey("user-a"), archivedAt: null },
      ],
    });
    await financeConnect(deps, a, input);
    expect(prisma.botMcpServer.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          botId: "bot-1",
          serverId: "srv-1",
          allowAllTools: false,
        }),
      }),
    );
  });
});

describe("finance refresh and receipts", () => {
  it("forces a sync for the actor's own space and user", async () => {
    const { deps, callToolFor } = setup();
    const controller = new AbortController();

    await expect(financeRefresh(deps, a, controller.signal)).resolves.toEqual({ ok: true });

    expect(adapters.syncFinanceForUser).toHaveBeenCalledWith(
      expect.objectContaining({ callToolFor }),
      { spaceId: "space-1", userId: "user-a" },
      { force: true, signal: controller.signal },
    );
  });

  it("says so when sync is not wired", async () => {
    const { deps } = setup();
    await expect(financeRefresh({ ...deps, callToolFor: undefined }, a)).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
    });
  });

  it("fetches a fresh link through the transaction's own server", async () => {
    adapters.receiptUrl.mockResolvedValueOnce({
      url: "https://files.example.com/r.pdf",
      mimeType: "application/pdf",
    });
    const { deps, callToolFor } = setup({
      mcpServer: [server(a)],
      financeTransaction: [txn(a, { hasReceipt: true })],
    });

    await expect(financeReceiptUrl(deps, a, { transactionId: "t-1" })).resolves.toEqual({
      url: "https://files.example.com/r.pdf",
      mimeType: "application/pdf",
    });

    expect(callToolFor).toHaveBeenCalledWith(
      { id: "srv-1", provider: "mercury", endpoint: FINANCE_MCP_ENDPOINTS.mercury },
      expect.any(AbortSignal),
    );
    expect(adapters.receiptUrl).toHaveBeenCalledWith("ext-t");
  });

  it("asks the vendor for a Mercury receipt although the row says none, but not for Brex", async () => {
    adapters.receiptUrl.mockResolvedValueOnce({
      url: "https://files.example.com/r.pdf",
      mimeType: "application/pdf",
    });
    const mercury = setup({
      mcpServer: [server(a)],
      financeTransaction: [txn(a, { hasReceipt: false })],
    });
    await expect(
      financeReceiptUrl(mercury.deps, a, { transactionId: "t-1" }),
    ).resolves.toMatchObject({ url: "https://files.example.com/r.pdf" });

    adapters.receiptUrl.mockClear();
    const brex = setup({
      mcpServer: [server(a, { endpoint: FINANCE_MCP_ENDPOINTS.brex })],
      financeTransaction: [txn(a, { hasReceipt: false, provider: "brex" })],
    });
    await expect(financeReceiptUrl(brex.deps, a, { transactionId: "t-1" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(adapters.receiptUrl).not.toHaveBeenCalled();
  });

  it("is NOT_FOUND without a receipt or a link, and BAD_GATEWAY when the vendor fails", async () => {
    const none = setup({ mcpServer: [server(a)], financeTransaction: [txn(a)] });
    await expect(financeReceiptUrl(none.deps, a, { transactionId: "t-1" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    const has = setup({
      mcpServer: [server(a)],
      financeTransaction: [txn(a, { hasReceipt: true })],
    });
    await expect(financeReceiptUrl(has.deps, a, { transactionId: "t-1" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    adapters.receiptUrl.mockRejectedValueOnce(new Error("boom"));
    await expect(financeReceiptUrl(has.deps, a, { transactionId: "t-1" })).rejects.toMatchObject({
      code: "BAD_GATEWAY",
    });
  });
});

describe("runway crypto scope", () => {
  const wallet = (actor: Actor, id: string) => ({
    id,
    ...scope(actor),
    address: `0x${id.padEnd(40, "0")}`,
    type: "personal",
    createdAt: new Date(),
  });
  const holding = (over: Row) => ({
    ...scope(a),
    walletId: "w1",
    chainId: 1,
    tokenAddress: "",
    symbol: "ETH",
    name: "Ether",
    decimals: 6,
    rawBalance: "1",
    usdPrice: "1",
    usdValueCents: 70n,
    syncedAt: new Date("2026-10-14T00:00:00Z"),
    ...over,
  });
  const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
  const snap = (walletId: string, day: string, stable: bigint, other = 0n, actor = a) => ({
    ...scope(actor),
    walletId,
    day,
    stablecoinCents: stable,
    otherCryptoCents: other,
  });
  const data = (pref?: string) => ({
    financeAccount: [account(a, { balanceCents: 100_000n })],
    financeWallet: [wallet(a, "w1"), wallet(a, "w2"), wallet(b, "wb")],
    financeCryptoHolding: [
      holding({ tokenAddress: USDC, symbol: "USDC", usdValueCents: 300n }),
      holding({}),
    ],
    financeCryptoSnapshot: [
      snap("w1", "2026-08-15", 100n),
      snap("w1", "2026-09-20", 200n),
      snap("w2", "2026-09-10", 0n, 50n),
      snap("wb", "2026-09-10", 999n, 0n, b),
    ],
    financePreference: pref ? [{ ...scope(a), runwayCrypto: pref }] : [],
  });
  const history = async (pref?: string) => {
    const out = await financeRunway(setup(data(pref)).deps, a);
    return Object.fromEntries(out.history.map((p) => [p.month, p.balanceCents]));
  };

  it("defaults to bank and saves a choice per user", async () => {
    const { deps, prisma } = setup(data());
    expect(await financePreferences(deps, a)).toEqual({ runwayCrypto: "bank" });
    expect(await financeSetPreferences(deps, a, { runwayCrypto: "all" })).toEqual({
      runwayCrypto: "all",
    });
    expect(await financePreferences(deps, a)).toEqual({ runwayCrypto: "all" });
    expect(await financeSetPreferences(deps, a, { runwayCrypto: "bank" })).toEqual({
      runwayCrypto: "bank",
    });
    expect(prisma.financePreference.rows).toHaveLength(1);
    expect(await financePreferences(deps, b)).toEqual({ runwayCrypto: "bank" });
  });

  it("reports cash and every part under each scope", async () => {
    for (const [pref, cashCents] of [
      ["bank", 100_000],
      ["stablecoins", 100_300],
      ["all", 100_370],
    ] as const) {
      const out = await financeRunway(setup(data(pref)).deps, a);
      expect(out).toMatchObject({
        runwayCrypto: pref,
        cashCents,
        breakdown: { bankCents: 100_000, stablecoinCents: 300, otherCryptoCents: 70 },
      });
    }
  });

  it("builds history from bank history and the latest snapshots, bank only before the first", async () => {
    const all = await history("all");
    expect(all["2026-07"]).toBe(100_000);
    expect(all["2026-08"]).toBe(100_100);
    expect(all["2026-09"]).toBe(100_250);
    // The current month uses today's holdings, not a snapshot.
    expect(all["2026-10"]).toBe(100_370);
    const stable = await history("stablecoins");
    expect(stable["2026-09"]).toBe(100_200);
    expect(stable["2026-10"]).toBe(100_300);
    expect((await history("bank"))["2026-09"]).toBe(100_000);
  });

  it("makes the overview and the accounts total follow the same scope", async () => {
    for (const [pref, stable, other, cashCents] of [
      ["bank", 0, 0, 100_000],
      ["stablecoins", 300, 0, 100_300],
      ["all", 300, 70, 100_370],
    ] as const) {
      const { deps } = setup(data(pref));
      const overview = await financeOverview(deps, a);
      // The crypto fields are what is counted in cashCents, so they add up under every scope.
      expect(overview.cash).toMatchObject({
        cashCents,
        bankCashCents: 100_000,
        stablecoinCents: stable,
        otherCryptoCents: other,
      });
      expect((await financeAccounts(deps, a)).totalCashCents).toBe(cashCents);
    }
  });

  it("returns crypto history with each wallet carried forward", async () => {
    const { deps } = setup(data());
    const { points } = await financeCryptoHistory(deps, a, { days: 61 });
    expect(points).toEqual([
      { day: "2026-08-15", stablecoinCents: 100, otherCryptoCents: 0 },
      { day: "2026-09-10", stablecoinCents: 100, otherCryptoCents: 50 },
      { day: "2026-09-20", stablecoinCents: 200, otherCryptoCents: 50 },
    ]);
    const one = await financeCryptoHistory(deps, a, { days: 61, walletId: "w1" });
    expect(one.points.map((p) => p.stablecoinCents)).toEqual([100, 200]);
    // A window that starts after a snapshot still carries that wallet's last value in.
    const late = await financeCryptoHistory(deps, a, { days: 30 });
    expect(late.points).toEqual([
      { day: "2026-09-20", stablecoinCents: 200, otherCryptoCents: 50 },
    ]);
  });

  it("does not reveal another user's wallet", async () => {
    const { deps } = setup(data());
    await expect(financeCryptoHistory(deps, a, { days: 30, walletId: "wb" })).rejects.toThrow(
      notFound(),
    );
    await expect(financeCryptoHistory(deps, a, { days: 30, walletId: "nope" })).rejects.toThrow(
      notFound(),
    );
  });

  it("starts a wallet-only user's history at the month before the first snapshot, bank counted as zero", async () => {
    const wallet = {
      id: "w1",
      ...scope(a),
      address: `0x${"0".repeat(40)}`,
      type: "personal",
      createdAt: new Date(),
    };
    const { deps } = setup({
      financeWallet: [wallet],
      financeCryptoHolding: [holding({ usdValueCents: 500n })],
      financeCryptoSnapshot: [snap("w1", "2026-09-20", 0n, 400n)],
      financePreference: [{ ...scope(a), runwayCrypto: "all" }],
    });
    const out = await financeRunway(deps, a);
    expect(out.cashCents).toBe(500);
    expect(out.history).toHaveLength(3);
    expect(out.history[0]).toEqual({ month: "2026-08", balanceCents: 0 });
    expect(out.history.at(-2)).toEqual({ month: "2026-09", balanceCents: 400 });
    expect(out.history.at(-1)).toEqual({ month: "2026-10", balanceCents: 500 });
  });

  it("makes the accounts chart follow the scope, also without bank accounts", async () => {
    const { deps } = setup(data("all"));
    const { history: chart } = await financeAccounts(deps, a);
    const byMonth = Object.fromEntries(chart.map((p) => [p.month, p.balanceCents]));
    expect(byMonth["2026-09"]).toBe(100_250);
    expect(byMonth["2026-10"]).toBe(100_370);
    expect((await financeAccounts(setup(data("bank")).deps, a)).history.at(-1)?.balanceCents).toBe(
      100_000,
    );
    const walletOnly = setup({ ...data("all"), financeAccount: [] });
    const lone = (await financeAccounts(walletOnly.deps, a)).history;
    expect(lone[0]?.month).toBe("2026-07");
    expect(lone.at(-2)?.balanceCents).toBe(250);
    expect(lone.at(-1)?.balanceCents).toBe(370);
  });
});

describe("balance series", () => {
  const wallet = (id: string) => ({
    id,
    ...scope(a),
    address: `0x${id.padEnd(40, "0")}`,
    type: "personal",
    createdAt: new Date(),
  });
  const holding = (usd: bigint) => ({
    ...scope(a),
    walletId: "w1",
    chainId: 1,
    tokenAddress: "",
    symbol: "ETH",
    name: "Ether",
    decimals: 6,
    rawBalance: "1",
    usdPrice: "1",
    usdValueCents: usd,
    syncedAt: new Date("2026-10-14T00:00:00Z"),
  });
  const snap = (day: string, other: bigint) => ({
    ...scope(a),
    walletId: "w1",
    day,
    stablecoinCents: 0n,
    otherCryptoCents: other,
  });
  const data = (pref: string) => ({
    financeAccount: [account(a, { balanceCents: 100_000n })],
    financeTransaction: [
      txn(a, { id: "t-a", postedAt: new Date("2026-10-12T10:00:00Z"), amountCents: -2_000n }),
      txn(a, { id: "t-b", postedAt: new Date("2026-09-20T10:00:00Z"), amountCents: 5_000n }),
    ],
    financeWallet: [wallet("w1")],
    financeCryptoHolding: [holding(700n)],
    financeCryptoSnapshot: [snap("2026-10-10", 400n), snap("2026-09-30", 300n)],
    financePreference: [{ ...scope(a), runwayCrypto: pref }],
  });
  const series = async (pref: string, range: "week" | "month" | "quarter" | "year") =>
    (await financeBalanceSeries(setup(data(pref)).deps, a, { range })).points;

  it("returns the grid per range ending today", async () => {
    const week = await series("bank", "week");
    expect(week.map((p) => p.day)).toEqual([
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
      "2026-10-11",
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
    ]);
    // The day before the first transaction (Sep 20) through today.
    const month = await series("bank", "month");
    expect([month[0]?.day, month.at(-1)?.day]).toEqual(["2026-09-19", "2026-10-14"]);
    expect((await series("bank", "quarter")).map((p) => p.day).slice(-2)).toEqual([
      "2026-10-07",
      "2026-10-14",
    ]);
    // The year starts at the month end before the first transaction (Sep 20), not last November.
    expect((await series("bank", "year"))[0]?.day).toBe("2026-08-31");
  });

  it("starts the runway and accounts charts at the month before the first data, not a year back", async () => {
    const { deps } = setup(data("bank"));
    expect((await financeAccounts(deps, a)).history.map((p) => p.month)).toEqual([
      "2026-08",
      "2026-09",
      "2026-10",
    ]);
    expect((await financeRunway(deps, a)).history[0]?.month).toBe("2026-08");
  });

  it("rebuilds daily bank cash by undoing later transactions", async () => {
    const week = Object.fromEntries(
      (await series("bank", "week")).map((p) => [p.day, p.balanceCents]),
    );
    expect(week["2026-10-14"]).toBe(100_000);
    expect(week["2026-10-12"]).toBe(100_000);
    // The 12th's $20 spend had not happened yet on the 11th.
    expect(week["2026-10-11"]).toBe(102_000);
  });

  it("adds counted crypto: snapshots for past days, holdings for today, none under bank", async () => {
    const all = Object.fromEntries(
      (await series("all", "week")).map((p) => [p.day, p.balanceCents]),
    );
    expect(all["2026-10-09"]).toBe(102_000 + 300);
    expect(all["2026-10-10"]).toBe(102_000 + 400);
    expect(all["2026-10-14"]).toBe(100_000 + 700);
  });

  it("matches the accounts chart at the same month-ends under every scope", async () => {
    for (const pref of ["bank", "stablecoins", "all"]) {
      const { deps } = setup(data(pref));
      const chart = (await financeAccounts(deps, a)).history.map((p) => p.balanceCents);
      const year = (await financeBalanceSeries(deps, a, { range: "year" })).points.map(
        (p) => p.balanceCents,
      );
      expect(year).toEqual(chart);
    }
  });

  it("works for a wallet-only user", async () => {
    const { financeAccount: _a, financeTransaction: _t, ...rest } = data("all");
    const { deps } = setup(rest);
    const week = (await financeBalanceSeries(deps, a, { range: "week" })).points;
    expect(week).toHaveLength(7);
    expect(week.map((p) => p.balanceCents)).toEqual([300, 300, 400, 400, 400, 400, 700]);
  });
});

describe("finance pages with the real calculations", () => {
  type Name = keyof typeof metrics;
  const standIns = new Map<Name, unknown>();
  beforeEach(async () => {
    const real = await vi.importActual<typeof import("@rakazo/core")>("@rakazo/core");
    for (const name of Object.keys(metrics) as Name[]) {
      standIns.set(name, metrics[name].getMockImplementation());
      metrics[name].mockImplementation(real[name] as never);
    }
  });
  afterEach(() => {
    for (const [name, impl] of standIns) metrics[name].mockImplementation(impl as never);
  });

  const monthlyCharge = (month: string, over: Row = {}) =>
    txn(a, {
      id: `t-${month}`,
      externalId: `x-${month}`,
      postedAt: new Date(`2026-${month}-09T00:00:00Z`),
      amountCents: -481_200n,
      counterparty: "Cloudnine Hosting",
      vendorKey: "cloudnine-hosting",
      ...over,
    });

  it("averages a vendor over the months since it was first seen, not six", async () => {
    const { deps } = setup({
      financeAccount: [account(a)],
      financeTransaction: ["07", "08", "09", "10"].map((m) => monthlyCharge(m)),
    });
    const vendor = await financeVendor(deps, a, { key: "cloudnine-hosting" });
    // Jul, Aug and Sep are the full months since first seen; October is still partial.
    expect(vendor.monthlyAvgCents).toBe(481_200);
    expect(vendor.monthlyAvgMonths).toBe(3);
  });

  it("windows a vendor by purchase date, the same date its monthly totals use", async () => {
    const { deps } = setup({
      financeAccount: [account(a)],
      financeTransaction: [
        monthlyCharge("09", {
          id: "p1",
          externalId: "p1",
          purchasedAt: new Date("2026-08-31T00:00:00Z"),
          postedAt: new Date("2026-09-02T00:00:00Z"),
          amountCents: -10_000n,
        }),
        monthlyCharge("10", {
          id: "p2",
          externalId: "p2",
          purchasedAt: new Date("2026-09-30T00:00:00Z"),
          postedAt: new Date("2026-10-02T00:00:00Z"),
          amountCents: -10_000n,
        }),
      ],
    });
    const vendor = await financeVendor(deps, a, { key: "cloudnine-hosting" });
    expect(vendor.firstSeenAt.slice(0, 10)).toBe("2026-08-31");
    expect(vendor.monthlyAvgMonths).toBe(2);
    expect(vendor.monthlyAvgCents).toBe(10_000);
  });

  it("compares a new vendor's last full month with its first full month", async () => {
    const { deps } = setup({
      financeAccount: [account(a)],
      financeTransaction: [
        // Synced data starts in June, before the vendor's first charge in July.
        monthlyCharge("06", {
          vendorKey: "other",
          counterparty: "Other",
          id: "o",
          externalId: "o",
        }),
        ...["07", "08", "09", "10"].map((m) => monthlyCharge(m)),
      ],
    });
    const vendor = await financeVendor(deps, a, { key: "cloudnine-hosting" });
    expect(vendor.changePct).toBe(0);
    expect(vendor.changeFromMonth).toBe("2026-07");
  });

  it("counts Brex spend in By account, so the shares add up to all spend", async () => {
    const { deps } = setup({
      financeAccount: [account(a)],
      financeTransaction: [
        ...["07", "08", "09"].map((m) => monthlyCharge(m)),
        ...["07", "08", "09"].map((m) =>
          monthlyCharge(m, {
            id: `b-${m}`,
            externalId: `bx-${m}`,
            provider: "brex",
            mcpServerId: "srv-2",
            accountExternalId: "brex-card",
            amountCents: -10_000n,
            counterparty: "Globex",
            vendorKey: "globex",
          }),
        ),
      ],
    });
    const burn = await financeBurn(deps, a);
    expect(burn.byAccount.map((r) => r.cents)).toEqual([3 * 481_200]);
    expect(burn.brexCents).toBe(30_000);
  });

  it("shows each period's chart and breakdown over the same days as its total", async () => {
    const { deps } = setup({
      financeAccount: [account(a)],
      financeTransaction: [
        monthlyCharge("09", { postedAt: new Date("2026-09-30T00:00:00Z") }),
        monthlyCharge("10", { postedAt: new Date("2026-10-02T00:00:00Z") }),
      ],
    });
    const overview = await financeOverview(deps, a);
    const month = overview.cashSeries.month;
    expect(month[0]?.start).toBe(overview.spendTotals.month.start);
    expect(month.at(-1)?.start).toBe("2026-10-14");
    expect(month.reduce((sum, p) => sum + p.outCents, 0)).toBe(
      overview.spendTotals.month.currentCents,
    );
    expect(overview.breakdownByPeriod?.month.vendor).toEqual([
      { key: "cloudnine-hosting", label: "Cloudnine Hosting", cents: 481_200 },
    ]);
  });
});
