import { Trans } from "@lingui/react/macro";
import type { UiBlock } from "@rakazo/ui-artifact";
import { parseUiArtifact } from "@rakazo/ui-artifact";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Separator,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableHeadRow,
  TableRow,
} from "@rakazo/ui-web";
import { cn } from "@rakazo/ui-web/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import { maskCurrencyWhenHidden, useHideAmounts } from "../lib/hide-amounts-preference";
import { niceRange, shade } from "./finance/charts";

const MASK = "•••";

type Chart = Extract<UiBlock, { type: "chart" }>;
type Say = (text: string) => string;

/**
 * A stored UI artifact, drawn with the app's own components. The source is parsed into a closed
 * set of blocks and every string is rendered as text, so nothing in it can add markup, links,
 * images, scripts or requests.
 */
export function UiArtifactView({ source, className }: { source: string; className?: string }) {
  const hidden = useHideAmounts();
  const parsed = useMemo(() => parseUiArtifact(source), [source]);
  const say: Say = (text) => (hidden ? maskCurrencyWhenHidden(text) : text);
  return (
    <div className={cn("h-full overflow-y-auto bg-background", className)}>
      <div className="mx-auto flex w-full max-w-[960px] flex-col gap-4 px-4 py-6 sm:px-8 sm:py-8">
        {parsed.blocks.map((block, index) => (
          <BlockView key={index} block={block} say={say} hidden={hidden} />
        ))}
        {parsed.problems.length || parsed.blocks.length === 0 ? <Unsupported /> : null}
      </div>
    </div>
  );
}

function Unsupported() {
  return (
    <p
      data-testid="ui-artifact-unsupported"
      className="rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground"
    >
      <Trans>Part of this can't be shown.</Trans>
    </p>
  );
}

