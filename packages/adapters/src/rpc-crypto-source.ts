import { CRYPTO_CHAINS } from "@rakazo/contracts";
import type { TokenRow } from "./crypto-token-list.js";
import { CRYPTO_TOKEN_LIST } from "./crypto-token-list.js";

// ponytail: shared connection settings can override these public endpoints later; for now they are
// constants, one keyless public RPC per chain (each answers eth_chainId).
export const DEFAULT_RPC_URLS: Record<number, string> = {
  1: "https://ethereum-rpc.publicnode.com",
  8453: "https://mainnet.base.org",
  42161: "https://arb1.arbitrum.io/rpc",
  10: "https://mainnet.optimism.io",
  137: "https://polygon-bor-rpc.publicnode.com",
};

/** DefiLlama's key for the chain, and the coin that prices its native balance. */
export const LLAMA: Record<
  number,
  { chain: string; native: string; symbol: string; name: string }
> = {
  1: { chain: "ethereum", native: "coingecko:ethereum", symbol: "ETH", name: "Ether" },
  8453: { chain: "base", native: "coingecko:ethereum", symbol: "ETH", name: "Ether" },
  42161: { chain: "arbitrum", native: "coingecko:ethereum", symbol: "ETH", name: "Ether" },
  10: { chain: "optimism", native: "coingecko:ethereum", symbol: "ETH", name: "Ether" },
  137: {
    chain: "polygon",
    native: "coingecko:polygon-ecosystem-token",
    symbol: "POL",
    name: "Polygon",
  },
};

const MULTICALL3 = "0xca11bde05977b3631167028862be2a173976ca11";
const ENS_REGISTRY = "0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e";
const ADDRESS = /^0x[0-9a-f]{40}$/;
/** Calls per aggregate3, to stay under public nodes' eth_call gas and size limits. */
const CHUNK = 250;
const MIN_CONFIDENCE = 0.9;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;

// ---- failures ----

export type RpcFailureKind = "unreachable" | "rate_limit" | "timeout" | "failed";

export class RpcError extends Error {
  constructor(
    readonly kind: RpcFailureKind,
    message: string,
  ) {
    super(message);
    this.name = "RpcError";
  }
}

export const classifyRpcError = (error: unknown): RpcFailureKind =>
  error instanceof RpcError ? error.kind : "failed";

const PRIORITY: RpcFailureKind[] = ["unreachable", "rate_limit", "timeout", "failed"];
export const mostActionable = (kinds: RpcFailureKind[]): RpcFailureKind =>
  PRIORITY.find((k) => kinds.includes(k)) ?? "failed";

const join = (names: string[]) =>
  names.length < 3 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

/** Short and user-facing; never a URL or payload. `who` names the chains (or the price service) that failed. */
export function rpcFailureMessage(kind: RpcFailureKind, who: string[], what = "the RPC endpoint") {
  const name = who.length ? join(who) : "Crypto";
  switch (kind) {
    case "unreachable":
      return `${name}: ${what} is not responding`;
    case "rate_limit":
      return `${name}: ${what} rate limit reached, try again shortly`;
    case "timeout":
      return `${name}: the request timed out`;
    default:
      return `${name}: the request failed`;
  }
}

// ---- transport ----

export interface RpcClientOptions {
  fetch?: typeof fetch;
  urls?: Record<number, string>;
  /** Minimum gap between requests to one host (default 200 ms). */
  gapMs?: number;
  /** First wait before retrying a 429 or 5xx; doubles per retry (default 1000 ms). */
  retryDelayMs?: number;
  signal?: AbortSignal;
}

export interface RpcClient {
  call(chainId: number, method: string, params: unknown[]): Promise<unknown>;
  /** A paced, retried GET of a JSON document (DefiLlama). */
  getJson(url: string): Promise<unknown>;
}

