import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { DataRoomApiItem } from "@rakazo/contracts";
import { Badge, Button, DialogTitle } from "@rakazo/ui-web";
import { FileText, RotateCw, Trash2, X } from "lucide-react";
import type { KeyboardEvent, PointerEvent, ReactNode } from "react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { canPreviewImage, canPreviewPdf } from "../../lib/data-room";
import { MASK } from "../../lib/finance-format";
import {
  getHideAmounts,
  maskCurrencyWhenHidden,
  useHideAmounts,
} from "../../lib/hide-amounts-preference";
import { canPreviewSpreadsheet } from "../../lib/spreadsheet";
import { SheetPreview } from "../SheetPreview";
import { sourceLabel } from "./FilterBar";
import { dateText, isSettled, sizeText, typeLabel } from "./format";
import type { ItemAction } from "./ItemMenu";
import { ItemMenu } from "./ItemMenu";
import {
  FileViewer,
  FullScreenPreview,
  isShowable,
  PreviewActions,
  useFileUrl,
} from "./PreviewActions";
import type { SendTarget } from "./SendToAgent";

function amountText(item: DataRoomApiItem) {
  const { amountCents, currency } = item.facets;
  if (amountCents === null) return "";
  if (getHideAmounts()) return `$${MASK}`;
  const amount = amountCents / 100;
  try {
    return new Intl.NumberFormat(i18n.locale || undefined, {
      style: "currency",
      currency: currency ?? "USD",
    }).format(amount);
  } catch {
    return String(amount);
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 flex-wrap gap-1 break-words">{children}</dd>
    </>
  );
}

/** The text is truncated inside the chip (a chip's own centering would clip its start); hover shows it all. */
const Tag = ({ children }: { children: string }) => (
  <Badge variant="outline" className="max-w-full" title={children}>
    <span className="truncate">{children}</span>
  </Badge>
);

const WIDTH_KEY = "rakazo:data-room-preview-width";
const MIN_WIDTH = 320;
const DEFAULT_WIDTH = 360;
const KEY_STEP = 32;
const maxWidth = () => Math.max(MIN_WIDTH, Math.round(window.innerWidth * 0.6));
const clampWidth = (width: number) => Math.max(MIN_WIDTH, Math.min(maxWidth(), width));

function savedWidth() {
  try {
    const saved = Number(localStorage.getItem(WIDTH_KEY));
    if (saved > 0) return clampWidth(saved);
  } catch {
    // Storage blocked: the default applies.
  }
  return DEFAULT_WIDTH;
}

/** The pane's width, dragged or keyed from its left edge, and remembered on this device. */
function usePaneWidth() {
  const [width, setWidth] = useState(savedWidth);
  const [start, setStart] = useState<{ x: number; width: number } | null>(null);
  const change = (next: number) => {
    const value = clampWidth(next);
    setWidth(value);
    try {
      localStorage.setItem(WIDTH_KEY, String(value));
    } catch {
      // Storage blocked: the width lasts until the page closes.
    }
  };
  const rtl = document.documentElement.dir === "rtl" ? -1 : 1;
  const handle = {
    tabIndex: 0,
    "aria-label": t`Resize panel`,
    "aria-orientation": "vertical" as const,
    "aria-valuemin": MIN_WIDTH,
    "aria-valuemax": maxWidth(),
    "aria-valuenow": width,
    onPointerDown: (event: PointerEvent<HTMLHRElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      setStart({ x: event.clientX, width });
    },
    onPointerMove: (event: PointerEvent<HTMLHRElement>) => {
      if (start) change(start.width + (start.x - event.clientX) * rtl);
    },
    onPointerUp: () => setStart(null),
    onPointerCancel: () => setStart(null),
    onKeyDown: (event: KeyboardEvent<HTMLHRElement>) => {
      const keys: Record<string, number> = {
        ArrowLeft: width + KEY_STEP * rtl,
        ArrowRight: width - KEY_STEP * rtl,
        Home: MIN_WIDTH,
        End: maxWidth(),
      };
      const next = keys[event.key];
      if (next === undefined) return;
      event.preventDefault();
      change(next);
    },
  };
  return { width, handle };
}

