import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableHeadRow,
  TableRow,
} from "@rakazo/ui-web";
import { useNavigate } from "react-router-dom";
import { CountCryptoButton } from "../../components/finance/CountCryptoButton";
import { BurnLines, LineChart } from "../../components/finance/charts";
import {
  BreakdownRows,
  BurnLegend,
  Chevron,
  DetailPage,
  HereLink,
  Kpi,
  Kv,
  KvRow,
  Section,
  TransactionsSection,
  useFinanceQuery,
  useRowNavigate,
} from "../../components/finance/ui";
import {
  fullDay,
  money,
  monthAxisLabels,
  monthFull,
  monthLabel,
  monthShort,
  runwayText,
  shareText,
} from "../../lib/finance-format";
import { financePath } from "../../lib/finance-route";
import { useHideAmounts } from "../../lib/hide-amounts-preference";
import { rpc } from "../../lib/rpc";

const burnCrumbs = () => [
  { label: t`Finance`, to: financePath.dashboard() },
  { label: t`Burn`, to: financePath.burn() },
];

/** The last day of a `YYYY-MM` month. */
const monthEnd = (month: string) =>
  new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0))
    .toISOString()
    .slice(0, 10);

const netText = (cents: number) => `${cents < 0 ? "−" : "+"}${money(cents)}`;

/** The months from the first one with any money in or out; earlier months had no data, not zero spend. */
export function fromFirstData<
  T extends { outCents: number; revenueCents: number; financingCents: number },
>(series: T[]): T[] {
  const first = series.findIndex((m) => m.outCents || m.revenueCents || m.financingCents);
  return first < 0 ? series.slice(-1) : series.slice(first);
}

