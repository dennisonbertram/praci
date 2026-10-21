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
import { useCallback, useEffect, useId, useState } from "react";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";
import { LoadingState, Shimmer } from "../ai/primitives";

/** The server plans for this many of the newest classified files. */
const FILE_LIST_CAP = 300;
const REVEAL_STEP_MS = 50;
/** Steps the last outcome stays on screen before the review replaces the list. */
const HOLD_STEPS = 4;
/** However many files there are, the reveal takes no longer than this. */
const REVEAL_MAX_MS = 1500;

export type AutoSortFile = { id: string; name: string };

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

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
  files = [],
  onClose,
  onApplied,
  onOpenModels,
}: {
  /** The files the page has loaded; the list shows them while the plan is made. */
  files?: AutoSortFile[];
  onClose: () => void;
  onApplied: (result: AutoSortApplyOutput) => void;
  /** Opens the Models settings, where a rejected key is replaced. */
  onOpenModels?: () => void;
}) {
  const [plan, setPlan] = useState<AutoSortPlan | null>(null);
  const [error, setError] = useState("");
  const [off, setOff] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const listed = files.slice(0, FILE_LIST_CAP);
  const more = files.length - listed.length;
  const [instant] = useState(prefersReducedMotion);
  const [revealed, setRevealed] = useState(0);
  const revealing =
    Boolean(plan) && !instant && listed.length > 0 && revealed < listed.length + HOLD_STEPS;
  // Once the plan is back, each file's outcome appears in turn, so the pass reads as going
  // through the files even when the plan was fast. Nothing here pretends to measure the model call.
  const planned = Boolean(plan);
  useEffect(() => {
    if (!planned) return setRevealed(0);
    if (!revealing) return;
    const step = Math.min(REVEAL_STEP_MS, REVEAL_MAX_MS / listed.length);
    const timer = setInterval(() => setRevealed((n) => n + 1), step);
    return () => clearInterval(timer);
  }, [planned, revealing, listed.length]);

  const load = useCallback(() => {
    setPlan(null);
    setError("");
    rpc.dataRoom.autoSort
      .plan()
      .then((next: AutoSortPlan) => {
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
      .catch((cause: unknown) => setError(errorText(cause)));
  }, []);
  useEffect(load, [load]);

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

  const outcome = (id: string): string => {
    const parts = (plan?.operations ?? []).flatMap((op) =>
      op.type === "move_item" && op.itemId === id
        ? [`${t`Move`} → ${op.to}`]
        : op.type === "rename_item" && op.itemId === id
          ? [`${t`Rename`} → ${op.toName}`]
          : [],
    );
    return parts.join(", ") || t`No change`;
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
          ) : !plan || revealing ? (
            <div className="flex flex-col gap-2">
              {!plan ? (
                <LoadingState
                  label={
                    files.length
                      ? plural(files.length, {
                          one: "Reviewing # file",
                          other: "Reviewing # files",
                        })
                      : t`Auto-sort`
                  }
                />
              ) : null}
              <ul className="flex flex-col gap-0.5 text-[13px]">
                {listed.map(({ id, name }, n) => (
                  <li key={id} className="flex items-baseline justify-between gap-3 px-2">
                    <span className="min-w-0 truncate" title={name}>
                      {plan && n < revealed ? name : <Shimmer>{name}</Shimmer>}
                    </span>
                    {plan && n < revealed ? (
                      <span className="max-w-[55%] shrink-0 truncate text-xs text-muted-foreground">
                        {outcome(id)}
                      </span>
                    ) : null}
                  </li>
                ))}
                {more > 0 ? (
                  <li className="px-2 text-xs text-muted-foreground">
                    <Trans>+{more} more</Trans>
                  </li>
                ) : null}
              </ul>
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
            <Button
              type="button"
              disabled={busy || revealing || chosen.length === 0}
              onClick={apply}
            >
              {plural(chosen.length, { one: "Apply # change", other: "Apply # changes" })}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
