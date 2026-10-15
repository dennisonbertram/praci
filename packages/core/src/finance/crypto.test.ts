import type { CryptoHolding } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import {
  countedCash,
  cryptoHistoryPoints,
  cryptoPartsOn,
  holdingParts,
  parseWalletInput,
  summarizeCrypto,
  usdValueCents,
} from "./crypto.js";

const DEAD = "0x000000000000000000000000000000000000dEaD";

describe("parseWalletInput", () => {
  it("lowercases a 0x address", () => {
    expect(parseWalletInput(` ${DEAD} `)).toEqual({ kind: "address", address: DEAD.toLowerCase() });
  });
  it("detects an ENS name and lowercases it", () => {
    expect(parseWalletInput("Example.ETH")).toEqual({ kind: "ens", name: "example.eth" });
    expect(parseWalletInput("sub.example.xyz")).toEqual({ kind: "ens", name: "sub.example.xyz" });
  });
  it("rejects junk and short or non-hex addresses", () => {
    for (const bad of [
      "",
      "0x123",
      `0x${"g".repeat(40)}`,
      "nodot",
      "has space.eth",
      "a..eth",
      ".eth",
    ]) {
      expect(parseWalletInput(bad)).toBeNull();
    }
  });
});

describe("usdValueCents", () => {
  it("converts with BigInt: 1.5 ETH at $2000", () => {
    expect(usdValueCents("1500000000000000000", 18, "2000")).toBe(300000n);
  });
  it("rounds half up", () => {
    // 0.005 USD = 0.5 cent -> 1
    expect(usdValueCents("5", 3, "1")).toBe(1n);
    // 0.0049 USD -> 0
    expect(usdValueCents("49", 4, "1")).toBe(0n);
  });
  it("keeps precision beyond a double", () => {
    // 123456789012345678901234567890 raw @ 6 decimals, price 1.000001 -> exact integer math
    expect(usdValueCents("123456789012345678901234567890", 6, "1.000001")).toBe(
      12345691246913469124691347n,
    );
  });
  it("handles tiny prices and exponent notation", () => {
    expect(usdValueCents("1000000000000000000000000", 18, "0.00001234")).toBe(1234n);
    expect(usdValueCents("1000000000000000000000000", 18, "1.234e-5")).toBe(1234n);
  });
  it("returns null when unpriced, zero priced or malformed", () => {
    expect(usdValueCents("100", 0, null)).toBeNull();
    expect(usdValueCents("100", 0, "0")).toBeNull();
    expect(usdValueCents("100", 0, "abc")).toBeNull();
    expect(usdValueCents("-1", 0, "1")).toBeNull();
    expect(usdValueCents("1.5", 0, "1")).toBeNull();
  });
});

const holding = (over: Partial<CryptoHolding>): CryptoHolding => ({
  walletId: "w1",
  chainId: 1,
  tokenAddress: null,
  symbol: "ETH",
  name: "Ether",
  decimals: 18,
  rawBalance: "1",
  usdPrice: "1",
  usdValueCents: 100,
  syncedAt: "2026-10-16T10:00:00.000Z",
  ...over,
});

describe("summarizeCrypto", () => {
  it("totals priced holdings by chain and wallet, largest first", () => {
    const s = summarizeCrypto([
      holding({ usdValueCents: 500 }),
      holding({ walletId: "w2", chainId: 8453, usdValueCents: 700 }),
      holding({ walletId: "w2", chainId: 1, tokenAddress: DEAD.toLowerCase(), usdValueCents: 300 }),
    ]);
    expect(s.totalCents).toBe(1500);
    expect(s.byChain).toEqual([
      { chainId: 1, cents: 800 },
      { chainId: 8453, cents: 700 },
    ]);
    expect(s.byWallet).toEqual([
      { walletId: "w2", cents: 1000 },
      { walletId: "w1", cents: 500 },
    ]);
    expect(s.unpricedTokenCount).toBe(0);
  });
  it("counts unpriced non-zero tokens but never totals them; zero balances are ignored", () => {
    const s = summarizeCrypto([
      holding({ usdValueCents: 100 }),
      holding({ symbol: "SPAM", usdPrice: null, usdValueCents: null, rawBalance: "5" }),
      holding({ symbol: "DUST", usdPrice: null, usdValueCents: null, rawBalance: "0" }),
    ]);
    expect(s.totalCents).toBe(100);
    expect(s.unpricedTokenCount).toBe(1);
  });
  it("uses the oldest sync time and is empty-safe", () => {
    const s = summarizeCrypto([
      holding({ syncedAt: "2026-10-16T10:00:00.000Z" }),
      holding({ syncedAt: "2026-10-16T09:00:00.000Z" }),
    ]);
    expect(s.lastSyncedAt).toBe("2026-10-16T09:00:00.000Z");
    expect(summarizeCrypto([])).toEqual({
      totalCents: 0,
      stablecoinCents: 0,
      byChain: [],
      byWallet: [],
      lastSyncedAt: null,
      unpricedTokenCount: 0,
    });
  });
});

