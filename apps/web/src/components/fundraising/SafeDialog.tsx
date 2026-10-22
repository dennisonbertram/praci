import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { Contact, FundraiseRound, Safe, SafeSaveInput } from "@rakazo/contracts";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@rakazo/ui-web";
import type { FormEvent } from "react";
import { useState } from "react";
import { isoFromDay, todayDay } from "../../lib/day-input";
import { centsFromText } from "../../lib/dollars-input";
import { shortDay, usdFigure } from "../../lib/finance-format";
import { errorText } from "../../lib/user-error";

const usd = (cents: number) => usdFigure(cents / 100, 0, i18n.locale || "en");
const YC_DOCUMENTS = "https://www.ycombinator.com/documents";

/**
 * Send SAFE without Mercury: the YC post-money valuation-cap SAFE, prefilled from the prospect and
 * the open round. The cap is the only valuation term, so there is no discount or MFN field. The
 * founder sends the document themselves; this records it as a Draft.
 */
export function SafeDialog({
  prospect,
  round,
  onClose,
  onSave,
}: {
  prospect: Contact;
  /** The open round, whose cap prefills the terms; null shows the terms open. */
  round: FundraiseRound | null;
  onClose: () => void;
  onSave: (input: SafeSaveInput) => Promise<void>;
}) {
  const [investor, setInvestor] = useState(prospect.name);
  const [amount, setAmount] = useState(
    prospect.checkSizeCents ? String(prospect.checkSizeCents / 100) : "",
  );
  const [day, setDay] = useState(todayDay());
  const [showTerms, setShowTerms] = useState(!round);
  const [cap, setCap] = useState(round ? String(round.capCents / 100) : "");
  const [proRata, setProRata] = useState(false);
  const [state, setState] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const amountCents = centsFromText(amount);
    const capCents = centsFromText(cap);
    if (!amountCents) return setError(t`Enter an amount`);
    if (!capCents) {
      setShowTerms(true);
      return setError(t`Enter a post-money cap`);
    }
    setBusy(true);
    setError("");
    try {
      await onSave({
        contactId: prospect.id,
        investorName: investor.trim(),
        investorEmail: prospect.email,
        amountCents,
        capCents,
        proRata,
        governingState: state.trim() || null,
        investmentDate: day ? isoFromDay(day) : null,
      });
    } catch (cause) {
      setError(errorText(cause, t`Could not save the SAFE`));
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Send SAFE</Trans>
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col gap-4">
          <DialogBody className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="safe-investor">
                <Trans>Investor</Trans>
              </Label>
              <Input
                id="safe-investor"
                required
                value={investor}
                onChange={(e) => setInvestor(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="safe-amount">
                <Trans>Amount</Trans>
              </Label>
              <Input
                id="safe-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="safe-date">
                <Trans>Date</Trans>
              </Label>
              <Input
                id="safe-date"
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
              />
            </div>
            {round && !showTerms ? (
              <div className="flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
                <span>{t`Post-money cap ${usd(round.capCents)}`}</span>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-6 px-0 pointer-coarse:h-11"
                  onClick={() => setShowTerms(true)}
                >
                  <Trans>Different terms</Trans>
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="safe-cap">
                    <Trans>Post-money cap</Trans>
                  </Label>
                  <Input
                    id="safe-cap"
                    inputMode="decimal"
                    value={cap}
                    onChange={(e) => setCap(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="safe-state">
                    <Trans>Governing state</Trans>
                  </Label>
                  <Input id="safe-state" value={state} onChange={(e) => setState(e.target.value)} />
                </div>
                <label className="flex min-h-6 items-center gap-2 text-sm pointer-coarse:min-h-11">
                  <input
                    type="checkbox"
                    checked={proRata}
                    onChange={(e) => setProRata(e.target.checked)}
                  />
                  <Trans>Pro rata side letter</Trans>
                </label>
              </div>
            )}
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
            <Button
              type="submit"
              disabled={busy || !investor.trim()}
              className="pointer-coarse:h-11"
            >
              <Trans>Send SAFE</Trans>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Prints the terms from a hidden frame, so the rest of the page stays out of the printout. */
function printTerms(title: string, rows: readonly (readonly [string, string])[]) {
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;width:0;height:0;border:0";
  document.body.append(frame);
  const doc = frame.contentDocument;
  if (!doc) return frame.remove();
  doc.title = title;
  const heading = doc.createElement("h1");
  heading.textContent = title;
  const list = doc.createElement("dl");
  for (const [label, value] of rows) {
    const term = doc.createElement("dt");
    term.textContent = label;
    const detail = doc.createElement("dd");
    detail.textContent = value;
    list.append(term, detail);
  }
  doc.body.append(heading, list);
  frame.contentWindow?.addEventListener("afterprint", () => frame.remove());
  frame.contentWindow?.print();
}

/**
 * The SAFE's terms in a printable list, with a link to YC's documents. A Draft offers Mark sent,
 * which records today without asking for a date; every other row only shows the terms.
 */
export function SafeCoverSummary({
  safe,
  onClose,
  onMarkSent,
}: {
  safe: Safe;
  onClose: () => void;
  onMarkSent: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const locale = i18n.locale || "en";
  const day = (iso: string | null) => (iso ? shortDay(iso.slice(0, 10), new Date(), locale) : null);
  const rows = [
    [t`Investor`, safe.investorName],
    [t`Amount`, usd(safe.amountCents)],
    [t`Valuation`, safe.capCents == null ? "—" : t`Post-money cap ${usd(safe.capCents)}`],
    [t`Discount`, safe.discountPercent == null ? "—" : `${safe.discountPercent}%`],
    [t`MFN`, safe.mfn ? t`Yes` : t`No`],
    [t`Pro rata side letter`, safe.proRata ? t`Yes` : t`No`],
    [t`Governing state`, safe.governingState ?? "—"],
    [t`Date`, day(safe.investmentDate) ?? "—"],
  ] as const;

  async function markSent() {
    setBusy(true);
    setError("");
    try {
      await onMarkSent();
    } catch (cause) {
      setError(errorText(cause, t`Could not mark sent`));
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>SAFE</Trans>
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="min-w-0 break-words">{value}</dd>
              </div>
            ))}
          </dl>
          <a
            href={YC_DOCUMENTS}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-6 items-center text-sm underline underline-offset-4 pointer-coarse:min-h-11"
          >
            <Trans>YC documents ›</Trans>
          </a>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="pointer-coarse:h-11"
            onClick={() => printTerms(t`SAFE`, rows)}
          >
            <Trans>Print</Trans>
          </Button>
          {safe.status === "draft" ? (
            <Button
              type="button"
              disabled={busy}
              className="pointer-coarse:h-11"
              onClick={() => void markSent()}
            >
              <Trans>Mark sent</Trans>
            </Button>
          ) : (
            <Button type="button" className="pointer-coarse:h-11" onClick={onClose}>
              <Trans>Close</Trans>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
