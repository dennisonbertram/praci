import { Trans, useLingui } from "@lingui/react/macro";
import type { FinanceWallet, WalletType } from "@rakazo/contracts";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  NativeSelect,
  NativeSelectOption,
} from "@rakazo/ui-web";
import { type FormEvent, useId, useState } from "react";
import { shortAddress } from "../../lib/crypto-format";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";

const TYPES: WalletType[] = ["personal", "safe", "exchange", "contract"];

export function useTypeNames(): Record<WalletType, string> {
  const { t } = useLingui();
  return { personal: t`Personal`, safe: t`Safe`, exchange: t`Exchange`, contract: t`Contract` };
}

/** One line under the Type field saying what the chosen type means. */
function useTypeHints(): Record<WalletType, string> {
  const { t } = useLingui();
  return {
    personal: t`A wallet you hold the keys to.`,
    safe: t`A Safe multisig. Its owners and threshold are shown.`,
    exchange: t`A deposit address at an exchange.`,
    contract: t`A smart contract that holds funds.`,
  };
}

export const walletName = (wallet: FinanceWallet) =>
  wallet.label ?? wallet.ensName ?? shortAddress(wallet.address);

/** Adds a wallet, or edits the label and type of `wallet`. Server errors (invalid, duplicate) show inline. */
export function WalletDialog({
  wallet,
  open,
  onClose,
  onSaved,
}: {
  wallet?: FinanceWallet;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useLingui();
  const typeNames = useTypeNames();
  const typeHints = useTypeHints();
  const id = useId();
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState(wallet?.label ?? "");
  const [type, setType] = useState<WalletType>(wallet?.type ?? "personal");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const trimmed = label.trim();
      if (wallet) {
        await rpc.finance.walletUpdate({ id: wallet.id, label: trimmed || null, type });
      } else {
        await rpc.finance.walletAdd({
          addressOrEns: address,
          ...(trimmed ? { label: trimmed } : {}),
          type,
        });
      }
      onSaved();
      onClose();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <DialogHeader>
            <DialogTitle>
              {wallet ? <Trans>Edit wallet</Trans> : <Trans>Add wallet</Trans>}
            </DialogTitle>
          </DialogHeader>
          {wallet ? null : (
            <Field>
              <FieldLabel htmlFor={`${id}-address`}>
                <Trans>Address or ENS</Trans>
              </FieldLabel>
              <Input
                id={`${id}-address`}
                autoFocus
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={t`0x… or name.eth`}
                spellCheck={false}
                autoComplete="off"
              />
            </Field>
          )}
          <Field>
            <FieldLabel htmlFor={`${id}-label`}>
              <Trans>Label (optional)</Trans>
            </FieldLabel>
            <Input
              id={`${id}-label`}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={100}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-type`}>
              <Trans>Type</Trans>
            </FieldLabel>
            <NativeSelect
              id={`${id}-type`}
              className="w-full"
              aria-describedby={`${id}-type-hint`}
              value={type}
              onChange={(e) => setType(e.target.value as WalletType)}
            >
              {TYPES.map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {typeNames[value]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldDescription id={`${id}-type-hint`}>{typeHints[type]}</FieldDescription>
          </Field>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              <Trans>Cancel</Trans>
            </Button>
            <Button type="submit" disabled={busy}>
              {wallet ? <Trans>Save</Trans> : <Trans>Add</Trans>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
