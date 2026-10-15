import type { ExchangeProvider } from "@rakazo/contracts";
import { usdValueCents } from "./crypto.js";

// Pure helpers for Coinbase and Kraken balances. Amounts are decimal strings and cents are BigInt;
// no float touches a balance. Exchange assets are told apart by code, which is safe here because a
// regulated exchange lists only vetted assets (unlike on-chain token symbols, which scam tokens copy).

export type ExchangeBucket = "stablecoin" | "other";

/** Kraken's legacy four-letter codes (X for crypto, Z for fiat) and its aliases. */
const KRAKEN_LEGACY: Record<string, string> = {
  XXBT: "BTC",
  XBT: "BTC",
  XETH: "ETH",
  XLTC: "LTC",
  XXRP: "XRP",
  XXLM: "XLM",
  XXDG: "DOGE",
  XDG: "DOGE",
  XETC: "ETC",
  XMLN: "MLN",
  XREP: "REP",
  XZEC: "ZEC",
  XXMR: "XMR",
  ZUSD: "USD",
  ZEUR: "EUR",
  ZGBP: "GBP",
  ZCAD: "CAD",
  ZJPY: "JPY",
  ZAUD: "AUD",
  ZCHF: "CHF",
};

/** Staking and earn variants Kraken appends to a code: .S staked, .M opt-in rewards, .F flexible earn, .B bonded, .P parachain. */
const KRAKEN_SUFFIX = /\.(?:S|M|F|B|P)$/;

/** The plain asset a balance is for: "XXBT" and "XBT.F" are both "BTC"; "ETH2.S" is "ETH". */
export function normalizeExchangeAsset(provider: ExchangeProvider, code: string): string {
  const upper = code.trim().toUpperCase();
  if (provider === "coinbase") return upper === "ETH2" ? "ETH" : upper;
  const base = upper.replace(KRAKEN_SUFFIX, "");
  return KRAKEN_LEGACY[base] ?? (base === "ETH2" ? "ETH" : base);
}

const USD_STABLECOINS = new Set(["USDC", "USDT", "DAI", "PYUSD"]);

/** USD cash and USD stablecoins on the exchange count as stablecoin-like cash. Every other asset is "other". */
export function exchangeBucket(asset: string): ExchangeBucket {
  return asset === "USD" || USD_STABLECOINS.has(asset) ? "stablecoin" : "other";
}

/** USD itself and USD stablecoins are valued at 1.00; everything else needs a market price. */
export const exchangeFixedPrice = (asset: string): string | null =>
  exchangeBucket(asset) === "stablecoin" ? "1" : null;

/** DefiLlama "coingecko:<id>" ids for common assets; anything else stays unpriced. */
const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  XRP: "ripple",
  ADA: "cardano",
  DOGE: "dogecoin",
  LTC: "litecoin",
  DOT: "polkadot",
  LINK: "chainlink",
  AVAX: "avalanche-2",
  MATIC: "matic-network",
  POL: "polygon-ecosystem-token",
  XLM: "stellar",
  ATOM: "cosmos",
  UNI: "uniswap",
  BCH: "bitcoin-cash",
  ETC: "ethereum-classic",
  TRX: "tron",
  SHIB: "shiba-inu",
  XMR: "monero",
  ZEC: "zcash",
  AAVE: "aave",
  NEAR: "near",
  ARB: "arbitrum",
  OP: "optimism",
  ALGO: "algorand",
  FIL: "filecoin",
  XTZ: "tezos",
  MKR: "maker",
  CRV: "curve-dao-token",
  BNB: "binancecoin",
  TON: "the-open-network",
  SUI: "sui",
  APT: "aptos",
  HBAR: "hedera-hashgraph",
};

export const exchangePriceKey = (asset: string): string | null =>
  COINGECKO_IDS[asset] ? `coingecko:${COINGECKO_IDS[asset]}` : null;

/** "0.0012" into integer digits and a decimal scale. Null when not a plain non-negative decimal. */
function parseAmount(text: string): { digits: bigint; scale: number } | null {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(text.trim());
  return m ? { digits: BigInt(m[1] + (m[2] ?? "")), scale: (m[2] ?? "").length } : null;
}

/** Exact sum of two decimal strings (an asset can appear twice after suffixes are merged). Null if either is malformed. */
export function addAmounts(a: string, b: string): string | null {
  const x = parseAmount(a);
  const y = parseAmount(b);
  if (!x || !y) return null;
  const scale = Math.max(x.scale, y.scale);
  const sum = x.digits * 10n ** BigInt(scale - x.scale) + y.digits * 10n ** BigInt(scale - y.scale);
  const s = sum.toString().padStart(scale + 1, "0");
  return scale === 0 ? s : `${s.slice(0, -scale)}.${s.slice(-scale)}`;
}

export const isZeroAmount = (amount: string): boolean => parseAmount(amount)?.digits === 0n;

/** Whole USD cents of a decimal amount at a decimal price, or null when either is unusable. */
export function exchangeValueCents(amount: string, price: string | null): bigint | null {
  const parsed = parseAmount(amount);
  return parsed ? usdValueCents(parsed.digits.toString(), parsed.scale, price) : null;
}

/** Stablecoin and other priced crypto of stored exchange balances (unpriced count for nothing). */
export function exchangeParts(
  balances: readonly { bucket: string; usdValueCents: bigint | null }[],
): { stablecoinCents: bigint; otherCryptoCents: bigint } {
  let stablecoinCents = 0n;
  let otherCryptoCents = 0n;
  for (const b of balances) {
    if (b.usdValueCents === null) continue;
    if (b.bucket === "stablecoin") stablecoinCents += b.usdValueCents;
    else otherCryptoCents += b.usdValueCents;
  }
  return { stablecoinCents, otherCryptoCents };
}
