// @vitest-environment jsdom

import type { FinanceTransaction } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

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
import { TransactionsSection, TransactionTable } from "./ui";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => setHideAmounts(false));

const txn = (id: string, cents: number) =>
  ({
    id,
    counterparty: "Acme Hosting",
    amountCents: cents,
    category: "Servers",
    currency: "USD",
    status: "posted",
    postedAt: "2026-10-01T00:00:00Z",
  }) as FinanceTransaction;

it("masks a grouped vendor total and its expanded rows while amounts are hidden, and flips live", async () => {
  const el = document.createElement("div");
  document.body.append(el);
  const root = createRoot(el);
  const rows = [txn("1", -123_456), txn("2", -777_700)];
  await act(async () =>
    root.render(
      <MemoryRouter>
        <TransactionTable rows={rows} grouped />
      </MemoryRouter>,
    ),
  );
  expect(el.textContent).toContain("$9,012");
  await act(async () => setHideAmounts(true));
  await act(async () => el.querySelector("button")?.click());
  for (const real of ["9,011", "1,234", "7,777"]) expect(el.textContent).not.toContain(real);
  expect(el.textContent).toContain("Acme Hosting");
});

const render = async (node: ReactNode, path = "/") => {
  const el = document.createElement("div");
  document.body.append(el);
  const root = createRoot(el);
  await act(async () => root.render(<MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>));
  return el;
};

it("gives every column but Counterparty a fixed width, the same in List and By vendor", async () => {
  const rows = [txn("1", -100), { ...txn("2", -200), counterparty: "Other Co" }];
  const header = (el: HTMLElement) =>
    [...el.querySelectorAll("th")].map((th) => th.className.match(/\bw-\S+/)?.[0] ?? null);
  const list = await render(<TransactionTable rows={rows} />);
  const grouped = await render(<TransactionTable rows={rows} grouped />);
  // A fixed table sizes columns from the header alone, so row contents cannot move them.
  expect(list.querySelector("table")?.className).toContain("table-fixed");
  expect(header(list)).toEqual(["w-[4.5rem]", null, "w-48", "w-24", "w-24", "w-5"]);
  expect(header(grouped)).toEqual(header(list));
  // An opened vendor's rows show dates and status, so By vendor names those columns too.
  const names = (el: HTMLElement) => [...el.querySelectorAll("th")].map((th) => th.textContent);
  expect(names(grouped)).toEqual(names(list));
});

it("shows list amounts in whole dollars, like the vendor and category totals", async () => {
  const el = await render(<TransactionTable rows={[txn("1", -8_750), txn("2", 150_050)]} />);
  expect(el.textContent).toContain("$88");
  expect(el.textContent).toContain("+$1,501");
  expect(el.textContent).not.toContain("87.50");
});

it("remembers List or By vendor per page, so another page still opens as a list", async () => {
  const rows = [txn("1", -100), { ...txn("2", -200), counterparty: "Other Co" }];
  const pressed = (el: HTMLElement) => el.querySelector('button[aria-pressed="true"]')?.textContent;
  const first = await render(<TransactionsSection rows={rows} />, "/app/finance/accounts");
  await act(async () =>
    [...first.querySelectorAll("button")].find((b) => b.textContent === "By vendor")?.click(),
  );
  expect(pressed(first)).toBe("By vendor");
  const other = await render(<TransactionsSection rows={rows} />, "/app/finance/category/software");
  expect(pressed(other)).toBe("List");
  const again = await render(<TransactionsSection rows={rows} />, "/app/finance/accounts");
  expect(pressed(again)).toBe("By vendor");
});

it("labels card payoffs and own-account transfers as not spend instead of Uncategorized", async () => {
  const rows = [
    {
      ...txn("1", -1_120_000),
      counterparty: "Brex",
      category: null,
      classification: "card_payment",
    },
    {
      ...txn("2", -500_000),
      counterparty: "Savings",
      category: null,
      classification: "internal_transfer",
    },
  ] as FinanceTransaction[];
  const el = await render(<TransactionTable rows={rows} />);
  expect(el.textContent).toContain("Card payment · not spend");
  expect(el.textContent).toContain("Transfer · not spend");
  expect(el.textContent).not.toContain("Uncategorized");
});

it("masks a dollar amount in a memo while amounts are hidden", async () => {
  const rows = [{ ...txn("1", -420_000), memo: "Invoice 4417 — $4,200 deposit" }];
  const el = await render(<TransactionTable rows={rows} />);
  expect(el.textContent).toContain("$4,200 deposit");
  await act(async () => setHideAmounts(true));
  expect(el.textContent).toContain("Invoice 4417 — $••• deposit");
});

it("offers List / By vendor only when the rows have more than one vendor", async () => {
  const one = await render(<TransactionsSection rows={[txn("1", -100), txn("2", -200)]} />);
  expect(one.textContent).not.toContain("By vendor");
  const two = await render(
    <TransactionsSection
      rows={[txn("1", -100), { ...txn("2", -200), counterparty: "Other Co" }]}
    />,
  );
  expect(two.textContent).toContain("By vendor");
});
