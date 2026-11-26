import type { Subscription, UpcomingItem } from "@rakazo/contracts";
import { paidWithLabel } from "./finance-format";
import type { Sort } from "./list-params";
import { sortBy } from "./list-params";

const matches = (needle: string | undefined, ...texts: string[]) => {
  const q = needle?.trim().toLowerCase();
  return !q || texts.some((text) => text.toLowerCase().includes(q));
};

export const UPCOMING_SORTS = ["date", "amount", "name"] as const;
export type UpcomingSort = (typeof UPCOMING_SORTS)[number];
export const DEFAULT_UPCOMING_SORT: Sort<UpcomingSort> = { field: "date", dir: "asc" };

/** Upcoming items whose name contains the search text and that are of the chosen kind. */
export function filterUpcoming(
  items: UpcomingItem[],
  { q, kind }: { q?: string | undefined; kind?: string | undefined },
) {
  return items.filter((item) => matches(q, item.name) && (!kind || item.kind === kind));
}

export function sortUpcoming(items: UpcomingItem[], { field, dir }: Sort<UpcomingSort>) {
  return sortBy(
    items,
    (item) =>
      field === "date"
        ? (item.dates[0] ?? "")
        : field === "amount"
          ? item.amountCents
          : item.name.trim(),
    dir,
  );
}

export const SUBSCRIPTION_SORTS = ["monthly", "name", "lastCharge"] as const;
export type SubscriptionSort = (typeof SUBSCRIPTION_SORTS)[number];
/** The dashboard lists the biggest first, and so does the full list. */
export const DEFAULT_SUBSCRIPTION_SORT: Sort<SubscriptionSort> = { field: "monthly", dir: "desc" };

/** Subscriptions whose name contains the search text and that are paid with the chosen account or card (as `paidWithLabel` words it). */
export function filterSubscriptions(
  items: Subscription[],
  { q, paidWith }: { q?: string | undefined; paidWith?: string | undefined },
) {
  return items.filter(
    (sub) => matches(q, sub.name) && (!paidWith || paidWithLabel(sub.paidWith) === paidWith),
  );
}

export function sortSubscriptions(items: Subscription[], { field, dir }: Sort<SubscriptionSort>) {
  return sortBy(
    items,
    (sub) =>
      field === "monthly"
        ? sub.monthlyCents
        : field === "name"
          ? sub.name.trim()
          : sub.lastChargeAt,
    dir,
  );
}
