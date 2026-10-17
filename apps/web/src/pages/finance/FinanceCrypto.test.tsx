// @vitest-environment jsdom

import type { FinanceCryptoOutput } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({ t: text }));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: text, i18n: { locale: "en" } }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
const rpcMock = vi.hoisted(() => ({
  crypto: vi.fn(),
  cryptoHistory: vi.fn(),
  exchanges: vi.fn(),
  exchangeRemove: vi.fn(),
  walletAdd: vi.fn(),
  walletUpdate: vi.fn(),
  walletRemove: vi.fn(),
  cryptoConnect: vi.fn(),
}));
vi.mock("../../lib/rpc", () => ({ rpc: { finance: rpcMock } }));

import { FinanceCryptoPage } from "./FinanceCrypto";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SAFE = "0x1111111111111111111111111111111111111111";
const EOA = "0x2222222222222222222222222222222222222222";
const data = (over: Partial<FinanceCryptoOutput> = {}): FinanceCryptoOutput => ({
  connected: true,
  hasApiKey: false,
  lastError: null,
  alchemy: { connected: false, lastError: null },
  wallets: [
    {
      id: "w1",
      address: SAFE,
      ensName: null,
      label: "Treasury",
      type: "safe",
      safeOwners: [EOA, SAFE, "0x3333333333333333333333333333333333333333"],
      safeThreshold: 2,
    },
    {
      id: "w2",
      address: EOA,
      ensName: "alice.eth",
      label: null,
      type: "personal",
      safeOwners: null,
      safeThreshold: null,
    },
  ],
  holdings: [
    {
      walletId: "w1",
      chainId: 1,
      tokenAddress: null,
      symbol: "ETH",
      name: "Ether",
      decimals: 18,
      rawBalance: "1500000000000000000",
      usdPrice: "2000",
      usdValueCents: 300_000,
      syncedAt: "2026-10-14T10:00:00.000Z",
    },
    {
      walletId: "w2",
      chainId: 8453,
      tokenAddress: "0x4444444444444444444444444444444444444444",
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      rawBalance: "2500000",
      usdPrice: "1",
      usdValueCents: 250,
      syncedAt: "2026-10-14T10:00:00.000Z",
    },
  ],
  summary: {
    totalCents: 300_250,
    byChain: [
      { chainId: 1, cents: 300_000 },
      { chainId: 8453, cents: 250 },
    ],
    byWallet: [
      { walletId: "w1", cents: 300_000 },
      { walletId: "w2", cents: 250 },
    ],
    lastSyncedAt: "2026-10-14T10:00:00.000Z",
    unpricedTokenCount: 1,
  },
  ...over,
});

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const flush = () => act(async () => {});
async function show() {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <FinanceCryptoPage />
      </MemoryRouter>,
    ),
  );
  await flush();
}
/** The field a visible label names, as a user finds it. */
const byLabel = (label: string) => {
  const found = [...document.body.querySelectorAll("label")].find((l) => l.textContent === label);
  return document.getElementById(found?.htmlFor ?? "") as HTMLInputElement;
};
beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  rpcMock.cryptoHistory.mockResolvedValue({ points: [] });
  rpcMock.exchanges.mockResolvedValue([]);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.resetAllMocks();
});

it("renders totals, wallets, chains and holdings from the data", async () => {
  rpcMock.crypto.mockResolvedValue(data());
  await show();
  const page = container.textContent ?? "";
  // Totals are whole dollars like the other balances; a token's own value keeps its cents.
  expect(page).toContain("$3,003");
  expect(page).not.toContain("$3,002.50");
  expect(page).toContain("1 unpriced");
  expect(page).toContain("Treasury");
  expect(page).toContain("Safe · 2 of 3");
  expect(page).toContain("alice.eth");
  expect(page).toContain("Ethereum");
  expect(page).toContain("Base");
  expect(page).toContain("1.5");
  expect(page).toContain("$3,000.00");
  expect(page).toContain("2.5");
  expect(page).toContain("Updated");
  expect(container.querySelector('[role="alert"]')).toBeNull();
});

const points = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    day: `2026-10-${String(i + 1).padStart(2, "0")}`,
    stablecoinCents: 1_000_00 + i * 100_00,
    otherCryptoCents: 2_000_00,
  }));

it("charts crypto balance over time from 2 or more daily points", async () => {
  rpcMock.crypto.mockResolvedValue(data());
  rpcMock.cryptoHistory.mockResolvedValue({ points: points(3) });
  await show();
  expect(rpcMock.cryptoHistory).toHaveBeenCalledWith({ days: 90 });
  expect(container.textContent).toContain("Balance over time");
});

it("shows no history chart with fewer than 2 points", async () => {
  rpcMock.crypto.mockResolvedValue(data());
  rpcMock.cryptoHistory.mockResolvedValue({ points: points(1) });
  await show();
  expect(container.textContent).not.toContain("Balance over time");
});

it("reloads the balance history after removing a wallet", async () => {
  rpcMock.crypto.mockResolvedValue(data());
  rpcMock.walletRemove.mockResolvedValue({});
  await show();
  expect(rpcMock.cryptoHistory).toHaveBeenCalledTimes(1);
  await act(async () =>
    (container.querySelector('[aria-label="Actions for Treasury"]') as HTMLElement).click(),
  );
  await act(async () =>
    (
      [...document.body.querySelectorAll('[role="menuitem"]')].find(
        (i) => i.textContent === "Remove",
      ) as HTMLElement
    ).click(),
  );
  await act(async () =>
    (
      [...document.body.querySelectorAll("button")].find(
        (b) => b.textContent === "Remove",
      ) as HTMLElement
    ).click(),
  );
  await flush();
  expect(rpcMock.walletRemove).toHaveBeenCalledWith({ id: "w1" });
  expect(rpcMock.cryptoHistory).toHaveBeenCalledTimes(2);
});

