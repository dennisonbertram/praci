import { Trans, useLingui } from "@lingui/react/macro";
import type { FinanceCard, MessageBlock } from "@rakazo/contracts";
import { Card } from "@rakazo/ui-web";
import { Link } from "react-router-dom";
import { money, shortDay, transactionAmount } from "../lib/finance-format";
import { financePath } from "../lib/finance-route";

/** A compact preview of what a finance tool read, so the chat shows the agent is looking at real data. Names are untrusted text. */
export function FinanceCards({ block }: { block: Extract<MessageBlock, { kind: "finance" }> }) {
  return (
    <div data-testid="finance-card" className="w-80 max-w-full py-1">
      <Preview card={block.card} />
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
      [t`Runway`, card.runwayMonths === null ? "–" : t`${Math.round(card.runwayMonths)} mo`],
      [t`Spend this month`, money(card.monthSpendCents)],
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
    return (
      <Card size="sm" className="gap-1 py-2">
        <Header
          to={financePath.spend()}
          title={t`${card.count} transactions`}
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
