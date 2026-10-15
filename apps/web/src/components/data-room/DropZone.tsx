import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Button } from "@rakazo/ui-web";
import { Upload, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import { dataRoomItemPath, dragHasFiles } from "../../lib/data-room";
import {
  dismissUploadToast,
  getUploadToasts,
  subscribeUploadToasts,
  type UploadFailure,
  uploadFilesToDataRoom,
} from "./upload-toasts";

const failureText = (reason: UploadFailure) =>
  reason === "too-large"
    ? t`Over the 50 MB limit`
    : reason === "invalid"
      ? t`Unsupported file name`
      : t`Upload failed`;

/** A full-window drop target for files, plus one toast per upload. Mounted once for every signed-in page. */
export function DataRoomDropZone() {
  const [dragging, setDragging] = useState(false);
  const toasts = useSyncExternalStore(subscribeUploadToasts, getUploadToasts);

  useEffect(() => {
    // dragenter and dragleave also fire for children, so count them.
    let depth = 0;
    const end = () => {
      depth = 0;
      setDragging(false);
    };
    const enter = (event: DragEvent) => {
      if (!dragHasFiles(event)) return;
      depth += 1;
      setDragging(true);
      // Close any open menu or popover (not a dialog); they would stay open under the overlay.
      if (depth === 1 && !document.querySelector('[role="dialog"], [role="alertdialog"]'))
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    };
    const over = (event: DragEvent) => {
      // Without this the browser would open the dropped file.
      if (dragHasFiles(event)) event.preventDefault();
    };
    const leave = (event: DragEvent) => {
      if (!dragHasFiles(event)) return;
      depth -= 1;
      if (depth <= 0) end();
    };
    const drop = (event: DragEvent) => {
      if (!dragHasFiles(event)) return;
      event.preventDefault();
      end();
      uploadFilesToDataRoom(Array.from(event.dataTransfer?.files ?? []));
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    window.addEventListener("dragend", end);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
      window.removeEventListener("dragend", end);
    };
  }, []);

  return (
    <>
      {dragging ? (
        <div
          data-testid="data-room-drop-overlay"
          className="pointer-events-none fixed inset-0 z-100 grid place-items-center bg-background/80"
        >
          <div className="flex items-center gap-2 rounded-xl border-2 border-dashed border-foreground/40 bg-card px-6 py-5 text-sm font-medium">
            <Upload aria-hidden="true" className="size-4" />
            <Trans>Drop to add to Data room</Trans>
          </div>
        </div>
      ) : null}
      {toasts.length > 0 ? (
        <div
          role="status"
          aria-live="polite"
          data-testid="data-room-toasts"
          className="fixed end-4 bottom-20 z-100 flex w-72 flex-col gap-2"
        >
          {toasts.map(({ id, name, state }) => (
            <div key={id} className="rounded-lg border border-border bg-card p-3 text-sm shadow-md">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate" title={name}>
                  {name}
                </span>
                {state.kind === "uploading" ? (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {Math.round(state.fraction * 100)}%
                  </span>
                ) : state.kind === "error" ? (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={t`Dismiss`}
                    onClick={() => dismissUploadToast(id)}
                  >
                    <X aria-hidden="true" />
                  </Button>
                ) : null}
              </div>
              {state.kind === "uploading" ? (
                <div
                  role="progressbar"
                  aria-label={name}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(state.fraction * 100)}
                  className="mt-2 h-1 overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${Math.round(state.fraction * 100)}%` }}
                  />
                </div>
              ) : state.kind === "filed" ? (
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className="text-success">
                    <Trans>Filed</Trans>
                  </span>
                  <Link
                    to={dataRoomItemPath(state.itemId)}
                    className="font-medium underline-offset-2 hover:underline"
                    onClick={() => dismissUploadToast(id)}
                  >
                    <Trans>View</Trans>
                  </Link>
                </div>
              ) : (
                <p className="mt-1 text-xs text-destructive">{failureText(state.reason)}</p>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
