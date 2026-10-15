// @vitest-environment jsdom

import type {
  CashPoint,
  FinanceOverview,
  FinanceTransactionOutput,
  SpendTotals,
} from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
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
  overview: vi.fn(),
  exchanges: vi.fn(),
  refresh: vi.fn(),
  vendor: vi.fn(),
  spend: vi.fn(),
  month: vi.fn(),
  transaction: vi.fn(),
  receiptUrl: vi.fn(),
  connect: vi.fn(),
}));
vi.mock("../lib/rpc", () => ({ rpc: { finance: rpcMock } }));
vi.mock("../lib/finance-connect", () => ({ connectFinanceProvider: rpcMock.connect }));

import { FinancePage } from "./Finance";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const totals = (period: SpendTotals["period"], current: number, previous: number): SpendTotals => ({
  period,
  currentCents: current,
  previousCents: previous,
  changePct: previous ? ((current - previous) / previous) * 100 : null,
  start: "2026-10-01",
  end: "2026-10-15",
  previousStart: "2026-09-01",
  previousEnd: "2026-09-15",
});

/** `count` bars ending 2026-10-14 (a Wednesday), the last one partial; weeks start Monday. */
const bars = (count: number, size: "day" | "week" | "month"): CashPoint[] =>
  Array.from({ length: count }, (_, i) => {
    const back = count - 1 - i;
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const at = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));
    const start =
      size === "day"
        ? at(2026, 9, 14 - back)
        : size === "week"
          ? at(2026, 9, 12 - 7 * back)
          : at(2026, 9 - back, 1);
    const end =
      size === "day"
        ? start
        : size === "week"
          ? at(2026, start.getUTCMonth(), start.getUTCDate() + 6)
          : at(2026, start.getUTCMonth() + 1, 0);
    return {
      start: iso(start),
      end: iso(end),
      outCents: 10_000 * (i + 1),
      revenueCents: 0,
      financingCents: 0,
      partial: i === count - 1,
    };
  });

const connectedOverview = (over: Partial<FinanceOverview> = {}): FinanceOverview => ({
  sources: [
    { provider: "mercury", serverId: "s1", status: "ok", lastSyncedAt: "2026-10-14T10:00:00.000Z" },
    { provider: "brex", serverId: null, status: "not_connected", lastSyncedAt: null },
  ],
  agent: null,
  cash: {
    cashCents: 5_000_000,
    checkingCents: 1_000_000,
    savingsCents: 0,
    treasuryCents: 4_000_000,
    cardOwedCents: null,
  },
  burn: { monthlyCents: 800_000, months: ["2026-07", "2026-08", "2026-09"] },
  hasCashAccounts: true,
  runway: { months: 6.25, runOutDate: "2027-04-20" },
  spendTotals: {
    week: totals("week", 11_100, 50_000),
    month: totals("month", 1_800_000, 3_600_000),
    quarter: totals("quarter", 2_222_200, 9_000_000),
    year: totals("year", 7_777_700, 9_000_000),
  },
  cashSeries: {
    week: bars(7, "day"),
    month: bars(30, "day"),
    quarter: bars(13, "week"),
    year: bars(12, "month"),
  },
  breakdown: {
    category: [{ key: "software", label: "Software", cents: 120_000 }],
    vendor: [{ key: "acme-hosting", label: "Acme Hosting", cents: 90_000 }],
  },
  upcoming: {
    items: [
      {
        key: "acme-hosting",
        kind: "recurring",
        name: "Acme Hosting",
        dates: ["2026-10-20", "2026-10-27"],
        amountCents: 50_000,
      },
    ],
    totalCents: 100_000,
  },
  subscriptions: {
    items: [
      {
        key: "acme-hosting",
        name: "Acme Hosting",
        monthlyCents: 50_000,
        trendCents: [40_000, 45_000, 50_000],
        lastChargeAt: "2026-10-01T00:00:00.000Z",
        overlapGroup: null,
        paidWith: [{ provider: "brex", kind: "card", name: "Card", lastFour: "0001" }],
      },
    ],
    totalMonthlyCents: 50_000,
  },
  treasuryYieldLastMonth: { month: "2026-09", netCents: 91_100 },
  lastSyncedAt: "2026-10-14T10:00:00.000Z",
  excludedNonUsdCount: 0,
  ...over,
});

