import { Trans, useLingui } from "@lingui/react/macro";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from "@rakazo/ui-web";
import type { FormEvent } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";
import { AppLogo } from "./AppLogo";

/**
 * Asks the space owner for a Brex user token. `connect` connects the space and lands on the server
 * page; `replace` swaps the token of an existing connection and stays. The server checks the token
 * first, so a refusal ("Brex rejected this token") is shown inline and nothing changes.
 */
export function BrexCardsConnectDialog({
  mode = "connect",
  onConnected,
  onClose,
}: {
  mode?: "connect" | "replace";
  /** Called once the token is accepted, before the dialog closes; the server page waits for it. */
  onConnected?: () => void | Promise<void>;
  onClose: () => void;
}) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const input = { token: token.trim() };
      if (mode === "replace") {
        await rpc.brexCards.replaceToken(input);
        await onConnected?.();
        onClose();
        return;
      }
      const { serverId } = await rpc.brexCards.connect(input);
      await onConnected?.();
      onClose();
      navigate(`/app/integrations/mcp/${serverId}`);
    } catch (cause) {
      setError(errorText(cause));
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <AppLogo name="Brex cards" logo={null} />
              <DialogTitle>
                {mode === "replace" ? (
                  <Trans>Replace token</Trans>
                ) : (
                  <Trans>Connect Brex cards</Trans>
                )}
              </DialogTitle>
            </div>
            <DialogDescription>
              {mode === "replace" ? (
                <Trans>Use a token for the same Brex account.</Trans>
              ) : (
                <Trans>Every change waits for your approval.</Trans>
              )}
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            type="password"
            autoComplete="off"
            spellCheck={false}
            aria-label={t`API token`}
            placeholder={t`API token`}
            value={token}
            onChange={(event) => setToken(event.target.value)}
          />
          <details className="text-xs text-muted-foreground">
            <summary className="w-fit cursor-pointer hover:text-foreground">
              <Trans>Permissions for the token</Trans>
            </summary>
            <ul className="mt-2 flex flex-col gap-1">
              <li>
                <Trans>In Brex: Settings → Developer → Create API token.</Trans>
              </li>
              <li>
                <Trans>Read and write: Cards, Budgets, Card Expenses</Trans>
              </li>
              <li>
                <Trans>
                  Read only: Users, Companies, Card Transactions, Trips, Business Accounts Data,
                  Business Accounts Statements
                </Trans>
              </li>
              <li>
                <Trans>Leave Card Numbers Read and Send off.</Trans>
              </li>
            </ul>
          </details>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              <Trans>Cancel</Trans>
            </Button>
            <Button type="submit" disabled={busy || !token.trim()}>
              {mode === "replace" ? (
                busy ? (
                  <Trans>Saving…</Trans>
                ) : (
                  <Trans>Save</Trans>
                )
              ) : busy ? (
                <Trans>Connecting…</Trans>
              ) : (
                <Trans>Connect</Trans>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
