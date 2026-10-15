import type { CryptoHolding, CryptoSummary } from "@rakazo/contracts";
import { isStablecoin } from "./stablecoins.js";

// Pure crypto helpers. Money is BigInt end to end here; no float ever touches a balance or a price.

export type WalletInput = { kind: "address"; address: string } | { kind: "ens"; name: string };

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const ENS = /^(?:[a-z0-9¡-￿-]+\.)+[a-z0-9¡-￿-]{2,}$/;

/**
 * A 0x address is lowercased; anything with a dot and no spaces is taken as an ENS name (lowercased).
 * The EIP-55 checksum is not verified (it needs keccak); a wrong address just resolves to an empty wallet.
 */
export function parseWalletInput(input: string): WalletInput | null {
  const text = input.trim();
  if (ADDRESS.test(text)) return { kind: "address", address: text.toLowerCase() };
  const name = text.toLowerCase();
  return ENS.test(name) ? { kind: "ens", name } : null;
}

/** "1.234e-5" or "12.5" into digits and a decimal scale: value = digits / 10^scale. Null when malformed. */
function parseDecimal(text: string): { digits: bigint; scale: number } | null {
  const m = /^(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(text.trim());
  if (!m) return null;
  const frac = m[2] ?? "";
  const exp = Number(m[3] ?? 0);
  const digits = BigInt(m[1] + frac);
  const scale = frac.length - exp;
  return scale >= 0 ? { digits, scale } : { digits: digits * 10n ** BigInt(-scale), scale: 0 };
}

/**
 * raw (uint256 decimal string, smallest unit) / 10^decimals tokens x USD price, in whole cents,
 * rounded half up. Null when there is no usable price (missing, zero or malformed) or raw is not
 * a non-negative integer: such a holding is "unpriced", never valued at zero.
 */
export function usdValueCents(
  rawBalance: string,
  decimals: number,
  usdPrice: string | null,
): bigint | null {
  if (usdPrice === null || !/^\d+$/.test(rawBalance)) return null;
  const price = parseDecimal(usdPrice);
  if (!price || price.digits === 0n) return null;
  const numerator = BigInt(rawBalance) * price.digits * 100n;
  const denominator = 10n ** BigInt(decimals + price.scale);
  return (numerator * 2n + denominator) / (denominator * 2n);
}

/**
 * Priced holdings are totaled; a non-zero holding without a price (often spam) only raises
 * `unpricedTokenCount`. Zero balances are ignored. Cents are exact up to about 90 trillion dollars.
 */
export function summarizeCrypto(holdings: readonly CryptoHolding[]): CryptoSummary {
  const chains = new Map<number, number>();
  const wallets = new Map<string, number>();
  let total = 0;
  let stable = 0;
  let unpriced = 0;
  let oldest: string | null = null;
  for (const h of holdings) {
    if (oldest === null || h.syncedAt < oldest) oldest = h.syncedAt;
    if (h.usdValueCents === null) {
      if (BigInt(h.rawBalance) > 0n) unpriced++;
      continue;
    }
    total += h.usdValueCents;
    if (isStablecoin(h.chainId, h.tokenAddress)) stable += h.usdValueCents;
    chains.set(h.chainId, (chains.get(h.chainId) ?? 0) + h.usdValueCents);
    wallets.set(h.walletId, (wallets.get(h.walletId) ?? 0) + h.usdValueCents);
  }
  const desc = <T extends { cents: number }>(a: T, b: T) => b.cents - a.cents;
  return {
    totalCents: total,
    stablecoinCents: stable,
    byChain: [...chains].map(([chainId, cents]) => ({ chainId, cents })).sort(desc),
    byWallet: [...wallets].map(([walletId, cents]) => ({ walletId, cents })).sort(desc),
    lastSyncedAt: oldest,
    unpricedTokenCount: unpriced,
  };
}
