import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import type { EquityOptionGrant } from "@rakazo/contracts";
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
} from "@rakazo/ui-web";
import { useRef, useState } from "react";
import { toDatetimeLocalValue } from "../../../lib/datetime-local";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";
import { formatDay } from "./format";
import type { OptionGrantAction } from "./OptionGrantsTable";

/** The row menu actions this dialog commits. */
export type OptionGrantTransaction = Extract<
  OptionGrantAction,
  "exercise" | "partiallyCancel" | "cancel" | "reverseCancellation" | "cancelPendingExercises"
>;

export const OPTION_GRANT_TRANSACTIONS: readonly OptionGrantTransaction[] = [
  "exercise",
  "partiallyCancel",
  "cancel",
  "reverseCancellation",
  "cancelPendingExercises",
];

const today = () => toDatetimeLocalValue(new Date()).slice(0, 10);
const shares = (value: string) => new Intl.NumberFormat(i18n.locale || "en").format(BigInt(value));

const initialExerciseQuantity = (grant: EquityOptionGrant) => {
  const outstanding = BigInt(grant.outstandingQuantity);
  const available = grant.earlyExercise
    ? outstanding
    : BigInt(grant.vestedQuantity) - BigInt(grant.exercisedQuantity);
  return (available < outstanding ? available : outstanding) > 0n
    ? (available < outstanding ? available : outstanding).toString()
    : "0";
};

function titleOf(action: OptionGrantTransaction): string {
  switch (action) {
    case "exercise":
      return t`Exercise options`;
    case "partiallyCancel":
      return t`Partially cancel option grant`;
    case "cancel":
      return t`Cancel option grant`;
    case "reverseCancellation":
      return t`Reverse cancellation`;
    case "cancelPendingExercises":
      return t`Cancel pending exercises`;
  }
}

/**
 * One option grant transaction: enter the details, review them, then commit. The server checks
 * vesting, the pool and the grant's state; its refusal is shown on the review step.
 */
export function OptionGrantActionDialog({
  action,
  grant,
  onClose,
  onDone,
}: {
  action: OptionGrantTransaction;
  grant: EquityOptionGrant;
  onClose: () => void;
  onDone: (grant: EquityOptionGrant) => void | Promise<void>;
}) {
  const needsQuantity = action === "exercise" || action === "partiallyCancel";
  const needsDate = action === "exercise" || action === "partiallyCancel" || action === "cancel";
  const [quantity, setQuantity] = useState(
    action === "exercise" ? initialExerciseQuantity(grant) : grant.outstandingQuantity,
  );
  const [date, setDate] = useState(today());
  const [reviewing, setReviewing] = useState(!needsQuantity && !needsDate);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intent, setIntent] = useState<{
    requestKey: string;
    quantity: string;
    date: string;
  } | null>(null);
  const [mutationSucceeded, setMutationSucceeded] = useState(false);
  const mutationSucceededRef = useRef(false);
  const inFlight = useRef(false);
  const closed = useRef(false);

  const quantityValid = !needsQuantity || /^[1-9]\d*$/.test(quantity);
  const dateValid = !needsDate || /^\d{4}-\d{2}-\d{2}$/.test(date);

  const close = () => {
    if (closed.current) return;
    closed.current = true;
    onClose();
  };

  async function refreshGrant() {
    const updated = await rpc.equity.optionGrants.get({ id: grant.id });
    await onDone(updated);
    close();
  }

  async function commit() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      if (mutationSucceededRef.current) {
        await refreshGrant();
        return;
      }
      const actions = rpc.equity.optionActions;
      if (action === "exercise") {
        const submitted = intent ?? { requestKey: crypto.randomUUID(), quantity, date };
        if (!intent) setIntent(submitted);
        await actions.exercise({
          optionGrantId: grant.id,
          quantity: submitted.quantity,
          exerciseDate: submitted.date,
          requestKey: submitted.requestKey,
        });
      } else if (action === "partiallyCancel")
        await actions.cancel({ id: grant.id, quantity, canceledOn: date });
      else if (action === "cancel") await actions.cancel({ id: grant.id, canceledOn: date });
      else if (action === "reverseCancellation")
        await actions.reverseCancellation({ id: grant.id });
      else await actions.cancelPendingExercises({ id: grant.id });
      mutationSucceededRef.current = true;
      setMutationSucceeded(true);
      await refreshGrant();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function retryRefresh() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await refreshGrant();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const rows: [string, string][] = [
    [t`Security`, grant.label],
    [t`Optionholder`, grant.stakeholderName],
    ...(needsQuantity
      ? ([[t`Quantity`, quantityValid ? shares(quantity) : quantity]] as [string, string][])
      : []),
    ...(action === "cancel"
      ? ([[t`Quantity`, shares(grant.outstandingQuantity)]] as [string, string][])
      : []),
    ...(action === "reverseCancellation"
      ? ([[t`Quantity`, shares(grant.canceledQuantity)]] as [string, string][])
      : []),
    ...(needsDate ? ([[t`Date`, formatDay(date)]] as [string, string][]) : []),
  ];

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titleOf(action)}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {reviewing ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              {rows.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <div className="flex flex-col gap-4">
              {needsQuantity && (
                <Field data-invalid={!quantityValid || undefined}>
                  <FieldLabel htmlFor="option-action-quantity">{t`Quantity`}</FieldLabel>
                  <Input
                    id="option-action-quantity"
                    inputMode="numeric"
                    value={quantity}
                    disabled={busy || intent !== null || mutationSucceeded}
                    onChange={(event) => setQuantity(event.target.value.trim())}
                  />
                  {!quantityValid && <FieldError>{t`Enter a whole number of shares`}</FieldError>}
                </Field>
              )}
              {needsDate && (
                <Field>
                  <FieldLabel htmlFor="option-action-date">
                    {action === "exercise" ? t`Exercise date` : t`Cancellation date`}
                  </FieldLabel>
                  <Input
                    id="option-action-date"
                    type="date"
                    value={date}
                    disabled={busy || intent !== null || mutationSucceeded}
                    onChange={(event) => setDate(event.target.value)}
                  />
                </Field>
              )}
            </div>
          )}
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={busy}>
            {mutationSucceeded ? t`Close` : t`Cancel`}
          </Button>
          {mutationSucceeded ? (
            <Button onClick={() => void retryRefresh()} disabled={busy}>
              {t`Refresh`}
            </Button>
          ) : reviewing ? (
            <Button onClick={() => void commit()} disabled={busy}>
              {intent ? t`Retry` : t`Confirm`}
            </Button>
          ) : (
            <Button onClick={() => setReviewing(true)} disabled={!quantityValid || !dateValid}>
              {t`Review`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
