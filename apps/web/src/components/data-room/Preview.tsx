import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { DataRoomApiItem } from "@rakazo/contracts";
import { Badge, Button, DialogTitle } from "@rakazo/ui-web";
import { Download, FileText, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { saveDataRoomItem } from "../../lib/data-room";
import { MASK } from "../../lib/finance-format";
import {
  getHideAmounts,
  maskCurrencyWhenHidden,
  useHideAmounts,
} from "../../lib/hide-amounts-preference";
import { errorText } from "../../lib/user-error";
import { sourceLabel } from "./FilterBar";
import { dateText, statusLabel } from "./format";
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

function sizeText(bytes: number) {
  const [unit, divisor] =
    bytes < 1_000
      ? (["byte", 1] as const)
      : bytes < 1_000_000
        ? (["kilobyte", 1_000] as const)
        : (["megabyte", 1_000_000] as const);
  return new Intl.NumberFormat(i18n.locale || undefined, {
    style: "unit",
    unit,
    unitDisplay: "narrow",
    maximumFractionDigits: 1,
  }).format(bytes / divisor);
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
  useHideAmounts();
  const amount = amountText(item);
  return (
    <aside
      aria-label={t`Preview`}
      data-testid="data-room-preview"
      className={
        inDialog
          ? "flex flex-col gap-3 p-4 pe-12"
          : "flex w-80 shrink-0 flex-col gap-3 overflow-y-auto border-s border-border bg-background p-3"
      }
    >
      <div className="flex items-center gap-1">
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
        <ItemMenu item={item} onAction={onAction} />
        {inDialog ? null : (
          <Button variant="ghost" size="icon-sm" aria-label={t`Close preview`} onClick={onClose}>
            <X aria-hidden="true" />
          </Button>
        )}
      </div>
      <h3 className="break-words text-[15px] font-semibold">{item.name}</h3>
      {item.status === "failed" ? (
        <p className="text-sm text-destructive">{item.error ?? t`Failed`}</p>
      ) : item.status !== "ready" ? (
        <p className="text-sm text-muted-foreground">{statusLabel(item.status)}</p>
      ) : facets.summary ? (
        <p className="text-sm">{maskCurrencyWhenHidden(facets.summary)}</p>
      ) : null}
      {item.status === "ready" && item.error ? (
        <p className="text-xs text-muted-foreground">{t`Couldn't classify`}</p>
      ) : null}
      <dl className="grid grid-cols-[72px_1fr] gap-x-2 gap-y-1.5 text-sm">
        {facets.docType ? <Field label={t`Type`}>{facets.docType}</Field> : null}
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
      <div className="flex flex-col gap-1.5">
        <Button
          variant="outline"
          onClick={() => {
            setError("");
            saveDataRoomItem(item).catch((cause) => setError(errorText(cause)));
          }}
        >
          <Download aria-hidden="true" />
          <Trans>Download</Trans>
        </Button>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </aside>
  );
}
