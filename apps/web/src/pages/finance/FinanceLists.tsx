import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Button } from "@rakazo/ui-web";
import { SubscriptionsTable, UpcomingRow } from "../../components/finance/UpcomingSubscriptions";
import { DetailPage, Section, useFinanceQuery } from "../../components/finance/ui";
import { PickFilter, SearchField, SortControl } from "../../components/ListControls";
import { paidWithLabel } from "../../lib/finance-format";
import {
  DEFAULT_SUBSCRIPTION_SORT,
  DEFAULT_UPCOMING_SORT,
  filterSubscriptions,
  filterUpcoming,
  SUBSCRIPTION_SORTS,
  sortSubscriptions,
  sortUpcoming,
  UPCOMING_SORTS,
} from "../../lib/finance-lists";
import { financePath } from "../../lib/finance-route";
import { useListParams } from "../../lib/list-params";
import { rpc } from "../../lib/rpc";

const unique = (values: string[]): [string, string][] =>
  [...new Set(values)].sort((a, b) => a.localeCompare(b)).map((v) => [v, v]);

function NoMatches({ onClear }: { onClear: () => void }) {
  return (
    <span className="flex items-center gap-3 py-2 text-muted-foreground">
      <Trans>No matches</Trans>
      <Button variant="outline" size="sm" onClick={onClear}>
        <Trans>Clear filters</Trans>
      </Button>
    </span>
  );
}

/** Every upcoming charge in the next 30 days, with search, a type filter and a sort. */
export function FinanceUpcomingPage() {
  const q = useFinanceQuery(() => rpc.finance.overview(), []);
  const list = useListParams(UPCOMING_SORTS, DEFAULT_UPCOMING_SORT);
  const items = q.data?.upcoming.items ?? [];
  const filters = { q: list.param("q"), kind: list.param("type") };
  const shown = sortUpcoming(filterUpcoming(items, filters), list.sort);
  const kinds: [string, string][] = [
    ["recurring", t`Recurring`],
    ["pending", t`Pending`],
    ["bill", t`Bill`],
  ];
  const names = { date: t`Date`, amount: t`Amount`, name: t`Name` };
  return (
    <DetailPage
      crumbs={[
        { label: t`Finance`, to: financePath.dashboard() },
        { label: t`Upcoming · 30 days` },
      ]}
      title={<Trans>Upcoming · 30 days</Trans>}
      loading={!q.data}
      error={q.error}
      notFound={q.notFound}
      onRetry={q.retry}
    >
      <Section>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <SearchField
            name="upcoming-search"
            value={filters.q ?? ""}
            onChange={(value) => list.setParam("q", value)}
            placeholder={t`Search upcoming`}
            label={t`Search upcoming`}
            className="w-56"
          />
          <PickFilter
            label={t`Type`}
            value={filters.kind}
            options={kinds.filter(([kind]) => items.some((item) => item.kind === kind))}
            onChange={(value) => list.setParam("type", value)}
          />
          <span className="ms-auto">
            <SortControl
              fields={UPCOMING_SORTS.map((field) => [field, names[field]])}
              field={list.sort.field}
              fieldLabel={names[list.sort.field]}
              direction={list.sort.dir}
              onField={(field) => list.setSort({ field, dir: "asc" })}
              onDirection={(dir) => list.setSort({ field: list.sort.field, dir })}
            />
          </span>
        </div>
        <div className="-mx-2">
          {shown.map((item) => (
            <UpcomingRow key={`${item.kind}:${item.key}`} item={item} />
          ))}
        </div>
        {shown.length === 0 ? (
          Object.values(filters).some(Boolean) ? (
            <NoMatches onClear={() => list.clear("q", "type")} />
          ) : (
            <div className="py-2 text-muted-foreground">
              <Trans>Nothing due in the next 30 days</Trans>
            </div>
          )
        ) : null}
      </Section>
    </DetailPage>
  );
}

/** Every subscription, with search, a paid-with filter and a sort. */
export function FinanceSubscriptionsPage() {
  const q = useFinanceQuery(() => rpc.finance.overview(), []);
  const list = useListParams(SUBSCRIPTION_SORTS, DEFAULT_SUBSCRIPTION_SORT);
  const subs = q.data?.subscriptions;
  const items = subs?.items ?? [];
  const filters = { q: list.param("q"), paidWith: list.param("paid") };
  const shown = sortSubscriptions(filterSubscriptions(items, filters), list.sort);
  const names = { monthly: t`Per month`, name: t`Vendor`, lastCharge: t`Last charge` };
  return (
    <DetailPage
      crumbs={[{ label: t`Finance`, to: financePath.dashboard() }, { label: t`Subscriptions` }]}
      title={<Trans>Subscriptions</Trans>}
      loading={!q.data}
      error={q.error}
      notFound={q.notFound}
      onRetry={q.retry}
    >
      <Section>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <SearchField
            name="subscriptions-search"
            value={filters.q ?? ""}
            onChange={(value) => list.setParam("q", value)}
            placeholder={t`Search subscriptions`}
            label={t`Search subscriptions`}
            className="w-56"
          />
          <PickFilter
            label={t`Paid with`}
            value={filters.paidWith}
            options={unique(items.map((sub) => paidWithLabel(sub.paidWith)).filter(Boolean))}
            onChange={(value) => list.setParam("paid", value)}
          />
          <span className="ms-auto">
            <SortControl
              fields={SUBSCRIPTION_SORTS.map((field) => [field, names[field]])}
              field={list.sort.field}
              fieldLabel={names[list.sort.field]}
              direction={list.sort.dir}
              onField={(field) => list.setSort({ field, dir: "asc" })}
              onDirection={(dir) => list.setSort({ field: list.sort.field, dir })}
            />
          </span>
        </div>
        {subs && shown.length > 0 ? <SubscriptionsTable subs={subs} rows={shown} /> : null}
        {shown.length === 0 && subs ? (
          Object.values(filters).some(Boolean) ? (
            <NoMatches onClear={() => list.clear("q", "paid")} />
          ) : (
            <div className="py-2 text-muted-foreground">
              <Trans>None yet. A vendor shows here after three similar monthly charges.</Trans>
            </div>
          )
        ) : null}
      </Section>
    </DetailPage>
  );
}
