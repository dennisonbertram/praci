import type { Subscription, UpcomingItem } from "@rakazo/contracts";
import { expect, it } from "vitest";
import {
  filterSubscriptions,
  filterUpcoming,
  sortSubscriptions,
  sortUpcoming,
} from "./finance-lists";

const upcoming = (
  key: string,
  name: string,
  kind: UpcomingItem["kind"],
  day: string,
  cents: number,
) => ({ key, name, kind, dates: [day], amountCents: cents }) as UpcomingItem;
const items = [
  upcoming("a", "Cedar Mail", "recurring", "2026-11-20", 500),
  upcoming("b", "Anchor Labs", "bill", "2026-11-05", 9000),
  upcoming("c", "Birch Cloud", "pending", "2026-11-12", 1200),
];

it("filters upcoming by search and kind", () => {
  expect(filterUpcoming(items, { q: "ANCHOR" }).map((i) => i.key)).toEqual(["b"]);
  expect(filterUpcoming(items, { kind: "pending" }).map((i) => i.key)).toEqual(["c"]);
  expect(filterUpcoming(items, { q: "anchor", kind: "pending" })).toEqual([]);
});

it("sorts upcoming by date, amount and name in both directions", () => {
  const keys = (field: "date" | "amount" | "name", dir: "asc" | "desc") =>
    sortUpcoming(items, { field, dir }).map((i) => i.key);
  expect(keys("date", "asc")).toEqual(["b", "c", "a"]);
  expect(keys("amount", "desc")).toEqual(["b", "c", "a"]);
  expect(keys("name", "asc")).toEqual(["b", "c", "a"]);
  expect(keys("date", "desc")).toEqual(["a", "c", "b"]);
});

const sub = (key: string, name: string, monthly: number, last: string, card: string | null) =>
  ({
    key,
    name,
    monthlyCents: monthly,
    trendCents: [0, 0, 0, 0],
    lastChargeAt: last,
    overlapGroup: null,
    paidWith: card ? [{ provider: "brex", kind: "card", name: "Card", lastFour: card }] : [],
  }) as Subscription;
const subs = [
  sub("x", "Delta Docs", 2000, "2026-10-01", "1111"),
  sub("y", "Ember Design", 8000, "2026-10-20", "2222"),
  sub("z", "Fjord Pay", 500, "2026-10-10", "1111"),
];

it("filters subscriptions by search and card", () => {
  expect(filterSubscriptions(subs, { q: "design" }).map((s) => s.key)).toEqual(["y"]);
  expect(filterSubscriptions(subs, { paidWith: "Brex ••1111" }).map((s) => s.key)).toEqual([
    "x",
    "z",
  ]);
});

it("sorts subscriptions by monthly cost, name and last charge", () => {
  const keys = (field: "monthly" | "name" | "lastCharge", dir: "asc" | "desc") =>
    sortSubscriptions(subs, { field, dir }).map((s) => s.key);
  expect(keys("monthly", "desc")).toEqual(["y", "x", "z"]);
  expect(keys("name", "asc")).toEqual(["x", "y", "z"]);
  expect(keys("lastCharge", "desc")).toEqual(["y", "z", "x"]);
});
