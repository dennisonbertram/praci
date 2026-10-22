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
import {
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableHeadRow,
  TableRow,
} from "@rakazo/ui-web";
import { useState } from "react";
import { Link } from "react-router-dom";
import { AddAccountDialog } from "../../components/finance/AddAccountDialog";
import { LineChart } from "../../components/finance/charts";
import { exchangeName } from "../../components/finance/ExchangeGroup";
import { RenameAccountDialog } from "../../components/finance/RenameAccountDialog";
import {
  Chevron,
  cashSubtitle,
  DetailPage,
  HereLink,
  Kpi,
  PeriodTabs,
  Section,
  TransactionsSection,
  useFinanceQuery,
  useRowNavigate,
} from "../../components/finance/ui";
import { useTypeNames, WalletDialog, walletName } from "../../components/finance/WalletDialog";
import { ExchangeConnectDialog } from "../../components/integrations/ExchangeConnectDialog";
import {
  accountParts,
  dayAxisLabels,
  money,
  monthAxisLabels,
  monthLabel,
  percentFigure,
} from "../../lib/finance-format";
import { financePath } from "../../lib/finance-route";
import { useHideAmounts } from "../../lib/hide-amounts-preference";
import { FINANCE_PROVIDERS } from "../../lib/integrations";
import { rpc } from "../../lib/rpc";

type AccountRow = FinanceAccountsOutput["cash"][number];

const yieldText = (pct: number | null) => (pct === null ? null : percentFigure(pct, 1));

