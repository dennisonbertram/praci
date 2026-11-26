import { Trans, useLingui } from "@lingui/react/macro";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from "@rakazo/ui-web";
import { useEffect, useState } from "react";
import { authClient } from "../lib/auth";
import { fetchAuthCapabilities } from "../lib/auth-capabilities";
import { passkeyCancelled, passkeysAvailable } from "../lib/passkey-support";
import { authErrorText } from "../lib/user-error";

/** Add, list and remove passkeys. Renders nothing where passkeys cannot work. */
export function PasskeySettings() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [lookupFailed, setLookupFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    void fetchAuthCapabilities()
      .then((capabilities) => {
        if (active) {
          setSupported(passkeysAvailable(capabilities.passkey));
          setLookupFailed(false);
        }
      })
      .catch(() => {
        if (active) {
          const available = passkeysAvailable(true);
          setSupported(available);
          setLookupFailed(available);
        }
      });
    return () => {
      active = false;
    };
  }, [retry]);
  if (lookupFailed) {
    return <PasskeyLoadError onRetry={() => setRetry((attempt) => attempt + 1)} />;
  }
  if (supported !== true) return null;
  return <PasskeyList />;
}

function PasskeyLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="py-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[15px] font-medium text-foreground">
          <Trans>Passkeys</Trans>
        </h3>
        <span className="flex items-center gap-3 text-sm text-destructive">
          <Trans>Could not load</Trans>
          <Button variant="ghost" size="sm" onClick={onRetry}>
            <Trans>Try again</Trans>
          </Button>
        </span>
      </div>
    </div>
  );
}

function PasskeyList() {
  const { t } = useLingui();
  const fallback = t`Could not continue`;
  const passkeys = authClient.useListPasskeys();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The passkey waiting for the person to confirm its removal; a deleted passkey cannot be restored.
  const [removing, setRemoving] = useState<{ id: string; label: string } | null>(null);
  async function run(call: () => Promise<{ error: unknown }>) {
    setPending(true);
    setError(null);
    try {
      const result = await call();
      if (result.error && !passkeyCancelled(result.error)) {
        setError(authErrorText(result.error, fallback));
      }
    } catch {
      setError(fallback);
    } finally {
      setPending(false);
    }
  }
  if (passkeys.error && !passkeys.data) {
    return <PasskeyLoadError onRetry={() => void passkeys.refetch()} />;
  }
  return (
    <div className="py-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[15px] font-medium text-foreground">
          <Trans>Passkeys</Trans>
        </h3>
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => void run(() => authClient.passkey.addPasskey())}
        >
          <Trans>Add passkey</Trans>
        </Button>
      </div>
      {passkeys.data?.length ? (
        <ul className="mt-2 divide-y divide-border">
          {passkeys.data.map((passkey) => {
            const label = passkey.name || t`Passkey`;
            return (
              <li key={passkey.id} className="flex items-center justify-between gap-3 py-2">
                <p className="min-w-0 text-[14px] text-foreground/75">
                  <span className="block truncate">{label}</span>
                  <span className="block text-[13px] text-muted-foreground/70">
                    {new Date(passkey.createdAt).toLocaleDateString()}
                  </span>
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  aria-label={t`Remove passkey ${label}`}
                  onClick={() => setRemoving({ id: passkey.id, label })}
                >
                  <Trans>Remove</Trans>
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="break-words">
              {removing ? t`Remove ${removing.label}?` : null}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Trans>Cancel</Trans>
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const id = removing?.id;
                setRemoving(null);
                if (id) void run(() => authClient.passkey.deletePasskey({ id }));
              }}
            >
              <Trans>Remove</Trans>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
