import { t } from "@lingui/core/macro";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
} from "@rakazo/ui-web";
import { useEffect, useState } from "react";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";

type Holder = {
  id: string;
  name: string;
  contactEmail: string | null;
  jobTitle?: string | null;
  employeeId?: string | null;
  createdAt?: string;
};

/** What tells two records with the same name apart: email, role, employee ID, when added. */
const details = (row: Holder) =>
  [
    row.contactEmail,
    row.jobTitle,
    row.employeeId,
    row.createdAt && t`added ${row.createdAt.slice(0, 10)}`,
  ]
    .filter(Boolean)
    .join(" · ");

/** Merge two stakeholders: pick the record to keep; the other's securities move to it. */
export function MergeDialog({
  open,
  onOpenChange,
  stakeholders,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stakeholders: Holder[];
  onDone: (keptId: string) => void;
}) {
  const [intoId, setIntoId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (open) {
      setIntoId(stakeholders[0]?.id ?? "");
      setError("");
    }
  }, [open, stakeholders]);
  const kept = stakeholders.find((row) => row.id === intoId);
  const other = stakeholders.find((row) => row.id !== intoId);

  const merge = async () => {
    if (!kept || !other) return;
    setSaving(true);
    try {
      await rpc.equity.stakeholderActions.merge({ intoId: kept.id, fromId: other.id });
      onOpenChange(false);
      onDone(kept.id);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t`Merge stakeholders`}</DialogTitle>
        </DialogHeader>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm text-muted-foreground">{t`Keep`}</legend>
          {stakeholders.map((row) => (
            <Label key={row.id} className="flex items-start gap-2 font-normal">
              <input
                type="radio"
                name="merge-into"
                checked={intoId === row.id}
                onChange={() => setIntoId(row.id)}
              />
              <span className="flex flex-col">
                <span className="font-medium">{row.name}</span>
                <span className="text-muted-foreground">{details(row)}</span>
              </span>
            </Label>
          ))}
        </fieldset>
        {kept && other && (
          <p className="text-sm">{t`${other.name}'s securities move to ${kept.name}.`}</p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button disabled={saving || !kept || !other} onClick={merge}>{t`Merge`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
