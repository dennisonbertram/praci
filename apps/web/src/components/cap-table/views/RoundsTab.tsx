import { t } from "@lingui/core/macro";
import type { EquityCashRaised, EquityFundingRound } from "@rakazo/contracts";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  enqueueNotificationToast,
  Label,
  Skeleton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableHeadRow,
  TableRow,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@rakazo/ui-web";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";
import { formatDay } from "../options/format";
import { CapTableEmptyState } from "../shell/CapTableEmptyState";
import { CashRaisedView } from "./CashRaisedView";
import { FinancingChart } from "./FinancingChart";
import { formatDollars, formatPrice, formatShares } from "./format";
import { RoundForm } from "./RoundForm";
import { RoundModelPanel } from "./RoundModelPanel";

/** Post-money: the typed-in value, else pre-money plus cash raised, else unknown. */
export function postMoneyCents(round: EquityFundingRound): string | null {
  if (round.overrides.postMoneyValuationCents) return round.overrides.postMoneyValuationCents;
  if (!round.preMoneyValuationCents) return null;
  return (BigInt(round.preMoneyValuationCents) + BigInt(round.cashRaisedCents)).toString();
}

/**
 * One bar per round, plus the money raised by securities in no round, so the chart's total is the
 * amount raised the overview shows.
 */
function withoutRound(rounds: EquityFundingRound[], totalCents: string | null) {
  const bars = rounds.map((round) => ({
    id: round.id,
    label: round.name,
    cents: round.cashRaisedCents,
  }));
  const inRounds = rounds.reduce((sum, round) => sum + BigInt(round.cashRaisedCents), 0n);
  const rest = totalCents == null ? 0n : BigInt(totalCents) - inRounds;
  return rest > 0n
    ? [...bars, { id: "no-round", label: t`No round`, cents: rest.toString() }]
    : bars;
}

/**
 * With grouping off, one bar per calendar year of issue: every security counts its cash, debt
 * canceled, IP transferred and other consideration, so the year totals still match cash raised.
 */
function byYear(securities: EquityCashRaised["securities"]) {
  const years = new Map<string, bigint>();
  for (const security of securities) {
    const year = security.issueDate.slice(0, 4);
    const cents =
      BigInt(security.cashPaidCents) +
      BigInt(security.debtCanceledCents) +
      BigInt(security.ipTransferredCents) +
      BigInt(security.otherConsiderationCents);
    years.set(year, (years.get(year) ?? 0n) + cents);
  }
  return [...years.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, cents]) => ({ id: `year-${year}`, label: year, cents: cents.toString() }));
}

const money = (cents: string | null) => (cents ? formatDollars(cents) : "—");

