import type { CryptoSourceHolding } from "./rpc-crypto-source.js";
import { LLAMA } from "./rpc-crypto-source.js";

// Alchemy Portfolio API, "Tokens By Wallet":
// https://www.alchemy.com/docs/reference/get-tokens-by-address
// Limits (2 addresses and 5 networks per request, pageKey in the request body, partial failures as
// HTTP 200 with `error.partialErrors`): https://www.alchemy.com/docs/reference/portfolio-apis
// Cost, 360 CU per request: https://www.alchemy.com/docs/reference/compute-unit-costs

const BASE = "https://api.g.alchemy.com/data/v1";
const REQUEST_TIMEOUT_MS = 15_000;
// ponytail: 20 pages (a few thousand tokens). A wallet with more is treated as too large and the
// sync falls back to the curated RPC list. Raise the cap or sort by value if real wallets hit it.
const MAX_PAGES = 20;
const NETWORKS: Record<string, number> = {
  "eth-mainnet": 1,
  "base-mainnet": 8453,
  "arb-mainnet": 42161,
  "opt-mainnet": 10,
  "matic-mainnet": 137,
};
const NETWORK_NAMES = Object.keys(NETWORKS);

export type AlchemyFailureKind = "rejected" | "rate_limit" | "unavailable" | "too_large";

export class AlchemyError extends Error {
  constructor(readonly kind: AlchemyFailureKind) {
    super(`Alchemy ${kind}`);
    this.name = "AlchemyError";
  }
}

/** Shown on the crypto page; every message starts with this prefix so the page can tell them apart. */
export const ALCHEMY_MESSAGE_PREFIX = "Alchemy";
export function alchemyFailureMessage(kind: AlchemyFailureKind): string {
  switch (kind) {
    case "rejected":
      return "Alchemy rejected the API key; using public RPC";
    case "rate_limit":
      return "Alchemy rate limit reached; using public RPC";
    case "too_large":
      return "Alchemy returned too many tokens; using public RPC";
    default:
      return "Alchemy is unavailable; using public RPC";
  }
}

export interface AlchemyWalletRead {
  /** Holdings per chain id, for every chain Alchemy answered for (possibly empty). */
  holdings: Map<number, CryptoSourceHolding[]>;
  /** Chains Alchemy could not read this time. */
  failed: number[];
}

type Entry = {
  network?: string;
  tokenAddress?: string | null;
  tokenBalance?: string;
  tokenMetadata?: { decimals?: number | null; name?: string | null; symbol?: string | null };
  tokenPrices?: Array<{ currency?: string; value?: string }>;
};
type Page = {
  data?: { tokens?: Entry[]; pageKey?: string };
  error?: { partialErrors?: Array<{ network?: string }> };
};

