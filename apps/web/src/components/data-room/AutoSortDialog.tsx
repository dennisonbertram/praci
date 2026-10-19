import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { AutoSortApplyOutput, AutoSortOperation, AutoSortPlan } from "@rakazo/contracts";
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
} from "@rakazo/ui-web";
import { useCallback, useEffect, useId, useState } from "react";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";
import { LoadingState } from "../ai/primitives";

type Group = { type: AutoSortOperation["type"]; title: string };

function Row({
  checked,
  onChange,
  title,
  detail,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  detail?: string;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted">
      <Checkbox id={id} className="mt-0.5" checked={checked} onCheckedChange={onChange} />
      <Label htmlFor={id} className="block min-w-0 flex-1 cursor-pointer font-normal">
        <span className="block break-words">{title}</span>
        {detail ? (
          <span className="block break-words text-xs text-muted-foreground">{detail}</span>
        ) : null}
      </Label>
    </div>
  );
}

/**
 * Shows what Auto-sort would change, grouped as Merge, Move and Rename, each before and after,
 * with every change ticked. Nothing changes until Apply, and Apply sends only the ticked ones.
 */
export function AutoSortDialog({
  onClose,
  onApplied,
}: {
  onClose: () => void;
  onApplied: (result: AutoSortApplyOutput) => void;
}) {
  const [plan, setPlan] = useState<AutoSortPlan | null>(null);
  const [error, setError] = useState("");
  const [off, setOff] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setPlan(null);
    setError("");
    rpc.dataRoom.autoSort
      .plan()
      .then((next: AutoSortPlan) => {
        setPlan(next);
        setOff(new Set());
      })
      .catch((cause: unknown) => setError(errorText(cause)));
  }, []);
  useEffect(load, [load]);

  const groups: Group[] = [
    { type: "merge_folder", title: t`Merge` },
    { type: "move_item", title: t`Move` },
    { type: "rename_item", title: t`Rename` },
  ];
  const reasonText =
    plan?.reason === "ai_failed"
      ? t`The model could not sort your files.`
      : plan?.reason
        ? t`Turn on a model and allow AI access to sort files.`
        : null;
  const chosen = plan?.operations.filter((op) => !off.has(op.key)) ?? [];
  const toggle = (key: string, on: boolean) =>
    setOff((prev) => {
      const next = new Set(prev);
      if (on) next.delete(key);
      else next.add(key);
      return next;
    });
  const apply = () => {
    setBusy(true);
    setError("");
    rpc.dataRoom.autoSort
      .apply({ operations: chosen })
      .then((result: AutoSortApplyOutput) => {
        onApplied(result);
        onClose();
      })
      .catch((cause: unknown) => setError(errorText(cause)))
      .finally(() => setBusy(false));
  };

  const describe = (op: AutoSortOperation): { title: string; detail?: string } =>
    op.type === "merge_folder"
      ? { title: `${op.from} → ${op.into}` }
      : op.type === "move_item"
        ? { title: op.name, detail: `${op.from} → ${op.to}` }
        : { title: op.fromName, detail: `→ ${op.toName}` };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            <Trans>Auto-sort</Trans>
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[60dvh] min-h-16 overflow-y-auto">
          {error && !plan ? (
            <div className="flex items-center gap-3 text-destructive">
              {error}
              <Button variant="outline" size="sm" onClick={load}>
                <Trans>Retry</Trans>
              </Button>
            </div>
          ) : !plan ? (
            <LoadingState label={t`Auto-sort`} />
          ) : plan.operations.length === 0 && !reasonText ? (
            <p className="text-muted-foreground">
              <Trans>Already tidy.</Trans>
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {reasonText ? (
                <div className="flex flex-wrap items-center gap-3 px-2 text-muted-foreground">
                  {reasonText}
                  <Button variant="outline" size="sm" onClick={load}>
                    <Trans>Retry</Trans>
                  </Button>
                </div>
              ) : null}
              {groups.map(({ type, title }) => {
                const ops = plan.operations.filter((op) => op.type === type);
                return ops.length ? (
                  <section key={type} aria-label={title} className="flex flex-col">
                    <h3 className="px-2 pb-1 text-xs font-medium text-muted-foreground">{title}</h3>
                    {ops.map((op) => (
                      <Row
                        key={op.key}
                        checked={!off.has(op.key)}
                        onChange={(on) => toggle(op.key, on)}
                        {...describe(op)}
                      />
                    ))}
                  </section>
                ) : null;
              })}
            </div>
          )}
        </div>
        {error && plan ? <p className="text-[13px] text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            <Trans>Cancel</Trans>
          </Button>
          <Button type="button" disabled={busy || chosen.length === 0} onClick={apply}>
            <Trans>Apply</Trans>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
