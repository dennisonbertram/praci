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
vi.mock("@lingui/core/macro", () => ({
  t: text,
  plural: (n: number, forms: { one: string; other: string }) =>
    (n === 1 ? forms.one : forms.other).replace("#", String(n)),
}));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: text, i18n: { locale: "en" } }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
const rpcMock = vi.hoisted(() => ({
  accounts: vi.fn(),
  account: vi.fn(),
  crypto: vi.fn(),
  exchanges: vi.fn(),
  walletAdd: vi.fn(),
  preferences: vi.fn(),
  balanceSeries: vi.fn(),
  overview: vi.fn(),
  setPreferences: vi.fn(),
  statementAccountRename: vi.fn(),
  spend: vi.fn(),
}));
vi.mock("../../lib/rpc", () => ({ rpc: { finance: rpcMock } }));

import { FinanceAccountPage, FinanceAccountsPage } from "./FinanceAccounts";

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
  rpcMock.overview.mockResolvedValue({ sources: [] });
  rpcMock.balanceSeries.mockImplementation(async ({ range }: { range: string }) => ({
    range,
    points: [
      { day: "2026-09-30", balanceCents: 7_000_000 },
      { day: "2026-10-14", balanceCents: 7_500_000 },
    ],
  }));
  rpcMock.crypto.mockResolvedValue(cryptoData);
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
  rpcMock.spend.mockResolvedValue({ totalCents: 0 });
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
  // Rounded to whole dollars like every other balance on the page.
  expect(page).toContain("$987,654");
  expect(page).not.toContain("$987,654.00");
  expect(container.querySelector('a[href="/app/finance/crypto"]')?.textContent).toBe("alice.eth");
  const total = [...container.querySelectorAll("h2")].find((h) => h.textContent === "Total cash");
  expect(total?.nextElementSibling?.textContent).toBe("$75,000");
  expect(page).not.toContain("$1,062,654");
});

it("lists connected exchanges in the Crypto group, outside total cash", () => {
  const row = [...container.querySelectorAll("tr")].find((r) => r.textContent?.includes("Kraken"));
  expect(row?.textContent).toContain("$250");
  expect(row?.textContent).not.toContain("$250.00");
  expect(container.textContent).not.toContain("$75,250");
});

const clickButton = (label: string, scope: ParentNode = document.body) =>
  act(async () =>
    (
      [...scope.querySelectorAll("button")].find((b) => b.textContent === label) as HTMLElement
    ).click(),
  );

it("opens the Add account modal and reaches the Add wallet dialog through Wallet", async () => {
  expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  await clickButton("Add account", container);
  expect(document.body.querySelector('[role="menu"]')).toBeNull();
  const dialog = () => document.body.querySelector('[role="dialog"]');
  const titles = () =>
    [...(dialog()?.querySelectorAll("[data-option-title]") ?? [])].map((n) => n.textContent);
  expect(titles()).toEqual([
    "Mercury",
    "Brex",
    "Upload statements",
    "Wallet",
    "Coinbase",
    "Kraken",
  ]);
  await act(async () =>
    (
      [...(dialog()?.querySelectorAll("button") ?? [])].find(
        (b) => b.querySelector("[data-option-title]")?.textContent === "Wallet",
      ) as HTMLElement
    ).click(),
  );
  expect(dialog()?.textContent).toContain("Add wallet");
});

const toggle = () =>
  [...container.querySelectorAll("button")].find((b) =>
    /^(Count crypto|Counting)/.test(b.textContent ?? ""),
  ) as HTMLButtonElement | undefined;
const subtitle = () =>
  [...container.querySelectorAll("h2")].find((h) => h.textContent === "Total cash")
    ?.nextElementSibling?.nextElementSibling?.textContent;

it("offers Count crypto, off under the bank scope, and keeps the plain subtitle", () => {
  expect(toggle()?.textContent).toBe("Count crypto");
  expect(subtitle()).toBe("1 bank account");
});

