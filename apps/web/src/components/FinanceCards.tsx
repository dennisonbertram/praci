import { Plural, Trans, useLingui } from "@lingui/react/macro";
import type { FinanceCard, MessageBlock } from "@rakazo/contracts";
import { Card } from "@rakazo/ui-web";
import { ChevronRight, MessageSquareQuote } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { dayRange, money, shortDay, transactionAmount } from "../lib/finance-format";
import { financePath } from "../lib/finance-route";

type FinanceBlock = Extract<MessageBlock, { kind: "finance" }>;

/** A compact preview of what a finance tool read, so the chat shows the agent is looking at real data. Names are untrusted text. */
export function FinanceCards({
  block,
  onAsk,
  tiled,
}: {
  block: FinanceBlock;
  /** Called when the user chooses "Ask about this"; the caller sets the message as the reply target. */
  onAsk?: () => void;
  /** Inside a group the card fills its grid cell instead of using the fixed width. */
  tiled?: boolean;
}) {
  const { t } = useLingui();
  return (
    <div
      data-testid="finance-card"
      className={`group/fcard relative max-w-full py-1 ${tiled ? "min-w-0" : "w-80"}`}
    >
      <Preview card={block.card} />
      {onAsk ? (
        <button
          type="button"
          aria-label={t`Ask about this`}
          title={t`Ask about this`}
          onClick={onAsk}
          className="absolute -end-1.5 -top-0.5 rounded-full border border-border bg-background p-1 text-muted-foreground opacity-0 shadow-sm hover:text-foreground focus-visible:opacity-100 group-hover/fcard:opacity-100 [@media(hover:none)]:opacity-100"
        >
          <MessageSquareQuote className="size-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

/** Several finance lookups from one turn, tiled in a grid. Three or more start collapsed until the user chooses. */
export function FinanceCardGroup({
  items,
  onAsk,
  revealMessageId,
}: {
  items: readonly { id: string; messageId: string; block: FinanceBlock }[];
  /** Asks about the message that holds the card. */
  onAsk?: (messageId: string) => void;
  /** A reply-jump target; if it is one of this group's messages the group opens. */
  revealMessageId?: string;
}) {
  const [chosen, setChosen] = useState<boolean | null>(null);
  const open = chosen ?? items.length < 3;
  useEffect(() => {
    if (revealMessageId && items.some((item) => item.messageId === revealMessageId)) {
      setChosen(true);
    }
  }, [revealMessageId, items]);
  if (items.length === 1) {
    const [item] = items;
    return item ? (
      <FinanceCards block={item.block} onAsk={onAsk && (() => onAsk(item.messageId))} />
    ) : null;
  }
  return (
    <div className="w-full min-w-0" data-testid="finance-group">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setChosen(!open)}
        className="flex items-center gap-1 rounded-md px-1 py-0.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        <ChevronRight
          className={`size-3.5 transition-transform ${open ? "rotate-90" : ""}`}
          aria-hidden="true"
        />
        <Plural value={items.length} one="# finance lookup" other="# finance lookups" />
      </button>
      {open ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-2">
          {items.map((item) => (
            <div key={item.id} data-message-id={item.messageId} className="min-w-0">
              <FinanceCards
                block={item.block}
                tiled
                onAsk={onAsk && (() => onAsk(item.messageId))}
              />
            </div>
          ))}
        </div>
      ) : (
        // Collapsed: keep a zero-height anchor per message so a reply-jump still finds its row.
        items.map((item) => (
          <span key={item.id} data-message-id={item.messageId} className="block h-0" />
        ))
      )}
    </div>
  );
}

function Header({ to, title, value }: { to: string; title: string; value?: string }) {
  return (
    <Link to={to} className="flex items-baseline justify-between gap-3 px-3 pb-1 hover:underline">
      <span className="text-xs font-semibold text-muted-foreground">{title}</span>
      {value ? <span className="text-sm font-medium tabular-nums">{value}</span> : null}
    </Link>
  );
}

function Preview({ card }: { card: FinanceCard }) {
  const { t } = useLingui();
  if (card.card === "overview") {
    const kpis = [
      [t`Cash`, money(card.cashCents)],
      [t`Burn / mo`, money(card.burnCents)],
      // One decimal, as on the dashboard.
      [t`Runway`, card.runwayMonths === null ? "–" : t`${card.runwayMonths.toFixed(1)} mo`],
      [t`Spent this month`, money(card.monthSpendCents)],
    ] as const;
    return (
      <Card size="sm" className="gap-1 py-2">
        <Header to={financePath.dashboard()} title={t`Finance`} />
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 px-3">
          {kpis.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="font-medium tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>
    );
  }
  if (card.card === "breakdown") {
    const top = Math.max(...card.rows.map((row) => row.cents), 1);
    return (
      <Card size="sm" className="gap-1 py-2">
        <Header
          to={financePath.spend()}
          title={`${card.by === "vendor" ? t`Vendors` : t`Categories`} · ${card.range}`}
          value={money(card.totalCents)}
        />
        <ul className="flex flex-col gap-1.5 px-3">
          {card.rows.map((row) => (
            <li key={row.key}>
              <Link
                to={
                  card.by === "vendor" ? financePath.vendor(row.key) : financePath.category(row.key)
                }
                className="flex flex-col gap-0.5 hover:underline"
              >
                <span className="flex justify-between gap-3 text-sm">
                  <span dir="auto" className="truncate">
                    {row.label}
                  </span>
                  <span className="tabular-nums">{money(row.cents)}</span>
                </span>
                <span className="h-1 rounded-full bg-muted" aria-hidden="true">
                  <span
                    className="block h-1 rounded-full bg-primary"
                    style={{ width: `${Math.max(2, Math.round((row.cents / top) * 100))}%` }}
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    );
  }
  if (card.card === "transactions") {
    const period =
      card.from && card.to
        ? dayRange(card.from, card.to)
        : card.from
          ? t`since ${shortDay(card.from)}`
          : card.to
            ? t`until ${shortDay(card.to)}`
            : t`all dates`;
    return (
      <Card size="sm" className="gap-1 py-2">
        <Header
          to={financePath.spend()}
          title={t`${card.count} transactions · ${period}`}
          value={transactionAmount(card.totalCents)}
        />
        <ul className="flex flex-col px-3">
          {card.rows.map((row) => (
            <li key={row.id}>
              <Link
                to={financePath.transaction(row.id)}
                className="flex items-baseline justify-between gap-3 py-0.5 text-sm hover:underline"
              >
                <span dir="auto" className="truncate">
                  {row.label}
                </span>
                <span className="flex shrink-0 gap-2">
                  <span className="text-xs text-muted-foreground">{shortDay(row.day)}</span>
                  <span className="tabular-nums">{transactionAmount(row.cents)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    );
  }
  return (
    <Card size="sm" className="gap-1 py-2">
      <Header
        to={financePath.dashboard()}
        title={t`Subscriptions / mo`}
        value={money(card.monthlyCents)}
      />
      <ul className="flex flex-col px-3">
        {card.rows.map((row) => (
          <li key={row.key}>
            <Link
              to={financePath.recurring(row.key)}
              className="flex justify-between gap-3 py-0.5 text-sm hover:underline"
            >
              <span dir="auto" className="truncate">
                {row.label}
              </span>
              <span className="tabular-nums">{money(row.cents)}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="flex justify-between px-3 pt-1 text-xs text-muted-foreground">
        <Trans>Next 30 days</Trans>
        <span className="tabular-nums">{money(card.upcomingCents)}</span>
      </p>
    </Card>
  );
}
