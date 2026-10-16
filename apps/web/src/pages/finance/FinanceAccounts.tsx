import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type {
  BalanceRange,
  ExchangeProvider,
  FinanceAccountsOutput,
  FinanceCryptoOutput,
  FinanceExchange,
  FinanceProvider,
} from "@rakazo/contracts";
import { Badge, Button } from "@rakazo/ui-web";
import { useState } from "react";
import { Link } from "react-router-dom";
import { AddAccountDialog } from "../../components/finance/AddAccountDialog";
import { CountCryptoButton } from "../../components/finance/CountCryptoButton";
import { LineChart } from "../../components/finance/charts";
import { exchangeName } from "../../components/finance/ExchangeGroup";
import {
  Chevron,
  cashSubtitle,
  DetailPage,
  HereLink,
  Kpi,
  PeriodTabs,
  rowClass,
  Section,
  Th,
  TransactionTable,
  useFinanceQuery,
  useRowNavigate,
} from "../../components/finance/ui";
import { useTypeNames, WalletDialog, walletName } from "../../components/finance/WalletDialog";
import { ExchangeConnectDialog } from "../../components/integrations/ExchangeConnectDialog";
import {
  accountLabel,
  dayAxisLabels,
  money,
  moneyExact,
  monthAxisLabels,
  monthLabel,
} from "../../lib/finance-format";
import { financePath } from "../../lib/finance-route";
import { FINANCE_PROVIDERS } from "../../lib/integrations";
import { rpc } from "../../lib/rpc";

type AccountRow = FinanceAccountsOutput["cash"][number];

const yieldText = (pct: number | null) => (pct === null ? null : `${pct.toFixed(1)}%`);