const emptyOverview = (): FinanceOverview =>
  connectedOverview({
    sources: [
      { provider: "mercury", serverId: null, status: "not_connected", lastSyncedAt: null },
      { provider: "brex", serverId: null, status: "not_connected", lastSyncedAt: null },
    ],
    hasCashAccounts: false,
    lastSyncedAt: null,
  });

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

async function show(path: string, onAskAgent?: () => void) {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <FinancePage onAskAgent={onAskAgent} />
      </MemoryRouter>,
    );
  });
}
const flush = () => act(async () => {});
const button = (name: RegExp | string) =>
  [...container.querySelectorAll("button")].find((b) =>
    typeof name === "string"
      ? b.textContent === name
      : name.test(b.getAttribute("aria-label") ?? b.textContent ?? ""),
  );

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  rpcMock.refresh.mockResolvedValue({ ok: true });
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.resetAllMocks();
});

it("offers Add account when nothing is connected, opening the dialog with Upload statements", async () => {
  rpcMock.overview.mockResolvedValue(emptyOverview());
  rpcMock.exchanges.mockResolvedValue([]);
  await show("/app/finance");
  expect(container.textContent).toContain("Add an account to see cash, burn, runway and spend.");
  expect(container.querySelectorAll('[data-testid="app-logo"]').length).toBe(2);
  expect(container.textContent).not.toContain("Ask agent");
  const add = button("Add account");
  await act(async () => add?.click());
  await flush();
  const dialog = document.body.querySelector('[role="dialog"]');
  expect(dialog?.textContent).toContain("Upload statements");
  expect(dialog?.textContent).toContain("Wallet");
  expect(rpcMock.connect).not.toHaveBeenCalled();
});

it("shows the dashboard, not the connect prompt, for a user with only statement accounts", async () => {
  rpcMock.overview.mockResolvedValue({
    ...emptyOverview(),
    hasCashAccounts: true,
    lastSyncedAt: null,
    statementReminders: [
      {
        accountId: "a1",
        accountName: "Example Bank ••1234",
        coveredThrough: "2026-09-30",
        dueFor: "2026-10-31",
      },
    ],
  });
  await show("/app/finance");
  await flush();
  expect(container.textContent).not.toContain("Add an account to see");
  expect(container.textContent).toContain("Upload the October statement for Example Bank ••1234");
  expect(rpcMock.refresh).not.toHaveBeenCalled();
  await act(async () => button("Upload")?.click());
  const dialog = document.body.querySelector('[role="dialog"]');
  expect(dialog?.textContent).toContain("Upload statements");
  expect(dialog?.querySelector('input[type="file"]')).not.toBeNull();
});

it("notes non-USD transactions only when some are left out", async () => {
  rpcMock.overview.mockResolvedValue(connectedOverview());
  await show("/app/finance");
  expect(container.textContent).not.toContain("non-USD");

  rpcMock.overview.mockResolvedValue(connectedOverview({ excludedNonUsdCount: 3 }));
  await act(async () => root.unmount());
  root = createRoot(container);
  await show("/app/finance");
  await flush();
  expect(container.textContent).toContain("3 non-USD not counted");
});

it("sends the Reconnect chip to Integrations instead of connecting", async () => {
  const base = connectedOverview();
  rpcMock.overview.mockResolvedValue({
    ...base,
    sources: [
      { provider: "mercury", serverId: "s1", status: "needs_reconnect", lastSyncedAt: null },
      ...base.sources.slice(1),
    ],
  });
  await show("/app/finance");
  await flush();
  const chip = container.querySelector('a[aria-label="Reconnect Mercury"]');
  expect(chip?.getAttribute("href")).toBe("/app/integrations?category=finance");
  expect(rpcMock.connect).not.toHaveBeenCalled();
});

