import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { BrexCardsView, BrexCardView } from "@rakazo/contracts";
import { newClientId } from "@rakazo/core";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  Input,
  Label,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableHeadRow,
  TableRow,
} from "@rakazo/ui-web";
import { ChevronDown } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fullDay, money } from "../../lib/finance-format";
import { useHideAmounts } from "../../lib/hide-amounts-preference";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";
import { Sparkline } from "../finance/Sparkline";
import { Kv, KvRow, useFinanceQuery } from "../finance/ui";
import {
  CancelDialog,
  cancelMessage,
  EditLimitDialog,
  limitMessage,
  lockMessage,
  SAFE_ID,
} from "../integrations/BrexCardsSection";
import { centsToDollars, dollarsToCents } from "../integrations/BrexControlsForm";
import { SearchField } from "../ListControls";
import { BrexErrorNotice } from "./BrexSection";
import { BrexWritesOffHint } from "./BrexWritesOffHint";

/** Fetches the owner-only cards read model and renders the Cards section. */
export function BrexCards() {
  const view = useFinanceQuery(() => rpc.brexCards.cardsView(), []);
  const controls = useFinanceQuery(() => rpc.brexCards.getControls(), []);
  if (view.error) return <BrexErrorNotice query={view} />;
  if (!view.data) {
    return (
      <div role="status" aria-label={t`Loading`} className="flex flex-col gap-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  return (
    <CardsBoard
      data={view.data}
      oneTimeRequiresLock={controls.data ? controls.data.oneTimeMaxDays !== null : true}
    />
  );
}

export type NewCardDetails = {
  name: string;
  merchant: string;
  amountCents: number;
  /** The message template only knows a monthly and a one-time card. */
  duration: "MONTHLY" | "ONE_TIME";
  lockAfterDate?: string;
};

// Free text stays data inside one fixed sentence: whitespace is collapsed so a hostile name
// cannot add lines or instructions, and the value is capped like the form inputs.
const messageValue = (value: string) => value.trim().replace(/\s+/g, " ").slice(0, 200);

/** The one message the New card form sends to the Brex agent. */
export function newCardMessage(details: NewCardDetails): string {
  const name = messageValue(details.name);
  const merchant = messageValue(details.merchant);
  const period = details.duration === "ONE_TIME" ? "one time" : "month";
  const lock = details.lockAfterDate ? `, lock after ${details.lockAfterDate}` : "";
  return `Create a vendor card named ${name} for ${merchant}, $${centsToDollars(details.amountCents)} per ${period}, locked to ${merchant}${lock}.`;
}

type StatusBucket = "active" | "locked" | "terminated" | "unknown";
const BUCKETS: StatusBucket[] = ["active", "locked", "terminated", "unknown"];

function bucketOf(card: BrexCardView): StatusBucket {
  const status = card.status.toUpperCase();
  if (status === "ACTIVE") return "active";
  if (status === "LOCKED") return "locked";
  if (status === "TERMINATED") return "terminated";
  return "unknown";
}

function bucketLabel(bucket: StatusBucket): string {
  if (bucket === "active") return t`Active`;
  if (bucket === "locked") return t`Locked`;
  if (bucket === "terminated") return t`Terminated`;
  return t`Unknown`;
}

function durationOf(card: BrexCardView): string {
  return card.duration?.toUpperCase() ?? "";
}

function periodText(card: BrexCardView): string {
  if (durationOf(card) === "MONTHLY") return t`this month`;
  if (durationOf(card) === "QUARTERLY") return t`this quarter`;
  if (durationOf(card) === "YEARLY") return t`this year`;
  return t`last 90 days`;
}

function limitWord(card: BrexCardView): string {
  if (durationOf(card) === "MONTHLY") return t`monthly`;
  if (durationOf(card) === "QUARTERLY") return t`quarterly`;
  if (durationOf(card) === "YEARLY") return t`yearly`;
  if (durationOf(card) === "ONE_TIME") return t`one time`;
  return "";
}

function cardType(card: BrexCardView): string | null {
  const type = card.cardType?.toUpperCase();
  if (type === "VIRTUAL") return t`Virtual`;
  if (type === "PHYSICAL") return t`Physical`;
  return null;
}

function vendorSummary(card: BrexCardView): string {
  if (card.allowedMerchants.length === 0) return t`Any merchant`;
  const [only] = card.allowedMerchants;
  if (card.allowedMerchants.length === 1 && only !== undefined) return t`${only} only`;
  return t`${card.allowedMerchants.length} merchants`;
}

function cardCurrency(card: BrexCardView): string {
  return card.currency ?? "USD";
}

/** `$1,320 of $2,000` — the period word is rendered next to it by the caller. */
function spendText(card: BrexCardView): string {
  const spend = money(card.periodSpendCents, undefined, cardCurrency(card));
  if (card.limitCents === null) return spend;
  return t`${spend} of ${money(card.limitCents, undefined, cardCurrency(card))}`;
}

function limitText(card: BrexCardView): string {
  if (card.limitCents === null) return t`No limit`;
  const amount = money(card.limitCents, undefined, cardCurrency(card));
  const word = limitWord(card);
  return word ? t`${amount} ${word}` : amount;
}

function StatusLabel({ card }: { card: BrexCardView }) {
  const bucket = bucketOf(card);
  const tone =
    bucket === "active"
      ? "text-success"
      : bucket === "locked"
        ? "text-warning"
        : "text-muted-foreground";
  return (
    <span className={`flex shrink-0 items-center gap-1 text-xs ${tone}`}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {bucketLabel(bucket)}
    </span>
  );
}

function UsageBar({ card }: { card: BrexCardView }) {
  const amountsHidden = useHideAmounts();
  const usage = card.usage;
  if (!usage) return null;
  const percent = Math.min(100, Math.max(0, usage.percent));
  return (
    <div className="flex items-center gap-2">
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <span
          className="block h-full rounded-full bg-foreground/70"
          style={{ width: `${amountsHidden ? 0 : percent}%` }}
        />
      </span>
      <span className="w-9 text-end text-xs tabular-nums text-muted-foreground">
        {amountsHidden ? "" : `${Math.round(usage.percent)}%`}
      </span>
    </div>
  );
}

function CardTile({ card, onOpen }: { card: BrexCardView; onOpen: () => void }) {
  useHideAmounts();
  const meta = [cardType(card), vendorSummary(card)].filter(Boolean).join(" · ");
  return (
    <li className="h-full">
      {/* A stretched button: the whole tile opens the card, and it is the tile's one tab stop. */}
      <div className="relative h-full rounded-xl border border-border bg-card transition-colors hover:bg-muted/50">
        <button
          type="button"
          aria-label={card.name}
          className="absolute inset-0 cursor-pointer rounded-xl focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
          onClick={onOpen}
        />
        <div className="pointer-events-none flex h-full flex-col gap-2 p-3">
          <div className="flex items-start justify-between gap-2">
            <span className="min-w-0 truncate font-medium">{card.name}</span>
            <Sparkline
              values={card.series.map((point) => point.cents)}
              label={t`${card.name} spend trend`}
              neutral
            />
          </div>
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="truncate">{meta}</span>
            <span className="shrink-0 tabular-nums">•••• {card.lastFour}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-sm tabular-nums">
              {spendText(card)} <span className="text-muted-foreground">{periodText(card)}</span>
            </p>
            <StatusLabel card={card} />
          </div>
          <UsageBar card={card} />
        </div>
      </div>
    </li>
  );
}

/** The cards read model as tiles or a list, with search, a status filter and a New card form. */
export function CardsBoard({
  data,
  oneTimeRequiresLock = true,
}: {
  data: BrexCardsView;
  /** Brex policy: a ONE_TIME card must lock within N days; false when the owner turned the rule off. */
  oneTimeRequiresLock?: boolean;
}) {
  const navigate = useNavigate();
  const amountsHidden = useHideAmounts();
  const [query, setQuery] = useState("");
  const [hidden, setHidden] = useState<ReadonlySet<StatusBucket>>(
    () => new Set<StatusBucket>(["terminated"]),
  );
  const [view, setView] = useState<"tiles" | "list">("tiles");
  const [selected, setSelected] = useState<BrexCardView | null>(null);
  const [newCardOpen, setNewCardOpen] = useState(false);
  const [pending, setPending] = useState<{
    kind: "limit" | "cancel";
    card: BrexCardView;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState("");

  const botId = data.agentBotId;
  const enabled = Boolean(data.writesEnabled && botId);

  // A limit or cancel form left open must not send once changes are off or the agent is gone.
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
      setSelected(null);
      setNewCardOpen(false);
      navigate(`/app/${botId}`);
    } catch (cause) {
      setSendError(errorText(cause));
      setBusy(false);
    }
  }

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.cards.filter((card) => {
      if (hidden.has(bucketOf(card))) return false;
      if (!needle) return true;
      return (
        card.name.toLowerCase().includes(needle) ||
        card.lastFour.toLowerCase().includes(needle) ||
        card.allowedMerchants.some((merchant) => merchant.toLowerCase().includes(needle))
      );
    });
  }, [data.cards, query, hidden]);

  const hasTerminated = data.cards.some((card) => bucketOf(card) === "terminated");
  const presentBuckets = BUCKETS.filter((bucket) =>
    data.cards.some((card) => bucketOf(card) === bucket),
  );
  const terminatedHidden = hasTerminated && hidden.has("terminated");
  const filtering = query.trim() !== "" || hidden.size > 0;

  const toggleBucket = (bucket: StatusBucket) =>
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(bucket)) next.delete(bucket);
      else next.add(bucket);
      return next;
    });

  const clearFilters = () => {
    setQuery("");
    setHidden(new Set());
  };

  const selectedBucket = selected ? bucketOf(selected) : "active";
  const selectedTerminated = selectedBucket === "terminated";
  const selectedLocked = selectedBucket === "locked";
  const selectedUsable = Boolean(selected && enabled && SAFE_ID.test(selected.cardId));

  return (
    <div className="flex flex-col gap-3">
      {data.partial ? (
        <p className="text-xs text-muted-foreground">
          <Trans>Partial results</Trans>
        </p>
      ) : null}
      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder={t`Search name, vendor or last four`}
          label={t`Search cards`}
          name="brex-cards-search"
          className="w-full @md:w-72"
        />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="sm" className="rounded-full" />}
          >
            {t`Status`}
            <ChevronDown aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-max min-w-40">
            {presentBuckets.map((bucket) => (
              <DropdownMenuCheckboxItem
                key={bucket}
                checked={!hidden.has(bucket)}
                onCheckedChange={() => toggleBucket(bucket)}
              >
                {bucketLabel(bucket)}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {terminatedHidden ? (
          <span className="text-xs text-muted-foreground">
            <Trans>Terminated hidden</Trans>
          </span>
        ) : null}
        <span className="ms-auto flex items-center gap-1.5">
          <span className="flex items-center gap-1">
            {(
              [
                ["tiles", t`Cards`],
                ["list", t`List`],
              ] as const
            ).map(([mode, label]) => (
              <Button
                key={mode}
                type="button"
                size="xs"
                variant={view === mode ? "default" : "outline"}
                className="rounded-full"
                aria-pressed={view === mode}
                onClick={() => setView(mode)}
              >
                {label}
              </Button>
            ))}
          </span>
          <BrexWritesOffHint writesOff={!enabled}>
            <Button size="sm" disabled={!enabled} onClick={() => setNewCardOpen(true)}>
              <Trans>New card</Trans>
            </Button>
          </BrexWritesOffHint>
        </span>
      </div>

      {data.cards.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">
          <Trans>No cards</Trans>
        </p>
      ) : visible.length === 0 ? (
        <div className="flex items-center gap-3 py-4">
          <p className="text-sm text-muted-foreground">
            <Trans>No matches</Trans>
          </p>
          {filtering ? (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <Trans>Clear filters</Trans>
            </Button>
          ) : null}
        </div>
      ) : view === "tiles" ? (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((card) => (
            <CardTile
              key={`${card.cardId}`}
              card={card}
              onOpen={() => {
                setSendError("");
                setSelected(card);
              }}
            />
          ))}
        </ul>
      ) : (
        <Table compact>
          <TableHeader className="max-sm:hidden">
            <TableHeadRow>
              <TableHead>
                <Trans>Card</Trans>
              </TableHead>
              <TableHead>
                <Trans>Last four</Trans>
              </TableHead>
              <TableHead className="hidden @lg:table-cell">
                <Trans>Owner</Trans>
              </TableHead>
              <TableHead>
                <Trans>Spend</Trans>
              </TableHead>
              <TableHead className="hidden @lg:table-cell">
                <Trans>Limit</Trans>
              </TableHead>
              <TableHead>
                <Trans>Status</Trans>
              </TableHead>
            </TableHeadRow>
          </TableHeader>
          <TableBody>
            {visible.map((card) => {
              const meta = [cardType(card), vendorSummary(card)].filter(Boolean).join(" · ");
              return (
                <TableRow
                  key={`${card.cardId}`}
                  onOpen={() => {
                    setSendError("");
                    setSelected(card);
                  }}
                >
                  <TableCell className="py-2">
                    <button
                      type="button"
                      data-row-open
                      className="rounded-sm font-medium focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      {card.name}
                    </button>
                    <div className="truncate text-xs text-muted-foreground">{meta}</div>
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    •••• {card.lastFour}
                  </TableCell>
                  <TableCell className="hidden @lg:table-cell text-muted-foreground">
                    {card.ownerName ?? card.ownerUserId ?? "—"}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {spendText(card)}{" "}
                    <span className="text-muted-foreground">{periodText(card)}</span>
                  </TableCell>
                  <TableCell className="hidden @lg:table-cell">{limitText(card)}</TableCell>
                  <TableCell>
                    <StatusLabel card={card} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {sendError && !pending && !newCardOpen && !selected ? (
        <p role="alert" className="text-sm text-destructive">
          {sendError}
        </p>
      ) : null}

      <Dialog open={selected !== null} onOpenChange={(next) => !next && setSelected(null)}>
        <DialogContent>
          {selected ? (
            <div className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>{selected.name}</DialogTitle>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <StatusLabel card={selected} />
                  <span className="tabular-nums">•••• {selected.lastFour}</span>
                </div>
              </DialogHeader>
              <Kv>
                <KvRow label={t`Owner`}>{selected.ownerName ?? selected.ownerUserId ?? "—"}</KvRow>
                <KvRow label={t`Vendor`}>
                  {selected.allowedMerchants.length > 0
                    ? selected.allowedMerchants.join(", ")
                    : t`Any merchant`}
                </KvRow>
                <KvRow label={t`Limit`}>{limitText(selected)}</KvRow>
                <KvRow label={t`Spend`}>
                  {spendText(selected)} {periodText(selected)}
                </KvRow>
                {selected.lockAfterDate ? (
                  <KvRow label={t`Locks after`}>{fullDay(selected.lockAfterDate)}</KvRow>
                ) : null}
              </Kv>
              <div className="flex items-center gap-3">
                <Sparkline
                  values={selected.series.map((point) => point.cents)}
                  label={t`${selected.name} spend trend`}
                  neutral
                />
                {selected.usage && !amountsHidden ? (
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {Math.round(selected.usage.percent)}%
                  </span>
                ) : null}
              </div>
              <UsageBar card={selected} />
              {sendError ? (
                <p role="alert" className="text-sm text-destructive">
                  {sendError}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!selectedUsable || selectedTerminated || selectedLocked || busy}
                  onClick={() => void send(lockMessage(selected))}
                >
                  <Trans>Lock</Trans>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!selectedUsable || selectedTerminated || busy}
                  onClick={() => {
                    setSendError("");
                    setPending({ kind: "limit", card: selected });
                  }}
                >
                  <Trans>Edit limit</Trans>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!selectedUsable || selectedTerminated || busy}
                  onClick={() => {
                    setSendError("");
                    setPending({ kind: "cancel", card: selected });
                  }}
                >
                  <Trans>Cancel card</Trans>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ms-auto"
                  onClick={() => setSelected(null)}
                >
                  <Trans>Close</Trans>
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {newCardOpen ? (
        <NewCardDialog
          enabled={enabled}
          busy={busy}
          oneTimeRequiresLock={oneTimeRequiresLock}
          error={sendError}
          onClose={() => {
            setNewCardOpen(false);
            setSendError("");
          }}
          onSend={(details) => void send(newCardMessage(details))}
        />
      ) : null}

      {pending?.kind === "limit" ? (
        <EditLimitDialog
          busy={busy}
          error={sendError}
          onSend={(cents) => void send(limitMessage(pending.card, cents))}
          onClose={() => setPending(null)}
        />
      ) : null}
      {pending?.kind === "cancel" ? (
        <CancelDialog
          busy={busy}
          error={sendError}
          onSend={(reason) => void send(cancelMessage(pending.card, reason))}
          onClose={() => setPending(null)}
        />
      ) : null}
    </div>
  );
}

function NewCardDialog({
  enabled,
  busy,
  oneTimeRequiresLock,
  error,
  onClose,
  onSend,
}: {
  /** Allow changes as it is now; a form opened before it turned off cannot send. */
  enabled: boolean;
  busy: boolean;
  /** Whether Brex policy requires a lock date on a one-time card. */
  oneTimeRequiresLock: boolean;
  error: string;
  onClose: () => void;
  onSend: (details: NewCardDetails) => void;
}) {
  const [name, setName] = useState("");
  const [merchant, setMerchant] = useState("");
  const [limit, setLimit] = useState("");
  const [duration, setDuration] = useState<"MONTHLY" | "ONE_TIME">("MONTHLY");
  const [lockAfterDate, setLockAfterDate] = useState("");
  const [invalid, setInvalid] = useState<"fields" | "lock" | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const amountCents = dollarsToCents(limit);
    const fieldsValid = name.trim() !== "" && merchant.trim() !== "" && amountCents !== null;
    // Brex refuses a ONE_TIME card without a lock date when the policy has the rule on.
    const lockMissing = duration === "ONE_TIME" && oneTimeRequiresLock && lockAfterDate === "";
    setInvalid(!fieldsValid ? "fields" : lockMissing ? "lock" : null);
    if (!fieldsValid || lockMissing || amountCents === null || !enabled) return;
    onSend({
      name,
      merchant,
      amountCents,
      duration,
      lockAfterDate: lockAfterDate || undefined,
    });
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <DialogHeader>
            <DialogTitle>
              <Trans>New card</Trans>
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1">
            <Label htmlFor="brex-new-card-name">
              <Trans>Card name</Trans>
            </Label>
            <Input
              id="brex-new-card-name"
              autoFocus
              autoComplete="off"
              maxLength={200}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="brex-new-card-merchant">
              <Trans>Vendor</Trans>
            </Label>
            <Input
              id="brex-new-card-merchant"
              autoComplete="off"
              maxLength={200}
              value={merchant}
              onChange={(event) => setMerchant(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              <Trans>Only this merchant can charge the card.</Trans>
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="brex-new-card-limit">
              <Trans>Limit</Trans>
            </Label>
            <Input
              id="brex-new-card-limit"
              inputMode="decimal"
              autoComplete="off"
              value={limit}
              onChange={(event) => setLimit(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">
              <Trans>Period</Trans>
            </span>
            <div className="flex items-center gap-1">
              {(
                [
                  ["MONTHLY", t`Monthly`],
                  ["ONE_TIME", t`One time`],
                ] as const
              ).map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  size="xs"
                  variant={duration === value ? "default" : "outline"}
                  className="rounded-full"
                  aria-pressed={duration === value}
                  onClick={() => setDuration(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="brex-new-card-lock-date">
              <Trans>Lock date</Trans>
            </Label>
            <Input
              id="brex-new-card-lock-date"
              type="date"
              value={lockAfterDate}
              onChange={(event) => setLockAfterDate(event.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            <Trans>Goes to approval before the card is created.</Trans>
          </p>
          {invalid || error ? (
            <p role="alert" className="text-sm text-destructive">
              {invalid === "fields"
                ? t`Enter a card name, vendor and limit`
                : invalid === "lock"
                  ? t`Enter a lock date for a one-time card`
                  : error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              <Trans>Cancel</Trans>
            </Button>
            <Button type="submit" disabled={!enabled || busy}>
              <Trans>Request card</Trans>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
