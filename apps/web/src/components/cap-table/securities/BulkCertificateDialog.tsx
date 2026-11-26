import { t } from "@lingui/core/macro";
import type { EquityCertificate, EquityShareClass } from "@rakazo/contracts";
import { EQUITY_CANCELLATION_REASONS, EQUITY_REASON_LABELS } from "@rakazo/contracts";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  NativeSelect,
  NativeSelectOption,
} from "@rakazo/ui-web";
import { useEffect, useState } from "react";
import { todayIso as today } from "../../../lib/legal-format";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";
import { formatShares } from "./format";

export type BulkCertificateAction = "cancel" | "convert";

/**
 * Cancels or converts several certificates at once, whole. Each certificate is its own
 * transaction; the result names any that failed so nothing is half-hidden.
 */
export function BulkCertificateDialog({
  action,
  certificates,
  onOpenChange,
  onDone,
}: {
  action: BulkCertificateAction;
  certificates: EquityCertificate[];
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [date, setDate] = useState(today());
  const [reason, setReason] = useState("");
  const [classId, setClassId] = useState("");
  const [ratio, setRatio] = useState("1");
  const [classes, setClasses] = useState<EquityShareClass[]>([]);
  const [review, setReview] = useState(false);
  const [failed, setFailed] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const total = certificates.reduce((sum, row) => sum + BigInt(row.quantity), 0n);

  useEffect(() => {
    if (action === "convert")
      rpc.equity.shareClasses
        .list({ pageSize: 500 })
        .then((page) => setClasses(page.items))
        .catch((cause: unknown) => setError(errorText(cause)));
  }, [action]);

  const commit = async () => {
    setBusy(true);
    const misses: string[] = [];
    for (const row of certificates) {
      try {
        if (action === "cancel")
          await rpc.equity.shareTransactions.cancel({
            certificateId: row.id,
            quantity: row.quantity,
            effectiveDate: date,
            reason: reason as (typeof EQUITY_CANCELLATION_REASONS)[number],
          });
        else
          await rpc.equity.shareTransactions.convert({
            certificateId: row.id,
            toShareClassId: classId,
            ratio,
            effectiveDate: date,
          });
      } catch (cause) {
        misses.push(`${row.label}: ${errorText(cause)}`);
      }
    }
    setBusy(false);
    if (misses.length === 0) onDone();
    else setFailed(misses);
  };

  const next = () => {
    if (action === "convert" && !classId) return setError(t`Choose a share class`);
    if (action === "convert" && !/^\d{1,14}(\.\d{1,10})?$/.test(ratio))
      return setError(t`Enter a ratio like 1 or 0.5`);
    if (action !== "convert" && !reason) return setError(t`Choose a reason`);
    setError("");
    setReview(true);
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {action === "cancel"
              ? t`Cancel ${certificates.length} certificates`
              : t`Convert ${certificates.length} certificates`}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          {failed.length ? (
            <ul role="alert" className="flex flex-col gap-1 text-sm text-destructive">
              {failed.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : review ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
              <dt className="text-muted-foreground">{t`Certificates`}</dt>
              <dd>{certificates.map((row) => row.label).join(", ")}</dd>
              <dt className="text-muted-foreground">{t`Shares`}</dt>
              <dd className="tabular-nums">{formatShares(total.toString())}</dd>
              {action === "convert" ? (
                <>
                  <dt className="text-muted-foreground">{t`To class`}</dt>
                  <dd>{classes.find((item) => item.id === classId)?.name}</dd>
                  <dt className="text-muted-foreground">{t`Ratio`}</dt>
                  <dd>{ratio}</dd>
                </>
              ) : (
                <>
                  <dt className="text-muted-foreground">{t`Reason`}</dt>
                  <dd>{EQUITY_REASON_LABELS[reason]}</dd>
                </>
              )}
              <dt className="text-muted-foreground">{t`Effective date`}</dt>
              <dd>{date}</dd>
            </dl>
          ) : (
            <>
              {action === "convert" ? (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="bulk-class">{t`To class`}</Label>
                    <NativeSelect
                      id="bulk-class"
                      value={classId}
                      onChange={(event) => setClassId(event.target.value)}
                    >
                      <NativeSelectOption value="">{t`Choose a share class`}</NativeSelectOption>
                      {classes.map((item) => (
                        <NativeSelectOption key={item.id} value={item.id}>
                          {item.name}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="bulk-ratio">{t`New shares per share`}</Label>
                    <Input
                      id="bulk-ratio"
                      inputMode="decimal"
                      value={ratio}
                      onChange={(event) => setRatio(event.target.value)}
                    />
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="bulk-reason">{t`Reason`}</Label>
                  <NativeSelect
                    id="bulk-reason"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  >
                    <NativeSelectOption value="">{t`Choose a reason`}</NativeSelectOption>
                    {EQUITY_CANCELLATION_REASONS.map((item) => (
                      <NativeSelectOption key={item} value={item}>
                        {EQUITY_REASON_LABELS[item]}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bulk-date">{t`Effective date`}</Label>
                <Input
                  id="bulk-date"
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </div>
            </>
          )}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter>
          {failed.length ? (
            <Button onClick={onDone}>{t`Done`}</Button>
          ) : review ? (
            <>
              <Button variant="outline" disabled={busy} onClick={() => setReview(false)}>
                {t`Back`}
              </Button>
              <Button
                variant={action === "cancel" ? "destructive" : "default"}
                disabled={busy}
                onClick={() => void commit()}
              >
                {t`Confirm`}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t`Close`}
              </Button>
              <Button onClick={next}>{t`Review`}</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