function AccountTable({ rows, owed }: { rows: AccountRow[]; owed?: boolean }) {
  const rowProps = useRowNavigate();
  return (
    <table className="w-full border-collapse">
      <tbody>
        {rows.map((account) => {
          const pct = yieldText(account.annualYieldPct);
          return (
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
                {accountLabel(account.name, account.lastFour) !== account.name ? (
                  <span className="ms-1.5 font-normal text-muted-foreground">
                    ••{account.lastFour}
                  </span>
                ) : null}
                {pct ? (
                  <span className="ms-1.5 rounded-full border border-border px-1.5 text-[10px] font-normal text-muted-foreground">
                    {t`${pct} yield`}
                  </span>
                ) : null}
              </td>
              <td className="text-end tabular-nums" aria-label={owed ? t`Balance owed` : undefined}>
                {money(account.balanceCents)}
              </td>
              <Chevron />
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** The wallets, apart from the cash accounts and never part of their totals. */
function CryptoGroup({
  crypto,
  exchanges,
}: {
  crypto: FinanceCryptoOutput;
  exchanges: FinanceExchange[];
}) {
  const typeNames = useTypeNames();
  const rowProps = useRowNavigate();
  const cents = new Map(crypto.summary.byWallet.map((row) => [row.walletId, row.cents]));
  return (
    <Section title={<Trans>Crypto</Trans>}>
      <table className="w-full border-collapse">
        <tbody>
          {crypto.wallets.map((wallet) => (
            <tr key={wallet.id} className={rowClass} {...rowProps(financePath.crypto())}>
              <td className="font-semibold">
                <Link
                  to={financePath.crypto()}
                  className="outline-none hover:underline focus-visible:underline"
                >
                  {walletName(wallet)}
                </Link>
                <span className="ms-1.5 font-normal text-muted-foreground">
                  {typeNames[wallet.type]}
                </span>
              </td>
              <td className="text-end tabular-nums">{moneyExact(cents.get(wallet.id) ?? 0)}</td>
              <Chevron />
            </tr>
          ))}
          {exchanges.map((exchange) => (
            <tr key={exchange.id} className={rowClass} {...rowProps(financePath.crypto())}>
              <td className="font-semibold">
                <Link
                  to={financePath.crypto()}
                  className="outline-none hover:underline focus-visible:underline"
                >
                  {exchangeName(exchange.provider)}
                </Link>
                <span className="ms-1.5 font-normal text-muted-foreground">
                  <Trans>Exchange</Trans>
                </span>
              </td>
              <td className="text-end tabular-nums">{moneyExact(exchange.totalCents)}</td>
              <Chevron />
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}

export function FinanceAccountsPage({
  source = null,
  unknownSource,
}: {
  source?: FinanceProvider | null;
  /** A `?source=` that is not a provider: every account is listed and the filter is flagged. */
  unknownSource?: string;
}) {
  const accounts = useFinanceQuery(() => rpc.finance.accounts(), []);
  // Whatever reloads the accounts total (a wallet added, the crypto scope changed) reloads the chart too.
  const [balanceStamp, setBalanceStamp] = useState(0);
  const q = {
    ...accounts,
    reload: () => {
      accounts.reload();
      setBalanceStamp((n) => n + 1);
    },
  };
  const cryptoQuery = useFinanceQuery(() => rpc.finance.crypto(), []);
  const prefs = useFinanceQuery(() => rpc.finance.preferences(), []);
  const exchangeQuery = useFinanceQuery(() => rpc.finance.exchanges(), []);
  const [adding, setAdding] = useState<"type" | "wallet" | null>(null);
  const [connecting, setConnecting] = useState<ExchangeProvider | null>(null);
  const exchanges = exchangeQuery.data ?? [];
  const crypto = cryptoQuery.data;
  const data = q.data;
  const [range, setRange] = useState<BalanceRange>("year");
  const balance = useFinanceQuery(
    () => rpc.finance.balanceSeries({ range }),
    [range, balanceStamp],
  ).data;
  const scope = prefs.data?.runwayCrypto ?? "bank";
  const sourceName = FINANCE_PROVIDERS.find((p) => p.provider === source)?.name;
  // Cash accounts and cards both carry a provider; a source filter narrows the total with the list.
  const fromSource = (rows: AccountRow[]) =>
    source ? rows.filter((a) => a.provider === source) : rows;
  const shownCash = data ? fromSource(data.cash) : [];
  // Brex shares no card balance owed, so with Brex and no card row the figure is unknown, not zero.
  const brexOwedUnknown =
    data !== null && data.cardOwedCents === null && data.cash.some((a) => a.provider === "brex");
  return (
    <DetailPage
      crumbs={[{ label: t`Finance`, to: financePath.dashboard() }, { label: t`Accounts` }]}
      title={
        // A filter chip that wraps on a narrow screen starts under the title, not indented.
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Trans>Accounts</Trans>
          {sourceName ? (
            <Badge
              variant="outline"
              render={
                <Link to={financePath.accounts()} aria-label={t`Clear ${sourceName} filter`} />
              }
            >
              {sourceName} ×
            </Badge>
          ) : unknownSource ? (
            <Badge
              variant="outline"
              render={<Link to={financePath.accounts()} aria-label={t`Clear filter`} />}
            >
              {t`Unknown source: ${unknownSource}`} ×
            </Badge>
          ) : null}
        </span>
      }
      action={
        <Button variant="outline" size="sm" onClick={() => setAdding("type")}>
          <Trans>Add account</Trans>
        </Button>
      }
      loading={!data}
      error={q.error}
      notFound={q.notFound}
      onRetry={q.retry}
    >
      {data ? (
        <>
          {adding === "type" ? (
            <AddAccountDialog
              onPickCrypto={(choice) =>
                choice === "wallet" ? setAdding("wallet") : setConnecting(choice)
              }
              onImported={() => q.reload()}
              onClose={() => setAdding(null)}
            />
          ) : null}
          <WalletDialog
            key={adding === "wallet" ? "add" : "closed"}
            open={adding === "wallet"}
            onClose={() => setAdding(null)}
            onSaved={() => {
              cryptoQuery.reload();
              q.reload();
            }}
          />
          {connecting ? (
            <ExchangeConnectDialog
              provider={connecting}
              onConnected={() => {
                cryptoQuery.reload();
                exchangeQuery.reload();
                q.reload();
              }}
              onClose={() => setConnecting(null)}
            />
          ) : null}
          <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-3">
            {sourceName ? (
              <Kpi
                title={t`${sourceName} cash`}
                value={money(shownCash.reduce((sum, a) => sum + a.balanceCents, 0))}
                sub={cashSubtitle(shownCash.length, "none")}
              />
            ) : (
              <Kpi
                title={t`Total cash`}
                value={money(data.totalCashCents)}
                sub={cashSubtitle(
                  data.cash.length,
                  scope === "bank" ? "none" : scope === "stablecoins" ? "stablecoins" : "all",
                )}
              />
            )}
            {data.cardOwedCents !== null ? (
              <Kpi
                title={t`Card balance owed`}
                value={money(data.cardOwedCents)}
                sub={t`Not counted in cash`}
                to={data.cards[0] ? financePath.account(data.cards[0].id) : undefined}
              />
            ) : brexOwedUnknown ? (
              <Kpi title={t`Card balance owed`} value="—" sub={t`Brex does not share it`} />
            ) : null}
          </div>
          {prefs.data && crypto && crypto.summary.totalCents > 0 ? (
            <div>
              <CountCryptoButton
                scope={scope}
                onSaved={() => {
                  q.reload();
                  prefs.reload();
                }}
              />
            </div>
          ) : null}
          {/* The chart is every account's total, so a source filter hides it rather than contradict the figure above. */}
          {sourceName ? null : (
            <Section
              title={<Trans>Total balance</Trans>}
              action={<PeriodTabs value={range} onChange={setRange} />}
            >
              <div style={{ minHeight: 200 }}>
                {balance ? (
                  <LineChart
                    values={balance.points.map((p) => p.balanceCents)}
                    labels={
                      range === "year"
                        ? monthAxisLabels(balance.points.map((p) => p.day.slice(0, 7)))
                        : dayAxisLabels(balance.points.map((p) => p.day))
                    }
                    height={200}
                    label={t`Total balance`}
                  />
                ) : null}
              </div>
            </Section>
          )}
          <Section title={<Trans>Cash accounts</Trans>}>
            <AccountTable rows={shownCash} />
          </Section>
          {fromSource(data.cards).length > 0 ? (
            <Section title={<Trans>Card balance owed</Trans>}>
              <AccountTable rows={fromSource(data.cards)} owed />
            </Section>
          ) : null}
          {crypto && (crypto.wallets.length > 0 || exchanges.length > 0) ? (
            <CryptoGroup crypto={crypto} exchanges={exchanges} />
          ) : null}
        </>
      ) : null}
    </DetailPage>
  );
}

export function FinanceAccountPage({ id }: { id: string }) {
  const q = useFinanceQuery(() => rpc.finance.account({ id }), [id]);
  const data = q.data;
  const account = data?.account;
  const name = account?.name ?? "";
  const isCard = account?.kind === "card";
  const pct = account ? yieldText(account.annualYieldPct) : null;
  return (
    <DetailPage
      crumbs={[
        { label: t`Finance`, to: financePath.dashboard() },
        { label: t`Accounts`, to: financePath.accounts() },
        { label: name },
      ]}
      title={
        account ? (
          <>
            {account.name}
            {accountLabel(account.name, account.lastFour) !== account.name ? (
              <span className="ms-2 font-normal text-muted-foreground">••{account.lastFour}</span>
            ) : null}
          </>
        ) : null
      }
      loading={!data}
      error={q.error}
      notFound={q.notFound}
      onRetry={q.retry}
    >
      {data && account ? (
        <>
          <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-3">
            <Kpi
              title={isCard ? t`Balance owed` : t`Balance`}
              value={moneyExact(account.balanceCents)}
            />
            {pct ? <Kpi title={t`Yield`} value={pct} /> : null}
          </div>
          <Section title={<Trans>Balance</Trans>}>
            <LineChart
              values={data.history.map((p) => p.balanceCents)}
              labels={monthAxisLabels(data.history.map((p) => p.month))}
              height={180}
              label={t`Balance`}
            />
          </Section>
          {data.treasuryYield.length > 0 ? (
            <Section title={<Trans>Yield</Trans>}>
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <Th>
                      <Trans>Month</Trans>
                    </Th>
                    <Th right>
                      <Trans>Dividends</Trans>
                    </Th>
                    <Th right>
                      <Trans>Fee</Trans>
                    </Th>
                    <Th right>
                      <Trans>Net</Trans>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {data.treasuryYield.map((row) => (
                    <tr
                      key={`${row.accountExternalId}:${row.month}`}
                      className="border-t border-border [&>td]:py-2"
                    >
                      <td>{monthLabel(row.month)}</td>
                      <td className="text-end tabular-nums">{moneyExact(row.dividendsCents)}</td>
                      <td className="text-end tabular-nums text-muted-foreground">
                        {moneyExact(row.feeCents)}
                      </td>
                      <td className="text-end tabular-nums">{moneyExact(row.netCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          ) : null}
          <Section title={<Trans>Transactions</Trans>}>
            <TransactionTable
              rows={data.transactions}
              empty={<Trans>No transactions on this account yet</Trans>}
            />
          </Section>
        </>
      ) : null}
    </DetailPage>
  );
}
