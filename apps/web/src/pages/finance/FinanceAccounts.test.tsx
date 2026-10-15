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
  walletAdd: vi.fn(),
  preferences: vi.fn(),
  setPreferences: vi.fn(),
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
async function show(scope: "bank" | "stablecoins" | "all" = "bank", cryptoData = crypto) {
  rpcMock.accounts.mockResolvedValue(accounts);
  rpcMock.crypto.mockResolvedValue(cryptoData);
  rpcMock.preferences.mockResolvedValue({ runwayCrypto: scope });
  await act(async () =>
    root.render(
      <MemoryRouter>
        <FinanceAccountsPage />
      </MemoryRouter>,
    ),
  );
  await flush();
}
beforeEach(async () => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await show();
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
  expect(items.map((i) => i.textContent)).toEqual(["Crypto wallet"]);
  await act(async () => (items[0] as HTMLElement).click());
  expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain("Add wallet");
});

const toggle = () => container.querySelector("button[aria-pressed]") as HTMLButtonElement | null;
const subtitle = () =>
  [...container.querySelectorAll("h2")].find((h) => h.textContent === "Total cash")
    ?.nextElementSibling?.nextElementSibling?.textContent;

it("offers Count crypto, off under the bank scope, and keeps the plain subtitle", () => {
  expect(toggle()?.textContent).toBe("Count crypto");
  expect(subtitle()).toBe("Checking + Savings + Treasury");
});

it("adds Stablecoins or Crypto to the subtitle when they count", async () => {
  await act(async () => root.unmount());
  root = createRoot(container);
  await show("stablecoins");
  expect(toggle()?.textContent).toBe("Counting crypto");
  expect(subtitle()).toBe("Checking + Savings + Treasury + Stablecoins");
  await act(async () => root.unmount());
  root = createRoot(container);
  await show("all");
  expect(subtitle()).toBe("Checking + Savings + Treasury + Crypto");
});

it("saves the scope and reloads accounts and the scope", async () => {
  rpcMock.setPreferences.mockResolvedValue({ runwayCrypto: "all" });
  await act(async () => toggle()?.click());
  await flush();
  expect(rpcMock.setPreferences).toHaveBeenCalledWith({ runwayCrypto: "all" });
  expect(rpcMock.accounts).toHaveBeenCalledTimes(2);
  expect(rpcMock.preferences).toHaveBeenCalledTimes(2);
});

it("hides the button when no crypto is held", async () => {
  await act(async () => root.unmount());
  root = createRoot(container);
  await show("bank", { ...crypto, wallets: [], summary: { ...crypto.summary, totalCents: 0 } });
  expect(toggle()).toBeNull();
});

it("reloads accounts after a wallet is added, since crypto can count in total cash", async () => {
  rpcMock.walletAdd.mockResolvedValue({});
  await act(async () =>
    (
      [...container.querySelectorAll("button")].find(
        (b) => b.textContent === "Add account",
      ) as HTMLElement
    ).dispatchEvent(new MouseEvent("pointerdown", { bubbles: true })),
  );
  await act(async () =>
    (
      [...container.querySelectorAll("button")].find(
        (b) => b.textContent === "Add account",
      ) as HTMLElement
    ).click(),
  );
  await act(async () =>
    ([...document.body.querySelectorAll('[role="menuitem"]')][0] as HTMLElement).click(),
  );
  const input = document.body.querySelector('[aria-label="Address or ENS"]') as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(
      input,
      "alice.eth",
    );
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () =>
    (document.body.querySelector('button[type="submit"]') as HTMLButtonElement).click(),
  );
  await flush();
  expect(rpcMock.walletAdd).toHaveBeenCalled();
  expect(rpcMock.accounts).toHaveBeenCalledTimes(2);
});

const mixed = {
  ...accounts,
  cardOwedCents: 120_000,
  cash: [{ ...accounts.cash[0], provider: "mercury" }],
  cards: [
    {
      id: "c1",
      provider: "brex",
      name: "Brex Card",
      lastFour: "9",
      balanceCents: 120_000,
      annualYieldPct: null,
    },
  ],
};
async function showSource(source: "mercury" | "brex" | null) {
  rpcMock.accounts.mockResolvedValue(mixed);
  await act(async () => root.unmount());
  root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter>
        <FinanceAccountsPage source={source} />
      </MemoryRouter>,
    ),
  );
  await flush();
}
const rows = () =>
  [...container.querySelectorAll("tbody td.font-semibold")].map((td) => td.textContent);

it("shows only the source's accounts, for cash and for cards", async () => {
  await showSource("brex");
  expect(rows().join(" ")).toContain("Brex Card");
  expect(rows().join(" ")).not.toContain("Checking");
  await showSource("mercury");
  expect(rows().join(" ")).toContain("Checking");
  expect(rows().join(" ")).not.toContain("Brex Card");
});

it("clears the filter from the chip near the title, and shows everything with no source", async () => {
  await showSource("mercury");
  const clear = container.querySelector('a[aria-label="Clear Mercury filter"]');
  expect(clear?.textContent).toBe("Mercury ×");
  expect(clear?.getAttribute("href")).toBe("/app/finance/accounts");
  await showSource(null);
  expect(container.querySelector('a[aria-label^="Clear"]')).toBeNull();
  expect(rows().join(" ")).toContain("Checking");
  expect(rows().join(" ")).toContain("Brex Card");
});
