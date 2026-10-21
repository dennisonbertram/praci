import type { MessageBlock } from "@rakazo/contracts";
import { financeAgentSpawnKey, investorsAgentSpawnKey } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import { selectBuiltinToolsForRun } from "./executor.js";
import type { FinanceToolDeps } from "./finance-tools.js";
import {
  describeFinanceActivity,
  FINANCE_TOOL_NAMES,
  financeAgentRunLine,
  financeToolFromTool,
  financeToolsAllowed,
  hasFinanceSource,
} from "./finance-tools.js";

const MINE = { spaceId: "space-1", userId: "user-1" };
const THEIRS = { spaceId: "space-1", userId: "user-2" };

type Row = Record<string, unknown> & { spaceId: string; userId: string };

const txn = (
  id: string,
  owner: { spaceId: string; userId: string },
  fields: Record<string, unknown>,
): Row => ({
  id,
  ...owner,
  provider: "mercury",
  externalId: id,
  accountExternalId: "chk",
  postedAt: new Date("2026-10-05T12:00:00Z"),
  purchasedAt: null,
  amountCents: -10_000n,
  currency: "USD",
  counterparty: "Vendor A",
  vendorKey: "vendor-a",
  category: "Software",
  status: "posted",
  kind: "externalTransfer",
  classification: "spend",
  cardLastFour: null,
  cardholder: null,
  memo: null,
  hasReceipt: false,
  dashboardUrl: null,
  ...fields,
});

const monthly = (id: string, month: string) =>
  txn(id, MINE, {
    postedAt: new Date(`${month}-10T12:00:00Z`),
    amountCents: -2_000n,
    counterparty: "Streamly",
    vendorKey: "streamly",
    category: "Entertainment",
  });

const transactions: Row[] = [
  txn("a", MINE, {}),
  txn("b", MINE, {
    provider: "brex",
    accountExternalId: "card",
    purchasedAt: new Date("2026-10-06T12:00:00Z"),
    amountCents: -5_000n,
    counterparty: "Vendor B",
    vendorKey: "vendor-b",
    category: "Travel",
    cardLastFour: "4242",
  }),
  // The Mercury payment of that Brex card bill: counting it too would count the spend twice.
  txn("pay", MINE, {
    amountCents: -5_000n,
    counterparty: "Brex",
    vendorKey: "brex",
    category: "Credit & Loan Payments",
    classification: "card_payment",
    postedAt: new Date("2026-10-07T12:00:00Z"),
  }),
  txn("x", THEIRS, { amountCents: -999_999n, counterparty: "Secret Corp", vendorKey: "secret" }),
  monthly("s1", "2026-07"),
  monthly("s2", "2026-08"),
  monthly("s3", "2026-09"),
];
const accounts: Row[] = [
  {
    id: "acc-1",
    ...MINE,
    provider: "mercury",
    externalId: "chk",
    name: "Checking",
    lastFour: "1111",
    kind: "checking",
    balanceCents: 1_000_000n,
    currency: "USD",
  },
  {
    id: "acc-2",
    ...THEIRS,
    provider: "mercury",
    externalId: "chk2",
    name: "Other",
    lastFour: null,
    kind: "checking",
    balanceCents: 9_000_000n,
    currency: "USD",
  },
];

type Where = Record<string, unknown>;

/** Evaluates the subset of Prisma `where` the finance tools use. */
function matches(row: Row, where: Where): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (key === "AND") return (cond as Where[]).every((w) => matches(row, w));
    if (key === "OR") return (cond as Where[]).some((w) => matches(row, w));
    const value = row[key];
    if (cond === null) return value === null || value === undefined;
    if (cond instanceof Date || typeof cond !== "object") return value === cond;
    const c = cond as Record<string, unknown>;
    const v = value as never;
    return Object.entries(c).every(([op, arg]) => {
      if (op === "mode") return true;
      if (op === "not") return arg === null ? value != null : value !== arg;
      if (op === "in") return (arg as unknown[]).includes(value);
      if (op === "contains") {
        return String(value ?? "")
          .toLowerCase()
          .includes(String(arg).toLowerCase());
      }
      if (op === "gte") return v >= (arg as never);
      if (op === "gt") return v > (arg as never);
      if (op === "lte") return v <= (arg as never);
      if (op === "lt") return v < (arg as never);
      return false;
    });
  });
}

