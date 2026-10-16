import { DEFAULT_RPC_URLS, namehash } from "./rpc-crypto-source.js";

/** An offline JSON-RPC and DefiLlama fake for tests. Every address and amount is made up. */

export const WALLET_A = "0x1111111111111111111111111111111111111111";
export const WALLET_B = "0x2222222222222222222222222222222222222222";
export const SAFE_WALLET = "0x3333333333333333333333333333333333333333";
export const OWNER_1 = "0x4444444444444444444444444444444444444444";
export const OWNER_2 = "0x5555555555555555555555555555555555555555";
/** Not in the bundled token list: only found when a holding for it is already stored. */
export const TOKEN_UNLISTED = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

export interface FakeChain {
  /** Native balances by holder. */
  balances?: Record<string, bigint>;
  /** Token balances: token -> holder -> raw balance. */
  tokens?: Record<string, Record<string, bigint>>;
  /** Contract addresses (eth_getCode is non-empty). */
  contracts?: string[];
  /** HTTP statuses returned, in order, before requests succeed. */
  statuses?: number[];
  /** Every request gets this HTTP status. */
  alwaysStatus?: number;
}

export interface FakeWorld {
  chains?: Record<number, FakeChain>;
  prices?: Record<string, { price: number; confidence: number }>;
  priceStatus?: number;
  safe?: { owners: string[]; threshold: number };
  /** ENS name -> address, resolved on chain 1. */
  ens?: Record<string, string>;
}

const word = (v: bigint) => v.toString(16).padStart(64, "0");
const addrWord = (a: string) => a.slice(2).toLowerCase().padStart(64, "0");
const MULTICALL = "0xca11bde05977b3631167028862be2a173976ca11";
const REGISTRY = "0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e";
const RESOLVER = "0x9999999999999999999999999999999999999999";

export function fakeRpc(world: FakeWorld = {}) {
  const calls: string[] = [];
  const chainOfHost = new Map(
    Object.entries(DEFAULT_RPC_URLS).map(([id, url]) => [new URL(url).host, Number(id)]),
  );
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.host === "coins.llama.fi") {
      calls.push("prices");
      if (world.priceStatus) return reply({}, world.priceStatus);
      const wanted = decodeURIComponent(url.pathname.split("/").pop() ?? "").split(",");
      return reply({
        coins: Object.fromEntries(
          wanted.filter((k) => world.prices?.[k]).map((k) => [k, world.prices?.[k]]),
        ),
      });
    }
    const chainId = chainOfHost.get(url.host) as number;
    const chain = world.chains?.[chainId] ?? {};
    const { method, params, id } = JSON.parse(String(init?.body));
    calls.push(`${chainId}:${method}`);
    const status = chain.alwaysStatus ?? chain.statuses?.shift();
    if (status) return reply({}, status);
    const ok = (result: string) => reply({ jsonrpc: "2.0", id, result });
    const revert = () =>
      reply({ jsonrpc: "2.0", id, error: { code: 3, message: "execution reverted" } });
    if (method === "eth_getBalance")
      return ok(`0x${(chain.balances?.[params[0]] ?? 0n).toString(16)}`);
    if (method === "eth_getCode") return ok(chain.contracts?.includes(params[0]) ? "0x6080" : "0x");
    const { to, data } = params[0] as { to: string; data: string };
    const selector = data.slice(2, 10);
    if (to === MULTICALL) {
      // aggregate3: each element holds target (word 0) and callData (balanceOf selector + holder word).
      const body = data.slice(10);
      const n = Number.parseInt(body.slice(64, 128), 16);
      const results = Array.from({ length: n }, (_, i) => {
        const start = (2 + n) * 64 + i * 192 * 2;
        const target = `0x${body.slice(start + 24, start + 64)}`;
        const holder = `0x${body.slice(start + 64 * 4 + 8 + 24, start + 64 * 4 + 8 + 64)}`;
        return chain.tokens?.[target]?.[holder] ?? 0n;
      });
      return ok(
        `0x${word(0x20n)}${word(BigInt(n))}${results.map((_, i) => word(BigInt(n * 32 + i * 128))).join("")}${results
          .map((r) => word(1n) + word(0x40n) + word(32n) + word(r))
          .join("")}`,
      );
    }
    if (to === REGISTRY && selector === "0178b8bf") {
      const known = Object.keys(world.ens ?? {}).some((name) => data.endsWith(namehash(name)));
      return ok(`0x${addrWord(known ? RESOLVER : "0x0")}`);
    }
    if (to === RESOLVER && selector === "3b3b57de") {
      const name = Object.keys(world.ens ?? {}).find((n) => data.endsWith(namehash(n)));
      return ok(`0x${addrWord(name ? (world.ens?.[name] as string) : "0x0")}`);
    }
    if (world.safe && chain.contracts?.includes(to)) {
      if (selector === "a0e67e2b")
        return ok(
          `0x${word(0x20n)}${word(BigInt(world.safe.owners.length))}${world.safe.owners.map(addrWord).join("")}`,
        );
      if (selector === "e75235b8") return ok(`0x${word(BigInt(world.safe.threshold))}`);
    }
    return revert();
  }) as typeof fetch;
  return { fetch: fetchFn, calls };
}