/** Requests to one host run one at a time, `gapMs` apart; a 429 or 5xx is retried twice with backoff. */
export function createRpcClient(opts: RpcClientOptions = {}): RpcClient {
  const doFetch = opts.fetch ?? fetch;
  const urls = opts.urls ?? DEFAULT_RPC_URLS;
  const gap = opts.gapMs ?? 200;
  const retryDelay = opts.retryDelayMs ?? 1000;
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const tails = new Map<string, Promise<unknown>>();
  const lastStart = new Map<string, number>();

  const once = async (url: string, init: RequestInit): Promise<unknown> => {
    const host = new URL(url).host;
    const wait = (lastStart.get(host) ?? 0) + gap - Date.now();
    if (wait > 0) await sleep(wait);
    lastStart.set(host, Date.now());
    const signal = AbortSignal.any([
      ...(opts.signal ? [opts.signal] : []),
      AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    ]);
    let res: Response;
    try {
      res = await doFetch(url, { ...init, signal });
    } catch (error) {
      if (opts.signal?.aborted) throw error;
      throw new RpcError(
        error instanceof Error && error.name === "TimeoutError" ? "timeout" : "unreachable",
        "request failed",
      );
    }
    if (res.status === 429) throw new RpcError("rate_limit", "HTTP 429");
    if (res.status >= 500) throw new RpcError("unreachable", `HTTP ${res.status}`);
    if (!res.ok) throw new RpcError("failed", `HTTP ${res.status}`);
    try {
      return await res.json();
    } catch {
      throw new RpcError("failed", "response was not JSON");
    }
  };

  const send = (url: string, init: RequestInit): Promise<unknown> => {
    const host = new URL(url).host;
    const run = (tails.get(host) ?? Promise.resolve()).then(async () => {
      for (let attempt = 0; ; attempt++) {
        try {
          return await once(url, init);
        } catch (error) {
          const retryable =
            error instanceof RpcError &&
            (error.kind === "rate_limit" ||
              (error.kind === "unreachable" && /^HTTP/.test(error.message)));
          if (!retryable || attempt >= MAX_RETRIES) throw error;
          await sleep(retryDelay * 2 ** attempt);
        }
      }
    });
    tails.set(
      host,
      run.catch(() => undefined),
    );
    return run;
  };

  return {
    async call(chainId, method, params) {
      const url = urls[chainId];
      if (!url) throw new RpcError("failed", "no endpoint");
      const body = await send(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const { result, error } = (body ?? {}) as { result?: unknown; error?: { message?: string } };
      if (error) {
        throw new RpcError(
          /rate|limit|too many/i.test(error.message ?? "") ? "rate_limit" : "failed",
          "RPC error",
        );
      }
      if (typeof result !== "string") throw new RpcError("failed", "unexpected response");
      return result;
    },
    getJson: (url) => send(url, {}),
  };
}

// ---- keccak-256 (needed for ENS namehash) ----

const MASK = (1n << 64n) - 1n;
const rotl = (v: bigint, n: number) =>
  n === 0 ? v : ((v << BigInt(n)) | (v >> BigInt(64 - n))) & MASK;
const ROUND_CONSTANTS: bigint[] = [];
const ROTATIONS: number[] = new Array(25).fill(0);
{
  let r = 1;
  for (let i = 0; i < 24; i++) {
    let c = 0n;
    for (let j = 0; j < 7; j++) {
      r = ((r << 1) ^ ((r >> 7) * 0x71)) % 256;
      if (r & 2) c ^= 1n << BigInt((1 << j) - 1);
    }
    ROUND_CONSTANTS.push(c);
  }
  let x = 1;
  let y = 0;
  for (let t = 0; t < 24; t++) {
    ROTATIONS[x + 5 * y] = (((t + 1) * (t + 2)) / 2) % 64;
    [x, y] = [y, (2 * x + 3 * y) % 5];
  }
}

export function keccak256(data: Uint8Array): Uint8Array {
  const rate = 136;
  const padded = new Uint8Array(Math.ceil((data.length + 1) / rate) * rate);
  padded.set(data);
  padded[data.length] = 0x01;
  padded[padded.length - 1] = (padded[padded.length - 1] as number) | 0x80;
  const a: bigint[] = new Array(25).fill(0n);
  const view = new DataView(padded.buffer);
  for (let off = 0; off < padded.length; off += rate) {
    for (let i = 0; i < rate / 8; i++)
      a[i] = (a[i] as bigint) ^ view.getBigUint64(off + i * 8, true);
    for (let round = 0; round < 24; round++) {
      const at = (i: number) => a[i] as bigint;
      const c = [0, 1, 2, 3, 4].map(
        (x) => at(x) ^ at(x + 5) ^ at(x + 10) ^ at(x + 15) ^ at(x + 20),
      );
      for (let x = 0; x < 5; x++) {
        const d = (c[(x + 4) % 5] as bigint) ^ rotl(c[(x + 1) % 5] as bigint, 1);
        for (let y = 0; y < 5; y++) a[x + 5 * y] = (a[x + 5 * y] as bigint) ^ d;
      }
      const b: bigint[] = new Array(25).fill(0n);
      for (let x = 0; x < 5; x++)
        for (let y = 0; y < 5; y++)
          b[y + 5 * ((2 * x + 3 * y) % 5)] = rotl(
            a[x + 5 * y] as bigint,
            ROTATIONS[x + 5 * y] as number,
          );
      for (let y = 0; y < 5; y++)
        for (let x = 0; x < 5; x++)
          a[x + 5 * y] =
            (b[x + 5 * y] as bigint) ^
            (~(b[((x + 1) % 5) + 5 * y] as bigint) & MASK & (b[((x + 2) % 5) + 5 * y] as bigint));
      a[0] = (a[0] as bigint) ^ (ROUND_CONSTANTS[round] as bigint);
    }
  }
  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < 4; i++) outView.setBigUint64(i * 8, a[i] as bigint, true);
  return out;
}