/** The summary, facets and source of one item, with Download and the item menu. */
export function Preview({
  item,
  folderPath,
  onAction,
  onClose,
  agents,
  onSendToAgent,
  inDialog = false,
}: {
  /** Shown inside a Dialog, which brings its own close button and title. */
  inDialog?: boolean;
  item: DataRoomApiItem;
  folderPath: string;
  onAction: (action: ItemAction, item: DataRoomApiItem) => void;
  onClose: () => void;
  agents?: SendTarget[];
  onSendToAgent?: (item: DataRoomApiItem, agent: SendTarget) => void;
}) {
  const [error, setError] = useState("");
  const { facets } = item;
  const hidden = useHideAmounts();
  const amount = amountText(item);
  const { width, handle } = usePaneWidth();
  const [fullScreen, setFullScreen] = useState(false);
  const sheet = item.status !== "failed" && canPreviewSpreadsheet(item.name, item.mimeType);
  const showFile = !sheet && !(hidden && (canPreviewImage(item) || canPreviewPdf(item)));
  const file = useFileUrl(item, showFile);
  const canFullScreen =
    item.status !== "failed" && (sheet || (showFile && isShowable(item) && !file.failed));
  return (
    <aside
      aria-label={t`Preview`}
      data-testid="data-room-preview"
      className={
        inDialog
          ? "flex flex-col gap-3 p-4"
          : "relative flex shrink-0 flex-col gap-3 overflow-y-auto border-s border-border bg-background p-3"
      }
      style={inDialog ? undefined : { width }}
    >
      {inDialog ? null : (
        <hr
          {...handle}
          className="absolute inset-y-0 start-0 z-10 m-0 h-full w-2 touch-none cursor-col-resize border-0 bg-transparent hover:bg-border focus-visible:bg-border focus-visible:outline-none"
        />
      )}
      {/* In a dialog, leave room for its close button. */}
      <div className={inDialog ? "flex items-center gap-1 pe-8" : "flex items-center gap-1"}>
        <FileText aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        {inDialog ? (
          <DialogTitle className="min-w-0 flex-1 truncate text-sm font-medium">
            <Trans>Preview</Trans>
          </DialogTitle>
        ) : (
          <h2 className="min-w-0 flex-1 truncate text-sm font-medium">
            <Trans>Preview</Trans>
          </h2>
        )}
        <PreviewActions
          item={item}
          hidden={hidden}
          onError={setError}
          onFullScreen={canFullScreen ? () => setFullScreen(true) : undefined}
        />
        <ItemMenu
          item={item}
          onAction={onAction}
          canRetry={item.status === "failed"}
          agents={agents}
          onSendToAgent={onSendToAgent}
        />
        {inDialog ? null : (
          <Button variant="ghost" size="icon-sm" aria-label={t`Close preview`} onClick={onClose}>
            <X aria-hidden="true" />
          </Button>
        )}
      </div>
      <h3 className="break-words text-[15px] font-semibold">{item.name}</h3>
      {sheet ? (
        <div className="h-[50vh] shrink-0 overflow-hidden rounded-md border border-border">
          <SheetPreview key={item.id} source={{ dataRoomItemId: item.id }} />
        </div>
      ) : hidden && (canPreviewImage(item) || canPreviewPdf(item)) ? (
        <p className="text-sm text-muted-foreground">
          {canPreviewImage(item)
            ? t`Image hidden while amounts are hidden`
            : t`Hidden while amounts are hidden`}
        </p>
      ) : (
        <FileViewer item={item} file={file} />
      )}
      {item.status === "failed" ? (
        <div className="flex flex-col gap-1 text-sm">
          <p className="font-medium text-destructive">
            <Trans>Couldn't read this file</Trans>
          </p>
          {item.error ? <p className="text-muted-foreground">{item.error}</p> : null}
        </div>
      ) : !isSettled(item.status) ? (
        <p className="text-sm text-muted-foreground">
          <Trans>Reading this file. You can keep working while it finishes.</Trans>
        </p>
      ) : facets.summary ? (
        <p className="text-sm">{maskCurrencyWhenHidden(facets.summary)}</p>
      ) : null}
      {isSettled(item.status) && item.error ? (
        <p className="text-xs text-muted-foreground">{t`Couldn't classify`}</p>
      ) : isSettled(item.status) && !facets.docType ? (
        <p className="text-xs text-muted-foreground">
          <Trans>
            Not tagged yet. Files are tagged once you let Praci read documents; you can still search
            it by name and text.
          </Trans>
        </p>
      ) : null}
      <dl className="grid grid-cols-[72px_1fr] gap-x-2 gap-y-1.5 text-sm">
        {facets.docType ? <Field label={t`Type`}>{typeLabel(facets.docType)}</Field> : null}
        {facets.docDate ? <Field label={t`Date`}>{dateText(facets.docDate)}</Field> : null}
        {facets.parties.length > 0 ? (
          <Field label={t`Parties`}>
            {facets.parties.map((party) => (
              <Tag key={party}>{party}</Tag>
            ))}
          </Field>
        ) : null}
        {amount ? <Field label={t`Amount`}>{amount}</Field> : null}
        {facets.tags.length > 0 ? (
          <Field label={t`Tags`}>
            {facets.tags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </Field>
        ) : null}
        <Field label={t`Folder`}>{folderPath || t`None`}</Field>
        <Field label={t`Source`}>
          {item.source === "gmail" ? (
            item.sourceUrl?.startsWith("/app/") ? (
              <Link to={item.sourceUrl} className="underline-offset-2 hover:underline">
                {t`From email`}
              </Link>
            ) : (
              t`From email`
            )
          ) : item.source === "drive" && item.sourceUrl?.startsWith("https://") ? (
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-2 hover:underline"
            >
              {t`From Google Drive`}
            </a>
          ) : (
            sourceLabel(item.source)
          )}
        </Field>
        <Field label={t`Size`}>{sizeText(item.size)}</Field>
      </dl>
      {/* Try again and Delete for a file that can't be read; Open and Download are in the header. */}
      <div className="flex flex-col gap-1.5">
        {item.status === "failed" ? (
          <Button onClick={() => onAction("retry", item)}>
            <RotateCw aria-hidden="true" />
            <Trans>Try again</Trans>
          </Button>
        ) : null}
        {item.status === "failed" ? (
          <Button
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => onAction("delete", item)}
          >
            <Trash2 aria-hidden="true" />
            <Trans>Delete</Trans>
          </Button>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
      {fullScreen ? (
        <FullScreenPreview
          item={item}
          file={file}
          hidden={hidden}
          onClose={() => setFullScreen(false)}
        />
      ) : null}
    </aside>
  );
}
