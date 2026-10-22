import { Trans, useLingui } from "@lingui/react/macro";
import type { FinanceCryptoOutput, FinanceWallet } from "@rakazo/contracts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableHeadRow,
  TableRow,
} from "@rakazo/ui-web";
import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { LineChart } from "../../components/finance/charts";
import { ExchangeGroup } from "../../components/finance/ExchangeGroup";
import { DetailPage, Kpi, Section, useFinanceQuery } from "../../components/finance/ui";
import { useTypeNames, WalletDialog, walletName } from "../../components/finance/WalletDialog";
import { chainName, shortAddress, tokenAmount } from "../../lib/crypto-format";
import { dayMonth, money } from "../../lib/finance-format";
import { financePath } from "../../lib/finance-route";
import { useHideAmounts } from "../../lib/hide-amounts-preference";
import { formatRelativeTime } from "../../lib/relative-time";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";

function RemoveDialog({
  wallet,
  onClose,
  onSaved,
}: {
  wallet: FinanceWallet | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useLingui();
  const [error, setError] = useState("");
  async function remove() {
    if (!wallet) return;
    try {
      await rpc.finance.walletRemove({ id: wallet.id });
      onSaved();
      onClose();
    } catch (cause) {
      setError(errorText(cause));
    }
  }
  return (
    <AlertDialog open={wallet !== null} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t`Remove ${wallet ? walletName(wallet) : ""}?`}</AlertDialogTitle>
        </AlertDialogHeader>
        {error ? <p className="text-[13px] text-destructive">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel>
            <Trans>Cancel</Trans>
          </AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => void remove()}>
            <Trans>Remove</Trans>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function WalletRows({
  data,
  onEdit,
  onRemove,
}: {
  data: FinanceCryptoOutput;
  onEdit: (wallet: FinanceWallet) => void;
  onRemove: (wallet: FinanceWallet) => void;
}) {
  useHideAmounts();
  const { t } = useLingui();
  const typeNames = useTypeNames();
  const cents = new Map(data.summary.byWallet.map((row) => [row.walletId, row.cents]));
  return (
    <Table compact>
      <TableBody>
        {data.wallets.map((wallet) => {
          const name = walletName(wallet);
          const threshold =
            wallet.type === "safe" && wallet.safeThreshold && wallet.safeOwners
              ? t`${wallet.safeThreshold} of ${wallet.safeOwners.length}`
              : null;
          return (
            <TableRow key={wallet.id} className="first:border-t-0">
              <TableCell>
                <span className="font-semibold">{name}</span>
                <span className="ms-1.5 text-muted-foreground">
                  {typeNames[wallet.type]}
                  {threshold ? ` · ${threshold}` : null}
                </span>
                {/* Which wallet this is: its ENS name, else its address, unless the name already is it. */}
                {wallet.label ? (
                  <div className="text-xs text-muted-foreground">
                    {wallet.ensName ?? shortAddress(wallet.address)}
                  </div>
                ) : null}
              </TableCell>
              <TableCell className="text-end tabular-nums">
                {money(cents.get(wallet.id) ?? 0)}
              </TableCell>
              <TableCell className="w-8 text-end">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button variant="ghost" size="icon-xs" aria-label={t`Actions for ${name}`} />
                    }
                  >
                    <MoreHorizontal aria-hidden="true" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(wallet)}>
                      <Trans>Edit</Trans>
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onClick={() => onRemove(wallet)}>
                      <Trans>Remove</Trans>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export function FinanceCryptoPage() {
  useHideAmounts();
  const { t } = useLingui();
  const q = useFinanceQuery(() => rpc.finance.crypto(), []);
  const history = useFinanceQuery(() => rpc.finance.cryptoHistory({ days: 90 }), []);
  const exchanges = useFinanceQuery(() => rpc.finance.exchanges(), []);
  const trend = history.data?.points ?? [];
  const reloadAll = () => {
    q.reload();
    history.reload();
    exchanges.reload();
  };
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<FinanceWallet | null>(null);
  const [removing, setRemoving] = useState<FinanceWallet | null>(null);
  const data = q.data;
  const updated = data?.summary.lastSyncedAt ? formatRelativeTime(data.summary.lastSyncedAt) : "";
  const holdings = [...(data?.holdings ?? [])].sort(
    (a, b) => (b.usdValueCents ?? -1) - (a.usdValueCents ?? -1),
  );
  const walletById = new Map((data?.wallets ?? []).map((w) => [w.id, walletName(w)]));
  // The Wallets section is wallet-only: the summary's totals also include exchanges.
  const walletCents = (data?.summary.byWallet ?? []).reduce((sum, w) => sum + w.cents, 0);
  const exchangeUnpriced = (exchanges.data ?? []).reduce(
    (sum, x) => sum + x.balances.filter((b) => b.usdValueCents === null).length,
    0,
  );
  const unpriced = Math.max(0, (data?.summary.unpricedTokenCount ?? 0) - exchangeUnpriced);
  return (
    <DetailPage
      crumbs={[{ label: t`Finance`, to: financePath.dashboard() }, { label: t`Crypto` }]}
      title={<Trans>Crypto</Trans>}
      subtitle={updated ? <Trans>Updated {updated}</Trans> : undefined}
      loading={!data}
      error={q.error}
      notFound={q.notFound}
      onRetry={q.retry}
    >
      {data ? (
        <>
          {data.lastError ? (
            <p role="alert" className="text-sm text-destructive">
              {data.lastError}
            </p>
          ) : null}
          {/* The same figure cards as every other Finance page. Total is the figure the overview shows. */}
          {(exchanges.data ?? []).length > 0 || data.wallets.length > 0 ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3">
              {(exchanges.data ?? []).length > 0 ? (
                <Kpi title={t`Total`} value={money(data.summary.totalCents)} />
              ) : null}
              {data.wallets.length > 0 ? (
                <Kpi
                  title={t`Wallets`}
                  value={money(walletCents)}
                  sub={unpriced > 0 ? t`${unpriced} unpriced` : undefined}
                />
              ) : null}
            </div>
          ) : null}
          <Section
            title={<Trans>Wallets</Trans>}
            action={
              <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
                <Trans>Add wallet</Trans>
              </Button>
            }
          >
            {data.wallets.length > 0 ? (
              <WalletRows data={data} onEdit={setEditing} onRemove={setRemoving} />
            ) : (
              <p className="py-2 text-sm text-muted-foreground">
                <Trans>No wallets yet. Add a wallet address to see its balances here.</Trans>
              </p>
            )}
          </Section>
          {(exchanges.data ?? []).map((exchange) => (
            <ExchangeGroup key={exchange.id} exchange={exchange} onChanged={reloadAll} />
          ))}
          {trend.length >= 2 ? (
            <Section title={<Trans>Balance over time</Trans>}>
              <LineChart
                values={trend.map((p) => p.stablecoinCents + p.otherCryptoCents)}
                labels={trend.map((p) => dayMonth(p.day))}
                height={200}
                label={t`Balance over time`}
              />
            </Section>
          ) : null}
          {/* One chain would only repeat the wallet total. */}
          {data.summary.byChain.length > 1 ? (
            <Section title={<Trans>Chains</Trans>}>
              <Table compact>
                <TableBody>
                  {data.summary.byChain.map((row) => (
                    <TableRow key={row.chainId} className="first:border-t-0">
                      <TableCell>{chainName(row.chainId)}</TableCell>
                      <TableCell className="text-end tabular-nums">{money(row.cents)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Section>
          ) : null}
          {holdings.length > 0 ? (
            <Section title={<Trans>Holdings</Trans>}>
              <Table compact>
                <TableHeader>
                  <TableHeadRow>
                    <TableHead>
                      <Trans>Token</Trans>
                    </TableHead>
                    {/* With more than one wallet, the same token can appear once per wallet. */}
                    {data.wallets.length > 1 ? (
                      <TableHead>
                        <Trans>Wallet</Trans>
                      </TableHead>
                    ) : null}
                    <TableHead>
                      <Trans>Chain</Trans>
                    </TableHead>
                    <TableHead className="text-end">
                      <Trans>Balance</Trans>
                    </TableHead>
                    <TableHead className="text-end">
                      <Trans>Value</Trans>
                    </TableHead>
                  </TableHeadRow>
                </TableHeader>
                <TableBody>
                  {holdings.map((h) => (
                    <TableRow key={`${h.walletId}:${h.chainId}:${h.tokenAddress ?? ""}`}>
                      <TableCell className="font-semibold">{h.symbol}</TableCell>
                      {data.wallets.length > 1 ? (
                        <TableCell className="text-muted-foreground">
                          {walletById.get(h.walletId) ?? ""}
                        </TableCell>
                      ) : null}
                      <TableCell className="text-muted-foreground">
                        {chainName(h.chainId)}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {tokenAmount(h.rawBalance, h.decimals)}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {h.usdValueCents === null ? "—" : money(h.usdValueCents)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Section>
          ) : null}
          <WalletDialog
            key={adding ? "add" : "closed"}
            open={adding}
            onClose={() => setAdding(false)}
            onSaved={reloadAll}
          />
          <WalletDialog
            key={editing?.id ?? "none"}
            wallet={editing ?? undefined}
            open={editing !== null}
            onClose={() => setEditing(null)}
            onSaved={reloadAll}
          />
          <RemoveDialog wallet={removing} onClose={() => setRemoving(null)} onSaved={reloadAll} />
        </>
      ) : null}
    </DetailPage>
  );
}
