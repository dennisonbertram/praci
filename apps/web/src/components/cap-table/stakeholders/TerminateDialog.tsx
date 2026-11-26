import { t } from "@lingui/core/macro";
import type { EquityTerminationResult } from "@rakazo/contracts";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@rakazo/ui-web";
import { useState } from "react";
import { todayIso as today } from "../../../lib/legal-format";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";
import { formatDay, formatShares } from "../options/format";

/** Terminate one or more stakeholders: one date, then a review line before it commits. */
export function TerminateDialog({
  open,
  onOpenChange,
  stakeholders,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stakeholders: { id: string; name: string }[];
  onDone: () => void;
}) {
  const [date, setDate] = useState(today);
  const [reviewing, setReviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // What the termination does to each holder's option grants, shown on the review step.
  const [grants, setGrants] = useState<EquityTerminationResult["grants"]>([]);
  const names = stakeholders.map((row) => row.name).join(", ");

  const close = (next: boolean) => {
    if (!next) {
      setReviewing(false);
      setError("");
    }
    onOpenChange(next);
  };

  const review = async () => {
    setSaving(true);
    setError("");
    try {
      const previews = await Promise.all(
        stakeholders.map((row) =>
          rpc.equity.optionActions.previewTermination({
            stakeholderId: row.id,
            terminatedOn: date,
          }),
        ),
      );
      setGrants(previews.flatMap((preview) => preview.grants));
      setReviewing(true);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      await rpc.equity.stakeholderActions.terminate({
        ids: stakeholders.map((row) => row.id),
        terminationDate: date,
      });
      close(false);
      onDone();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {stakeholders.length === 1
              ? t`Terminate stakeholder`
              : t`Terminate ${stakeholders.length} stakeholders`}
          </DialogTitle>
        </DialogHeader>
        {reviewing ? (
          <div className="flex flex-col gap-1 text-sm">
            <p>{t`${names} stop vesting on ${formatDay(date)}.`}</p>
            {grants.map((row) => (
              <p key={row.optionGrantId} className="text-muted-foreground">
                {t`${row.label}: ${formatShares(row.forfeitedQuantity)} forfeited, exercise by ${row.exerciseDeadline ? formatDay(row.exerciseDeadline) : "—"}`}
              </p>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">{names}</p>
            <Label htmlFor="termination-date">{t`Termination date`}</Label>
            <Input
              id="termination-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          {reviewing ? (
            <>
              <Button variant="outline" onClick={() => setReviewing(false)}>{t`Back`}</Button>
              <Button variant="destructive" disabled={saving} onClick={submit}>
                {t`Terminate`}
              </Button>
            </>
          ) : (
            <Button disabled={!date || saving} onClick={review}>
              {t`Review`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