async function post(
  doFetch: typeof fetch,
  apiKey: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<Page> {
  let res: Response;
  try {
    res = await doFetch(`${BASE}/${encodeURIComponent(apiKey)}/assets/tokens/by-address`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.any([
        ...(signal ? [signal] : []),
        AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      ]),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new AlchemyError("unavailable");
  }
  if (res.status === 401 || res.status === 403) throw new AlchemyError("rejected");
  if (res.status === 429) throw new AlchemyError("rate_limit");
  if (!res.ok) throw new AlchemyError("unavailable");
  try {
    return (await res.json()) as Page;
  } catch {
    throw new AlchemyError("unavailable");
  }
}

/** One cheap request (native coin only, no metadata or prices) that proves the key is accepted. */
export async function validateAlchemyKey(
  apiKey: string,
  opts: { fetch?: typeof fetch; signal?: AbortSignal } = {},
): Promise<void> {
  await post(
    opts.fetch ?? fetch,
    apiKey,
    {
      addresses: [{ address: `0x${"0".repeat(40)}`, networks: ["eth-mainnet"] }],
      withMetadata: false,
      withPrices: false,
      includeNativeTokens: true,
      includeErc20Tokens: false,
    },
    opts.signal,
  );
}

const PRICE = /^\d+(\.\d+)?$/;
const cap = (text: string | null | undefined, max: number, fallback: string) =>
  (text ?? "").trim().slice(0, max) || fallback;

/**
 * Everything one wallet holds on the five chains: one request, followed through `pageKey`. Alchemy
 * returns hex balances and a USD price when it has one; a token without a price keeps `usdPrice`
 * null, so the sync can try DefiLlama. The Portfolio response carries no spam flag, so nothing is
 * dropped as spam: tokens with no price anywhere stay stored but unpriced (they are not valued and
 * only raise the unpriced count). A token without readable decimals cannot be valued and is skipped.
 */
export async function fetchAlchemyHoldings(
  apiKey: string,
  address: string,
  opts: { fetch?: typeof fetch; signal?: AbortSignal } = {},
): Promise<AlchemyWalletRead> {
  const doFetch = opts.fetch ?? fetch;
  const holdings = new Map<number, CryptoSourceHolding[]>(
    Object.values(NETWORKS).map((id) => [id, []]),
  );
  const failedNames = new Set<string>();
  let pageKey: string | undefined;
  for (let page = 0; ; page++) {
    if (page >= MAX_PAGES) throw new AlchemyError("too_large");
    const body = await post(
      doFetch,
      apiKey,
      {
        addresses: [{ address, networks: NETWORK_NAMES }],
        withMetadata: true,
        withPrices: true,
        includeNativeTokens: true,
        includeErc20Tokens: true,
        ...(pageKey ? { pageKey } : {}),
      },
      opts.signal,
    );
    // A reply without a token list is not an empty wallet. Treating it as one would erase the stored
    // holdings, so it counts as Alchemy being unavailable and the sync falls back to public RPC.
    const tokens = body?.data?.tokens;
    if (!Array.isArray(tokens)) throw new AlchemyError("unavailable");
    const partial = body.error?.partialErrors;
    for (const e of Array.isArray(partial) ? partial : [])
      if (e?.network) failedNames.add(e.network);
    for (const entry of tokens) {
      const chainId = NETWORKS[entry?.network ?? ""];
      const holding = chainId === undefined || !entry ? null : toHolding(chainId, entry);
      if (holding) holdings.get(chainId as number)?.push(holding);
    }
    pageKey = body.data?.pageKey || undefined;
    if (!pageKey) break;
  }
  // A failed chain is left out, so the sync keeps its old rows.
  const failed = NETWORK_NAMES.filter((n) => failedNames.has(n)).map((n) => NETWORKS[n] as number);
  for (const id of failed) holdings.delete(id);
  return { holdings, failed };
}

function toHolding(chainId: number, entry: Entry): CryptoSourceHolding | null {
  const info = LLAMA[chainId];
  if (!info || typeof entry.tokenBalance !== "string") return null;
  let raw: bigint;
  try {
    raw = BigInt(entry.tokenBalance);
  } catch {
    return null;
  }
  if (raw <= 0n) return null;
  const meta = entry.tokenMetadata ?? {};
  const native = !entry.tokenAddress;
  const decimals = meta.decimals ?? (native ? 18 : null);
  if (decimals === null || !Number.isInteger(decimals) || decimals < 0 || decimals > 77)
    return null;
  const tokenAddress = native ? "" : (entry.tokenAddress as string).toLowerCase();
  const price = entry.tokenPrices?.find((p) => p.currency?.toLowerCase() === "usd")?.value;
  return {
    tokenAddress,
    symbol: cap(meta.symbol, 64, native ? info.symbol : "UNKNOWN"),
    name: cap(meta.name, 128, native ? info.name : "Unknown token"),
    decimals,
    rawBalance: raw.toString(),
    usdPrice: price && PRICE.test(price) && /[1-9]/.test(price) ? price : null,
    llamaKey: native ? info.native : `${info.chain}:${tokenAddress}`,
  };
}
