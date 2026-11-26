import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { BrexCardsOverview } from "@rakazo/contracts";
import { Link } from "react-router-dom";
import { money } from "../../lib/finance-format";
import { useHideAmounts } from "../../lib/hide-amounts-preference";
import { Sparkline } from "../finance/Sparkline";
import { Kpi, Section } from "../finance/ui";
import { limitBarClass } from "./brex-utils";
import { SpendSankey } from "./SpendSankey";

function changeText(changePercent: number | null) {
  if (changePercent === null) return t`No comparison`;
  const sign = changePercent > 0 ? "+" : changePercent < 0 ? "−" : "";
  return `${sign}${Math.abs(changePercent).toFixed(1)}%`;
}

function TopVendors({
  vendors,
  totalCents,
}: {
  vendors: BrexCardsOverview["topVendors"];
  totalCents: number;
}) {
  const amountsHidden = useHideAmounts();
  const visible = vendors.filter((vendor) => vendor.cents > 0).slice(0, 5);
  if (visible.length === 0) {
    return (
      <p className="py-4 text-sm text-muted-foreground">
        <Trans>No card spend yet.</Trans>
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2.5">
      {visible.map((vendor) => {
        const share = totalCents > 0 ? (vendor.cents / totalCents) * 100 : 0;
        return (
          <li
            key={vendor.merchant}
            className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-sm"
          >
            <span className="truncate">{vendor.merchant}</span>
            <span className="tabular-nums text-muted-foreground">{money(vendor.cents)}</span>
            <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <span
                className="block h-full rounded-full bg-foreground/70"
                style={{ width: `${amountsHidden ? 0 : share}%` }}
              />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function NearLimit({ items }: { items: BrexCardsOverview["nearLimit"]["items"] }) {
  const amountsHidden = useHideAmounts();
  if (items.length === 0) {
    return (
      <p className="py-4 text-sm text-muted-foreground">
        <Trans>Nothing near a limit.</Trans>
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2.5">
      {items.slice(0, 5).map((item) => (
        <li key={`${item.kind}-${item.id}`}>
          <Link
            to={
              item.kind === "spend_limit"
                ? `/app/brex/limits?q=${encodeURIComponent(item.name)}`
                : "/app/brex/cards"
            }
            className="-mx-1.5 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 rounded-md px-1.5 py-1 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-foreground"
          >
            <span className="truncate">{item.name}</span>
            <span className="tabular-nums text-muted-foreground">
              {amountsHidden ? "" : `${Math.round(item.percent)}%`}
            </span>
            <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <span
                className={`block h-full rounded-full ${limitBarClass(item.percent)}`}
                style={{
                  width: `${amountsHidden ? 0 : Math.min(100, Math.max(0, item.percent))}%`,
                }}
              />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function BrexOverview({ data }: { data: BrexCardsOverview }) {
  const amountsHidden = useHideAmounts();
  const spend = data.cardSpend;
  return (
    <div className="flex flex-col gap-3">
      {data.partial ? (
        <p className="text-xs text-muted-foreground">
          <Trans>Partial results</Trans>
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          title={<Trans>Cash</Trans>}
          to="/app/brex/accounts"
          value={money(data.cash.totalCents)}
          sub={<Trans>{money(data.cash.availableCents)} available</Trans>}
        />
        <Kpi
          title={<Trans>Card spend</Trans>}
          to="/app/brex/spending"
          value={money(spend.monthToDateCents)}
          sub={
            <span className="flex items-center gap-1.5">
              <Sparkline
                values={spend.sparkline.map((point) => point.cents)}
                label={t`Card spend trend`}
                neutral
              />
              {amountsHidden ? null : (
                <Trans>{changeText(spend.changePercent)} vs last month</Trans>
              )}
            </span>
          }
        />
        <Kpi
          title={<Trans>Active cards</Trans>}
          to="/app/brex/cards"
          value={data.cards.active}
          sub={
            <Trans>
              {data.cards.locked} locked · {data.cards.terminated} terminated
            </Trans>
          }
        />
        <Kpi
          title={<Trans>Near limit</Trans>}
          to="/app/brex/limits"
          value={data.nearLimit.count}
          sub={<Trans>Over 80% of the limit</Trans>}
          alert={data.nearLimit.count > 0}
        />
      </div>
      <Section title={<Trans>Where spend goes, last 90 days</Trans>}>
        <SpendSankey data={data.sankey} />
      </Section>
      <div className="grid gap-3 lg:grid-cols-2">
        <Section title={<Trans>Top vendors</Trans>}>
          <TopVendors vendors={data.topVendors} totalCents={data.sankey.totalCents} />
        </Section>
        <Section title={<Trans>Near limit</Trans>}>
          <NearLimit items={data.nearLimit.items} />
        </Section>
      </div>
    </div>
  );
}