it("links each source chip to Accounts filtered to that source", async () => {
  const base = connectedOverview();
  rpcMock.overview.mockResolvedValue({
    ...base,
    sources: base.sources.map((s) => ({ ...s, status: "ok" as const, serverId: "s" })),
  });
  await show("/app/finance");
  await flush();
  const hrefs = [...container.querySelectorAll('a[aria-label$=" accounts"]')].map((a) => [
    a.getAttribute("aria-label"),
    a.getAttribute("href"),
  ]);
  expect(hrefs).toEqual([
    ["Mercury accounts", "/app/finance/accounts?source=mercury"],
    ["Brex accounts", "/app/finance/accounts?source=brex"],
  ]);
});

it("links the header to Accounts and offers Add Brex when only Mercury is connected", async () => {
  rpcMock.overview.mockResolvedValue(connectedOverview());
  await show("/app/finance", vi.fn());
  await flush();
  const links = [...container.querySelectorAll("a")];
  const accounts = links.find((a) => a.textContent === "Accounts");
  expect(accounts?.getAttribute("href")).toBe("/app/finance/accounts");
  const add = links.find((a) => a.textContent === "Add Brex");
  expect(add?.getAttribute("href")).toBe("/app/integrations?category=finance");
  // Accounts comes before Ask agent in the header.
  const ask = button("Ask agent") as HTMLElement;
  expect(accounts && ask && accounts.compareDocumentPosition(ask)).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING,
  );
});

it("shows Cash and Runway for Mercury only, and no Add link when both are connected", async () => {
  rpcMock.overview.mockResolvedValue(connectedOverview());
  await show("/app/finance");
  await flush();
  expect(container.querySelector('a[href="/app/finance/runway"]')).not.toBeNull();
  expect(container.textContent).toContain("Cash");

  act(() => root.unmount());
  root = createRoot(container);
  const base = connectedOverview();
  rpcMock.overview.mockResolvedValue({
    ...base,
    sources: base.sources.map((s) => ({ ...s, status: "ok" as const, serverId: "s" })),
  });
  await show("/app/finance");
  await flush();
  expect(container.textContent).not.toContain("Add Brex");
  expect(container.textContent).not.toContain("Add Mercury");
});

it("hides Cash and Runway when only Brex is connected, and still shows spend", async () => {
  const base = connectedOverview();
  rpcMock.overview.mockResolvedValue(
    connectedOverview({
      sources: [
        { provider: "mercury", serverId: null, status: "not_connected", lastSyncedAt: null },
        { provider: "brex", serverId: "s2", status: "ok", lastSyncedAt: base.lastSyncedAt },
      ],
      cash: { cashCents: 0, checkingCents: 0, savingsCents: 0, treasuryCents: 0, cardOwedCents: 0 },
      hasCashAccounts: false,
      runway: { months: null, runOutDate: null },
    }),
  );
  await show("/app/finance");
  await flush();
  expect(container.querySelector('a[href="/app/finance/runway"]')).toBeNull();
  expect(container.textContent).not.toContain("Runway");
  expect(container.textContent).not.toContain("Cash");
  expect(container.textContent).toContain("Spend this month");
  expect(container.textContent).toContain("Monthly burn");
  expect(container.textContent).toContain("Add Mercury");
});

it("still shows Cash and Runway when the cash balance is zero or negative", async () => {
  rpcMock.overview.mockResolvedValue(
    connectedOverview({
      cash: {
        cashCents: -250_000,
        checkingCents: -250_000,
        savingsCents: 0,
        treasuryCents: 0,
        cardOwedCents: null,
      },
      runway: { months: 0, runOutDate: null },
    }),
  );
  await show("/app/finance");
  await flush();
  expect(container.querySelector('a[href="/app/finance/runway"]')).not.toBeNull();
  expect(container.textContent).toContain("Cash");
});

const manyRows = () => {
  const vendors = Array.from({ length: 12 }, (_, i) => ({
    key: `v${i}`,
    label: `Vendor ${i}`,
    cents: 100_000 - i * 1_000,
  }));
  const items = Array.from({ length: 24 }, (_, i) => ({
    key: `u${i}`,
    kind: "recurring" as const,
    name: `Upcoming ${i}`,
    dates: [`2026-10-${String(15 + (i % 14)).padStart(2, "0")}`],
    amountCents: 1_000,
  }));
  return connectedOverview({
    breakdown: { category: vendors, vendor: vendors },
    upcoming: { items, totalCents: 24_000 },
  });
};

