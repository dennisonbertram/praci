import type { FinanceTransaction } from "@rakazo/contracts";
import { expect, it } from "vitest";
import { groupByVendor } from "./finance-group";
import {
  filterTransactions,
  sortTransactionGroups,
  sortTransactions,
} from "./finance-transaction-list";

const txn = (id: string, over: Partial<FinanceTransaction> = {}) =>
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
const label = (r: Pick<FinanceTransaction, "category">) => r.category ?? "Uncategorized";
const ids = (rows: FinanceTransaction[]) => rows.map((r) => r.id);

const rows = [
  txn("a", { counterparty: "Acme", memo: "Annual plan", postedAt: "2026-10-03T00:00:00Z" }),
  txn("b", { counterparty: "Zed", category: null, status: "pending", amountCents: -900 }),
  txn("c", { counterparty: "Beta", category: "Travel", amountCents: 500 }),
];

it("searches counterparty, memo and category and filters category and status", () => {
  const f = (o: Parameters<typeof filterTransactions>[1]) =>
    ids(filterTransactions(rows, o, label));
  expect(f({ q: " zED " })).toEqual(["b"]);
  expect(f({ q: "annual" })).toEqual(["a"]);
  expect(f({ q: "travel" })).toEqual(["c"]);
  expect(f({ category: "Uncategorized" })).toEqual(["b"]);
  expect(f({ status: "pending" })).toEqual(["b"]);
  expect(f({ q: "a", status: "posted", category: "Travel" })).toEqual(["c"]);
});

it("sorts by each column in both directions, date newest first by default", () => {
  const s = (field: Parameters<typeof sortTransactions>[1]["field"], dir: "asc" | "desc") =>
    ids(sortTransactions(rows, { field, dir }, label));
  expect(s("date", "desc")).toEqual(["a", "b", "c"]);
  expect(s("date", "asc")).toEqual(["b", "c", "a"]);
  expect(s("counterparty", "asc")).toEqual(["a", "c", "b"]);
  expect(s("category", "asc")).toEqual(["a", "c", "b"]);
  expect(s("amount", "asc")).toEqual(["b", "a", "c"]);
  expect(s("amount", "desc")).toEqual(["c", "a", "b"]);
});

it("sorts vendor groups by their total, and by name or category for those columns", () => {
  const many = [
    txn("1", { counterparty: "Acme", amountCents: -100 }),
    txn("2", { counterparty: "Acme", amountCents: -100 }),
    txn("3", { counterparty: "Zed", amountCents: -150, category: "Ads" }),
    txn("4", { counterparty: "Beta", amountCents: 900, category: "Travel" }),
  ];
  const g = (field: Parameters<typeof sortTransactions>[1]["field"], dir: "asc" | "desc") =>
    sortTransactionGroups(groupByVendor(many), { field, dir }, label).map((x) => x.name);
  expect(g("amount", "asc")).toEqual(["Acme", "Zed", "Beta"]);
  expect(g("amount", "desc")).toEqual(["Beta", "Zed", "Acme"]);
  expect(g("counterparty", "desc")).toEqual(["Zed", "Beta", "Acme"]);
  expect(g("category", "asc")).toEqual(["Zed", "Acme", "Beta"]);
  // Date keeps the largest-total-first order the groups already have.
  expect(g("date", "desc")).toEqual(["Beta", "Acme", "Zed"]);
});
