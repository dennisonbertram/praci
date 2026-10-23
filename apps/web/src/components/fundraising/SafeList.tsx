import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { FundraiseRound, Safe, SafeMarkInput, SafeStatus } from "@rakazo/contracts";
import { needsAttention } from "@rakazo/core";
import {
  Badge,
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
import { MoreHorizontal } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { todayDay } from "../../lib/day-input";
import { shortDay, usdFigure } from "../../lib/finance-format";
import { useHideAmounts } from "../../lib/hide-amounts-preference";
import { errorText } from "../../lib/user-error";
import { SectionCard } from "../SectionCard";

export type SafeStep = Exclude<SafeMarkInput["action"], "cancel">;

const usd = (cents: number) => usdFigure(cents / 100, 0, i18n.locale || "en");
const day = (iso: string) => shortDay(iso.slice(0, 10), new Date(), i18n.locale || "en");

const statusNames = (): Record<SafeStatus, string> => ({
  draft: t`Draft`,
  sent: t`Sent`,
  signed: t`Signed`,
  funded: t`Funded`,
  expired: t`Expired`,
  canceled: t`Canceled`,
});

/** Funded first, then Signed, Sent and Draft; Expired and Canceled last. */
const ORDER: SafeStatus[] = ["funded", "signed", "sent", "draft", "expired", "canceled"];
const NEXT: Partial<Record<SafeStatus, SafeStep>> = {
  draft: "sent",
  sent: "signed",
  signed: "funded",
};

/** The date that goes with the SAFE's status. */
const statusDate = (safe: Safe): string =>
  (safe.status === "funded"
    ? safe.paidAt
    : safe.status === "signed"
      ? safe.signedByOwnerAt
      : safe.status === "sent"
        ? safe.sentAt
        : safe.status === "canceled"
          ? safe.canceledAt
          : null) ??
  safe.investmentDate ??
  safe.createdAt;

const markNames = (): Record<SafeStep, string> => ({
  sent: t`Mark sent`,
  signed: t`Mark signed`,
  funded: t`Mark funded`,
});

/** The date a Mark action records, asked in a small dialog. */
export function MarkDateDialog({
  step,
  onClose,
  onSave,
}: {
  step: SafeStep;
  onClose: () => void;
  onSave: (day: string) => Promise<void>;
}) {
  const [value, setValue] = useState(todayDay());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!value) return;
    setBusy(true);
    setError("");
    try {
      await onSave(value);
    } catch (cause) {
      setError(errorText(cause, t`Could not save`));
      setBusy(false);
    }
  }
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{markNames()[step]}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col gap-4">
          <DialogBody className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mark-date">
                <Trans>Date</Trans>
              </Label>
              <Input
                id="mark-date"
                type="date"
                value={value}
                onChange={(e) => setValue(e.target.value)}
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
            <Button type="submit" disabled={busy || !value} className="pointer-coarse:h-11">
              {markNames()[step]}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * SAFEs that need the founder: signed and awaiting a deposit (Mark funded, Find in Finance), and
 * sent but unsigned for 14 days (Mark signed). `needsAttention` decides; the block is absent when
 * nothing qualifies. Mark buttons exist on native SAFEs only: a Mercury row's status is Mercury's.
 */