it("caps Breakdown and Upcoming at the same row count and expands inline", async () => {
  rpcMock.overview.mockResolvedValue(manyRows());
  await show("/app/finance");
  await flush();
  const rows = () => ({
    breakdown: container.querySelectorAll('a[href^="/app/finance/category/v"]').length,
    upcoming: [...container.querySelectorAll("a")].filter((a) =>
      a.textContent?.includes("Upcoming "),
    ).length,
  });
  expect(rows()).toEqual({ breakdown: 7, upcoming: 7 });
  // The header total still covers every upcoming row.
  expect(container.textContent).toContain("~$240");
  // The soonest rows come first.
  expect(container.textContent).toContain("Upcoming 0");
  expect(container.textContent).not.toContain("Upcoming 13");

  const showAll = [...container.querySelectorAll("button")].filter(
    (b) => b.textContent === "Show all 24",
  );
  expect(showAll.length).toBe(1);
  expect(button("Show all 12")).toBeDefined();
  await act(async () => showAll[0]?.click());
  expect(rows().upcoming).toBe(24);
  expect(rows().breakdown).toBe(7);
  await act(async () => button("Show less")?.click());
  expect(rows().upcoming).toBe(7);
});

it("uses the Breakdown row count (minimum 5) as the cap and hides Show all when everything fits", async () => {
  const base = manyRows();
  rpcMock.overview.mockResolvedValue({
    ...base,
    breakdown: { category: base.breakdown.category.slice(0, 6), vendor: [] },
    upcoming: { ...base.upcoming, items: base.upcoming.items.slice(0, 6) },
  });
  await show("/app/finance");
  await flush();
  expect(container.querySelectorAll('a[href^="/app/finance/category/v"]').length).toBe(6);
  expect(button(/^Show all/)).toBeUndefined();

  act(() => root.unmount());
  root = createRoot(container);
  rpcMock.overview.mockResolvedValue({
    ...base,
    breakdown: { category: base.breakdown.category.slice(0, 2), vendor: [] },
  });
  await show("/app/finance");
  await flush();
  // Fewer than 5 breakdown rows: both cards cap at 5.
  expect(button("Show all 24")).toBeDefined();
  expect(
    [...container.querySelectorAll("a")].filter((a) => a.textContent?.includes("Upcoming ")).length,
  ).toBe(5);
});

it("hides the comparison when the previous period is not fully synced", async () => {
  const base = connectedOverview();
  rpcMock.overview.mockResolvedValue(
    connectedOverview({
      spendTotals: {
        ...base.spendTotals,
        month: { ...base.spendTotals.month, previousCents: null, changePct: null },
        year: { ...base.spendTotals.year, previousCents: null, changePct: null },
      },
    }),
  );
  await show("/app/finance");
  await flush();
  expect(container.textContent).not.toMatch(/vs \$[\d,]+ for/);
  expect(container.textContent).not.toContain("vs Sep");
});

it("shows the figures, syncs once, and lets the period chips change the spend number", async () => {
  rpcMock.overview.mockResolvedValue(connectedOverview());
  await show("/app/finance");
  await flush();

  expect(rpcMock.refresh).toHaveBeenCalledTimes(1);
  const text = container.textContent ?? "";
  expect(text).toContain("$50,000"); // cash
  expect(text).toContain("$8,000"); // burn
  expect(text).toContain("6.3 mo");
  expect(text).toContain("Until April 2027");
  expect(text).toContain("$18,000"); // spend this month, and the chips' default period
  expect(text).toContain("1 subscription");

  const total = () =>
    [...container.querySelectorAll('a[href^="/app/finance/spend"]')].map((a) => a.textContent);
  expect(total()).toContain("$18,000");

  const week = [...container.querySelectorAll('[role="tab"]')].find(
    (tab) => tab.textContent === "Week",
  );
  await act(async () => (week as HTMLElement).click());
  expect(total()).toContain("$111");
  expect(container.querySelector('a[href="/app/finance/spend?period=week"]')).not.toBeNull();
  // Intl puts thin spaces around the range dash.
  expect(container.textContent?.replace(/[\s\u2009]+/g, " ")).toContain(
    "Spent Oct 1 – 14 · ↓ 78% vs Sep 1 – 14",
  );

  const year = [...container.querySelectorAll('[role="tab"]')].find(
    (tab) => tab.textContent === "Year",
  );
  await act(async () => (year as HTMLElement).click());
  expect(total()).toContain("$77,777");
});

