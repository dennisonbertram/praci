// @vitest-environment jsdom

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
  accounts: vi.fn(),
  crypto: vi.fn(),
  exchanges: vi.fn(),
  walletAdd: vi.fn(),
}));
vi.mock("../../lib/rpc", () => ({ rpc: { finance: rpcMock } }));

import { FinanceAccountsPage } from "./FinanceAccounts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ADDRESS = "0x2222222222222222222222222222222222222222";
const crypto = {
  connected: true,
  hasApiKey: false,
  lastError: null,
  wallets: [
    {
      id: "w1",
      address: ADDRESS,
      ensName: "alice.eth",
      label: null,
      type: "personal",
      safeOwners: null,
      safeThreshold: null,
    },
  ],
  holdings: [],
  summary: {
    totalCents: 987_654_00,
    byChain: [],
    byWallet: [{ walletId: "w1", cents: 987_654_00 }],
    lastSyncedAt: null,
    unpricedTokenCount: 0,
  },
};
const accounts = {
  totalCashCents: 7_500_000,
  cardOwedCents: null,
  history: [],
  cash: [
    {
      id: "a1",
      name: "Checking",
      lastFour: "0002",
      balanceCents: 7_500_000,
      annualYieldPct: null,
    },
  ],
  cards: [],
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const flush = () => act(async () => {});
beforeEach(async () => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  rpcMock.accounts.mockResolvedValue(accounts);
  rpcMock.crypto.mockResolvedValue(crypto);
  rpcMock.exchanges.mockResolvedValue([
    {
      id: "x1",
      provider: "kraken",
      connected: true,
      lastSyncedAt: "2026-10-15T12:00:00.000Z",
      lastError: null,
      totalCents: 25_000,
      balances: [],
    },
  ]);
  await act(async () =>
    root.render(
      <MemoryRouter>
        <FinanceAccountsPage />
      </MemoryRouter>,
    ),
  );
  await flush();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.resetAllMocks();
});

it("lists wallets in their own Crypto group and keeps them out of total cash", () => {
  const page = container.textContent ?? "";
  expect(page).toContain("Crypto");
  expect(page).toContain("alice.eth");
  expect(page).toContain("$987,654.00");
  expect(container.querySelector('a[href="/app/finance/crypto"]')?.textContent).toBe("alice.eth");
  const total = [...container.querySelectorAll("h2")].find((h) => h.textContent === "Total cash");
  expect(total?.nextElementSibling?.textContent).toBe("$75,000");
  expect(page).not.toContain("$1,062,654");
});

it("lists connected exchanges in the Crypto group, outside total cash", () => {
  const row = [...container.querySelectorAll("tr")].find((r) => r.textContent?.includes("Kraken"));
  expect(row?.textContent).toContain("$250.00");
  expect(container.textContent).not.toContain("$75,250");
});

it("opens the Add wallet dialog from the Add account menu", async () => {
  expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  const trigger = [...container.querySelectorAll("button")].find(
    (b) => b.textContent === "Add account",
  );
  await act(async () => {
    trigger?.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    trigger?.click();
  });
  const items = [...document.body.querySelectorAll('[role="menuitem"]')];
  expect(items.map((i) => i.textContent)).toEqual(["Crypto wallet", "Coinbase", "Kraken"]);
  await act(async () => (items[0] as HTMLElement).click());
  expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain("Add wallet");
});
