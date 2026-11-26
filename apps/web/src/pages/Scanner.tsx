import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { ScannerState } from "@rakazo/contracts";
import { isScannerFolderPath } from "@rakazo/contracts";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
} from "@rakazo/ui-web";
import { Ellipsis, ScanLine } from "lucide-react";
import { useEffect, useState } from "react";
import { PAGE_GUTTER_X } from "../components/PageHeader";
import { desktopBridge } from "../lib/desktop";
import { SCANNER_RETRY } from "../lib/scanner-delivery";
import { errorText } from "../lib/user-error";
import { DataRoomPage } from "./DataRoom";

const SANE_INSTALL_COMMAND = "brew install sane-backends";

function statusText(state: ScannerState | undefined, platform: string | undefined) {
  if (!state) return t`Connecting…`;
  switch (state.kind) {
    case "ready":
      if (!state.device) return t`Ready`;
      return state.autoScan ? t`${state.device} · Scans when paper is loaded` : state.device;
    case "scanning":
      return t`Scanning…`;
    case "not-found":
      return t`No scanner found`;
    case "sane-missing":
      return platform === "darwin"
        ? t`Install sane-backends with Homebrew`
        : t`Install sane-backends`;
    case "busy":
      return t`Scanner busy`;
    case "error":
      return t`Scan failed`;
  }
}

export function ScannerPage({
  spaceName,
  onAskAgent,
}: {
  spaceName?: string;
  onAskAgent?: () => void;
}) {
  const bridge = desktopBridge();
  const scanner = bridge?.scanner;
  const [state, setState] = useState<ScannerState>();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [editingFolder, setEditingFolder] = useState(false);
  const [folder, setFolder] = useState("");
  const [folderError, setFolderError] = useState("");
  useEffect(() => {
    if (!scanner) return;
    let live = true;
    const unsubscribe = scanner.onState((next) => live && setState(next));
    void scanner
      .state()
      .then((next) => live && setState(next))
      .catch(() => live && setError(t`Could not read scanner status`));
    return () => {
      live = false;
      unsubscribe();
    };
  }, [scanner]);
  const run = async (action: () => Promise<unknown>) => {
    setPending(true);
    setError("");
    try {
      await action();
    } catch (cause) {
      setError(errorText(cause, t`Scanner request failed`));
    } finally {
      setPending(false);
    }
  };
  const editFolder = (open: boolean) => {
    setFolderError("");
    setEditingFolder(open);
  };
  const status = statusText(state, bridge?.platform);
  const scanning = state?.kind === "scanning";
  // The status line already names the missing package; a second copy below it would repeat it.
  const alert = error || (state?.kind === "sane-missing" ? undefined : state?.error);
  const copyCommand = () => {
    void navigator.clipboard?.writeText(SANE_INSTALL_COMMAND).catch(() => undefined);
  };
  return (
    <>
      <DataRoomPage
        source="scan"
        spaceName={spaceName}
        emptyDescription={
          scanner ? undefined : <Trans>Use the desktop app to scan a document.</Trans>
        }
        onAskAgent={onAskAgent}
        headerMeta={scanner ? <span role="status">{status}</span> : undefined}
        headerActions={
          scanner ? (
            <>
              {state?.kind === "sane-missing" && bridge?.platform === "darwin" ? (
                <>
                  <code className="select-all text-xs text-muted-foreground">
                    {SANE_INSTALL_COMMAND}
                  </code>
                  <Button variant="outline" onClick={copyCommand}>
                    <Trans>Copy command</Trans>
                  </Button>
                </>
              ) : null}
              {scanning ? (
                <Button variant="outline" onClick={() => void run(() => scanner.cancel())}>
                  <Trans>Cancel scan</Trans>
                </Button>
              ) : (
                <Button
                  disabled={pending || !state || !["ready", "error"].includes(state.kind)}
                  onClick={() => void run(() => scanner.scan())}
                >
                  <ScanLine aria-hidden="true" />
                  <Trans>Scan</Trans>
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="ghost" size="icon" aria-label={t`Scanner settings`} />}
                >
                  <Ellipsis aria-hidden="true" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuCheckboxItem
                    checked={state?.autoScan ?? false}
                    disabled={!state || pending}
                    onCheckedChange={(enabled) => void run(() => scanner.setAutoScan(enabled))}
                  >
                    <Trans>Auto-scan</Trans>
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuItem
                    disabled={!state || pending}
                    onClick={() => {
                      setFolder(state?.folder.join("/") ?? "Scans");
                      editFolder(true);
                    }}
                  >
                    <Trans>Destination…</Trans>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => window.dispatchEvent(new Event(SCANNER_RETRY))}>
                    <Trans>Retry pending scans</Trans>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : undefined
        }
        beforeList={
          scanner && alert ? (
            <div className={`${PAGE_GUTTER_X} pb-3 text-sm`}>
              <p role="alert" className="text-destructive">
                {alert}
              </p>
            </div>
          ) : undefined
        }
      />
      {scanner && (
        <Dialog open={editingFolder} onOpenChange={editFolder}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                <Trans>Scan destination</Trans>
              </DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setFolderError("");
                const path = folder.trim() ? folder.split("/").map((part) => part.trim()) : [];
                if (!isScannerFolderPath(path)) {
                  setFolderError(t`Enter a valid folder path`);
                  return;
                }
                void run(async () => {
                  await scanner.setFolder(path);
                  editFolder(false);
                });
              }}
            >
              <label htmlFor="scanner-folder" className="mb-2 block text-sm">
                <Trans>Folder</Trans>
              </label>
              <Input
                id="scanner-folder"
                value={folder}
                onChange={(event) => {
                  setFolder(event.target.value);
                  setFolderError("");
                }}
                placeholder="Scans"
                autoFocus
              />
              {(folderError || error) && (
                <p role="alert" className="mt-2 text-sm text-destructive">
                  {folderError || error}
                </p>
              )}
              <div className="mt-4 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => editFolder(false)}>
                  <Trans>Cancel</Trans>
                </Button>
                <Button type="submit" disabled={pending}>
                  <Trans>Save</Trans>
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
