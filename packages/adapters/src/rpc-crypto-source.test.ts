import { describe, expect, it } from "vitest";
import { CRYPTO_TOKEN_LIST } from "./crypto-token-list.js";
import type { FakeWorld } from "./rpc-crypto-fake-fetch.js";
import {
  fakeRpc,
  OWNER_1,
  OWNER_2,
  SAFE_WALLET,
  TOKEN_UNLISTED,
  WALLET_A,
} from "./rpc-crypto-fake-fetch.js";
import {
  createRpcClient,
  fetchChainSnapshot,
  fetchPrices,
  fetchSafeDetails,
  keccak256,
  namehash,
  RpcError,
  resolveEnsName,
} from "./rpc-crypto-source.js";

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const text = (s: string) => new TextEncoder().encode(s);
const client = (world: FakeWorld) => {
  const fake = fakeRpc(world);
  return { fake, rpc: createRpcClient({ fetch: fake.fetch, gapMs: 0, retryDelayMs: 0 }) };
};
const [USDC, LISTED_SYMBOL, , LISTED_DECIMALS] = CRYPTO_TOKEN_LIST[1]?.[0] ?? [];

describe("keccak and ENS", () => {
  it("matches known vectors", () => {
    expect(hex(keccak256(new Uint8Array()))).toBe(
      "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470",
    );
    expect(namehash("eth")).toBe(
      "93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae",
    );
    expect(namehash("")).toBe("0".repeat(64));
  });

  it("hardcoded selectors are the keccak of their signatures", () => {
    const sel = (sig: string) => hex(keccak256(text(sig))).slice(0, 8);
    expect([
      sel("balanceOf(address)"),
      sel("aggregate3((address,bool,bytes)[])"),
      sel("getOwners()"),
      sel("getThreshold()"),
      sel("resolver(bytes32)"),
      sel("addr(bytes32)"),
    ]).toEqual(["70a08231", "82ad56cb", "a0e67e2b", "e75235b8", "0178b8bf", "3b3b57de"]);
  });

  it("resolves a name through registry then resolver, and null when unknown", async () => {
    const { rpc } = client({ ens: { "alice.eth": WALLET_A } });
    expect(await resolveEnsName(rpc, "alice.eth")).toBe(WALLET_A);
    expect(await resolveEnsName(rpc, "nobody.eth")).toBeNull();
  });
});

describe("fetchChainSnapshot", () => {
  it("decodes native and multicall token balances, skipping zero and failed ones", async () => {
    const { rpc } = client({
      chains: {
        1: {
          balances: { [WALLET_A]: 1_500_000_000_000_000_000n },
          tokens: { [USDC as string]: { [WALLET_A]: 2_500_000n } },
        },
      },
    });
    const snap = await fetchChainSnapshot(rpc, 1, WALLET_A);
    expect(snap.holdings.map((h) => [h.tokenAddress, h.rawBalance, h.symbol])).toEqual([
      ["", "1500000000000000000", "ETH"],
      [USDC, "2500000", LISTED_SYMBOL],
    ]);
    expect(snap.holdings[1]?.decimals).toBe(LISTED_DECIMALS);
    expect(snap.isContract).toBe(false);
  });

  it("also reads tokens passed in as already stored, and labels Polygon's coin POL", async () => {
    const { rpc } = client({
      chains: {
        137: {
          balances: { [WALLET_A]: 1n },
          tokens: { [TOKEN_UNLISTED]: { [WALLET_A]: 7n } },
        },
      },
    });
    const snap = await fetchChainSnapshot(rpc, 137, WALLET_A, [
      [TOKEN_UNLISTED, "UNL", "Unlisted", 18],
    ]);
    expect(snap.holdings.map((h) => [h.symbol, h.rawBalance, h.llamaKey])).toEqual([
      ["POL", "1", "coingecko:polygon-ecosystem-token"],
      ["UNL", "7", `polygon:${TOKEN_UNLISTED}`],
    ]);
  });
});

describe("fetchPrices", () => {
  it("keeps decimal-string prices and drops low-confidence or missing ones", async () => {
    const { rpc } = client({
      prices: {
        "coingecko:ethereum": { price: 2000.5, confidence: 0.99 },
        "ethereum:0xlow": { price: 1, confidence: 0.5 },
      },
    });
    const prices = await fetchPrices(rpc, [
      "coingecko:ethereum",
      "ethereum:0xlow",
      "ethereum:0xnone",
    ]);
    expect([...prices]).toEqual([["coingecko:ethereum", "2000.5"]]);
  });
});

describe("fetchSafeDetails", () => {
  it("reads owners and threshold, and returns null for a contract that is not a Safe", async () => {
    const chains = { 1: { contracts: [SAFE_WALLET] } };
    const safe = client({ chains, safe: { owners: [OWNER_1, OWNER_2], threshold: 2 } });
    expect(await fetchSafeDetails(safe.rpc, 1, SAFE_WALLET)).toEqual({
      owners: [OWNER_1, OWNER_2],
      threshold: 2,
    });
    expect(await fetchSafeDetails(client({ chains }).rpc, 1, SAFE_WALLET)).toBeNull();
  });
});

describe("transport", () => {
  it("retries a 429 twice, then gives up with a rate_limit error", async () => {
    const ok = client({ chains: { 1: { statuses: [429, 429] } } });
    await expect(ok.rpc.call(1, "eth_getBalance", [WALLET_A, "latest"])).resolves.toBe("0x0");
    expect(ok.fake.calls).toHaveLength(3);
    const bad = client({ chains: { 1: { alwaysStatus: 429 } } });
    await expect(bad.rpc.call(1, "eth_getBalance", [WALLET_A, "latest"])).rejects.toMatchObject({
      kind: "rate_limit",
    });
    expect(bad.fake.calls).toHaveLength(3);
  });

  it("reports a 5xx as unreachable", async () => {
    const { rpc } = client({ chains: { 1: { alwaysStatus: 503 } } });
    const error = await rpc.call(1, "eth_getBalance", [WALLET_A, "latest"]).catch((e) => e);
    expect(error).toBeInstanceOf(RpcError);
    expect((error as RpcError).kind).toBe("unreachable");
  });
});
