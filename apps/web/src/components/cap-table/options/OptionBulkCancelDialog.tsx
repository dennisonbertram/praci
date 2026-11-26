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
  FieldLabel,
  Input,
} from "@rakazo/ui-web";
import { useState } from "react";
import { todayIso as today } from "../../../lib/legal-format";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";
import { formatShares } from "./format";

/** "Cancel selected": cancels what is left of each selected grant, after one review. */
export function OptionBulkCancelDialog({
  grants,
  onClose,
  onDone,
}: {
  grants: EquityOptionGrant[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [date, setDate] = useState(today());
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failures, setFailures] = useState<string[]>([]);
  const total = grants.reduce((sum, grant) => sum + BigInt(grant.outstandingQuantity), 0n);

  async function commit() {
    setBusy(true);
    const failed: string[] = [];
    for (const grant of grants) {
      try {
        await rpc.equity.optionActions.cancel({ id: grant.id, canceledOn: date });
      } catch (caught) {
        failed.push(`${grant.label}: ${errorText(caught)}`);
      }
    }
    setBusy(false);
    if (failed.length === 0) onDone();
    else setFailures(failed);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && (failures.length ? onDone() : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t`Cancel selected`}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {reviewing ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-muted-foreground">{t`Grants`}</dt>
              <dd>{grants.map((grant) => grant.label).join(", ")}</dd>
              <dt className="text-muted-foreground">{t`Shares returned to the pool`}</dt>
              <dd className="tabular-nums">{formatShares(total.toString())}</dd>
              <dt className="text-muted-foreground">{t`Cancellation date`}</dt>
              <dd>{date}</dd>
            </dl>
          ) : (
            <Field>
              <FieldLabel htmlFor="bulk-cancel-date">{t`Cancellation date`}</FieldLabel>
              <Input
                id="bulk-cancel-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </Field>
          )}
          {failures.length > 0 && (
            <ul className="mt-3 text-sm text-destructive">
              {failures.map((failure) => (
                <li key={failure}>{failure}</li>
              ))}
            </ul>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={failures.length ? onDone : onClose} disabled={busy}>
            {failures.length ? t`Close` : t`Cancel`}
          </Button>
          {reviewing ? (
            failures.length === 0 && (
              <Button variant="destructive" onClick={() => void commit()} disabled={busy}>
                {t`Confirm`}
              </Button>
            )
          ) : (
            <Button onClick={() => setReviewing(true)} disabled={!/^\d{4}-\d{2}-\d{2}$/.test(date)}>
              {t`Review`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
