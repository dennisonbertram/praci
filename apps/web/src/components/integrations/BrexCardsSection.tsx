import { Trans, useLingui } from "@lingui/react/macro";
import type { BrexCardRow, BrexCardsList, BrexChangeCardReason } from "@rakazo/contracts";
import { BrexChangeCardReasonSchema } from "@rakazo/contracts";
import { newClientId } from "@rakazo/core";
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
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableHeadRow,
  TableRow,
} from "@rakazo/ui-web";
import type { FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";
import { Heading } from "./AppDetail";
import { centsToDollars, dollarsToCents } from "./BrexControlsForm";

/** The cards for the server page. A refused read (not the space owner) hides the owner's sections. */
export function useBrexCards(enabled: boolean) {
  const [cards, setCards] = useState<BrexCardsList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  // The last failure ran past the server's owner checks (the Brex call itself failed), so the caller
  // is the owner. A network failure has no server code and proves nothing.
  const [ownerProven, setOwnerProven] = useState(false);
  const reload = useCallback(() => {
    // A failed read stays on screen while it is retried, so the page does not flicker.
    rpc.brexCards
      .cards()
      .then((answer) => {
        setCards(answer);
        setError(null);
        setOwnerProven(false);
      })
      .catch((cause) => {
        const code = (cause as { code?: unknown } | null)?.code;
        if (code === "FORBIDDEN") {
          setForbidden(true);
          setCards(null);
          setOwnerProven(false);
          return;
        }
        setError(errorText(cause));
        setOwnerProven(typeof code === "string" && code !== "PRECONDITION_FAILED");
      });
  }, []);
  useEffect(() => {
    if (enabled) reload();
  }, [enabled, reload]);
  return { cards, error, forbidden, ownerProven, reload };
}

// Brex ids are plain tokens. The id is Brex-controlled text, so anything else is never sent.
export const SAFE_ID = /^[A-Za-z0-9_-]{1,200}$/;

// A one-time card has no period, so its message leaves "per {period}" out.
const PERIODS: Record<string, string> = { MONTHLY: "month", QUARTERLY: "quarter", YEARLY: "year" };

export const lockMessage = (card: BrexCardRow) => `Lock card ${card.cardId}.`;
export const cancelMessage = (card: BrexCardRow, reason: BrexChangeCardReason) =>
  `Cancel card ${card.cardId}, reason ${reason}.`;
export function limitMessage(card: BrexCardRow, cents: number) {
  const period = card.duration ? PERIODS[card.duration] : undefined;
  return `Set the limit of card ${card.cardId} to $${centsToDollars(cents)}${period ? ` per ${period}` : ""}.`;
}

function limitText(card: BrexCardRow) {
  if (card.limitCents === null) return "";
  let amount = `${centsToDollars(card.limitCents)}`;
  try {
    amount = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: card.currency ?? "USD",
    }).format(card.limitCents / 100);
  } catch {
    // An unknown currency code: show the number alone.
  }
  return card.duration ? `${amount} ${card.duration.toLowerCase().replace("_", " ")}` : amount;
}

type Pending = { kind: "limit" | "cancel"; card: BrexCardRow };

/**
 * The owner's cards with Lock, Edit limit and Cancel. A button sends one message to the Brex agent
 * built from a fixed action word, the card id and a validated amount or reason, then opens the
 * agent's chat. The card name never enters the message. There is no Unlock: that is done in Brex.
 */
