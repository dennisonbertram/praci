import { Trans, useLingui } from "@lingui/react/macro";
import type {
  ExchangeProvider,
  FinanceExchange,
  FinanceProvider,
  FinanceSource,
} from "@rakazo/contracts";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@rakazo/ui-web";
import { FileText, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { connectFinanceProvider } from "../../lib/finance-connect";
import { EXCHANGES, FINANCE_PROVIDERS } from "../../lib/integrations";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";
import { AppLogo } from "../integrations/AppLogo";
import { StatementImport } from "./StatementImport";

export type CryptoChoice = "wallet" | ExchangeProvider;
type Step = "type" | "bank";

function Option({
  icon,
  title,
  line,
  connected,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  line: string;
  connected?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled || connected}
      onClick={onClick}
      className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-card p-3 text-start transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-default disabled:opacity-70 disabled:hover:bg-card"
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span data-option-title className="block truncate font-semibold">
          {title}
        </span>
        <span className="block truncate text-xs text-muted-foreground">{line}</span>
      </span>
      {connected ? (
        <Badge variant="secondary">
          <Trans>Connected</Trans>
        </Badge>
      ) : null}
    </button>
  );
}

const iconTile = (icon: ReactNode) => (
  <span className="grid size-10 shrink-0 place-items-center rounded-[10px] border border-border bg-muted text-muted-foreground">
    {icon}
  </span>
);

/**
 * The one place accounts are added: every way in as option cards. Crypto choices go to
 * `onPickCrypto` (the page opens that dialog); Mercury and Brex connect here; statements upload
 * here and create the account on import. `initialStep="bank"` opens straight on the upload.
 */
export function AddAccountDialog({
  initialStep = "type",
  onPickCrypto,
  onImported,
  onConnected,
  onClose,
}: {
  initialStep?: Step;
  onPickCrypto?: (choice: CryptoChoice) => void;
  onImported: () => void;
  /** A bank is connected and synced; the page is about to reload its accounts. */
  onConnected?: () => void;
  onClose: () => void;
}) {
  const { t } = useLingui();
  const [step, setStep] = useState<Step>(initialStep);
  const [sources, setSources] = useState<FinanceSource[]>([]);
  const [exchanges, setExchanges] = useState<FinanceExchange[]>([]);
  const [busy, setBusy] = useState<FinanceProvider | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (initialStep !== "type") return;
    rpc.finance
      .overview()
      .then((overview) => setSources(overview.sources))
      .catch(() => {});
    rpc.finance
      .exchanges()
      .then(setExchanges)
      .catch(() => {});
  }, [initialStep]);

  async function connect(provider: FinanceProvider) {
    setBusy(provider);
    setError("");
    try {
      const result = await connectFinanceProvider(provider);
      if (result === "cancelled") {
        setError(t`Sign-in was cancelled or did not finish. Try again.`);
      } else {
        // Read the new accounts before the page reloads, so it shows them, not an empty list. A
        // failed sync still connected; the dashboard shows the sync error and retries.
        await rpc.finance.refresh().catch(() => {});
        onConnected?.();
        onImported();
        onClose();
      }
    } catch (cause) {
      setError(errorText(cause, t`Could not connect`));
    } finally {
      setBusy(null);
    }
  }

  const bankLine = {
    mercury: t`Read balances and transactions`,
    brex: t`Read cards, expenses and bills`,
  };
  const exchangeLine = t`Read-only API key`;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {step === "bank" ? <Trans>Upload statements</Trans> : <Trans>Add account</Trans>}
          </DialogTitle>
        </DialogHeader>
        {step === "type" ? (
          <div className="flex flex-col gap-4">
            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold text-muted-foreground">
                <Trans>Bank</Trans>
              </h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {FINANCE_PROVIDERS.map(({ provider, name, logo }) => (
                  <Option
                    key={provider}
                    icon={<AppLogo name={name} logo={logo} />}
                    title={name}
                    line={busy === provider ? t`Connecting…` : bankLine[provider]}
                    connected={sources.find((s) => s.provider === provider)?.status === "ok"}
                    disabled={busy !== null}
                    onClick={() => void connect(provider)}
                  />
                ))}
                <Option
                  icon={iconTile(<FileText className="size-5" aria-hidden="true" />)}
                  title={t`Upload statements`}
                  line={t`PDF, CSV, OFX or QFX`}
                  onClick={() => setStep("bank")}
                />
              </div>
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
            </section>
            {onPickCrypto ? (
              <section className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold text-muted-foreground">
                  <Trans>Crypto</Trans>
                </h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Option
                    icon={iconTile(<Wallet className="size-5" aria-hidden="true" />)}
                    title={t`Wallet`}
                    line={t`Address or ENS`}
                    onClick={() => {
                      onClose();
                      onPickCrypto("wallet");
                    }}
                  />
                  {EXCHANGES.map(({ provider, name, logo }) => (
                    <Option
                      key={provider}
                      icon={<AppLogo name={name} logo={logo} />}
                      title={name}
                      line={exchangeLine}
                      connected={exchanges.some((e) => e.provider === provider && e.connected)}
                      onClick={() => {
                        onClose();
                        onPickCrypto(provider);
                      }}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        ) : (
          <StatementImport onImported={onImported} />
        )}
        <DialogFooter>
          {step === "bank" && initialStep === "type" ? (
            <Button type="button" variant="ghost" onClick={() => setStep("type")}>
              <Trans>Back</Trans>
            </Button>
          ) : null}
          <Button type="button" variant={step === "bank" ? "default" : "outline"} onClick={onClose}>
            {step === "bank" ? <Trans>Done</Trans> : <Trans>Cancel</Trans>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
