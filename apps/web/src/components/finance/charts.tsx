import { Trans } from "@lingui/react/macro";
import type { CashPoint } from "@rakazo/contracts";
import { useEffect, useId, useRef, useState } from "react";
import {
  axisMoney,
  dayAxisLabels,
  dayMonth,
  money,
  monthAxisLabels,
  weekdayShort,
} from "../../lib/finance-format";
import { useHideAmounts } from "../../lib/hide-amounts-preference";

/** Gridline step and top value (in cents) so about three to four lines cover `max`. */
export function niceScale(max: number): { step: number; top: number } {
  const safe = Math.max(max, 1);
  const unit = 10 ** Math.floor(Math.log10(safe / 3));
  let step = unit;
  for (const m of [1, 2, 5, 10]) {
    step = m * unit;
    if (safe / step <= 4) break;
  }
  return { step, top: Math.max(step, Math.ceil(safe / step) * step) };
}

/** Like `niceScale`, but also reaching down to `min` when it is below zero (`floor` is then negative). */
export function niceRange(min: number, max: number): { step: number; top: number; floor: number } {
  if (min >= 0) return { ...niceScale(max), floor: 0 };
  const { step } = niceScale(Math.max(max, 0) - min);
  return {
    step,
    top: Math.max(step, Math.ceil(Math.max(max, 0) / step) * step),
    floor: Math.floor(min / step) * step,
  };
}

/** Monochrome fills for stacked segments and their legend swatches; index 0 is darkest. */
export const shade = (index: number) =>
  `color-mix(in srgb, var(--foreground) ${[100, 78, 60, 46, 34, 24, 16][index % 7]}%, var(--card))`;

/** An SVG drawn at the container's width, so text keeps a fixed size at any width. */
export function Chart({
  height,
  label,
  children,
}: {
  height: number;
  label: string;
  children: (width: number) => React.ReactNode;
}) {
  // A chart's shape alone shows trends and when cash runs out, so it is not drawn while hidden.
  const hidden = useHideAmounts();
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(Math.floor(el.clientWidth));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  if (hidden)
    return (
      <div
        data-testid="chart-hidden"
        className="grid w-full place-items-center rounded-md bg-muted text-[13px] text-muted-foreground"
        style={{ height }}
      >
        {height >= 40 ? <Trans>Chart hidden while amounts are hidden</Trans> : null}
      </div>
    );
  return (
    <div ref={ref} className="w-full" style={{ height }}>
      {width > 0 ? (
        <svg
          role="img"
          aria-label={label}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="block"
        >
          {children(width)}
        </svg>
      ) : null}
    </div>
  );
}

function Grid({
  width,
  height,
  left,
  right,
  top,
  bottom,
  scale,
}: {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  scale: { step: number; top: number; floor?: number };
}) {
  useHideAmounts();
  const floor = scale.floor ?? 0;
  const lines: number[] = [];
  // With nothing to plot every step rounds to "$0"; one $0 line is drawn instead of a stack of them.
  for (let v = floor; v <= scale.top; v += scale.step)
    if (lines.length === 0 || axisMoney(v) !== axisMoney(lines.at(-1) as number)) lines.push(v);
  return (
    <>
      {lines.map((v) => {
        const y = top + (height - top - bottom) * (1 - (v - floor) / (scale.top - floor));
        return (
          <g key={v}>
            <line
              x1={left}
              x2={width - right}
              y1={y}
              y2={y}
              className="stroke-border"
              strokeWidth={1}
            />
            <text
              x={left - 6}
              y={y + 3}
              textAnchor="end"
              className="fill-muted-foreground"
              fontSize={10}
            >
              {axisMoney(v)}
            </text>
          </g>
        );
      })}
    </>
  );
}

/**
 * A line over equally spaced points. Points after `solidUntil` are dashed, `endMarker` draws a hollow
 * dot on the last point (a projection that reaches zero). Without axes it is a bare trend line.
 */
