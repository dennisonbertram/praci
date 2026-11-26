import { t } from "@lingui/core/macro";
import type { EquityStakeholderDetail } from "@rakazo/contracts";
import {
  EQUITY_DATED_PROPERTY_KINDS,
  EQUITY_RELATIONSHIP_LABELS,
  EQUITY_RELATIONSHIPS,
} from "@rakazo/contracts";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  NativeSelect,
  NativeSelectOption,
} from "@rakazo/ui-web";
import { Trash2Icon } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { todayIso as today } from "../../../lib/legal-format";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";
import type { DatedRow } from "./dated-properties";
import {
  DATED_PROPERTY_KIND_LABELS,
  toUpdateProperties,
  validateDatedRows,
} from "./dated-properties";

const newestFirst = (a: DatedRow, b: DatedRow) => b.effectiveDate.localeCompare(a.effectiveDate);

/** The editable rows for one stakeholder: every kind, each newest first. */
function initialRows(stakeholder: EquityStakeholderDetail): DatedRow[] {
  return EQUITY_DATED_PROPERTY_KINDS.flatMap((kind) =>
    stakeholder.properties
      .filter((property) => property.kind === kind)
      .map((property) => ({ kind, effectiveDate: property.effectiveDate, value: property.value }))
      .sort(newestFirst),
  );
}

export type DatedPropertiesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stakeholder: EquityStakeholderDetail;
  onSaved: (stakeholder: EquityStakeholderDetail) => void;
};

/** Edit a stakeholder's dated properties: relationship, job title, cost center and department. */
export function DatedPropertiesDialog({
  open,
  onOpenChange,
  stakeholder,
  onSaved,
}: DatedPropertiesDialogProps) {
  const [rows, setRows] = useState<DatedRow[]>(() => initialRows(stakeholder));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  useEffect(() => {
    if (open) {
      setRows(initialRows(stakeholder));
      setErrors([]);
    }
  }, [open, stakeholder]);

  const update = (index: number, patch: Partial<DatedRow>) =>
    setRows((current) => current.map((row, at) => (at === index ? { ...row, ...patch } : row)));
  const add = (kind: DatedRow["kind"]) =>
    setRows((current) => [...current, { kind, effectiveDate: today(), value: "" }]);
  const remove = (index: number) => setRows((current) => current.filter((_, at) => at !== index));

  const priorKinds = new Set(stakeholder.properties.map((property) => property.kind));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const problems = validateDatedRows(rows);
    for (const kind of EQUITY_DATED_PROPERTY_KINDS) {
      if (priorKinds.has(kind) && !rows.some((row) => row.kind === kind)) {
        problems.push(t`Keep at least one entry for ${DATED_PROPERTY_KIND_LABELS[kind]}`);
      }
    }
    if (problems.length > 0) return setErrors(problems);
    setSaving(true);
    setErrors([]);
    try {
      const saved = await rpc.equity.stakeholders.update({
        id: stakeholder.id,
        properties: toUpdateProperties(rows),
      });
      onSaved(saved);
    } catch (cause) {
      setErrors([errorText(cause)]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t`Edit properties`}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
          {EQUITY_DATED_PROPERTY_KINDS.map((kind) => {
            const label = DATED_PROPERTY_KIND_LABELS[kind];
            const kindRows = rows
              .map((row, index) => ({ row, index }))
              .filter(({ row }) => row.kind === kind);
            return (
              <fieldset key={kind} className="flex flex-col gap-2">
                <legend className="text-sm font-medium">{label}</legend>
                {kindRows.map(({ row, index }) => (
                  <div key={`${kind}-${index}`} className="flex items-end gap-2">
                    <div className="flex w-40 flex-col gap-1.5">
                      <Label htmlFor={`dated-${kind}-${index}-date`}>{t`Effective date`}</Label>
                      <Input
                        id={`dated-${kind}-${index}-date`}
                        type="date"
                        value={row.effectiveDate}
                        onChange={(event) => update(index, { effectiveDate: event.target.value })}
                      />
                    </div>
                    <div className="flex flex-1 flex-col gap-1.5">
                      <Label htmlFor={`dated-${kind}-${index}-value`}>{label}</Label>
                      {kind === "relationship" ? (
                        <NativeSelect
                          id={`dated-${kind}-${index}-value`}
                          value={row.value}
                          onChange={(event) => update(index, { value: event.target.value })}
                        >
                          <NativeSelectOption value="">{t`Select…`}</NativeSelectOption>
                          {EQUITY_RELATIONSHIPS.map((value) => (
                            <NativeSelectOption key={value} value={value}>
                              {EQUITY_RELATIONSHIP_LABELS[value]}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      ) : (
                        <Input
                          id={`dated-${kind}-${index}-value`}
                          value={row.value}
                          onChange={(event) => update(index, { value: event.target.value })}
                        />
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t`Remove`}
                      onClick={() => remove(index)}
                    >
                      <Trash2Icon size={14} aria-hidden="true" />
                    </Button>
                  </div>
                ))}
                <div>
                  <Button type="button" variant="outline" size="sm" onClick={() => add(kind)}>
                    {t`Add`}
                  </Button>
                </div>
              </fieldset>
            );
          })}
          {errors.map((error) => (
            <p key={error} className="text-sm text-destructive">
              {error}
            </p>
          ))}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t`Cancel`}
            </Button>
            <Button type="submit" disabled={saving}>
              {t`Save`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
