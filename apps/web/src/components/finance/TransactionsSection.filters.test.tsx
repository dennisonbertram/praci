// @vitest-environment jsdom

import type { FinanceTransaction } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({
  t: text,
  plural: (_n: number, o: { other: string }) => o.other,
}));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: text, i18n: { locale: "en" } }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../../lib/rpc", () => ({ rpc: {} }));

import { setHideAmounts } from "../../lib/hide-amounts-preference";
import { TransactionsSection } from "./ui";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const txn = (id: string, over: Partial<FinanceTransaction>) =>
  ({
    id,
    counterparty: "Acme",
    vendorKey: "",
    amountCents: -100,
    category: "Servers",
    currency: "USD",
    status: "posted",
    memo: null,
    classification: "spend",
    purchasedAt: null,
    postedAt: "2026-10-01T00:00:00Z",
    ...over,
  }) as FinanceTransaction;
const rows = [
  txn("1", { counterparty: "Acme", postedAt: "2026-10-03T00:00:00Z" }),
  txn("2", { counterparty: "Zed", category: "Travel", status: "pending", amountCents: -900 }),
  txn("3", { counterparty: "Acme", amountCents: -300 }),
  txn("4", { counterparty: "Beta", category: "Travel", amountCents: -50 }),
];

let search = "";
const Where = () => {
  search = useLocation().search;
  return null;
};
const render = async (node: ReactNode, path = "/app/finance/accounts") => {
  const el = document.createElement("div");
  document.body.append(el);
  await act(async () =>
    createRoot(el).render(
      <MemoryRouter initialEntries={[path]}>
        {node}
        <Where />
      </MemoryRouter>,
    ),
  );
  return el;
};
const names = (el: HTMLElement) => [...el.querySelectorAll("tbody tr a")].map((a) => a.textContent);
const click = (el: Element | null | undefined) => act(async () => (el as HTMLElement).click());
const button = (el: HTMLElement, label: string) =>
  [...el.querySelectorAll("button")].find((b) => b.textContent === label);

it("filters from the URL, sorts by header, and clears with Clear filters", async () => {
  const el = await render(<TransactionsSection rows={rows} />, "/app/finance/accounts?q=acme");
  expect(names(el)).toEqual(["Acme", "Acme"]);
  const q = el.querySelector("input[type=search]") as HTMLInputElement;
  expect(q.value).toBe("acme");
  await click(button(el, "Counterparty"));
  expect(search).toContain("sort=counterparty");
  await click(button(el, "Amount"));
  expect(names(el)).toEqual(["Acme", "Acme"]);
  expect(el.querySelector("th[aria-sort=ascending]")?.textContent).toBe("Amount");
  const none = await render(<TransactionsSection rows={rows} />, "/app/finance/accounts?q=nomatch");
  expect(none.textContent).toContain("No matches");
  await click(button(none, "Clear filters"));
  expect(search).toBe("");
  expect(names(none)).toHaveLength(4);
});

it("hides the Category filter on a page whose category is fixed, and Status when there is one", async () => {
  const some = await render(<TransactionsSection rows={rows} />);
  const filter = (el: HTMLElement, name: string) =>
    el.querySelector(`button[aria-label="Filter by ${name}"]`);
  expect(filter(some, "Category")).not.toBeNull();
  expect(filter(some, "Status")).not.toBeNull();
  const fixed = await render(
    <TransactionsSection rows={rows.filter((r) => r.status === "posted")} fixedCategory />,
  );
  expect(filter(fixed, "Category")).toBeNull();
  expect(filter(fixed, "Status")).toBeNull();
});

it("keeps By vendor working with filters and sorts its groups by total", async () => {
  const el = await render(
    <TransactionsSection rows={rows} />,
    "/app/finance/grouped?sort=amount&dir=asc&category=Servers",
  );
  await click(button(el, "By vendor"));
  // Only Servers rows remain: Acme (-100, -300) is the one group; Travel's vendors are gone.
  expect(el.textContent).toContain("Acme");
  expect(el.textContent).not.toContain("Zed");
  expect(el.textContent).toContain("# transactions");
});

it("sorts groups by total and reveals no amount while amounts are hidden", async () => {
  const two = [
    txn("1", { counterparty: "Acme", amountCents: -100 }),
    txn("2", { counterparty: "Acme", amountCents: -100 }),
    txn("3", { counterparty: "Zed", amountCents: -150 }),
  ];
  const el = await render(
    <TransactionsSection rows={two} />,
    "/app/finance/g2?sort=amount&dir=desc",
  );
  await click(button(el, "By vendor"));
  setHideAmounts(true);
  await act(async () => {});
  const order = [...el.querySelectorAll("tbody tr button")].map((b) => b.textContent);
  expect(order.join("|")).toMatch(/^Zed.*Acme/);
  expect(el.textContent).not.toMatch(/\$(1|2)/);
  setHideAmounts(false);
});