const queries: Array<{ model: string; where: Where; list: boolean }> = [];

const wallets: Row[] = [
  {
    id: "w-1",
    ...MINE,
    address: `0x${"ab".repeat(20)}`,
    ensName: "me.eth",
    label: "Main",
    type: "personal",
    createdAt: new Date("2026-10-01T00:00:00Z"),
  },
  {
    id: "w-2",
    ...THEIRS,
    address: `0x${"cd".repeat(20)}`,
    ensName: null,
    label: "Secret",
    type: "personal",
    createdAt: new Date("2026-10-01T00:00:00Z"),
  },
];
const holding = (walletId: string, owner: typeof MINE, fields: Record<string, unknown>): Row => ({
  ...owner,
  walletId,
  chainId: 1,
  tokenAddress: "",
  symbol: "ETH",
  name: "Ether",
  decimals: 18,
  rawBalance: "1500000000000000000",
  usdPrice: "2000",
  usdValueCents: 300_000n,
  syncedAt: new Date("2026-10-14T00:00:00Z"),
  ...fields,
});
const holdings: Row[] = [
  holding("w-1", MINE, {}),
  holding("w-1", MINE, {
    chainId: 8453,
    symbol: "USDC",
    tokenAddress: `0x${"11".repeat(20)}`,
    decimals: 6,
    rawBalance: "2500000",
    usdValueCents: 250n,
  }),
  holding("w-1", MINE, {
    chainId: 10,
    symbol: "SPAM",
    tokenAddress: `0x${"22".repeat(20)}`,
    decimals: 0,
    rawBalance: "7",
    usdPrice: null,
    usdValueCents: null,
  }),
  holding("w-2", THEIRS, { symbol: "LEAK", usdValueCents: 99_999_900n }),
];

const preferences: Row[] = [];
const exchangeConnections: Row[] = [];
const exchangeBalances: Row[] = [];

function fakePrisma(rows: { txns: Row[]; accounts: Row[] }) {
  const table = (model: string, list: Row[]) => {
    const find = (where: Where, isList = false) => {
      queries.push({ model, where, list: isList });
      return list.filter((row) => matches(row, where));
    };
    return {
      findMany: async (args: {
        where: Where;
        orderBy?: Array<Record<string, "asc" | "desc">> | Record<string, "asc" | "desc">;
        take?: number;
        distinct?: string[];
      }) => {
        let found = find(args.where, true);
        for (const order of [args.orderBy ?? []].flat().reverse()) {
          const [field, dir] = Object.entries(order)[0] as [string, "asc" | "desc"];
          found = [...found].sort((a, b) =>
            (a[field] as never) < (b[field] as never) === (dir === "asc") ? -1 : 1,
          );
        }
        if (args.distinct) {
          const seen = new Set<unknown>();
          found = found.filter(
            (row) =>
              !seen.has(row[args.distinct?.[0] ?? ""]) && seen.add(row[args.distinct?.[0] ?? ""]),
          );
        }
        return args.take ? found.slice(0, args.take) : found;
      },
      findFirst: async (args: { where: Where }) => find(args.where)[0] ?? null,
      count: async (args: { where: Where }) => find(args.where).length,
      aggregate: async (args: { where: Where; _min?: Record<string, true> }) => {
        const found = find(args.where);
        const min = (field: string) =>
          found
            .map((row) => row[field] as Date | null)
            .filter((d): d is Date => d !== null)
            .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
        return {
          _count: { _all: found.length },
          _sum: { amountCents: found.reduce((sum, row) => sum + (row.amountCents as bigint), 0n) },
          _min: { purchasedAt: min("purchasedAt"), postedAt: min("postedAt") },
        };
      },
    };
  };
  return {
    financeTransaction: table("txn", rows.txns),
    financeAccount: table("account", rows.accounts),
    financeBill: table("bill", []),
    financeSyncState: table("sync", []),
    financeWallet: table("wallet", wallets),
    financeCryptoHolding: table("holding", holdings),
    financePreference: table("preference", preferences),
    financeExchangeConnection: table("connection", exchangeConnections),
    financeExchangeBalance: table("exchange", exchangeBalances),
  } as unknown as FinanceToolDeps["prisma"];
}

