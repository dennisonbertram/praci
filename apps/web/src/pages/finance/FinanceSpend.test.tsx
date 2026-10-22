// @vitest-environment jsdom

import type { FinanceSpendOutput, FinanceVendorOutput } from "@rakazo/contracts";
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
vi.mock("@lingui/core/macro", () => ({ t: text, plural: () => "Last 3 full months" }));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: text, i18n: { locale: "en" } }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
const rpcMock = vi.hoisted(() => ({ vendor: vi.fn(), spend: vi.fn(), category: vi.fn() }));
vi.mock("../../lib/rpc", () => ({ rpc: { finance: rpcMock } }));

import { FinanceCategoryPage, FinanceSpendPage, FinanceVendorPage } from "./FinanceSpend";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.resetAllMocks();
});

it("shows a new vendor's steady spend as 0% against the month it compares with", async () => {
  rpcMock.vendor.mockResolvedValue({
    key: "cloudnine",
    name: "Cloudnine Hosting",
    isSubscription: true,
    monthlyAvgCents: 481_200,
    monthlyAvgMonths: 3,
    changePct: 0,
    changeFromMonth: "2026-07",
    firstSeenAt: "2026-07-08T00:00:00.000Z",
    paidWith: [],
    monthly: ["07", "08", "09"].map((m) => ({ month: `2026-${m}`, cents: 481_200 })),
    charges: [],
  } satisfies FinanceVendorOutput);
  await act(async () =>
    root.render(
      <MemoryRouter>
        <FinanceVendorPage keyName="cloudnine" />
      </MemoryRouter>,
    ),
  );
  await act(async () => {});
  expect(container.querySelector('table[data-slot="table"]')).not.toBeNull();
  const page = container.textContent ?? "";
  // It names both months compared, not only the earlier one.
  expect(page).toContain("Change0%Sep vs Jul");
  expect(page).not.toContain("Not enough history");
  // No change is neither good nor bad news, so it is not shown in green.
  const zero = [...container.querySelectorAll("span")].find((s) => s.textContent === "0%");
  expect(zero?.className).not.toContain("text-success");
});

it("asks for and names only the chosen source's spend, and keeps it across the filters", async () => {
  rpcMock.spend.mockResolvedValue({
    period: "month",
    range: { from: "2026-07-01", to: "2026-09-30" },
    category: null,
    totalCents: 2_287_100,
    categories: [{ key: "travel", label: "Travel", cents: 2_287_100 }],
    transactions: [],
  } satisfies FinanceSpendOutput);
  await act(async () =>
    root.render(
      <MemoryRouter>
        <FinanceSpendPage
          period="month"
          category={null}
          range={{ from: "2026-07-01", to: "2026-09-30" }}
          source="brex"
        />
      </MemoryRouter>,
    ),
  );
  await act(async () => {});
  expect(rpcMock.spend).toHaveBeenCalledWith({
    period: "month",
    from: "2026-07-01",
    to: "2026-09-30",
    source: "brex",
  });
  expect(container.textContent).toContain("Brex ×");
  expect(container.textContent).toContain("$22,871");
  const chip = [...container.querySelectorAll("a")].find((a) => a.textContent === "Travel");
  expect(chip?.getAttribute("href")).toContain("source=brex");
});

it("charts a category's last six full months, like a vendor's chart, with month labels", async () => {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(600);
  const months = Array.from(
    { length: 12 },
    (_, i) => `2025-${String(i + 11).padStart(2, "0")}`,
  ).map((m, i) => (i < 2 ? m : `2026-${String(i - 1).padStart(2, "0")}`));
  rpcMock.category.mockResolvedValue({
    slug: "software",
    label: "Software",
    last90Cents: 108_500,
    trend: months.map((month) => ({ month, cents: 36_000 })),
    vendors: [],
    recent: [],
  });
  await act(async () =>
    root.render(
      <MemoryRouter>
        <FinanceCategoryPage slug="software" />
      </MemoryRouter>,
    ),
  );
  await act(async () => {});
  // The month still running (Oct) is left out, as on a vendor's chart.
  expect(container.textContent).toContain("Monthly spend · Apr – Sep");
  const labels = [...container.querySelectorAll('svg[aria-label="Monthly spend"] text')].map(
    (n) => n.textContent,
  );
  expect(labels.filter((l) => /^[A-Z][a-z]{2}/.test(l ?? ""))).toHaveLength(6);
  vi.restoreAllMocks();
});

it("says how many non-USD transactions a category's total leaves out", async () => {
  rpcMock.category.mockResolvedValue({
    slug: "rent",
    label: "Rent",
    last90Cents: 2_250_000,
    excludedNonUsdCount: 1,
    trend: [],
    vendors: [],
    recent: [],
  });
  await act(async () =>
    root.render(
      <MemoryRouter>
        <FinanceCategoryPage slug="rent" />
      </MemoryRouter>,
    ),
  );
  await act(async () => {});
  expect(container.textContent).toContain("$22,500");
  expect(container.textContent).toContain("1 non-USD not counted");
});

it("says what the month under way has cost, since the chart and the change stop at the last full month", async () => {
  const charge = (id: string, day: string, amountCents: number) => ({
    id,
    provider: "mercury",
    externalId: id,
    accountExternalId: "a",
    postedAt: `${day}T12:00:00.000Z`,
    purchasedAt: null,
    amountCents,
    currency: "USD",
    counterparty: "Globex Cloud",
    vendorKey: "globex",
    category: null,
    status: "posted",
    kind: "card",
    classification: "spend",
    cardLastFour: null,
    cardholder: null,
    memo: null,
    hasReceipt: false,
    dashboardUrl: null,
  });
  rpcMock.vendor.mockResolvedValue({
    key: "globex",
    name: "Globex Cloud",
    isSubscription: true,
    monthlyAvgCents: 201_600,
    changePct: 35,
    changeFromMonth: "2026-06",
    firstSeenAt: "2026-04-02T00:00:00.000Z",
    paidWith: [],
    monthly: ["04", "05", "06", "07", "08", "09"].map((m) => ({
      month: `2026-${m}`,
      cents: 200_000,
    })),
    currentMonth: { month: "2026-10", cents: 240_000 },
    charges: [charge("a", "2026-10-16", -240_000), charge("b", "2026-09-16", -200_000)],
  } as unknown as FinanceVendorOutput);
  await act(async () =>
    root.render(
      <MemoryRouter>
        <FinanceVendorPage keyName="globex" />
      </MemoryRouter>,
    ),
  );
  await act(async () => {});
  expect(container.textContent).toContain("Oct so far: $2,400");
});