it("adds Stablecoins or Crypto to the subtitle when they count", async () => {
  await act(async () => root.unmount());
  root = createRoot(container);
  await show("stablecoins");
  expect(toggle()?.textContent).toBe("Counting stablecoins");
  expect(subtitle()).toBe("1 bank account + stablecoins");
  await act(async () => root.unmount());
  root = createRoot(container);
  await show("all");
  expect(subtitle()).toBe("1 bank account + crypto");
});

it("narrows the cash total to the chosen source and says Brex does not share the card balance", async () => {
  await act(async () => root.unmount());
  root = createRoot(container);
  rpcMock.accounts.mockResolvedValue({
    ...accounts,
    totalCashCents: 7_530_000,
    cash: [
      ...accounts.cash.map((a) => ({ ...a, provider: "mercury" })),
      {
        id: "a2",
        provider: "brex",
        name: "Acme business account",
        lastFour: null,
        balanceCents: 30_000,
        annualYieldPct: null,
      },
    ],
  });
  await act(async () =>
    root.render(
      <MemoryRouter>
        <FinanceAccountsPage source="brex" />
      </MemoryRouter>,
    ),
  );
  await flush();
  const kpi = (title: string) =>
    [...container.querySelectorAll("h2")].find((h) => h.textContent === title)?.parentElement
      ?.textContent;
  expect(kpi("Brex cash")).toContain("$300");
  expect(kpi("Brex cash")).toContain("1 bank account");
  expect(container.textContent).not.toContain("$75,300");
  expect(kpi("Card balance owed")).toContain("Brex does not share it");
});

it("shows an account's last four digits once when its name already ends with them", async () => {
  await act(async () => root.unmount());
  root = createRoot(container);
  rpcMock.accounts.mockResolvedValue({
    ...accounts,
    cash: [{ ...accounts.cash[0], name: "MOCK Checking ••0002" }],
  });
  await act(async () =>
    root.render(
      <MemoryRouter>
        <FinanceAccountsPage />
      </MemoryRouter>,
    ),
  );
  await flush();
  expect(container.textContent?.match(/••0002/g)).toHaveLength(1);
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
  expect(toggle()).toBeUndefined();
});

it("reloads accounts after a wallet is added, since crypto can count in total cash", async () => {
  rpcMock.walletAdd.mockResolvedValue({});
  await clickButton("Add account", container);
  await act(async () =>
    (
      [...document.body.querySelectorAll('[role="dialog"] button')].find(
        (b) => b.querySelector("[data-option-title]")?.textContent === "Wallet",
      ) as HTMLElement
    ).click(),
  );
  const label = [...document.body.querySelectorAll("label")].find(
    (l) => l.textContent === "Address or ENS",
  );
  const input = document.getElementById(label?.htmlFor ?? "") as HTMLInputElement;
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
  rpcMock.balanceSeries.mockResolvedValue({ range: "year", points: [] });
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
  rpcMock.spend.mockResolvedValue({ totalCents: 2_287_100 });
  await showSource("brex");
  expect(rows().join(" ")).toContain("Brex Card");
  expect(rows().join(" ")).not.toContain("Checking");
  // A wallet is not a Brex account, and Brex's own spend is one click away.
  expect(container.textContent).not.toContain("alice.eth");
  expect(container.textContent).not.toContain("Count crypto");
  expect(rpcMock.spend).toHaveBeenCalledWith({ period: "month", source: "brex" });
  const spend = [...container.querySelectorAll("a")].find((a) =>
    a.textContent?.startsWith("Brex spend"),
  );
  expect(spend?.textContent).toContain("$22,871");
  expect(spend?.getAttribute("href")).toBe("/app/finance/spend?period=month&source=brex");
  await showSource("mercury");
  expect(rows().join(" ")).toContain("Checking");
  expect(rows().join(" ")).not.toContain("Brex Card");
});

it("clears the filter from the chip near the title, and shows everything with no source", async () => {
  await showSource("mercury");
  const clear = container.querySelector('a[aria-label="Clear Mercury filter"]');
  expect(clear?.textContent).toBe("Mercury ×");
  expect(clear?.getAttribute("href")).toBe("/app/finance/accounts");
  // The all-accounts chart would contradict the filtered figure, so it waits for the filter to clear.
  expect(container.textContent).not.toContain("Total balance");
  await showSource(null);
  expect(container.textContent).toContain("Total balance");
  expect(container.querySelector('a[aria-label^="Clear"]')).toBeNull();
  expect(rows().join(" ")).toContain("Checking");
  expect(rows().join(" ")).toContain("Brex Card");
});