describe("summarizeCrypto stablecoins", () => {
  const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
  it("counts a USDC at its canonical address and nothing else as stablecoin", () => {
    const s = summarizeCrypto([
      holding({ symbol: "USDC", tokenAddress: USDC, usdValueCents: 1000 }),
      holding({ symbol: "USDC", tokenAddress: `0x${"1".repeat(40)}`, usdValueCents: 5000 }),
      holding({ symbol: "USDC", chainId: 8453, tokenAddress: USDC, usdValueCents: 700 }),
      holding({ symbol: "ETH", tokenAddress: null, usdValueCents: 9000 }),
    ]);
    expect(s.stablecoinCents).toBe(1000);
    expect(s.totalCents).toBe(15_700);
  });
  it("never counts an unpriced stablecoin", () => {
    const s = summarizeCrypto([
      holding({
        symbol: "USDC",
        tokenAddress: USDC,
        usdPrice: null,
        usdValueCents: null,
        rawBalance: "5",
      }),
    ]);
    expect(s.stablecoinCents).toBe(0);
  });
  it("values a depegged stablecoin at its synced value", () => {
    const s = summarizeCrypto([
      holding({ tokenAddress: USDC, usdPrice: "0.9", usdValueCents: 900 }),
    ]);
    expect(s.stablecoinCents).toBe(900);
  });
});

describe("countedCash", () => {
  const parts = { bankCents: 1_000, stablecoinCents: 200, otherCryptoCents: 30 };
  it("counts the crypto the scope allows", () => {
    expect(countedCash(parts, "bank")).toBe(1_000);
    expect(countedCash(parts, "stablecoins")).toBe(1_200);
    expect(countedCash(parts, "all")).toBe(1_230);
  });
});

describe("holdingParts", () => {
  it("splits priced holdings into stablecoins and other, ignoring unpriced ones", () => {
    const usdc = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
    expect(
      holdingParts([
        { chainId: 1, tokenAddress: usdc, usdValueCents: 500n },
        { chainId: 1, tokenAddress: "", usdValueCents: 70n },
        { chainId: 1, tokenAddress: "0xdead", usdValueCents: null },
      ]),
    ).toEqual({ stablecoinCents: 500n, otherCryptoCents: 70n });
  });
});

describe("crypto snapshot series", () => {
  const row = (walletId: string, day: string, stablecoinCents: number, otherCryptoCents = 0) => ({
    walletId,
    day,
    stablecoinCents,
    otherCryptoCents,
  });
  const rows = [
    row("w1", "2026-10-01", 100, 10),
    row("w1", "2026-10-03", 150, 10),
    row("w2", "2026-10-02", 40),
  ];
  it("sums each wallet's latest snapshot on or before the day, zero before any", () => {
    expect(cryptoPartsOn(rows, "2026-09-30")).toEqual({ stablecoinCents: 0, otherCryptoCents: 0 });
    expect(cryptoPartsOn(rows, "2026-10-02")).toEqual({
      stablecoinCents: 140,
      otherCryptoCents: 10,
    });
    expect(cryptoPartsOn(rows, "2026-10-31")).toEqual({
      stablecoinCents: 190,
      otherCryptoCents: 10,
    });
  });
  it("returns snapshot days in the window, carrying other wallets forward", () => {
    expect(cryptoHistoryPoints(rows, "2026-10-02", "2026-10-31")).toEqual([
      { day: "2026-10-02", stablecoinCents: 140, otherCryptoCents: 10 },
      { day: "2026-10-03", stablecoinCents: 190, otherCryptoCents: 10 },
    ]);
  });
});
