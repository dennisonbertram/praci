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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  Skeleton,
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@rakazo/ui-web";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { createContext, useContext, useState } from "react";
import type { LinkProps } from "react-router-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { listAmount, money, shortDay, txnDay } from "../../lib/finance-format";
import type { VendorGroup } from "../../lib/finance-group";
import { groupByVendor, readGroupedPref, writeGroupedPref } from "../../lib/finance-group";
import { financePath } from "../../lib/finance-route";
import type { TransactionSort } from "../../lib/finance-transaction-list";
import {
  DEFAULT_TRANSACTION_SORT,
  filterTransactions,
  sortTransactionGroups,
  sortTransactions,
  TRANSACTION_SORTS,
} from "../../lib/finance-transaction-list";
import {
  getHideAmounts,
  maskCurrencyWhenHidden,
  useHideAmounts,
} from "../../lib/hide-amounts-preference";
import type { Sort } from "../../lib/list-params";
import { useListParams } from "../../lib/list-params";
import { AskBotButton } from "../AskBotButton";
import { SeeAll, useCappedRows } from "../CappedList";
import { ErrorNotice } from "../ErrorNotice";
import { ShowAmountsButton } from "../HideAmountsToggle";
import { PickFilter, SearchField, SortControl } from "../ListControls";
import { PageNavButton } from "../PageHeader";
import { StillLoading } from "../ShellSkeleton";

export type FinanceSpace = { id: string; name: string };

/**
 * What the Shell tells every Finance page: how to open the agent panel (absent while it is open),
 * and, when the user has more than one space, which one Finance shows and how to switch.
 */
export type FinanceChrome = {
  onAskAgent?: () => void;
  /** The agent Ask opens, for its accessible name; Finance's by default. */
  agentName?: string;
  spaces?: FinanceSpace[];
  spaceId?: string;
  onSwitchSpace?: (spaceId: string) => void;
};
const ChromeContext = createContext<FinanceChrome>({});
export const FinanceChromeProvider = ChromeContext.Provider;

/**
 * A space's name without the words every space's name starts with ("Northwind
 * Robotics" beside "Empty space" reads "Northwind Robotics"), so a narrow
 * switcher shows which company it is rather than the shared start.
 */
export function shortSpaceName(name: string, all: readonly string[]): string {
  const words = all.map((n) => n.split(" "));
  const own = name.split(" ");
  let shared = 0;
  // Leave at least one word of every name.
  while (
    words.length > 1 &&
    words.every((w) => shared < w.length - 1 && w[shared] === own[shared])
  ) {
    shared += 1;
  }
  return (
    own
      .slice(shared)
      .join(" ")
      .replace(/^[—–\-:·]\s*/, "") || name
  );
}