function AccountTable({ rows, owed }: { rows: AccountRow[]; owed?: boolean }) {
  useHideAmounts();
  const rowProps = useRowNavigate();
  return (
    <Table compact>
      <TableBody>
        {rows.map((account) => {
          const pct = yieldText(account.annualYieldPct);
          return (
            <TableRow
              key={account.id}
              className="group/row cursor-pointer"
              {...rowProps(financePath.account(account.id))}
            >
              <TableCell className="font-semibold">
                <HereLink
                  to={financePath.account(account.id)}
                  className="rk-tap outline-none hover:underline focus-visible:underline"
                >
                  {accountParts(account.name, account.lastFour).name}
                </HereLink>
                {account.lastFour ? (
                  <span className="ms-1.5 font-normal text-muted-foreground">
                    {accountParts(account.name, account.lastFour).ending}
                  </span>
                ) : null}
                {pct ? (
                  <span className="ms-1.5 rounded-full border border-border px-1.5 text-xs font-normal text-muted-foreground">
                    {t`${pct} yield`}
                  </span>
                ) : null}
              </TableCell>
              <TableCell
                className="text-end tabular-nums"
                aria-label={owed ? t`Balance owed` : undefined}
              >
                {money(account.balanceCents)}
              </TableCell>
              <Chevron />
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
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
  useHideAmounts();
  const typeNames = useTypeNames();
  const rowProps = useRowNavigate();
  const cents = new Map(crypto.summary.byWallet.map((row) => [row.walletId, row.cents]));
  return (
    <Section title={<Trans>Crypto</Trans>}>
      <Table compact>
        <TableBody>
          {crypto.wallets.map((wallet) => (
            <TableRow
              key={wallet.id}
              className="group/row cursor-pointer"
              {...rowProps(financePath.crypto())}
            >
              <TableCell className="font-semibold">
                <Link
                  to={financePath.crypto()}
                  className="rk-tap outline-none hover:underline focus-visible:underline"
                >
                  {walletName(wallet)}
                </Link>
                <span className="ms-1.5 font-normal text-muted-foreground">
                  {typeNames[wallet.type]}
                </span>
              </TableCell>
              <TableCell className="text-end tabular-nums">
                {money(cents.get(wallet.id) ?? 0)}
              </TableCell>
              <Chevron />
            </TableRow>
          ))}
          {exchanges.map((exchange) => (
            <TableRow
              key={exchange.id}
              className="group/row cursor-pointer"
              {...rowProps(financePath.crypto())}
            >
              <TableCell className="font-semibold">
                <Link
                  to={financePath.crypto()}
                  className="rk-tap outline-none hover:underline focus-visible:underline"
                >
                  {exchangeName(exchange.provider)}
                </Link>
                <span className="ms-1.5 font-normal text-muted-foreground">
                  <Trans>Exchange</Trans>
                </span>
              </TableCell>
              <TableCell className="text-end tabular-nums">{money(exchange.totalCents)}</TableCell>
              <Chevron />
            </TableRow>
          ))}
        </TableBody>
      </Table>
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
  useHideAmounts();
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
  // A source's own spend this month: Brex card spend sits on no account row, so this is where it shows.
  const sourceSpend = useFinanceQuery(
    () => (source ? rpc.finance.spend({ period: "month", source }) : Promise.resolve(null)),
    [source],
  ).data;
  const scope = prefs.data?.runwayCrypto ?? "bank";
  const sourceName = FINANCE_PROVIDERS.find((p) => p.provider === source)?.name;
  // Cash accounts and cards both carry a provider; a source filter narrows the total with the list.
  const fromSource = (rows: AccountRow[]) =>
    source ? rows.filter((a) => a.provider === source) : rows;
  const shownCash = data
    ? fromSource(data.cash).sort((a, b) => b.balanceCents - a.balanceCents)
    : [];
  // With no account and no crypto yet, a year-long $0 line says nothing.
  const anyBalance =
    (data?.cash.length ?? 0) + (data?.cards.length ?? 0) > 0 ||
    (crypto?.wallets.length ?? 0) > 0 ||
    exchanges.length > 0;
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
          <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3">
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
            ) : null}
            {source && sourceName && sourceSpend ? (
              <Kpi
                title={t`${sourceName} spend`}
                value={money(sourceSpend.totalCents)}
                sub={t`This month`}
                to={financePath.spend("month", null, null, source)}
              />
            ) : null}
          </div>
          {/* The chart is every account's total, so a source filter hides it rather than contradict the figure above. */}
          {sourceName || !anyBalance ? null : (
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
            {shownCash.length > 0 ? (
              <AccountTable rows={shownCash} />
            ) : sourceName ? (
              <p className="text-sm text-muted-foreground">{t`No ${sourceName} cash accounts.`}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                <Trans>
                  No bank accounts yet. Connect Mercury or Brex, or upload a bank statement, with
                  Add account.
                </Trans>
              </p>
            )}
          </Section>
          {fromSource(data.cards).length > 0 ? (
            <Section title={<Trans>Card balance owed</Trans>}>
              <AccountTable rows={fromSource(data.cards)} owed />
            </Section>
          ) : null}
          {/* Wallets and exchanges come from no bank or card provider, so a source filter leaves them out. */}
          {!sourceName && crypto && (crypto.wallets.length > 0 || exchanges.length > 0) ? (
            <CryptoGroup crypto={crypto} exchanges={exchanges} />
          ) : null}
        </>
      ) : null}
    </DetailPage>
  );
}

export function FinanceAccountPage({ id }: { id: string }) {
  useHideAmounts();
  const q = useFinanceQuery(() => rpc.finance.account({ id }), [id]);
  const data = q.data;
  const account = data?.account;
  const name = account?.name ?? "";
  const isCard = account?.kind === "card";
  const pct = account ? yieldText(account.annualYieldPct) : null;
  const [renaming, setRenaming] = useState(false);
  const [uploading, setUploading] = useState(false);
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
            {accountParts(account.name, account.lastFour).name}
            {account.lastFour ? (
              <span className="ms-2 font-normal text-muted-foreground">
                {accountParts(account.name, account.lastFour).ending}
              </span>
            ) : null}
          </>
        ) : null
      }
      action={
        // A statement account is named from its file; a synced account keeps the bank's name.
        // Next month's statement goes in from here, not through Accounts > Add account.
        account?.provider === "statement" ? (
          <>
            <Button variant="outline" size="sm" onClick={() => setUploading(true)}>
              <Trans>Upload statement</Trans>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setRenaming(true)}>
              <Trans>Rename</Trans>
            </Button>
          </>
        ) : null
      }
      loading={!data}
      error={q.error}
      notFound={q.notFound}
      onRetry={q.retry}
    >
      {uploading ? (
        <AddAccountDialog
          initialStep="bank"
          onImported={q.reload}
          onClose={() => setUploading(false)}
        />
      ) : null}
      {renaming && account ? (
        <RenameAccountDialog
          account={account}
          onClose={() => setRenaming(false)}
          onSaved={q.reload}
        />
      ) : null}
      {data && account ? (
        <>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3">
            <Kpi
              title={isCard ? t`Balance owed` : t`Balance`}
              value={money(account.balanceCents)}
            />
            {pct ? <Kpi title={t`Yield`} value={pct} /> : null}
          </div>
          <Section title={<Trans>Balance over time</Trans>}>
            <LineChart
              values={data.history.map((p) => p.balanceCents)}
              labels={monthAxisLabels(data.history.map((p) => p.month))}
              height={180}
              label={t`Balance`}
            />
          </Section>
          {data.treasuryYield.length > 0 ? (
            <Section title={<Trans>Yield</Trans>}>
              <Table compact>
                <TableHeader>
                  <TableHeadRow>
                    <TableHead>
                      <Trans>Month</Trans>
                    </TableHead>
                    <TableHead className="text-end">
                      <Trans>Dividends</Trans>
                    </TableHead>
                    <TableHead className="text-end">
                      <Trans>Fee</Trans>
                    </TableHead>
                    <TableHead className="text-end">
                      <Trans>Net</Trans>
                    </TableHead>
                  </TableHeadRow>
                </TableHeader>
                <TableBody>
                  {data.treasuryYield.map((row) => (
                    <TableRow key={`${row.accountExternalId}:${row.month}`}>
                      <TableCell>{monthLabel(row.month)}</TableCell>
                      <TableCell className="text-end tabular-nums">
                        {money(row.dividendsCents)}
                      </TableCell>
                      <TableCell className="text-end tabular-nums text-muted-foreground">
                        {money(row.feeCents)}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">{money(row.netCents)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Section>
          ) : null}
          <TransactionsSection
            title={<Trans>Transactions</Trans>}
            rows={data.transactions}
            empty={<Trans>No transactions on this account yet</Trans>}
          />
        </>
      ) : null}
    </DetailPage>
  );
}
