import { Trans } from "@lingui/react/macro";
import type { CashPoint } from "@rakazo/contracts";
import { useEffect, useId, useRef, useState } from "react";
import {
  axisMoney,
  dayAxisLabels,
  dayMonth,
  money,
  monthAxisLabels,
  quarterLabel,
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

/**
 * A balance line whose values stay close together would be flat on an axis that starts at $0, so
 * its axis starts at the nearest step below the lowest value. Other lines keep `niceRange`.
 */
function lineRange(min: number, max: number) {
  if (min > 0 && max - min < max / 2) {
    const { step } = niceScale(max - min);
    const floor = Math.floor(min / step) * step;
    return { step, floor, top: Math.max(floor + step, Math.ceil(max / step) * step) };
  }
  return niceRange(min, Math.max(max, 0));
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
    // Mounted while hidden there is nothing to measure yet; showing amounts measures again.
  }, [hidden]);
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
              fontSize={11}
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
 * Which axis labels a crowded line chart keeps: every `every`th one counted back from the last, so
 * the last point (today, or the month a projection runs out) is always named. A kept label takes the
 * year (`'27`) of a skipped label since the one kept before it, so a year change is never lost.
 */
export function axisTicks(labels: readonly string[], every: number): (string | null)[] {
  const last = labels.length - 1;
  let since = 0;
  return labels.map((text, i) => {
    if ((last - i) % every !== 0) return null;
    const year = labels
      .slice(since, i + 1)
      .map((l) => l.match(/'\d\d$/)?.[0])
      .findLast(Boolean);
    since = i + 1;
    return year && !text.endsWith(year) && !text.includes("•") ? `${text} ${year}` : text;
  });
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
        const bottom = axes ? 30 : 4;
        const maxValue = Math.max(...values, 0);
        // A balance can dip below zero; the axis reaches down to it instead of clipping the line.
        const scale = lineRange(Math.min(...values), maxValue);
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
                {axisTicks(labels, every).map((text, i) =>
                  text !== null ? (
                    <text
                      key={i}
                      x={x(i)}
                      y={height - 6}
                      textAnchor={i === values.length - 1 && x(i) > width - 24 ? "end" : "middle"}
                      className="fill-muted-foreground"
                      fontSize={11}
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

export type BarGranularity = "day" | "week" | "month" | "quarter" | "year";

/** Fewest slots the x-axis divides into, so a few buckets start at the left edge instead of spreading across the width. */
const MIN_SLOTS = 6;

/** Axis labels: weekdays for a week of days, day numbers for more days, `Oct 6` for weeks, `Oct` for months (years on the first tick and January), `Q3 '26` for quarters, `2026` for years. */
function barLabels(series: CashPoint[], granularity: BarGranularity): string[] {
  if (granularity === "year") return series.map((p) => p.start.slice(0, 4));
  if (granularity === "quarter") return series.map((p) => quarterLabel(p.start));
  if (granularity === "month") return monthAxisLabels(series.map((p) => p.start.slice(0, 7)));
  if (granularity === "week") return dayAxisLabels(series.map((p) => p.start));
  return series.map((p) =>
    series.length <= 7 ? weekdayShort(p.start) : String(Number(p.start.slice(8, 10))),
  );
}

/** Cubic segments through `pts` that never overshoot a point, so a line never dips below zero. */
function monotoneSegments(pts: [number, number][]): string[] {
  const n = pts.length;
  const dx = pts.slice(1).map((p, i) => p[0] - (pts[i] as [number, number])[0]);
  const m = pts.slice(1).map((p, i) => (p[1] - (pts[i] as [number, number])[1]) / (dx[i] || 1));
  const t = pts.map((_, i) => {
    if (i === 0) return m[0] ?? 0;
    if (i === n - 1) return m[n - 2] ?? 0;
    const [a, b] = [m[i - 1] as number, m[i] as number];
    return a * b <= 0 ? 0 : (a + b) / 2;
  });
  // Flatten a tangent that would overshoot its neighbouring slope.
  for (let i = 0; i < n - 1; i++) {
    const slope = m[i] as number;
    if (slope === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const k = Math.hypot((t[i] as number) / slope, (t[i + 1] as number) / slope);
    if (k > 3) {
      t[i] = (3 * slope * (t[i] as number)) / (k * slope);
      t[i + 1] = (3 * slope * (t[i + 1] as number)) / (k * slope);
    }
  }
  return pts.slice(1).map((p, i) => {
    const [x0, y0] = pts[i] as [number, number];
    const w = (dx[i] as number) / 3;
    return `C${(x0 + w).toFixed(1)},${(y0 + w * (t[i] as number)).toFixed(1)} ${(p[0] - w).toFixed(1)},${(p[1] - w * (t[i + 1] as number)).toFixed(1)} ${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  });
}

/**
 * Out, revenue and financing for each bucket as lines (Out has a gradient under it); each bucket
 * opens its detail. A bucket still running ends Out's line with a dashed segment and a hollow dot.
 */
export function BurnLines({
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
  const gradient = useId();
  const [active, setActive] = useState<number | null>(null);
  return (
    <Chart height={height} label={label}>
      {(width) => {
        const left = 40;
        const right = 8;
        const bottom = 24;
        // The scale follows spend and revenue; a raise many times larger would flatten every other
        // point, so a financing point above the scale is cut at the top and labelled instead.
        const max = Math.max(...series.flatMap((m) => [m.outCents, m.revenueCents]), 0);
        const scale = niceScale(
          max > 0 ? max : Math.max(...series.map((m) => m.financingCents), 0),
        );
        const clipped = series.some((m) => m.financingCents > scale.top);
        const top = clipped ? 22 : 10;
        const slot = (width - left - right) / Math.max(series.length, MIN_SLOTS);
        // Skip labels that would collide, counting back from the newest point.
        const labelEvery = Math.max(1, Math.ceil(36 / slot));
        const names = barLabels(series, granularity);
        const base = height - bottom;
        const y = (v: number) => top + (base - top) * (1 - v / scale.top);
        const cx = (i: number) => left + slot * (i + 0.5);
        const line = (pick: (m: CashPoint) => number) =>
          series.map((m, i): [number, number] => [cx(i), y(Math.min(pick(m), scale.top))]);
        const out = line((m) => m.outCents);
        const outSegs = monotoneSegments(out);
        const last = series.length - 1;
        const partial = series[last]?.partial === true && last > 0;
        const solidSegs = partial ? outSegs.slice(0, -1) : outSegs;
        const start = (p: [number, number] | undefined) =>
          `M${p?.[0].toFixed(1)},${p?.[1].toFixed(1)}`;
        const hasRevenue = series.some((m) => m.revenueCents > 0);
        const rev = line((m) => m.revenueCents);
        const area = (pts: [number, number][], segs: string[]) =>
          `${start(pts[0])}${segs.join("")}L${pts.at(-1)?.[0].toFixed(1)},${base}L${pts[0]?.[0].toFixed(1)},${base}Z`;
        const shown = active === null ? null : series[active];
        const rows = shown
          ? [
              { key: "out", name: <Trans>Out</Trans>, cents: shown.outCents },
              ...(shown.revenueCents > 0
                ? [{ key: "rev", name: <Trans>Revenue</Trans>, cents: shown.revenueCents }]
                : []),
              ...(shown.financingCents > 0
                ? [{ key: "fin", name: <Trans>Financing</Trans>, cents: shown.financingCents }]
                : []),
            ]
          : [];
        const tipW = 140;
        const tipH = 12 + 16 * (rows.length + 1);
        const tipX =
          active !== null && cx(active) + 10 + tipW > width - right
            ? Math.max(cx(active) - 10 - tipW, 0)
            : active === null
              ? 0
              : cx(active) + 10;
        return (
          <>
            <defs>
              {/* stop-color follows the text colour of the gradient, so the fill uses semantic tokens */}
              <linearGradient
                id={`${gradient}-out`}
                gradientUnits="userSpaceOnUse"
                x1={0}
                x2={0}
                y1={top}
                y2={base}
                className="text-foreground"
              >
                <stop offset="0" stopColor="currentColor" stopOpacity={0.25} />
                <stop offset="1" stopColor="currentColor" stopOpacity={0} />
              </linearGradient>
              <linearGradient
                id={`${gradient}-rev`}
                gradientUnits="userSpaceOnUse"
                x1={0}
                x2={0}
                y1={top}
                y2={base}
                className="text-muted-foreground"
              >
                <stop offset="0" stopColor="currentColor" stopOpacity={0.12} />
                <stop offset="1" stopColor="currentColor" stopOpacity={0} />
              </linearGradient>
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
            {series.length > 1 ? (
              <>
                {hasRevenue ? (
                  <>
                    <path
                      data-testid="burn-revenue-area"
                      d={area(rev, monotoneSegments(rev))}
                      fill={`url(#${gradient}-rev)`}
                    />
                    <path
                      d={`${start(rev[0])}${monotoneSegments(rev).join("")}`}
                      fill="none"
                      className="stroke-muted-foreground"
                      strokeWidth={1.5}
                      strokeLinecap="round"
                    />
                  </>
                ) : null}
                <path
                  data-testid="burn-out-area"
                  d={area(out, outSegs)}
                  fill={`url(#${gradient}-out)`}
                />
                <path
                  data-testid="burn-out-line"
                  d={`${start(out[0])}${solidSegs.join("")}`}
                  fill="none"
                  className="stroke-foreground"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                />
                {partial ? (
                  <path
                    data-testid="burn-out-partial"
                    d={`${start(out[last - 1])}${outSegs.at(-1)}`}
                    fill="none"
                    className="stroke-foreground"
                    strokeWidth={1.75}
                    strokeDasharray="4 4"
                    strokeLinecap="round"
                  />
                ) : null}
              </>
            ) : null}
            {series.map((m, i) =>
              m.financingCents > 0 ? (
                <circle
                  key={m.start}
                  cx={cx(i)}
                  cy={y(Math.min(m.financingCents, scale.top))}
                  r={2.5}
                  className="fill-card stroke-foreground"
                  strokeWidth={1.25}
                />
              ) : null,
            )}
            {out.map(([px, py], i) =>
              i === last && series[i]?.partial ? (
                <circle
                  key="partial"
                  data-testid="burn-out-end"
                  cx={px}
                  cy={py}
                  r={3}
                  className="fill-card stroke-foreground"
                  strokeWidth={1.5}
                />
              ) : series.length === 1 || i === active ? (
                <circle key={series[i]?.start} cx={px} cy={py} r={3} className="fill-foreground" />
              ) : null,
            )}
            {active !== null ? (
              <line
                data-testid="burn-crosshair"
                x1={cx(active)}
                x2={cx(active)}
                y1={top}
                y2={base}
                className="stroke-muted-foreground"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
            ) : null}
            {series.map((m, i) => {
              const name = names[i] ?? "";
              const showLabel = (series.length - 1 - i) % labelEvery === 0;
              const open = () => onOpen(m);
              return (
                // biome-ignore lint/a11y/useSemanticElements: an SVG group cannot be an <a> that the router can drive
                <g
                  key={m.start}
                  role="link"
                  tabIndex={0}
                  aria-label={`${granularity === "day" ? dayMonth(m.start) : name}: ${money(m.outCents)}`}
                  className="cursor-pointer outline-none"
                  onClick={open}
                  onKeyDown={keyActivate(open)}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                >
                  <rect
                    x={left + slot * i}
                    y={top}
                    width={slot}
                    height={base - top}
                    className="fill-transparent"
                  />
                  {showLabel ? (
                    <text
                      x={cx(i)}
                      y={height - 8}
                      textAnchor="middle"
                      className="fill-muted-foreground"
                      fontSize={11}
                      fontWeight={m.partial ? 700 : 400}
                    >
                      {name}
                      {m.partial ? "*" : ""}
                    </text>
                  ) : null}
                </g>
              );
            })}
            {series.map((m, i) =>
              m.financingCents > scale.top ? (
                <text
                  key={m.start}
                  data-testid="financing-clipped"
                  // A label centred on the last point would run past the right edge.
                  x={cx(i) > width - 32 ? width - 2 : cx(i)}
                  y={top - 6}
                  textAnchor={cx(i) > width - 32 ? "end" : "middle"}
                  className="fill-foreground"
                  fontSize={11}
                >
                  {`↑ ${money(m.financingCents)}`}
                </text>
              ) : null,
            )}
            {shown && active !== null ? (
              <g data-testid="burn-tooltip" pointerEvents="none">
                <rect
                  x={tipX}
                  y={top}
                  width={tipW}
                  height={tipH}
                  rx={6}
                  className="fill-popover stroke-border"
                />
                <text
                  x={tipX + 10}
                  y={top + 18}
                  fontSize={11}
                  className="fill-foreground"
                  fontWeight={600}
                >
                  {granularity === "day" ? dayMonth(shown.start) : (names[active] ?? "")}
                </text>
                {rows.map((r, j) => (
                  <g key={r.key}>
                    <text
                      x={tipX + 10}
                      y={top + 34 + 16 * j}
                      fontSize={11}
                      className="fill-muted-foreground"
                    >
                      {r.name}
                    </text>
                    <text
                      x={tipX + tipW - 10}
                      y={top + 34 + 16 * j}
                      fontSize={11}
                      textAnchor="end"
                      className="fill-foreground"
                    >
                      {money(r.cents)}
                    </text>
                  </g>
                ))}
              </g>
            ) : null}
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
                    fontSize={11}
                  >
                    {money(item.cents)}
                  </text>
                  <text
                    x={cx}
                    y={height - 6}
                    textAnchor="middle"
                    className="fill-muted-foreground"
                    fontSize={11}
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
