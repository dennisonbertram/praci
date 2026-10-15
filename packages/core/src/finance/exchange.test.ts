import { describe, expect, it } from "vitest";
import { countedCash } from "./crypto.js";
import {
  addAmounts,
  exchangeBucket,
  exchangeParts,
  exchangePriceKey,
  exchangeValueCents,
  isZeroAmount,
  normalizeExchangeAsset,
} from "./exchange.js";

describe("normalizeExchangeAsset", () => {
  it("maps Kraken legacy codes and strips staking and earn suffixes", () => {
    const n = (code: string) => normalizeExchangeAsset("kraken", code);
    expect([
      n("XXBT"),
      n("XBT"),
      n("XBT.F"),
      n("XETH"),
      n("ETH2.S"),
      n("ZUSD"),
      n("USD.M"),
    ]).toEqual(["BTC", "BTC", "BTC", "ETH", "ETH", "USD", "USD"]);
    expect([n("XXDG"), n("DOT.S"), n("SOL.B"), n("USDC"), n("ZEUS")]).toEqual([
      "DOGE",
      "DOT",
      "SOL",
      "USDC",
      "ZEUS",
    ]);
  });

  it("keeps Coinbase codes as they are", () => {
    expect(normalizeExchangeAsset("coinbase", "btc")).toBe("BTC");
    expect(normalizeExchangeAsset("coinbase", "USDC")).toBe("USDC");
  });
});

describe("decimal amounts", () => {
  it("adds exactly, with different scales", () => {
    expect(addAmounts("0.1", "0.2")).toBe("0.3");
    expect(addAmounts("1", "0.0000000001")).toBe("1.0000000001");
    expect(addAmounts("0", "0.5")).toBe("0.5");
    expect(addAmounts("1", "x")).toBeNull();
    expect(isZeroAmount("0.0000")).toBe(true);
    expect(isZeroAmount("0.0001")).toBe(false);
  });

  it("values an amount in whole cents, null without a price", () => {
    expect(exchangeValueCents("0.5", "60000")).toBe(3_000_000n);
    expect(exchangeValueCents("12.345", "1")).toBe(1235n);
    expect(exchangeValueCents("1", null)).toBeNull();
  });
});

describe("exchange cash", () => {
  it("counts USD and USD stablecoins as stablecoin cash, other assets as other crypto", () => {
    expect(["USD", "USDC", "USDT", "DAI", "PYUSD"].map(exchangeBucket)).toEqual(
      Array(5).fill("stablecoin"),
    );
    expect(["BTC", "ETH", "EUR", "USDX"].map(exchangeBucket)).toEqual(Array(4).fill("other"));
    expect(exchangePriceKey("BTC")).toBe("coingecko:bitcoin");
    expect(exchangePriceKey("NOPE")).toBeNull();
  });

  it("feeds countedCash: stablecoin scope takes cash and stablecoins, all takes priced crypto, unpriced counts for nothing", () => {
    const parts = exchangeParts([
      { bucket: "stablecoin", usdValueCents: 10_000n },
      { bucket: "other", usdValueCents: 5_000n },
      { bucket: "other", usdValueCents: null },
    ]);
    const input = {
      bankCents: 1_000,
      stablecoinCents: Number(parts.stablecoinCents),
      otherCryptoCents: Number(parts.otherCryptoCents),
    };
    expect(countedCash(input, "bank")).toBe(1_000);
    expect(countedCash(input, "stablecoins")).toBe(11_000);
    expect(countedCash(input, "all")).toBe(16_000);
  });
});
