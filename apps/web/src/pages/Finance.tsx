import { plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { FinanceOverview, FinanceProvider, SpendPeriod } from "@rakazo/contracts";
import { SpendPeriodSchema } from "@rakazo/contracts";
import { Button, Skeleton, Tooltip, TooltipContent, TooltipTrigger } from "@rakazo/ui-web";
import { ChevronRight, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { SeeAll, useCappedRows } from "../components/CappedList";
import type { CryptoChoice } from "../components/finance/AddAccountDialog";
import { AddAccountDialog } from "../components/finance/AddAccountDialog";
import type { BarGranularity } from "../components/finance/charts";
import { BurnLines } from "../components/finance/charts";
import { NonUsdNotice } from "../components/finance/NonUsdNotice";
import { StatementReminderBanner } from "../components/finance/StatementReminderBanner";
import { SubscriptionsTable, UpcomingRow } from "../components/finance/UpcomingSubscriptions";
import type { FinanceChrome } from "../components/finance/ui";
import {
  AskAgentButton,
  BackHere,
  BreakdownRows,
  BurnLegend,
  CompanyMenu,
  cashSubtitle,
  ErrorNotice,
  FinanceChromeProvider,
  Kpi,
  PeriodTabs,
  Section,
  toneClass,
  useFinanceQuery,
} from "../components/finance/ui";
import { WalletDialog } from "../components/finance/WalletDialog";
import { AppLogo } from "../components/integrations/AppLogo";
import { ExchangeConnectDialog } from "../components/integrations/ExchangeConnectDialog";
import { PageEmptyState } from "../components/PageEmptyState";
import { PageHeader } from "../components/PageHeader";
import { StillLoading } from "../components/ShellSkeleton";
import {
  changeText,
  dayRange,
  lastDayOf,
  money,
  monthFull,
  runwayText,
} from "../lib/finance-format";
import { financePath, parseFinanceRoute } from "../lib/finance-route";
import { useHideAmounts } from "../lib/hide-amounts-preference";
import { FINANCE_PROVIDERS } from "../lib/integrations";
import { formatRelativeTime } from "../lib/relative-time";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";
import { FinanceAccountPage, FinanceAccountsPage } from "./finance/FinanceAccounts";
import { FinanceBurnPage, FinanceMonthPage, FinanceRunwayPage } from "./finance/FinanceBurn";
import { FinanceCryptoPage } from "./finance/FinanceCrypto";
import { FinanceSubscriptionsPage, FinanceUpcomingPage } from "./finance/FinanceLists";
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
/** The Burn chart's bucket size for each period. */
const BAR_GRANULARITY: Record<SpendPeriod, BarGranularity> = {
  week: "week",
  month: "month",
  quarter: "quarter",
  year: "year",
};

/** The Finance area: the dashboard at /app/finance and its detail pages. */
export function FinancePage(chrome: FinanceChrome) {
  const location = useLocation();
  const route = parseFinanceRoute(location.pathname, location.search);
  return (
    <FinanceChromeProvider value={chrome}>
      <div className="@container rk-scroll flex-1 overflow-y-auto px-4 pb-6 pt-2 md:px-7">
        <div className="mx-auto max-w-[1440px]">
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
          ) : route.page === "upcoming" ? (
            <FinanceUpcomingPage />
          ) : route.page === "subscriptions" ? (
            <FinanceSubscriptionsPage />
          ) : route.page === "spend" ? (
            <FinanceSpendPage
              period={route.period}
              category={route.category}
              range={route.range}
              source={route.source ?? null}
            />
          ) : route.page === "category" ? (
            <FinanceCategoryPage slug={route.slug} window={route.window} />
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
      </div>
    </FinanceChromeProvider>
  );
}

const REFRESH_HOLD_MS = 800;
// Matches STALE_MS in apps/api/src/finance.ts: older data is synced when the dashboard opens.
const FRESH_MS = 15 * 60_000;
const isStale = (iso: string | null | undefined) =>
  !iso || Date.now() - new Date(iso).getTime() > FRESH_MS;

function Dashboard() {
  const overview = useFinanceQuery(() => rpc.finance.overview(), []);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const reload = useRef(overview.reload);
  reload.current = overview.reload;

  // An explicit refresh is forced by the server; the overview queues its own throttled background
  // sync. This reads the vendors, then the dashboard reads the stored result.
  // A click holds "Syncing…" briefly: a quick refresh would otherwise flash no visible change.
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
  // Runs once, when the first overview shows a connected source, and only if the data is stale.
  useEffect(() => {
    if (!connected || synced.current || !overview.data) return;
    synced.current = true;
    const { lastSyncedAt, crypto } = overview.data;
    if (isStale(lastSyncedAt) || (crypto && isStale(crypto.lastSyncedAt))) sync();
  }, [connected]);

  // The add dialogs live here, above the empty and loaded states: the first import turns the empty
  // state into the dashboard, and the dialog must stay open on its results until Done.
  const [adding, setAdding] = useState<"type" | "bank" | null>(null);
  // From picking a bank until the overview that includes it arrives, the stale empty state would
  // read "No accounts yet" and invite a second connection.
  const [connecting, setConnecting] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new overview (or its error) ends the wait
  useEffect(() => setConnecting(false), [overview.data, overview.error]);
  const [crypto, setCrypto] = useState<CryptoChoice | null>(null);
  const dialogs = (
    <>
      {adding ? (
        <AddAccountDialog
          initialStep={adding}
          onPickCrypto={setCrypto}
          onImported={overview.reload}
          onConnected={() => {
            setConnecting(true);
            overview.reload();
          }}
          onClose={() => setAdding(null)}
        />
      ) : null}
      <WalletDialog
        open={crypto === "wallet"}
        onClose={() => setCrypto(null)}
        onSaved={overview.reload}
      />
      {crypto && crypto !== "wallet" ? (
        <ExchangeConnectDialog
          provider={crypto}
          onConnected={overview.reload}
          onClose={() => setCrypto(null)}
        />
      ) : null}
    </>
  );

  const data = overview.data;
  // A failed re-read keeps the dashboard and says so; only a first load has nothing else to show.
  if (overview.error && !data)
    return <ErrorNotice message={overview.error} onRetry={overview.retry} />;
  if (!data) return <DashboardSkeleton />;
  return (
    <>
      {/* Accounts fed by uploaded statements have no source to connect, but they are data. */}
      {!connected && !data.hasCashAccounts ? (
        connecting ? (
          <DashboardSkeleton connecting />
        ) : (
          <EmptyState
            cryptoCents={data.crypto?.totalCents ?? null}
            onAdd={() => setAdding("type")}
          />
        )
      ) : (
        <Overview
          data={data}
          syncing={syncing}
          error={syncError || (overview.error ? t`Could not refresh: ${overview.error}` : "")}
          onRefresh={() => sync(REFRESH_HOLD_MS)}
          onAdd={setAdding}
        />
      )}
      {dialogs}
    </>
  );
}

/** Nothing to chart yet. With only crypto added (a wallet, Coinbase or Kraken), it says so and where
 * that crypto is, rather than "No accounts yet". */
function EmptyState({ cryptoCents, onAdd }: { cryptoCents: number | null; onAdd: () => void }) {
  useHideAmounts();
  const hasCrypto = cryptoCents !== null;
  return (
    <div>
      {/* The page title stays where every page has it, with the empty state under it. */}
      <PageHeader
        title={<Trans>Finance</Trans>}
        meta={<CompanyMenu />}
        actions={<AskAgentButton />}
      />
      <PageEmptyState
        icon={FINANCE_PROVIDERS.map(({ provider, name, logo }) => (
          <AppLogo key={provider} name={name} logo={logo} size="lg" />
        ))}
        title={hasCrypto ? <Trans>No bank accounts yet</Trans> : <Trans>No accounts yet</Trans>}
        description={
          hasCrypto ? (
            <Trans>
              Your crypto ({money(cryptoCents)}) is in Accounts. Add a bank account to see cash,
              burn, runway and spend.
            </Trans>
          ) : (
            <Trans>Add an account to see cash, burn, runway and spend.</Trans>
          )
        }
      >
        <Button onClick={onAdd}>
          <Trans>Add account</Trans>
        </Button>
        {hasCrypto ? (
          <Button variant="outline" render={<Link to={financePath.accounts()} />}>
            <Trans>Accounts</Trans>
          </Button>
        ) : null}
      </PageEmptyState>
    </div>
  );
}

function DashboardSkeleton({ connecting = false }: { connecting?: boolean }) {
  return (
    <div aria-busy="true" className="flex flex-col gap-3">
      {connecting ? (
        <p role="status" className="text-sm text-muted-foreground">
          <Trans>Connecting…</Trans>
        </p>
      ) : null}
      <Skeleton className="h-7 w-32" />
      <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-4">
        {[0, 1, 2, 3].map((n) => (
          <Skeleton key={n} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-56" />
      <Skeleton className="h-40" />
      <StillLoading />
    </div>
  );
}

function Overview({
  data,
  syncing,
  error,
  onRefresh,
  onAdd,
}: {
  data: FinanceOverview;
  syncing: boolean;
  error: string;
  onRefresh: () => void;
  /** Opens Add account on its first step, or straight on the statement upload. */
  onAdd: (step: "type" | "bank") => void;
}) {
  useHideAmounts();
  const navigate = useNavigate();
  const { hash } = useLocation();
  // Back from a detail page lands on the card it was opened from, not the top of the page.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [hash]);
  // The period and the Breakdown mode live in the URL, so Back, reload and the browser history
  // reopen the dashboard as left.
  const [params, setParams] = useSearchParams();
  const parsedPeriod = SpendPeriodSchema.safeParse(params.get("period"));
  const period: SpendPeriod = parsedPeriod.success ? parsedPeriod.data : "month";
  const by = params.get("by") === "vendor" ? "vendor" : "category";
  const setQuery = (next: { period?: SpendPeriod; by?: "category" | "vendor" }) => {
    const merged = { period, by, ...next };
    setParams(
      {
        ...(merged.period === "month" ? {} : { period: merged.period }),
        ...(merged.by === "vendor" ? { by: "vendor" } : {}),
      },
      { replace: true },
    );
  };
  const setPeriod = (next: SpendPeriod) => setQuery({ period: next });
  const setBy = (mode: "category" | "vendor") => setQuery({ by: mode });

  const totals = data.spendTotals[period];
  // A period under a week old is a few days against a few days: too little to call a trend.
  const elapsedDays = (Date.parse(totals.end) - Date.parse(totals.start)) / 86_400_000;
  const change = changeText(totals.changePct);
  const burning = data.burn.monthlyCents > 0;
  // Without a cash balance (Brex only, or no cash accounts) there is nothing to run out of.
  const hasCash = data.hasCashAccounts;
  const missing = data.sources.filter((source) => source.status === "not_connected");
  const onlyOne = missing.length === 1 && data.sources.length > 1 ? missing[0] : undefined;
  // The breakdown follows the period tabs; an older payload only has the last 90 days.
  const periodBreakdown = data.breakdownByPeriod?.[period];
  const breakdownRows = (periodBreakdown ?? data.breakdown)[by];
  const upcomingRows = [...data.upcoming.items].sort((a, b) =>
    (a.dates[0] ?? "").localeCompare(b.dates[0] ?? ""),
  );
  const breakdownList = useCappedRows(breakdownRows, { desktop: MAX_ROWS });
  const upcomingList = useCappedRows(upcomingRows, { desktop: MAX_ROWS });
  const subsList = useCappedRows(data.subscriptions.items, { desktop: MAX_ROWS });
  const runwayMonths = runwayText(data.runway.months);
  const stablecoins = data.cash.stablecoinCents ?? 0;
  const otherCounted = data.cash.otherCryptoCents ?? 0;
  const bankCash = data.cash.bankCashCents ?? data.cash.cashCents - stablecoins - otherCounted;
  const heldStablecoins = data.crypto?.stablecoinCents ?? 0;
  const heldTotal = data.crypto?.totalCents ?? 0;
  const bankRunwayMonths = runwayText(data.bankRunway?.months);
  const runOutMonth = data.runway.runOutDate ? monthFull(data.runway.runOutDate.slice(0, 7)) : "";
  // The same figure on both sides says nothing, and nothing spent so far (a statement account has
  // no lines for this period yet) is not a 100% drop, so the comparison is left out.
  const sameAsBefore = (p: { currentCents: number; previousCents: number | null }) =>
    !p.previousCents || p.previousCents === p.currentCents || p.currentCents === 0;
  // Non-breaking spaces keep "Oct 1 – 22" together, so a narrow line never strands the "22".
  const range = (r: { start: string; end: string }) =>
    dayRange(r.start, lastDayOf(r.end)).replace(/[ \u2009]/g, "\u00a0");
  const spentRange = range(totals);
  // A quarter or year that has just begun covers the same days as the month; say it is partial.
  const quarter = Math.floor((Number(totals.start.slice(5, 7)) - 1) / 3) + 1;
  const year = totals.start.slice(0, 4);
  const soFar =
    period === "quarter"
      ? t`Q${quarter} so far`
      : period === "year"
        ? t`${year} so far`
        : period === "month"
          ? t`Spent so far this month`
          : null;
  const previousRange = range({ start: totals.previousStart, end: totals.previousEnd });
  const bars = data.cashSeries[period];
  const barGranularity = BAR_GRANULARITY[period];
  // Notes pinned to the days this chart covers; they follow the period because they are dates.
  const noteFrom = bars[0]?.start ?? "";
  const noteTo = bars.at(-1)?.end ?? "";
  const chartNotes = useFinanceQuery(
    () => (noteFrom ? rpc.finance.chartNotes({ from: noteFrom, to: noteTo }) : Promise.resolve([])),
    [noteFrom, noteTo],
  );
  const [chartNoteDeleteError, setChartNoteDeleteError] = useState("");
  useEffect(() => {
    setChartNoteDeleteError("");
  }, [noteFrom, noteTo]);
  useEffect(() => {
    if (chartNotes.data !== null) setChartNoteDeleteError("");
  }, [chartNotes.data]);
  const subs = data.subscriptions;
  const monthlyTotal = money(subs.totalMonthlyCents);
  const yieldAmount = data.treasuryYieldLastMonth
    ? money(data.treasuryYieldLastMonth.netCents)
    : "";
  // Burn is always there; Cash and Runway need cash accounts; Crypto and Treasury yield need data.
  const kpiCount =
    1 + (hasCash ? 2 : 0) + (data.crypto ? 1 : 0) + (data.treasuryYieldLastMonth ? 1 : 0);
  const connected = data.sources.filter((source) => source.status !== "not_connected");
  const sourceNames = connected.map((source) => providerName(source.provider)).join(", ");
  const sourceDot = connected.some((source) => source.status === "error")
    ? "bg-destructive"
    : connected.some((source) => source.status === "needs_reconnect")
      ? "bg-warning"
      : "bg-success";
  const lapsed = connected.filter((source) => source.status === "needs_reconnect");
  const lapsedNames = lapsed.map((source) => providerName(source.provider)).join(", ");
  const showSkeleton = syncing && data.lastSyncedAt === null;
  const updated = data.lastSyncedAt ? formatRelativeTime(data.lastSyncedAt) : "";

  return (
    <div>
      {/* Sticks like the Inbox header from md up: -top cancels the scroller's padding, so rows never show above it. A phone keeps the screen for the figures. */}
      <div className="pb-4 md:sticky md:-top-2 md:z-20 md:-mx-7 md:-mt-2 md:bg-background md:px-7 md:pt-2 md:pb-3.5">
        <PageHeader
          className="mb-0"
          title={<Trans>Finance</Trans>}
          meta={
            <>
              <CompanyMenu>
                <Link
                  to={lapsed.length > 0 ? CONNECT_PATH : financePath.accounts()}
                  className="rk-tap inline-flex min-w-0 items-center gap-1.5 rounded-full px-1.5 py-0.5 hover:text-foreground"
                >
                  <span
                    aria-hidden="true"
                    className={`size-1.5 shrink-0 rounded-full ${sourceDot}`}
                  />
                  <span>
                    {lapsed.length > 0 ? (
                      // One status for a lapsed sign-in, the same words as Fundraising and Integrations.
                      t`Reconnect ${lapsedNames}`
                    ) : (
                      <>
                        {/* A phone has room for the time only; Accounts names the sources. */}
                        <span className={updated || syncing ? "max-sm:hidden" : undefined}>
                          {sourceNames}
                          {updated || syncing ? " · " : ""}
                        </span>
                        {syncing ? t`syncing…` : updated ? t`synced ${updated}` : null}
                      </>
                    )}
                  </span>
                  {sourceDot === "bg-destructive" ? (
                    <span className="sr-only">{t`Sync failed.`}</span>
                  ) : null}
                </Link>
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
                    <RefreshCw
                      aria-hidden="true"
                      className={syncing ? "animate-spin" : undefined}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <Trans>Refresh</Trans>
                  </TooltipContent>
                </Tooltip>
              </CompanyMenu>
              {data.excludedNonUsdCount > 0 ? (
                // A phone shows it above the figures instead, so the header stays two rows.
                <span className="min-w-0 max-sm:hidden">
                  <NonUsdNotice rows={data.excludedNonUsd} count={data.excludedNonUsdCount} />
                </span>
              ) : null}
              {missing.length > 0 ? (
                // One way to connect: the same Add account dialog as the empty state.
                <Button
                  variant="link"
                  size="xs"
                  className="text-muted-foreground"
                  onClick={() => onAdd("type")}
                >
                  {onlyOne ? t`Add ${providerName(onlyOne.provider)}` : t`Add account`}
                </Button>
              ) : null}
            </>
          }
          actions={
            <>
              <Button variant="outline" render={<Link to={financePath.accounts()} />}>
                <Trans>Accounts</Trans>
              </Button>
              <AskAgentButton />
            </>
          }
        />
      </div>
      {data.sources
        .filter((source) => source.status === "needs_reconnect")
        .map((source) => (
          // A lapsed sign-in stops syncing while the figures still look current, so say so.
          <div
            key={source.provider}
            role="status"
            className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning px-3 py-2 text-sm"
          >
            <span>
              {t`${providerName(source.provider)} needs you to sign in again. Its figures stop updating until you do.`}
            </span>
            <Button variant="outline" size="sm" render={<Link to={CONNECT_PATH} />}>
              {t`Reconnect`}
            </Button>
          </div>
        ))}
      <StatementReminderBanner
        reminders={data.statementReminders ?? []}
        onUpload={() => onAdd("bank")}
      />
      {error ? <ErrorNotice message={error} onRetry={onRefresh} /> : null}
      {showSkeleton ? (
        <DashboardSkeleton />
      ) : (
        <div className="flex flex-col gap-3 md:pt-0.5">
          {data.excludedNonUsdCount > 0 ? (
            <p className="text-xs text-muted-foreground sm:hidden">
              <NonUsdNotice rows={data.excludedNonUsd} count={data.excludedNonUsdCount} />
            </p>
          ) : null}
          <div
            // Two per row when narrow, the odd last card taking the whole row. Five cards go 3 + 2
            // (three-sixths wide, then the last two half each) from 28rem, so the Ask panel never
            // leaves one alone, before they fit one row of five.
            className={`grid grid-cols-2 gap-3 ${
              kpiCount >= 5
                ? "@max-md:[&>:first-child]:col-span-2 @md:grid-cols-6 @md:[&>*]:col-span-2 @md:[&>:nth-last-child(-n+2)]:col-span-3 @5xl:grid-cols-5 @5xl:[&>*]:col-span-1 @5xl:[&>:nth-last-child(-n+2)]:col-span-1"
                : `[&>:last-child:nth-child(odd)]:col-span-2 @3xl:[&>:last-child:nth-child(odd)]:col-span-1 ${
                    kpiCount === 4
                      ? "@3xl:grid-cols-4"
                      : kpiCount === 3
                        ? "@3xl:grid-cols-3"
                        : "@3xl:grid-cols-2"
                  }`
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
              sub={burning ? t`3-mo avg, after revenue` : t`No net spend in the last 3 full months`}
              to={financePath.burn()}
            />
            {hasCash ? (
              <Kpi
                title={t`Runway`}
                value={runwayMonths === undefined ? "—" : t`${runwayMonths} mo`}
                sub={
                  runOutMonth
                    ? t`Until ${runOutMonth}`
                    : runwayMonths === undefined
                      ? t`Needs a monthly burn`
                      : undefined
                }
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
                value={
                  // A wallet's first sync reads as $0 until it lands; show that it is loading.
                  syncing && data.crypto.lastSyncedAt === null && data.crypto.totalCents === 0 ? (
                    <Skeleton className="mt-1 h-6 w-24" aria-label={t`Loading`} />
                  ) : (
                    money(data.crypto.totalCents)
                  )
                }
                sub={cryptoSubtitle(
                  otherCounted > 0 ? "all" : stablecoins > 0 ? "stablecoins" : "bank",
                  data.crypto.unpricedTokenCount,
                  money(heldStablecoins),
                )}
                to={financePath.crypto()}
              />
            ) : null}
            {data.treasuryYieldLastMonth ? (
              <Kpi
                title={t`Treasury yield`}
                value={yieldAmount}
                sub={t`Last month, after fees`}
                to={financePath.accounts()}
              />
            ) : null}
          </div>

          <Section className="@container/strip">
            <div className="flex flex-wrap items-center gap-3.5">
              <PeriodTabs value={period} onChange={setPeriod} />
              <Link
                to={financePath.spend(period)}
                className="rk-tap text-lg font-semibold tabular-nums hover:underline"
              >
                {money(totals.currentCents)}
              </Link>
              <span className="text-xs text-muted-foreground">
                {soFar
                  ? period === "month"
                    ? t`${soFar} · ${spentRange}`
                    : t`${soFar} · spent ${spentRange}`
                  : t`Spent ${spentRange}`}
                {sameAsBefore(totals) || elapsedDays < 7 ? null : (
                  <>
                    {" · "}
                    {change ? <span className={toneClass(totals.changePct)}>{change} </span> : null}
                    {t`vs ${previousRange}`}
                  </>
                )}
              </span>
            </div>
          </Section>

          <Section
            title={
              <Link
                to={financePath.burn()}
                className="rk-tap inline-flex items-center py-1 hover:underline"
              >
                <Trans>Burn</Trans>
                <ChevronRight aria-hidden="true" className="size-3" />
              </Link>
            }
            action={<BurnLegend />}
          >
            {bars.every((p) => !p.outCents && !p.revenueCents && !p.financingCents) ? (
              // An empty chart with axes at $0 looks broken; say what it will show.
              <div className="py-2 text-muted-foreground">
                <Trans>No money in or out in this period yet.</Trans>
              </div>
            ) : (
              <>
                <BurnLines
                  height={180}
                  series={bars}
                  granularity={barGranularity}
                  label={t`Cash out and cash in over time`}
                  notes={{
                    notes: chartNotes.data ?? [],
                    onAdd: async (day, text) => {
                      await rpc.finance.chartNoteAdd({ day, text });
                      setChartNoteDeleteError("");
                      chartNotes.reload();
                    },
                    onDelete: async (id) => {
                      try {
                        await rpc.finance.chartNoteDelete({ id });
                        setChartNoteDeleteError("");
                        chartNotes.reload();
                      } catch (error) {
                        setChartNoteDeleteError(errorText(error));
                      }
                    },
                  }}
                  onOpen={(p) =>
                    navigate(
                      barGranularity === "month"
                        ? financePath.month(p.start.slice(0, 7))
                        : financePath.spend(period, null, { from: p.start, to: p.end }),
                    )
                  }
                />
                {chartNotes.error ? (
                  <ErrorNotice message={t`Could not load`} onRetry={chartNotes.reload} />
                ) : chartNoteDeleteError ? (
                  <ErrorNotice message={chartNoteDeleteError} />
                ) : null}
              </>
            )}
            {bars.at(-1)?.partial &&
            bars.some((p) => p.outCents || p.revenueCents || p.financingCents) ? (
              <div className="text-xs text-muted-foreground">
                <Trans>* So far</Trans>
              </div>
            ) : null}
          </Section>

          <div className="grid gap-3 @3xl:grid-cols-2">
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
                  rows={breakdownList.rows}
                  to={(row) =>
                    by === "category"
                      ? financePath.category(row.key, { period })
                      : financePath.vendor(row.key)
                  }
                />
                {breakdownRows.every((row) => row.cents <= 0) ? (
                  <div className="py-2 text-muted-foreground">
                    <Trans>No spend in this period</Trans>
                  </div>
                ) : null}
                <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
                  {periodBreakdown ? spentRange : <Trans>Last 90 days</Trans>}
                  <SeeAll list={breakdownList} />
                </div>
              </Section>
            </BackHere>

            <BackHere value={{ label: t`Upcoming`, to: `${financePath.dashboard()}#upcoming` }}>
              <Section
                id="upcoming"
                title={<Trans>Upcoming · 30 days</Trans>}
                action={
                  data.upcoming.totalCents > 0 ? (
                    <span className="text-xs font-semibold tabular-nums">
                      ~{money(data.upcoming.totalCents)}
                    </span>
                  ) : null
                }
              >
                <div className="-mx-2">
                  {upcomingList.rows.map((item) => (
                    <UpcomingRow key={`${item.kind}:${item.key}`} item={item} />
                  ))}
                </div>
                {upcomingRows.length === 0 ? (
                  <div className="py-2 text-muted-foreground">
                    <Trans>Nothing due in the next 30 days</Trans>
                  </div>
                ) : null}
                <div className="mt-auto flex justify-end text-xs text-muted-foreground">
                  <SeeAll list={upcomingList} to={financePath.upcoming()} />
                </div>
              </Section>
            </BackHere>
          </div>

          <BackHere
            value={{ label: t`Subscriptions`, to: `${financePath.dashboard()}#subscriptions` }}
          >
            <Section id="subscriptions" title={<Trans>Subscriptions</Trans>}>
              {subs.items.length === 0 ? (
                <div className="py-2 text-muted-foreground">
                  <Trans>None yet. A vendor shows here after three similar monthly charges.</Trans>
                </div>
              ) : (
                <div>
                  <SubscriptionsTable subs={subs} rows={subsList.rows} />
                  <div className="flex items-center justify-between border-t border-border pt-2 text-xs text-muted-foreground">
                    <span>
                      {plural(subs.items.length, {
                        one: "# subscription",
                        other: "# subscriptions",
                      })}{" "}
                      · {t`${monthlyTotal}/mo`}
                    </span>
                    <SeeAll list={subsList} to={financePath.subscriptions()} />
                  </div>
                </div>
              )}
            </Section>
          </BackHere>
        </div>
      )}
    </div>
  );
}

/** What the Crypto figure means for runway, as the Cash card says what it adds up. */
export function cryptoSubtitle(
  counted: "bank" | "stablecoins" | "all",
  unpriced: number,
  stablecoins = "",
): string {
  // The figure above counts all crypto, so name the part that is in runway.
  const scope =
    counted === "all"
      ? t`Counted in runway`
      : counted === "stablecoins"
        ? t`${stablecoins} stablecoins in runway`
        : t`Not in runway`;
  return unpriced > 0 ? t`${scope} · ${unpriced} unpriced` : scope;
}

function HoverRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 tabular-nums">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
