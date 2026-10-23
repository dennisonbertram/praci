import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { CashPoint } from "@rakazo/contracts";
import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
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
  // A constant balance gets room on both sides so the line sits mid-chart.
  if (min === max && min > 0) {
    // A round step (1, 2 or 5 times a power of ten) keeps the three gridline labels evenly spaced; the middle one is the balance.
    const unit = 10 ** Math.floor(Math.log10(Math.max(min / 10, 100)));
    const step = [1, 2, 5, 10].map((m) => m * unit).find((s) => s >= min / 10) ?? 10 * unit;
    return { step, floor: min - step, top: min + step };
  }
  if (min > 0 && max - min < max / 2) {
    const { step } = niceScale(max - min);
    const floor = Math.floor(min / step) * step;
    return { step, floor, top: Math.max(floor + step, Math.ceil(max / step) * step) };
  }
  return niceRange(min, Math.max(max, 0));
}

/** Monochrome fills for the series in a UI artifact chart; index 0 is darkest. */
export const shade = (index: number) =>
  `color-mix(in srgb, var(--foreground) ${[100, 78, 60, 46, 34, 24, 16][index % 7]}%, var(--card))`;

/** How far a sideways-scrolling chart is scrolled, so the y axis labels can stay at the left edge. */
const ScrollX = createContext(0);

