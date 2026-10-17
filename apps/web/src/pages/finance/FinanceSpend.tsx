import { plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { FinanceRecurringOutput, SpendPeriod } from "@rakazo/contracts";
import { Badge } from "@rakazo/ui-web";
import { Link, useNavigate } from "react-router-dom";
import { LineChart, MonthBars } from "../../components/finance/charts";
import {
  Chevron,
  Chip,
  DetailPage,
  HereLink,
  Kpi,
  Kv,
  KvRow,
  PeriodTabs,
  rowClass,
  Section,
  Th,
  TransactionTable,
  toneClass,
  useFinanceQuery,
  useRowNavigate,
  ValueLink,
} from "../../components/finance/ui";
import {
  changeText,
  dayRange,
  lastDayOf,
  money,
  moneyExact,
  monthAxisLabels,
  monthLabel,
  monthShort,
  paidWithLabel,
  shortDay,
  txnDay,
} from "../../lib/finance-format";
import { financePath, type SpendRange } from "../../lib/finance-route";
import { rpc } from "../../lib/rpc";
import { ReceiptIcon } from "./FinanceTransaction";

export function FinanceSpendPage({
  period,
  category,
  range,
}: {
  period: SpendPeriod;
  category: string | null;
  range: SpendRange | null;
}) {
  const navigate = useNavigate();
  const q = useFinanceQuery(
    () =>
      rpc.finance.spend({
        period,
        ...(category ? { category } : {}),
        ...(range ? { from: range.from, to: range.to } : {}),
      }),
    [period, category, range?.from, range?.to],
  );
  const data = q.data;
  const rangeLabel = range ? dayRange(range.from, range.to) : "";
  return (
    <DetailPage
      crumbs={[{ label: t`Finance`, to: financePath.dashboard() }, { label: t`Spend` }]}
      title={<Trans>Spend</Trans>}
      loading={!data}
      error={q.error}
      notFound={q.notFound}
      onRetry={q.retry}
    >
      {data ? (
        <>
          <Section>
            <div className="flex flex-wrap items-center gap-3.5">
              {/* A day or week from the chart is its own range: no period tab is selected while it is shown. */}
              <PeriodTabs
                value={range ? null : period}
                onChange={(next) => navigate(financePath.spend(next, category))}
              />
              <span className="text-lg font-semibold tabular-nums">{money(data.totalCents)}</span>
              {range ? (
                <Badge
                  variant="outline"
                  render={
                    <Link
                      to={financePath.spend(period, category)}
                      aria-label={t`Clear ${rangeLabel}`}
                    />
                  }
                >
                  {rangeLabel} ×
                </Badge>
              ) : data.start && data.end ? (
                <span className="text-xs text-muted-foreground">
                  {dayRange(data.start, lastDayOf(data.end))}
                </span>
              ) : null}
            </div>
          </Section>
          <div className="flex flex-wrap gap-1">
            <Chip to={financePath.spend(period, null, range)} on={!category}>
              <Trans>All</Trans>
            </Chip>
            {data.categories.map((row) => (
              <Chip
                key={row.key}
                to={financePath.spend(period, row.key, range)}
                on={row.key === category}
              >
                {row.label}
              </Chip>
            ))}
          </div>
          <Section>
            <TransactionTable rows={data.transactions} />
          </Section>
        </>
      ) : null}
    </DetailPage>
  );
}

export function FinanceCategoryPage({ slug }: { slug: string }) {
  const q = useFinanceQuery(() => rpc.finance.category({ slug }), [slug]);
  const rowProps = useRowNavigate();
  const data = q.data;
  return (
    <DetailPage
      crumbs={[
        { label: t`Finance`, to: financePath.dashboard() },
        { label: t`Breakdown`, to: `${financePath.dashboard()}#breakdown` },
        { label: data?.label ?? "" },
      ]}
      title={data?.label}
      loading={!data}
      error={q.error}
      notFound={q.notFound}
      onRetry={q.retry}
    >
      {data ? (
        <>
          <Section>
            <div className="flex flex-wrap items-center gap-5">
              <div>
                <h2 className="text-xs font-semibold text-muted-foreground">
                  <Trans>Last 90 days</Trans>
                </h2>
                <div className="text-lg font-semibold tabular-nums">{money(data.last90Cents)}</div>
              </div>
              <div className="min-w-32 flex-1">
                <LineChart
                  values={data.trend.map((p) => p.cents)}
                  labels={[]}
                  height={44}
                  axes={false}
                  label={t`Monthly trend`}
                />
              </div>
            </div>
          </Section>
          <Section title={<Trans>Vendors</Trans>}>
            <table className="w-full border-collapse">
              <tbody>
                {data.vendors.map((vendor) => (
                  <tr
                    key={vendor.key}
                    className={rowClass}
                    {...rowProps(financePath.vendor(vendor.key))}
                  >
                    <td className="font-semibold">
                      <HereLink
                        to={financePath.vendor(vendor.key)}
                        className="outline-none hover:underline focus-visible:underline"
                      >
                        {vendor.label}
                      </HereLink>
                    </td>
                    <td className="text-end tabular-nums">{money(vendor.cents)}</td>
                    <Chevron />
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
          <Section title={<Trans>Recent</Trans>}>
            <TransactionTable rows={data.recent} />
          </Section>
        </>
      ) : null}
    </DetailPage>
  );
}

const cadenceLabel = (cadence: FinanceRecurringOutput["recurring"]["cadence"]) =>
  cadence === "weekly"
    ? t`Weekly`
    : cadence === "biweekly"
      ? t`Every two weeks`
      : cadence === "monthly"
        ? t`Monthly`
        : t`Yearly`;

export function FinanceRecurringPage({ keyName }: { keyName: string }) {
  const q = useFinanceQuery(() => rpc.finance.recurring({ key: keyName }), [keyName]);
  const data = q.data;
  const recurring = data?.recurring;
  return (
    <DetailPage
      crumbs={[
        { label: t`Finance`, to: financePath.dashboard() },
        { label: t`Upcoming`, to: `${financePath.dashboard()}#upcoming` },
        { label: recurring?.name ?? "" },
      ]}
      title={recurring?.name}
      loading={!data}
      error={q.error}
      notFound={q.notFound}
      onRetry={q.retry}
    >
      {data && recurring ? (
        <>
          <Section>
            <Kv>
              <KvRow label={t`Cadence`}>{cadenceLabel(recurring.cadence)}</KvRow>
              <KvRow label={t`Next`}>{shortDay(recurring.nextExpectedAt)}</KvRow>
              <KvRow label={t`Expected`}>{moneyExact(recurring.amountCents)}</KvRow>
              {recurring.classification === "spend" ? (
                <KvRow label={t`Vendor`}>
                  <ValueLink to={financePath.vendor(recurring.key)}>{recurring.name}</ValueLink>
                </KvRow>
              ) : null}
            </Kv>
          </Section>
          <Section title={<Trans>Past charges</Trans>}>
            <TransactionTable rows={data.pastCharges} />
          </Section>
        </>
      ) : null}
    </DetailPage>
  );
}

export function FinanceVendorPage({ keyName }: { keyName: string }) {
  const q = useFinanceQuery(() => rpc.finance.vendor({ key: keyName }), [keyName]);
  const rowProps = useRowNavigate();
  const data = q.data;
  const change = data ? changeText(data.changePct) : null;
  const paidWith = data ? paidWithLabel(data.paidWith) : "";
  // Months before the first charge are not months of zero spend.
  const charged = data ? data.monthly.filter((m) => m.month >= data.firstSeenAt.slice(0, 7)) : [];
  return (
    <DetailPage
      crumbs={[
        { label: t`Finance`, to: financePath.dashboard() },
        // Only a loaded vendor knows which card it belongs to.
        ...(data
          ? [
              {
                label: data.isSubscription ? t`Subscriptions` : t`Breakdown`,
                to: `${financePath.dashboard()}#${data.isSubscription ? "subscriptions" : "breakdown"}`,
              },
              { label: data.name },
            ]
          : []),
      ]}
      title={data?.name}
      loading={!data}
      error={q.error}
      notFound={q.notFound}
      onRetry={q.retry}
    >
      {data ? (
        <>
          <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-4">
            <Kpi
              title={t`Monthly avg`}
              value={money(data.monthlyAvgCents)}
              sub={plural(data.monthlyAvgMonths ?? 6, {
                one: "Last full month",
                other: "Last # full months",
              })}
            />
            <Kpi
              title={t`Change`}
              value={change ? <span className={toneClass(data.changePct)}>{change}</span> : "—"}
              sub={
                data.changePct === null
                  ? t`Not enough history`
                  : data.changeFromMonth
                    ? t`vs ${monthShort(data.changeFromMonth)}`
                    : t`vs 3 mo ago`
              }
            />
            <Kpi title={t`First seen`} value={monthLabel(data.firstSeenAt.slice(0, 7))} />
            <Kpi title={t`Paid with`} value={paidWith || "—"} />
          </div>
          <Section title={<Trans>Monthly spend</Trans>}>
            <MonthBars
              items={charged.map((m, i) => ({
                label: monthAxisLabels(charged.map((x) => x.month))[i] ?? "",
                cents: m.cents,
              }))}
              label={t`Monthly spend`}
            />
          </Section>
          <Section title={<Trans>Charges</Trans>}>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <Th>
                    <Trans>Date</Trans>
                  </Th>
                  <Th>
                    <Trans>Description</Trans>
                  </Th>
                  <Th right>
                    <Trans>Amount</Trans>
                  </Th>
                  <Th right>
                    <Trans>Receipt</Trans>
                  </Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {data.charges.map((charge) => (
                  <tr
                    key={charge.id}
                    className={rowClass}
                    {...rowProps(financePath.transaction(charge.id))}
                  >
                    <td className="w-[4.5rem] whitespace-nowrap pe-2 text-muted-foreground">
                      {shortDay(txnDay(charge))}
                    </td>
                    <td>
                      <HereLink
                        to={financePath.transaction(charge.id)}
                        className="outline-none hover:underline focus-visible:underline"
                      >
                        {charge.memo ?? charge.counterparty}
                      </HereLink>
                    </td>
                    <td className="text-end tabular-nums">{moneyExact(charge.amountCents)}</td>
                    <td className="text-end text-muted-foreground">
                      {charge.hasReceipt ? <ReceiptIcon /> : "—"}
                    </td>
                    <Chevron />
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        </>
      ) : null}
    </DetailPage>
  );
}
