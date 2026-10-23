import { Trans } from "@lingui/react/macro";
import type { CompanyPrivacy as PrivacyData } from "@rakazo/contracts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Skeleton,
} from "@rakazo/ui-web";
import { useRef, useState } from "react";
import { useFinanceQuery } from "../components/finance/ui";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";

type Source = PrivacyData["sources"][number];

export function CompanyPrivacy({
  onClose,
  onChanged,
}: {
  onClose: () => void;
  onChanged: () => void;
}) {
  const privacy = useFinanceQuery(() => rpc.company.privacy(), []);
  const popupRef = useRef<HTMLDivElement>(null);
  const [confirm, setConfirm] = useState<Source | "erase" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function act(operation: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await operation();
      privacy.reload();
      onChanged();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }
  const sourceControl = (source: Source, connected: boolean) =>
    rpc.company.sourceControl({
      sourceKind: source.sourceKind,
      connectionId: source.connectionId,
      mcpServerId: source.mcpServerId,
      connected,
    });
  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open && !busy && !confirm) onClose();
        }}
      >
        <DialogContent
          ref={popupRef}
          initialFocus={popupRef}
          tabIndex={-1}
          aria-describedby={undefined}
        >
          <DialogTitle>
            <Trans>Company privacy</Trans>
          </DialogTitle>
          {privacy.error && (
            <p role="alert" className="text-sm text-destructive">
              {privacy.error}
              <Button variant="link" onClick={privacy.reload}>
                <Trans>Retry</Trans>
              </Button>
            </p>
          )}
          {!privacy.data && !privacy.error && <Skeleton className="h-24" />}
          {privacy.data && (
            <section className="space-y-3">
              <h3 className="text-sm font-medium">
                <Trans>Sources</Trans>
              </h3>
              {privacy.data.sources.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  <Trans>No imported sources</Trans>
                </p>
              )}
              {privacy.data.sources.map((source) => (
                <div
                  key={JSON.stringify([source.sourceKind, source.connectionId, source.mcpServerId])}
                  className="flex items-center justify-between gap-3 border-t pt-3"
                >
                  <div className="min-w-0 text-sm">
                    <p className="truncate">{source.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {source.blocked ? (
                        <Trans>Disconnected</Trans>
                      ) : (
                        <Trans>{source.evidenceCount} evidence records</Trans>
                      )}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      source.blocked
                        ? void act(() => sourceControl(source, true))
                        : setConfirm(source)
                    }
                  >
                    {source.blocked ? <Trans>Reconnect</Trans> : <Trans>Disconnect</Trans>}
                  </Button>
                </div>
              ))}
            </section>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="border-t pt-4">
            <Button variant="destructive" disabled={busy} onClick={() => setConfirm("erase")}>
              <Trans>Erase company map</Trans>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "erase" ? (
                <Trans>Erase company map?</Trans>
              ) : (
                <Trans>Disconnect source?</Trans>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "erase" ? (
                <Trans>
                  Delete your company facts, import history, corrections and exclusions. Documents
                  and integrations stay connected. This cannot be undone.
                </Trans>
              ) : (
                <Trans>
                  Stop Company imports from this source and remove its evidence. Facts without other
                  evidence are removed; your edits stay. Your integration stays connected.
                </Trans>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Trans>Cancel</Trans>
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const action = confirm;
                setConfirm(null);
                if (action)
                  void act(async () => {
                    if (action === "erase") {
                      await rpc.company.erase();
                      onClose();
                    } else await sourceControl(action, false);
                  });
              }}
            >
              {confirm === "erase" ? <Trans>Erase</Trans> : <Trans>Disconnect</Trans>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
