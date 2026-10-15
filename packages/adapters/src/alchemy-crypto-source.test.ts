import { describe, expect, it, vi } from "vitest";
import {
  AlchemyError,
  alchemyFailureMessage,
  fetchAlchemyHoldings,
  validateAlchemyKey,
} from "./alchemy-crypto-source.js";

const WALLET = "0x1111111111111111111111111111111111111111";
const TOKEN = "0xAAAAaaaaAAAAaaaaAAAAaaaaAAAAaaaaAAAAaaaa";
const SPAM = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const KEY = "alch-secret-key";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const entry = (network: string, tokenAddress: string | null, tokenBalance: string, extra = {}) => ({
  address: WALLET,
  network,
  tokenAddress,
  tokenBalance,
  tokenMetadata: { decimals: 18, name: "Ether", symbol: "ETH" },
  tokenPrices: [{ currency: "usd", value: "2000.5", lastUpdatedAt: "2026-10-15T00:00:00Z" }],
  ...extra,
});
const fakeFetch = (...replies: Array<Response | Error>) => {
  const bodies: Array<Record<string, unknown>> = [];
  const urls: string[] = [];
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    urls.push(String(url));
    bodies.push(JSON.parse(String(init?.body)));
    const next = replies.shift();
    if (next instanceof Error) throw next;
    return next ?? json({ data: { tokens: [] } });
  }) as unknown as typeof fetch;
  return { fetch: fn, bodies, urls };
};