/** Financing history: the chart of cash raised and the funding rounds, with create and edit. */
export function RoundsTab() {
  const [rounds, setRounds] = useState<EquityFundingRound[] | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<EquityFundingRound | "new" | null>(null);
  const [reloadCount, setReloadCount] = useState(0);
  const [cashRaised, setCashRaised] = useState<EquityCashRaised | null>(null);
  const [grouped, setGrouped] = useState(true);
  // The sub-view is in the URL (?view=cash or ?view=model) so other tabs can link to it.
  const [params, setParams] = useSearchParams();
  const view = (
    ["cash", "model"].includes(params.get("view") ?? "") ? params.get("view") : "rounds"
  ) as "rounds" | "cash" | "model";
  const setView = (next: "rounds" | "cash" | "model") =>
    setParams((current) => {
      const out = new URLSearchParams(current);
      if (next === "rounds") out.delete("view");
      else out.set("view", next);
      return out;
    });

  useEffect(() => {
    let live = true;
    setError("");
    rpc.equity.views
      .cashRaised({})
      .then((cash: EquityCashRaised) => {
        if (live) setCashRaised(cash);
      })
      .catch(() => undefined);
    rpc.equity.fundingRounds
      .list({ pageSize: 200, sort: { field: "startDate", dir: "asc" } })
      .then((page: { items: EquityFundingRound[] }) => {
        if (live) setRounds(page.items);
      })
      .catch((cause: unknown) => {
        if (live) setError(errorText(cause));
      });
    return () => {
      live = false;
    };
  }, [reloadCount]);

  const saved = (round: EquityFundingRound) => {
    setEditing(null);
    enqueueNotificationToast({ id: `round-${round.id}`, title: t`Saved ${round.name}` });
    setReloadCount((count) => count + 1);
  };

  if (error)
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-destructive">{error}</span>
        <Button variant="outline" size="sm" onClick={() => setReloadCount((count) => count + 1)}>
          {t`Try again`}
        </Button>
      </div>
    );
  if (rounds == null) return <Skeleton className="h-40 w-full" />;

  const newButton = (
    <Button size="sm" onClick={() => setEditing("new")}>
      {t`New round`}
    </Button>
  );
  return (
    <div className="flex flex-col gap-4">
      <Tabs value={view} onValueChange={(value) => setView(value as "rounds" | "cash" | "model")}>
        <TabsList>
          <TabsTrigger value="rounds">{t`Funding rounds`}</TabsTrigger>
          <TabsTrigger value="cash">{t`Cash raised`}</TabsTrigger>
          <TabsTrigger value="model">{t`Model a round`}</TabsTrigger>
        </TabsList>
      </Tabs>
      {view === "model" ? (
        <RoundModelPanel />
      ) : view === "cash" ? (
        <CashRaisedView rounds={rounds} onChanged={() => setReloadCount((count) => count + 1)} />
      ) : rounds.length === 0 ? (
        <CapTableEmptyState message={t`No rounds yet`} action={newButton} />
      ) : (
        <>
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <FinancingChart
                bars={
                  grouped
                    ? withoutRound(rounds, cashRaised?.totalCents ?? null)
                    : byYear(cashRaised?.securities ?? [])
                }
              />
            </div>
            {newButton}
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="round-grouping"
              size="sm"
              checked={grouped}
              onCheckedChange={(checked) => setGrouped(checked)}
            />
            <Label htmlFor="round-grouping" className="text-sm font-normal">
              {t`Group by round`}
            </Label>
          </div>
          {/* Nine columns of figures: they size to their content and scroll on narrow screens. */}
          <div className="overflow-x-auto">
            <Table compact className="whitespace-nowrap">
              <TableHeader>
                <TableHeadRow>
                  <TableHead>{t`Round`}</TableHead>
                  <TableHead>{t`Start date`}</TableHead>
                  <TableHead>{t`Closing date`}</TableHead>
                  <TableHead className="text-end">{t`Original issue price`}</TableHead>
                  <TableHead className="text-end">{t`Pre-money`}</TableHead>
                  <TableHead className="text-end">{t`Cash raised`}</TableHead>
                  <TableHead className="text-end">{t`Shares issued`}</TableHead>
                  <TableHead className="text-end">{t`Post-money`}</TableHead>
                  <TableHead className="text-end">{t`Securities`}</TableHead>
                  <TableHead>
                    <span className="sr-only">{t`Actions`}</span>
                  </TableHead>
                </TableHeadRow>
              </TableHeader>
              <TableBody aria-label={t`Funding rounds`}>
                {[...rounds].reverse().map((round) => (
                  <TableRow key={round.id}>
                    <TableCell className="font-medium">{round.name}</TableCell>
                    <TableCell>{formatDay(round.startDate)}</TableCell>
                    <TableCell>{round.closingDate ? formatDay(round.closingDate) : "—"}</TableCell>
                    <TableCell className="text-end tabular-nums">
                      {round.originalIssuePrice ? formatPrice(round.originalIssuePrice) : "—"}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {money(round.preMoneyValuationCents)}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {formatDollars(round.cashRaisedCents)}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {formatShares(round.sharesIssued)}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {money(postMoneyCents(round))}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">{round.securityCount}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => setEditing(round)}>
                        {t`Edit`}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
      <Dialog open={editing != null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing === "new" || editing == null ? t`New round` : editing.name}
            </DialogTitle>
          </DialogHeader>
          {editing != null ? (
            <RoundForm
              round={editing === "new" ? undefined : editing}
              onSaved={saved}
              onCancel={() => setEditing(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
