import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { FinanceRecurringOutput, SpendPeriod } from "@rakazo/contracts";
import { Link, useNavigate } from "react-router-dom";
import { LineChart, MonthBars } from "../../components/finance/charts";
import {
  Chevron,
  Chip,
  DetailPage,
  Kpi,
  Kv,
  KvRow,
  PeriodTabs,
  rowClass,
  Section,
  Th,
  TransactionsSection,
  toneClass,
  useFinanceQuery,
  useRowNavigate,
  ValueLink,
} from "../../components/finance/ui";
import {
  changeText,
  dayMonth,
  money,
  moneyExact,
  monthAxisLabels,
  monthLabel,
  paidWithLabel,
  shortDay,
} from "../../lib/finance-format";
import { financePath, type SpendRange } from "../../lib/finance-route";
import { useHideAmounts } from "../../lib/hide-amounts-preference";
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
  useHideAmounts();
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
  return (
    <DetailPage
      crumbs={[{ label: t`Finance`, to: financePath.dashboard() }, { label: t`Spend` }]}
      title={<Trans>Spend</Trans>}
      loading={!data}
      error={q.error}
      onRetry={q.retry}
    >
      {data ? (
        <>
          <Section>
            <div className="flex flex-wrap items-center gap-3.5">
              <PeriodTabs
                value={period}
                onChange={(next) => navigate(financePath.spend(next, category))}
              />
              <span className="text-lg font-semibold tabular-nums">{money(data.totalCents)}</span>
              {range ? (
                <span className="text-xs text-muted-foreground">
                  {range.from === range.to
                    ? dayMonth(range.from)
                    : `${dayMonth(range.from)} – ${dayMonth(range.to)}`}
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
          <TransactionsSection rows={data.transactions} />
        </>
      ) : null}
    </DetailPage>
  );
}

export function FinanceCategoryPage({ slug }: { slug: string }) {
  useHideAmounts();
  const q = useFinanceQuery(() => rpc.finance.category({ slug }), [slug]);
  const rowProps = useRowNavigate();
  const data = q.data;
  return (
    <DetailPage
      crumbs={[
        { label: t`Finance`, to: financePath.dashboard() },
        { label: t`Breakdown`, to: financePath.dashboard() },
        { label: data?.label ?? "" },
      ]}
      title={data?.label}
      loading={!data}
      error={q.error}
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
                      <Link
                        to={financePath.vendor(vendor.key)}
                        className="outline-none hover:underline focus-visible:underline"
                      >
                        {vendor.label}
                      </Link>
                    </td>
                    <td className="text-end tabular-nums">{money(vendor.cents)}</td>
                    <Chevron />
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
          <TransactionsSection title={<Trans>Recent</Trans>} rows={data.recent} />
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
  useHideAmounts();
  const q = useFinanceQuery(() => rpc.finance.recurring({ key: keyName }), [keyName]);
  const data = q.data;
  const recurring = data?.recurring;
  return (
    <DetailPage
      crumbs={[
        { label: t`Finance`, to: financePath.dashboard() },
        { label: t`Upcoming`, to: financePath.dashboard() },
        { label: recurring?.name ?? "" },
      ]}
      title={recurring?.name}
      loading={!data}
      error={q.error}
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
          <TransactionsSection title={<Trans>Past charges</Trans>} rows={data.pastCharges} />
        </>
      ) : null}
    </DetailPage>
  );
}

export function FinanceVendorPage({ keyName }: { keyName: string }) {
  useHideAmounts();
  const q = useFinanceQuery(() => rpc.finance.vendor({ key: keyName }), [keyName]);
  const rowProps = useRowNavigate();
  const data = q.data;
  const change = data ? changeText(data.changePct) : null;
  const paidWith = data ? paidWithLabel(data.paidWith) : "";
  return (
    <DetailPage
      crumbs={[
        { label: t`Finance`, to: financePath.dashboard() },
        {
          label: data?.isSubscription ? t`Subscriptions` : t`Vendors`,
          to: financePath.dashboard(),
        },
        { label: data?.name ?? "" },
      ]}
      title={data?.name}
      loading={!data}
      error={q.error}
      onRetry={q.retry}
    >
      {data ? (
        <>
          <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-4">
            <Kpi title={t`Monthly avg`} value={money(data.monthlyAvgCents)} sub={t`6 mo`} />
            <Kpi
              title={t`Change`}
              value={change ? <span className={toneClass(data.changePct)}>{change}</span> : "—"}
              sub={t`vs 3 mo ago`}
            />
            <Kpi title={t`First seen`} value={monthLabel(data.firstSeenAt.slice(0, 7))} />
            <Kpi
              title={t`Paid with`}
              value={<span className="text-xs font-semibold leading-snug">{paidWith || "—"}</span>}
            />
          </div>
          <Section title={<Trans>Monthly spend</Trans>}>
            <MonthBars
              items={data.monthly.map((m, i) => ({
                label: monthAxisLabels(data.monthly.map((x) => x.month))[i] ?? "",
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
                      {shortDay(charge.postedAt)}
                    </td>
                    <td>
                      <Link
                        to={financePath.transaction(charge.id)}
                        className="outline-none hover:underline focus-visible:underline"
                      >
                        {charge.memo ?? charge.counterparty}
                      </Link>
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