/** An SVG drawn at the container's width, so text keeps a fixed size at any width. */
export function Chart({
  height,
  label,
  minWidth = 0,
  children,
}: {
  height: number;
  label: string;
  /** Narrower containers scroll sideways (newest end in view) instead of squeezing the plot. */
  minWidth?: number;
  children: (width: number) => React.ReactNode;
}) {
  // Hidden amounts hide money only: the shape and the dates stay, the axis and figures go.
  useHideAmounts();
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [scrollX, setScrollX] = useState(0);
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
  const svgWidth = Math.max(width, minWidth);
  useEffect(() => {
    if (ref.current && svgWidth > width) {
      ref.current.scrollLeft = ref.current.scrollWidth;
      setScrollX(ref.current.scrollLeft);
    }
  }, [svgWidth, width]);
  return (
    <div
      ref={ref}
      className="w-full overflow-x-auto"
      style={{ height }}
      onScroll={(e) => setScrollX(e.currentTarget.scrollLeft)}
    >
      {width > 0 ? (
        <svg
          role="img"
          aria-label={label}
          width={svgWidth}
          height={height}
          viewBox={`0 0 ${svgWidth} ${height}`}
          className="block max-w-none"
        >
          <ScrollX.Provider value={scrollX}>{children(svgWidth)}</ScrollX.Provider>
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
  layer,
}: {
  /** Draw only the gridlines or only the axis labels, so a chart can paint its series between them. */
  layer?: "lines" | "labels";
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  scale: { step: number; top: number; floor?: number };
}) {
  const hidden = useHideAmounts();
  const scrollX = useContext(ScrollX);
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
            {layer === "labels" ? null : (
              <line
                x1={left}
                x2={width - right}
                y1={y}
                y2={y}
                className="stroke-border"
                strokeWidth={1}
              />
            )}
            {hidden || layer === "lines" ? null : (
              <text
                x={left - 6 + scrollX}
                y={y + 3}
                textAnchor="end"
                className="fill-muted-foreground stroke-card"
                strokeWidth={4}
                paintOrder="stroke"
                fontSize={12}
              >
                {axisMoney(v)}
              </text>
            )}
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

/** The last tick is always named. When it hangs left of the point (near the right edge), a kept tick less than 80px before it would nearly touch it, so that tick is dropped. */
export function dropCrowdedTick(
  ticks: (string | null)[],
  x: (i: number) => number,
  width: number,
): (string | null)[] {
  const last = ticks.length - 1;
  const before = ticks.findLastIndex((text, i) => i < last && text !== null);
  if (before < 0 || x(last) <= width - 24 || x(last) - x(before) >= 80) return ticks;
  // The dropped tick may carry a year change ('27); the last tick takes it over.
  const year = ticks[before]?.match(/'\d\d$/)?.[0];
  return ticks.map((text, i) => {
    if (i === before) return null;
    return i === last && text && year && !text.endsWith(year) && !text.includes("•")
      ? `${text} ${year}`
      : text;
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
  projectedLabel,
}: {
  values: number[];
  labels: string[];
  height: number;
  label: string;
  axes?: boolean;
  solidUntil?: number;
  endMarker?: boolean;
  /** Names the dashed part of the line. */
  projectedLabel?: string;
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
          Math.ceil(62 / ((width - left - right) / (values.length - 1 || 1))),
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
                {dropCrowdedTick(axisTicks(labels, every), x, width).map((text, i) =>
                  text !== null ? (
                    <text
                      key={i}
                      x={x(i)}
                      y={height - 6}
                      textAnchor={i === values.length - 1 && x(i) > width - 24 ? "end" : "middle"}
                      className="fill-muted-foreground"
                      fontSize={12}
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
            {projectedLabel && solid < values.length - 1 ? (
              <text
                x={(x(solid) + x(values.length - 1)) / 2 + 8}
                y={y(((values[solid] ?? 0) + (values.at(-1) ?? 0)) / 2) - 8}
                textAnchor={
                  (x(solid) + x(values.length - 1)) / 2 + 8 > width - 70 ? "end" : "start"
                }
                className="fill-muted-foreground"
                fontSize={12}
              >
                {projectedLabel}
              </text>
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
 * opens its detail. A bucket still running is a hollow dot, not part of the line.
 */
export function BurnLines({
  series: allSeries,
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
  // Periods before the first one with money in or out are flat zeros that only take width.
  const firstUsed = allSeries.findIndex((m) => m.outCents || m.revenueCents || m.financingCents);
  const trim =
    (granularity === "month" || granularity === "quarter" || granularity === "year") &&
    firstUsed > 0;
  const trimmed = trim ? allSeries.slice(firstUsed) : allSeries;
  // A few quarters or years fill the plot; days, weeks and months keep a minimum so they start at the left edge.
  const minSlots = granularity === "quarter" || granularity === "year" ? 1 : MIN_SLOTS;
  // A finger cannot hit 20 px columns, so on touch the whole plot is one target: a tap picks the
  // nearest period (its figures show), a second tap in the same column opens it.
  const touch = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  // The scale follows spend and revenue; a raise many times larger would flatten every other
  // point, so a financing point above the scale is cut at the top and labelled instead.
  const series = trimmed;
  const max = Math.max(...series.flatMap((m) => [m.outCents, m.revenueCents]), 0);
  const scale = niceScale(max > 0 ? max : Math.max(...series.map((m) => m.financingCents), 0));
  // Room for the widest axis label (about 7 px a character at 12 px) so none is cut off.
  const left = Math.max(40, axisMoney(scale.top).length * 7 + 10);
  const right = 8;
  const bottom = 24;
  const clipped = series.some((m) => m.financingCents > scale.top);
  // A quarter or year names its financing point in a label above the plot, so the label never sits on a bar.
  const named = series.some(
    (m) => m.financingCents > 0 && (granularity === "quarter" || granularity === "year"),
  );
  // Neighbouring labels that collide go on a second row, so two or more labels get the extra room.
  const labelled = series.filter(
    (m) =>
      m.financingCents > scale.top ||
      (m.financingCents > 0 && (granularity === "quarter" || granularity === "year")),
  ).length;
  const top = labelled > 1 ? 42 : clipped || named ? 28 : 10;
  // Each month is a control and must be 44 px wide on touch: a narrow phone scrolls the chart.
  const minWidth =
    touch && granularity === "month" ? left + right + Math.max(series.length, minSlots) * 44 : 0;
  return (
    <Chart height={height} label={label} minWidth={minWidth}>
      {(width) => {
        // Where the last label on each row ends (lower row first). It lives in this callback, which
        // Chart runs again on every resize: a value kept outside would push the one label up a row.
        const rowEnd = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
        const slot = (width - left - right) / Math.max(series.length, minSlots);
        // Skip labels that would collide, counting back from the newest point.
        const labelEvery = Math.max(1, Math.ceil(36 / slot));
        const names = barLabels(series, granularity);
        const base = height - bottom;
        const y = (v: number) => top + (base - top) * (1 - v / scale.top);
        const cx = (i: number) => left + slot * (i + 0.5);
        const line = (pick: (m: CashPoint) => number) =>
          series.map((m, i): [number, number] => [cx(i), y(Math.min(pick(m), scale.top))]);
        const out = line((m) => m.outCents);
        const last = series.length - 1;
        const partial = series[last]?.partial === true;
        // A bucket still running is a hollow dot only: a line to it would read as spend falling.
        const drawn = partial ? out.slice(0, -1) : out;
        // One period cannot make a line: it is a bar (hollow while it is still running).
        const single = series.length === 1 && (granularity === "year" || granularity === "quarter");
        const rev = line((m) => m.revenueCents);
        // The partial period is one mark: a second dot closer than 12 px (two 3 px rings plus a gap) would read as an "8".
        const apart = (a?: [number, number], b?: [number, number]) =>
          !a || !b || Math.hypot(a[0] - b[0], a[1] - b[1]) >= 12;
        const revDrawn = partial ? rev.slice(0, -1) : rev;
        const revEnd = partial && series[last]?.revenueCents && apart(rev.at(-1), out.at(-1));
        const outSegs = monotoneSegments(drawn);
        const start = (p: [number, number] | undefined) =>
          `M${p?.[0].toFixed(1)},${p?.[1].toFixed(1)}`;
        const hasRevenue = series.some((m) => m.revenueCents > 0);
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
              layer="lines"
            />
            {series.length > 1 ? (
              <>
                {hasRevenue && revDrawn.length > 1 ? (
                  <>
                    <path
                      data-testid="burn-revenue-area"
                      d={area(revDrawn, monotoneSegments(revDrawn))}
                      fill={`url(#${gradient}-rev)`}
                    />
                    <path
                      d={`${start(revDrawn[0])}${monotoneSegments(revDrawn).join("")}`}
                      fill="none"
                      className="stroke-muted-foreground"
                      strokeWidth={1.5}
                      strokeLinecap="round"
                    />
                  </>
                ) : null}
                {drawn.length > 1 ? (
                  <>
                    <path
                      data-testid="burn-out-area"
                      d={area(drawn, outSegs)}
                      fill={`url(#${gradient}-out)`}
                    />
                    <path
                      data-testid="burn-out-line"
                      d={`${start(drawn[0])}${outSegs.join("")}`}
                      fill="none"
                      className="stroke-foreground"
                      strokeWidth={1.75}
                      strokeLinecap="round"
                    />
                  </>
                ) : null}
              </>
            ) : null}
            <Grid
              width={width}
              height={height}
              left={left}
              right={right}
              top={top}
              bottom={bottom}
              scale={scale}
              layer="labels"
            />
            {single
              ? [
                  { key: "out", cents: series[0]?.outCents ?? 0, tone: "foreground" },
                  { key: "rev", cents: series[0]?.revenueCents ?? 0, tone: "muted-foreground" },
                ]
                  .filter((b) => b.cents > 0)
                  .map((b, j, all) => {
                    const w = Math.min(28, slot * 0.25);
                    const x = cx(0) - (all.length * w + (all.length - 1) * 2) / 2 + j * (w + 2);
                    return (
                      <rect
                        key={b.key}
                        data-testid={`burn-bar-${b.key}`}
                        x={x}
                        y={y(b.cents)}
                        width={w}
                        height={base - y(b.cents)}
                        rx={2}
                        strokeWidth={1.5}
                        strokeDasharray={partial ? "3 3" : undefined}
                        className={
                          b.tone === "foreground"
                            ? "fill-foreground/25 stroke-foreground"
                            : "fill-muted-foreground/20 stroke-muted-foreground"
                        }
                      />
                    );
                  })
              : null}
            {!single && hasRevenue && revDrawn.length === 1 ? (
              <circle
                data-testid="burn-revenue-point"
                cx={revDrawn[0]?.[0]}
                cy={revDrawn[0]?.[1]}
                r={3}
                className="fill-muted-foreground"
              />
            ) : null}
            {!single && revEnd ? (
              <circle
                data-testid="burn-revenue-end"
                cx={(rev.at(-1) as [number, number])[0]}
                cy={(rev.at(-1) as [number, number])[1]}
                r={3}
                className="fill-card stroke-muted-foreground"
                strokeWidth={1.5}
              />
            ) : null}
            {series.map((m, i) =>
              m.financingCents > scale.top ? (
                // Off the scale: an up arrow, so it is not read as the value of the gridline it sits on.
                <path
                  key={m.start}
                  data-testid="financing-arrow"
                  d={`M${cx(i)},${y(scale.top) - 4}l4,7h-8z`}
                  className="fill-card stroke-foreground"
                  strokeWidth={1.25}
                  strokeLinejoin="round"
                />
              ) : m.financingCents > 0 &&
                !(
                  i === last &&
                  partial &&
                  !(
                    apart([cx(i), y(m.financingCents)], out.at(-1)) &&
                    (!revEnd || apart([cx(i), y(m.financingCents)], rev.at(-1)))
                  )
                ) ? (
                <circle
                  key={m.start}
                  cx={cx(i)}
                  cy={y(m.financingCents)}
                  r={2.5}
                  className="fill-card stroke-foreground"
                  strokeWidth={1.25}
                />
              ) : null,
            )}
            {out.map(([px, py], i) =>
              single ? null : i === last && series[i]?.partial ? (
                <circle
                  key="partial"
                  data-testid="burn-out-end"
                  cx={px}
                  cy={py}
                  r={3}
                  className="fill-card stroke-foreground"
                  strokeWidth={1.5}
                />
              ) : drawn.length === 1 || i === active ? (
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
                  // Pointer events go to the touch target below; keyboard access to every period stays.
                  role="link"
                  tabIndex={0}
                  aria-label={`${granularity === "day" ? dayMonth(m.start) : name}: ${money(m.outCents)}`}
                  onKeyDown={keyActivate(open)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  {...(touch
                    ? {}
                    : {
                        onClick: open,
                        onMouseEnter: () => setActive(i),
                        onMouseLeave: () => setActive(null),
                      })}
                  className="cursor-pointer outline-none"
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
                      fontSize={12}
                      fontWeight={m.partial ? 700 : 400}
                    >
                      {name}
                      {m.partial ? "*" : ""}
                    </text>
                  ) : null}
                </g>
              );
            })}
            {touch ? (
              // Pointer only: each period above is the keyboard and screen reader control.
              // biome-ignore lint/a11y/noStaticElementInteractions: a tap overlay; the periods are the accessible controls
              <rect
                data-testid="burn-touch-target"
                x={left}
                y={top}
                width={Math.max(width - left - right, 0)}
                height={base - top}
                className="fill-transparent outline-none"
                onClick={(event) => {
                  const box = event.currentTarget.getBoundingClientRect();
                  const i = Math.floor(
                    ((event.clientX - box.left) / box.width) * Math.max(series.length, minSlots),
                  );
                  const point = series[i];
                  if (!point) return;
                  if (i === active) onOpen(point);
                  else setActive(i);
                }}
              />
            ) : null}
            {series.map((m, i) => {
              const off = m.financingCents > scale.top;
              // A quarter or year has few marks, so a bare ring beside the legend is named in place.
              const inPlace =
                !off &&
                m.financingCents > 0 &&
                (granularity === "quarter" || granularity === "year");
              if (!off && !inPlace) return null;
              const when = granularity === "day" ? dayMonth(m.start) : (names[i] ?? "");
              const text = `${t`Financing, ${when}`} ${off ? "↑ " : ""}${money(m.financingCents)}`;
              // About 6.5 px a character at 12 px; a centred label that would pass either edge hugs it.
              const half = (text.length * 6.5) / 2;
              const anchor =
                cx(i) + half > width - 8 ? "end" : cx(i) - half < 8 ? "start" : "middle";
              const x = anchor === "end" ? width - 8 : anchor === "start" ? 8 : cx(i);
              const from = anchor === "end" ? x - 2 * half : anchor === "start" ? x : x - half;
              // Drop to the second row when an earlier label on the first row reaches this one.
              const row = from < (rowEnd[0] ?? 0) ? 1 : 0;
              rowEnd[row] = from + 2 * half;
              return (
                <text
                  key={m.start}
                  data-testid="financing-clipped"
                  x={x}
                  y={top - 12 - 14 * row}
                  textAnchor={anchor}
                  className="fill-foreground"
                  fontSize={12}
                >
                  {text}
                </text>
              );
            })}
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
                  fontSize={12}
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
                      fontSize={12}
                      className="fill-muted-foreground"
                    >
                      {r.name}
                    </text>
                    <text
                      x={tipX + tipW - 10}
                      y={top + 34 + 16 * j}
                      fontSize={12}
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
  items: { label: string; cents: number; partial?: boolean }[];
  height?: number;
  label: string;
}) {
  const hidden = useHideAmounts();
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
                    className={item.partial ? "fill-foreground/40" : "fill-foreground"}
                  />
                  {hidden ? null : (
                    <text
                      x={cx}
                      y={y - 4}
                      textAnchor="middle"
                      className="fill-muted-foreground"
                      fontSize={12}
                    >
                      {slot < 52 ? axisMoney(item.cents) : money(item.cents)}
                    </text>
                  )}
                  <text
                    x={cx}
                    y={height - 6}
                    textAnchor="middle"
                    className="fill-muted-foreground"
                    fontSize={12}
                  >
                    {item.label}
                    {item.partial ? "*" : ""}
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
