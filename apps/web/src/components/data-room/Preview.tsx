import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { DataRoomApiItem } from "@rakazo/contracts";
import { Badge, Button, DialogTitle } from "@rakazo/ui-web";
import { Download, FileText, RotateCw, Trash2, X } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { canPreviewImage, dataRoomImageUrl, saveDataRoomItem } from "../../lib/data-room";
import { MASK } from "../../lib/finance-format";
import {
  getHideAmounts,
  maskCurrencyWhenHidden,
  useHideAmounts,
} from "../../lib/hide-amounts-preference";
import { errorText } from "../../lib/user-error";
import { sourceLabel } from "./FilterBar";
import { dateText, isSettled, sizeText, statusLabel, typeLabel } from "./format";
import { type ItemAction, ItemMenu } from "./ItemMenu";

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

const Tag = ({ children }: { children: ReactNode }) => (
  <Badge variant="outline" className="max-w-full truncate">
    {children}
  </Badge>
);

/** The picture itself, for an image item; nothing while it loads or when it cannot be read. */
function ImagePreview({ item }: { item: DataRoomApiItem }) {
  const [url, setUrl] = useState("");
  const { id, mimeType } = item;
  useEffect(() => {
    let live = true;
    let made = "";
    setUrl("");
    dataRoomImageUrl({ id, mimeType })
      .then((next) => {
        made = next;
        if (live) setUrl(next);
        else URL.revokeObjectURL(next);
      })
      .catch(() => undefined);
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [id, mimeType]);
  return url ? (
    <img src={url} alt={item.name} className="max-h-64 w-full rounded-md bg-muted object-contain" />
  ) : null;
}

/** The summary, facets and source of one item, with Download and the item menu. */
export function Preview({
  item,
  folderPath,
  onAction,
  onClose,
  inDialog = false,
}: {
  /** Shown inside a Dialog, which brings its own close button and title. */
  inDialog?: boolean;
  item: DataRoomApiItem;
  folderPath: string;
  onAction: (action: ItemAction, item: DataRoomApiItem) => void;
  onClose: () => void;
}) {
  const [error, setError] = useState("");
  const { facets } = item;
  const hidden = useHideAmounts();
  const amount = amountText(item);
  const download = () => {
    setError("");
    saveDataRoomItem(item).catch((cause) => setError(errorText(cause)));
  };
  return (
    <aside
      aria-label={t`Preview`}
      data-testid="data-room-preview"
      className={
        inDialog
          ? "flex flex-col gap-3 p-4"
          : "flex w-80 shrink-0 flex-col gap-3 overflow-y-auto border-s border-border bg-background p-3"
      }
    >
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
        <ItemMenu item={item} onAction={onAction} canRetry={item.status === "failed"} />
        {inDialog ? null : (
          <Button variant="ghost" size="icon-sm" aria-label={t`Close preview`} onClick={onClose}>
            <X aria-hidden="true" />
          </Button>
        )}
      </div>
      <h3 className="break-words text-[15px] font-semibold">{item.name}</h3>
      {canPreviewImage(item) ? (
        hidden ? (
          <p className="text-sm text-muted-foreground">{t`Image hidden while amounts are hidden`}</p>
        ) : (
          <ImagePreview key={item.id} item={item} />
        )
      ) : null}
      {item.status === "failed" ? (
        <div className="flex flex-col gap-1 text-sm">
          <p className="font-medium text-destructive">
            <Trans>Couldn't read this file</Trans>
          </p>
          {item.error ? <p className="text-muted-foreground">{item.error}</p> : null}
        </div>
      ) : !isSettled(item.status) ? (
        <p className="text-sm text-muted-foreground">{statusLabel(item.status)}</p>
      ) : facets.summary ? (
        <p className="text-sm">{maskCurrencyWhenHidden(facets.summary)}</p>
      ) : null}
      {isSettled(item.status) && item.error ? (
        <p className="text-xs text-muted-foreground">{t`Couldn't classify`}</p>
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
        <Field label={t`Source`}>{sourceLabel(item.source)}</Field>
        <Field label={t`Size`}>{sizeText(item.size)}</Field>
      </dl>
      {/* The same full-width actions for every item; a file that can't be read leads with Try again. */}
      <div className="flex flex-col gap-1.5">
        {item.status === "failed" ? (
          <Button onClick={() => onAction("retry", item)}>
            <RotateCw aria-hidden="true" />
            <Trans>Try again</Trans>
          </Button>
        ) : null}
        <Button variant="outline" onClick={download}>
          <Download aria-hidden="true" />
          <Trans>Download</Trans>
        </Button>
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
    </aside>
  );
}