describe("fetchAlchemyHoldings", () => {
  it("asks once for all five chains and maps native and token balances", async () => {
    const f = fakeFetch(
      json({
        data: {
          tokens: [
            entry("eth-mainnet", null, "0x0de0b6b3a7640000"),
            entry("base-mainnet", TOKEN, "0x2710", {
              tokenMetadata: { decimals: 6, name: "USD Coin", symbol: "USDC" },
              tokenPrices: [{ currency: "usd", value: "1.0001" }],
            }),
            entry("matic-mainnet", null, "0x0", {}),
          ],
        },
      }),
    );
    const read = await fetchAlchemyHoldings(KEY, WALLET, { fetch: f.fetch });
    expect(f.fetch).toHaveBeenCalledTimes(1);
    expect(f.urls[0]).toBe(`https://api.g.alchemy.com/data/v1/${KEY}/assets/tokens/by-address`);
    expect(f.bodies[0]).toMatchObject({
      addresses: [
        {
          address: WALLET,
          networks: ["eth-mainnet", "base-mainnet", "arb-mainnet", "opt-mainnet", "matic-mainnet"],
        },
      ],
      withPrices: true,
      includeNativeTokens: true,
      includeErc20Tokens: true,
    });
    expect(read.failed).toEqual([]);
    expect([...read.holdings.keys()].sort((a, b) => a - b)).toEqual(
      [10, 137, 1, 42161, 8453].sort((a, b) => a - b),
    );
    expect(read.holdings.get(1)).toEqual([
      {
        tokenAddress: "",
        symbol: "ETH",
        name: "Ether",
        decimals: 18,
        rawBalance: "1000000000000000000",
        usdPrice: "2000.5",
        llamaKey: "coingecko:ethereum",
      },
    ]);
    expect(read.holdings.get(8453)).toEqual([
      {
        tokenAddress: TOKEN.toLowerCase(),
        symbol: "USDC",
        name: "USD Coin",
        decimals: 6,
        rawBalance: "10000",
        usdPrice: "1.0001",
        llamaKey: `base:${TOKEN.toLowerCase()}`,
      },
    ]);
    // A zero balance is dropped; a chain with nothing is read and empty, not failed.
    expect(read.holdings.get(137)).toEqual([]);
  });

  it("follows pageKey and sends it in the request body", async () => {
    const f = fakeFetch(
      json({ data: { tokens: [entry("eth-mainnet", null, "0x1")], pageKey: "p2" } }),
      json({ data: { tokens: [entry("eth-mainnet", TOKEN, "0x2")] } }),
    );
    const read = await fetchAlchemyHoldings(KEY, WALLET, { fetch: f.fetch });
    expect(f.bodies[0]?.pageKey).toBeUndefined();
    expect(f.bodies[1]?.pageKey).toBe("p2");
    expect(read.holdings.get(1)).toHaveLength(2);
  });

  it("gives up as too large instead of paging forever", async () => {
    const page = () => json({ data: { tokens: [], pageKey: "more" } });
    const f = fakeFetch(...Array.from({ length: 30 }, page));
    await expect(fetchAlchemyHoldings(KEY, WALLET, { fetch: f.fetch })).rejects.toMatchObject({
      kind: "too_large",
    });
    expect(f.fetch).toHaveBeenCalledTimes(20);
  });

  it("leaves a chain that failed out of the result so its old rows are kept", async () => {
    const f = fakeFetch(
      json({
        data: { tokens: [entry("eth-mainnet", null, "0x1")] },
        error: { message: "x", partialErrors: [{ network: "base-mainnet", message: "boom" }] },
      }),
    );
    const read = await fetchAlchemyHoldings(KEY, WALLET, { fetch: f.fetch });
    expect(read.failed).toEqual([8453]);
    expect(read.holdings.has(8453)).toBe(false);
    expect(read.holdings.get(1)).toHaveLength(1);
  });

  it.each([
    ["an empty object", {}],
    ["a null data field", { data: null }],
    ["tokens that are not a list", { data: { tokens: "nope" } }],
    ["a body that is not an object", []],
  ])("treats %s as an unavailable Alchemy, never as empty wallets", async (_n, body) => {
    const f = fakeFetch(json(body));
    await expect(fetchAlchemyHoldings(KEY, WALLET, { fetch: f.fetch })).rejects.toMatchObject({
      kind: "unavailable",
    });
  });

  it("treats a malformed later page as unavailable too", async () => {
    const f = fakeFetch(
      json({ data: { tokens: [entry("eth-mainnet", null, "0x1")], pageKey: "p2" } }),
      json({ data: {} }),
    );
    await expect(fetchAlchemyHoldings(KEY, WALLET, { fetch: f.fetch })).rejects.toMatchObject({
      kind: "unavailable",
    });
  });

  it("keeps spam as unpriced rather than dropping it, and skips tokens with unreadable decimals", async () => {
    const f = fakeFetch(
      json({
        data: {
          tokens: [
            entry("eth-mainnet", SPAM, "0x5", {
              tokenMetadata: {
                decimals: 18,
                name: "  Visit scam.example to claim  ",
                symbol: "CLAIM",
              },
              tokenPrices: [],
            }),
            entry("eth-mainnet", TOKEN, "0x5", { tokenMetadata: {} }),
            entry("eth-mainnet", SPAM, "not-hex"),
            entry("eth-mainnet", null, "0x1", { tokenPrices: [{ currency: "usd", value: "0" }] }),
          ],
        },
      }),
    );
    const held = (await fetchAlchemyHoldings(KEY, WALLET, { fetch: f.fetch })).holdings.get(1);
    expect(held?.map((h) => [h.tokenAddress, h.name, h.usdPrice])).toEqual([
      [SPAM, "Visit scam.example to claim", null],
      ["", "Ether", null],
    ]);
  });

  it.each([
    [401, "rejected"],
    [403, "rejected"],
    [429, "rate_limit"],
    [500, "unavailable"],
    [503, "unavailable"],
  ])("maps HTTP %i to %s", async (status, kind) => {
    const f = fakeFetch(json({ error: { message: "no" } }, status));
    const error = await fetchAlchemyHoldings(KEY, WALLET, { fetch: f.fetch }).catch((e) => e);
    expect(error).toBeInstanceOf(AlchemyError);
    expect(error.kind).toBe(kind);
    // The key is in the request URL only; it is never in an error.
    expect(String(error.message)).not.toContain(KEY);
  });

  it("treats a network error as unavailable", async () => {
    const f = fakeFetch(new TypeError("fetch failed"));
    await expect(fetchAlchemyHoldings(KEY, WALLET, { fetch: f.fetch })).rejects.toMatchObject({
      kind: "unavailable",
    });
  });
});

describe("validateAlchemyKey", () => {
  it("makes one small request and resolves for an accepted key", async () => {
    const f = fakeFetch(json({ data: { tokens: [] } }));
    await validateAlchemyKey(KEY, { fetch: f.fetch });
    expect(f.fetch).toHaveBeenCalledTimes(1);
    expect(f.bodies[0]).toMatchObject({ withPrices: false, includeErc20Tokens: false });
  });

  it("rejects a bad key", async () => {
    const f = fakeFetch(json({}, 401));
    await expect(validateAlchemyKey(KEY, { fetch: f.fetch })).rejects.toMatchObject({
      kind: "rejected",
    });
  });
});

it("failure messages name Alchemy and the fallback", () => {
  expect(alchemyFailureMessage("rejected")).toBe("Alchemy rejected the API key; using public RPC");
});
