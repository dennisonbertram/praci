import { t } from "@lingui/core/macro";
import type { EquityCapTableByStakeholder, EquityEstimatedValueSettings } from "@rakazo/contracts";
import { parseFixed, sharesTimesPrice } from "@rakazo/core/equity";
import {
  Button,
  enqueueNotificationToast,
  Field,
  FieldLabel,
  Input,
  Label,
  NativeSelect,
  NativeSelectOption,
  Skeleton,
  Switch,
} from "@rakazo/ui-web";
import { useEffect, useState } from "react";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";
import { formatDollars, formatShares } from "./format";

/** Whether holders see an estimated value, and the price per share used to value holdings. */
export function EstimatedValueSettings() {
  const [settings, setSettings] = useState<EquityEstimatedValueSettings | null>(null);
  const [visible, setVisible] = useState(false);
  const [price, setPrice] = useState("");
  const [date, setDate] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [holders, setHolders] = useState<EquityCapTableByStakeholder["rows"]>([]);
  const [previewId, setPreviewId] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    rpc.equity.views.estimatedValue
      .get()
      .then((loaded: EquityEstimatedValueSettings) => {
        if (!live) return;
        setSettings(loaded);
        setVisible(loaded.visibility === "holders");
        setPrice(loaded.pricePerShare ?? "");
        setDate(loaded.effectiveDate ?? "");
      })
      .catch((cause: unknown) => {
        if (live) setError(errorText(cause));
      });
    rpc.equity.views
      .capTableByStakeholder({})
      .then((table: EquityCapTableByStakeholder) => {
        if (live) setHolders(table.rows);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [attempt]);

  if (settings == null && !error) return <Skeleton className="h-24 w-full" />;
  // Without the loaded settings a Save would overwrite the saved valuation with empty values.
  if (settings == null)
    return (
      <div className="flex items-center gap-3">
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setError("");
            setAttempt((n) => n + 1);
          }}
        >
          {t`Retry`}
        </Button>
      </div>
    );

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const saved = await rpc.equity.views.estimatedValue.set({
        visibility: visible ? "holders" : "hidden",
        pricePerShare: price.trim() || null,
        effectiveDate: date || null,
      });
      setSettings(saved);
      enqueueNotificationToast({ id: "estimated-value-saved", title: t`Saved` });
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Label className="gap-2 font-normal">
        <Switch checked={visible} onCheckedChange={setVisible} />
        {t`Visible to holders`}
      </Label>
      <div className="grid max-w-md grid-cols-2 gap-3">
        <Field>
          <FieldLabel htmlFor="estimated-value-price">{t`Price per share`}</FieldLabel>
          <Input
            id="estimated-value-price"
            inputMode="decimal"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="estimated-value-date">{t`Effective date`}</FieldLabel>
          <Input
            id="estimated-value-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </Field>
      </div>
      <div>
        <Button type="submit" size="sm" disabled={saving}>
          {t`Save`}
        </Button>
      </div>
      {settings?.pricePerShare && holders.length > 0 ? (
        <HolderPreview
          holders={holders}
          previewId={previewId}
          onPreview={setPreviewId}
          pricePerShare={settings.pricePerShare}
          visible={settings.visibility === "holders"}
        />
      ) : null}
    </form>
  );
}

/** What one holder would see: each security at the saved price per share. */
function HolderPreview({
  holders,
  previewId,
  onPreview,
  pricePerShare,
  visible,
}: {
  holders: EquityCapTableByStakeholder["rows"];
  previewId: string;
  onPreview: (id: string) => void;
  pricePerShare: string;
  visible: boolean;
}) {
  const holder = holders.find((row) => row.stakeholderId === previewId);
  const price = parseFixed(pricePerShare);
  const valued = (holder?.securities ?? []).filter((row) => row.kind !== "convertible");
  const total = valued.reduce(
    (sum, row) => sum + sharesTimesPrice(BigInt(row.quantity), price),
    0n,
  );
  return (
    <div className="flex max-w-md flex-col gap-2 border-t pt-3">
      <NativeSelect
        aria-label={t`Preview holder experience`}
        value={previewId}
        onChange={(event) => onPreview(event.target.value)}
      >
        <NativeSelectOption value="">{t`Preview holder experience`}</NativeSelectOption>
        {holders.map((row) => (
          <NativeSelectOption key={row.stakeholderId} value={row.stakeholderId}>
            {row.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {holder ? (
        visible ? (
          <dl className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1 text-sm">
            {valued.map((row) => (
              <div key={row.id} className="contents">
                <dt>{row.label ?? row.classOrPlanName}</dt>
                <dd className="text-end tabular-nums text-muted-foreground">
                  {formatShares(row.quantity)}
                </dd>
                <dd className="text-end tabular-nums">
                  {formatDollars(sharesTimesPrice(BigInt(row.quantity), price).toString())}
                </dd>
              </div>
            ))}
            <dt className="font-medium">{t`Estimated value`}</dt>
            <dd />
            <dd className="text-end font-medium tabular-nums">{formatDollars(total.toString())}</dd>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">{t`Not visible to ${holder.name}`}</p>
        )
      ) : null}
    </div>
  );
}
