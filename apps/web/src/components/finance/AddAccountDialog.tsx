import { Trans, useLingui } from "@lingui/react/macro";
import type { ExchangeProvider } from "@rakazo/contracts";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@rakazo/ui-web";
import { useState } from "react";
import { StatementImport } from "./StatementImport";

export type CryptoChoice = "wallet" | ExchangeProvider;
type Step = "type" | "crypto" | "bank";

/**
 * The one place accounts are added. Crypto hands the choice to `onPickCrypto` (the page opens that
 * dialog); a bank account is added by uploading statements, which creates the account on import.
 * `initialStep="bank"` opens straight on the upload, for the reminder.
 */
export function AddAccountDialog({
  initialStep = "type",
  onPickCrypto,
  onImported,
  onClose,
}: {
  initialStep?: Step;
  onPickCrypto?: (choice: CryptoChoice) => void;
  onImported: () => void;
  onClose: () => void;
}) {
  const { t } = useLingui();
  const [step, setStep] = useState<Step>(initialStep);
  const option = (label: string, onClick: () => void) => (
    <Button type="button" variant="outline" className="justify-start" onClick={onClick}>
      {label}
    </Button>
  );
  const crypto: [string, CryptoChoice][] = [
    [t`Crypto wallet`, "wallet"],
    ["Coinbase", "coinbase"],
    ["Kraken", "kraken"],
  ];
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {step === "crypto" ? (
              <Trans>Crypto</Trans>
            ) : step === "bank" ? (
              <Trans>Bank account</Trans>
            ) : (
              <Trans>Add account</Trans>
            )}
          </DialogTitle>
        </DialogHeader>
        {step === "type" ? (
          <div className="flex flex-col gap-2">
            {onPickCrypto ? (
              <Button
                type="button"
                variant="outline"
                className="justify-start"
                onClick={() => setStep("crypto")}
              >
                <Trans>Crypto</Trans>
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="justify-start"
              onClick={() => setStep("bank")}
            >
              <Trans>Bank account</Trans>
            </Button>
          </div>
        ) : null}
        {step === "crypto" ? (
          <div className="flex flex-col gap-2">
            {crypto.map(([label, choice]) => (
              <span key={choice} className="contents">
                {option(label, () => {
                  onClose();
                  onPickCrypto?.(choice);
                })}
              </span>
            ))}
          </div>
        ) : null}
        {step === "bank" ? <StatementImport onImported={onImported} /> : null}
        <DialogFooter>
          {step !== "type" && initialStep === "type" ? (
            <Button type="button" variant="ghost" onClick={() => setStep("type")}>
              <Trans>Back</Trans>
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={onClose}>
            {step === "bank" ? <Trans>Done</Trans> : <Trans>Cancel</Trans>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