it("charts the year first and refetches when another range is chosen", async () => {
  expect(rpcMock.balanceSeries).toHaveBeenCalledTimes(1);
  expect(rpcMock.balanceSeries).toHaveBeenLastCalledWith({ range: "year" });
  const tab = (name: string) =>
    [...container.querySelectorAll('[role="tab"]')].find((b) => b.textContent === name);
  expect(tab("Year")?.getAttribute("aria-selected")).toBe("true");
  await act(async () => (tab("Quarter") as HTMLElement).click());
  await flush();
  expect(rpcMock.balanceSeries).toHaveBeenLastCalledWith({ range: "quarter" });
  await act(async () => (tab("Week") as HTMLElement).click());
  await flush();
  expect(rpcMock.balanceSeries).toHaveBeenLastCalledWith({ range: "week" });
});

it("reloads the chart after the crypto scope is saved", async () => {
  rpcMock.setPreferences.mockResolvedValue({ runwayCrypto: "all" });
  await act(async () => toggle()?.click());
  await flush();
  expect(rpcMock.balanceSeries).toHaveBeenCalledTimes(2);
  expect(rpcMock.balanceSeries).toHaveBeenLastCalledWith({ range: "year" });
});

it("says an account has no transactions yet, without mentioning a period it does not have", async () => {
  rpcMock.account.mockResolvedValue({
    account: {
      id: "a9",
      provider: "mercury",
      kind: "savings",
      name: "Savings",
      lastFour: "2222",
      balanceCents: 100_000,
      annualYieldPct: null,
    },
    history: [],
    treasuryYield: [],
    transactions: [],
  });
  await act(async () => root.unmount());
  root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter>
        <FinanceAccountPage id="a9" />
      </MemoryRouter>,
    ),
  );
  await flush();
  expect(container.textContent).toContain("No transactions on this account yet");
  expect(container.textContent).not.toContain("in this period");
});

it("renames a statement account and shows the new name, and offers no rename on a synced bank", async () => {
  const statementAccount = (name: string) => ({
    account: {
      id: "s1",
      provider: "statement",
      kind: "checking",
      name,
      lastFour: null,
      balanceCents: 1_050_000,
      annualYieldPct: null,
    },
    history: [],
    treasuryYield: [],
    transactions: [],
  });
  rpcMock.account.mockResolvedValueOnce(statementAccount("mock firstbank"));
  rpcMock.account.mockResolvedValueOnce(statementAccount("Operating account"));
  rpcMock.statementAccountRename.mockResolvedValue({ ok: true });
  await act(async () => root.unmount());
  root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter>
        <FinanceAccountPage id="s1" />
      </MemoryRouter>,
    ),
  );
  await flush();
  const rename = [...container.querySelectorAll("button")].find((b) => b.textContent === "Rename");
  await act(async () => rename?.click());
  const input = document.body.querySelector<HTMLInputElement>('input[maxlength="200"]');
  expect(input?.value).toBe("mock firstbank");
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, "  Operating account ");
    input?.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => input?.form?.requestSubmit());
  await flush();
  expect(rpcMock.statementAccountRename).toHaveBeenCalledWith({
    id: "s1",
    name: "Operating account",
  });
  expect(container.querySelector("h1")?.textContent).toBe("Operating account");

  // A Mercury account keeps the bank's name.
  rpcMock.account.mockResolvedValue({
    ...statementAccount("Checking"),
    account: { ...statementAccount("Checking").account, id: "m1", provider: "mercury" },
  });
  await act(async () =>
    root.render(
      <MemoryRouter>
        <FinanceAccountPage id="m1" />
      </MemoryRouter>,
    ),
  );
  await flush();
  expect([...container.querySelectorAll("button")].some((b) => b.textContent === "Rename")).toBe(
    false,
  );
});
