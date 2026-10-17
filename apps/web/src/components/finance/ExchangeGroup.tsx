import { Trans, useLingui } from "@lingui/react/macro";
import type { FinanceExchange } from "@rakazo/contracts";
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
import { moneyExact } from "../../lib/finance-format";
import { useHideAmounts } from "../../lib/hide-amounts-preference";
import { EXCHANGES } from "../../lib/integrations";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";
import { Section, Th } from "./ui";

export const exchangeName = (provider: FinanceExchange["provider"]) =>
  EXCHANGES.find((e) => e.provider === provider)?.name ?? provider;

/** One exchange's balances (asset, amount, value) with a menu to remove the connection. */
export function ExchangeGroup({
  exchange,
  onChanged,
}: {
  exchange: FinanceExchange;
  onChanged: () => void;
}) {
  useHideAmounts();
  const { t } = useLingui();
  const name = exchangeName(exchange.provider);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    try {
      await rpc.finance.exchangeRemove({ id: exchange.id });
      onChanged();
      setConfirming(false);
    } catch (cause) {
      setError(errorText(cause));
    }
  }
  return (
    <Section
      title={name}
      action={
        <>
          <span className="text-[13px] font-semibold tabular-nums">
            {moneyExact(exchange.totalCents)}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-xs" aria-label={t`Actions for ${name}`} />}
            >
              <MoreHorizontal aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem variant="destructive" onClick={() => setConfirming(true)}>
                <Trans>Remove</Trans>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      }
    >
      {exchange.lastError ? (
        <p role="alert" className="text-sm text-destructive">
          {exchange.lastError}
        </p>
      ) : null}
      {exchange.balances.length > 0 ? (
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <Th>
                <Trans>Asset</Trans>
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
            {exchange.balances.map((b) => (
              <tr key={b.asset} className="border-t border-border [&>td]:py-2">
                <td className="font-semibold">{b.asset}</td>
                <td className="text-end tabular-nums">{b.amount}</td>
                <td className="text-end tabular-nums">
                  {b.usdValueCents === null ? "—" : moneyExact(b.usdValueCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      <AlertDialog open={confirming} onOpenChange={(open) => !open && setConfirming(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t`Remove ${name}?`}</AlertDialogTitle>
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
    </Section>
  );
}