it("switches the breakdown between category and vendor", async () => {
  rpcMock.overview.mockResolvedValue(connectedOverview());
  await show("/app/finance");
  await flush();
  expect(container.querySelector('a[href="/app/finance/category/software"]')).not.toBeNull();
  await act(async () => button("Vendor")?.click());
  expect(container.querySelector('a[href="/app/finance/vendor/acme-hosting"]')).not.toBeNull();
  expect(container.querySelector('a[href="/app/finance/category/software"]')).toBeNull();
});

it("puts the paid-with text on the subscription row and links the row to its vendor", async () => {
  rpcMock.overview.mockResolvedValue(connectedOverview());
  await show("/app/finance");
  await flush();
  const row = container.querySelector("tbody tr");
  expect(row?.querySelector('[role="tooltip"]')?.textContent).toBe("Brex ••0001");
  // Stays in layout (only invisible) so hovering never shifts the table columns.
  expect(row?.querySelector('[role="tooltip"]')?.classList.contains("hidden")).toBe(false);
  const link = row?.querySelector("a");
  expect(link?.getAttribute("href")).toBe("/app/finance/vendor/acme-hosting");
  expect(link?.getAttribute("aria-label")).toBe("Acme Hosting, paid with Brex ••0001");
});

it("offers Ask agent only while the panel is closed", async () => {
  rpcMock.overview.mockResolvedValue(connectedOverview());
  const ask = vi.fn();
  await show("/app/finance", ask);
  await flush();
  await act(async () => button("Ask agent")?.click());
  expect(ask).toHaveBeenCalledTimes(1);

  act(() => root.unmount());
  root = createRoot(container);
  await show("/app/finance", undefined);
  await flush();
  expect(button("Ask agent")).toBeUndefined();
});

it("refreshes on demand and shows a sync failure with a retry", async () => {
  rpcMock.overview.mockResolvedValue(connectedOverview());
  await show("/app/finance");
  await flush();
  rpcMock.refresh.mockRejectedValueOnce(new Error("Could not reach the server"));
  await act(async () => button(/^Refresh$/)?.click());
  await flush();
  expect(rpcMock.refresh).toHaveBeenCalledTimes(2);
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("Could not reach");
});

it("shows an error with Try again when the dashboard cannot load", async () => {
  rpcMock.overview.mockRejectedValueOnce(new Error("Could not reach the server"));
  rpcMock.overview.mockResolvedValue(connectedOverview());
  await show("/app/finance");
  await flush();
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("Could not reach");
  await act(async () => button("Try again")?.click());
  await flush();
  expect(container.textContent).toContain("$50,000");
});

it("labels a vendor page, breadcrumb and back link", async () => {
  rpcMock.vendor.mockResolvedValue({
    key: "acme-hosting",
    name: "Acme Hosting",
    isSubscription: true,
    monthlyAvgCents: 50_000,
    changePct: 25,
    firstSeenAt: "2025-03-02T00:00:00.000Z",
    paidWith: [{ provider: "brex", kind: "card", name: "Card", lastFour: "0001" }],
    monthly: [],
    charges: [],
  });
  await show("/app/finance/vendor/acme-hosting");
  await flush();
  expect(rpcMock.vendor).toHaveBeenCalledWith({ key: "acme-hosting" });
  expect(container.querySelector("h1")?.textContent).toBe("Acme Hosting");
  expect(container.querySelector("nav")?.textContent).toContain("Subscriptions");
  expect(container.querySelector('a[href="/app/finance"]')?.textContent).toContain("Subscriptions");
  expect(container.textContent).toContain("↑ 25%");
  expect(container.textContent).toContain("Brex ••0001");
});

