import { plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { FinanceProvider, FinanceRecurringOutput, SpendPeriod } from "@rakazo/contracts";
import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableHeadRow,
  TableRow,
} from "@rakazo/ui-web";
import { Link, useNavigate } from "react-router-dom";
import { MonthBars } from "../../components/finance/charts";
import {
  Chevron,
  Chip,
  DetailPage,
  HereLink,
  Kpi,
  Kv,
  KvRow,
  PeriodTabs,
  Section,
  TransactionsSection,
  toneClass,
  useFinanceQuery,
  useRowNavigate,
  ValueLink,
  WithEndings,
} from "../../components/finance/ui";
import {
  changeText,
  dayRange,
  lastDayOf,
  money,
  monthAxisLabels,
  monthLabel,
  monthShort,
  paidWithLabel,
  shortDay,
  txnDay,
} from "../../lib/finance-format";
import type { CategoryWindow, SpendRange } from "../../lib/finance-route";
import { financePath } from "../../lib/finance-route";
import { useHideAmounts } from "../../lib/hide-amounts-preference";
import { FINANCE_PROVIDERS } from "../../lib/integrations";
import { rpc } from "../../lib/rpc";
import { ReceiptIcon } from "./FinanceTransaction";

export function FinanceSpendPage({
  period,
  category,
  range,
  source = null,
}: {
  period: SpendPeriod;
  category: string | null;
  range: SpendRange | null;
  /** Only this provider's spend, as opened from Brex on the Burn page. */
  source?: FinanceProvider | null;
}) {
  useHideAmounts();
  const navigate = useNavigate();
  const q = useFinanceQuery(
    () =>
      rpc.finance.spend({
        period,
        ...(category ? { category } : {}),
        ...(range ? { from: range.from, to: range.to } : {}),
        ...(source ? { source } : {}),
      }),
    [period, category, range?.from, range?.to, source],
  );
  const data = q.data;
  const rangeLabel = range ? dayRange(range.from, range.to) : "";
  const sourceName = FINANCE_PROVIDERS.find((p) => p.provider === source)?.name;
  return (
    <DetailPage
      crumbs={[{ label: t`Finance`, to: financePath.dashboard() }, { label: t`Spend` }]}
      title={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Trans>Spend</Trans>
          {sourceName ? (
            <Badge
              variant="outline"
              render={
                <Link
                  to={financePath.spend(period, category, range)}
                  aria-label={t`Clear ${sourceName} filter`}
                />
              }
            >
              {sourceName} ×
            </Badge>
          ) : null}
        </span>
      }
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
                onChange={(next) => navigate(financePath.spend(next, category, null, source))}
              />
              <span className="text-lg font-semibold tabular-nums">{money(data.totalCents)}</span>
              {range ? (
                <Badge
                  variant="outline"
                  render={
                    <Link
                      to={financePath.spend(period, category, null, source)}
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
            <Chip to={financePath.spend(period, null, range, source)} on={!category}>
              <Trans>All</Trans>
            </Chip>
            {data.categories.map((row) => (
              <Chip
                key={row.key}
                to={financePath.spend(period, row.key, range, source)}
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

export function FinanceCategoryPage({ slug, window }: { slug: string; window?: CategoryWindow }) {
  useHideAmounts();
  const q = useFinanceQuery(
    () => rpc.finance.category({ slug, ...window }),
    [slug, JSON.stringify(window ?? null)],
  );
  const rowProps = useRowNavigate();
  const data = q.data;
  // The last six full months, the same window as a vendor's chart (the month still running is left
  // out, as there), so the bars and their amounts fit a phone.
  const trend = data?.trend.slice(-7, -1) ?? [];
  // The total, the vendors and the transactions all cover this one window, named on the page.
  const windowName =
    data?.start && data.end
      ? window
        ? dayRange(data.start, lastDayOf(data.end))
        : t`Last 90 days`
      : t`Last 90 days`;
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
            <h2 className="text-xs font-semibold text-muted-foreground">{windowName}</h2>
            <div className="text-lg font-semibold tabular-nums">{money(data.last90Cents)}</div>
          </Section>
          {/* A labelled monthly chart, not an unlabelled sparkline: which months, how much. */}
          {trend.length > 0 ? (
            <Section
              title={t`Monthly spend · ${monthShort(trend[0]?.month ?? "")} – ${monthShort(trend.at(-1)?.month ?? "")}`}
            >
              <MonthBars
                items={trend.map((m, i) => ({
                  label: monthAxisLabels(trend.map((x) => x.month))[i] ?? "",
                  cents: m.cents,
                }))}
                height={160}
                label={t`Monthly spend`}
              />
            </Section>
          ) : null}
          <Section title={t`Vendors · ${windowName}`}>
            <Table compact>
              <TableBody>
                {data.vendors.map((vendor) => (
                  <TableRow
                    key={vendor.key}
                    className="group/row cursor-pointer"
                    {...rowProps(financePath.vendor(vendor.key))}
                  >
                    <TableCell className="font-semibold">
                      <HereLink
                        to={financePath.vendor(vendor.key)}
                        className="outline-none hover:underline focus-visible:underline"
                      >
                        {vendor.label}
                      </HereLink>
                    </TableCell>
                    <TableCell className="text-end tabular-nums">{money(vendor.cents)}</TableCell>
                    <Chevron />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Section>
          <TransactionsSection title={t`Transactions · ${windowName}`} rows={data.recent} />
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
              <KvRow label={t`Expected`}>{money(recurring.amountCents)}</KvRow>
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
  // Months before the first charge are not months of zero spend.
  const charged = data ? data.monthly.filter((m) => m.month >= data.firstSeenAt.slice(0, 7)) : [];
  const hasReceipts = data?.charges.some((charge) => charge.hasReceipt) ?? false;
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
                  : data.changeFromMonth && data.monthly.at(-1)
                    ? t`${monthShort(data.monthly.at(-1)?.month ?? "")} vs ${monthShort(data.changeFromMonth)}`
                    : t`Last month vs 3 mo ago`
              }
            />
            <Kpi title={t`First seen`} value={monthLabel(data.firstSeenAt.slice(0, 7))} />
            <Kpi title={t`Paid with`} value={paidWith ? <WithEndings text={paidWith} /> : "—"} />
          </div>
          <Section
            title={
              charged.length > 0
                ? t`Monthly spend · ${monthShort(charged[0]?.month ?? "")} – ${monthShort(charged.at(-1)?.month ?? "")}`
                : t`Monthly spend`
            }
          >
            <MonthBars
              items={charged.map((m, i) => ({
                label: monthAxisLabels(charged.map((x) => x.month))[i] ?? "",
                cents: m.cents,
              }))}
              label={t`Monthly spend`}
            />
          </Section>
          <Section
            title={charged[0] ? t`Charges since ${shortDay(`${charged[0].month}-01`)}` : t`Charges`}
          >
            <Table compact>
              <TableHeader>
                <TableHeadRow>
                  <TableHead>
                    <Trans>Date</Trans>
                  </TableHead>
                  <TableHead>
                    <Trans>Description</Trans>
                  </TableHead>
                  <TableHead className="text-end">
                    <Trans>Amount</Trans>
                  </TableHead>
                  {hasReceipts ? (
                    <TableHead className="text-end">
                      <Trans>Receipt</Trans>
                    </TableHead>
                  ) : null}
                  <TableHead />
                </TableHeadRow>
              </TableHeader>
              <TableBody>
                {data.charges.map((charge) => (
                  <TableRow
                    key={charge.id}
                    className="group/row cursor-pointer"
                    {...rowProps(financePath.transaction(charge.id))}
                  >
                    <TableCell className="w-[4.5rem] whitespace-nowrap pe-2 text-muted-foreground">
                      {shortDay(txnDay(charge))}
                    </TableCell>
                    <TableCell>
                      <HereLink
                        to={financePath.transaction(charge.id)}
                        className="outline-none hover:underline focus-visible:underline"
                      >
                        {charge.memo ?? charge.counterparty}
                      </HereLink>
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {money(charge.amountCents)}
                    </TableCell>
                    {hasReceipts ? (
                      <TableCell className="text-end text-muted-foreground">
                        {charge.hasReceipt ? <ReceiptIcon /> : "—"}
                      </TableCell>
                    ) : null}
                    <Chevron />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Section>
        </>
      ) : null}
    </DetailPage>
  );
}