const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

/** ENS namehash as 64 hex characters. ponytail: lowercase only, no UTS-46 normalization. */
export function namehash(name: string): string {
  let node: Uint8Array = new Uint8Array(32);
  for (const label of name.toLowerCase().split(".").reverse()) {
    if (!label) continue;
    const joined = new Uint8Array(64);
    joined.set(node);
    joined.set(keccak256(new TextEncoder().encode(label)), 32);
    node = keccak256(joined);
  }
  return hex(node);
}

// ---- ABI by hand (a handful of fixed shapes) ----

const word = (value: bigint) => value.toString(16).padStart(64, "0");
const addressWord = (address: string) => address.slice(2).toLowerCase().padStart(64, "0");
/** Function selectors: keccak of the signature, first 4 bytes (checked in the tests). */
const SEL = {
  balanceOf: "70a08231",
  aggregate3: "82ad56cb",
  getOwners: "a0e67e2b",
  getThreshold: "e75235b8",
  resolver: "0178b8bf",
  addr: "3b3b57de",
};

/** Reads 32-byte words of a `0x` hex result. */
const words = (data: string) => {
  const body = data.startsWith("0x") ? data.slice(2) : data;
  return (i: number) => BigInt(`0x${body.slice(i * 64, i * 64 + 64) || "0"}`);
};

function encodeAggregate3(calls: Array<{ target: string; data: string }>): string {
  const elementSize = 192; // target, allowFailure, bytes offset, bytes length, 36 bytes padded to 64
  const parts = [word(0x20n), word(BigInt(calls.length))];
  for (let i = 0; i < calls.length; i++)
    parts.push(word(BigInt(calls.length * 32 + i * elementSize)));
  for (const call of calls)
    parts.push(
      addressWord(call.target),
      word(1n),
      word(0x60n),
      word(BigInt(call.data.length / 2)),
      call.data.padEnd(64 * Math.ceil(call.data.length / 64), "0"),
    );
  return `0x${SEL.aggregate3}${parts.join("")}`;
}

/** Success flags and 32-byte return values from an aggregate3 result; a failed or short call gives null. */
function decodeAggregate3(data: string, count: number): Array<bigint | null> {
  const w = words(data);
  const base = Number(w(0)) / 32; // array start (length word)
  const n = Number(w(base));
  if (n !== count) throw new RpcError("failed", "unexpected multicall result");
  const out: Array<bigint | null> = [];
  for (let i = 0; i < n; i++) {
    const el = base + 1 + Number(w(base + 1 + i)) / 32;
    const lenAt = el + Number(w(el + 1)) / 32;
    out.push(w(el) === 1n && w(lenAt) >= 32n ? w(lenAt + 1) : null);
  }
  return out;
}

// ---- reads ----

/** One balance of one wallet on one chain. `tokenAddress` is "" for the chain's native coin; `llamaKey` prices it. */
export interface CryptoSourceHolding {
  tokenAddress: string;
  symbol: string;
  name: string;
  decimals: number;
  rawBalance: string;
  usdPrice: string | null;
  llamaKey: string;
}

export interface ChainSnapshot {
  holdings: CryptoSourceHolding[];
  /** The address has contract code here, so it may be a Safe. */
  isContract: boolean;
}

export interface SafeDetails {
  owners: string[];
  threshold: number;
}

/**
 * Balances on one chain: the native coin and every listed token (plus `extra`, tokens already stored
 * for this wallet) with a non-zero balance. ponytail: only tokens in the bundled list (or already
 * stored) are seen; an unlisted token is missed by design, which also keeps spam out. Add a token
 * by regenerating the list or by storing a holding for it.
 */