const spendTransaction = (hasReceipt: boolean): FinanceTransactionOutput => ({
  transaction: {
    id: "t1",
    provider: "brex",
    externalId: "e1",
    accountExternalId: "a1",
    postedAt: "2026-10-03T12:00:00.000Z",
    purchasedAt: "2026-10-02T12:00:00.000Z",
    amountCents: -4_200,
    currency: "USD",
    counterparty: "Acme Hosting",
    vendorKey: "acme-hosting",
    category: "Software",
    status: "posted",
    kind: "card",
    classification: "spend",
    cardLastFour: "0001",
    cardholder: "Sam Example",
    memo: "Pro plan",
    hasReceipt,
    dashboardUrl: "https://dashboard.example.test/expenses/e1",
  },
  vendorName: "Acme Hosting",
  account: null,
  vendorIsSubscription: true,
});

it("shows No receipt without an upload action when a charge has no receipt", async () => {
  rpcMock.transaction.mockResolvedValue(spendTransaction(false));
  await show("/app/finance/transaction/t1");
  await flush();
  expect(container.textContent).toContain("No receipt");
  expect(container.textContent).not.toContain("Upload");
  expect(rpcMock.receiptUrl).not.toHaveBeenCalled();
  // Subscription charges sit under the vendor in the breadcrumb.
  expect(container.querySelector('nav a[href="/app/finance/vendor/acme-hosting"]')).not.toBeNull();
  const external = container.querySelector('a[href="https://dashboard.example.test/expenses/e1"]');
  expect(external?.getAttribute("rel")).toContain("noopener");
});

it("lets a Mercury charge check for a receipt on demand and says No receipt when none exists", async () => {
  const data = spendTransaction(false);
  data.transaction.provider = "mercury";
  rpcMock.transaction.mockResolvedValue(data);
  rpcMock.receiptUrl.mockRejectedValue({ code: "NOT_FOUND" });
  await show("/app/finance/transaction/t1");
  await flush();
  expect(container.textContent).not.toContain("No receipt");
  expect(rpcMock.receiptUrl).not.toHaveBeenCalled();

  await act(async () => button("Check for receipt")?.click());
  await flush();
  expect(rpcMock.receiptUrl).toHaveBeenCalledWith({ transactionId: "t1" });
  expect(container.textContent).toContain("No receipt");
});

it("links a charge with a receipt to the receipt page, which fetches the link on demand", async () => {
  rpcMock.transaction.mockResolvedValue(spendTransaction(true));
  rpcMock.receiptUrl.mockResolvedValue({
    url: "https://files.example.test/r.png",
    mimeType: "image/png",
  });
  await show("/app/finance/transaction/t1");
  await flush();
  expect(container.querySelector('a[href="/app/finance/receipt/t1"]')).not.toBeNull();

  act(() => root.unmount());
  root = createRoot(container);
  await show("/app/finance/receipt/t1");
  await flush();
  expect(rpcMock.receiptUrl).toHaveBeenCalledWith({ transactionId: "t1" });
  expect(container.querySelector("img")?.getAttribute("src")).toBe(
    "https://files.example.test/r.png",
  );
  expect(container.querySelector("nav")?.textContent).toContain("Receipt");
});

it("does not render a non-https vendor link", async () => {
  const data = spendTransaction(false);
  data.transaction.dashboardUrl = "javascript:alert(1)";
  rpcMock.transaction.mockResolvedValue(data);
  await show("/app/finance/transaction/t1");
  await flush();
  expect(container.querySelector('a[href^="javascript"]')).toBeNull();
  expect(container.textContent).not.toContain("Open in Brex");
});

it("shows not found for an unknown Finance path", async () => {
  await show("/app/finance/nope");
  expect(container.querySelector("h1")?.textContent).toBe("Not found");
});

