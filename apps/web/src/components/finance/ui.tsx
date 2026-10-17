import { plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type {
  BreakdownRow,
  FinanceTransaction,
  FinanceTxnStatus,
  SpendPeriod,
} from "@rakazo/contracts";
import { SpendPeriodSchema } from "@rakazo/contracts";
import {
  Button,
  Card,
  cn,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@rakazo/ui-web";
import { ChevronRight } from "lucide-react";
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";
import { Link, type LinkProps, useLocation, useNavigate } from "react-router-dom";
import { money, shortDay, transactionAmount, txnDay } from "../../lib/finance-format";
import {
  groupByVendor,
  readGroupedPref,
  type VendorGroup,
  writeGroupedPref,
} from "../../lib/finance-group";
import { financePath } from "../../lib/finance-route";
import { maskCurrencyWhenHidden, useHideAmounts } from "../../lib/hide-amounts-preference";
import { errorText } from "../../lib/user-error";
import { AskBotButton } from "../AskBotButton";
import { HideAmountsButton } from "../HideAmountsToggle";
import { shade } from "./charts";

/**
 * What the Shell tells every Finance page: how to open the agent panel (absent while it is open),
 * and the space's name when the user has more than one, so they know whose finances these are.
 */
const ChromeContext = createContext<{ onAskAgent?: () => void; spaceName?: string }>({});
export const FinanceChromeProvider = ChromeContext.Provider;

/** The space's name beside a Finance title; nothing with a single space. */
export function SpaceName() {
  const { spaceName } = useContext(ChromeContext);
  return spaceName ? (
    <span className="min-w-0 truncate text-xs text-muted-foreground">{spaceName}</span>
  ) : null;
}

export function AskAgentButton() {
  const { onAskAgent } = useContext(ChromeContext);
  if (!onAskAgent) return null;
  return (
    <div className="ms-auto">
      <AskBotButton botName="Finance agent" onClick={onAskAgent} />
    </div>
  );
}

/** Loads one Finance RPC. A changed `deps` shows loading, not the previous answer; `reload` keeps the data on screen. */
export function useFinanceQuery<T>(load: () => Promise<T>, deps: readonly unknown[]) {
  const key = JSON.stringify(deps);
  const [state, setState] = useState<{
    key: string;
    data: T | null;
    error: string;
    notFound?: boolean;
  }>({
    key,
    data: null,
    error: "",
  });
  const [attempt, setAttempt] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;
  // `key` stands for `deps`; `attempt` is the manual retrigger.
  useEffect(() => {
    let live = true;
    loadRef
      .current()
      .then((data) => live && setState({ key, data, error: "" }))
      .catch(
        (cause) =>
          live &&
          setState((s) => ({
            key,
            data: s.key === key ? s.data : null,
            error: errorText(cause),
            notFound: (cause as { code?: string } | null)?.code === "NOT_FOUND",
          })),
      );
    return () => {
      live = false;
    };
  }, [key, attempt]);
  const current = state.key === key;
  return {
    data: current ? state.data : null,
    error: current ? state.error : "",
    /** The server answered NOT_FOUND: retrying will not help. */
    notFound: current && state.notFound === true,
    reload: () => setAttempt((n) => n + 1),
    retry: () => {
      setState({ key, data: null, error: "" });
      setAttempt((n) => n + 1);
    },
  };
}

/** `back` is where the crumb's own page was opened from, so returning to it restores its Back too. */
export type Crumb = { label: string; to?: string; back?: Crumb };

/** The place a link is clicked from (a dashboard card, a detail page), so Back can return to it. */
const HereContext = createContext<Crumb | null>(null);
export const BackHere = HereContext.Provider;

/** Router state for a link: where Back on the next page returns to. */
export function useBackState(): { back: Crumb } | undefined {
  const here = useContext(HereContext);
  return here ? { back: here } : undefined;
}

/** A Link that tells the page it opens where it was opened from. */
export function HereLink(props: LinkProps) {
  const state = useBackState();
  return <Link state={state} {...props} />;
}

/** The origin a page was opened from, when a HereLink opened it. */
function useCameFrom(): Crumb | null {
  const state = useLocation().state as { back?: unknown } | null;
  return parseBack(state?.back, 5);
}

/** A Finance origin from router state, with its own origins up to `depth` levels. */
export function parseBack(raw: unknown, depth: number): Crumb | null {
  const back = raw as Partial<Crumb> | undefined;
  if (
    depth <= 0 ||
    typeof back?.label !== "string" ||
    typeof back.to !== "string" ||
    !back.to.startsWith(financePath.dashboard())
  ) {
    return null;
  }
  const parent = parseBack(back.back, depth - 1);
  return parent
    ? { label: back.label, to: back.to, back: parent }
    : { label: back.label, to: back.to };
}

/** Router state that reopens a crumb's page as it was opened, so its own Back still works. */
const crumbState = (crumb: Crumb | undefined) => (crumb?.back ? { back: crumb.back } : undefined);

/**
 * The trail shown above a page: its own crumbs, or, when it was opened from somewhere else (the
 * dashboard's Breakdown, a category page), Finance, that origin and the page itself.
 */
export function trailFor(own: Crumb[], cameFrom: Crumb | null): Crumb[] {
  // A crumb whose name has not loaded yet (or never will, on a missing page) is left out.
  const crumbs = own.filter((crumb) => crumb.label);
  const [root, ...rest] = crumbs;
  const here = rest.at(-1);
  if (!cameFrom || !root || !here) return crumbs;
  // The origin's own origins come too, so the trail is as deep as when the page is opened directly.
  const chain: Crumb[] = [];
  for (let c: Crumb | undefined = cameFrom; c && c.to !== root.to; c = c.back) chain.unshift(c);
  return [root, ...chain, here];
}

/** Back button, breadcrumb and Ask agent for every detail page; the last crumb is the page itself. */
export function DetailHead({ crumbs: own }: { crumbs: Crumb[] }) {
  const cameFrom = useCameFrom();
  const crumbs = trailFor(own, cameFrom);
  // Before the page's own name loads (or when it never will), Back still returns to the real origin.
  const previous = crumbs.length > 1 ? crumbs[crumbs.length - 2] : (cameFrom ?? undefined);
  const collapsed = (i: number) => crumbs.length > 3 && i > 0 && i < crumbs.length - 2;
  return (
    <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
      <Link
        to={previous?.to ?? financePath.dashboard()}
        state={crumbState(previous)}
        className="inline-flex h-8 items-center whitespace-nowrap rounded-lg border border-border bg-card px-2.5 text-sm font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
      >
        <span aria-hidden="true">←</span>
        <span className="ms-1">{previous?.label ?? t`Finance`}</span>
      </Link>
      {/* Narrow, the trail takes its own line, so Back and Ask agent share the first on every page. */}
      <nav
        aria-label={t`Breadcrumb`}
        className="order-last w-full min-w-0 @md:order-none @md:w-auto"
      >
        <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          {crumbs.map((crumb, i) => (
            <li
              key={i}
              // Narrow, a deep trail keeps Finance, the page before and this page; Back names the one before.
              className={cn("flex items-center gap-1", collapsed(i) && "hidden @md:flex")}
            >
              {crumb.to && i < crumbs.length - 1 ? (
                <Link
                  to={crumb.to}
                  state={crumbState(crumb)}
                  className="hover:text-foreground hover:underline"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  aria-current={i === crumbs.length - 1 ? "page" : undefined}
                  className="text-foreground"
                >
                  {crumb.label}
                </span>
              )}
              {/* The slash ends a crumb, so a wrapped trail never starts a line with one. */}
              {i < crumbs.length - 1 ? <span aria-hidden="true">/</span> : null}
              {i === 0 && crumbs.length > 3 ? (
                <span aria-hidden="true" className="flex items-center gap-1 @md:hidden">
                  <span>…</span>
                  <span>/</span>
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </nav>
      <HideAmountsButton />
      <AskAgentButton />
    </div>
  );
}

/** What a missing page says: retrying cannot bring it back, and Back above leads out. */
export function NotFoundNotice() {
  return (
    <div className="mt-1.5">
      <h1 className="text-xl font-semibold">
        <Trans>Not found</Trans>
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        <Trans>This page doesn't exist or was removed.</Trans>
      </p>
    </div>
  );
}

export function ErrorNotice({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="my-4 flex items-center gap-3 text-sm text-destructive">
      <span>{message}</span>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <Trans>Try again</Trans>
      </Button>
    </div>
  );
}

/** The frame every detail page renders in: title, optional subtitle, loading and error states. */
export function DetailPage({
  crumbs,
  title,
  subtitle,
  action,
  loading,
  error,
  notFound,
  onRetry,
  children,
}: {
  crumbs: Crumb[];
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Sits at the end of the title row. */
  action?: ReactNode;
  loading: boolean;
  error: string;
  /** The item does not exist: say so instead of offering a retry. */
  notFound?: boolean;
  onRetry: () => void;
  children?: ReactNode;
}) {
  const location = useLocation();
  const cameFrom = useCameFrom();
  const label = crumbs.at(-1)?.label;
  const here = label
    ? {
        label,
        to: `${location.pathname}${location.search}`,
        ...(cameFrom ? { back: cameFrom } : {}),
      }
    : null;
  return (
    <BackHere value={here}>
      <div>
        <DetailHead crumbs={crumbs} />
        {notFound ? (
          <NotFoundNotice />
        ) : error ? (
          <ErrorNotice message={error} onRetry={onRetry} />
        ) : loading ? (
          <div className="mt-4 flex flex-col gap-3" aria-busy="true">
            <span className="text-xs text-muted-foreground">
              <Trans>Loading…</Trans>
            </span>
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : (
          <>
            <div className="mt-1.5 flex items-center gap-3">
              <h1 className="text-xl font-semibold">{title}</h1>
              {action ? <div className="ms-auto">{action}</div> : null}
            </div>
            {subtitle ? <div className="mb-3 text-xs text-muted-foreground">{subtitle}</div> : null}
            <div className={cn("flex flex-col gap-3", subtitle ? "" : "mt-3")}>{children}</div>
          </>
        )}
      </div>
    </BackHere>
  );
}

export function Section({
  id,
  title,
  action,
  className,
  children,
}: {
  /** An anchor, so Back can return to this card. */
  id?: string;
  title?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card id={id} size="sm" className={cn("scroll-mt-3 px-3.5", className)}>
      {title || action ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {title ? (
            <h2 className="whitespace-nowrap text-xs font-semibold text-muted-foreground">
              {title}
            </h2>
          ) : null}
          {action ? <div className="ms-auto flex items-center gap-3">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </Card>
  );
}

/** A figure card. With `to` the whole card opens that page; with `hover` the card also shows those rows on hover or keyboard focus. */
export function Kpi({
  title,
  value,
  sub,
  to,
  hover,
}: {
  title: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  to?: string;
  hover?: ReactNode;
}) {
  const body = (
    <>
      <h2 className="text-xs font-semibold text-muted-foreground">{title}</h2>
      <div className="mt-1 text-[22px] font-semibold leading-tight tabular-nums">{value}</div>
      <div className="text-[11px] text-muted-foreground">{sub ?? " "}</div>
    </>
  );
  const cls = "block px-3.5";
  const linkClass = "rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-foreground";
  const card = (
    <Card size="sm" className={cn(cls, "h-full hover:ring-foreground/30")}>
      {body}
    </Card>
  );
  return to && hover ? (
    <Tooltip>
      <TooltipTrigger render={<Link to={to} className={linkClass} />}>{card}</TooltipTrigger>
      <TooltipContent className="flex-col items-stretch gap-0.5">{hover}</TooltipContent>
    </Tooltip>
  ) : to ? (
    <Link to={to} className={linkClass}>
      {card}
    </Link>
  ) : (
    <Card size="sm" className={cls}>
      {body}
    </Card>
  );
}

/** Breakdown rows: label, relative bar, amount, chevron. Each opens `to(row)`. */
export function BreakdownRows({
  rows,
  to,
  swatches,
}: {
  rows: BreakdownRow[];
  to: (row: BreakdownRow) => string;
  swatches?: boolean;
}) {
  useHideAmounts();
  // A row that refunds outweigh is not spend; shown unsigned it would read as money out.
  const spent = rows.filter((row) => row.cents > 0);
  const top = spent[0]?.cents || 1;
  return (
    <div className="-mx-2">
      {spent.map((row, i) => (
        <HereLink
          key={row.key}
          to={to(row)}
          // Narrow, the bar moves under the name so the name is not cut off.
          className="group grid grid-cols-[minmax(0,1fr)_4.5rem_0.75rem] items-center gap-x-2.5 gap-y-1 rounded-lg px-2 py-1.5 outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-foreground @md:grid-cols-[minmax(0,13rem)_1fr_4.5rem_0.75rem] @xl:grid-cols-[minmax(0,17rem)_1fr_4.5rem_0.75rem]"
        >
          <span className="truncate" title={row.label}>
            {swatches ? (
              <i
                className="me-1.5 inline-block size-2 rounded-xs"
                style={{ background: shade(i) }}
                aria-hidden="true"
              />
            ) : null}
            {row.label}
          </span>
          <span className="col-span-full row-start-2 block h-2 overflow-hidden rounded-sm bg-muted group-hover:bg-border @md:col-span-1 @md:row-start-auto">
            <i
              className={cn(
                "block h-full rounded-sm",
                i < 2 ? "bg-foreground" : "bg-muted-foreground",
              )}
              style={{ width: `${Math.max((row.cents / top) * 100, 0)}%` }}
            />
          </span>
          <span className="text-end tabular-nums">{money(row.cents)}</span>
          <ChevronRight
            aria-hidden="true"
            className="size-3.5 text-muted-foreground group-hover:text-foreground"
          />
        </HereLink>
      ))}
    </div>
  );
}

const statusLabel = (status: FinanceTxnStatus) =>
  status === "pending" ? t`Pending` : status === "posted" ? t`Posted` : t`Other`;

/**
 * Navigates when a table row (outside its own links) is clicked. The row follows its own link to
 * `to` when it has one: that link renders inside the page, so it carries the page's Back state,
 * while this hook is often called by the page itself, outside it, where that state is unknown.
 */
export function useRowNavigate() {
  const navigate = useNavigate();
  const back = useBackState();
  return (to: string, state: object | undefined = back) => ({
    onClick: (event: React.MouseEvent<HTMLElement>) => {
      if ((event.target as HTMLElement).closest("a,button")) return;
      const own = [...event.currentTarget.querySelectorAll("a")].find(
        (link) => link.getAttribute("href") === to,
      );
      if (own) own.click();
      else navigate(to, { state });
    },
  });
}

/** The row a transaction link was clicked on, so the transaction page can show it before it loads. */
export function previewFrom(state: unknown, id: string): FinanceTransaction | null {
  const preview = (state as { preview?: FinanceTransaction } | null)?.preview;
  return preview && preview.id === id && typeof preview.counterparty === "string" ? preview : null;
}

export const Th = ({
  children,
  right,
  className,
}: {
  children?: ReactNode;
  right?: boolean;
  className?: string;
}) => (
  <th
    scope="col"
    className={cn(
      "pb-1.5 pt-1 text-xs font-medium text-muted-foreground",
      right ? "text-end" : "text-start",
      className,
    )}
  >
    {children}
  </th>
);

export const Chevron = () => (
  <td className="w-4 text-end text-muted-foreground group-hover/row:text-foreground">
    <ChevronRight aria-hidden="true" className="ms-auto size-3.5" />
  </td>
);

export const rowClass =
  "group/row cursor-pointer border-t border-border hover:bg-background [&>td]:py-2";

/** A transaction's category, or what it is when it is not spend: a card payoff or a transfer
 * between the company's own accounts, which Finance leaves out of spend. */
export function categoryLabel(
  row: Pick<FinanceTransaction, "category" | "classification">,
): string {
  if (row.classification === "card_payment") return t`Card payment · not spend`;
  if (row.classification === "internal_transfer") return t`Transfer · not spend`;
  return row.category ?? t`Uncategorized`;
}

function TransactionRow({ row }: { row: FinanceTransaction }) {
  useHideAmounts();
  const rowProps = useRowNavigate();
  const back = useBackState();
  return (
    <tr
      className={rowClass}
      {...rowProps(financePath.transaction(row.id), { ...back, preview: row })}
    >
      <td className="w-[4.5rem] whitespace-nowrap pe-2 text-muted-foreground">
        {shortDay(txnDay(row))}
      </td>
      <td className="min-w-0">
        <Link
          state={{ ...back, preview: row }}
          to={financePath.transaction(row.id)}
          className="outline-none hover:underline focus-visible:underline"
        >
          {row.counterparty}
        </Link>
        {row.memo ? (
          <div className="line-clamp-1 text-[11px] text-muted-foreground">
            {maskCurrencyWhenHidden(row.memo)}
          </div>
        ) : null}
      </td>
      <td className="hidden max-w-[10rem] truncate text-muted-foreground @2xl:table-cell">
        {categoryLabel(row)}
      </td>
      <td className="whitespace-nowrap ps-4 text-end tabular-nums">
        {transactionAmount(row.amountCents, undefined, row.currency)}
      </td>
      <td className="hidden w-24 ps-4 text-muted-foreground @2xl:table-cell">
        {statusLabel(row.status)}
      </td>
      <Chevron />
    </tr>
  );
}

/** One row per vendor; opening it lists that vendor's transactions in the flat list's row style. */
function VendorGroupRows({ group }: { group: VendorGroup }) {
  useHideAmounts();
  const [open, setOpen] = useState(false);
  const count = group.rows.length;
  const name = group.name || t`Unknown`;
  return (
    <>
      {/* The whole row toggles; the vendor button carries the accessible name and keyboard focus (its click bubbles here). */}
      <tr
        className="group/row cursor-pointer border-t border-border hover:bg-background [&>td]:py-2"
        onClick={() => setOpen((v) => !v)}
      >
        <td className="w-[4.5rem] pe-2">
          <ChevronRight
            aria-hidden="true"
            className={cn("size-3.5 text-muted-foreground", open && "rotate-90")}
          />
        </td>
        <td className="min-w-0">
          <button
            type="button"
            aria-expanded={open}
            className="text-start outline-none hover:underline focus-visible:underline"
          >
            {name}
          </button>
          <div className="text-[11px] text-muted-foreground">
            {plural(count, { one: "# transaction", other: "# transactions" })}
          </div>
        </td>
        <td className="hidden max-w-[10rem] truncate text-muted-foreground @2xl:table-cell">
          {group.mixed ? t`Mixed` : categoryLabel(group.rows[0] as FinanceTransaction)}
        </td>
        <td className="whitespace-nowrap ps-4 text-end tabular-nums">
          {transactionAmount(Number(group.totalCents), undefined, group.currency)}
        </td>
        <td className="hidden w-24 @2xl:table-cell" />
        <td />
      </tr>
      {open ? group.rows.map((row) => <TransactionRow key={row.id} row={row} />) : null}
    </>
  );
}

/** Transactions: date, counterparty and memo, category, signed amount, status. Each row opens the transaction. With `grouped`, one row per vendor. */
export function TransactionTable({
  rows,
  grouped = false,
  empty,
}: {
  rows: FinanceTransaction[];
  grouped?: boolean;
  /** What an empty list says; a page without a period picks its own words. */
  empty?: ReactNode;
}) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          {/* Date and Status keep their width in both modes, so opening a vendor moves no column. */}
          <Th className="w-[4.5rem]">{grouped ? null : <Trans>Date</Trans>}</Th>
          <Th>
            <Trans>Counterparty</Trans>
          </Th>
          <Th className="hidden @2xl:table-cell">
            <Trans>Category</Trans>
          </Th>
          <Th right className="ps-4">
            <Trans>Amount</Trans>
          </Th>
          <Th className="hidden w-24 ps-4 @2xl:table-cell">
            {grouped ? null : <Trans>Status</Trans>}
          </Th>
          <Th />
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr className="border-t border-border">
            <td colSpan={6} className="py-3 text-muted-foreground">
              {empty ?? <Trans>No transactions in this period</Trans>}
            </td>
          </tr>
        ) : null}
        {grouped
          ? groupByVendor(rows).map((group) => <VendorGroupRows key={group.key} group={group} />)
          : rows.map((row) => <TransactionRow key={row.id} row={row} />)}
      </tbody>
    </table>
  );
}

/** A Transactions card whose header switches between the flat list and one row per vendor. The choice is remembered on this device. */
export function TransactionsSection({
  title,
  rows,
  empty,
}: {
  title?: ReactNode;
  rows: FinanceTransaction[];
  empty?: ReactNode;
}) {
  const [preferGrouped, setGrouped] = useState(readGroupedPref);
  const choose = (next: boolean) => {
    setGrouped(next);
    writeGroupedPref(next);
  };
  // Grouping one vendor's charges by vendor changes nothing, so the switch is left out.
  const manyVendors = groupByVendor(rows).length > 1;
  const grouped = preferGrouped && manyVendors;
  return (
    <Section
      title={title}
      action={
        manyVendors ? (
          <div className="flex gap-1">
            {([false, true] as const).map((mode) => (
              <Button
                key={String(mode)}
                size="xs"
                variant={grouped === mode ? "default" : "outline"}
                className="rounded-full"
                aria-pressed={grouped === mode}
                onClick={() => choose(mode)}
              >
                {mode ? <Trans>By vendor</Trans> : <Trans>List</Trans>}
              </Button>
            ))}
          </div>
        ) : null
      }
    >
      <TransactionTable rows={rows} grouped={grouped} empty={empty} />
    </Section>
  );
}

/** A pill link: the active one is inked. Used for category filters. */
export function Chip({ to, on, children }: { to: string; on?: boolean; children: ReactNode }) {
  return (
    <Link
      to={to}
      aria-current={on ? "true" : undefined}
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs",
        on
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:border-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

export const periodNames = (): Record<SpendPeriod, string> => ({
  week: t`Week`,
  month: t`Month`,
  quarter: t`Quarter`,
  year: t`Year`,
});

/** Week, Month, Quarter, Year as one tab strip; `null` selects none (a custom range is shown). */
export function PeriodTabs({
  value,
  onChange,
}: {
  value: SpendPeriod | null;
  onChange: (period: SpendPeriod) => void;
}) {
  const names = periodNames();
  return (
    <Tabs value={value} onValueChange={(next) => onChange(next as SpendPeriod)}>
      <TabsList className="rounded-full" aria-label={t`Period`}>
        {SpendPeriodSchema.options.map((period) => (
          <TabsTrigger key={period} value={period} className="rounded-full px-3">
            {names[period]}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

function Legend({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center">
      <i aria-hidden="true" className={`me-1.5 inline-block size-2.5 rounded-xs ${className}`} />
      {children}
    </span>
  );
}

/** The key for a BurnBars chart: Out, Revenue and Financing. */
export function BurnLegend() {
  return (
    <div className="flex gap-3.5 text-[11px] text-muted-foreground">
      <Legend className="bg-foreground">
        <Trans>Out</Trans>
      </Legend>
      <Legend className="bg-muted-foreground">
        <Trans>Revenue</Trans>
      </Legend>
      <Legend className="border border-foreground bg-[repeating-linear-gradient(45deg,var(--foreground)_0_1.5px,var(--card)_1.5px_3.5px)]">
        <Trans>Financing</Trans>
      </Legend>
    </div>
  );
}

/** Label and value pairs; each child is a `KvRow`. */
export function Kv({ children }: { children: ReactNode }) {
  return (
    <dl className="m-0 grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-2 @md:grid-cols-[8rem_1fr]">
      {children}
    </dl>
  );
}

export function KvRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="contents">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="m-0 min-w-0">{children}</dd>
    </div>
  );
}

/** A link inside a detail value, with a trailing chevron. */
export function ValueLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="hover:underline">
      {children} <span aria-hidden="true">›</span>
    </Link>
  );
}

/**
 * What a Cash figure adds up, built from the accounts actually counted: `3 bank accounts`, plus the
 * crypto the saved scope counts. Without a count (an older payload) it says `Bank accounts`.
 */
export function cashSubtitle(
  count: number | undefined,
  crypto: "none" | "stablecoins" | "all",
): string {
  const accounts =
    count === undefined
      ? t`Bank accounts`
      : plural(count, { one: "# bank account", other: "# bank accounts" });
  return crypto === "all"
    ? t`${accounts} + crypto`
    : crypto === "stablecoins"
      ? t`${accounts} + stablecoins`
      : accounts;
}

/** Up/down tone: spending more or burning more is bad news. */
/** Less spend reads as good news and more as bad; a change that rounds to 0% is neither. */
export const toneClass = (change: number | null) =>
  change === null || Math.round(change) === 0
    ? ""
    : change < 0
      ? "text-success"
      : "text-destructive";
