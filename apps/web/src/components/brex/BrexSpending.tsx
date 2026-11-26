import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type {
  BrexSpending as BrexSpendingData,
  BrexSpendingInput,
  BrexSpendTransaction,
} from "@rakazo/contracts";
import { BREX_SPEND_BUCKETS } from "@rakazo/contracts";
import {
  Button,
  cn,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableHeadRow,
  TableRow,
} from "@rakazo/ui-web";
import { CircleAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { money, moneyInList, monthLabel, shareText, shortDay } from "../../lib/finance-format";
import { useHideAmounts } from "../../lib/hide-amounts-preference";
import { sortBy, useListParams } from "../../lib/list-params";
import { rpc } from "../../lib/rpc";
import { useDebounced } from "../../lib/use-debounced";
import { Section, useFinanceQuery } from "../finance/ui";
import { PhoneDateRange, PickFilter, SearchField, SortControl } from "../ListControls";
import { BrexErrorNotice } from "./BrexSection";
import { isSpendBucket, isSpendCents, spendBucketLabel, spendCategoryTotals } from "./brex-utils";

type SpendSort = "date" | "merchant" | "card" | "person" | "category" | "amount";
const SPEND_SORTS: readonly SpendSort[] = [
  "date",
  "merchant",
  "card",
  "person",
  "category",
  "amount",
];
const DEFAULT_SPEND_SORT = { field: "date", dir: "desc" } as const;
const FILTER_PARAMS = ["merchant", "card", "person", "category", "from", "to"] as const;

const cardLabel = (row: BrexSpendTransaction) => {
  const name = row.cardName ?? row.cardId;
  if (!name) return "—";
  return row.cardLastFour ? `${name} ••${row.cardLastFour}` : name;
};

const sortValue = (row: BrexSpendTransaction, field: SpendSort): string | number | null => {
  switch (field) {
    case "date":
      return row.day;
    case "merchant":
      return row.merchant ?? row.description;
    case "card":
      return cardLabel(row);
    case "person":
      return row.userName;
    case "category":
      return row.bucket;
    case "amount":
      return row.amountCents;
  }
};

const monthEnd = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year ?? 1970, monthNumber ?? 1, 0)).toISOString().slice(0, 10);
};