it("redraws the Burn chart for the selected period and opens the matching detail", async () => {
  // jsdom has no layout, so give the chart a width.
  const width = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(800);
  rpcMock.spend.mockReturnValue(new Promise(() => {}));
  rpcMock.month.mockReturnValue(new Promise(() => {}));
  rpcMock.overview.mockResolvedValue(connectedOverview());
  let where = "";
  const Probe = () => {
    const l = useLocation();
    where = l.pathname + l.search;
    return null;
  };
  const home = async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/app/finance"]} key={Math.random()}>
          <Probe />
          <FinancePage />
        </MemoryRouter>,
      );
    });
    await flush();
  };
  const tab = (name: string) =>
    [...container.querySelectorAll('[role="tab"]')].find((n) => n.textContent === name);
  const labels = () =>
    [...container.querySelectorAll('svg[aria-label^="Cash out"] text')].map((n) => n.textContent);
  const barLinks = () => [
    ...container.querySelectorAll('svg[aria-label^="Cash out"] [role="link"]'),
  ];
  const clickBar = (i: number) =>
    act(async () =>
      (barLinks()[i] as SVGElement).dispatchEvent(new MouseEvent("click", { bubbles: true })),
    );

  // Month is the default: 30 daily bars labelled with day numbers.
  await home();
  expect(barLinks().length).toBe(30);
  expect(labels().at(-1)).toBe("14*");
  expect(container.textContent).toContain("* So far");
  await clickBar(29);
  expect(where).toBe("/app/finance/spend?period=month&from=2026-10-14&to=2026-10-14");

  await home();
  await act(async () => (tab("Week") as HTMLElement).click());
  expect(barLinks().length).toBe(7);
  expect(labels()).toContain("Mon");
  expect(labels().at(-1)).toBe("Wed*");

  await act(async () => (tab("Quarter") as HTMLElement).click());
  expect(barLinks().length).toBe(13);
  expect(labels()).toContain("Oct 12*");
  await clickBar(11);
  expect(where).toBe("/app/finance/spend?period=quarter&from=2026-10-05&to=2026-10-11");

  await home();
  await act(async () => (tab("Year") as HTMLElement).click());
  expect(barLinks().length).toBe(12);
  expect(labels()).toContain("Oct*");
  await clickBar(11);
  expect(where).toBe("/app/finance/month/2026-10");
  width.mockRestore();
});

it("shows the Crypto card only when the overview has crypto, apart from cash", async () => {
  rpcMock.overview.mockResolvedValue(connectedOverview());
  await show("/app/finance");
  await flush();
  expect(container.textContent).not.toContain("Crypto");
  expect(container.querySelector('a[href="/app/finance/crypto"]')).toBeNull();

  const cashBefore = container.querySelector('a[href="/app/finance/accounts"]')?.textContent;
  rpcMock.overview.mockResolvedValue(
    connectedOverview({
      crypto: {
        totalCents: 123_456_00,
        byChain: [],
        byWallet: [],
        lastSyncedAt: null,
        unpricedTokenCount: 2,
      },
    }),
  );
  await act(async () => root.unmount());
  root = createRoot(container);
  await show("/app/finance");
  await flush();
  const card = container.querySelector('a[href="/app/finance/crypto"]');
  expect(card?.textContent).toContain("$123,456");
  expect(card?.textContent).toContain("2 unpriced");
  // One row of five on desktop: crypto shares the grid with the other stat cards.
  const grid = card?.parentElement;
  expect(grid?.className).toContain("@3xl:grid-cols-5");
  expect(grid?.querySelector('a[href="/app/finance/accounts"]')).not.toBeNull();
  expect(container.querySelector('a[href="/app/finance/accounts"]')?.textContent).toBe(cashBefore);
});

it("links a crypto-only user from the empty state to Accounts", async () => {
  rpcMock.overview.mockResolvedValue({
    ...emptyOverview(),
    crypto: {
      totalCents: 100,
      byChain: [],
      byWallet: [],
      lastSyncedAt: null,
      unpricedTokenCount: 0,
    },
  });
  await show("/app/finance");
  await flush();
  expect(container.querySelector('a[href="/app/finance/accounts"]')?.textContent).toBe("Accounts");
});

