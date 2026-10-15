import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type {
  ExchangeProvider,
  FinanceAccountsOutput,
  FinanceCryptoOutput,
  FinanceExchange,
} from "@rakazo/contracts";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@rakazo/ui-web";
import { useState } from "react";
import { Link } from "react-router-dom";
import { CountCryptoButton } from "../../components/finance/CountCryptoButton";
import { LineChart } from "../../components/finance/charts";
import { exchangeName } from "../../components/finance/ExchangeGroup";
import {
  Chevron,
  DetailPage,
  Kpi,
  rowClass,
  Section,
  Th,
  TransactionTable,
  useFinanceQuery,
  useRowNavigate,
} from "../../components/finance/ui";
import { useTypeNames, WalletDialog, walletName } from "../../components/finance/WalletDialog";
import { ExchangeConnectDialog } from "../../components/integrations/ExchangeConnectDialog";
import { money, moneyExact, monthLabel, monthShort } from "../../lib/finance-format";
import { financePath } from "../../lib/finance-route";
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
                <Link
                  to={financePath.account(account.id)}
                  className="outline-none hover:underline focus-visible:underline"
                >
                  {account.name}
                </Link>
                {account.lastFour ? (
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

export function FinanceAccountsPage() {
  const q = useFinanceQuery(() => rpc.finance.accounts(), []);
  const cryptoQuery = useFinanceQuery(() => rpc.finance.crypto(), []);
  const prefs = useFinanceQuery(() => rpc.finance.preferences(), []);
  const exchangeQuery = useFinanceQuery(() => rpc.finance.exchanges(), []);
  const [adding, setAdding] = useState(false);
  const [connecting, setConnecting] = useState<ExchangeProvider | null>(null);
  const exchanges = exchangeQuery.data ?? [];
  const crypto = cryptoQuery.data;
  const data = q.data;
  const scope = prefs.data?.runwayCrypto ?? "bank";
  const cashSub = {
    bank: t`Checking + Savings + Treasury`,
    stablecoins: t`Checking + Savings + Treasury + Stablecoins`,
    all: t`Checking + Savings + Treasury + Crypto`,
  }[scope];
  return (
    <DetailPage
      crumbs={[{ label: t`Finance`, to: financePath.dashboard() }, { label: t`Accounts` }]}
      title={<Trans>Accounts</Trans>}
      action={
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
            <Trans>Add account</Trans>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* One line per account type: add the next one here. */}
            <DropdownMenuItem onClick={() => setAdding(true)}>
              <Trans>Crypto wallet</Trans>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setConnecting("coinbase")}>Coinbase</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setConnecting("kraken")}>Kraken</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
      loading={!data}
      error={q.error}
      onRetry={q.retry}
    >
      {data ? (
        <>
          <WalletDialog
            key={adding ? "add" : "closed"}
            open={adding}
            onClose={() => setAdding(false)}
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
            <Kpi title={t`Total cash`} value={money(data.totalCashCents)} sub={cashSub} />
            {data.cardOwedCents !== null ? (
              <Kpi
                title={t`Card balance owed`}
                value={money(data.cardOwedCents)}
                sub={t`Not counted in cash`}
                to={data.cards[0] ? financePath.account(data.cards[0].id) : undefined}
              />
            ) : null}
          </div>
          {prefs.data && crypto && crypto.summary.totalCents > 0 ? (
            <div className="flex justify-end">
              <CountCryptoButton
                scope={scope}
                onSaved={() => {
                  q.reload();
                  prefs.reload();
                }}
              />
            </div>
          ) : null}
          <Section title={<Trans>Total balance</Trans>}>
            <LineChart
              values={data.history.map((p) => p.balanceCents)}
              labels={data.history.map((p) => monthShort(p.month))}
              height={200}
              label={t`Total balance`}
            />
          </Section>
          <Section title={<Trans>Cash accounts</Trans>}>
            <AccountTable rows={data.cash} />
          </Section>
          {data.cards.length > 0 ? (
            <Section title={<Trans>Card balance owed</Trans>}>
              <AccountTable rows={data.cards} owed />
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
            {account.lastFour ? (
              <span className="ms-2 font-normal text-muted-foreground">••{account.lastFour}</span>
            ) : null}
          </>
        ) : null
      }
      loading={!data}
      error={q.error}
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
              labels={data.history.map((p) => monthShort(p.month))}
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
            <TransactionTable rows={data.transactions} />
          </Section>
        </>
      ) : null}
    </DetailPage>
  );
}