/** Which company Finance shows: its name, as a menu to switch when there is another space to switch to. */
export function SpaceName() {
  const { spaces = [], spaceId, onSwitchSpace } = useContext(ChromeContext);
  const current = spaces.find((space) => space.id === spaceId);
  if (!current) return null;
  const label = shortSpaceName(
    current.name,
    spaces.map((space) => space.name),
  );
  // The only company needs no name beside the title.
  if (!onSwitchSpace || spaces.length < 2) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="xs"
            className="min-w-0 max-w-56 shrink text-muted-foreground sm:max-w-64"
            aria-label={t`Company: ${current.name}. Switch company`}
          />
        }
      >
        <span className="min-w-0 truncate">{label}</span>
        <ChevronDown aria-hidden="true" />
      </DropdownMenuTrigger>
      {/* As wide as the longest name (not the trigger), within the screen. */}
      <DropdownMenuContent align="start" className="w-max max-w-[calc(100vw-2rem)]">
        <DropdownMenuRadioGroup
          value={current.id}
          onValueChange={(next) => next !== current.id && onSwitchSpace(next as string)}
        >
          <DropdownMenuLabel>
            <Trans>Company</Trans>
          </DropdownMenuLabel>
          {spaces.map((space) => (
            <DropdownMenuRadioItem key={space.id} value={space.id}>
              {space.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AskAgentButton() {
  const { onAskAgent, agentName } = useContext(ChromeContext);
  if (!onAskAgent) return null;
  return (
    <div className="ms-auto">
      <AskBotButton compact botName={agentName ?? "Finance agent"} onClick={onAskAgent} />
    </div>
  );
}

/** Finance pages' name for the shared page query. */
export { usePageQuery as useFinanceQuery } from "../../lib/page-data";

/** Text with each account ending (`••1111`) in the muted style every account list uses. */
export function WithEndings({ text }: { text: string }) {
  const parts = text.split(/(••\d{4})/);
  if (parts.length === 1) return <>{text}</>;
  return (
    <>
      {parts.map((part, i) =>
        /^••\d{4}$/.test(part) ? (
          <span key={i} className="font-normal text-muted-foreground">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
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
export function trailFor(own: Crumb[], cameFrom: Crumb | null, path?: string): Crumb[] {
  // A crumb whose name has not loaded yet (or never will, on a missing page) is left out.
  const crumbs = own.filter((crumb) => crumb.label);
  const [root, ...rest] = crumbs;
  const here = rest.at(-1);
  if (!cameFrom || !root || !here) return crumbs;
  // The origin's own origins come too, so the trail is as deep as when the page is opened directly.
  const chain: Crumb[] = [];
  // Reaching this page's own address again (vendor, charge, Merchant) drops the loop, so nothing repeats.
  for (let c: Crumb | undefined = cameFrom; c && c.to !== root.to; c = c.back) {
    if (path && c.to === path) chain.length = 0;
    else chain.unshift(c);
  }
  return [root, ...chain, here];
}

/**
 * What a detail page tells the pages it links to: its name and address, and the trail it shows
 * above itself, so a page opened from it continues that same trail (Finance / Breakdown / Software
 * / the charge) whether this page was opened from a link or by its address.
 */
export function hereCrumb(own: Crumb[], cameFrom: Crumb | null, to: string): Crumb | null {
  const label = own.at(-1)?.label;
  if (!label) return null;
  const back = trailFor(own, cameFrom, to)
    .slice(1, -1)
    .reduce<Crumb | undefined>(
      (parent, c) =>
        c.to ? { label: c.label, to: c.to, ...(parent ? { back: parent } : {}) } : parent,
      undefined,
    );
  return { label, to, ...(back ? { back } : {}) };
}

/**
 * One way back for every detail page, then the company and Hide amounts: a Back button one level
 * down, or, deeper, a breadcrumb whose links lead back (the last crumb is the page itself).
 */
export function DetailHead({
  crumbs: own,
  title,
  actions,
}: {
  crumbs: Crumb[];
  /** With a title, Back, the title and the actions share one row, so the title sits where the overview's does. */
  title?: ReactNode;
  actions?: ReactNode;
}) {
  const cameFrom = useCameFrom();
  const location = useLocation();
  const crumbs = trailFor(own, cameFrom, `${location.pathname}${location.search}`);
  // Before the page's own name loads (or when it never will), Back still returns to the real origin.
  const previous = crumbs.length > 1 ? crumbs[crumbs.length - 2] : (cameFrom ?? undefined);
  // The page's own name is the heading below, so the trail stops at the page before it.
  const trail = crumbs.slice(0, -1);
  const collapsed = (i: number) => trail.length > 3 && i > 0 && i < trail.length - 1;
  const back = crumbs.length <= 3;
  const heading =
    title === undefined ? null : (
      <h1
        className={cn(
          "min-w-0 text-lg leading-7 font-semibold",
          // Beside Back the title takes what the row has left (and wraps), so Ask stays on this row.
          back && "max-sm:flex-1 max-sm:basis-0",
        )}
      >
        {title}
      </h1>
    );
  // On a phone the actions join the title row's flex line (`contents`), so Ask stays beside the
  // title and the company and the page's own action take the next line.
  const end = actions ? (
    <div className="ms-auto flex items-center gap-2 max-sm:contents">{actions}</div>
  ) : null;
  return (
    <>
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-2.5 gap-y-1",
          heading && back ? "min-h-10" : "mb-1.5 min-h-8",
        )}
      >
        <PageNavButton />
        {/* Back names the page before, for every page up to two levels down; only a charge, four
      levels down, needs the trail's links. */}
        {back ? (
          <Link
            to={previous?.to ?? financePath.dashboard()}
            state={crumbState(previous)}
            className="inline-flex h-8 pointer-coarse:h-11 shrink-0 items-center whitespace-nowrap rounded-lg border border-border bg-card px-2.5 text-sm font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          >
            <span aria-hidden="true">←</span>
            <span className="ms-1">{previous?.label ?? t`Finance`}</span>
          </Link>
        ) : (
          // The trail keeps its width; when it leaves too little room for the company and the eye,
          // they move to the next line rather than cutting the company's name to a letter or two.
          <nav aria-label={t`Breadcrumb`} className="min-w-0 max-w-full shrink-0">
            <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
              {trail.map((crumb, i) => (
                <li
                  key={i}
                  // Narrow, a deep trail keeps Finance, the page before and this page.
                  className={cn("flex items-center gap-1", collapsed(i) && "hidden @md:flex")}
                >
                  {crumb.to ? (
                    <Link
                      to={crumb.to}
                      state={crumbState(crumb)}
                      className="rk-tap hover:text-foreground hover:underline"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-foreground">
                      <WithEndings text={crumb.label} />
                    </span>
                  )}
                  {/* The slash ends a crumb, so a wrapped trail never starts a line with one. */}
                  {i < trail.length - 1 ? <span aria-hidden="true">/</span> : null}
                  {i === 0 && trail.length > 3 ? (
                    <span aria-hidden="true" className="flex items-center gap-1 @md:hidden">
                      <span>…</span>
                      <span>/</span>
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          </nav>
        )}
        {back ? heading : null}
        {/* On a phone the company takes what the row has left (and truncates). Beside a Back button it
            keeps room for its name and wraps to the next line, with Ask, rather than being cut to a few letters. */}
        <CompanyMenu
          className={
            back
              ? "max-sm:order-1 max-sm:basis-full"
              : "max-sm:min-w-0 max-sm:flex-1 max-sm:basis-16"
          }
        />
        {back ? end : null}
      </div>
      {heading && !back ? (
        <div className="flex min-h-10 flex-wrap items-center gap-3">
          {heading}
          {end}
        </div>
      ) : null}
    </>
  );
}

/**
 * The company menu, right after the page's title or way back, in the same place
 * on every Finance page. On a phone the company name truncates first.
 */
export function CompanyMenu({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    // A switcher button is pulled back by its padding so its text lines up with the title. The pull
    // is on this wrapper: on the button it narrowed the wrapper and cut the name short.
    <span
      className={cn("flex shrink flex-wrap items-center gap-x-0.5 has-[button]:-ms-2", className)}
    >
      <SpaceName />
      <span className="flex min-w-0 shrink items-center gap-0.5 text-xs text-muted-foreground">
        {children}
      </span>
      <ShowAmountsButton />
    </span>
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

export { ErrorNotice } from "../ErrorNotice";

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
  const here = hereCrumb(crumbs, useCameFrom(), `${location.pathname}${location.search}`);
  return (
    <BackHere value={here}>
      <div>
        <DetailHead
          crumbs={crumbs}
          title={notFound || error || loading ? undefined : title}
          actions={
            <>
              {action ? (
                <span className="flex items-center gap-2 max-sm:order-2">{action}</span>
              ) : null}
              <span className="max-sm:ms-auto">
                <AskAgentButton />
              </span>
            </>
          }
        />
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
            <StillLoading onRetry={onRetry} />
          </div>
        ) : (
          <>
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
        <div className="flex min-h-6 flex-wrap items-center gap-x-3 gap-y-2">
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
  alert,
}: {
  title: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  to?: string;
  hover?: ReactNode;
  /** Colors the figure as bad news, e.g. overdue items. */
  alert?: boolean;
}) {
  const body = (
    <>
      <h2 className="text-xs font-semibold text-muted-foreground">{title}</h2>
      <div
        className={cn(
          "mt-1 text-[22px] font-semibold leading-tight tabular-nums",
          alert && "text-destructive",
        )}
      >
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{sub ?? " "}</div>
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
}: {
  rows: BreakdownRow[];
  to: (row: BreakdownRow) => string;
}) {
  // While amounts are hidden the bar lengths would still show each share, so the bars stay empty.
  const hidden = useHideAmounts();
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
          className="group grid grid-cols-[minmax(0,1fr)_4.5rem_0.75rem] items-center gap-x-2.5 gap-y-1 rounded-lg px-2 py-1.5 outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-foreground @md:grid-cols-[minmax(0,2fr)_minmax(4rem,3fr)_4.5rem_0.75rem]"
        >
          <span className="truncate" title={row.label}>
            {row.label}
          </span>
          <span className="col-span-full row-start-2 block h-2 overflow-hidden rounded-sm bg-muted group-hover:bg-border @md:col-span-1 @md:row-start-auto">
            {hidden ? null : (
              // A small share keeps a short bar, at least 1.5 times as long as it is tall and squared
              // at its end, so it reads as the start of a bar rather than a dot.
              <i
                className={cn(
                  "block h-full min-w-3",
                  i < 2 ? "bg-foreground" : "bg-muted-foreground",
                )}
                style={{ width: `${Math.max((row.cents / top) * 100, 0)}%` }}
              />
            )}
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

export const Chevron = () => (
  <TableCell className="w-4 pe-0 text-end text-muted-foreground group-hover/row:text-foreground">
    <ChevronRight aria-hidden="true" className="ms-auto size-3.5" />
  </TableCell>
);

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
    <TableRow
      className="group/row cursor-pointer"
      {...rowProps(financePath.transaction(row.id), { ...back, preview: row })}
    >
      <TableCell className="hidden w-[4.5rem] whitespace-nowrap pe-2 text-muted-foreground @md:table-cell">
        {shortDay(txnDay(row))}
      </TableCell>
      <TableCell className="min-w-0 break-words py-3 pointer-coarse:py-1 @md:py-2">
        <Link
          state={{ ...back, preview: row }}
          to={financePath.transaction(row.id)}
          className="rk-tap max-w-full outline-none hover:underline focus-visible:underline"
        >
          {maskCurrencyWhenHidden(row.counterparty)}
        </Link>
        {/* Narrow, the date and category sit under the name instead of taking columns from it. */}
        <div className="truncate text-xs text-muted-foreground @md:hidden">
          {shortDay(txnDay(row))} · {categoryLabel(row)}
        </div>
        {row.memo ? (
          <div className="line-clamp-1 hidden text-xs text-muted-foreground @md:block">
            {maskCurrencyWhenHidden(row.memo)}
          </div>
        ) : null}
      </TableCell>
      <TableCell className="hidden truncate text-muted-foreground @2xl:table-cell">
        {categoryLabel(row)}
      </TableCell>
      <TableCell className="whitespace-nowrap ps-3 text-end tabular-nums">
        {listAmount(row.amountCents, undefined, row.currency)}
        {/* The Status column is hidden below @2xl, so a pending charge says so under its amount. */}
        {row.status === "pending" ? (
          <div className="text-xs text-muted-foreground @2xl:hidden">{statusLabel(row.status)}</div>
        ) : null}
      </TableCell>
      <TableCell className="hidden w-24 ps-4 text-muted-foreground @2xl:table-cell">
        {statusLabel(row.status)}
      </TableCell>
      <Chevron />
    </TableRow>
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
      <TableRow className="group/row cursor-pointer" onClick={() => setOpen((v) => !v)}>
        <TableCell className="hidden w-[4.5rem] pe-2 @md:table-cell">
          <ChevronRight
            aria-hidden="true"
            className={cn("size-3.5 text-muted-foreground", open && "rotate-90")}
          />
        </TableCell>
        <TableCell className="min-w-0 break-words">
          <button
            type="button"
            aria-expanded={open}
            className="text-start outline-none hover:underline focus-visible:underline"
          >
            <ChevronRight
              aria-hidden="true"
              className={cn(
                "me-1 inline size-3.5 text-muted-foreground @md:hidden",
                open && "rotate-90",
              )}
            />
            {name}
          </button>
          <div className="text-xs text-muted-foreground">
            {plural(count, { one: "# transaction", other: "# transactions" })}
          </div>
        </TableCell>
        <TableCell className="hidden truncate text-muted-foreground @2xl:table-cell">
          {group.mixed ? t`Mixed` : categoryLabel(group.rows[0] as FinanceTransaction)}
        </TableCell>
        <TableCell className="whitespace-nowrap ps-3 text-end tabular-nums">
          {listAmount(group.totalCents, undefined, group.currency)}
        </TableCell>
        <TableCell className="hidden w-24 @2xl:table-cell" />
        <TableCell />
      </TableRow>
      {open ? group.rows.map((row) => <TransactionRow key={row.id} row={row} />) : null}
    </>
  );
}

/** Transactions: date, counterparty and memo, category, signed amount, status. Each row opens the transaction. With `grouped`, one row per vendor. */
export function TransactionTable({
  rows,
  grouped = false,
  empty,
  sort,
}: {
  rows: FinanceTransaction[];
  grouped?: boolean;
  /** The current sort and the header click handler; without it the headers do not sort and the rows keep their order. */
  sort?: { value: Sort<TransactionSort>; onToggle: (field: TransactionSort) => void };
  /** What an empty list says; a page without a period picks its own words. */
  empty?: ReactNode;
}) {
  const sortHead = (field: TransactionSort) =>
    sort
      ? {
          sortDirection: sort.value.field === field ? sort.value.dir : null,
          onSort: () => sort.onToggle(field),
        }
      : {};
  return (
    // A fixed layout: every column but Counterparty has a set width, so opening a vendor, hiding
    // amounts or a longer name moves no column.
    <Table compact className="table-fixed">
      <TableHeader className={sort ? "max-sm:hidden" : undefined}>
        <TableHeadRow>
          {/* Named in both views: an opened vendor's rows show their dates and status here. */}
          <TableHead className="hidden w-[4.5rem] @md:table-cell" {...sortHead("date")}>
            <Trans>Date</Trans>
          </TableHead>
          <TableHead {...sortHead("counterparty")}>
            <Trans>Counterparty</Trans>
          </TableHead>
          <TableHead className="hidden w-48 @2xl:table-cell" {...sortHead("category")}>
            <Trans>Category</Trans>
          </TableHead>
          <TableHead className="text-end w-24 ps-3" {...sortHead("amount")}>
            <Trans>Amount</Trans>
          </TableHead>
          <TableHead className="hidden w-24 ps-4 @2xl:table-cell">
            <Trans>Status</Trans>
          </TableHead>
          <TableHead className="w-5" />
        </TableHeadRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={6} className="py-3 text-muted-foreground">
              {empty ?? <Trans>No transactions in this period</Trans>}
            </TableCell>
          </TableRow>
        ) : null}
        {grouped
          ? (sort
              ? sortTransactionGroups(groupByVendor(rows), sort.value, categoryLabel)
              : groupByVendor(rows)
            ).map((group) => <VendorGroupRows key={group.key} group={group} />)
          : rows.map((row) => <TransactionRow key={row.id} row={row} />)}
      </TableBody>
    </Table>
  );
}

const FILTER_PARAMS = ["q", "category", "status"] as const;

/**
 * A Transactions card whose header switches between the flat list and one row per vendor (the
 * choice is remembered for this page during the visit), with search, Category and Status filters
 * and sortable columns. They live in the URL as ?q=, category, status, sort and dir. `fixedCategory`
 * leaves out the Category filter on a page whose category the page itself already picks.
 */
export function TransactionsSection({
  title,
  rows,
  empty,
  fixedCategory = false,
  seeAll,
}: {
  title?: ReactNode;
  rows: FinanceTransaction[];
  empty?: ReactNode;
  fixedCategory?: boolean;
  /** The page with every row, search and filters. Set, the list shows 3 rows on a phone and 25 wide, then "See all (N)". */
  seeAll?: string;
}) {
  // Remembered per page, so choosing By vendor on one page does not hide dates on the next.
  const page = useLocation().pathname;
  const [preferGrouped, setGrouped] = useState(() => readGroupedPref(page));
  const choose = (next: boolean) => {
    setGrouped(next);
    writeGroupedPref(page, next);
  };
  const list = useListParams(TRANSACTION_SORTS, DEFAULT_TRANSACTION_SORT);
  const filters = {
    q: list.param("q"),
    category: fixedCategory ? undefined : list.param("category"),
    status: list.param("status"),
  };
  const filtered = Object.values(filters).some(Boolean);
  const sorted = sortTransactions(
    filterTransactions(rows, filters, categoryLabel),
    list.sort,
    categoryLabel,
  );
  // Grouping one vendor's charges by vendor changes nothing, so the switch is left out. It follows
  // all the rows, not the filtered ones, so filtering never makes the switch vanish.
  const manyVendors = groupByVendor(rows).length > 1;
  const grouped = preferGrouped && manyVendors;
  // A phone caps what is drawn, never what is totalled: By vendor caps whole vendors, so each
  // vendor's total still covers all its charges.
  const units: (FinanceTransaction | VendorGroup)[] = grouped
    ? sortTransactionGroups(groupByVendor(sorted), list.sort, categoryLabel)
    : sorted;
  const capped = useCappedRows(units, seeAll ? {} : { phone: Number.POSITIVE_INFINITY });
  const shown = capped.rows.flatMap((unit) => ("rows" in unit ? unit.rows : [unit]));
  // The full page lists transactions, so it matches only the flat list; the filters and sort go with it.
  const { search } = useLocation();
  const carried = new URLSearchParams(search);
  for (const key of [...carried.keys()])
    if (!["q", "status", "sort", "dir"].includes(key)) carried.delete(key);
  const fullPage =
    seeAll && !grouped
      ? `${seeAll}${carried.size ? `${seeAll.includes("?") ? "&" : "?"}${carried}` : ""}`
      : undefined;
  const unique = (values: string[]): [string, string][] =>
    [...new Set(values)].sort((a, b) => a.localeCompare(b)).map((v) => [v, v]);
  const statuses = [...new Set(rows.map((row) => row.status))];
  const sortNames: Record<TransactionSort, string> = {
    date: t`Date`,
    counterparty: t`Counterparty`,
    category: t`Category`,
    amount: t`Amount`,
  };
  const categories = unique(rows.map(categoryLabel));
  const toolbar =
    rows.length > 1 ? (
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <SearchField
          name="transactions-search"
          value={filters.q ?? ""}
          onChange={(value) => list.setParam("q", value)}
          placeholder={t`Search transactions`}
          label={t`Search transactions`}
          className="w-56"
        />
        {!fixedCategory && categories.length > 1 ? (
          <PickFilter
            label={t`Category`}
            value={filters.category}
            options={categories}
            onChange={(value) => list.setParam("category", value)}
          />
        ) : null}
        {statuses.length > 1 ? (
          <PickFilter
            label={t`Status`}
            value={filters.status}
            options={statuses.map((status) => [status, statusLabel(status)])}
            onChange={(value) => list.setParam("status", value)}
          />
        ) : null}
        {/* Wide, the column headers sort; narrow, they are not all shown. */}
        <span className="ms-auto flex items-center gap-1 @2xl:hidden">
          <SortControl
            fields={TRANSACTION_SORTS.map((field) => [field, sortNames[field]])}
            field={list.sort.field}
            fieldLabel={sortNames[list.sort.field]}
            direction={list.sort.dir}
            onField={(field) => list.setSort({ field, dir: "asc" })}
            onDirection={(dir) => list.setSort({ field: list.sort.field, dir })}
          />
        </span>
        {filtered ? (
          <Button variant="ghost" size="sm" onClick={() => list.clear(...FILTER_PARAMS)}>
            <Trans>Clear filters</Trans>
          </Button>
        ) : null}
      </div>
    ) : null;
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
      {toolbar}
      <TransactionTable
        rows={shown}
        grouped={grouped}
        sort={{ value: list.sort, onToggle: list.toggleSort }}
        empty={filtered ? <Trans>No matches</Trans> : empty}
      />
      {seeAll ? (
        <div className="mt-2 flex justify-end">
          <SeeAll list={capped} {...(fullPage ? { to: fullPage } : {})} />
        </div>
      ) : null}
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
        "inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs pointer-coarse:min-h-11",
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

/** The key for a BurnLines chart: Out, Revenue and Financing. */
export function BurnLegend() {
  return (
    <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-muted-foreground">
      <Legend className="bg-foreground">
        <Trans>Out</Trans>
      </Legend>
      <Legend className="bg-muted-foreground">
        <Trans>Revenue</Trans>
      </Legend>
      <Legend className="rounded-full border border-foreground bg-card">
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
    <HereLink to={to} className="rk-tap hover:underline pointer-coarse:-my-3">
      {children} <span aria-hidden="true">›</span>
    </HereLink>
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
  // While amounts are hidden the colour would still say which way spend went.
  // Under 10% is noise, not a warning.
  change === null || Math.abs(change) < 10 || getHideAmounts()
    ? ""
    : change < 0
      ? "text-success"
      : "text-destructive";