export function BrexCardsSection({
  cards,
  error,
  writesEnabled,
  onRetry,
}: {
  /** Null while loading, or when it could not be read (`error`). */
  cards: BrexCardsList | null;
  error: string | null;
  /** The Allow changes switch as it is now; the cards answer is read once and goes stale. */
  writesEnabled?: boolean;
  onRetry: () => void;
}) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState("");

  const botId = cards?.agentBotId ?? null;
  const enabled = Boolean((writesEnabled ?? cards?.writesEnabled) && botId);

  // A dialog left open must not send once changes are off or the agent is gone.
  useEffect(() => {
    if (!enabled) setPending(null);
  }, [enabled]);

  async function send(text: string) {
    if (!botId || !enabled || busy) return;
    setBusy(true);
    setSendError("");
    try {
      await rpc.threads.send({ botId, clientNonce: newClientId(), text });
      setPending(null);
      navigate(`/app/${botId}`);
    } catch (cause) {
      setSendError(errorText(cause));
      setBusy(false);
    }
  }
  const open = (next: Pending | null) => {
    setSendError("");
    setPending(next);
  };

  let body: ReactNode;
  if (!cards) {
    body = error ? (
      <div className="flex items-center gap-3">
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <Trans>Retry</Trans>
        </Button>
      </div>
    ) : (
      <div role="status" aria-label={t`Loading`}>
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  } else if (cards.cards.length === 0) {
    body = (
      <p className="text-muted-foreground">
        <Trans>No cards</Trans>
      </p>
    );
  } else {
    body = (
      <Table>
        <TableHeader className="sr-only">
          <TableHeadRow>
            <TableHead>
              <Trans>Name</Trans>
            </TableHead>
            <TableHead>
              <Trans>Last four</Trans>
            </TableHead>
            <TableHead>
              <Trans>Owner</Trans>
            </TableHead>
            <TableHead>
              <Trans>Limit</Trans>
            </TableHead>
            <TableHead>
              <Trans>Status</Trans>
            </TableHead>
            <TableHead>
              <Trans>Actions</Trans>
            </TableHead>
          </TableHeadRow>
        </TableHeader>
        <TableBody>
          {cards.cards.map((card, index) => {
            const usable = enabled && SAFE_ID.test(card.cardId);
            // Brex has already done these: a locked card cannot be locked again, and a terminated
            // card cannot be changed at all.
            const terminated = card.status.toUpperCase() === "TERMINATED";
            const locked = card.status.toUpperCase() === "LOCKED";
            return (
              // The id is Brex's and unique; the index only guards a malformed duplicate.
              <TableRow key={`${card.cardId}-${index}`}>
                <TableCell className="break-words font-medium">{card.name}</TableCell>
                <TableCell>{card.lastFour}</TableCell>
                <TableCell className="break-all text-muted-foreground">
                  {card.ownerUserId ?? ""}
                </TableCell>
                <TableCell>{limitText(card)}</TableCell>
                <TableCell>{card.status}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!usable || terminated || locked || busy}
                      onClick={() => void send(lockMessage(card))}
                    >
                      <Trans>Lock</Trans>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!usable || terminated || busy}
                      onClick={() => open({ kind: "limit", card })}
                    >
                      <Trans>Edit limit</Trans>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!usable || terminated || busy}
                      onClick={() => open({ kind: "cancel", card })}
                    >
                      <Trans>Cancel</Trans>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  }

  return (
    <section aria-label={t`Cards`}>
      <Heading>
        <Trans>Cards</Trans>
      </Heading>
      {body}
      {sendError && !pending ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {sendError}
        </p>
      ) : null}
      {pending?.kind === "limit" ? (
        <EditLimitDialog
          busy={busy}
          error={sendError}
          onSend={(cents) => void send(limitMessage(pending.card, cents))}
          onClose={() => open(null)}
        />
      ) : null}
      {pending?.kind === "cancel" ? (
        <CancelDialog
          busy={busy}
          error={sendError}
          onSend={(reason) => void send(cancelMessage(pending.card, reason))}
          onClose={() => open(null)}
        />
      ) : null}
    </section>
  );
}

export function EditLimitDialog({
  busy,
  error,
  onSend,
  onClose,
}: {
  busy: boolean;
  error: string;
  onSend: (cents: number) => void;
  onClose: () => void;
}) {
  const { t } = useLingui();
  const [amount, setAmount] = useState("");
  const [invalid, setInvalid] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    const cents = dollarsToCents(amount);
    setInvalid(cents === null);
    if (cents !== null) onSend(cents);
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <DialogHeader>
            <DialogTitle>
              <Trans>Edit limit</Trans>
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1">
            <Label htmlFor="brex-new-limit">
              <Trans>New limit</Trans>
            </Label>
            <Input
              id="brex-new-limit"
              autoFocus
              inputMode="decimal"
              autoComplete="off"
              aria-invalid={invalid || undefined}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          {invalid || error ? (
            <p role="alert" className="text-sm text-destructive">
              {invalid ? t`Enter an amount above 0` : error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              <Trans>Cancel</Trans>
            </Button>
            <Button type="submit" disabled={busy}>
              <Trans>Send</Trans>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CancelDialog({
  busy,
  error,
  onSend,
  onClose,
}: {
  busy: boolean;
  error: string;
  onSend: (reason: BrexChangeCardReason) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<BrexChangeCardReason | "">("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = BrexChangeCardReasonSchema.safeParse(reason);
    if (parsed.success) onSend(parsed.data);
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <DialogHeader>
            <DialogTitle>
              <Trans>Cancel card</Trans>
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1">
            <Label htmlFor="brex-cancel-reason">
              <Trans>Reason</Trans>
            </Label>
            <NativeSelect
              id="brex-cancel-reason"
              className="w-full"
              value={reason}
              onChange={(event) => setReason(event.target.value as BrexChangeCardReason | "")}
            >
              <NativeSelectOption value="" />
              {BrexChangeCardReasonSchema.options.map((option) => (
                <NativeSelectOption key={option} value={option}>
                  {option}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              <Trans>Cancel</Trans>
            </Button>
            <Button type="submit" variant="destructive" disabled={busy || !reason}>
              <Trans>Cancel card</Trans>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