export function LineChart({
  values,
  labels,
  height,
  label,
  axes = true,
  solidUntil,
  endMarker,
}: {
  values: number[];
  labels: string[];
  height: number;
  label: string;
  axes?: boolean;
  solidUntil?: number;
  endMarker?: boolean;
}) {
  return (
    <Chart height={height} label={label}>
      {(width) => {
        if (values.length === 0) return null;
        const left = axes ? 46 : 4;
        const right = axes ? 10 : 4;
        const top = axes ? 10 : 4;
        const bottom = axes ? 22 : 4;
        const maxValue = Math.max(...values, 0);
        // A balance can dip below zero; the axis reaches down to it instead of clipping the line.
        const scale = niceRange(Math.min(...values), maxValue);
        const hi = axes ? scale.top : maxValue;
        const lo = axes ? scale.floor : Math.min(...values);
        const x = (i: number) =>
          values.length < 2 ? left : left + (i * (width - left - right)) / (values.length - 1);
        const y = (v: number) => top + (height - top - bottom) * (1 - (v - lo) / (hi - lo || 1));
        const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
        const solid = Math.min(solidUntil ?? values.length - 1, values.length - 1);
        const every = Math.max(
          1,
          Math.ceil(46 / ((width - left - right) / (values.length - 1 || 1))),
        );
        return (
          <>
            {axes ? (
              <>
                <Grid
                  width={width}
                  height={height}
                  left={left}
                  right={right}
                  top={top}
                  bottom={bottom}
                  scale={scale}
                />
                {labels.map((text, i) =>
                  i % every === 0 ? (
                    <text
                      key={i}
                      x={x(i)}
                      y={height - 6}
                      textAnchor="middle"
                      className="fill-muted-foreground"
                      fontSize={10}
                    >
                      {text}
                    </text>
                  ) : null,
                )}
              </>
            ) : null}
            <polyline
              points={points.slice(0, solid + 1).join(" ")}
              fill="none"
              className="stroke-foreground"
              strokeWidth={1.75}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {solid < values.length - 1 ? (
              <polyline
                points={points.slice(solid).join(" ")}
                fill="none"
                className="stroke-foreground"
                strokeWidth={1.75}
                strokeDasharray="5 4"
                strokeLinecap="round"
              />
            ) : null}
            <circle cx={x(solid)} cy={y(values[solid] ?? 0)} r={3} className="fill-foreground" />
            {endMarker ? (
              <circle
                cx={x(values.length - 1)}
                cy={y(values[values.length - 1] ?? 0)}
                r={3}
                className="fill-card stroke-foreground"
                strokeWidth={1.5}
              />
            ) : null}
          </>
        );
      }}
    </Chart>
  );
}

const keyActivate = (action: () => void) => (event: React.KeyboardEvent) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    action();
  }
};

export type BarGranularity = "day" | "week" | "month";

/** Axis labels: weekdays for a week of days, day numbers for more days, `Oct 6` for weeks, `Oct` for months (years on the first tick and January). */
function barLabels(series: CashPoint[], granularity: BarGranularity): string[] {
  if (granularity === "month") return monthAxisLabels(series.map((p) => p.start.slice(0, 7)));
  if (granularity === "week") return dayAxisLabels(series.map((p) => p.start));
  return series.map((p) =>
    series.length <= 7 ? weekdayShort(p.start) : String(Number(p.start.slice(8, 10))),
  );
}