export async function fetchChainSnapshot(
  rpc: RpcClient,
  chainId: number,
  address: string,
  extra: readonly TokenRow[] = [],
): Promise<ChainSnapshot> {
  const info = LLAMA[chainId];
  if (!info) throw new RpcError("failed", "unsupported chain");
  const holdings: CryptoSourceHolding[] = [];
  const [balance, code] = await Promise.all([
    rpc.call(chainId, "eth_getBalance", [address, "latest"]),
    rpc.call(chainId, "eth_getCode", [address, "latest"]),
  ]);
  const native = BigInt(balance as string);
  if (native > 0n)
    holdings.push({
      tokenAddress: "",
      symbol: info.symbol,
      name: info.name,
      decimals: 18,
      rawBalance: native.toString(),
      usdPrice: null,
      llamaKey: info.native,
    });

  const seen = new Set<string>();
  const tokens = [...(CRYPTO_TOKEN_LIST[chainId] ?? []), ...extra].filter(
    (t) => !seen.has(t[0]) && seen.add(t[0]),
  );
  for (let i = 0; i < tokens.length; i += CHUNK) {
    const chunk = tokens.slice(i, i + CHUNK);
    const result = await rpc.call(chainId, "eth_call", [
      {
        to: MULTICALL3,
        data: encodeAggregate3(
          chunk.map((t) => ({ target: t[0], data: SEL.balanceOf + addressWord(address) })),
        ),
      },
      "latest",
    ]);
    const balances = decodeAggregate3(result as string, chunk.length);
    chunk.forEach((t, j) => {
      const raw = balances[j];
      if (raw && raw > 0n)
        holdings.push({
          tokenAddress: t[0],
          symbol: t[1],
          name: t[2],
          decimals: t[3],
          rawBalance: raw.toString(),
          usdPrice: null,
          llamaKey: `${info.chain}:${t[0]}`,
        });
    });
  }
  return { holdings, isContract: (code as string).length > 2 };
}

/** A Safe's owners and threshold via two eth_calls; null when the contract does not answer like a Safe. */
export async function fetchSafeDetails(
  rpc: RpcClient,
  chainId: number,
  address: string,
): Promise<SafeDetails | null> {
  const view = async (selector: string) => {
    try {
      return (await rpc.call(chainId, "eth_call", [
        { to: address, data: `0x${selector}` },
        "latest",
      ])) as string;
    } catch (error) {
      // A revert (a JSON-RPC error) means "not a Safe"; transport problems must surface.
      if (classifyRpcError(error) === "failed") return null;
      throw error;
    }
  };
  const ownersData = await view(SEL.getOwners);
  const thresholdData = await view(SEL.getThreshold);
  if (!ownersData || !thresholdData || ownersData.length < 130) return null;
  const w = words(ownersData);
  const n = Number(w(1));
  const owners = Array.from(
    { length: n },
    (_, i) =>
      `0x${w(2 + i)
        .toString(16)
        .padStart(40, "0")}`,
  );
  const threshold = Number(words(thresholdData)(0));
  return n > 0 &&
    owners.every((o) => ADDRESS.test(o)) &&
    Number.isInteger(threshold) &&
    threshold >= 1
    ? { owners, threshold }
    : null;
}

/**
 * Lowercase address for an ENS name on Ethereum mainnet, or null when it does not resolve:
 * registry resolver(node), then the resolver's addr(node). ponytail: no CCIP-read, so names that
 * resolve off-chain are reported as not found.
 */
export async function resolveEnsName(rpc: RpcClient, name: string): Promise<string | null> {
  const node = namehash(name);
  const addressOf = async (to: string, selector: string) => {
    const out = (await rpc.call(1, "eth_call", [
      { to, data: `0x${selector}${node}` },
      "latest",
    ])) as string;
    const value = out.slice(2).slice(-40);
    return out.length >= 66 && /[1-9a-f]/.test(value) ? `0x${value}` : null;
  };
  const resolver = await addressOf(ENS_REGISTRY, SEL.resolver);
  return resolver ? addressOf(resolver, SEL.addr) : null;
}

/** USD price per whole token as a decimal string, for each key DefiLlama knows with confidence of at least 0.9. */
export async function fetchPrices(rpc: RpcClient, keys: string[]): Promise<Map<string, string>> {
  const prices = new Map<string, string>();
  if (keys.length === 0) return prices;
  const body = (await rpc.getJson(
    `https://coins.llama.fi/prices/current/${[...new Set(keys)].join(",")}`,
  )) as { coins?: Record<string, { price?: number; confidence?: number }> };
  for (const [key, coin] of Object.entries(body.coins ?? {}))
    if (
      typeof coin.price === "number" &&
      coin.price > 0 &&
      (coin.confidence ?? 0) >= MIN_CONFIDENCE
    )
      prices.set(key.toLowerCase(), String(coin.price));
  return prices;
}

export const CRYPTO_CHAIN_IDS: number[] = CRYPTO_CHAINS.map((c) => c.id);