function setup(scope = MINE) {
  const published: MessageBlock[] = [];
  const deps: FinanceToolDeps = {
    prisma: fakePrisma({ txns: transactions, accounts }),
    scope,
    publish: async (blocks) => {
      published.push(...blocks);
    },
    now: () => new Date("2026-10-14T12:00:00Z"),
  };
  return { deps, published };
}

describe("finance_breakdown", () => {
  it("groups the owner's spend once, in dollars, and shows a card", async () => {
    const { deps, published } = setup();
    const result = (await financeToolFromTool("finance_breakdown", deps, {
      by: "vendor",
      range: "30d",
    })) as { total: number; rows: Array<{ name: string; amount: number; sharePct: number }> };
    // Vendor A 100 + Vendor B 50 + Streamly (none in the last 30 days). The card payment is left out.
    expect(result.total).toBe(150);
    expect(result.rows.map((row) => [row.name, row.amount, row.sharePct])).toEqual([
      ["Vendor A", 100, 66.7],
      ["Vendor B", 50, 33.3],
    ]);
    expect(published).toEqual([
      {
        kind: "finance",
        card: expect.objectContaining({ card: "breakdown", by: "vendor", totalCents: 15_000 }),
      },
    ]);
  });

  it("never returns another user's rows", async () => {
    const { deps } = setup(THEIRS);
    const result = await financeToolFromTool("finance_breakdown", deps, { by: "vendor" });
    expect(JSON.stringify(result)).toContain("Secret Corp");
    expect(JSON.stringify(result)).not.toContain("Vendor A");
    const mine = setup().deps;
    expect(
      JSON.stringify(await financeToolFromTool("finance_breakdown", mine, { by: "vendor" })),
    ).not.toContain("Secret");
  });

  it("limits rows and accepts an explicit range", async () => {
    const { deps } = setup();
    const result = (await financeToolFromTool("finance_breakdown", deps, {
      by: "category",
      range: { from: "2026-07-01", to: "2026-10-14" },
      limit: 1,
    })) as { rows: unknown[]; otherAmount: number; otherCount: number; total: number };
    expect(result.rows).toHaveLength(1);
    expect(result.total).toBe(210);
    expect(result.otherAmount).toBe(110);
    expect(result.otherCount).toBeGreaterThan(0);
    expect(await financeToolFromTool("finance_breakdown", deps, { by: "x" })).toHaveProperty(
      "error",
    );
    expect(
      await financeToolFromTool("finance_breakdown", deps, { by: "vendor", range: "7d" }),
    ).toHaveProperty("error");
  });
});

describe("finance_breakdown with refunds", () => {
  it("reports omitted rows even when their total is negative", async () => {
    const rows = [
      txn("r1", MINE, { amountCents: -10_000n, counterparty: "Big", vendorKey: "big" }),
      txn("r2", MINE, { amountCents: 2_000n, counterparty: "Refunder", vendorKey: "refunder" }),
    ];
    const deps: FinanceToolDeps = {
      prisma: fakePrisma({ txns: rows, accounts }),
      scope: MINE,
      now: () => new Date("2026-10-14T12:00:00Z"),
    };
    const result = (await financeToolFromTool("finance_breakdown", deps, {
      by: "vendor",
      limit: 1,
    })) as { total: number; otherCount: number; otherAmount: number };
    expect(result).toMatchObject({ total: 80, otherCount: 1, otherAmount: -20 });
  });
});

describe("published cards", () => {
  it("clip long provider names", async () => {
    const rows = [
      txn("long", MINE, { counterparty: "M".repeat(30_000), vendorKey: "k".repeat(30_000) }),
    ];
    const published: MessageBlock[] = [];
    const deps: FinanceToolDeps = {
      prisma: fakePrisma({ txns: rows, accounts }),
      scope: MINE,
      publish: async (blocks) => {
        published.push(...blocks);
      },
      now: () => new Date("2026-10-14T12:00:00Z"),
    };
    await financeToolFromTool("finance_breakdown", deps, { by: "vendor" });
    await financeToolFromTool("finance_transactions", deps, {});
    expect(published).toHaveLength(2);
    for (const block of published) expect(JSON.stringify(block).length).toBeLessThan(2_000);
  });
});

