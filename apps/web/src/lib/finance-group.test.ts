import type { FinanceTransaction } from "@rakazo/contracts";
import { expect, test } from "vitest";
import { groupByVendor } from "./finance-group";

const txn = (
  id: string,
  counterparty: string,
  amountCents: number,
  category: string | null = "Servers",
  currency = "USD",
) => ({ id, counterparty, amountCents, category, currency }) as FinanceTransaction;

test("groups case-insensitively on the trimmed name and sums integer cents", () => {
  const groups = groupByVendor([
    txn("1", "Acme Hosting", -1_010),
    txn("2", " acme hosting ", -2_020),
    txn("3", "ACME HOSTING", -1),
  ]);
  expect(groups).toHaveLength(1);
  expect(groups[0]).toMatchObject({ name: "Acme Hosting", totalCents: -3_031n });
  expect(groups[0]?.rows.map((r) => r.id)).toEqual(["1", "2", "3"]);
});

test("sorts by total magnitude, largest first, regardless of sign", () => {
  const groups = groupByVendor([
    txn("1", "Small", -500),
    txn("2", "Big", -90_000),
    txn("3", "Refund Co", 20_000),
  ]);
  expect(groups.map((g) => g.name)).toEqual(["Big", "Refund Co", "Small"]);
});

test("money in and out net inside a vendor with the flat list's sign", () => {
  const [g] = groupByVendor([txn("1", "Globex", -10_000), txn("2", "Globex", 2_500)]);
  expect(g?.totalCents).toBe(-7_500n);
});

test("category is shared, or mixed when the rows differ", () => {
  const groups = groupByVendor([
    txn("1", "Same", -100, "Travel"),
    txn("2", "Same", -100, "Travel"),
    txn("3", "Diff", -100, "Travel"),
    txn("4", "Diff", -100, null),
  ]);
  expect(groups.find((g) => g.name === "Same")).toMatchObject({ category: "Travel", mixed: false });
  expect(groups.find((g) => g.name === "Diff")?.mixed).toBe(true);
});

test("an empty list has no groups", () => {
  expect(groupByVendor([])).toEqual([]);
});

test("the same vendor in two currencies is two groups, never one summed total", () => {
  const groups = groupByVendor([
    txn("1", "Acme", -100, "Servers", "USD"),
    txn("2", "Acme", -100, "Servers", "EUR"),
  ]);
  expect(groups.map((g) => [g.currency, g.totalCents])).toEqual([
    ["USD", -100n],
    ["EUR", -100n],
  ]);
});

test("totals beyond Number.MAX_SAFE_INTEGER keep every cent", () => {
  const big = Number.MAX_SAFE_INTEGER;
  const [g] = groupByVendor([txn("1", "Whale", big), txn("2", "Whale", big), txn("3", "Whale", 1)]);
  expect(g?.totalCents).toBe(BigInt(big) * 2n + 1n);
});

test("an empty counterparty still groups, under an empty name", () => {
  const [g] = groupByVendor([txn("1", "  ", -5), txn("2", "", -5)]);
  expect(g).toMatchObject({ name: "", totalCents: -10n });
});
