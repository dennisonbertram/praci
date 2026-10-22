import { i18n } from "@lingui/core";
import { plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { DataRoomApiStats } from "@rakazo/contracts";
import { Button, Skeleton } from "@rakazo/ui-web";
import { MASK } from "../../lib/finance-format";
import { useHideAmounts } from "../../lib/hide-amounts-preference";
import { niceScale } from "../finance/charts";
import { Tip } from "../ListControls";
import { sourceLabel } from "./FilterBar";
import { sizeText, typeLabel } from "./format";
import type { Filters } from "./use-data-room-list";

/** The filter a click on a bar or row applies; the page then shows the list. */
export type StatsPick = Pick<
  Filters,
  "docType" | "party" | "source" | "status" | "docDateFrom" | "docDateTo"
>;

/** The first and last moment of a "YYYY-MM" or "YYYY" bucket, as the date filters take them. */
export function bucketRange(key: string): Pick<StatsPick, "docDateFrom" | "docDateTo"> {
  const year = Number(key.slice(0, 4));
  const month = key.length > 4 ? Number(key.slice(5, 7)) : null;
  const start = new Date(Date.UTC(year, month ? month - 1 : 0, 1));
  const end = new Date(Date.UTC(month ? year : year + 1, month ?? 0, 1) - 1);
  return { docDateFrom: start.toISOString(), docDateTo: end.toISOString() };
}

const bucketLabel = (key: string) =>
  key.length > 4
    ? new Intl.DateTimeFormat(i18n.locale || undefined, {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${key}-01T00:00:00Z`))
    : key;

const money = (cents: number, currency: string) => {
  try {
    return new Intl.NumberFormat(i18n.locale || undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return String(cents / 100);
  }
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-lg border border-border bg-card p-3">
      <h3 className="mb-2 text-xs font-medium text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Card({ label, value, onPick }: { label: string; value: string; onPick?: () => void }) {
  const body = (
    <>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums">{value}</p>
    </>
  );
  const box = "rounded-lg border border-border bg-card p-3";
  return onPick ? (
    <button type="button" onClick={onPick} className={`${box} text-start hover:bg-muted`}>
      {body}
    </button>
  ) : (
    <div className={box}>{body}</div>
  );
}

/** Rows with a bar behind each; a row with `onPick` is a button. */
function BarRows({
  rows,
}: {
  rows: { key: string; label: string; count: number; text?: string; onPick?: () => void }[];
}) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <ul className="flex flex-col gap-1">
      {rows.map((row) => {
        const body = (
          <>
            <span
              aria-hidden="true"
              className="absolute inset-y-0 start-0 rounded-sm bg-foreground/10"
              style={{ width: `${(row.count / max) * 100}%` }}
            />
            <span className="relative min-w-0 flex-1 truncate text-start">{row.label}</span>
            <span className="relative text-muted-foreground tabular-nums">
              {row.text ?? new Intl.NumberFormat(i18n.locale || undefined).format(row.count)}
            </span>
          </>
        );
        const cls = "relative flex w-full items-center gap-2 px-2 py-1 text-sm";
        return (
          <li key={row.key} title={`${row.label}: ${row.text ?? row.count}`}>
            {row.onPick ? (
              <button
                type="button"
                onClick={row.onPick}
                className={`${cls} rounded-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring`}
              >
                {body}
              </button>
            ) : (
              <div className={cls}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function OverTime({
  dates,
  onPick,
}: {
  dates: DataRoomApiStats["dates"];
  onPick: (key: string) => void;
}) {
  const { buckets } = dates;
  const top = niceScale(Math.max(...buckets.map((b) => b.count))).top;
  return (
    <div>
      <div className="flex h-32 items-stretch gap-px">
        <span className="me-1 self-start text-xs text-muted-foreground tabular-nums">{top}</span>
        {buckets.map((bucket) => (
          <Tip key={bucket.key} label={`${bucketLabel(bucket.key)}: ${bucket.count}`}>
            <button
              type="button"
              aria-label={`${bucketLabel(bucket.key)}: ${bucket.count}`}
              onClick={() => onPick(bucket.key)}
              className="group flex min-w-0 flex-1 flex-col items-center justify-end focus-visible:outline-2 focus-visible:outline-ring"
            >
              {/* A few buckets would otherwise stretch to bars as wide as the page. */}
              <span
                className="w-full max-w-6 rounded-t-sm bg-foreground/70 group-hover:bg-foreground"
                style={{
                  height: `${(bucket.count / top) * 100}%`,
                  minHeight: bucket.count ? 2 : 0,
                }}
              />
            </button>
          </Tip>
        ))}
      </div>
      <div className="mt-1 flex justify-between ps-5 text-xs text-muted-foreground">
        <span>{bucketLabel(buckets[0]?.key ?? "")}</span>
        <span>{bucketLabel(buckets.at(-1)?.key ?? "")}</span>
      </div>
    </div>
  );
}

/**
 * Counts and sizes of the documents in the open folder under the current filters. `scope` names
 * them; a click on a type, party, source or month hands its filter to `onPick`.
 */
export function DataRoomStats({
  stats,
  scope,
  filtered,
  onClearFilters,
  onPick,
  onOpenItem,
  error,
  onRetry,
}: {
  /** Null while the first answer is on its way. */
  stats: DataRoomApiStats | null;
  scope: string;
  filtered: boolean;
  onClearFilters: () => void;
  onPick: (pick: StatsPick) => void;
  onOpenItem: (id: string) => void;
  error?: string;
  onRetry?: () => void;
}) {
  const hidden = useHideAmounts();
  const header = (
    <div className="flex flex-wrap items-center gap-x-2 text-sm">
      <h2 className="min-w-0 truncate font-medium">{scope}</h2>
      {filtered ? (
        <Button variant="link" size="xs" className="h-auto p-0" onClick={onClearFilters}>
          <Trans>Clear filters</Trans>
        </Button>
      ) : null}
    </div>
  );
  if (error) {
    return (
      <div className="flex flex-col gapy-3 px-4 md:px-7 p-3">
        {header}
        <div className="flex items-center gap-3 text-sm text-destructive">
          {error}
          {onRetry ? (
            <Button variant="outline" size="sm" onClick={onRetry}>
              <Trans>Retry</Trans>
            </Button>
          ) : null}
        </div>
      </div>
    );
  }
  if (!stats) {
    return (
      <div className="flex flex-col gapy-3 px-4 md:px-7 p-3" aria-busy="true">
        {header}
        <div className="grid grid-cols-2 gap-2 @min-[640px]/stats:grid-cols-4">
          {[0, 1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-16" />
          ))}
        </div>
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (stats.documents === 0) {
    return (
      <div className="flex flex-col gapy-3 px-4 md:px-7 p-3">
        {header}
        <p className="p-6 text-center text-sm text-muted-foreground">
          <Trans>No results</Trans>
        </p>
      </div>
    );
  }
  const searchable = Math.round((stats.status.ready / stats.documents) * 100);
  const statusRows = [
    { key: "ready", label: t`Ready`, count: stats.status.ready },
    { key: "processing", label: t`Reading`, count: stats.status.processing },
    { key: "notSearchable", label: t`Not searchable`, count: stats.status.notSearchable },
    {
      key: "failed",
      label: t`Failed`,
      count: stats.status.failed,
      onPick: () => onPick({ status: "failed" }),
    },
  ].filter((row) => row.count > 0);
  return (
    <div className="@container/stats flex flex-col gapy-3 px-4 md:px-7 p-3">
      {header}
      <div className="grid grid-cols-2 gap-2 @min-[640px]/stats:grid-cols-4">
        <Card
          label={t`Documents`}
          value={new Intl.NumberFormat(i18n.locale || undefined).format(stats.documents)}
        />
        <Card label={t`Size`} value={sizeText(stats.bytes)} />
        <Card label={t`Read and searchable`} value={`${searchable}%`} />
        <Card
          label={t`Failed`}
          value={String(stats.status.failed)}
          onPick={stats.status.failed > 0 ? () => onPick({ status: "failed" }) : undefined}
        />
      </div>
      {stats.dates.buckets.length > 0 ? (
        <Section title={t`Documents by document date`}>
          <OverTime dates={stats.dates} onPick={(key) => onPick(bucketRange(key))} />
        </Section>
      ) : null}
      <div className="grid gap-3 @min-[640px]/stats:grid-cols-2">
        {stats.types.length > 0 ? (
          <Section title={t`Types`}>
            <BarRows
              rows={stats.types.map(({ value, count }) => ({
                key: value,
                label: typeLabel(value),
                count,
                onPick: () => onPick({ docType: value }),
              }))}
            />
          </Section>
        ) : null}
        {/* One source filters nothing, as with the Source filter: it is offered from two. */}
        {stats.sources.length > 1 ? (
          <Section title={t`Sources`}>
            <BarRows
              rows={stats.sources.map(({ value, count }) => ({
                key: value,
                label: sourceLabel(value),
                count,
                onPick: () => onPick({ source: value }),
              }))}
            />
          </Section>
        ) : null}
        {stats.parties.length > 0 ? (
          <Section title={t`Top parties`}>
            <BarRows
              rows={stats.parties.map(({ value, count }) => ({
                key: value,
                label: value,
                count,
                onPick: () => onPick({ party: value }),
              }))}
            />
          </Section>
        ) : null}
        <Section title={t`Largest files`}>
          <BarRows
            rows={stats.largest.map((file) => ({
              key: file.id,
              label: file.name,
              count: file.size,
              text: sizeText(file.size),
              onPick: () => onOpenItem(file.id),
            }))}
          />
        </Section>
        <Section title={t`Status`}>
          <BarRows rows={statusRows} />
          {stats.duplicates > 0 ? (
            <p className="mt-2 px-2 text-sm text-muted-foreground">
              {plural(stats.duplicates, { one: "# duplicate", other: "# duplicates" })}
            </p>
          ) : null}
        </Section>
        {stats.amounts.length > 0 ? (
          <Section title={t`Amounts`}>
            <BarRows
              rows={stats.amounts.map((row) => ({
                key: `${row.docType}-${row.currency}`,
                label: row.docType ? typeLabel(row.docType) : "—",
                // No bar: its length would show the amounts that are hidden.
                count: 0,
                text: hidden ? `$${MASK}` : money(row.cents, row.currency),
              }))}
            />
          </Section>
        ) : null}
      </div>
    </div>
  );
}
