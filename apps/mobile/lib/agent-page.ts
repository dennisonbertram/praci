import type {
  PageLiveBlock,
  PageLiveStatus,
  PinFormat,
  SidebarPagesState,
} from "@rakazo/contracts";
import type { PageSegment } from "@rakazo/core";
import { htmlPageDataScript, splitPage } from "@rakazo/core";

/** A table cell or metric value; `usd` values are masked while amounts are hidden. */
export type LiveCell = { text: string; usd: boolean };

/** What a live block shows. `value` is missing when the source has produced nothing to show. */
type Live = { status: PageLiveStatus; error?: string };

export type PageBlock =
  | { kind: "markdown"; text: string }
  | { kind: "chart"; name: string; svg: string }
  | { kind: "chart_error" }
  | ({ kind: "metric"; label: string; value?: LiveCell } & Live)
  | ({
      kind: "table";
      name: string;
      /** First column is the title; the rest are "Label: value" details. */
      rows: { title: LiveCell; details: LiveCell[] }[];
      hasRows: boolean;
    } & Live);

/** Same rules as the server's pin formatter, for table cells (metric text arrives formatted). */
export function formatCell(value: unknown, format?: PinFormat): string {
  if (value === null || value === undefined) return "";
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (format && format !== "text" && typeof n === "number" && Number.isFinite(n)) {
    if (format === "percent") return `${n.toFixed(1)}%`;
    if (format === "number") return new Intl.NumberFormat("en-US").format(n);
    const digits = Math.abs(n) >= 1000 ? 0 : 2;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(n);
  }
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function tableRows(
  columns: { key: string; label: string; format?: PinFormat }[] | undefined,
  rows: unknown[],
) {
  const first = rows[0];
  const cols =
    columns ??
    (isRecord(first) ? Object.keys(first) : ["value"]).map((key) => ({
      key,
      label: key,
      format: undefined as PinFormat | undefined,
    }));
  const cell = (row: unknown, column: (typeof cols)[number]): LiveCell => ({
    text: formatCell(
      isRecord(row) ? row[column.key] : column.key === "value" ? row : undefined,
      column.format,
    ),
    usd: column.format === "usd",
  });
  return rows.map((row) => ({
    title: cell(row, cols[0] as (typeof cols)[number]),
    details: cols.slice(1).map((column) => {
      const value = cell(row, column);
      return { ...value, text: `${column.label}: ${value.text}` };
    }),
  }));
}

/**
 * Pair each valid chart segment with the Nth server-rendered SVG, and each live segment with the
 * Nth entry of `pages.data` (metric and table fences and charts with a source, in document
 * order; static charts are skipped). Invalid fences, and charts the server returned no SVG for,
 * become an error line instead of a chart. Metric and table blocks with no data yet keep their
 * status so the screen can say why.
 */
export function pageBlocks(
  content: string,
  chartSvgs: string[] = [],
  live: PageLiveBlock[] = [],
): PageBlock[] {
  let chartIndex = 0;
  let liveIndex = 0;
  return splitPage(content).flatMap((segment: PageSegment): PageBlock[] => {
    if (segment.kind === "markdown") return [segment];
    if (segment.kind === "invalid_chart" || segment.kind === "invalid_live")
      return [{ kind: "chart_error" }];
    if (segment.kind === "gtm" || segment.kind === "invalid_gtm") return [];
    if (segment.kind === "metric") {
      const data = live[liveIndex++];
      return [
        {
          kind: "metric",
          label: segment.block.label,
          status: data?.status ?? "empty",
          error: data?.error,
          value:
            data?.text === undefined
              ? undefined
              : { text: data.text, usd: segment.block.format === "usd" },
        },
      ];
    }
    if (segment.kind === "table") {
      const data = live[liveIndex++];
      return [
        {
          kind: "table",
          name: segment.block.name,
          status: data?.status ?? "empty",
          error: data?.error,
          rows: tableRows(segment.block.columns, data?.rows ?? []),
          hasRows: (data?.rows?.length ?? 0) > 0,
        },
      ];
    }
    if (segment.chart.source !== undefined) liveIndex++;
    const svg = chartSvgs[chartIndex++];
    return [svg ? { kind: "chart", name: segment.chart.name, svg } : { kind: "chart_error" }];
  });
}

/** The bot pages the user added to the sidebar, as rows that open `agent-page`. Template rows are web-only. */
export function sidebarBotPages(state: SidebarPagesState) {
  return state.pages.flatMap((page) => ("pageId" in page ? [page] : []));
}

export { htmlPageDataScript };
