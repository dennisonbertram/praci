import { plural, t } from "@lingui/core/macro";
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
import { useCallback, useEffect, useId, useRef, useState } from "react";
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
  onOpenModels,
}: {
  onClose: () => void;
  onApplied: (result: AutoSortApplyOutput) => void;
  /** Opens the Models settings, where a rejected key is replaced. */
  onOpenModels?: () => void;
}) {
  const [plan, setPlan] = useState<AutoSortPlan | null>(null);
  const [error, setError] = useState("");
  const [off, setOff] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  // Only the latest request may fill the list: an older answer arriving later would swap the proposal on screen.
  const latest = useRef(0);

  const load = useCallback(() => {
    const request = ++latest.current;
    setPlan(null);
    setError("");
    setSlow(false);
    rpc.dataRoom.autoSort
      .plan()
      .then((next: AutoSortPlan) => {
        if (request !== latest.current) return;
        setPlan(next);
        // Files already in a folder are left alone unless ticked; loose ones are the point.
        setOff(
          new Set(
            next.operations
              .filter((op) => op.type === "move_item" && op.fromFolderId !== null)
              .map((op) => op.key),
          ),
        );
      })
      .catch((cause: unknown) => request === latest.current && setError(errorText(cause)));
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    if (plan || error) return;
    const timer = setTimeout(() => setSlow(true), 10_000);
    return () => clearTimeout(timer);
  }, [plan, error]);

  const groups: Group[] = [
    { type: "merge_folder", title: t`Merge` },
    { type: "move_item", title: t`Move` },
    { type: "rename_item", title: t`Rename` },
  ];
  const reasonText =
    plan?.reason === "ai_rejected"
      ? t`The model provider did not accept your API key.`
      : plan?.reason === "ai_failed"
        ? t`The model could not sort your files.`
        : plan?.reason
          ? t`Turn on a model and allow AI access to sort files.`
          : null;
  // A model problem is fixed in Models; "Retry" alone would fail the same way.
  const fixInModels = plan?.reason === "ai_rejected" || plan?.reason === "ai_unavailable";
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
            {/* Auto-sort always works on the whole Data room, never on ticked files. */}
            <Trans>Sort every file in the Data room</Trans>
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
            <div className="flex flex-col gap-2">
              <LoadingState
                label={slow ? t`Still looking. This can take a minute.` : t`Looking for changes`}
              />
            </div>
          ) : plan.operations.length === 0 && !reasonText ? (
            <p className="text-muted-foreground">
              <Trans>Already tidy.</Trans>
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {reasonText ? (
                <div className="flex flex-wrap items-center gap-3 px-2 text-muted-foreground">
                  {reasonText}
                  {fixInModels && onOpenModels ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onClose();
                        onOpenModels();
                      }}
                    >
                      <Trans>Open Models settings</Trans>
                    </Button>
                  ) : null}
                  <Button variant="outline" size="sm" onClick={load}>
                    <Trans>Retry</Trans>
                  </Button>
                </div>
              ) : null}
              {plan.operations.length > 1 ? (
                <Row
                  checked={chosen.length === plan.operations.length}
                  onChange={(on) =>
                    setOff(on ? new Set() : new Set(plan.operations.map((op) => op.key)))
                  }
                  title={t`Select all`}
                />
              ) : null}
              {groups.map(({ type, title }) => {
                const ops = plan.operations.filter((op) => op.type === type);
                // Moves read by where they go, not as one flat list.
                const destinations =
                  type === "move_item"
                    ? [...new Set(ops.flatMap((op) => (op.type === "move_item" ? [op.to] : [])))]
                    : [null];
                return ops.length ? (
                  <section key={type} aria-label={title} className="flex flex-col">
                    <h3 className="px-2 pb-1 text-xs font-medium text-muted-foreground">{title}</h3>
                    {destinations.map((to) => (
                      <div key={to ?? type} className="flex flex-col">
                        {to !== null ? (
                          <h4 className="px-2 pt-1 text-xs text-muted-foreground">{to}</h4>
                        ) : null}
                        {ops
                          .filter((op) => to === null || (op.type === "move_item" && op.to === to))
                          .map((op) => (
                            <Row
                              key={op.key}
                              checked={!off.has(op.key)}
                              onChange={(on) => toggle(op.key, on)}
                              {...describe(op)}
                            />
                          ))}
                      </div>
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
          {/* Nothing to apply (a failed or empty plan): the button would only read "Apply 0 changes". */}
          {plan && plan.operations.length === 0 ? null : error && !plan ? null : (
            <>
              {plan && chosen.length === 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  className="me-auto"
                  onClick={() => setOff(new Set())}
                >
                  <Trans>Select all</Trans>
                </Button>
              ) : null}
              <Button type="button" disabled={busy || !plan || chosen.length === 0} onClick={apply}>
                {chosen.length === 0
                  ? t`Apply`
                  : plural(chosen.length, { one: "Apply # change", other: "Apply # changes" })}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
