import { plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { DataRoomApiImport } from "@rakazo/contracts";
import { Button } from "@rakazo/ui-web";
import { Upload, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import { DATA_ROOM_PATH, dataRoomItemPath, dragHasFiles } from "../../lib/data-room";
import { Shimmer } from "../ai/primitives";
import type { UploadFailure } from "./upload-toasts";
import {
  dismissUploadToast,
  getUploadToasts,
  holdUploadToasts,
  setUploadScope,
  subscribeUploadToasts,
  uploadFilesToDataRoom,
} from "./upload-toasts";

const failureText = (reason: UploadFailure) =>
  reason === "invalid"
    ? t`Unsupported file name`
    : reason === "folder-gone"
      ? t`This folder no longer exists`
      : reason === "zip-too-large"
        ? t`This zip is too large to unpack`
        : reason === "zip-too-many-files"
          ? t`This zip has more than 10,000 files`
          : reason === "zip-encrypted"
            ? t`This zip is password-protected`
            : reason === "zip-unsafe"
              ? t`This zip has unsafe file paths`
              : reason === "zip-invalid"
                ? t`This zip can't be read`
                : reason === "network"
                  ? t`Upload failed. Check your connection and try again.`
                  : t`Upload failed. The server could not save this file.`;

/** The one line under an upload card's name while a zip is opened, filed and read. */
export const importingText = (name: string, progress: DataRoomApiImport | null) => {
  if (!progress || progress.stage === "opening") return t`Opening ${name}`;
  const { total, added, currentName, done } = progress;
  if (progress.stage === "adding")
    return added === 0 && !currentName
      ? t`Found ${total} files`
      : t`Adding ${added} of ${total} · ${currentName ?? ""}`;
  return t`Reading ${done} of ${total}`;
};

const duplicateText = ({ name, folder }: { name?: string; folder?: string }) =>
  folder
    ? name
      ? t`Already in ${folder} as ${name}`
      : t`Already in ${folder}`
    : name
      ? t`Already in your Data room as ${name}`
      : t`Already in your Data room`;

/** A full-window drop target for files, plus one toast per upload. Mounted once for every signed-in page. */
export function DataRoomDropZone({ userId }: { userId: string | null }) {
  const [dragging, setDragging] = useState(false);
  const toasts = useSyncExternalStore(subscribeUploadToasts, getUploadToasts);

  useEffect(() => {
    setUploadScope(userId);
    return () => setUploadScope(null);
  }, [userId]);

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
      // A drop target that wants these files claims the drag on dragenter; no overlay flash.
      if (event.defaultPrevented) return;
      setDragging(true);
      // Close any open menu or popover (not a dialog); they would stay open under the overlay.
      if (depth === 1 && !document.querySelector('[role="dialog"], [role="alertdialog"]'))
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    };
    const over = (event: DragEvent) => {
      if (!dragHasFiles(event)) return;
      // A drop target that wants these files (composer, statement import, ...) has already
      // accepted the drag by now. Leave it to that target and take the overlay down.
      if (event.defaultPrevented) return setDragging(false);
      // Without this the browser would open the dropped file.
      event.preventDefault();
      if (depth > 0) setDragging(true);
    };
    const leave = (event: DragEvent) => {
      if (!dragHasFiles(event)) return;
      depth -= 1;
      if (depth <= 0) end();
    };
    const drop = (event: DragEvent) => {
      if (!dragHasFiles(event)) return;
      end();
      // Already handled by a drop target on the page.
      if (event.defaultPrevented) return;
      event.preventDefault();
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
          // Bottom of the page, never the top: the header's sort and filter controls, the phone's
          // search row and the notification toasts all live there. Phones: the full width less a
          // 16px gutter, lifted clear of an open Ask panel's composer. Wider: centred in the list.
          // A batch scrolls inside this height, so newer toasts stay reachable.
          className="fixed inset-x-4 bottom-24 z-100 flex max-h-[calc(100dvh-14rem)] flex-col gap-2 overflow-y-auto sm:inset-x-auto sm:bottom-6 sm:left-1/2 sm:w-72 sm:-translate-x-1/2"
          onPointerEnter={() => holdUploadToasts(true)}
          onPointerLeave={() => holdUploadToasts(false)}
        >
          {toasts.map(({ id, name, state }) => (
            <div key={id} className="rounded-lg border border-border bg-card p-3 text-sm shadow-md">
              <div className="flex items-center justify-between gap-2">
                {/* A delete or rename leads with the outcome; the name follows. */}
                {state.kind === "deleted" || state.kind === "renamed" ? (
                  <span className="font-medium">
                    {state.kind === "deleted" ? <Trans>Deleted</Trans> : <Trans>Renamed</Trans>}
                  </span>
                ) : state.kind === "sorted" ? (
                  <span className="font-medium">
                    {plural(state.count, { one: "Sorted # item", other: "Sorted # items" })}
                  </span>
                ) : state.kind === "notice" ? (
                  <span className="min-w-0">{name}</span>
                ) : (
                  <span className="min-w-0 truncate" title={name}>
                    {name}
                  </span>
                )}
                {state.kind === "uploading" ? (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {Math.round(state.fraction * 100)}%
                  </span>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={t`Dismiss`}
                    onClick={() => dismissUploadToast(id)}
                  >
                    <X aria-hidden="true" />
                  </Button>
                )}
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
              ) : state.kind === "importing" ? (
                <>
                  <div
                    role="progressbar"
                    aria-label={name}
                    className="mt-2 h-1 overflow-hidden rounded-full bg-muted"
                  >
                    <div className="h-full w-full animate-pulse bg-primary" />
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    <Shimmer>{importingText(name, state.progress)}</Shimmer>
                  </p>
                </>
              ) : state.kind === "imported" ? (
                <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                  {state.count > 0 ? (
                    <span className="text-success">
                      {plural(state.count, { one: "Added # file", other: "Added # files" })}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{duplicateText({})}</span>
                  )}
                  <Link
                    to={DATA_ROOM_PATH}
                    className="font-medium underline-offset-2 hover:underline"
                    onClick={() => dismissUploadToast(id)}
                  >
                    <Trans>View</Trans>
                  </Link>
                </div>
              ) : state.kind === "uploaded" ? (
                <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                  {state.existing ? (
                    <span className="min-w-0 text-muted-foreground">
                      {duplicateText(state.existing)}
                    </span>
                  ) : (
                    <span className="text-success">
                      <Trans>Uploaded</Trans>
                    </span>
                  )}
                  <Link
                    to={dataRoomItemPath(state.itemId)}
                    className="font-medium underline-offset-2 hover:underline"
                    onClick={() => dismissUploadToast(id)}
                  >
                    <Trans>View</Trans>
                  </Link>
                </div>
              ) : state.kind === "deleted" || state.kind === "renamed" ? (
                <p className="mt-1 truncate text-xs text-muted-foreground" title={name}>
                  {name}
                </p>
              ) : state.kind === "sorted" ? (
                <Button variant="link" size="xs" className="mt-1 h-auto p-0" onClick={state.undo}>
                  <Trans>Undo</Trans>
                </Button>
              ) : state.kind === "notice" ? null : (
                <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                  <span className="text-destructive">{failureText(state.reason)}</span>
                  {state.toTop ? (
                    <Button variant="link" size="xs" className="h-auto p-0" onClick={state.toTop}>
                      <Trans>Upload to All items</Trans>
                    </Button>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
