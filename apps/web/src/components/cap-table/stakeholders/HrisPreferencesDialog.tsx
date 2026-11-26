import { t } from "@lingui/core/macro";
import type { EquityHrisPreferences } from "@rakazo/contracts";
import { EQUITY_HRIS_AUTO_FIELDS } from "@rakazo/contracts";
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Switch,
} from "@rakazo/ui-web";
import { useEffect, useState } from "react";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";

type AutoField = (typeof EQUITY_HRIS_AUTO_FIELDS)[number];

const FIELD_LABELS = (): Record<AutoField, string> => ({
  address: t`Address`,
  cost_center: t`Cost center`,
  department: t`Department`,
  hire_date: t`Hire date`,
  job_title: t`Job title`,
  tax_id: t`Tax ID`,
});

/** Which imported values may update stakeholders without review. */
export function HrisPreferencesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [value, setValue] = useState<EquityHrisPreferences | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    setError("");
    rpc.equity.hrisPreferences
      .get()
      .then(setValue)
      .catch((cause: unknown) => setError(errorText(cause)));
  }, [open]);

  const save = async () => {
    if (!value) return;
    setSaving(true);
    try {
      setValue(await rpc.equity.hrisPreferences.set(value));
      onOpenChange(false);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setSaving(false);
    }
  };
  const labels = FIELD_LABELS();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t`Automation preferences`}</DialogTitle>
        </DialogHeader>
        {value && (
          <div className="flex flex-col gap-4 text-sm">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="auto-updates">{t`Auto updates`}</Label>
              <Switch
                id="auto-updates"
                checked={value.autoUpdates}
                onCheckedChange={(autoUpdates) => setValue({ ...value, autoUpdates })}
              />
            </div>
            {value.autoUpdates && (
              <fieldset className="grid grid-cols-2 gap-2">
                {EQUITY_HRIS_AUTO_FIELDS.map((field) => (
                  <Label key={field} className="flex items-center gap-2 font-normal">
                    <Checkbox
                      checked={value.autoFields.includes(field)}
                      onCheckedChange={(checked) =>
                        setValue({
                          ...value,
                          autoFields: checked
                            ? [...value.autoFields, field]
                            : value.autoFields.filter((f) => f !== field),
                        })
                      }
                    />
                    {labels[field]}
                  </Label>
                ))}
              </fieldset>
            )}
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="auto-create">{t`Auto creation of new employees`}</Label>
              <Switch
                id="auto-create"
                checked={value.autoCreate}
                onCheckedChange={(autoCreate) => setValue({ ...value, autoCreate })}
              />
            </div>
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button disabled={!value || saving} onClick={save}>{t`Save`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
