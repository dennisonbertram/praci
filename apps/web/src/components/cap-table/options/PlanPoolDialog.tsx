import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import type { EquityPlanPool } from "@rakazo/contracts";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldError,
  FieldLabel,
  Input,
  NativeSelect,
  NativeSelectOption,
} from "@rakazo/ui-web";
import { useState } from "react";
import { todayIso as today } from "../../../lib/legal-format";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";

const figure = (value: string) => new Intl.NumberFormat(i18n.locale || "en").format(BigInt(value));

/**
 * "Increase pool" for one plan, or "Pour over" between two plans. Both show a review step; the
 * server refuses a pour over larger than the giving plan's available shares.
 */
export function PlanPoolDialog({
  mode,
  pools,
  planId,
  onClose,
  onDone,
}: {
  mode: "increase" | "pourOver";
  pools: EquityPlanPool[];
  /** The plan to increase, or the plan to pour from. */
  planId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [fromId, setFromId] = useState(planId);
  const [toId, setToId] = useState(pools.find((pool) => pool.planId !== planId)?.planId ?? "");
  const [shares, setShares] = useState("");
  const [date, setDate] = useState(today());
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = pools.find((pool) => pool.planId === fromId);
  const to = pools.find((pool) => pool.planId === toId);
  const sharesValid = /^[1-9]\d*$/.test(shares);
  const valid = sharesValid && (mode === "increase" || (to != null && toId !== fromId));

  async function commit() {
    setBusy(true);
    setError(null);
    try {
      if (mode === "increase")
        await rpc.equity.planPools.increase({ planId: fromId, shares, effectiveDate: date });
      else
        await rpc.equity.planPools.pourOver({
          fromPlanId: fromId,
          toPlanId: toId,
          shares,
          effectiveDate: date,
        });
      onDone();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  const review: [string, string][] =
    mode === "increase"
      ? [
          [t`Plan`, from?.name ?? ""],
          [
            t`Reserved`,
            from
              ? `${figure(from.reservedShares)} → ${figure((BigInt(from.reservedShares) + BigInt(shares || "0")).toString())}`
              : "",
          ],
          [t`Date`, date],
        ]
      : [
          [t`From`, from?.name ?? ""],
          [t`To`, to?.name ?? ""],
          [t`Shares`, sharesValid ? figure(shares) : shares],
          [t`Date`, date],
        ];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "increase" ? t`Increase pool` : t`Pour over`}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {reviewing ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              {review.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <div className="flex flex-col gap-4">
              {mode === "pourOver" && (
                <>
                  <Field>
                    <FieldLabel htmlFor="pool-from">{t`From`}</FieldLabel>
                    <NativeSelect
                      id="pool-from"
                      value={fromId}
                      onChange={(event) => setFromId(event.target.value)}
                    >
                      {pools.map((pool) => (
                        <NativeSelectOption key={pool.planId} value={pool.planId}>
                          {pool.name} ({figure(pool.availableShares)})
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="pool-to">{t`To`}</FieldLabel>
                    <NativeSelect
                      id="pool-to"
                      value={toId}
                      onChange={(event) => setToId(event.target.value)}
                    >
                      {pools
                        .filter((pool) => pool.planId !== fromId)
                        .map((pool) => (
                          <NativeSelectOption key={pool.planId} value={pool.planId}>
                            {pool.name}
                          </NativeSelectOption>
                        ))}
                    </NativeSelect>
                  </Field>
                </>
              )}
              <Field data-invalid={(shares !== "" && !sharesValid) || undefined}>
                <FieldLabel htmlFor="pool-shares">
                  {mode === "increase" ? t`Shares to add` : t`Shares`}
                </FieldLabel>
                <Input
                  id="pool-shares"
                  inputMode="numeric"
                  value={shares}
                  onChange={(event) => setShares(event.target.value.trim())}
                />
                {shares !== "" && !sharesValid && (
                  <FieldError>{t`Enter a whole number of shares`}</FieldError>
                )}
              </Field>
              <Field>
                <FieldLabel htmlFor="pool-date">{t`Effective date`}</FieldLabel>
                <Input
                  id="pool-date"
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </Field>
            </div>
          )}
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t`Cancel`}
          </Button>
          {reviewing ? (
            <Button onClick={() => void commit()} disabled={busy}>
              {t`Confirm`}
            </Button>
          ) : (
            <Button onClick={() => setReviewing(true)} disabled={!valid}>
              {t`Review`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
