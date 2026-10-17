import { plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type {
  FinanceOverview,
  FinanceProvider,
  FinanceSource,
  SpendPeriod,
  UpcomingItem,
} from "@rakazo/contracts";
import {
  Button,
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@rakazo/ui-web";
import { cn } from "@rakazo/ui-web/lib/utils";
import { ChevronRight, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { AddAccountDialog, type CryptoChoice } from "../components/finance/AddAccountDialog";
import { type BarGranularity, BurnBars, Sparkline } from "../components/finance/charts";
import { StatementReminderBanner } from "../components/finance/StatementReminderBanner";
import {
  AskAgentButton,
  BackHere,
  BreakdownRows,
  BurnLegend,
  Chevron,
  cashSubtitle,
  ErrorNotice,
  FinanceChromeProvider,
  HereLink,
  Kpi,
  Kv,
  KvRow,
  PeriodTabs,
  rowClass,
  Section,
  SpaceName,
  Th,
  useFinanceQuery,
  useRowNavigate,
} from "../components/finance/ui";
import { WalletDialog } from "../components/finance/WalletDialog";
import { AppLogo } from "../components/integrations/AppLogo";
import { ExchangeConnectDialog } from "../components/integrations/ExchangeConnectDialog";
import {
  changeText,
  dayRange,
  fullDay,
  lastDayOf,
  money,
  moneyExact,
  monthFull,
  paidWithLabel,
  shortDay,
} from "../lib/finance-format";
import { financePath, parseFinanceRoute } from "../lib/finance-route";
import { FINANCE_PROVIDERS } from "../lib/integrations";
import { formatRelativeTime } from "../lib/relative-time";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";
import { FinanceAccountPage, FinanceAccountsPage } from "./finance/FinanceAccounts";
import { FinanceBurnPage, FinanceMonthPage, FinanceRunwayPage } from "./finance/FinanceBurn";
import { FinanceCryptoPage } from "./finance/FinanceCrypto";
import { FinanceNotFound } from "./finance/FinanceNotFound";
import {
  FinanceCategoryPage,
  FinanceRecurringPage,
  FinanceSpendPage,
  FinanceVendorPage,
} from "./finance/FinanceSpend";
import { FinanceReceiptPage, FinanceTransactionPage } from "./finance/FinanceTransaction";

const providerName = (provider: FinanceProvider) => (provider === "brex" ? "Brex" : "Mercury");

/** Connecting and reconnecting happen on the Integrations page. */
const CONNECT_PATH = "/app/integrations?category=finance";

/** The most rows a Breakdown or Upcoming card shows before "Show all". */
const MAX_ROWS = 7;
const MIN_ROWS = 5;
/** The Burn chart's bucket size for each period. */
const BAR_GRANULARITY: Record<SpendPeriod, BarGranularity> = {
  week: "day",
  month: "day",
  quarter: "week",
  year: "month",
};

/** The Finance area: the dashboard at /app/finance and its detail pages. */
export function FinancePage({
  onAskAgent,
  spaceName,
}: {
  onAskAgent?: () => void;
  /** The space's name, given when the user has more than one space. */
  spaceName?: string;
}) {
  const location = useLocation();
  const route = parseFinanceRoute(location.pathname, location.search);
  return (
    <FinanceChromeProvider value={{ onAskAgent, spaceName }}>
      <div className="@container rk-scroll flex-1 overflow-y-auto px-4 pb-6 pt-2 md:px-7 md:pt-5">
        {route.page === "dashboard" ? (
          <Dashboard />
        ) : route.page === "accounts" ? (
          <FinanceAccountsPage source={route.source} unknownSource={route.unknownSource} />
        ) : route.page === "account" ? (
          <FinanceAccountPage id={route.id} />
        ) : route.page === "burn" ? (
          <FinanceBurnPage />
        ) : route.page === "month" ? (
          <FinanceMonthPage month={route.month} />
        ) : route.page === "runway" ? (
          <FinanceRunwayPage />
        ) : route.page === "crypto" ? (
          <FinanceCryptoPage />
        ) : route.page === "spend" ? (
          <FinanceSpendPage period={route.period} category={route.category} range={route.range} />
        ) : route.page === "category" ? (
          <FinanceCategoryPage slug={route.slug} />
        ) : route.page === "recurring" ? (
          <FinanceRecurringPage keyName={route.key} />
        ) : route.page === "vendor" ? (
          <FinanceVendorPage keyName={route.key} />
        ) : route.page === "transaction" ? (
          <FinanceTransactionPage id={route.id} />
        ) : route.page === "receipt" ? (
          <FinanceReceiptPage id={route.id} />
        ) : (
          <FinanceNotFound />
        )}
      </div>
    </FinanceChromeProvider>
  );
}

const REFRESH_HOLD_MS = 800;

function Dashboard() {
  const overview = useFinanceQuery(() => rpc.finance.overview(), []);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const reload = useRef(overview.reload);
  reload.current = overview.reload;

  // Sync reads the vendors (throttled by the server), then the dashboard reads the stored result.
  // A click holds "Syncing…" briefly: a throttled refresh answers at once and would show no change.
  const sync = (holdMs = 0) => {
    setSyncing(true);
    setSyncError("");
    const hold = new Promise((resolve) => setTimeout(resolve, holdMs));
    rpc.finance
      .refresh()
      .then(() => hold)
      .catch((cause) => setSyncError(errorText(cause)))
      .finally(() => {
        setSyncing(false);
        reload.current();
      });
  };

  const connected = overview.data?.sources.some((s) => s.status !== "not_connected") ?? false;
  const synced = useRef(false);
  // Runs once, when the first overview shows a connected source.
  useEffect(() => {
    if (!connected || synced.current) return;
    synced.current = true;
    sync();
  }, [connected]);

  const data = overview.data;
  if (overview.error) return <ErrorNotice message={overview.error} onRetry={overview.retry} />;
  if (!data) return <DashboardSkeleton />;
  // Accounts fed by uploaded statements have no source to connect, but they are data.
  if (!connected && !data.hasCashAccounts)
    return <EmptyState hasCrypto={Boolean(data.crypto)} onChanged={overview.reload} />;
  return (
    <Overview
      data={data}
      syncing={syncing}
      error={syncError}
      onRefresh={() => sync(REFRESH_HOLD_MS)}
      onReload={overview.reload}
    />
  );
}

function EmptyState({ hasCrypto, onChanged }: { hasCrypto: boolean; onChanged: () => void }) {
  const [adding, setAdding] = useState(false);
  const [crypto, setCrypto] = useState<CryptoChoice | null>(null);
  return (
    <div className="flex h-full min-h-72 flex-col items-center justify-center gap-4 text-center">
      <div className="flex gap-3">
        {FINANCE_PROVIDERS.map(({ provider, name, logo }) => (
          <AppLogo key={provider} name={name} logo={logo} size="lg" />
        ))}
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <h1 className="text-lg font-medium">
          <Trans>Finance</Trans>
        </h1>
        <SpaceName />
      </div>
      <p className="max-w-sm text-sm text-muted-foreground">
        <Trans>Add an account to see cash, burn, runway and spend.</Trans>
      </p>
      <Button onClick={() => setAdding(true)}>
        <Trans>Add account</Trans>
      </Button>
      {hasCrypto ? (
        <Button variant="outline" render={<Link to={financePath.accounts()} />}>
          <Trans>Accounts</Trans>
        </Button>
      ) : null}
      {adding ? (
        <AddAccountDialog
          onPickCrypto={setCrypto}
          onImported={onChanged}
          onClose={() => setAdding(false)}
        />
      ) : null}
      <WalletDialog
        open={crypto === "wallet"}
        onClose={() => setCrypto(null)}
        onSaved={onChanged}
      />
      {crypto && crypto !== "wallet" ? (
        <ExchangeConnectDialog
          provider={crypto}
          onConnected={onChanged}
          onClose={() => setCrypto(null)}
        />
      ) : null}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-3">
      <Skeleton className="h-7 w-32" />
      <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-4">
        {[0, 1, 2, 3].map((n) => (
          <Skeleton key={n} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-56" />
      <Skeleton className="h-40" />
    </div>
  );
}

function SourceChip({ source }: { source: FinanceSource }) {
  const name = providerName(source.provider);
  const chip =
    "inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-foreground hover:text-foreground";
  const dot =
    source.status === "ok"
      ? "bg-success"
      : source.status === "error"
        ? "bg-destructive"
        : "bg-warning";
  const dotEl = <span aria-hidden="true" className={`size-1.5 rounded-full ${dot}`} />;
  return source.status === "needs_reconnect" ? (
    <Link to={CONNECT_PATH} className={chip} aria-label={t`Reconnect ${name}`}>
      {dotEl}
      {name}
    </Link>
  ) : (
    <Link
      to={financePath.accounts(source.provider)}
      className={chip}
      aria-label={t`${name} accounts`}
    >
      {dotEl}
      {name}
    </Link>
  );
}

function Overview({
  data,
  syncing,
  error,
  onRefresh,
  onReload,
}: {
  data: FinanceOverview;
  syncing: boolean;
  error: string;
  onRefresh: () => void;
  onReload: () => void;
}) {
  const navigate = useNavigate();
  const { hash } = useLocation();
  // Back from a detail page lands on the card it was opened from, not the top of the page.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [hash]);
  const [uploading, setUploading] = useState(false);
  const [period, setPeriod] = useState<SpendPeriod>("month");
  // The Breakdown mode lives in the URL, so Back (in the app or the browser) reopens it as left.
  const [params, setParams] = useSearchParams();
  const by = params.get("by") === "vendor" ? "vendor" : "category";
  const setBy = (mode: "category" | "vendor") =>
    setParams(mode === "vendor" ? { by: mode } : {}, { replace: true });

  const [allBreakdown, setAllBreakdown] = useState(false);
  const [allUpcoming, setAllUpcoming] = useState(false);
  const totals = data.spendTotals[period];
  const change = changeText(totals.changePct);
  // Less spend than before is good news.
  const tone = (pct: number | null) => ((pct ?? 0) <= 0 ? "text-success" : "text-destructive");
  const burning = data.burn.monthlyCents > 0;
  // Without a cash balance (Brex only, or no cash accounts) there is nothing to run out of.
  const hasCash = data.hasCashAccounts;
  const missing = data.sources.filter((source) => source.status === "not_connected");
  const onlyOne = missing.length === 1 && data.sources.length > 1 ? missing[0] : undefined;
  // The breakdown follows the period tabs; an older payload only has the last 90 days.
  const periodBreakdown = data.breakdownByPeriod?.[period];
  const breakdownRows = (periodBreakdown ?? data.breakdown)[by];
  const rowCap = Math.max(MIN_ROWS, Math.min(MAX_ROWS, breakdownRows.length));
  const upcomingRows = [...data.upcoming.items].sort((a, b) =>
    (a.dates[0] ?? "").localeCompare(b.dates[0] ?? ""),
  );
  const runwayMonths = data.runway.months?.toFixed(1);
  const stablecoins = data.cash.stablecoinCents ?? 0;
  const otherCounted = data.cash.otherCryptoCents ?? 0;
  const bankCash = data.cash.bankCashCents ?? data.cash.cashCents - stablecoins - otherCounted;
  const heldStablecoins = data.crypto?.stablecoinCents ?? 0;
  const heldTotal = data.crypto?.totalCents ?? 0;
  const bankRunwayMonths = data.bankRunway?.months?.toFixed(1);
  const runOutMonth = data.runway.runOutDate ? monthFull(data.runway.runOutDate.slice(0, 7)) : "";
  const range = (r: { start: string; end: string }) => dayRange(r.start, lastDayOf(r.end));
  const spentRange = range(totals);
  const previousRange = range({ start: totals.previousStart, end: totals.previousEnd });
  const bars = data.cashSeries[period];
  const barGranularity = BAR_GRANULARITY[period];
  const subs = data.subscriptions;
  const monthlyTotal = money(subs.totalMonthlyCents);
  const yieldAmount = data.treasuryYieldLastMonth
    ? money(data.treasuryYieldLastMonth.netCents)
    : "";
  const showSkeleton = syncing && data.lastSyncedAt === null;
  const updated = data.lastSyncedAt ? formatRelativeTime(data.lastSyncedAt) : "";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-medium">
          <Trans>Finance</Trans>
        </h1>
        <SpaceName />
        <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
          {/* Both labels share one cell, so the chips beside them do not move when it changes. */}
          <span className="grid">
            <span
              aria-hidden={!syncing}
              className={cn("col-start-1 row-start-1", syncing ? "" : "invisible")}
            >
              <Trans>Syncing…</Trans>
            </span>
            {updated ? (
              <span
                aria-hidden={syncing}
                className={cn("col-start-1 row-start-1", syncing ? "invisible" : "")}
              >
                <Trans>Updated {updated}</Trans>
              </span>
            ) : null}
          </span>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t`Refresh`}
                  disabled={syncing}
                  // Keeps keyboard focus on the button while it syncs instead of dropping it.
                  focusableWhenDisabled
                  onClick={onRefresh}
                />
              }
            >
              <RefreshCw aria-hidden="true" className={syncing ? "animate-spin" : undefined} />
            </TooltipTrigger>
            <TooltipContent>
              <Trans>Refresh</Trans>
            </TooltipContent>
          </Tooltip>
        </span>
        {data.excludedNonUsdCount > 0 ? (
          <span className="text-[11px] text-muted-foreground">
            {t`${data.excludedNonUsdCount} non-USD not counted`}
          </span>
        ) : null}
        <div className="flex gap-1">
          {data.sources
            .filter((source) => source.status !== "not_connected")
            .map((source) => (
              <SourceChip key={source.provider} source={source} />
            ))}
        </div>
        {onlyOne ? (
          <Link
            to={CONNECT_PATH}
            className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
          >
            {t`Add ${providerName(onlyOne.provider)}`}
          </Link>
        ) : null}
        <div className="ms-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="lg"
            className="h-10 rounded-[10px] px-4 text-sm"
            render={<Link to={financePath.accounts()} />}
          >
            <Trans>Accounts</Trans>
          </Button>
          <AskAgentButton />
        </div>
      </div>
      <StatementReminderBanner
        reminders={data.statementReminders ?? []}
        onUpload={() => setUploading(true)}
      />
      {uploading ? (
        <AddAccountDialog
          initialStep="bank"
          onImported={onReload}
          onClose={() => setUploading(false)}
        />
      ) : null}
      {error ? <ErrorNotice message={error} onRetry={onRefresh} /> : null}
      {showSkeleton ? (
        <DashboardSkeleton />
      ) : (
        <div className="flex flex-col gap-3">
          <div
            // Two per row when narrow; an odd last card takes the whole row instead of sitting alone.
            className={`grid grid-cols-2 gap-3 [&>:last-child:nth-child(odd)]:col-span-2 @3xl:[&>:last-child:nth-child(odd)]:col-span-1 ${
              hasCash ? (data.crypto ? "@3xl:grid-cols-4" : "@3xl:grid-cols-3") : "@3xl:grid-cols-2"
            }`}
          >
            {hasCash ? (
              <Kpi
                title={t`Cash`}
                value={money(data.cash.cashCents)}
                sub={cashSubtitle(
                  data.cash.cashAccountCount,
                  otherCounted > 0 ? "all" : stablecoins > 0 ? "stablecoins" : "none",
                )}
                to={financePath.accounts()}
                hover={
                  data.crypto ? (
                    <>
                      <HoverRow label={t`Bank`} value={money(bankCash)} />
                      <HoverRow label={t`Stablecoins`} value={money(heldStablecoins)} />
                      <HoverRow
                        label={t`Other crypto`}
                        value={money(heldTotal - heldStablecoins)}
                      />
                      <HoverRow label={t`Total incl. crypto`} value={money(bankCash + heldTotal)} />
                    </>
                  ) : undefined
                }
              />
            ) : null}
            <Kpi
              title={t`Monthly burn`}
              value={burning ? money(data.burn.monthlyCents) : "—"}
              sub={t`3-mo avg, after revenue`}
              to={financePath.burn()}
            />
            {hasCash ? (
              <Kpi
                title={t`Runway`}
                value={runwayMonths === undefined ? "—" : t`${runwayMonths} mo`}
                sub={runOutMonth ? t`Until ${runOutMonth}` : undefined}
                to={financePath.runway()}
                hover={
                  stablecoins + otherCounted > 0 && bankRunwayMonths !== undefined ? (
                    <span>{t`Bank only: ${bankRunwayMonths} mo`}</span>
                  ) : undefined
                }
              />
            ) : null}
            {data.crypto ? (
              <Kpi
                title={t`Crypto`}
                value={money(data.crypto.totalCents)}
                sub={cryptoSubtitle(
                  otherCounted > 0 ? "all" : stablecoins > 0 ? "stablecoins" : "bank",
                  data.crypto.unpricedTokenCount,
                )}
                to={financePath.crypto()}
              />
            ) : null}
          </div>

          <Section className="@container/strip">
            <div className="flex flex-wrap items-center gap-3.5">
              <PeriodTabs value={period} onChange={setPeriod} />
              <Link
                to={financePath.spend(period)}
                className="text-lg font-semibold tabular-nums hover:underline"
              >
                {money(totals.currentCents)}
              </Link>
              <span className="text-[11px] text-muted-foreground">
                {t`Spent ${spentRange}`}
                {totals.previousCents === null ? null : (
                  <>
                    {" · "}
                    {change ? <span className={tone(totals.changePct)}>{change} </span> : null}
                    {t`vs ${previousRange}`}
                  </>
                )}
              </span>
            </div>
          </Section>

          <Section
            title={
              <Link to={financePath.burn()} className="inline-flex items-center hover:underline">
                <Trans>Burn</Trans>
                <ChevronRight aria-hidden="true" className="size-3" />
              </Link>
            }
            action={<BurnLegend />}
          >
            <BurnBars
              series={bars}
              granularity={barGranularity}
              label={t`Cash out and cash in over time`}
              onOpen={(p) =>
                navigate(
                  barGranularity === "month"
                    ? financePath.month(p.start.slice(0, 7))
                    : financePath.spend(period, null, { from: p.start, to: p.end }),
                )
              }
            />
            {bars.at(-1)?.partial ? (
              <div className="text-[11px] text-muted-foreground">
                <Trans>* So far</Trans>
              </div>
            ) : null}
          </Section>

          {/* Each card keeps its own height: expanding one does not stretch the other. */}
          <div className="grid items-start gap-3 @3xl:grid-cols-2">
            <BackHere
              value={{
                label: t`Breakdown`,
                to: `${financePath.dashboard()}${by === "vendor" ? "?by=vendor" : ""}#breakdown`,
              }}
            >
              <Section
                id="breakdown"
                title={<Trans>Breakdown</Trans>}
                action={
                  <div className="flex gap-1">
                    {(["category", "vendor"] as const).map((mode) => (
                      <Button
                        key={mode}
                        size="xs"
                        variant={by === mode ? "default" : "outline"}
                        className="rounded-full"
                        aria-pressed={by === mode}
                        onClick={() => setBy(mode)}
                      >
                        {mode === "category" ? <Trans>Category</Trans> : <Trans>Vendor</Trans>}
                      </Button>
                    ))}
                  </div>
                }
              >
                <BreakdownRows
                  rows={allBreakdown ? breakdownRows : breakdownRows.slice(0, rowCap)}
                  to={(row) =>
                    by === "category" ? financePath.category(row.key) : financePath.vendor(row.key)
                  }
                />
                {breakdownRows.every((row) => row.cents <= 0) ? (
                  <div className="py-2 text-muted-foreground">
                    <Trans>No spend in this period</Trans>
                  </div>
                ) : null}
                <div className="mt-auto flex items-center justify-between text-[11px] text-muted-foreground">
                  {periodBreakdown ? spentRange : <Trans>Last 90 days</Trans>}
                  <ShowAll
                    total={breakdownRows.length}
                    cap={rowCap}
                    expanded={allBreakdown}
                    onToggle={() => setAllBreakdown((v) => !v)}
                  />
                </div>
              </Section>
            </BackHere>

            <BackHere value={{ label: t`Upcoming`, to: `${financePath.dashboard()}#upcoming` }}>
              <Section
                id="upcoming"
                title={<Trans>Upcoming · 30 days</Trans>}
                action={
                  <span className="text-xs font-semibold tabular-nums">
                    ~{money(data.upcoming.totalCents)}
                  </span>
                }
              >
                <div className="-mx-2">
                  {(allUpcoming ? upcomingRows : upcomingRows.slice(0, rowCap)).map((item) => (
                    <UpcomingRow key={`${item.kind}:${item.key}`} item={item} />
                  ))}
                </div>
                <div className="mt-auto flex justify-end text-[11px] text-muted-foreground">
                  <ShowAll
                    total={upcomingRows.length}
                    cap={rowCap}
                    expanded={allUpcoming}
                    onToggle={() => setAllUpcoming((v) => !v)}
                  />
                </div>
              </Section>
            </BackHere>
          </div>

          <BackHere
            value={{ label: t`Subscriptions`, to: `${financePath.dashboard()}#subscriptions` }}
          >
            <Section id="subscriptions" title={<Trans>Subscriptions</Trans>}>
              <SubscriptionsTable subs={subs} />
              <div className="border-t border-border pt-2 text-xs text-muted-foreground">
                {plural(subs.items.length, { one: "# subscription", other: "# subscriptions" })} ·{" "}
                {t`${monthlyTotal}/mo`}
              </div>
            </Section>
          </BackHere>

          {data.treasuryYieldLastMonth ? (
            <Link
              to={financePath.accounts()}
              className="w-fit rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-foreground"
            >
              <Section title={<Trans>Treasury yield</Trans>} className="hover:ring-foreground/30">
                <div className="text-lg font-semibold tabular-nums">
                  {t`${yieldAmount} last month`}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  <Trans>after fees</Trans>
                </div>
              </Section>
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}

/** What the Crypto figure means for runway, as the Cash card says what it adds up. */
export function cryptoSubtitle(counted: "bank" | "stablecoins" | "all", unpriced: number): string {
  const scope =
    counted === "all"
      ? t`Counted in runway`
      : counted === "stablecoins"
        ? t`Stablecoins in runway`
        : t`Not in runway`;
  return unpriced > 0 ? t`${scope} · ${unpriced} unpriced` : scope;
}

function ShowAll({
  total,
  cap,
  expanded,
  onToggle,
}: {
  total: number;
  cap: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  if (total <= cap) return null;
  return (
    <button type="button" className="hover:text-foreground hover:underline" onClick={onToggle}>
      {expanded ? <Trans>Show less</Trans> : <Trans>Show all {total}</Trans>}
    </button>
  );
}

function HoverRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 tabular-nums">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

const upcomingTag = (kind: UpcomingItem["kind"]) =>
  kind === "recurring" ? t`recurring` : kind === "pending" ? t`pending` : t`bill`;

/** `APPROVED` reads `Approved`. */
const billStatusText = (status: string) =>
  status.charAt(0).toUpperCase() + status.slice(1).toLowerCase().replaceAll("_", " ");

const upcomingRowClass =
  "grid w-full grid-cols-[minmax(0,1fr)_auto_0.875rem] items-center gap-2.5 border-t border-border px-2 py-2 text-start first:border-t-0 @md:grid-cols-[minmax(5rem,auto)_1fr_auto_0.875rem]";
const upcomingLinkClass = `${upcomingRowClass} outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-foreground`;

export function UpcomingRow({ item }: { item: UpcomingItem }) {
  const to =
    item.kind === "recurring"
      ? financePath.recurring(item.key)
      : item.kind === "pending"
        ? financePath.transaction(item.key)
        : null;
  const dates = item.dates.map((d) => shortDay(d)).join(" · ");
  const body = (
    <>
      <span className="hidden text-muted-foreground @md:inline">{dates}</span>
      {/* Narrow, the name gets the whole first line; the dates and tag sit under it. */}
      <span className="flex min-w-0 flex-col items-start gap-0.5 @md:flex-row @md:items-center @md:gap-1.5">
        <span className="min-w-0 max-w-full truncate">{item.name}</span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="@md:hidden">{dates}</span>
          <span className="shrink-0 rounded-full border border-border px-1.5 text-[10px]">
            {upcomingTag(item.kind)}
          </span>
        </span>
      </span>
      <span className="text-end tabular-nums">
        {money(item.amountCents)}
        {item.dates.length > 1 ? ` ×${item.dates.length}` : ""}
      </span>
      <ChevronRight aria-hidden="true" className="size-3.5 text-muted-foreground" />
    </>
  );
  if (to) {
    return (
      <HereLink to={to} className={upcomingLinkClass}>
        {body}
      </HereLink>
    );
  }
  // A bill has no page of its own: its details open in place.
  const due = item.dueAt ?? item.dates[0] ?? "";
  const overdue = item.dates[0] !== undefined && due < item.dates[0];
  return (
    <Popover>
      <PopoverTrigger className={upcomingLinkClass}>{body}</PopoverTrigger>
      <PopoverContent align="end">
        <PopoverHeader>
          <PopoverTitle>{item.name}</PopoverTitle>
          <PopoverDescription>
            <Trans>Brex bill, not paid yet</Trans>
          </PopoverDescription>
        </PopoverHeader>
        <Kv>
          <KvRow label={t`Amount`}>{moneyExact(item.amountCents)}</KvRow>
          <KvRow label={t`Due`}>{overdue ? t`${fullDay(due)} (overdue)` : fullDay(due)}</KvRow>
          {item.billStatus ? (
            <KvRow label={t`Status`}>{billStatusText(item.billStatus)}</KvRow>
          ) : null}
        </Kv>
      </PopoverContent>
    </Popover>
  );
}

function SubscriptionsTable({ subs }: { subs: FinanceOverview["subscriptions"] }) {
  const rowProps = useRowNavigate();
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <Th>
            <Trans>Vendor</Trans>
          </Th>
          <Th right>
            <Trans>Monthly</Trans>
          </Th>
          <Th right className="hidden @md:table-cell">
            <Trans>3 mo</Trans>
          </Th>
          <Th right className="hidden @md:table-cell">
            <Trans>Last charge</Trans>
          </Th>
          <Th />
        </tr>
      </thead>
      <tbody>
        {subs.items.map((sub) => {
          const paidWith = paidWithLabel(sub.paidWith);
          const name = sub.name;
          return (
            <tr key={sub.key} className={rowClass} {...rowProps(financePath.vendor(sub.key))}>
              <td className="font-semibold">
                <HereLink
                  to={financePath.vendor(sub.key)}
                  aria-label={paidWith ? t`${name}, paid with ${paidWith}` : name}
                  className="outline-none hover:underline focus-visible:underline"
                >
                  {sub.name}
                </HereLink>
                {sub.overlapGroup ? (
                  <span className="ms-1.5 rounded-full border border-border px-1.5 text-[10px] font-normal text-muted-foreground">
                    <Trans>overlaps</Trans>
                  </span>
                ) : null}
                {paidWith ? (
                  <span
                    role="tooltip"
                    className="pointer-events-none invisible ms-2.5 hidden whitespace-nowrap rounded-full bg-primary px-2.5 py-0.5 align-middle text-[11px] font-normal leading-4 text-primary-foreground group-focus-within/row:visible group-hover/row:visible @md:inline-block"
                  >
                    {paidWith}
                  </span>
                ) : null}
              </td>
              <td className="text-end tabular-nums">{money(sub.monthlyCents)}</td>
              <td className="hidden w-[90px] @md:table-cell">
                <Sparkline values={sub.trendCents} label={t`Last 3 months`} />
              </td>
              <td className="hidden whitespace-nowrap text-end text-muted-foreground @md:table-cell">
                {shortDay(sub.lastChargeAt)}
              </td>
              <Chevron />
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
