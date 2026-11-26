import { t } from "@lingui/core/macro";
import type { EquityCustomProperty } from "@rakazo/contracts";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input } from "@rakazo/ui-web";
import { Check, Trash2 } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";

/** Define the company's own stakeholder properties. Values are set on each stakeholder. */
export function CustomPropertiesDialog({
  open,
  onOpenChange,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: (properties: EquityCustomProperty[]) => void;
}) {
  const [properties, setProperties] = useState<EquityCustomProperty[] | null>(null);
  const [name, setName] = useState("");
  // Delete asks twice: the first click arms the button, the second removes every value.
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState("");

  const reload = async () => {
    const list = await rpc.equity.customProperties.list();
    setProperties(list);
    return list;
  };
  useEffect(() => {
    if (!open) return;
    setError("");
    reload().catch((cause: unknown) => setError(errorText(cause)));
  }, [open]);

  const run = async (change: () => Promise<unknown>) => {
    setError("");
    try {
      await change();
      onChanged(await reload());
      return true;
    } catch (cause) {
      setError(errorText(cause));
      return false;
    }
  };
  const add = async (event: FormEvent) => {
    event.preventDefault();
    if (await run(() => rpc.equity.customProperties.create({ name: name.trim() }))) setName("");
  };
  const rename = (property: EquityCustomProperty, next: string) => {
    if (next.trim() && next.trim() !== property.name)
      void run(() => rpc.equity.customProperties.update({ id: property.id, name: next.trim() }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t`Custom properties`}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {properties?.length === 0 && (
            <p className="text-sm text-muted-foreground">{t`No custom properties`}</p>
          )}
          {properties?.map((property) => (
            <div key={`${property.id}-${property.name}`} className="flex gap-2">
              <Input
                aria-label={t`Rename ${property.name}`}
                defaultValue={property.name}
                onBlur={(event) => rename(property, event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label={t`Delete ${property.name}`}
                onClick={() => {
                  if (confirming !== property.id) return setConfirming(property.id);
                  setConfirming(null);
                  void run(() =>
                    rpc.equity.stakeholderActions.deleteCustomProperty({ id: property.id }),
                  );
                }}
              >
                {confirming === property.id ? (
                  <Check aria-hidden="true" />
                ) : (
                  <Trash2 aria-hidden="true" />
                )}
              </Button>
            </div>
          ))}
        </div>
        <form className="flex gap-2" onSubmit={add}>
          <Input
            aria-label={t`New property`}
            placeholder={t`New property`}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Button type="submit" disabled={!name.trim()}>{t`Add`}</Button>
        </form>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}