it("shows the sync error only when there is one", async () => {
  rpcMock.crypto.mockResolvedValue(data({ lastError: "Rate limited" }));
  await show();
  expect(container.querySelector('[role="alert"]')?.textContent).toBe("Rate limited");
});

it("shows the server's error inline when adding a wallet fails", async () => {
  rpcMock.crypto.mockResolvedValue(data({ wallets: [], holdings: [] }));
  rpcMock.walletAdd.mockRejectedValue(new Error("That wallet is already added"));
  await show();
  await act(async () =>
    (
      [...container.querySelectorAll("button")].find(
        (b) => b.textContent === "Add wallet",
      ) as HTMLElement
    ).click(),
  );
  const input = byLabel("Address or ENS");
  await act(async () => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    set?.call(input, "alice.eth");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    (document.body.querySelector('button[type="submit"]') as HTMLButtonElement).click();
  });
  await flush();
  expect(rpcMock.walletAdd).toHaveBeenCalledWith({ addressOrEns: "alice.eth", type: "personal" });
  expect(document.body.querySelector('[role="alert"]')?.textContent).toContain("already added");
});

it("does not ask for a Blockscout key on the Crypto page; balances need none", async () => {
  rpcMock.crypto.mockResolvedValue(data({ connected: true, hasApiKey: false }));
  await show();
  expect(container.textContent).not.toContain("Blockscout");
  expect(container.textContent).not.toContain("API key");
});

it("asks a founder with no wallet to add one, not to connect Blockscout first", async () => {
  rpcMock.crypto.mockResolvedValue(data({ connected: false, hasApiKey: false, wallets: [] }));
  await show();
  expect(
    [...container.querySelectorAll("button")].some((b) => /Blockscout/.test(b.textContent ?? "")),
  ).toBe(false);
  expect(container.textContent).toContain("Add a wallet address");
});

it("says there are no wallets yet instead of an empty Wallets card", async () => {
  rpcMock.crypto.mockResolvedValue(data({ wallets: [] }));
  await show();
  expect(container.textContent).toContain("No wallets yet.");
});

it("shows each exchange as its own group and reloads everything after removing one", async () => {
  rpcMock.crypto.mockResolvedValue(data());
  rpcMock.exchanges.mockResolvedValue([
    {
      id: "x1",
      provider: "kraken",
      connected: true,
      lastSyncedAt: "2026-10-15T12:00:00.000Z",
      lastError: "Kraken rate limit reached, try again shortly",
      totalCents: 25_000,
      balances: [
        { asset: "BTC", amount: "0.004", usdPrice: "50000", usdValueCents: 20_000 },
        { asset: "ZZZ", amount: "5", usdPrice: null, usdValueCents: null },
      ],
    },
  ]);
  rpcMock.exchangeRemove.mockResolvedValue({ ok: true });
  await show();
  const page = container.textContent ?? "";
  expect(page).toContain("Kraken");
  expect(page).toContain("0.004");
  expect(page).toContain("$200.00");
  expect(page).toContain("$250");
  expect(page).not.toContain("$250.00");
  expect(page).toContain("rate limit reached");
  expect(rpcMock.exchanges).toHaveBeenCalledTimes(1);
  await act(async () => {
    (document.body.querySelector('[aria-label="Actions for Kraken"]') as HTMLElement).click();
  });
  await flush();
  await act(async () => {
    (
      [...document.body.querySelectorAll('[role="menuitem"]')].find(
        (n) => n.textContent === "Remove",
      ) as HTMLElement
    ).click();
  });
  await flush();
  await act(async () => {
    (
      [...document.body.querySelectorAll("button")]
        .filter((b) => b.textContent === "Remove")
        .at(-1) as HTMLElement
    ).click();
  });
  await flush();
  expect(rpcMock.exchangeRemove).toHaveBeenCalledWith({ id: "x1" });
  expect(rpcMock.exchanges).toHaveBeenCalledTimes(2);
});

it("shows wallet-only totals in the Wallets section when exchanges add to the summary", async () => {
  const base = data();
  rpcMock.crypto.mockResolvedValue(
    data({
      summary: {
        ...base.summary,
        totalCents: base.summary.totalCents + 25_000,
        unpricedTokenCount: base.summary.unpricedTokenCount + 3,
      },
    }),
  );
  rpcMock.exchanges.mockResolvedValue([
    {
      id: "x1",
      provider: "kraken",
      connected: true,
      lastSyncedAt: null,
      lastError: null,
      totalCents: 25_000,
      balances: [1, 2, 3].map((n) => ({
        asset: `Z${n}`,
        amount: "1",
        usdPrice: null,
        usdValueCents: null,
      })),
    },
  ]);
  await show();
  const heading = [...container.querySelectorAll("h2")].find((h) => h.textContent === "Wallets");
  const wallets = heading?.parentElement?.parentElement;
  expect(wallets?.textContent).toContain("$3,003");
  expect(wallets?.textContent).not.toContain("$3,253");
  expect(wallets?.textContent).toContain("1 unpriced");
  expect(wallets?.textContent).not.toContain("4 unpriced");
});

it("leaves out the Chains card when every holding is on one chain", async () => {
  const base = data();
  rpcMock.crypto.mockResolvedValue({
    ...base,
    summary: { ...base.summary, byChain: [{ chainId: 1, cents: 300_250 }] },
  });
  await show();
  expect([...container.querySelectorAll("h2")].map((h) => h.textContent)).not.toContain("Chains");
});
