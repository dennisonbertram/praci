import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { FinanceOverview, UpcomingItem } from "@rakazo/contracts";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableHeadRow,
  TableRow,
} from "@rakazo/ui-web";
import { ChevronRight } from "lucide-react";
import {
  fullDay,
  money,
  moneyExact,
  paidWithLabel,
  shortDay,
  trendText,
} from "../../lib/finance-format";
import { financePath } from "../../lib/finance-route";
import { useHideAmounts } from "../../lib/hide-amounts-preference";
import { Chevron, HereLink, Kv, KvRow, useRowNavigate } from "./ui";

const upcomingTag = ({ kind, cardBill }: UpcomingItem) =>
  cardBill
    ? t`card bill`
    : kind === "recurring"
      ? t`recurring`
      : kind === "pending"
        ? t`pending`
        : t`bill`;

/** `APPROVED` reads `Approved`. */
const billStatusText = (status: string) =>
  status.charAt(0).toUpperCase() + status.slice(1).toLowerCase().replaceAll("_", " ");

const upcomingRowClass =
  "grid w-full grid-cols-[minmax(0,1fr)_auto_0.875rem] items-center gap-2.5 border-t border-border px-2 py-2 text-start first:border-t-0 @md:grid-cols-[minmax(5rem,auto)_1fr_auto_0.875rem]";
const upcomingLinkClass = `${upcomingRowClass} outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-foreground`;

export function UpcomingRow({ item }: { item: UpcomingItem }) {
  useHideAmounts();
  const to =
    item.kind === "recurring"
      ? financePath.recurring(item.key)
      : item.kind === "pending"
        ? financePath.transaction(item.key)
        : null;
  const dates = item.dates.map((d) => shortDay(d)).join(" · ");
  const body = (
    <>
      <span className="hidden text-muted-foreground @md:inline">{dates}</span>
      {/* Narrow, the name gets the whole first line; the dates and tag sit under it. */}
      <span className="flex min-w-0 flex-col items-start gap-0.5 @md:flex-row @md:items-center @md:gap-1.5">
        <span className="min-w-0 max-w-full truncate">{item.name}</span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="@md:hidden">{dates}</span>
          {item.kind === "recurring" && !item.cardBill ? null : (
            <span className="shrink-0 rounded-full border border-border px-1.5 text-xs">
              {upcomingTag(item)}
            </span>
          )}
        </span>
      </span>
      <span className="text-end tabular-nums">
        {money(item.amountCents)}
        {item.dates.length > 1 ? ` ×${item.dates.length}` : ""}
      </span>
      <ChevronRight aria-hidden="true" className="size-3.5 text-muted-foreground" />
    </>
  );
  if (to) {
    return (
      <HereLink to={to} className={upcomingLinkClass}>
        {body}
      </HereLink>
    );
  }
  // A bill has no page of its own: its details open in place.
  const due = item.dueAt ?? item.dates[0] ?? "";
  const overdue = item.dates[0] !== undefined && due < item.dates[0];
  return (
    <Popover>
      <PopoverTrigger className={upcomingLinkClass}>{body}</PopoverTrigger>
      <PopoverContent align="end">
        <PopoverHeader>
          <PopoverTitle>{item.name}</PopoverTitle>
          <PopoverDescription>
            <Trans>Brex bill, not paid yet</Trans>
          </PopoverDescription>
        </PopoverHeader>
        <Kv>
          <KvRow label={t`Amount`}>{moneyExact(item.amountCents)}</KvRow>
          <KvRow label={t`Due`}>{overdue ? t`${fullDay(due)} (overdue)` : fullDay(due)}</KvRow>
          {item.billStatus ? (
            <KvRow label={t`Status`}>{billStatusText(item.billStatus)}</KvRow>
          ) : null}
        </Kv>
      </PopoverContent>
    </Popover>
  );
}

/** The other subscription in the same overlap group (the list is largest first), named. */
function similarTo(
  items: FinanceOverview["subscriptions"]["items"],
  sub: { key: string; overlapGroup: string | null },
) {
  const other = items.find((o) => o.overlapGroup === sub.overlapGroup && o.key !== sub.key);
  return other ? t`Similar to ${other.name}` : null;
}

export function SubscriptionsTable({
  subs,
  rows,
}: {
  subs: FinanceOverview["subscriptions"];
  rows: FinanceOverview["subscriptions"]["items"];
}) {
  useHideAmounts();
  const rowProps = useRowNavigate();
  // A column that is empty on most rows reads as broken; the change then shows under the name.
  const showTrend = rows.filter((r) => trendText(r.trendCents)).length * 2 >= rows.length;
  return (
    <Table compact>
      <TableHeader>
        <TableHeadRow>
          <TableHead>
            <Trans>Vendor</Trans>
          </TableHead>
          <TableHead
            className="text-end whitespace-nowrap"
            title={t`The usual charge scaled to a month, or for usage-based vendors the average of recent full months. The vendor page shows the same figure.`}
          >
            <Trans>Per month</Trans>
          </TableHead>
          {showTrend ? (
            <TableHead className="text-end hidden whitespace-nowrap @md:table-cell">
              <Trans>3-mo change</Trans>
            </TableHead>
          ) : null}
          <TableHead className="text-end hidden whitespace-nowrap @md:table-cell">
            <Trans>Last charge</Trans>
          </TableHead>
          <TableHead />
        </TableHeadRow>
      </TableHeader>
      <TableBody>
        {rows.map((sub) => {
          const paidWith = paidWithLabel(sub.paidWith);
          const similar = sub.overlapGroup ? similarTo(subs.items, sub) : null;
          const name = sub.name;
          return (
            <TableRow
              key={sub.key}
              className="group/row cursor-pointer"
              {...rowProps(financePath.vendor(sub.key))}
            >
              <TableCell className="font-semibold">
                <HereLink
                  to={financePath.vendor(sub.key)}
                  aria-label={paidWith ? t`${name}, paid with ${paidWith}` : name}
                  className="rk-tap outline-none hover:underline focus-visible:underline"
                >
                  {sub.name}
                </HereLink>
                {trendText(sub.trendCents) ? (
                  <span
                    className={`ms-1.5 text-xs font-normal tabular-nums text-muted-foreground ${showTrend ? "@md:hidden" : ""}`}
                  >
                    {trendText(sub.trendCents)}
                  </span>
                ) : null}
                {similar ? " " : null}
                {similar ? (
                  <span
                    title={similar}
                    className="inline-block max-w-full truncate rounded-full border border-border px-1.5 align-middle text-xs font-normal text-muted-foreground"
                  >
                    {similar}
                  </span>
                ) : null}
                {paidWith ? (
                  <span
                    role="tooltip"
                    className="pointer-events-none invisible ms-2.5 hidden whitespace-nowrap rounded-full bg-primary px-2.5 py-0.5 align-middle text-xs font-normal leading-4 text-primary-foreground group-focus-within/row:visible group-hover/row:visible @md:inline-block"
                  >
                    {paidWith}
                  </span>
                ) : null}
              </TableCell>
              <TableCell className="text-end tabular-nums">{money(sub.monthlyCents)}</TableCell>
              {showTrend ? (
                <TableCell className="hidden w-[90px] whitespace-nowrap text-end tabular-nums text-muted-foreground @md:table-cell">
                  {trendText(sub.trendCents)}
                </TableCell>
              ) : null}
              <TableCell className="hidden whitespace-nowrap text-end text-muted-foreground @md:table-cell">
                {shortDay(sub.lastChargeAt)}
              </TableCell>
              <Chevron />
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