export function BrexSpending() {
  const amountsHidden = useHideAmounts();
  const list = useListParams(SPEND_SORTS, DEFAULT_SPEND_SORT);
  const merchant = list.param("merchant");
  const card = list.param("card");
  const person = list.param("person");
  const categoryParam = list.param("category");
  const category = isSpendBucket(categoryParam) ? categoryParam : undefined;
  const from = list.param("from");
  const to = list.param("to");
  // The box edits the URL at once; the server read waits for a pause in typing.
  const searched = useDebounced(merchant, 300);
  const input: BrexSpendingInput = {
    ...(searched ? { merchant: searched } : {}),
    ...(card ? { cardId: card } : {}),
    ...(person ? { userId: person } : {}),
    ...(category ? { category } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  };
  const query = useFinanceQuery(
    () => rpc.brexCards.spending(input),
    [searched, card, person, category, from, to],
  );
  // Keep the last answer on screen while a new one loads, so the toolbar never unmounts.
  const last = useRef<BrexSpendingData | null>(null);
  if (query.data) last.current = query.data;
  const data = query.data ?? last.current;
  const busy = !query.data && !query.error;
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [options, setOptions] = useState<{
    cards: Map<string, string>;
    people: Map<string, string>;
  }>({ cards: new Map(), people: new Map() });

  useEffect(() => {
    if (!data) return;
    setOptions((current) => {
      const cards = new Map(current.cards);
      const people = new Map(current.people);
      for (const row of data.transactions) {
        if (row.cardId && row.cardName) {
          cards.set(row.cardId, cardLabel(row));
        }
        if (row.userId && row.userName) people.set(row.userId, row.userName);
      }
      return { cards, people };
    });
  }, [data]);

  const spendTransactions = useMemo(
    () => (data?.transactions ?? []).filter((row) => isSpendCents(row.amountCents)),
    [data],
  );
  const rows = useMemo(
    () => sortBy(spendTransactions, (row) => sortValue(row, list.sort.field), list.sort.dir),
    [spendTransactions, list.sort.field, list.sort.dir],
  );
  const categories = useMemo(() => spendCategoryTotals(data?.categories ?? []), [data]);
  const spendTotalCents = useMemo(
    () => categories.reduce((sum, category) => sum + category.cents, 0),
    [categories],
  );
  const duplicates = (data?.duplicates ?? []).filter(
    (row) => !dismissed.has(`${row.month}:${row.merchant.toLowerCase()}`),
  );
  const filtered = FILTER_PARAMS.some((name) => list.param(name));
  const sortNames: Record<SpendSort, string> = {
    date: t`Date`,
    merchant: t`Merchant`,
    card: t`Card`,
    person: t`Person`,
    category: t`Category`,
    amount: t`Amount`,
  };

  if (!data) {
    if (query.error) return <BrexErrorNotice query={query} />;
    return (
      <div role="status" aria-label={t`Loading`}>
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {data.partial ? (
        <p className="text-xs text-muted-foreground">
          <Trans>Partial results</Trans>
        </p>
      ) : null}
      {query.error ? null : (
        <div className={cn("flex flex-col gap-3", busy && "opacity-60")} aria-busy={busy}>
          {duplicates.length > 0 ? (
            <Section title={<Trans>Possible duplicate subscriptions</Trans>}>
              <ul className="flex flex-col gap-3">
                {duplicates.map((row) => {
                  const key = `${row.month}:${row.merchant.toLowerCase()}`;
                  return (
                    <li
                      key={key}
                      className="flex flex-wrap items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3"
                    >
                      <CircleAlert aria-hidden="true" className="mt-0.5 size-4 text-warning" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {row.merchant} · {monthLabel(row.month)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {row.cardNames.join(", ")} · {money(row.cents)} · {row.count}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const monthStart = `${row.month}-01`;
                            const monthFinish = monthEnd(row.month);
                            list.setParams({
                              merchant: row.merchant,
                              from: monthStart < data.range.from ? data.range.from : monthStart,
                              to: monthFinish > data.range.to ? data.range.to : monthFinish,
                              card: undefined,
                              person: undefined,
                              category: undefined,
                            });
                          }}
                        >
                          <Trans>Review</Trans>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDismissed((current) => new Set(current).add(key))}
                        >
                          <Trans>Dismiss</Trans>
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Section>
          ) : null}
          {categories.length > 0 ? (
            <Section title={<Trans>By category</Trans>}>
              <ul className="flex flex-col gap-2.5">
                {categories.map(({ bucket, cents, count }) => {
                  const share = spendTotalCents > 0 ? (cents / spendTotalCents) * 100 : 0;
                  return (
                    <li
                      key={bucket}
                      className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-sm"
                    >
                      <span className="truncate">{spendBucketLabel(bucket)}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {count > 0 ? `${money(cents)} · ${count}` : "—"}
                      </span>
                      <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-muted">
                        <span
                          className={cn("block h-full rounded-full bg-foreground/70")}
                          style={{ width: `${amountsHidden ? 0 : Math.min(100, share)}%` }}
                        />
                      </span>
                      <span className="col-span-2 text-xs text-muted-foreground">
                        {count > 0 ? shareText(cents, spendTotalCents) : ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Section>
          ) : null}
        </div>
      )}
      <Section>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <SearchField
            name="brex-spending-search"
            value={merchant ?? ""}
            onChange={(value) => list.setParam("merchant", value || undefined)}
            placeholder={t`Search merchants`}
            label={t`Search merchants`}
            className="w-56"
          />
          <PickFilter
            label={t`Card`}
            value={card}
            anyLabel={t`Any card`}
            options={[...options.cards].map(([value, label]) => [value, label] as [string, string])}
            empty={t`No cards`}
            onChange={(value) => list.setParam("card", value)}
          />
          <PickFilter
            label={t`Person`}
            value={person}
            anyLabel={t`Anyone`}
            options={[...options.people].map(
              ([value, label]) => [value, label] as [string, string],
            )}
            empty={t`No people`}
            onChange={(value) => list.setParam("person", value)}
          />
          <PhoneDateRange
            label={t`Date range`}
            from={from}
            to={to}
            onChange={(nextFrom, nextTo) => list.setParams({ from: nextFrom, to: nextTo })}
          />
          <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
            <Trans>From</Trans>
            <Input
              type="date"
              aria-label={t`From`}
              min={data.range.from}
              max={data.range.to}
              value={from ?? ""}
              onChange={(event) => list.setParam("from", event.target.value || undefined)}
              className="w-36"
            />
            <Trans>To</Trans>
            <Input
              type="date"
              aria-label={t`To`}
              min={data.range.from}
              max={data.range.to}
              value={to ?? ""}
              onChange={(event) => list.setParam("to", event.target.value || undefined)}
              className="w-36"
            />
          </span>
          <PickFilter
            label={t`Category`}
            value={category}
            anyLabel={t`Any category`}
            options={BREX_SPEND_BUCKETS.map((bucket): [string, string] => [
              bucket,
              spendBucketLabel(bucket),
            ])}
            onChange={(value) => list.setParam("category", value)}
          />
          <span className="ms-auto flex items-center gap-1 @2xl:hidden">
            <SortControl
              fields={SPEND_SORTS.map((field) => [field, sortNames[field]] as [SpendSort, string])}
              field={list.sort.field}
              fieldLabel={sortNames[list.sort.field]}
              direction={list.sort.dir}
              onField={(field) => list.setSort({ field, dir: "asc" })}
              onDirection={(dir) => list.setSort({ field: list.sort.field, dir })}
            />
          </span>
          {filtered ? (
            <Button variant="ghost" size="sm" onClick={() => list.clear(...FILTER_PARAMS)}>
              <Trans>Clear filters</Trans>
            </Button>
          ) : null}
        </div>
        {query.error ? (
          <BrexErrorNotice query={query} />
        ) : (
          <div className={cn("overflow-x-auto", busy && "opacity-60")} aria-busy={busy}>
            <Table compact>
              <TableHeader>
                <TableHeadRow>
                  <TableHead
                    sortDirection={list.sort.field === "date" ? list.sort.dir : null}
                    onSort={() => list.toggleSort("date")}
                  >
                    <Trans>Date</Trans>
                  </TableHead>
                  <TableHead
                    sortDirection={list.sort.field === "merchant" ? list.sort.dir : null}
                    onSort={() => list.toggleSort("merchant")}
                  >
                    <Trans>Merchant</Trans>
                  </TableHead>
                  <TableHead
                    className="hidden @lg:table-cell"
                    sortDirection={list.sort.field === "card" ? list.sort.dir : null}
                    onSort={() => list.toggleSort("card")}
                  >
                    <Trans>Card</Trans>
                  </TableHead>
                  <TableHead
                    className="hidden @lg:table-cell"
                    sortDirection={list.sort.field === "person" ? list.sort.dir : null}
                    onSort={() => list.toggleSort("person")}
                  >
                    <Trans>Person</Trans>
                  </TableHead>
                  <TableHead
                    sortDirection={list.sort.field === "category" ? list.sort.dir : null}
                    onSort={() => list.toggleSort("category")}
                  >
                    <Trans>Category</Trans>
                  </TableHead>
                  <TableHead
                    className="text-end"
                    sortDirection={list.sort.field === "amount" ? list.sort.dir : null}
                    onSort={() => list.toggleSort("amount")}
                  >
                    <Trans>Amount</Trans>
                  </TableHead>
                </TableHeadRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={6} className="py-3 text-muted-foreground">
                      {filtered ? <Trans>No matches</Trans> : <Trans>No card spend yet.</Trans>}
                    </TableCell>
                  </TableRow>
                ) : null}
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {shortDay(row.day)}
                    </TableCell>
                    <TableCell className="font-medium">{row.merchant ?? row.description}</TableCell>
                    <TableCell className="hidden text-muted-foreground @lg:table-cell">
                      {cardLabel(row)}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground @lg:table-cell">
                      {row.userName ?? "—"}
                    </TableCell>
                    <TableCell>{spendBucketLabel(row.bucket)}</TableCell>
                    <TableCell className="text-end tabular-nums">
                      {moneyInList(row.amountCents, undefined, row.currency ?? undefined)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>
    </div>
  );
}
