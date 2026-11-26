import { t } from "@lingui/core/macro";
import type { EquitySafeFunding } from "@rakazo/contracts";
import { Button, Input, Label, Popover, PopoverContent, PopoverTrigger } from "@rakazo/ui-web";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useHideAmounts } from "../../../lib/hide-amounts-preference";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";
import { dollarsToCents } from "../views/money";
import { formatCents } from "./format";

/** Board-approved SAFE funding against what SAFEs raised, with the approval and a modeling link. */
export function SafeFunding({ reloadKey = 0 }: { reloadKey?: number }) {
  const hidden = useHideAmounts();
  const [funding, setFunding] = useState<EquitySafeFunding | null>(null);
  const [amount, setAmount] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    rpc.equity.safeFunding
      .get()
      .then((loaded) => {
        if (live) setFunding(loaded);
      })
      .catch(() => {
        if (live) setFunding(null);
      });
    return () => {
      live = false;
    };
  }, [reloadKey]);

  const save = async () => {
    const approvedCents = dollarsToCents(amount);
    if (!approvedCents) return setError(t`Enter the amount in dollars`);
    setSaving(true);
    setError("");
    try {
      setFunding(await rpc.equity.safeFunding.set({ approvedCents }));
      setOpen(false);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setSaving(false);
    }
  };

  if (!funding) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      {funding.approvedCents ? (
        <span className="tabular-nums">
          {t`Board approved ${formatCents(funding.approvedCents, hidden)}`}
        </span>
      ) : null}
      <span className="tabular-nums">{t`Raised ${formatCents(funding.raisedCents, hidden)}`}</span>
      {funding.remainingCents ? (
        <span className="tabular-nums text-muted-foreground">
          {t`Remaining ${formatCents(funding.remainingCents, hidden)}`}
        </span>
      ) : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={<Button variant="outline" size="sm" />}>
          {funding.approvedCents ? t`Approve more funding` : t`Board approve funding`}
        </PopoverTrigger>
        <PopoverContent align="start" className="flex w-64 flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="safe-approved">{t`Approved SAFE funding ($)`}</Label>
            <Input
              id="safe-approved"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button size="sm" className="self-start" disabled={saving} onClick={() => void save()}>
            {t`Save`}
          </Button>
        </PopoverContent>
      </Popover>
      <Link to="/app/cap-table/rounds?view=model" className="underline-offset-4 hover:underline">
        {t`Model dilution`}
      </Link>
    </div>
  );
}
