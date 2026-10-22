import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { FundraiseRound } from "@rakazo/contracts";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Label,
} from "@rakazo/ui-web";
import { cn } from "@rakazo/ui-web/lib/utils";
import { MoreHorizontal } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { centsFromText } from "../../lib/dollars-input";
import { shortDay, usdFigure } from "../../lib/finance-format";
import { useHideAmounts } from "../../lib/hide-amounts-preference";
import { errorText } from "../../lib/user-error";
import { SectionCard } from "../SectionCard";

const usd = (cents: number) => usdFigure(cents / 100, 0, i18n.locale || "en");

/** Starts a round, or edits the open one when `round` is given. */
export function RoundDialog({
  round,
  onClose,
  onSave,
}: {
  round: FundraiseRound | null;
  onClose: () => void;
  onSave: (input: { name: string; targetCents: number; capCents: number }) => Promise<void>;
}) {
  const [name, setName] = useState(round?.name ?? "");
  const [target, setTarget] = useState(round ? String(round.targetCents / 100) : "");
  const [cap, setCap] = useState(round ? String(round.capCents / 100) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const targetCents = centsFromText(target);
    const capCents = centsFromText(cap);
    if (typeof targetCents !== "number" || typeof capCents !== "number") {
      setError(t`Enter an amount`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSave({ name: name.trim(), targetCents, capCents });
      onClose();
    } catch (cause) {
      setError(errorText(cause, t`Could not save the round`));
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {round ? <Trans>Edit round</Trans> : <Trans>Start a round</Trans>}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col gap-4">
          <DialogBody className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="round-name">
                <Trans>Name</Trans>
              </Label>
              <Input
                id="round-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="round-target">
                <Trans>Target</Trans>
              </Label>
              <Input
                id="round-target"
                inputMode="decimal"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="round-cap">
                <Trans>Post-money cap</Trans>
              </Label>
              <Input
                id="round-cap"
                inputMode="decimal"
                value={cap}
                onChange={(e) => setCap(e.target.value)}
              />
            </div>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              <Trans>Cancel</Trans>
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              {round ? <Trans>Save</Trans> : <Trans>Start a round</Trans>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Segment({ cents, scale, className }: { cents: number; scale: number; className: string }) {
  if (cents <= 0 || scale <= 0) return null;
  return <div className={className} style={{ width: `${(cents / scale) * 100}%` }} />;
}

function Figure({ title, cents, dot }: { title: string; cents: number; dot: string }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <i aria-hidden="true" className={cn("size-2 rounded-full", dot)} />
        {title}
      </div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{usd(cents)}</div>
    </div>
  );
}

const LEGEND_DOTS = {
  funded: "bg-primary",
  signed: "bg-primary/70",
  pending: "bg-primary/35",
  target: "ring-1 ring-input",
};

/**
 * The round: its name and cap, the menu, and the bar Funded, Signed, Pending, Target. A closed
 * round is one line with Reopen in its menu. With no round it is the empty Round card: Start a
 * round over a static skeleton of the bar and legend.
 */
export function RoundCard({
  round,
  pendingCents,
  fundedCents = 0,
  signedCents = 0,
  onStart,
  onEdit,
  onClose,
  onReopen,
}: {
  round: FundraiseRound | null;
  pendingCents: number;
  /** From SAFEs; zero until they exist. */
  fundedCents?: number;
  signedCents?: number;
  onStart: () => void;
  onEdit: () => void;
  onClose: () => void;
  onReopen: () => void;
}) {
  useHideAmounts();
  const locale = i18n.locale || "en";
  if (!round || round.closedAt) {
    return (
      <SectionCard
        title={round ? round.name : t`Round`}
        heading={
          round ? (
            <>
              <h2 className="truncate text-sm font-semibold">{round.name}</h2>
              {round.closedAt ? (
                <p className="text-xs text-muted-foreground">
                  {t`Closed ${shortDay(round.closedAt.slice(0, 10), new Date(), locale)} · funded ${usd(fundedCents)}`}
                </p>
              ) : null}
            </>
          ) : undefined
        }
        actions={
          <>
            <Button onClick={onStart}>
              <Trans>Start a round</Trans>
            </Button>
            {round ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="ghost" size="icon-sm" aria-label={t`Round actions`} />}
                >
                  <MoreHorizontal aria-hidden="true" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onReopen}>
                    <Trans>Reopen</Trans>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </>
        }
      />
    );
  }
  const total = fundedCents + signedCents + pendingCents;
  const scale = Math.max(round.targetCents, total);
  return (
    <SectionCard
      title={round.name}
      heading={
        <>
          <h2 className="truncate text-sm font-semibold">{round.name}</h2>
          <p className="text-xs text-muted-foreground">
            {t`Post-money cap ${usd(round.capCents)}`}
          </p>
        </>
      }
      actions={
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon-sm" aria-label={t`Round actions`} />}
          >
            <MoreHorizontal aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Trans>Edit round</Trans>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onClose}>
              <Trans>Close round</Trans>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      <div className="flex h-3 overflow-hidden rounded-full bg-foreground/10" aria-hidden="true">
        <Segment cents={fundedCents} scale={scale} className="bg-primary" />
        <Segment cents={signedCents} scale={scale} className="bg-primary/70" />
        <Segment cents={pendingCents} scale={scale} className="bg-primary/35" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 @md/bd:grid-cols-4">
        <Figure title={t`Funded`} cents={fundedCents} dot={LEGEND_DOTS.funded} />
        <Figure title={t`Signed`} cents={signedCents} dot={LEGEND_DOTS.signed} />
        <Figure title={t`Pending`} cents={pendingCents} dot={LEGEND_DOTS.pending} />
        {round.targetCents > 0 ? (
          <Figure title={t`Target`} cents={round.targetCents} dot={LEGEND_DOTS.target} />
        ) : null}
      </div>
    </SectionCard>
  );
}
