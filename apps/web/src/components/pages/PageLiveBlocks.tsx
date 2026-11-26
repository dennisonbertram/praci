import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type {
  PageMetricBlock as MetricSpec,
  PageLiveBlock,
  PageTableBlock as TableSpec,
} from "@rakazo/contracts";
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@rakazo/ui-web";
import type { ReactNode } from "react";
import { maskCurrencyText, useHideAmounts } from "../../lib/hide-amounts-preference";
import { formatMailTime } from "../../lib/mail-time";
import { cellValue, formatCell, tableColumns, usePageLive } from "../../pages/shell/page-live";
import { Shimmer } from "../ai/primitives";

/** What a live block shows while it has nothing to show, by status. */
function placeholder(block: PageLiveBlock | undefined): string {
  switch (block?.status) {
    case "pending":
      return t`Waiting for approval`;
    case "paused":
      return t`Paused`;
    case "denied":
      return t`Not approved`;
    case "missing":
      return t`Source not found`;
    default:
      return t`No data yet`;
  }
}

const fetchedAtText = (fetchedAt: string | null | undefined) =>
  fetchedAt ? formatMailTime(fetchedAt) : "";

/**
 * Status treatment shared by metrics, tables and live charts: a warning dot with the error and
 * Retry when the latest refresh failed, a muted fetch time on hover or focus, and `refreshing`
 * (also before the first load) dims the content.
 */
export function LiveBlockFrame({
  block,
  hasValue,
  label,
  pulse = true,
  children,
}: {
  block: PageLiveBlock | undefined;
  /** False shows the status placeholder instead of the children. */
  hasValue: boolean;
  /** Shown at the start of the header row; without one, the status sits over the content's corner. */
  label?: string;
  /** Dims and pulses the content while refreshing; text content shimmers itself instead. */
  pulse?: boolean;
  children: ReactNode;
}) {
  const live = usePageLive();
  const busy = live.refreshing || !live.loaded;
  const time = fetchedAtText(block?.fetchedAt);
  const stale = (block?.status === "failed" || block?.status === "paused") && hasValue;
  return (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: focus reveals the fetch time, like hover
    <div tabIndex={0} aria-busy={busy} className="group/live relative min-w-0 outline-none">
      <div
        className={`flex h-4 items-center justify-between gap-1.5 text-xs text-muted-foreground ${label ? "mb-1" : "absolute end-0 top-0 z-10"}`}
      >
        {label ? <span className="min-w-0 truncate">{label}</span> : null}
        <span className="flex items-center gap-1.5">
          {time ? (
            <span
              className={
                stale
                  ? undefined
                  : "opacity-0 transition-opacity group-hover/live:opacity-100 group-focus-within/live:opacity-100 group-focus/live:opacity-100"
              }
            >
              {time}
            </span>
          ) : null}
          {block?.status === "failed" ? (
            <FailedDot error={block.error} onRetry={live.refresh} />
          ) : block?.status === "paused" ? (
            <FailedDot error={block.error} />
          ) : null}
        </span>
      </div>
      <div className={busy && pulse ? "animate-pulse" : undefined}>
        {hasValue ? (
          children
        ) : (
          <p className="text-sm text-muted-foreground">
            {busy ? (
              <Shimmer>{t`Refreshing`}</Shimmer>
            ) : block?.status === "pending" && live.onReview ? (
              <button
                type="button"
                className="rounded-sm underline underline-offset-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                onClick={live.onReview}
              >
                {placeholder(block)}
              </button>
            ) : (
              placeholder(block)
            )}
          </p>
        )}
      </div>
    </div>
  );
}

/** A failed source offers Retry; a paused one (no `onRetry`) cannot be retried. */
function FailedDot({ error, onRetry }: { error?: string; onRetry?: () => void }) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={onRetry ? t`Source failed` : t`Source paused`}
            className="flex size-4 items-center justify-center rounded-full"
          />
        }
      >
        <span className="size-2 rounded-full bg-warning" />
      </PopoverTrigger>
      <PopoverContent align="end">
        <p className="break-words text-muted-foreground">{error}</p>
        {onRetry ? (
          <Button size="sm" variant="secondary" className="w-fit" onClick={onRetry}>
            <Trans>Retry</Trans>
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

export function PageMetricBlock({
  block,
  data,
}: {
  block: MetricSpec;
  data: PageLiveBlock | undefined;
}) {
  const hidden = useHideAmounts();
  const { refreshing, loaded } = usePageLive();
  const text = data?.text;
  const shown =
    text === undefined ? "" : hidden && block.format === "usd" ? maskCurrencyText(text) : text;
  return (
    <section className="rounded-xl border border-border p-4">
      <LiveBlockFrame block={data} label={block.label} pulse={false} hasValue={text !== undefined}>
        <p className="text-2xl font-semibold tabular-nums">
          {refreshing || !loaded ? <Shimmer>{shown}</Shimmer> : shown}
        </p>
      </LiveBlockFrame>
    </section>
  );
}

export function PageTableBlock({
  block,
  data,
}: {
  block: TableSpec;
  data: PageLiveBlock | undefined;
}) {
  const hidden = useHideAmounts();
  const rows = data?.rows;
  const columns = tableColumns(block.columns, rows ?? []);
  return (
    <section className="rounded-xl border border-border p-4">
      <LiveBlockFrame
        block={data}
        label={block.name}
        hasValue={rows !== undefined && rows.length > 0}
      >
        <Table compact>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.key}>{column.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {(rows ?? []).map((row, index) => (
              <TableRow key={index}>
                {columns.map((column) => (
                  <TableCell key={column.key} className="tabular-nums">
                    {maskIfHidden(
                      hidden,
                      column.format,
                      formatCell(cellValue(row, column.key), column.format),
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </LiveBlockFrame>
    </section>
  );
}

const maskIfHidden = (hidden: boolean, format: string | undefined, text: string) =>
  hidden && format === "usd" ? maskCurrencyText(text) : text;

/** The frame for a chart with a source; the chart itself is drawn by the caller. */
export function PageChartFrame({
  data,
  children,
}: {
  data: PageLiveBlock | undefined;
  children: ReactNode;
}) {
  return (
    <LiveBlockFrame
      block={data}
      hasValue={
        data?.status !== "missing" && data?.status !== "pending" && data?.status !== "denied"
      }
    >
      {children}
    </LiveBlockFrame>
  );
}
