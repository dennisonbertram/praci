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
import { ChevronRight, MessageSquare } from "lucide-react";
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { money, shortDay, transactionAmount } from "../../lib/finance-format";
import {
  groupByVendor,
  readGroupedPref,
  type VendorGroup,
  writeGroupedPref,
} from "../../lib/finance-group";
import { financePath } from "../../lib/finance-route";
import { errorText } from "../../lib/user-error";
import { shade } from "./charts";

/** What the Shell tells every Finance page: how to open the agent panel (absent while it is open). */
const ChromeContext = createContext<{ onAskAgent?: () => void }>({});
export const FinanceChromeProvider = ChromeContext.Provider;

export function AskAgentButton() {
  const { onAskAgent } = useContext(ChromeContext);
  if (!onAskAgent) return null;
  return (
    <Button
      size="lg"
      className="ms-auto h-10 rounded-[10px] px-4.5 text-sm font-semibold"
      onClick={onAskAgent}
    >
      <MessageSquare aria-hidden="true" className="size-4.5" />
      <Trans>Ask agent</Trans>
    </Button>
  );
}

/** Loads one Finance RPC. A changed `deps` shows loading, not the previous answer; `reload` keeps the data on screen. */
export function useFinanceQuery<T>(load: () => Promise<T>, deps: readonly unknown[]) {
  const key = JSON.stringify(deps);
  const [state, setState] = useState<{ key: string; data: T | null; error: string }>({
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
          setState((s) => ({ key, data: s.key === key ? s.data : null, error: errorText(cause) })),
      );
    return () => {
      live = false;
    };
  }, [key, attempt]);
  const current = state.key === key;
  return {
    data: current ? state.data : null,
    error: current ? state.error : "",
    reload: () => setAttempt((n) => n + 1),
    retry: () => {
      setState({ key, data: null, error: "" });
      setAttempt((n) => n + 1);
    },
  };
}

export type Crumb = { label: string; to?: string };