function BlockView({ block, say, hidden }: { block: UiBlock; say: Say; hidden: boolean }) {
  const kids = (children: UiBlock[]) =>
    children.map((child, index) => (
      <BlockView key={index} block={child} say={say} hidden={hidden} />
    ));
  switch (block.type) {
    case "heading": {
      const level = block.level ?? 2;
      const Tag = level === 1 ? "h1" : level === 2 ? "h2" : "h3";
      return (
        <Tag
          className={cn(
            "font-semibold tracking-tight text-foreground",
            level === 1 ? "text-2xl" : level === 2 ? "text-lg" : "text-base",
          )}
        >
          {say(block.text)}
        </Tag>
      );
    }
    case "text":
      return (
        <p
          className={cn(
            "whitespace-pre-line text-sm leading-6",
            block.muted ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {say(block.text)}
        </p>
      );
    case "metric":
      return (
        <div className="flex min-w-0 flex-col gap-1 rounded-xl border border-border bg-card px-4 py-3">
          <span className="truncate text-xs text-muted-foreground">{say(block.label)}</span>
          <span className="truncate text-2xl font-semibold tabular-nums text-foreground">
            {say(block.value)}
          </span>
          {block.delta ? (
            <span
              className={cn(
                "truncate text-xs tabular-nums",
                block.delta.startsWith("+")
                  ? "text-success"
                  : block.delta.startsWith("-")
                    ? "text-destructive"
                    : "text-muted-foreground",
              )}
            >
              {say(block.delta)}
            </span>
          ) : null}
        </div>
      );
    case "table":
      return (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table compact className="text-[13px]">
            <TableHeader>
              <TableHeadRow className="bg-muted/50">
                {block.columns.map((column, index) => (
                  <TableHead
                    key={index}
                    className={cn(
                      "px-3 py-2 font-medium",
                      block.rows.some((row) => typeof row[index] === "number")
                        ? "text-end"
                        : "text-start",
                    )}
                  >
                    {say(column)}
                  </TableHead>
                ))}
              </TableHeadRow>
            </TableHeader>
            <TableBody>
              {block.rows.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  {block.columns.map((_, index) => {
                    const cell = row[index] ?? null;
                    return (
                      <TableCell
                        key={index}
                        className={cn(
                          "px-3 py-2",
                          typeof cell === "number" && "text-end font-mono tabular-nums",
                        )}
                      >
                        {cell === null
                          ? ""
                          : typeof cell === "number" && hidden
                            ? MASK
                            : say(String(cell))}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      );
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag
          className={cn(
            "flex flex-col gap-1 ps-5 text-sm leading-6 text-foreground",
            block.ordered ? "list-decimal" : "list-disc",
          )}
        >
          {block.items.map((item, index) => (
            <li key={index} className="whitespace-pre-line">
              {say(item)}
            </li>
          ))}
        </Tag>
      );
    }
    case "badge":
      return (
        <Badge
          variant={
            block.tone === "destructive" ? "destructive" : block.tone ? "outline" : "secondary"
          }
          className={cn(
            "self-start",
            block.tone === "success" && "border-success/40 text-success",
            block.tone === "warning" && "border-warning/40 text-warning",
          )}
        >
          {say(block.text)}
        </Badge>
      );
    case "divider":
      return <Separator />;
    case "chart":
      return <ChartView chart={block} say={say} hidden={hidden} />;
    case "card":
      return (
        <Card>
          {block.title ? (
            <CardHeader>
              <CardTitle>{say(block.title)}</CardTitle>
            </CardHeader>
          ) : null}
          <CardContent className="flex flex-col gap-3">{kids(block.children)}</CardContent>
        </Card>
      );
    case "stack":
      return <div className="flex flex-col gap-3">{kids(block.children)}</div>;
    case "grid":
      return (
        <div
          className={cn(
            "grid grid-cols-1 gap-3",
            (block.columns ?? 2) === 2 && "sm:grid-cols-2",
            block.columns === 3 && "sm:grid-cols-3",
            block.columns === 4 && "sm:grid-cols-2 lg:grid-cols-4",
          )}
        >
          {kids(block.children)}
        </div>
      );
    default:
      return <Unsupported />;
  }
}

const HEIGHT = 220;
const compact = (value: number) =>
  new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value);

function ChartView({ chart, say, hidden }: { chart: Chart; say: Say; hidden: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(480);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(Math.floor(el.clientWidth), 200));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [hidden]);

  if (chart.money && hidden) {
    return (
      <div data-testid="chart-hidden" className="rounded-md bg-muted" style={{ height: HEIGHT }} />
    );
  }
  const all = chart.series.flatMap((s) => s.values);
  const { step, top, floor } = niceRange(Math.min(...all, 0), Math.max(...all, 0));
  const left = 44;
  const right = 8;
  const topPad = 8;
  const bottom = 22;
  const plotW = width - left - right;
  const plotH = HEIGHT - topPad - bottom;
  const y = (v: number) => topPad + plotH - ((v - floor) / (top - floor || 1)) * plotH;
  const n = chart.labels.length;
  const slot = plotW / n;
  const x = (i: number) => left + slot * (i + 0.5);
  const ticks: number[] = [];
  for (let v = floor; v <= top + step / 2; v += step) ticks.push(v);
  const every = Math.ceil(n / Math.max(1, Math.floor(plotW / 64)));
  const barW = Math.min(28, (slot * 0.7) / chart.series.length);
  return (
    <figure className="flex flex-col gap-2">
      <div ref={ref} className="w-full" style={{ height: HEIGHT }}>
        <svg role="img" aria-label={chart.labels.map(say).join(", ")} width={width} height={HEIGHT}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={left} x2={width - right} y1={y(v)} y2={y(v)} className="stroke-border" />
              <text
                x={left - 6}
                y={y(v) + 4}
                textAnchor="end"
                className="fill-muted-foreground text-[11px]"
              >
                {compact(v)}
              </text>
            </g>
          ))}
          {chart.labels.map((label, i) =>
            i % every === 0 ? (
              <text
                key={i}
                x={x(i)}
                y={HEIGHT - 6}
                textAnchor="middle"
                className="fill-muted-foreground text-[11px]"
              >
                {say(label).slice(0, 12)}
              </text>
            ) : null,
          )}
          {chart.series.map((series, s) =>
            chart.kind === "bar" ? (
              <g key={s} fill={shade(s)}>
                {series.values.map((v, i) => (
                  <rect
                    key={i}
                    x={x(i) - (barW * chart.series.length) / 2 + s * barW}
                    y={Math.min(y(v), y(0))}
                    width={Math.max(barW - 2, 1)}
                    height={Math.abs(y(v) - y(0))}
                    rx={2}
                  />
                ))}
              </g>
            ) : (
              <polyline
                key={s}
                fill="none"
                stroke={shade(s)}
                strokeWidth={2}
                strokeLinejoin="round"
                points={series.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
              />
            ),
          )}
        </svg>
      </div>
      {chart.series.length > 1 ? (
        <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {chart.series.map((series, s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: shade(s) }} />
              {say(series.name)}
            </span>
          ))}
        </figcaption>
      ) : null}
    </figure>
  );
}
