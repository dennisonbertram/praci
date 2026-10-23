import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { DataRoomApiItem, DataRoomConsentStatus } from "@rakazo/contracts";
import { Badge, Button, DialogTitle } from "@rakazo/ui-web";
import { FileText, RotateCw, Trash2, Upload, X } from "lucide-react";
import type { KeyboardEvent, PointerEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { allowDocuments } from "../../lib/ai-consent";
import { canPreviewImage, DATA_ROOM_CHANGED } from "../../lib/data-room";
import { MASK } from "../../lib/finance-format";
import {
  getHideAmounts,
  maskCurrencyWhenHidden,
  useHideAmounts,
} from "../../lib/hide-amounts-preference";
import { rpc } from "../../lib/rpc";
import { canPreviewSpreadsheet } from "../../lib/spreadsheet";
import { DocumentsConsentCard } from "../AiDataSharing";
import { SheetPreview } from "../SheetPreview";
import { sourceLabel } from "./FilterBar";
import {
  canRetryItem,
  dateText,
  isSettled,
  isUnreadable,
  isUnsearchableType,
  SHARES_CHANGED,
  sizeText,
  typeLabel,
} from "./format";
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
import { uploadFilesToDataRoom } from "./upload-toasts";

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

/** How many investors have the file; null until known (or when it cannot be shared). */
function useShareCount(item: DataRoomApiItem) {
  const [shared, setShared] = useState<{ id: string; count: number | null } | null>(null);
  const canShare = item.status !== "failed";
  useEffect(() => {
    if (!canShare) return;
    let live = true;
    const load = () =>
      rpc.investors
        .shares({ itemId: item.id })
        .then((ids) => live && setShared({ id: item.id, count: ids.length }))
        .catch(() => live && setShared(null));
    void load();
    window.addEventListener(SHARES_CHANGED, load);
    return () => {
      live = false;
      window.removeEventListener(SHARES_CHANGED, load);
    };
  }, [item.id, canShare]);
  return canShare && shared?.id === item.id ? shared.count : null;
}

/** Uploads another file into the same folder, then deletes the unreadable one it replaces. */
export function replaceDataRoomFile(item: DataRoomApiItem, files: File[]) {
  uploadFilesToDataRoom(files, item.folderId ?? undefined, (id) => {
    // An identical re-upload resolves to this same item; deleting it would lose the file.
    if (id === item.id) return;
    void rpc.dataRoom
      .itemDelete({ id: item.id })
      .then(() => window.dispatchEvent(new Event(DATA_ROOM_CHANGED)))
      .catch(() => undefined);
  });
}

function ReplaceFile({ item }: { item: DataRoomApiItem }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        hidden
        onChange={(event) => {
          replaceDataRoomFile(item, Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
      <Button size="sm" variant="outline" onClick={() => input.current?.click()}>
        <Upload aria-hidden="true" />
        <Trans>Replace file</Trans>
      </Button>
    </>
  );
}

/** Why a finished file has no type: Praci cannot read that kind of file, or may not read documents yet. */
function UntaggedNote({ item, bannerAsks }: { item: DataRoomApiItem; bannerAsks: boolean }) {
  const [consent, setConsent] = useState<DataRoomConsentStatus | null>(null);
  const unsearchable = isUnsearchableType(item.mimeType);
  useEffect(() => {
    if (unsearchable) return;
    let live = true;
    rpc.dataRoom
      .consent()
      .then((next) => live && setConsent(next))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [unsearchable]);
  const note = "text-xs text-muted-foreground";
  if (unsearchable)
    return <p className={note}>{t`Won't be searchable. Praci can't read this kind of file.`}</p>;
  // The page banner already asks beside the side panel; a dialog covers it, so it asks itself.
  if (consent && !consent.allowed && consent.recipients.length > 0 && bannerAsks)
    return <p className={note}>{t`Not tagged yet. Allow Praci to read your documents above.`}</p>;
  if (consent && !consent.allowed && consent.recipients.length > 0)
    return (
      <DocumentsConsentCard
        id={`preview-consent-${item.id}`}
        consent={consent}
        declinedText={<Trans>Not tagged. Praci can't read your documents.</Trans>}
        onAllow={() =>
          allowDocuments(consent)
            .then(setConsent)
            .catch((cause) => {
              // The providers or Space changed since this was read: show the current ask.
              void rpc.dataRoom
                .consent()
                .then(setConsent)
                .catch(() => undefined);
              throw cause;
            })
        }
      />
    );
  // A file still being tagged may yet get a type; the ask still loading may change the reason.
  if ((item.status !== "indexing" && item.status !== "ready") || !consent) return null;
  if (!consent.allowed || consent.recipients.length === 0)
    return <p className={note}>{t`Not tagged. No model is set up to read documents.`}</p>;
  return (
    <p className={note}>
      <Trans>Praci read this file but couldn't tell what kind of document it is.</Trans>
    </p>
  );
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
  pageAsksConsent = false,
}: {
  /** Shown inside a Dialog, which brings its own close button and title. */
  inDialog?: boolean;
  /** The page banner is asking for permission to read documents right now. */
  pageAsksConsent?: boolean;
  item: DataRoomApiItem;
  folderPath: string;
  onAction: (action: ItemAction, item: DataRoomApiItem) => void;
  onClose: () => void;
  agents?: SendTarget[];
  onSendToAgent?: (item: DataRoomApiItem, agent: SendTarget) => void;
}) {
  const [error, setError] = useState("");
  const shareCount = useShareCount(item);
  const { facets } = item;
  // Only a picture can't be masked; text and PDF previews stay readable.
  const hidden = useHideAmounts() && canPreviewImage(item);
  const amount = amountText(item);
  const { width, handle } = usePaneWidth();
  const [fullScreen, setFullScreen] = useState(false);
  const sheet = item.status !== "failed" && canPreviewSpreadsheet(item.name, item.mimeType);
  const showFile = !sheet && !hidden;
  const file = useFileUrl(item, showFile);
  const canFullScreen =
    item.status !== "failed" && (sheet || (showFile && isShowable(item) && !file.failed));
  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: Escape closes the pane from any control inside it
    <aside
      aria-label={t`Preview`}
      data-testid="data-room-preview"
      onKeyDown={(event) => {
        // Not for keys from a menu or the full-screen dialog, which render in portals but bubble here.
        if (
          !inDialog &&
          event.key === "Escape" &&
          !event.defaultPrevented &&
          event.currentTarget.contains(event.target as Node)
        )
          onClose();
      }}
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
      <div className={inDialog ? "-mt-2 flex items-center gap-1 pe-8" : "flex items-center gap-1"}>
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
          file={file}
          hidden={hidden}
          onError={setError}
          onFullScreen={canFullScreen ? () => setFullScreen(true) : undefined}
        />
        <ItemMenu
          item={item}
          onAction={onAction}
          canRetry={canRetryItem(item)}
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
          <SheetPreview key={item.id} source={{ dataRoomItemId: item.id }} name={item.name} />
        </div>
      ) : hidden ? (
        <p className="text-sm text-muted-foreground">{t`Image hidden while amounts are hidden`}</p>
      ) : item.status === "failed" ? null : (
        <FileViewer item={item} file={file} height={inDialog ? "h-[36dvh]" : undefined} />
      )}
      {item.status === "failed" ? (
        <div className="flex flex-col items-start gap-1.5 text-sm">
          <p className="font-medium text-destructive">
            <Trans>Couldn't read this file</Trans>
          </p>
          {item.error ? <p className="text-muted-foreground">{item.error}</p> : null}
          {isUnreadable(item.error) ? (
            // A second read fails the same way, so the way forward is a different file.
            <ReplaceFile item={item} />
          ) : (
            <Button size="sm" onClick={() => onAction("retry", item)}>
              <RotateCw aria-hidden="true" />
              <Trans>Try again</Trans>
            </Button>
          )}
        </div>
      ) : !isSettled(item.status, !!item.previewText) ? (
        <p className="text-sm text-muted-foreground">
          <Trans>Reading this file. You can keep working while it finishes.</Trans>
        </p>
      ) : facets.summary ? (
        <p className="text-sm">{maskCurrencyWhenHidden(facets.summary)}</p>
      ) : null}
      {isSettled(item.status, !!item.previewText) && item.notIndexed ? (
        <p className="text-xs text-muted-foreground">{t`Too large to search inside`}</p>
      ) : isSettled(item.status, !!item.previewText) && item.error ? (
        <p className="text-xs text-muted-foreground">{t`Couldn't classify`}</p>
      ) : isSettled(item.status, !!item.previewText) && !facets.docType ? (
        <UntaggedNote item={item} bannerAsks={!inDialog && pageAsksConsent} />
      ) : null}
      <dl className="grid grid-cols-[72px_1fr] items-baseline gap-x-2 gap-y-1.5 text-sm">
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
              <Link
                to={item.sourceUrl}
                className="underline-offset-2 hover:underline pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
              >
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
              className="underline-offset-2 hover:underline pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
            >
              {t`From Google Drive`}
            </a>
          ) : (
            sourceLabel(item.source)
          )}
        </Field>
        <Field label={t`Size`}>{sizeText(item.size)}</Field>
        {shareCount ? (
          <Field label={t`Shared`}>
            {shareCount === 1 ? t`With 1 investor` : t`With ${shareCount} investors`}
          </Field>
        ) : null}
      </dl>
      {/* Delete for a file that can't be read; Try again is under the heading, Open and Download in the header. */}
      <div className="flex flex-col gap-1.5">
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