/** Back button, breadcrumb and Ask agent for every detail page; the last crumb is the page itself. */
export function DetailHead({ crumbs }: { crumbs: Crumb[] }) {
  const previous = crumbs.length > 1 ? crumbs[crumbs.length - 2] : undefined;
  return (
    <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
      <Link
        to={previous?.to ?? financePath.dashboard()}
        className="inline-flex h-8 items-center whitespace-nowrap rounded-lg border border-border bg-card px-2.5 text-sm font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
      >
        <span aria-hidden="true">←</span>
        <span className="ms-1">{previous?.label ?? t`Finance`}</span>
      </Link>
      <nav aria-label={t`Breadcrumb`} className="min-w-0">
        <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          {crumbs.map((crumb, i) => (
            <li key={i} className="flex items-center gap-1">
              {i > 0 ? <span aria-hidden="true">/</span> : null}
              {crumb.to && i < crumbs.length - 1 ? (
                <Link to={crumb.to} className="hover:text-foreground hover:underline">
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
            </li>
          ))}
        </ol>
      </nav>
      <AskAgentButton />
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
  onRetry: () => void;
  children?: ReactNode;
}) {
  return (
    <div>
      <DetailHead crumbs={crumbs} />
      {error ? (
        <ErrorNotice message={error} onRetry={onRetry} />
      ) : loading ? (
        <div className="mt-4 flex flex-col gap-3" aria-busy="true">
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
  );
}

export function Section({
  title,
  action,
  className,
  children,
}: {
  title?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card size="sm" className={cn("px-3.5", className)}>
      {title || action ? (
        <div className="flex items-center gap-3">
          {title ? <h2 className="text-xs font-semibold text-muted-foreground">{title}</h2> : null}
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
  const top = rows[0]?.cents || 1;
  return (
    <div className="-mx-2">
      {rows.map((row, i) => (
        <Link
          key={row.key}
          to={to(row)}
          className="group grid grid-cols-[minmax(0,7.5rem)_1fr_4.5rem_0.75rem] items-center gap-2.5 rounded-lg px-2 py-1.5 outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-foreground @md:grid-cols-[minmax(0,9rem)_1fr_4.5rem_0.75rem]"
        >
          <span className="truncate">
            {swatches ? (
              <i
                className="me-1.5 inline-block size-2 rounded-xs"
                style={{ background: shade(i) }}
                aria-hidden="true"
              />
            ) : null}
            {row.label}
          </span>
          <span className="block h-2 overflow-hidden rounded-sm bg-muted group-hover:bg-border">
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
        </Link>
      ))}
    </div>
  );
}

const statusLabel = (status: FinanceTxnStatus) =>
  status === "pending" ? t`Pending` : status === "posted" ? t`Posted` : t`Other`;

/** Navigates when a table row (outside its own links) is clicked. */
export function useRowNavigate() {
  const navigate = useNavigate();
  return (to: string) => ({
    onClick: (event: React.MouseEvent) => {
      if ((event.target as HTMLElement).closest("a,button")) return;
      navigate(to);
    },
  });
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

function TransactionRow({ row }: { row: FinanceTransaction }) {
  const rowProps = useRowNavigate();
  return (
    <tr className={rowClass} {...rowProps(financePath.transaction(row.id))}>
      <td className="w-[4.5rem] whitespace-nowrap pe-2 text-muted-foreground">
        {shortDay(row.postedAt)}
      </td>
      <td className="min-w-0">
        <Link
          to={financePath.transaction(row.id)}
          className="outline-none hover:underline focus-visible:underline"
        >
          {row.counterparty}
        </Link>
        {row.memo ? (
          <div className="line-clamp-1 text-[11px] text-muted-foreground">{row.memo}</div>
        ) : null}
      </td>
      <td className="hidden max-w-[10rem] truncate text-muted-foreground @2xl:table-cell">
        {row.category ?? t`Uncategorized`}
      </td>
      <td className="whitespace-nowrap ps-4 text-end tabular-nums">
        {transactionAmount(row.amountCents, undefined, row.currency)}
      </td>
      <td className="hidden ps-4 text-muted-foreground @2xl:table-cell">
        {statusLabel(row.status)}
      </td>
      <Chevron />
    </tr>
  );
}

/** One row per vendor; opening it lists that vendor's transactions in the flat list's row style. */
function VendorGroupRows({ group }: { group: VendorGroup }) {
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
          {group.mixed ? t`Mixed` : (group.category ?? t`Uncategorized`)}
        </td>
        <td className="whitespace-nowrap ps-4 text-end tabular-nums">
          {transactionAmount(Number(group.totalCents), undefined, group.currency)}
        </td>
        <td className="hidden @2xl:table-cell" />
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
}: {
  rows: FinanceTransaction[];
  grouped?: boolean;
}) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <Th>{grouped ? null : <Trans>Date</Trans>}</Th>
          <Th>
            <Trans>Counterparty</Trans>
          </Th>
          <Th className="hidden @2xl:table-cell">
            <Trans>Category</Trans>
          </Th>
          <Th right className="ps-4">
            <Trans>Amount</Trans>
          </Th>
          <Th className="hidden ps-4 @2xl:table-cell">{grouped ? null : <Trans>Status</Trans>}</Th>
          <Th />
        </tr>
      </thead>
      <tbody>
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
}: {
  title?: ReactNode;
  rows: FinanceTransaction[];
}) {
  const [grouped, setGrouped] = useState(readGroupedPref);
  const choose = (next: boolean) => {
    setGrouped(next);
    writeGroupedPref(next);
  };
  return (
    <Section
      title={title}
      action={
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
      }
    >
      <TransactionTable rows={rows} grouped={grouped} />
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

/** Week, Month, Quarter, Year as one tab strip. */
export function PeriodTabs({
  value,
  onChange,
}: {
  value: SpendPeriod;
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

/** Up/down tone: spending more or burning more is bad news. */
export const toneClass = (change: number | null) =>
  change === null ? "" : change <= 0 ? "text-success" : "text-destructive";