describe("finance_transactions totals", () => {
  it("sums only USD, non-failed rows and marks the rest", async () => {
    const rows = [
      txn("u", MINE, { amountCents: -10_000n }),
      txn("e", MINE, { amountCents: -50_000n, currency: "EUR", counterparty: "Euro" }),
      txn("o", MINE, { amountCents: -70_000n, status: "other", counterparty: "Failed" }),
    ];
    const deps: FinanceToolDeps = {
      prisma: fakePrisma({ txns: rows, accounts }),
      scope: MINE,
      now: () => new Date("2026-10-14T12:00:00Z"),
    };
    const result = (await financeToolFromTool("finance_transactions", deps, {})) as {
      count: number;
      total: number;
      excludedCount: number;
      transactions: Array<{ id: string; currency: string; excludedFromTotal?: boolean }>;
    };
    expect(result).toMatchObject({ count: 1, total: -100, excludedCount: 2 });
    expect(result.transactions).toHaveLength(3);
    expect(result.transactions.find((t) => t.id === "e")).toMatchObject({
      currency: "EUR",
      excludedFromTotal: true,
    });
    expect(result.transactions.find((t) => t.id === "u")?.excludedFromTotal).toBeUndefined();
  });
});

describe("query bounds", () => {
  it("bounds the transaction query by date instead of loading all history", async () => {
    const { deps } = setup();
    for (const [tool, args] of [
      ["finance_breakdown", { by: "vendor", range: "30d" }],
      ["finance_overview", {}],
      ["finance_recurring", {}],
    ] as const) {
      queries.length = 0;
      await financeToolFromTool(tool, deps, args);
      const lists = queries.filter((q) => q.model === "txn" && q.list);
      expect(lists.length).toBeGreaterThan(0);
      for (const q of lists) expect(JSON.stringify(q.where)).toContain('"gte"');
    }
  });
});

describe("finance_transactions", () => {
  it("filters, counts everything that matched and trims rows", async () => {
    const { deps, published } = setup();
    const result = (await financeToolFromTool("finance_transactions", deps, {
      from: "2026-10-01",
      classification: "spend",
      limit: 1,
    })) as { count: number; total: number; transactions: Array<{ id: string; amount: number }> };
    expect(result.count).toBe(2);
    expect(result.total).toBe(-150);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]).toMatchObject({ id: "b", amount: -50 });
    expect(published[0]).toMatchObject({ card: { card: "transactions", count: 2 } });

    const big = (await financeToolFromTool("finance_transactions", deps, {
      vendor: "vendor a",
      minAmount: 500,
    })) as { count: number };
    expect(big.count).toBe(0);
  });
});

describe("finance_transactions category filter", () => {
  it("matches a category by slug or name and finds uncategorized rows", async () => {
    const { deps } = setup();
    const ids = async (category: string) =>
      (
        (await financeToolFromTool("finance_transactions", deps, { category })) as {
          transactions: Array<{ id: string }>;
        }
      ).transactions.map((t) => t.id);
    expect(await ids("credit-loan-payments")).toEqual(["pay"]);
    expect(await ids("trav")).toEqual(["b"]);
    expect(await ids("uncategorized")).toEqual([]);
  });
});

describe("finance_overview", () => {
  it("reports cash, burn and spend with the same metrics as the dashboard", async () => {
    const { deps, published } = setup();
    const result = (await financeToolFromTool("finance_overview", deps, {})) as {
      cash: { total: number };
      monthlyBurn: number;
      spend: Array<{ period: string; spend: number }>;
    };
    expect(result.cash.total).toBe(10_000);
    // Bank by bank, so "cash per account" can name every account the page counts.
    expect((result.cash as unknown as { accounts: unknown[] }).accounts).toEqual([
      { name: "Checking ••1111", source: "mercury", kind: "checking", balance: 10_000 },
    ]);
    expect(result.monthlyBurn).toBe(20);
    expect(result.spend.find((s) => s.period === "month")?.spend).toBe(150);
    expect(published[0]).toMatchObject({ card: { card: "overview", cashCents: 1_000_000 } });
  });
});

