// @vitest-environment jsdom

import type { FinanceTransaction } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
  plural: () => "",
}));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ i18n: { locale: "en" } }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { TransactionsSection } from "./ui";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const txn = (id: string, vendor: string, cents: number): FinanceTransaction =>
  ({
    id,
    provider: "mercury",
    externalId: id,
    accountExternalId: "a",
    postedAt: "2026-10-12T12:00:00.000Z",
    purchasedAt: null,
    amountCents: -cents,
    currency: "USD",
    counterparty: vendor,
    vendorKey: vendor.toLowerCase(),
    category: null,
    status: "posted",
    kind: "card",
    classification: "spend",
    cardLastFour: null,
    cardholder: null,
    memo: null,
    hasReceipt: false,
    dashboardUrl: null,
  }) as FinanceTransaction;

// Four $10 charges from one vendor, then three other vendors.
const rows = [
  ...[1, 2, 3, 4].map((n) => txn(`a${n}`, "Alpha", 1_000)),
  txn("b1", "Beta", 500),
  txn("c1", "Gamma", 400),
  txn("d1", "Delta", 300),
];

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  localStorage.clear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const show = (url: string) =>
  act(async () =>
    root.render(
      <MemoryRouter initialEntries={[url]}>
        <TransactionsSection
          rows={rows}
          fixedCategory
          seeAll="/app/finance/spend?period=month&cat=x"
        />
      </MemoryRouter>,
    ),
  );

it("carries search, status and sort to the full page, and keeps the controls", async () => {
  await show("/app/finance/category/x?q=a&sort=amount&dir=asc&junk=1");
  const link = [...container.querySelectorAll("a")].find((a) =>
    a.textContent?.startsWith("See all"),
  );
  expect(link?.getAttribute("href")).toBe(
    "/app/finance/spend?period=month&cat=x&q=a&sort=amount&dir=asc",
  );
  expect(container.querySelector("input[name=transactions-search]")).not.toBeNull();
  expect(container.textContent).toContain("Clear filters");
});

it("caps By vendor by whole vendors so a vendor's total covers all its charges", async () => {
  await show("/app/finance/category/x");
  const by = [...container.querySelectorAll("button")].find((b) => b.textContent === "By vendor");
  await act(async () => by?.click());
  // Alpha ($40), Beta, Gamma shown; Delta is behind See all (4 vendors).
  expect(container.textContent).toContain("$40");
  expect(container.textContent).not.toContain("Delta");
  expect(container.textContent).toContain("See all (4)");
  // Grouped, there is no page with that set, so it expands in place.
  expect(
    [...container.querySelectorAll("a")].some((a) => a.textContent?.startsWith("See all")),
  ).toBe(false);
});
