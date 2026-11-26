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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableHeadRow,
  TableRow,
  Textarea,
} from "@rakazo/ui-web";
import { useState } from "react";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";
import { formatPrice } from "./format";

const isPrice = (value: string) => /^\d+(\.\d{1,10})?$/.test(value) && Number(value) > 0;

/** "Reprice selected": sets a new exercise price on each selected grant, after one review. */
export function OptionRepriceDialog({
  grants,
  onClose,
  onDone,
}: {
  grants: EquityOptionGrant[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [exercisePrice, setExercisePrice] = useState("");
  const [note, setNote] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failures, setFailures] = useState<string[]>([]);

  async function commit() {
    setBusy(true);
    const failed: string[] = [];
    for (const grant of grants) {
      try {
        await rpc.equity.optionGrants.update({
          id: grant.id,
          exercisePrice,
          reason: "amendment",
          ...(note ? { note } : {}),
        });
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
          <DialogTitle>{t`Reprice selected`}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {reviewing ? (
            <Table compact>
              <TableHeader>
                <TableHeadRow>
                  <TableHead>{t`Security`}</TableHead>
                  <TableHead>{t`Holder`}</TableHead>
                  <TableHead className="text-end">{t`Current price → New price`}</TableHead>
                </TableHeadRow>
              </TableHeader>
              <TableBody aria-label={t`Option grants to reprice`}>
                {grants.map((grant) => (
                  <TableRow key={grant.id} data-grant-id={grant.id}>
                    <TableCell className="font-medium">{grant.label}</TableCell>
                    <TableCell className="truncate">{grant.stakeholderName}</TableCell>
                    <TableCell className="text-end tabular-nums">
                      {formatPrice(grant.exercisePrice)} → {formatPrice(exercisePrice)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col gap-4">
              <Field>
                <FieldLabel htmlFor="reprice-price">{t`New exercise price`}</FieldLabel>
                <Input
                  id="reprice-price"
                  inputMode="decimal"
                  value={exercisePrice}
                  onChange={(event) => setExercisePrice(event.target.value.trim())}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="reprice-note">{t`Note`}</FieldLabel>
                <Textarea
                  id="reprice-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </Field>
            </div>
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
              <Button onClick={() => void commit()} disabled={busy}>
                {t`Confirm`}
              </Button>
            )
          ) : (
            <Button onClick={() => setReviewing(true)} disabled={!isPrice(exercisePrice)}>
              {t`Review`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