const cryptoWith = (stablecoinCents: number, totalCents: number) => ({
  totalCents,
  stablecoinCents,
  byChain: [],
  byWallet: [],
  lastSyncedAt: null,
  unpricedTokenCount: 0,
});
const withStablecoins = () =>
  connectedOverview({
    cash: {
      ...connectedOverview().cash,
      cashCents: 125_000_00,
      bankCashCents: 100_000_00,
      stablecoinCents: 25_000_00,
      otherCryptoCents: 0,
    },
    runway: { months: 12.5, runOutDate: "2027-10-30" },
    bankRunway: { months: 10, runOutDate: "2027-08-12" },
    crypto: cryptoWith(25_000_00, 55_000_00),
  });
const kpi = (title: string) =>
  [...container.querySelectorAll("a")].find((a) => a.querySelector("h2")?.textContent === title) as
    | HTMLElement
    | undefined;
const hoverOver = async (title: string) => {
  const link = kpi(title) as HTMLElement;
  await act(async () => {
    link.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    link.dispatchEvent(new MouseEvent("mouseenter"));
    link.focus();
  });
  await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));
  return document.body.querySelector('[data-slot="tooltip-content"]')?.textContent ?? "";
};

it("counts stablecoins in Cash and Runway, and the hovers show the figures without crypto", async () => {
  rpcMock.overview.mockResolvedValue(withStablecoins());
  await show("/app/finance");
  await flush();
  const cash = kpi("Cash");
  expect(cash?.textContent).toContain("$125,000");
  expect(cash?.textContent).toContain("Checking + Treasury + Stablecoins");
  const cashTip = await hoverOver("Cash");
  expect(cashTip).toContain("Bank$100,000");
  expect(cashTip).toContain("Stablecoins$25,000");
  expect(cashTip).toContain("Other crypto$30,000");
  expect(cashTip).toContain("Total incl. crypto$155,000");
});

it("shows bank-only runway in the Runway hover", async () => {
  rpcMock.overview.mockResolvedValue(withStablecoins());
  await show("/app/finance");
  await flush();
  expect(kpi("Runway")?.textContent).toContain("12.5 mo");
  expect(await hoverOver("Runway")).toContain("Bank only: 10.0 mo");
});

it("keeps the plain Cash subtitle and no runway hover without stablecoins", async () => {
  rpcMock.overview.mockResolvedValue(connectedOverview({ crypto: cryptoWith(0, 5_000_00) }));
  await show("/app/finance");
  await flush();
  const cash = kpi("Cash");
  expect(cash?.textContent).toContain("Checking + Treasury");
  expect(cash?.textContent).not.toContain("Stablecoins");
  expect(await hoverOver("Runway")).toBe("");
});

const scoped = (counted: { stablecoins: number; other: number }) =>
  connectedOverview({
    cash: {
      ...connectedOverview().cash,
      cashCents: 100_000_00 + counted.stablecoins + counted.other,
      bankCashCents: 100_000_00,
      stablecoinCents: counted.stablecoins,
      otherCryptoCents: counted.other,
    },
    crypto: cryptoWith(25_000_00, 55_000_00),
  });

it("shows plain bank cash under the bank scope, with held crypto in the hover", async () => {
  rpcMock.overview.mockResolvedValue(scoped({ stablecoins: 0, other: 0 }));
  await show("/app/finance");
  await flush();
  expect(kpi("Cash")?.textContent).toContain("$100,000");
  expect(kpi("Cash")?.textContent).toContain("Checking + Treasury");
  expect(kpi("Cash")?.textContent).not.toContain("Stablecoins");
  const tip = await hoverOver("Cash");
  expect(tip).toContain("Stablecoins$25,000");
  expect(tip).toContain("Other crypto$30,000");
  expect(tip).toContain("Total incl. crypto$155,000");
});

it("counts all crypto under the all scope", async () => {
  rpcMock.overview.mockResolvedValue(scoped({ stablecoins: 25_000_00, other: 30_000_00 }));
  await show("/app/finance");
  await flush();
  expect(kpi("Cash")?.textContent).toContain("$155,000");
  expect(kpi("Cash")?.textContent).toContain("Checking + Treasury + Crypto");
  expect(await hoverOver("Cash")).toContain("Total incl. crypto$155,000");
});
