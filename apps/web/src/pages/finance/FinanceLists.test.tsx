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
vi.mock("@lingui/core/macro", () => ({ t: text, plural: () => "" }));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: text, i18n: { locale: "en" } }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
const rpcMock = vi.hoisted(() => ({ overview: vi.fn() }));
vi.mock("../../lib/rpc", () => ({ rpc: { finance: rpcMock } }));

import { FinanceSubscriptionsPage, FinanceUpcomingPage } from "./FinanceLists";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const item = (key: string, kind: string, day: string, amountCents: number) => ({
  key,
  kind,
  name: `Vendor ${key}`,
  dates: [day],
  amountCents,
});
const sub = (key: string, monthlyCents: number, last: string) => ({
  key,
  name: `Vendor ${key}`,
  monthlyCents,
  trendCents: [0, 0, 0, 0],
  lastChargeAt: last,
  overlapGroup: null,
  paidWith: [],
});
const overview = {
  upcoming: {
    totalCents: 0,
    items: [
      item("cedar", "recurring", "2026-11-20", 500),
      item("anchor", "bill", "2026-11-05", 9000),
      item("birch", "pending", "2026-11-12", 1200),
    ],
  },
  subscriptions: {
    totalMonthlyCents: 0,
    items: [
      sub("delta", 2000, "2026-10-01"),
      sub("ember", 8000, "2026-10-20"),
      sub("fjord", 500, "2026-10-10"),
    ],
  },
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  rpcMock.overview.mockResolvedValue(overview);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.resetAllMocks();
});

const show = async (node: ReactNode, url: string) => {
  await act(async () => root.render(<MemoryRouter initialEntries={[url]}>{node}</MemoryRouter>));
  await act(async () => {});
};
const order = () =>
  [...(container.textContent ?? "").matchAll(/Vendor ([a-z]+)/g)].map((m) => m[1]);

it("lists upcoming by date, and sorts, searches and filters by type from the URL", async () => {
  await show(<FinanceUpcomingPage />, "/app/finance/upcoming");
  expect(order()).toEqual(["anchor", "birch", "cedar"]);
  act(() => root.unmount());
  root = createRoot(container);
  await show(<FinanceUpcomingPage />, "/app/finance/upcoming?sort=amount&dir=asc");
  expect(order()).toEqual(["cedar", "birch", "anchor"]);
  act(() => root.unmount());
  root = createRoot(container);
  await show(<FinanceUpcomingPage />, "/app/finance/upcoming?q=BIRCH");
  expect(order()).toEqual(["birch"]);
  act(() => root.unmount());
  root = createRoot(container);
  await show(<FinanceUpcomingPage />, "/app/finance/upcoming?type=bill");
  expect(order()).toEqual(["anchor"]);
  act(() => root.unmount());
  root = createRoot(container);
  await show(<FinanceUpcomingPage />, "/app/finance/upcoming?q=zzz");
  expect(container.textContent).toContain("No matches");
});

it("lists subscriptions biggest first, and sorts and searches from the URL", async () => {
  await show(<FinanceSubscriptionsPage />, "/app/finance/subscriptions");
  expect(order()).toEqual(["ember", "delta", "fjord"]);
  act(() => root.unmount());
  root = createRoot(container);
  await show(<FinanceSubscriptionsPage />, "/app/finance/subscriptions?sort=lastCharge&dir=asc");
  expect(order()).toEqual(["delta", "fjord", "ember"]);
  act(() => root.unmount());
  root = createRoot(container);
  await show(<FinanceSubscriptionsPage />, "/app/finance/subscriptions?q=fjo");
  expect(order()).toEqual(["fjord"]);
});
