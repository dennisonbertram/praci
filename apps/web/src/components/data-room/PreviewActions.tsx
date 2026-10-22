import { t } from "@lingui/core/macro";
import type { DataRoomApiItem } from "@rakazo/contracts";
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@rakazo/ui-web";
import { Download, ExternalLink, FileText, Maximize2 } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  canOpenInBrowser,
  canPreviewImage,
  canPreviewPdf,
  dataRoomFileUrl,
  openDataRoomItem,
  saveDataRoomItem,
} from "../../lib/data-room";
import { maskCurrencyWhenHidden, useHideAmounts } from "../../lib/hide-amounts-preference";
import { canPreviewSpreadsheet } from "../../lib/spreadsheet";
import { errorText } from "../../lib/user-error";
import { SheetPreview } from "../SheetPreview";

export type FileUrl = { url: string; failed: boolean };

/** True for an image or PDF, which is shown from an object URL of its bytes. */
export const isShowable = (item: DataRoomApiItem) => canPreviewImage(item) || canPreviewPdf(item);

/**
 * The object URL of an image or PDF item, read once through the authenticated content route. The
 * pane and the full-screen dialog share it, so opening the dialog does not fetch the file again.
 */
export function useFileUrl(item: DataRoomApiItem, enabled: boolean): FileUrl {
  const [state, setState] = useState<FileUrl>({ url: "", failed: false });
  const { id, mimeType } = item;
  const showable = enabled && isShowable(item);
  useEffect(() => {
    if (!showable) return;
    let live = true;
    let made = "";
    setState({ url: "", failed: false });
    dataRoomFileUrl({ id, mimeType })
      .then((next) => {
        made = next;
        if (live) setState({ url: next, failed: false });
        else URL.revokeObjectURL(next);
      })
      .catch(() => live && setState({ url: "", failed: true }));
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [id, mimeType, showable]);
  return state;
}

/**
 * The file itself: the picture, or the browser's PDF viewer (with its own page controls) in a frame.
 * A skeleton shows while it loads; the file icon stands in when the type cannot be shown or read.
 * `fill` makes it take the height of its container instead of a fixed size.
 */
export function FileViewer({
  item,
  file,
  fill = false,
  height = "h-[40vh]",
}: {
  item: DataRoomApiItem;
  file: FileUrl;
  fill?: boolean;
  /** A PDF's height where it does not fill (a phone's sheet gives it less, so the details stay in view). */
  height?: string;
}) {
  useHideAmounts();
  if (item.mimeType?.startsWith("text/plain") && item.previewText) {
    // The extracted text is the file for a plain text file, so show it instead of a placeholder icon.
    return (
      <pre
        className={`overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-xs ${fill ? "h-full" : "max-h-64"}`}
      >
        {maskCurrencyWhenHidden(item.previewText)}
      </pre>
    );
  }
  if (!isShowable(item) || file.failed) {
    return (
      <div
        className={`flex items-center justify-center rounded-md bg-muted ${fill ? "h-full" : "h-24"}`}
      >
        <FileText aria-hidden="true" className="size-8 text-muted-foreground" />
      </div>
    );
  }
  if (!file.url)
    return (
      <div
        data-testid="preview-skeleton"
        className={`animate-pulse rounded-md bg-muted ${fill ? "h-full" : "h-48"}`}
      />
    );
  return item.mimeType === "application/pdf" ? (
    <>
      <PdfPhoneFallback fill={fill} />
      <iframe
        // Hide the browser viewer's own Download and Print: the pane has Open and Download. Full
        // screen on a phone keeps the toolbar, whose zoom is the only way to read small print.
        src={
          fill && window.matchMedia?.("(max-width: 639px)").matches
            ? file.url
            : `${file.url}#toolbar=0`
        }
        title={item.name}
        className={`w-full shrink-0 rounded-md border border-border bg-muted max-sm:hidden ${fill ? "h-full" : height}`}
      />
    </>
  ) : (
    <img
      src={file.url}
      alt={item.name}
      className={`w-full rounded-md bg-muted object-contain ${fill ? "h-full" : "max-h-64"}`}
    />
  );
}

/**
 * Phone browsers draw a PDF in a frame as an empty box, so below sm the file icon stands in. Open and
 * Download stay in the header, once.
 */
function PdfPhoneFallback({ fill }: { fill: boolean }) {
  return (
    <div
      className={`flex items-center justify-center rounded-md bg-muted sm:hidden ${fill ? "h-full" : "h-24"}`}
    >
      <FileText aria-hidden="true" className="size-8 text-muted-foreground" />
    </div>
  );
}

function IconAction({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Open (the file in a new tab) and Download icons, with Full screen when `onFullScreen` is given.
 * Open uses the file itself, not a stored Drive or Box link: the link only works for people with
 * access to that account, and the Source row already links to it.
 */
export function PreviewActions({
  item,
  hidden,
  onError,
  onFullScreen,
}: {
  item: DataRoomApiItem;
  /** Amounts are hidden, so the file's contents must not be shown. */
  hidden: boolean;
  onError: (message: string) => void;
  onFullScreen?: () => void;
}) {
  const run = (action: (item: DataRoomApiItem) => Promise<void>) => {
    onError("");
    action(item).catch((cause) => onError(errorText(cause)));
  };
  const openable = item.status !== "failed" && canOpenInBrowser(item) && !hidden;
  return (
    <>
      <IconAction
        label={t`Open in new tab`}
        disabled={!openable}
        onClick={() => run(openDataRoomItem)}
      >
        <ExternalLink aria-hidden="true" />
      </IconAction>
      <IconAction label={t`Download`} onClick={() => run(saveDataRoomItem)}>
        <Download aria-hidden="true" />
      </IconAction>
      {onFullScreen ? (
        <IconAction label={t`Full screen`} onClick={onFullScreen}>
          <Maximize2 aria-hidden="true" />
        </IconAction>
      ) : null}
    </>
  );
}

/** The file in a near full-viewport dialog, reusing the pane's already loaded file URL. */
export function FullScreenPreview({
  item,
  file,
  hidden,
  onClose,
}: {
  item: DataRoomApiItem;
  file: FileUrl;
  hidden: boolean;
  onClose: () => void;
}) {
  const [error, setError] = useState("");
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-dvh max-h-none w-screen max-w-none flex-col gap-3 max-sm:rounded-none sm:h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:max-w-none">
        <div className="flex items-center gap-1 pe-9">
          <DialogTitle className="min-w-0 flex-1 truncate">{item.name}</DialogTitle>
          <PreviewActions item={item} hidden={hidden} onError={setError} />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="min-h-0 flex-1">
          {canPreviewSpreadsheet(item.name, item.mimeType) ? (
            <div className="h-full overflow-hidden rounded-md border border-border">
              <SheetPreview source={{ dataRoomItemId: item.id }} name={item.name} />
            </div>
          ) : (
            <FileViewer item={item} file={file} fill />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