/** Out, revenue and financing for each bucket; each bucket opens its detail. */
export function BurnBars({
  series,
  granularity = "month",
  height = 230,
  onOpen,
  label,
}: {
  series: CashPoint[];
  granularity?: BarGranularity;
  height?: number;
  onOpen: (point: CashPoint) => void;
  label: string;
}) {
  useHideAmounts();
  const hatch = useId();
  return (
    <Chart height={height} label={label}>
      {(width) => {
        const left = 40;
        const right = 4;
        const bottom = 24;
        // The scale follows spend and revenue; a raise many times larger would flatten every other
        // bar, so a financing bar taller than the scale is cut at the top and labelled instead.
        const max = Math.max(...series.flatMap((m) => [m.outCents, m.revenueCents]), 0);
        const scale = niceScale(
          max > 0 ? max : Math.max(...series.map((m) => m.financingCents), 0),
        );
        const clipped = series.some((m) => m.financingCents > scale.top);
        const top = clipped ? 22 : 10;
        const slot = (width - left - right) / Math.max(series.length, 1);
        const bw = Math.min(17, slot * 0.28);
        // Skip labels that would collide, counting back from the newest bar.
        const labelEvery = Math.max(1, Math.ceil(36 / slot));
        const names = barLabels(series, granularity);
        const y = (v: number) => top + (height - top - bottom) * (1 - v / scale.top);
        const bar = (v: number) => Math.max(height - bottom - y(v), 0);
        return (
          <>
            <defs>
              <pattern
                id={hatch}
                width={5}
                height={5}
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <rect width={5} height={5} className="fill-card" />
                <line x1={0} y1={0} x2={0} y2={5} className="stroke-foreground" strokeWidth={2} />
              </pattern>
            </defs>
            <Grid
              width={width}
              height={height}
              left={left}
              right={right}
              top={top}
              bottom={bottom}
              scale={scale}
            />
            {series.map((m, i) => {
              const c = left + slot * (i + 0.5);
              const two = m.revenueCents > 0 || m.financingCents > 0;
              const outX = two ? c - bw - 1 : c - bw / 2;
              const name = names[i] ?? "";
              const showLabel = (series.length - 1 - i) % labelEvery === 0;
              return (
                // biome-ignore lint/a11y/useSemanticElements: an SVG group cannot be an <a> that the router can drive
                <g
                  key={m.start}
                  role="link"
                  tabIndex={0}
                  aria-label={`${granularity === "month" ? name : dayMonth(m.start)}: ${money(m.outCents)}`}
                  className="group cursor-pointer outline-none"
                  onClick={() => onOpen(m)}
                  onKeyDown={keyActivate(() => onOpen(m))}
                >
                  <rect
                    x={left + slot * i}
                    y={top}
                    width={slot}
                    height={height - top - bottom}
                    className="fill-transparent group-hover:fill-muted group-focus-visible:fill-muted"
                  />
                  <rect
                    x={outX}
                    y={y(m.outCents)}
                    width={bw}
                    height={bar(m.outCents)}
                    rx={2}
                    className={m.partial ? "fill-card stroke-foreground" : "fill-foreground"}
                    strokeWidth={m.partial ? 1.5 : 0}
                    strokeDasharray={m.partial ? "3 2" : undefined}
                  />
                  {m.revenueCents > 0 ? (
                    <rect
                      x={c + 1}
                      y={y(m.revenueCents)}
                      width={bw}
                      height={bar(m.revenueCents)}
                      rx={2}
                      className="fill-muted-foreground"
                    />
                  ) : null}
                  {m.financingCents > 0 ? (
                    <rect
                      x={c + 1}
                      y={y(Math.min(m.financingCents, scale.top))}
                      width={bw}
                      height={bar(Math.min(m.financingCents, scale.top))}
                      rx={2}
                      fill={`url(#${hatch})`}
                      className="stroke-foreground"
                      strokeWidth={1}
                    />
                  ) : null}
                  {m.financingCents > scale.top ? (
                    <text
                      data-testid="financing-clipped"
                      x={c + 1 + bw / 2}
                      y={top - 6}
                      textAnchor="middle"
                      className="fill-foreground"
                      fontSize={10}
                    >
                      {`↑ ${money(m.financingCents)}`}
                    </text>
                  ) : null}
                  {showLabel ? (
                    <text
                      x={c}
                      y={height - 8}
                      textAnchor="middle"
                      className="fill-muted-foreground"
                      fontSize={10}
                      fontWeight={m.partial ? 700 : 400}
                    >
                      {name}
                      {m.partial ? "*" : ""}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </>
        );
      }}
    </Chart>
  );
}

/** One bar per item with its amount above it. */
export function MonthBars({
  items,
  height = 200,
  label,
}: {
  items: { label: string; cents: number }[];
  height?: number;
  label: string;
}) {
  useHideAmounts();
  return (
    <Chart height={height} label={label}>
      {(width) => {
        const left = 46;
        const right = 6;
        const top = 18;
        const bottom = 22;
        const scale = niceScale(Math.max(...items.map((x) => x.cents), 0));
        const slot = (width - left - right) / Math.max(items.length, 1);
        const bw = Math.min(40, slot * 0.5);
        return (
          <>
            <Grid
              width={width}
              height={height}
              left={left}
              right={right}
              top={top}
              bottom={bottom}
              scale={scale}
            />
            {items.map((item, i) => {
              const cx = left + slot * (i + 0.5);
              const y = top + (height - top - bottom) * (1 - item.cents / scale.top);
              return (
                <g key={i}>
                  <rect
                    x={cx - bw / 2}
                    y={y}
                    width={bw}
                    height={Math.max(height - bottom - y, 0)}
                    rx={2}
                    className="fill-foreground"
                  />
                  <text
                    x={cx}
                    y={y - 4}
                    textAnchor="middle"
                    className="fill-muted-foreground"
                    fontSize={10}
                  >
                    {money(item.cents)}
                  </text>
                  <text
                    x={cx}
                    y={height - 6}
                    textAnchor="middle"
                    className="fill-muted-foreground"
                    fontSize={10}
                  >
                    {item.label}
                  </text>
                </g>
              );
            })}
          </>
        );
      }}
    </Chart>
  );
}

/** One stacked bar split into segments; each opens its target. */
export function StackBar({
  segments,
  onOpen,
  label,
}: {
  segments: { key: string; label: string; cents: number }[];
  onOpen: (key: string) => void;
  label: string;
}) {
  return (
    <Chart height={26} label={label}>
      {(width) => {
        const total = segments.reduce((sum, s) => sum + s.cents, 0);
        if (total <= 0) return null;
        let x = 0;
        return segments.map((segment, i) => {
          const w = (segment.cents / total) * width;
          const at = x;
          x += w;
          return (
            // biome-ignore lint/a11y/useSemanticElements: an SVG shape cannot be an <a> that the router can drive
            <rect
              key={segment.key}
              role="link"
              tabIndex={0}
              aria-label={segment.label}
              x={at}
              y={0}
              width={Math.max(w - 1, 0)}
              height={26}
              rx={2}
              className="cursor-pointer outline-none focus-visible:stroke-foreground"
              style={{ fill: shade(i) }}
              onClick={() => onOpen(segment.key)}
              onKeyDown={keyActivate(() => onOpen(segment.key))}
            >
              <title>{segment.label}</title>
            </rect>
          );
        });
      }}
    </Chart>
  );
}