describe("finance_overview stablecoins", () => {
  it("counts a canonical USDC as cash and reports bank-only and other-crypto figures", async () => {
    const canonical = holding("w-1", MINE, {
      symbol: "USDC",
      tokenAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      decimals: 6,
      rawBalance: "5000000",
      usdValueCents: 500n,
    });
    holdings.push(canonical);
    preferences.push({ ...MINE, runwayCrypto: "stablecoins" });
    try {
      const { deps } = setup();
      const result = (await financeToolFromTool("finance_overview", deps, {})) as {
        cash: {
          total: number;
          bankOnly: number;
          stablecoins: number;
          otherCrypto: number;
          totalInclOtherCrypto: number;
        };
      };
      // The Base "USDC" at a made-up address is not a stablecoin; ETH is other crypto.
      expect(result.cash).toMatchObject({
        total: 10_005,
        bankOnly: 10_000,
        stablecoins: 5,
        otherCrypto: 3_002.5,
        totalInclOtherCrypto: 13_007.5,
      });
    } finally {
      holdings.pop();
      preferences.pop();
    }
  });
});

describe("finance_overview runway scope", () => {
  const overview = async (runwayCrypto: string) => {
    preferences.push({ ...MINE, runwayCrypto });
    try {
      const result = await financeToolFromTool("finance_overview", setup().deps, {});
      return result as { cash: { total: number; runwayCrypto: string }; runwayMonths: number };
    } finally {
      preferences.pop();
    }
  };

  it("counts bank cash only under bank", async () => {
    const result = await overview("bank");
    // The fixture has no canonical stablecoin held by this user, so only "all" differs.
    expect(result.cash).toMatchObject({ total: 10_000, runwayCrypto: "bank" });
  });

  it("counts all priced crypto under all, and raises runway", async () => {
    const base = await overview("stablecoins");
    const all = await overview("all");
    expect(all.cash).toMatchObject({ total: 13_002.5, runwayCrypto: "all" });
    expect(all.runwayMonths).toBeGreaterThan(base.runwayMonths);
  });

  it("defaults to bank without a saved preference", async () => {
    const result = (await financeToolFromTool("finance_overview", setup().deps, {})) as {
      cash: { runwayCrypto: string };
    };
    expect(result.cash.runwayCrypto).toBe("bank");
  });
});

describe("finance_recurring", () => {
  it("lists subscriptions with monthly cost and what is coming", async () => {
    const { deps, published } = setup();
    const result = (await financeToolFromTool("finance_recurring", deps, {})) as {
      monthlyTotal: number;
      subscriptions: Array<{ name: string; monthly: number }>;
    };
    expect(result.subscriptions).toEqual([
      expect.objectContaining({ name: "Streamly", monthly: 20 }),
    ]);
    expect(result.monthlyTotal).toBe(20);
    expect(published[0]).toMatchObject({ card: { card: "recurring", monthlyCents: 2000 } });
  });
});

describe("finance_crypto", () => {
  it("summarizes the owner's wallets in dollars, never another user's", async () => {
    const { deps, published } = setup();
    const result = (await financeToolFromTool("finance_crypto", deps, {})) as {
      totalUsd: number;
      unpricedTokenCount: number;
      lastSyncedAt: string;
      byChain: Array<{ chain: string; usd: number }>;
      wallets: Array<{
        name: string;
        totalUsd: number;
        holdings: Array<{ chain: string; symbol: string; amount: string; usd: number | null }>;
      }>;
    };
    expect(result.totalUsd).toBe(3002.5);
    expect(result.unpricedTokenCount).toBe(1);
    expect(result.lastSyncedAt).toBe("2026-10-14T00:00:00.000Z");
    expect(result.byChain).toEqual([
      { chain: "Ethereum", chainId: 1, usd: 3000 },
      { chain: "Base", chainId: 8453, usd: 2.5 },
    ]);
    expect(result.wallets.map((w) => [w.name, w.totalUsd])).toEqual([["Main", 3002.5]]);
    expect(result.wallets[0]?.holdings.map((h) => [h.symbol, h.amount, h.usd])).toEqual([
      ["ETH", "1.5", 3000],
      ["USDC", "2.5", 2.5],
      ["SPAM", "7", null],
    ]);
    expect(JSON.stringify(result)).not.toContain("LEAK");
    expect(published).toEqual([]);
  });

  it("says so when there are no wallets", async () => {
    const { deps } = setup({ spaceId: "space-1", userId: "nobody" });
    expect(await financeToolFromTool("finance_crypto", deps, {})).toMatchObject({ wallets: [] });
  });
});

