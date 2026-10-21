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
 * Asks a space owner for the Devin organization service-user key. `connect` connects the space;
 * `replace` swaps the key of a rejected connection. Either lands on the Devin page. The server
 * checks the key and its message ("The key was refused.") is shown inline.
 */
export function DevinConnectDialog({
  mode = "connect",
  onConnected,
  onClose,
}: {
  mode?: "connect" | "replace";
  /** Called once the key is accepted, before the dialog closes. */
  onConnected?: () => void;
  onClose: () => void;
}) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const input = { secret: secret.trim() };
      await (mode === "replace" ? rpc.devin.replaceKey(input) : rpc.devin.connect(input));
      onConnected?.();
      onClose();
      navigate("/app/devin");
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
              <AppLogo name="Devin" logo={null} />
              <DialogTitle>
                <Trans>Connect Devin</Trans>
              </DialogTitle>
            </div>
            <DialogDescription>
              <Trans>Connects Devin for everyone in this space. Read-only.</Trans>
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1">
            <Input
              autoFocus
              type="password"
              autoComplete="off"
              spellCheck={false}
              aria-label={t`Organization service-user key`}
              placeholder={t`Organization service-user key`}
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
            />
            <a
              href="https://docs.devin.ai/api-reference/authentication"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              <Trans>Where to find your key</Trans>
            </a>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              <Trans>Cancel</Trans>
            </Button>
            <Button type="submit" disabled={busy || !secret.trim()}>
              {busy ? <Trans>Connecting…</Trans> : <Trans>Connect</Trans>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
