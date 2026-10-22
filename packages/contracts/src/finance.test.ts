import { describe, expect, it } from "vitest";
import {
  CRYPTO_CHAINS,
  CRYPTO_MCP_ENDPOINT,
  CRYPTO_READ_TOOLS,
  CryptoHoldingSchema,
  FINANCE_MCP_ENDPOINTS,
  FINANCE_READ_TOOLS,
  FinanceWalletAddInputSchema,
  financeAgentSpawnKey,
  financeProviderForEndpoint,
  isCryptoEndpoint,
  isFinanceAgentSpawnKey,
  SAFE_READ_TOOLS,
} from "./finance.js";

describe("financeProviderForEndpoint", () => {
  it("matches the vendor endpoints by https host", () => {
    expect(financeProviderForEndpoint(FINANCE_MCP_ENDPOINTS.mercury)).toBe("mercury");
    expect(financeProviderForEndpoint(FINANCE_MCP_ENDPOINTS.brex)).toBe("brex");
    expect(financeProviderForEndpoint("https://mcp.mercury.com/other")).toBe("mercury");
  });
  it("rejects other hosts, plain http and junk", () => {
    expect(financeProviderForEndpoint("https://mcp.mercury.com.evil.test/mcp")).toBeNull();
    expect(financeProviderForEndpoint("http://mcp.mercury.com/mcp")).toBeNull();
    expect(financeProviderForEndpoint("not a url")).toBeNull();
    expect(financeProviderForEndpoint(null)).toBeNull();
  });
});

describe("finance agent spawn key", () => {
  it("is recognized by prefix", () => {
    expect(financeAgentSpawnKey("u1")).toBe("finance-agent:u1");
    expect(isFinanceAgentSpawnKey("finance-agent:u1")).toBe(true);
    expect(isFinanceAgentSpawnKey("inbox-agent:u1")).toBe(false);
    expect(isFinanceAgentSpawnKey(null)).toBe(false);
  });
});

describe("crypto contracts", () => {
  const wallet = "0x000000000000000000000000000000000000dead";
  it("matches the Blockscout endpoint by https host and keeps it out of the cash providers", () => {
    expect(isCryptoEndpoint(CRYPTO_MCP_ENDPOINT)).toBe(true);
    expect(isCryptoEndpoint("http://mcp.blockscout.com/mcp")).toBe(false);
    expect(isCryptoEndpoint("https://mcp.blockscout.com.evil.test/mcp")).toBe(false);
    expect(isCryptoEndpoint(null)).toBe(false);
    expect(financeProviderForEndpoint(CRYPTO_MCP_ENDPOINT)).toBeNull();
  });
  it("lists only read tools", () => {
    expect(CRYPTO_READ_TOOLS).toContain("get_tokens_by_address");
    expect(CRYPTO_READ_TOOLS).toContain("get_token_transfers_by_address");
    expect(CRYPTO_READ_TOOLS).toContain("get_transactions_by_address");
    expect(CRYPTO_READ_TOOLS.length).toBe(7);
  });
  it("accepts a wallet add by address or ENS and rejects an unknown type", () => {
    expect(FinanceWalletAddInputSchema.parse({ addressOrEns: wallet, type: "safe" }).type).toBe(
      "safe",
    );
    expect(
      FinanceWalletAddInputSchema.safeParse({ addressOrEns: "a.eth", type: "bank" }).success,
    ).toBe(false);
    expect(
      FinanceWalletAddInputSchema.safeParse({ addressOrEns: "  ", type: "personal" }).success,
    ).toBe(false);
  });
  it("keeps balances as digit strings", () => {
    const base = {
      walletId: "w1",
      chainId: 1,
      tokenAddress: null,
      symbol: "ETH",
      name: "Ether",
      decimals: 18,
      usdPrice: null,
      usdValueCents: null,
      syncedAt: "2026-10-16T10:00:00.000Z",
    };
    expect(
      CryptoHoldingSchema.safeParse({ ...base, rawBalance: "1000000000000000000000" }).success,
    ).toBe(true);
    expect(CryptoHoldingSchema.safeParse({ ...base, rawBalance: "1.5" }).success).toBe(false);
  });
  it("tracks the five owner-approved chains", () => {
    expect(CRYPTO_CHAINS.map((c) => c.id)).toEqual([1, 8453, 42161, 10, 137]);
  });
});

describe("SAFE_READ_TOOLS", () => {
  it("lists only Mercury read tools, none of them a write", () => {
    expect(SAFE_READ_TOOLS.mercury).toEqual(["getSafeRequests", "getSafeRequest"]);
    for (const name of SAFE_READ_TOOLS.mercury) expect(name).toMatch(/^get/);
  });
  it("keeps SAFE tools out of the finance list", () => {
    for (const tools of Object.values(FINANCE_READ_TOOLS))
      for (const name of SAFE_READ_TOOLS.mercury)
        expect(tools as readonly string[]).not.toContain(name);
  });
});