describe("exchange balances in the Finance tools", () => {
  it("count by asset code in cash and are listed by finance_crypto, never another user's", async () => {
    exchangeConnections.push(
      { id: "x-1", ...MINE, provider: "kraken" },
      { id: "x-2", ...THEIRS, provider: "coinbase" },
    );
    const balance = (
      connectionId: string,
      scope: Row,
      asset: string,
      bucket: string,
      cents: bigint | null,
    ) => ({
      id: `${connectionId}-${asset}`,
      ...scope,
      connectionId,
      asset,
      amount: "1",
      bucket,
      usdValueCents: cents,
    });
    exchangeBalances.push(
      balance("x-1", MINE, "USD", "stablecoin", 5_000n),
      balance("x-1", MINE, "BTC", "other", 20_000n),
      balance("x-1", MINE, "ZZZ", "other", null),
      balance("x-2", THEIRS, "USD", "stablecoin", 99_999n),
    );
    try {
      const { deps } = setup();
      const overview = (await financeToolFromTool("finance_overview", deps, {})) as {
        cash: { total: number; stablecoins: number; otherCrypto: number };
      };
      // Exchange USD 50 is stablecoin cash; exchange BTC 200 joins the wallet's 3002.5 of other crypto.
      expect(overview.cash).toMatchObject({ total: 10_000, stablecoins: 50, otherCrypto: 3202.5 });
      const crypto = (await financeToolFromTool("finance_crypto", deps, {})) as {
        exchanges: Array<{
          exchange: string;
          totalUsd: number;
          balances: Array<{ asset: string; usd: number | null }>;
        }>;
      };
      expect(crypto.exchanges).toEqual([
        {
          exchange: "kraken",
          totalUsd: 250,
          balances: [
            { asset: "BTC", amount: "1", usd: 200 },
            { asset: "USD", amount: "1", usd: 50 },
            { asset: "ZZZ", amount: "1", usd: null },
          ],
        },
      ]);
    } finally {
      exchangeConnections.length = 0;
      exchangeBalances.length = 0;
    }
  });
});