export function AttentionStrip({
  safes,
  now = new Date(),
  onMark,
}: {
  safes: readonly Safe[];
  now?: Date;
  onMark: (safe: Safe, step: SafeStep) => void;
}) {
  useHideAmounts();
  const items = safes.flatMap((safe) => {
    const why = needsAttention(safe, now);
    return why ? [{ safe, why }] : [];
  });
  if (items.length === 0) return null;
  return (
    <SectionCard title={t`Attention`} attention>
      <ul>
        {items.map(({ safe, why }) => (
          <li
            key={safe.id}
            className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 border-t border-border py-1.5 first:border-t-0"
          >
            <div className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium" title={safe.investorName}>
                {safe.investorName}
              </span>
              <span className="block text-xs text-muted-foreground">
                {why === "deposit"
                  ? t`Awaiting deposit · ${usd(safe.amountCents)}`
                  : t`Sent ${day(safe.sentAt ?? safe.createdAt)}, not signed`}
              </span>
            </div>
            {why === "deposit" ? (
              <Link
                to="/app/finance"
                className="inline-flex min-h-6 items-center text-sm underline underline-offset-4 pointer-coarse:min-h-11"
              >
                <Trans>Find in Finance</Trans>
              </Link>
            ) : null}
            {safe.source === "native" ? (
              <Button
                variant="outline"
                size="sm"
                className="pointer-coarse:h-11"
                onClick={() => onMark(safe, why === "deposit" ? "funded" : "signed")}
              >
                {why === "deposit" ? <Trans>Mark funded</Trans> : <Trans>Mark signed</Trans>}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function SafeRow({
  safe,
  round,
  contactName,
  onOpen,
  onMark,
  onCancel,
  onDelete,
  onAssign,
  onUnassign,
}: {
  safe: Safe;
  round: FundraiseRound | null;
  contactName?: string;
  onOpen: () => void;
  onMark: (step: SafeStep) => void;
  onCancel: () => void;
  onDelete: () => void;
  onAssign?: () => void;
  onUnassign?: () => void;
}) {
  const names = statusNames();
  const next = safe.source === "native" ? NEXT[safe.status] : undefined;
  const native = safe.source === "native";
  // Cap and source appear only when they differ from the round and the page's native default.
  const notes = [
    safe.capCents != null && safe.capCents !== round?.capCents
      ? safe.valuationType === "pre_money_cap"
        ? t`Pre-money cap ${usd(safe.capCents)}`
        : t`Post-money cap ${usd(safe.capCents)}`
      : null,
    native ? null : t`from Mercury`,
    contactName && contactName !== safe.investorName ? contactName : null,
  ].filter(Boolean);
  return (
    <li data-safe-id={safe.id} className="flex min-h-13 items-center gap-2 border-t border-border">
      <div className="min-w-0 flex-1">
        <button
          type="button"
          className="block w-full min-w-0 rounded-sm py-1.5 text-start outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onOpen}
        >
          <span className="block truncate text-sm font-medium" title={safe.investorName}>
            {safe.investorName}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {[day(statusDate(safe)), ...notes].join(" · ")}
          </span>
        </button>
        {(!native && !safe.contactId && onAssign) || safe.financeTransactionId ? (
          <div className="flex flex-wrap items-center gap-x-3 pb-1">
            {!native && !safe.contactId && onAssign ? (
              <Button
                variant="ghost"
                size="sm"
                className="-ms-2 h-6 text-xs underline underline-offset-4 pointer-coarse:h-11"
                onClick={onAssign}
              >
                <Trans>Assign to contact</Trans>
              </Button>
            ) : null}
            {safe.financeTransactionId ? (
              <Link
                to="/app/finance"
                className="inline-flex min-h-6 items-center text-xs underline underline-offset-4 pointer-coarse:min-h-11"
              >
                <Trans>Deposit in Finance</Trans>
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
      {/* On a phone the status sits under the amount so the investor name keeps its width. */}
      <div className="flex shrink-0 flex-col items-end gap-0.5 sm:flex-row sm:items-center sm:gap-2">
        <span
          className={`text-end text-sm tabular-nums sm:w-24 ${safe.status === "draft" ? "text-muted-foreground" : ""}`}
          data-testid="safe-amount"
        >
          {usd(safe.amountCents)}
        </span>
        <Badge variant="secondary" className="w-16">
          {names[safe.status]}
        </Badge>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t`Actions for ${safe.investorName} SAFE`}
            />
          }
        >
          <MoreHorizontal aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onOpen}>
            <Trans>Open</Trans>
          </DropdownMenuItem>
          {next ? (
            <DropdownMenuItem onClick={() => onMark(next)}>{markNames()[next]}</DropdownMenuItem>
          ) : null}
          {native && safe.status !== "funded" && safe.status !== "canceled" ? (
            <DropdownMenuItem onClick={onCancel}>
              <Trans>Cancel SAFE</Trans>
            </DropdownMenuItem>
          ) : null}
          {!native && !safe.contactId && onAssign ? (
            <DropdownMenuItem onClick={onAssign}>
              <Trans>Assign to contact</Trans>
            </DropdownMenuItem>
          ) : null}
          {!native && safe.contactId && onUnassign ? (
            <DropdownMenuItem onClick={onUnassign}>
              <Trans>Unassign</Trans>
            </DropdownMenuItem>
          ) : null}
          {native ? (
            <DropdownMenuItem onClick={onDelete}>
              <Trans>Delete</Trans>
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

/** Every SAFE, Funded first. Each row's menu offers only the next valid Mark action. */
export function SafeList({
  safes,
  round,
  contacts = [],
  onOpen,
  onMark,
  onCancel,
  onDelete,
  onAssign,
  onUnassign,
}: {
  safes: readonly Safe[];
  round: FundraiseRound | null;
  /** Names a Mercury row's assigned contact. */
  contacts?: readonly { id: string; name: string }[];
  onOpen: (safe: Safe) => void;
  onMark: (safe: Safe, step: SafeStep) => void;
  onCancel: (safe: Safe) => void;
  onDelete: (safe: Safe) => void;
  /** Mercury rows only: attach a SAFE that has no contact, or detach one with a contact. */
  onAssign?: (safe: Safe) => void;
  onUnassign?: (safe: Safe) => void;
}) {
  useHideAmounts();
  const sorted = [...safes].sort(
    (a, b) =>
      ORDER.indexOf(a.status) - ORDER.indexOf(b.status) ||
      statusDate(b).localeCompare(statusDate(a)),
  );
  return (
    <ul>
      {sorted.map((safe) => (
        <SafeRow
          key={safe.id}
          safe={safe}
          round={round}
          contactName={contacts.find((c) => c.id === safe.contactId)?.name}
          onOpen={() => onOpen(safe)}
          onMark={(step) => onMark(safe, step)}
          onCancel={() => onCancel(safe)}
          onDelete={() => onDelete(safe)}
          onAssign={onAssign && (() => onAssign(safe))}
          onUnassign={onUnassign && (() => onUnassign(safe))}
        />
      ))}
    </ul>
  );
}
