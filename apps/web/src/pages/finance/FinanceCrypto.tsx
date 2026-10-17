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
} from "@rakazo/ui-web";
import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { LineChart } from "../../components/finance/charts";
import { ExchangeGroup } from "../../components/finance/ExchangeGroup";
import { DetailPage, Section, Th, useFinanceQuery } from "../../components/finance/ui";
import { useTypeNames, WalletDialog, walletName } from "../../components/finance/WalletDialog";
import { BlockscoutConnectDialog } from "../../components/integrations/BlockscoutConnectDialog";
import { chainName, tokenAmount } from "../../lib/crypto-format";
import { dayMonth, moneyExact } from "../../lib/finance-format";
import { financePath } from "../../lib/finance-route";
import { useHideAmounts } from "../../lib/hide-amounts-preference";
import { formatRelativeTime } from "../../lib/relative-time";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";

const rowBorder = "border-t border-border first:border-t-0 [&>td]:py-2";

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
    <table className="w-full border-collapse">
      <tbody>
        {data.wallets.map((wallet) => {
          const name = walletName(wallet);
          const threshold =
            wallet.type === "safe" && wallet.safeThreshold && wallet.safeOwners
              ? t`${wallet.safeThreshold} of ${wallet.safeOwners.length}`
              : null;
          return (
            <tr key={wallet.id} className={rowBorder}>
              <td className="font-semibold">
                {name}
                <span className="ms-1.5 font-normal text-muted-foreground">
                  {typeNames[wallet.type]}
                  {threshold ? ` · ${threshold}` : null}
                </span>
              </td>
              <td className="text-end tabular-nums">{moneyExact(cents.get(wallet.id) ?? 0)}</td>
              <td className="w-8 text-end">
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
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
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
  const [connecting, setConnecting] = useState(false);
  const data = q.data;
  const updated = data?.summary.lastSyncedAt ? formatRelativeTime(data.summary.lastSyncedAt) : "";
  const holdings = [...(data?.holdings ?? [])].sort(
    (a, b) => (b.usdValueCents ?? -1) - (a.usdValueCents ?? -1),
  );
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
      onRetry={q.retry}
    >
      {data ? (
        <>
          {data.connected && data.hasApiKey ? null : (
            <div>
              <Button size="sm" onClick={() => setConnecting(true)}>
                <Trans>Connect</Trans>
              </Button>
            </div>
          )}
          {connecting ? (
            <BlockscoutConnectDialog onConnected={reloadAll} onClose={() => setConnecting(false)} />
          ) : null}
          {data.lastError ? (
            <p role="alert" className="text-sm text-destructive">
              {data.lastError}
            </p>
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
              <>
                <div>
                  <div className="text-[22px] font-semibold leading-tight tabular-nums">
                    {moneyExact(walletCents)}
                  </div>
                  {unpriced > 0 ? (
                    <div className="text-[11px] text-muted-foreground">
                      {t`${unpriced} unpriced`}
                    </div>
                  ) : null}
                </div>
                <WalletRows data={data} onEdit={setEditing} onRemove={setRemoving} />
              </>
            ) : null}
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
          {data.summary.byChain.length > 0 ? (
            <Section title={<Trans>Chains</Trans>}>
              <table className="w-full border-collapse">
                <tbody>
                  {data.summary.byChain.map((row) => (
                    <tr key={row.chainId} className={rowBorder}>
                      <td>{chainName(row.chainId)}</td>
                      <td className="text-end tabular-nums">{moneyExact(row.cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          ) : null}
          {holdings.length > 0 ? (
            <Section title={<Trans>Holdings</Trans>}>
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <Th>
                      <Trans>Token</Trans>
                    </Th>
                    <Th>
                      <Trans>Chain</Trans>
                    </Th>
                    <Th right>
                      <Trans>Balance</Trans>
                    </Th>
                    <Th right>
                      <Trans>Value</Trans>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((h) => (
                    <tr
                      key={`${h.walletId}:${h.chainId}:${h.tokenAddress ?? ""}`}
                      className="border-t border-border [&>td]:py-2"
                    >
                      <td className="font-semibold">{h.symbol}</td>
                      <td className="text-muted-foreground">{chainName(h.chainId)}</td>
                      <td className="text-end tabular-nums">
                        {tokenAmount(h.rawBalance, h.decimals)}
                      </td>
                      <td className="text-end tabular-nums">
                        {h.usdValueCents === null ? "—" : moneyExact(h.usdValueCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
