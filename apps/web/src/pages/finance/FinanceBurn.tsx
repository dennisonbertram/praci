import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useNavigate } from "react-router-dom";
import { CountCryptoButton } from "../../components/finance/CountCryptoButton";
import { BurnBars, LineChart, StackBar } from "../../components/finance/charts";
import {
  BreakdownRows,
  BurnLegend,
  Chevron,
  DetailPage,
  HereLink,
  Kpi,
  Kv,
  KvRow,
  rowClass,
  Section,
  Th,
  TransactionTable,
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
  shareText,
} from "../../lib/finance-format";
import { financePath } from "../../lib/finance-route";
import { rpc } from "../../lib/rpc";

const burnCrumbs = () => [
  { label: t`Finance`, to: financePath.dashboard() },
  { label: t`Burn`, to: financePath.burn() },
];

const netText = (cents: number) => `${cents < 0 ? "−" : "+"}${money(cents)}`;

/** The months from the first one with any money in or out; earlier months had no data, not zero spend. */
export function fromFirstData<
  T extends { outCents: number; revenueCents: number; financingCents: number },
>(series: T[]): T[] {
  const first = series.findIndex((m) => m.outCents || m.revenueCents || m.financingCents);
  return first < 0 ? series.slice(-1) : series.slice(first);
}

export function FinanceBurnPage() {
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
          <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-3">
            <Kpi
              title={t`Monthly burn`}
              value={data.monthlyCents > 0 ? money(data.monthlyCents) : "—"}
              sub={t`3-mo avg, after revenue`}
            />
          </div>
          <Section title={<Trans>Burn</Trans>} action={<BurnLegend />}>
            <BurnBars
              series={series.map(({ month, ...rest }) => ({
                ...rest,
                start: `${month}-01`,
                end: `${month}-01`,
              }))}
              label={t`Cash out and cash in by month`}
              onOpen={(point) => navigate(financePath.month(point.start.slice(0, 7)))}
            />
            {series.at(-1)?.partial ? (
              <div className="text-[11px] text-muted-foreground">
                <Trans>* Month to date</Trans>
              </div>
            ) : null}
          </Section>
          <div className="grid gap-3 @3xl:grid-cols-2">
            <Section
              title={<Trans>Where it went</Trans>}
              action={
                first && last ? (
                  <span className="text-[11px] text-muted-foreground">
                    {monthShort(first)}–{monthShort(last)}
                  </span>
                ) : null
              }
            >
              <StackBar
                segments={data.whereItWent}
                label={t`Burn by category`}
                onOpen={(key) => navigate(financePath.category(key))}
              />
              <BreakdownRows
                rows={data.whereItWent}
                swatches
                to={(row) => financePath.category(row.key)}
              />
            </Section>
            <Section title={<Trans>By account</Trans>}>
              <table className="w-full border-collapse">
                <tbody>
                  {spentAccounts.map(({ account, cents }) => (
                    <tr
                      key={account.id}
                      className={rowClass}
                      {...rowProps(financePath.account(account.id))}
                    >
                      <td className="font-semibold">
                        <HereLink
                          to={financePath.account(account.id)}
                          className="outline-none hover:underline focus-visible:underline"
                        >
                          {account.name}
                        </HereLink>
                      </td>
                      <td className="text-end tabular-nums">{money(cents)}</td>
                      <td className="text-end text-muted-foreground tabular-nums">
                        {shareText(cents, accountTotal)}
                      </td>
                      <Chevron />
                    </tr>
                  ))}
                  {brexCents > 0 ? (
                    <tr className={rowClass} {...rowProps(financePath.accounts("brex"))}>
                      <td className="font-semibold">
                        <HereLink
                          to={financePath.accounts("brex")}
                          className="outline-none hover:underline focus-visible:underline"
                        >
                          Brex
                        </HereLink>
                      </td>
                      <td className="text-end tabular-nums">{money(brexCents)}</td>
                      <td className="text-end text-muted-foreground tabular-nums">
                        {shareText(brexCents, accountTotal)}
                      </td>
                      <Chevron />
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </Section>
          </div>
          <Section title={<Trans>By month</Trans>}>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <Th>
                    <Trans>Month</Trans>
                  </Th>
                  <Th right>
                    <Trans>Out</Trans>
                  </Th>
                  <Th right>
                    <Trans>In</Trans>
                  </Th>
                  <Th right>
                    <Trans>Net</Trans>
                  </Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {[...series].reverse().map((m) => {
                  const inCents = m.revenueCents + m.financingCents;
                  const net = inCents - m.outCents;
                  return (
                    <tr
                      key={m.month}
                      className={rowClass}
                      {...rowProps(financePath.month(m.month))}
                    >
                      <td>
                        <HereLink
                          to={financePath.month(m.month)}
                          className="outline-none hover:underline focus-visible:underline"
                        >
                          {monthLabel(m.month)}
                        </HereLink>
                      </td>
                      <td className="text-end tabular-nums">{money(m.outCents)}</td>
                      <td className="text-end tabular-nums">{inCents ? money(inCents) : "—"}</td>
                      <td
                        className={`text-end tabular-nums ${net < 0 ? "text-destructive" : "text-success"}`}
                      >
                        {netText(net)}
                      </td>
                      <Chevron />
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Section>
        </>
      ) : null}
    </DetailPage>
  );
}

export function FinanceMonthPage({ month }: { month: string }) {
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
          <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-3">
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
              swatches
              to={(row) => financePath.category(row.key)}
            />
          </Section>
          <Section title={<Trans>Transactions</Trans>}>
            <TransactionTable rows={data.transactions} />
          </Section>
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
  const q = useFinanceQuery(() => rpc.finance.runway(), []);
  const data = q.data;
  // The projection may repeat the current month; the line continues from the last known balance.
  const lastKnown = data?.history.at(-1)?.month ?? "";
  const ahead = data?.projection.filter((p) => p.month > lastKnown) ?? [];
  const points = [...(data?.history ?? []), ...ahead];
  const runMonths = data?.runway.months?.toFixed(1);
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
              value={data.runway.runOutDate ? fullDay(data.runway.runOutDate) : "—"}
            />
          </div>
          {hasCrypto ? (
            <div>
              <CountCryptoButton scope={data.runwayCrypto} onSaved={q.reload} />
            </div>
          ) : null}
          <Section title={<Trans>Projected cash</Trans>}>
            <LineChart
              values={points.map((p) => p.balanceCents)}
              labels={monthAxisLabels(points.map((p) => p.month))}
              height={240}
              label={t`Projected cash`}
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
          <Section>
            <Kv>
              <KvRow label={t`Burn`}>{t`Spending minus revenue, 3-mo avg`}</KvRow>
              <KvRow label={t`Revenue`}>{t`Subtracted from burn`}</KvRow>
              <KvRow label={t`Financing`}>{t`Excluded`}</KvRow>
              <KvRow label={t`Treasury yield`}>{t`Excluded`}</KvRow>
              <KvRow label={t`Card balance owed`}>{t`Not counted`}</KvRow>
            </Kv>
          </Section>
        </>
      ) : null}
    </DetailPage>
  );
}