describe("offering the tools", () => {
  const offered = (financeEnabled: boolean) =>
    selectBuiltinToolsForRun({
      graphicalToolsAllowed: false,
      pageBrowserAllowed: false,
      groupId: null,
      trigger: "message",
      semanticMemoryEnabled: false,
      messagingChannelRun: false,
      financeEnabled,
    })
      .map((tool) => tool.name)
      .filter((name) => FINANCE_TOOL_NAMES.has(name))
      .sort();

  it("offers them only when finance is enabled, and marks them read-only", () => {
    expect(offered(false)).toEqual([]);
    expect(offered(true)).toEqual([...FINANCE_TOOL_NAMES].sort());
    for (const tool of selectBuiltinToolsForRun({
      graphicalToolsAllowed: false,
      pageBrowserAllowed: false,
      groupId: null,
      trigger: "message",
      semanticMemoryEnabled: false,
      messagingChannelRun: false,
      financeEnabled: true,
    }).filter((t) => FINANCE_TOOL_NAMES.has(t.name))) {
      expect(tool.readOnly).toBe(true);
    }
  });

  it("is for the Finance agent's owner-initiated runs only", () => {
    const base = {
      hasProvider: true,
      groupId: null,
      runUserId: "u",
      botUserId: "u",
      botSpawnKey: financeAgentSpawnKey("u"),
      trigger: "user",
      messagingChannelRun: false,
    };
    expect(financeToolsAllowed(base)).toBe(true);
    expect(financeToolsAllowed({ ...base, trigger: "follow_up" })).toBe(true);
    expect(financeToolsAllowed({ ...base, trigger: "routine" })).toBe(true);
    // An ordinary owner bot never gets them.
    expect(financeToolsAllowed({ ...base, botSpawnKey: null })).toBe(false);
    expect(financeToolsAllowed({ ...base, botSpawnKey: investorsAgentSpawnKey("u") })).toBe(true);
    expect(financeToolsAllowed({ ...base, botSpawnKey: "inbox-agent:u" })).toBe(false);
    // Another user's connected agent reaches the Finance agent with the owner's userId.
    expect(financeToolsAllowed({ ...base, trigger: "bot_message" })).toBe(false);
    // Chief relaying the owner's own question may read the figures; the executor sets this only
    // for an owner-originated message from the owner's own bot.
    expect(financeToolsAllowed({ ...base, trigger: "bot_message", ownerAgentPeer: true })).toBe(
      true,
    );
    expect(
      financeToolsAllowed({ ...base, trigger: "bot_message", ownerAgentPeer: true, groupId: "g" }),
    ).toBe(false);
    expect(financeToolsAllowed({ ...base, trigger: "messaging" })).toBe(false);
    expect(financeToolsAllowed({ ...base, messagingChannelRun: true })).toBe(false);
    expect(financeToolsAllowed({ ...base, groupId: "g" })).toBe(false);
    expect(financeToolsAllowed({ ...base, runUserId: "someone" })).toBe(false);
  });

  it("needs an enabled Mercury or Brex server of the owner", async () => {
    const servers = [
      { spaceId: "s", userId: "u", endpoint: "https://mcp.mercury.com/mcp" },
      { spaceId: "s", userId: "other", endpoint: "https://api.brex.com/mcp" },
      { spaceId: "s", userId: "v", endpoint: "https://example.com/mcp" },
    ];
    const statementUsers = ["stmt"];
    const prisma = {
      financeAccount: {
        findFirst: async ({ where }: { where: { userId: string } }) =>
          statementUsers.includes(where.userId) ? { id: "a" } : null,
      },
      mcpServer: {
        findMany: async ({ where }: { where: { spaceId: string; userId: string } }) =>
          servers.filter((s) => s.spaceId === where.spaceId && s.userId === where.userId),
      },
    } as unknown as Parameters<typeof hasFinanceSource>[0];
    expect(await hasFinanceSource(prisma, { spaceId: "s", userId: "u" })).toBe(true);
    expect(await hasFinanceSource(prisma, { spaceId: "s", userId: "v" })).toBe(false);
    expect(await hasFinanceSource(prisma, { spaceId: "s", userId: "none" })).toBe(false);
    // A user with only an uploaded-statement account still gets the finance tools.
    expect(await hasFinanceSource(prisma, { spaceId: "s", userId: "stmt" })).toBe(true);
    servers.push({ spaceId: "s", userId: "w", endpoint: "https://mcp.blockscout.com/mcp" });
    expect(await hasFinanceSource(prisma, { spaceId: "s", userId: "w" })).toBe(true);
  });
});

describe("activity labels", () => {
  it("describes each finance call in plain words", () => {
    expect(describeFinanceActivity("finance_breakdown", { by: "category", range: "90d" })).toBe(
      "Reading spend by category · last 90 days",
    );
    expect(describeFinanceActivity("finance_recurring", {})).toBe("Looking at subscriptions");
    expect(describeFinanceActivity("finance_crypto", {})).toBe("Looking at crypto holdings");
    expect(describeFinanceActivity("shell", {})).toBeNull();
  });
});

describe("financeAgentRunLine", () => {
  it("points the finance tools out when they are on", () => {
    expect(financeAgentRunLine(true, "user")).toContain("finance_overview");
  });

  it("tells a bot-to-bot run to send the user to the agent's own chat", () => {
    const line = financeAgentRunLine(false, "bot_message") ?? "";
    expect(line).toContain("ask you in your own chat");
    expect(line).not.toContain("finance_overview");
  });

  it("adds nothing when the tools are off for another reason", () => {
    expect(financeAgentRunLine(false, "user")).toBeUndefined();
  });
});
