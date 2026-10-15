import { Trans, useLingui } from "@lingui/react/macro";
import type { FinanceProvider, FinanceSource } from "@rakazo/contracts";
import { Button } from "@rakazo/ui-web";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { connectFinanceProvider } from "../../lib/finance-connect";
import { financePath } from "../../lib/finance-route";
import { FINANCE_PROVIDERS } from "../../lib/integrations";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";
import { AppLogo } from "./AppLogo";
import { BlockscoutConnectDialog } from "./BlockscoutConnectDialog";
import { StatusBadge } from "./parts";

/** Blockscout needs a PRO API key: a server without one does not count as connected. */
function CryptoTile() {
  const { t } = useLingui();
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [dialog, setDialog] = useState(false);

  const load = () =>
    rpc.finance
      .crypto()
      .then((crypto) => setHasKey(crypto.connected && crypto.hasApiKey))
      .catch(() => setHasKey(false));
  useEffect(() => {
    void load();
  }, []);

  return (
    <div
      data-testid="finance-tile-crypto"
      className="flex min-w-0 flex-col gap-2.5 rounded-xl border border-border bg-card p-3.5"
    >
      <div className="flex min-w-0 items-center gap-3">
        <AppLogo name="Blockscout" logo="/logos/blockscout.svg" />
        <div className="min-w-0">
          <div className="truncate font-semibold">Blockscout</div>
          <div className="truncate text-xs text-muted-foreground">
            <Trans>Read wallet balances</Trans>
          </div>
        </div>
      </div>
      <div className="mt-auto flex items-center gap-2">
        {hasKey ? (
          <>
            <StatusBadge status="connected" />
            <Button size="sm" variant="ghost" className="ms-auto" onClick={() => setDialog(true)}>
              <Trans>Replace API key</Trans>
            </Button>
            <Link
              to={financePath.crypto()}
              className="inline-flex h-7 items-center rounded-lg border border-border px-2.5 text-[0.8rem] font-medium hover:bg-muted"
            >
              <Trans>Open</Trans>
            </Link>
          </>
        ) : (
          <>
            <span className="text-xs text-muted-foreground">
              <Trans>Not connected</Trans>
            </span>
            <Button
              size="sm"
              variant="outline"
              className="ms-auto"
              disabled={hasKey === null}
              aria-label={t`Connect Blockscout`}
              onClick={() => setDialog(true)}
            >
              <Trans>Connect</Trans>
            </Button>
          </>
        )}
      </div>
      {dialog ? (
        <BlockscoutConnectDialog onConnected={() => void load()} onClose={() => setDialog(false)} />
      ) : null}
    </div>
  );
}

/** Mercury and Brex tiles. They connect through the Finance API so the server treats them as
 * finance sources and the Finance agent gets its read-only assignment. */
export function FinanceSection({
  sources,
  onChanged,
}: {
  sources: FinanceSource[];
  onChanged: () => void;
}) {
  const { t } = useLingui();
  const [busy, setBusy] = useState<FinanceProvider | null>(null);
  const [errors, setErrors] = useState<Partial<Record<FinanceProvider, string>>>({});
  const description = {
    mercury: t`Read balances and transactions`,
    brex: t`Read cards, expenses and bills`,
  };

  async function connect(provider: FinanceProvider, reconnect: boolean) {
    setBusy(provider);
    setErrors((prev) => ({ ...prev, [provider]: undefined }));
    try {
      const result = await connectFinanceProvider(provider, reconnect);
      if (result === "cancelled") {
        setErrors((prev) => ({
          ...prev,
          [provider]: t`Sign-in was cancelled or did not finish. Try again.`,
        }));
      }
    } catch (err) {
      setErrors((prev) => ({ ...prev, [provider]: errorText(err, t`Could not connect`) }));
    } finally {
      setBusy(null);
      onChanged();
    }
  }

  return (
    <div
      data-testid="finance-section"
      className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]"
    >
      {FINANCE_PROVIDERS.map(({ provider, name, logo }) => {
        const status = sources.find((source) => source.provider === provider)?.status;
        const connected = status === "ok";
        const reconnect = status === "needs_reconnect" || status === "error";
        const error = errors[provider];
        return (
          <div
            key={provider}
            data-testid={`finance-tile-${provider}`}
            className="flex min-w-0 flex-col gap-2.5 rounded-xl border border-border bg-card p-3.5"
          >
            <div className="flex min-w-0 items-center gap-3">
              <AppLogo name={name} logo={logo} />
              <div className="min-w-0">
                <div className="truncate font-semibold">{name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {description[provider]}
                </div>
              </div>
            </div>
            <div className="mt-auto flex items-center gap-2">
              {busy === provider ? (
                <StatusBadge status="connecting" />
              ) : connected ? (
                <StatusBadge status="connected" />
              ) : status === "needs_reconnect" ? (
                <StatusBadge status="reconnect" />
              ) : status === "error" ? (
                <StatusBadge status="failed" />
              ) : (
                <span className="text-xs text-muted-foreground">
                  <Trans>Not connected</Trans>
                </span>
              )}
              {connected ? (
                <Link
                  to="/app/finance"
                  className="ms-auto inline-flex h-7 items-center rounded-lg border border-border px-2.5 text-[0.8rem] font-medium hover:bg-muted"
                >
                  <Trans>Open Finance</Trans>
                </Link>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="ms-auto"
                  disabled={busy !== null}
                  aria-label={reconnect ? t`Reconnect ${name}` : t`Connect ${name}`}
                  onClick={() => void connect(provider, reconnect)}
                >
                  {reconnect ? <Trans>Reconnect</Trans> : <Trans>Connect</Trans>}
                </Button>
              )}
            </div>
            {error ? (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            ) : null}
          </div>
        );
      })}
      <CryptoTile />
    </div>
  );
}