export function FinanceBurnPage() {
  useHideAmounts();
  const q = useFinanceQuery(() => rpc.finance.burn(), []);
  const navigate = useNavigate();
  const rowProps = useRowNavigate();
  const data = q.data;
  const first = data?.windowMonths[0];
  const last = data?.windowMonths.at(-1);
  const brexCents = data?.brexCents ?? 0;
  // An account where deposits or refunds outweigh charges spent nothing; it is not shown as spend.
  const spentAccounts = data?.byAccount.filter((a) => a.cents > 0) ?? [];
  const accountTotal = spentAccounts.reduce((sum, a) => sum + a.cents, 0) + brexCents || 1;
  const series = data ? fromFirstData(data.series) : [];
  // Brex spend has no account page, so its row lists the Brex charges behind the same figure.
  const brexSpend =
    first && last
      ? financePath.spend("month", null, { from: `${first}-01`, to: monthEnd(last) }, "brex")
      : financePath.spend("month", null, null, "brex");
  return (
    <DetailPage
      crumbs={[{ label: t`Finance`, to: financePath.dashboard() }, { label: t`Burn` }]}
      title={<Trans>Burn</Trans>}
      loading={!data}
      error={q.error}
      notFound={q.notFound}
      onRetry={q.retry}
    >
      {data ? (
        <>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
            <Kpi
              title={t`Monthly burn`}
              value={data.monthlyCents > 0 ? money(data.monthlyCents) : "—"}
              sub={t`3-mo avg, after revenue`}
            />
          </div>
          <Section title={<Trans>Burn</Trans>} action={<BurnLegend />}>
            <BurnLines
              series={series.map(({ month, ...rest }) => ({
                ...rest,
                start: `${month}-01`,
                end: `${month}-01`,
              }))}
              label={t`Cash out and cash in by month`}
              onOpen={(point) => navigate(financePath.month(point.start.slice(0, 7)))}
            />
            {series.at(-1)?.partial ? (
              <div className="text-xs text-muted-foreground">
                <Trans>* Month to date</Trans>
              </div>
            ) : null}
          </Section>
          <div className="grid items-start gap-3 @3xl:grid-cols-2">
            <Section
              title={<Trans>Where it went</Trans>}
              action={
                first && last ? (
                  <span className="text-xs text-muted-foreground">
                    {monthShort(first)}–{monthShort(last)}
                  </span>
                ) : null
              }
            >
              <BreakdownRows rows={data.whereItWent} to={(row) => financePath.category(row.key)} />
            </Section>
            <Section title={<Trans>By account</Trans>}>
              <Table compact>
                <TableBody>
                  {spentAccounts.map(({ account, cents }) => (
                    <TableRow
                      key={account.id}
                      className="group/row cursor-pointer"
                      {...rowProps(financePath.account(account.id))}
                    >
                      <TableCell className="font-semibold">
                        <HereLink
                          to={financePath.account(account.id)}
                          className="outline-none hover:underline focus-visible:underline"
                        >
                          {account.name}
                        </HereLink>
                      </TableCell>
                      <TableCell className="text-end tabular-nums">{money(cents)}</TableCell>
                      <TableCell className="text-end text-muted-foreground tabular-nums">
                        {shareText(cents, accountTotal)}
                      </TableCell>
                      <Chevron />
                    </TableRow>
                  ))}
                  {brexCents > 0 ? (
                    <TableRow className="group/row cursor-pointer" {...rowProps(brexSpend)}>
                      <TableCell className="font-semibold">
                        <HereLink
                          to={brexSpend}
                          className="outline-none hover:underline focus-visible:underline"
                        >
                          Brex
                        </HereLink>
                      </TableCell>
                      <TableCell className="text-end tabular-nums">{money(brexCents)}</TableCell>
                      <TableCell className="text-end text-muted-foreground tabular-nums">
                        {shareText(brexCents, accountTotal)}
                      </TableCell>
                      <Chevron />
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </Section>
          </div>
          <Section title={<Trans>By month</Trans>}>
            <Table compact>
              <TableHeader>
                <TableHeadRow>
                  <TableHead>
                    <Trans>Month</Trans>
                  </TableHead>
                  <TableHead className="text-end">
                    <Trans>Out</Trans>
                  </TableHead>
                  <TableHead className="text-end">
                    <Trans>In</Trans>
                  </TableHead>
                  <TableHead className="text-end">
                    <Trans>Net</Trans>
                  </TableHead>
                  <TableHead />
                </TableHeadRow>
              </TableHeader>
              <TableBody>
                {[...series].reverse().map((m) => {
                  const inCents = m.revenueCents + m.financingCents;
                  const net = inCents - m.outCents;
                  return (
                    <TableRow
                      key={m.month}
                      className="group/row cursor-pointer"
                      {...rowProps(financePath.month(m.month))}
                    >
                      <TableCell>
                        <HereLink
                          to={financePath.month(m.month)}
                          className="outline-none hover:underline focus-visible:underline"
                        >
                          {monthLabel(m.month)}
                        </HereLink>
                      </TableCell>
                      <TableCell className="text-end tabular-nums">{money(m.outCents)}</TableCell>
                      <TableCell className="text-end tabular-nums">
                        {inCents ? money(inCents) : "—"}
                      </TableCell>
                      <TableCell
                        className={`text-end tabular-nums ${net < 0 ? "text-destructive" : "text-success"}`}
                      >
                        {netText(net)}
                      </TableCell>
                      <Chevron />
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Section>
        </>
      ) : null}
    </DetailPage>
  );
}

export function FinanceMonthPage({ month }: { month: string }) {
  useHideAmounts();
  const q = useFinanceQuery(() => rpc.finance.month({ month }), [month]);
  const data = q.data;
  return (
    <DetailPage
      crumbs={[...burnCrumbs(), { label: monthLabel(month) }]}
      title={monthFull(month)}
      subtitle={data?.partial ? <Trans>Month to date</Trans> : null}
      loading={!data}
      error={q.error}
      notFound={q.notFound}
      onRetry={q.retry}
    >
      {data ? (
        <>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
            <Kpi title={t`Out`} value={money(data.outCents)} />
            <Kpi title={t`In`} value={money(data.inCents)} />
            <Kpi
              title={t`Net`}
              value={
                <span className={data.netCents < 0 ? "text-destructive" : "text-success"}>
                  {netText(data.netCents)}
                </span>
              }
            />
          </div>
          <Section title={<Trans>Categories</Trans>}>
            <BreakdownRows
              rows={data.categories}
              to={(row) => financePath.category(row.key, { month })}
            />
          </Section>
          <TransactionsSection title={<Trans>Transactions</Trans>} rows={data.transactions} />
        </>
      ) : null}
    </DetailPage>
  );
}

/** A Cash line on the Runway page, saying when the saved scope leaves it out of runway. */
function Counted({ on, children }: { on: boolean; children: string }) {
  return on ? (
    <>{children}</>
  ) : (
    <>
      {children}{" "}
      <span className="text-muted-foreground">
        · <Trans>not in runway</Trans>
      </span>
    </>
  );
}

export function FinanceRunwayPage() {
  useHideAmounts();
  const q = useFinanceQuery(() => rpc.finance.runway(), []);
  const data = q.data;
  // The projection may repeat the current month; the line continues from the last known balance.
  const lastKnown = data?.history.at(-1)?.month ?? "";
  const ahead = data?.projection.filter((p) => p.month > lastKnown) ?? [];
  const points = [...(data?.history ?? []), ...ahead];
  const runMonths = runwayText(data?.runway.months);
  const parts = data?.breakdown;
  const hasCrypto = !!parts && (parts.stablecoinCents > 0 || parts.otherCryptoCents > 0);
  return (
    <DetailPage
      crumbs={[{ label: t`Finance`, to: financePath.dashboard() }, { label: t`Runway` }]}
      title={<Trans>Runway</Trans>}
      loading={!data}
      error={q.error}
      notFound={q.notFound}
      onRetry={q.retry}
    >
      {data ? (
        <>
          <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-4">
            <Kpi title={t`Cash`} value={money(data.cashCents)} to={financePath.accounts()} />
            <Kpi
              title={t`Monthly burn`}
              value={data.monthlyBurnCents > 0 ? money(data.monthlyBurnCents) : "—"}
              to={financePath.burn()}
            />
            <Kpi title={t`Runway`} value={runMonths === undefined ? "—" : t`${runMonths} mo`} />
            <Kpi
              title={t`Run-out`}
              value={
                <span className="whitespace-nowrap">
                  {data.runway.runOutDate ? fullDay(data.runway.runOutDate) : "—"}
                </span>
              }
            />
          </div>
          {hasCrypto ? (
            // The pill says what to change; the line beside it says what counts now.
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <CountCryptoButton scope={data.runwayCrypto} onSaved={q.reload} />
              <span className="text-xs text-muted-foreground">
                {data.runwayCrypto === "all"
                  ? t`All crypto counts as cash in this runway.`
                  : data.runwayCrypto === "stablecoins"
                    ? t`Stablecoins count as cash in this runway; other crypto does not.`
                    : t`Crypto is left out of cash and this runway.`}
                {parts?.unpricedTokenCount ? ` ${t`${parts.unpricedTokenCount} unpriced.`}` : null}
              </span>
            </div>
          ) : null}
          <Section title={<Trans>Projected cash</Trans>}>
            <LineChart
              values={points.map((p) => p.balanceCents)}
              labels={monthAxisLabels(points.map((p) => p.month))}
              height={380}
              label={t`Projected cash`}
              projectedLabel={t`Projected`}
              solidUntil={Math.max(data.history.length - 1, 0)}
              endMarker={ahead.length > 0 && (ahead.at(-1)?.balanceCents ?? 1) <= 0}
            />
          </Section>
          {hasCrypto && parts ? (
            <Section title={<Trans>Cash</Trans>}>
              <Kv>
                <KvRow label={t`Bank`}>{money(parts.bankCents)}</KvRow>
                <KvRow label={t`Stablecoins`}>
                  <Counted on={data.runwayCrypto !== "bank"}>
                    {money(parts.stablecoinCents)}
                  </Counted>
                </KvRow>
                <KvRow label={t`Other crypto`}>
                  <Counted on={data.runwayCrypto === "all"}>
                    {money(parts.otherCryptoCents)}
                  </Counted>
                </KvRow>
                <KvRow label={t`In runway`}>
                  <span className="font-semibold">{money(data.cashCents)}</span>
                </KvRow>
              </Kv>
            </Section>
          ) : null}
        </>
      ) : null}
    </DetailPage>
  );
}
