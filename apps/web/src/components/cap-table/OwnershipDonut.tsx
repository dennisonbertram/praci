import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { Button, Card } from "@rakazo/ui-web";
import { ArrowLeft } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { percentFigure, shareCount } from "../../lib/finance-format";

export type DonutClass = { name: string; shares: number };
/** A holding from the cap table snapshot; `shares` is null when Carta did not report it. */
export type DonutHolding = { name: string; security: string; shares: number | null };
type Slice = DonutClass & { percent: number };

/** Foreground at stepped strengths: the app is monochrome, and each step stays distinguishable from its neighbours. */
const FILL = [
  "fill-foreground",
  "fill-foreground/70",
  "fill-foreground/50",
  "fill-foreground/35",
  "fill-foreground/22",
  "fill-foreground/15",
];
const DOT = [
  "bg-foreground",
  "bg-foreground/70",
  "bg-foreground/50",
  "bg-foreground/35",
  "bg-foreground/22",
  "bg-foreground/15",
];
const MAX_SLICES = 6;
const SIZE = 192;
const R = 90;
const INNER = 68;
/** A slice is drawn at least this share of the ring (about 7 degrees); the numbers shown are not changed. */
const MIN_FRACTION = 0.02;
/** Empty angle between neighbouring slices, in radians. */
const GAP = 0.04;

/**
 * The largest classes by shares, the rest merged into "Other" so there are at most six slices.
 * Percents have two decimals, like the holders table, and are spread by largest remainder so they always sum to 100.
 */
export function groupClasses(classes: DonutClass[], otherLabel = t`Other`): Slice[] {
  const sorted = classes.filter((c) => c.shares > 0).sort((a, b) => b.shares - a.shares);
  const kept = sorted.slice(0, sorted.length > MAX_SLICES ? MAX_SLICES - 1 : MAX_SLICES);
  const rest = sorted.slice(kept.length);
  if (rest.length) kept.push({ name: otherLabel, shares: rest.reduce((n, c) => n + c.shares, 0) });
  const total = kept.reduce((n, c) => n + c.shares, 0);
  const hundredths = kept.map((c) => (c.shares * 10000) / total);
  const floors = hundredths.map(Math.floor);
  let left = 10000 - floors.reduce((n, v) => n + v, 0);
  for (const i of hundredths
    .map((v, index) => ({ index, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac)
    .map((e) => e.index)) {
    if (left-- <= 0) break;
    floors[i] = (floors[i] ?? 0) + 1;
  }
  return kept.map((c, i) => ({ ...c, percent: (floors[i] ?? 0) / 100 }));
}

const point = (angle: number, radius: number) =>
  `${(SIZE / 2 + radius * Math.sin(angle)).toFixed(2)},${(SIZE / 2 - radius * Math.cos(angle)).toFixed(2)}`;

function arc(from: number, to: number) {
  const large = to - from > Math.PI ? 1 : 0;
  return `M${point(from, R)}A${R},${R} 0 ${large} 1 ${point(to, R)}L${point(to, INNER)}A${INNER},${INNER} 0 ${large} 0 ${point(from, INNER)}Z`;
}

/** A lone class is a full ring, which one arc cannot draw, so it is two halves. */
const ring = () =>
  `M${point(0, R)}A${R},${R} 0 1 1 ${point(Math.PI, R)}A${R},${R} 0 1 1 ${point(0, R)}ZM${point(0, INNER)}A${INNER},${INNER} 0 1 0 ${point(Math.PI, INNER)}A${INNER},${INNER} 0 1 0 ${point(0, INNER)}Z`;

/** Where each slice starts and ends, in radians clockwise from twelve o'clock, before the gap is removed. */
function sliceAngles(shares: number[]): [number, number][] {
  if (shares.length === 1) return [[0, Math.PI * 2]];
  const total = shares.reduce((n, v) => n + v, 0);
  const small = shares.filter((v) => v / total < MIN_FRACTION).length;
  const room = 1 - small * MIN_FRACTION;
  const bigTotal = shares.reduce((n, v) => (v / total < MIN_FRACTION ? n : n + v), 0);
  let angle = 0;
  return shares.map((v) => {
    const fraction = v / total < MIN_FRACTION ? MIN_FRACTION : (v / bigTotal) * room;
    const from = angle;
    angle += fraction * Math.PI * 2;
    return [from, angle];
  });
}

/** Slice outlines. Tiny slices are widened to MIN_FRACTION and the others shrink to make room. */
export function sliceArcs(shares: number[]): string[] {
  if (shares.length === 1) return [ring()];
  return sliceAngles(shares).map(([from, to]) => arc(from + GAP / 2, to - GAP / 2));
}

/** "Common (Mock)" and "common" are the same class: compare without case and parenthetical notes. */
const classKey = (name: string) =>
  name
    .replace(/\([^)]*\)/g, "")
    .trim()
    .toLowerCase();

/** Holder shares for one slice, biggest first with the tail merged; null when the snapshot has none to show. */
function breakdown(
  slice: Slice,
  holdings: DonutHolding[],
  pool: number | null,
  labels: { options: string; pool: string; other: string; merged: string },
): Slice[] | null {
  if (slice.name === labels.merged) return null;
  const isOptions = slice.name === labels.options;
  const byHolder = new Map<string, number>();
  for (const h of holdings) {
    const match = isOptions
      ? h.security.toLowerCase().includes("option")
      : classKey(h.security) === classKey(slice.name);
    if (match && h.shares) byHolder.set(h.name, (byHolder.get(h.name) ?? 0) + h.shares);
  }
  if (isOptions && pool) byHolder.set(labels.pool, (byHolder.get(labels.pool) ?? 0) + pool);
  if (byHolder.size === 0) return null;
  return groupClasses(
    [...byHolder].map(([name, shares]) => ({ name, shares })),
    labels.other,
  );
}

const ROW = 34;
const legendHeight = (rows: number) => ROW * rows - 2;
/** The breakdown legend starts with a row naming the class. */
const HEAD = 28;
const drillLegendHeight = (rows: number) => HEAD + legendHeight(rows);
/** Narrower than this, the donut at rest sits above its legend instead of beside it. */
const SIDE = 400;
/** The breakdown legend shows this many rows and scrolls past them, so the card is not sized for the longest one. */
const MAX_DRILL_ROWS = 5;
/** Width of the side-by-side layout. Narrower containers stack the donuts. */
const WIDE = 640;
const MS = 400;
const EASE = "cubic-bezier(0.33, 1, 0.68, 1)";
/** The original donut when it steps aside, and the breakdown donut once it has grown in. */
const ORIGINAL_SCALE = { wide: 0.52, narrow: 0.45 };
const DRILL_SCALE = { wide: 0.917, narrow: 0.833 };
/** Narrow layout: top of the breakdown donut, leaving room for the beam below the small original. */
const DRILL_TOP = 138;

type Pt = [number, number];
const fix = (n: number) => n.toFixed(1);

/** The beam from the selected slice's outer edge to the facing side of the breakdown donut. */
function Projection({
  show,
  from,
  to,
  half,
  dir,
}: {
  show: boolean;
  from: { c: Pt; r: number };
  to: { c: Pt; r: number };
  half: number;
  dir: Pt;
}) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const perp: Pt = [-dir[1], dir[0]];
  /** A point on a circle: `angle` from the beam's axis, to one `side` of it; `along` flips the axis for the far donut. */
  const edge = (c: Pt, r: number, side: number, angle: number, along: number): Pt => [
    c[0] + r * (along * Math.cos(angle) * dir[0] + side * Math.sin(angle) * perp[0]),
    c[1] + r * (along * Math.cos(angle) * dir[1] + side * Math.sin(angle) * perp[1]),
  ];
  const a = edge(from.c, from.r, -1, half, 1);
  const d = edge(from.c, from.r, 1, half, 1);
  const b = edge(to.c, to.r, -1, 0.7, -1);
  const c = edge(to.c, to.r, 1, 0.7, -1);
  const p = (q: Pt) => `${fix(q[0])},${fix(q[1])}`;
  return (
    <svg
      className="pointer-events-none absolute inset-0 size-full overflow-visible"
      aria-hidden="true"
      data-testid="donut-projection"
      style={{
        opacity: on && show ? 1 : 0,
        transition: `opacity 300ms ease-out ${show ? 150 : 0}ms`,
      }}
    >
      <polygon points={`${p(a)} ${p(b)} ${p(c)} ${p(d)}`} className="fill-muted-foreground/15" />
      <polyline points={`${p(a)} ${p(b)}`} className="fill-none stroke-muted-foreground/40" />
      <polyline points={`${p(d)} ${p(c)}`} className="fill-none stroke-muted-foreground/40" />
    </svg>
  );
}

/**
 * Ownership by share class as a muted donut with its legend. The slices cover the fully diluted
 * count: what no class holds (granted options and the unallocated pool) is its own slice.
 * Percents and share counts are not money, so they stay visible while amounts are hidden.
 * A class with holders in `holdings` opens a breakdown by holder: the donut steps aside, turned so
 * the chosen slice faces a second donut, and a beam connects the two.
 */
export function OwnershipDonut({
  classes,
  fullyDilutedShares,
  holdings = [],
  optionPoolAvailable = null,
}: {
  classes: DonutClass[];
  fullyDilutedShares: number | null;
  holdings?: DonutHolding[];
  optionPoolAvailable?: number | null;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [activeHolder, setActiveHolder] = useState<number | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  /** The last opened slice, kept so the breakdown can fade out instead of vanishing. */
  const [last, setLast] = useState<number | null>(null);
  const [turns, setTurns] = useState(0);
  /** True one frame after the breakdown opens, so its first appearance animates instead of popping in. */
  const [entered, setEntered] = useState(false);
  const [width, setWidth] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLButtonElement>(null);
  const rows = useRef<(HTMLElement | null)[]>([]);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const issued = classes.reduce((n, c) => n + c.shares, 0);
  const unissued = (fullyDilutedShares ?? 0) - issued;
  // Granted options plus the pool: say how much of it is still free, as the summary above does.
  const poolFree = shareCount(optionPoolAvailable ?? 0, i18n.locale || "en");
  const optionsLabel = optionPoolAvailable
    ? t`Option pool (${poolFree} available)`
    : t`Options and pool`;
  const slices = groupClasses(
    unissued > 0 ? [...classes, { name: optionsLabel, shares: unissued }] : classes,
  );
  const labels = {
    options: optionsLabel,
    pool: t`Unallocated pool`,
    other: t`Other holders`,
    merged: t`Other`,
  };
  const drills = slices.map((s) => breakdown(s, holdings, optionPoolAvailable, labels));
  const view = open ?? last;
  const drill = (view === null ? null : drills[view]) ?? null;

  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const wide = width >= WIDE;
  const arcs = sliceArcs(slices.map((s) => s.shares));
  const angles = sliceAngles(slices.map((s) => s.shares));
  const holderArcs = drill ? sliceArcs(drill.map((s) => s.shares)) : [];

  // Geometry of the stage in pixels. Everything is placed absolutely and moved with transforms,
  // so opening never changes the card's height.
  const frameW = wide ? WIDE : width || 300;
  const cx = frameW / 2;
  const drillRows = Math.min(MAX_DRILL_ROWS, Math.max(1, ...drills.map((d) => d?.length ?? 0)));
  const isOpenNow = open !== null;
  const sA = wide ? ORIGINAL_SCALE.wide : ORIGINAL_SCALE.narrow;
  const sB = wide ? DRILL_SCALE.wide : DRILL_SCALE.narrow;
  // Beside its legend at rest, the card is only as tall as the donut. Opening a class needs the
  // stacked layout's room, which the card grows into.
  const side = !wide && frameW >= SIDE;
  const restH = side
    ? Math.max(SIZE, legendHeight(slices.length))
    : SIZE + 16 + legendHeight(slices.length);
  const frameH = wide
    ? Math.max(SIZE, legendHeight(slices.length), drillLegendHeight(drillRows))
    : isOpenNow
      ? Math.max(restH, DRILL_TOP + SIZE * sB + 12 + drillLegendHeight(drillRows))
      : restH;
  const aBase: Pt = wide
    ? [0, (frameH - SIZE) / 2]
    : side
      ? [0, (restH - SIZE) / 2]
      : [cx - SIZE / 2, 0];
  /** Moves the scaled donut to the frame's left (wide) or top centre (narrow) edge. */
  const aShift: Pt = wide
    ? [-(SIZE / 2) * (1 - sA), 0]
    : [cx - SIZE / 2 - aBase[0], -(SIZE / 2) * (1 - sA) - aBase[1]];
  const bBase: Pt = wide ? [156, (frameH - SIZE) / 2] : [cx - SIZE / 2, DRILL_TOP];
  const aCentre: Pt = [aBase[0] + SIZE / 2 + aShift[0], aBase[1] + SIZE / 2 + aShift[1]];
  const bCentre: Pt = wide
    ? [bBase[0] + (SIZE / 2) * sB, bBase[1] + SIZE / 2]
    : [bBase[0] + SIZE / 2, bBase[1] + (SIZE / 2) * sB];
  const dir: Pt = wide ? [1, 0] : [0, 1];
  const mainLegend = wide
    ? { x: 240, y: (frameH - legendHeight(slices.length)) / 2, w: 384 }
    : side
      ? { x: SIZE + 24, y: (restH - legendHeight(slices.length)) / 2, w: frameW - SIZE - 24 }
      : { x: 0, y: SIZE + 16, w: frameW };
  const drillLegend = wide
    ? {
        x: 360,
        y: (frameH - drillLegendHeight(Math.min(drill?.length ?? 0, MAX_DRILL_ROWS))) / 2,
        w: 280,
      }
    : { x: 0, y: DRILL_TOP + SIZE * sB + 12, w: frameW };

  /** Rotation that points the open slice at the breakdown donut; whole turns keep the spin short. */
  const midDeg = (i: number) =>
    (((angles[i]?.[0] ?? 0) + (angles[i]?.[1] ?? 0)) / 2) * (180 / Math.PI);
  const target = (i: number) => (wide ? 90 : 180) - midDeg(i);
  const rot = open === null ? 360 * turns : target(open) + 360 * turns;
  const half = Math.min(((angles[view ?? 0]?.[1] ?? 0) - (angles[view ?? 0]?.[0] ?? 0)) / 2, 0.9);

  const go = (next: number | null) => {
    if (next === null) {
      setTurns(Math.round(rot / 360));
      setOpen(null);
      if (open !== null) rows.current[open]?.focus({ preventScroll: true });
      return;
    }
    setTurns(Math.round((rot - target(next)) / 360));
    setLast(next);
    setOpen(next);
    if (open === null) requestAnimationFrame(() => back.current?.focus({ preventScroll: true }));
  };

  useEffect(() => {
    if (open === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") go(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (open === null) return setEntered(false);
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [open === null]);

  if (slices.length === 0) return null;
  const locale = i18n.locale || "en";
  const total = slices.reduce((n, s) => n + s.shares, 0);
  const drillTotal = drill?.reduce((n, s) => n + s.shares, 0) ?? 0;
  const label = `${t`Ownership`}: ${slices
    .slice(0, 3)
    .map((s) => `${s.name} ${percentFigure(s.percent)}`)
    .join(", ")}`;
  const tr = (prop: string) => (reduced ? undefined : `${prop} ${MS}ms ${EASE}`);
  const isOpen = open !== null;
  const bShown = isOpen && (entered || reduced);
  const on = (i: number) => ({
    onMouseEnter: () => setActive(i),
    onMouseLeave: () => setActive(null),
    onFocus: () => setActive(i),
    onBlur: () => setActive(null),
  });
  const onHolder = (i: number) => ({
    onMouseEnter: () => setActiveHolder(i),
    onMouseLeave: () => setActiveHolder(null),
    onFocus: () => setActiveHolder(i),
    onBlur: () => setActiveHolder(null),
  });
  const tip = !isOpen && active !== null ? slices[active] : null;
  const holderTip = drill && activeHolder !== null ? drill[activeHolder] : null;
  const pressKey = (i: number) => (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      go(i);
    }
  };

  return (
    <Card className="mb-4 p-4 @md:p-6">
      <div ref={wrap} className="w-full">
        <div
          className="relative mx-auto"
          style={{
            width: wide ? WIDE : "100%",
            height: frameH,
            transition: tr("height"),
          }}
          data-testid="ownership-stage"
        >
          {isOpen ? (
            <Button
              ref={back}
              variant="ghost"
              size="icon"
              className="absolute top-0 left-0 z-10"
              aria-label={t`Back`}
              onClick={() => go(null)}
            >
              <ArrowLeft />
            </Button>
          ) : null}

          {/* biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: while open, Escape and the Back button are the keyboard path */}
          <div
            className="absolute"
            style={{
              left: aBase[0],
              top: aBase[1],
              width: SIZE,
              height: SIZE,
              transform: isOpen ? `translate(${aShift[0]}px, ${aShift[1]}px) scale(${sA})` : "none",
              transition: tr("transform"),
              cursor: isOpen ? "pointer" : undefined,
            }}
            onClick={isOpen ? () => go(null) : undefined}
            data-testid="donut-original"
            data-open={isOpen}
          >
            {/* biome-ignore lint/a11y/useSemanticElements: the drillable slices inside are buttons, so it cannot be an img */}
            <svg
              width={SIZE}
              height={SIZE}
              role="group"
              aria-label={label}
              data-testid="ownership-donut"
              style={{ transform: `rotate(${rot}deg)`, transition: tr("transform") }}
            >
              {slices.map((s, i) => {
                const drillable = drills[i] !== null;
                const dim = isOpen ? open !== i : active !== null && active !== i;
                return (
                  // biome-ignore lint/a11y/noStaticElementInteractions: drillable slices get a button role below; the legend rows are the keyboard path for the rest
                  <path
                    key={s.name}
                    d={arcs[i]}
                    fillRule="evenodd"
                    className={`${FILL[i]} ${drillable || isOpen ? "cursor-pointer" : ""}`}
                    style={{
                      opacity: dim ? (isOpen ? 0.22 : 0.3) : 1,
                      transition: tr("opacity"),
                    }}
                    {...(drillable && !isOpen
                      ? {
                          role: "button",
                          tabIndex: 0,
                          "aria-label": t`Show ${s.name} breakdown`,
                          onKeyDown: pressKey(i),
                        }
                      : {})}
                    onMouseEnter={() => setActive(i)}
                    onMouseLeave={() => setActive(null)}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                    onClick={
                      drillable
                        ? (event) => {
                            event.stopPropagation();
                            go(open === i ? null : i);
                          }
                        : undefined
                    }
                    data-testid="donut-slice"
                  />
                );
              })}
            </svg>
            <div
              className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center"
              data-testid="donut-centre"
              style={{ opacity: isOpen ? 0 : 1, transition: tr("opacity") }}
            >
              <span className="text-xl font-semibold leading-none tabular-nums">
                {shareCount(tip ? tip.shares : total, locale)}
              </span>
              <span className="mt-1 line-clamp-2 text-xs leading-tight text-muted-foreground">
                {tip ? tip.name : unissued > 0 ? t`Fully diluted shares` : t`Shares`}
              </span>
            </div>
          </div>

          <ul
            className="absolute grid gap-0.5 text-sm"
            style={{
              left: mainLegend.x,
              top: mainLegend.y,
              width: mainLegend.w,
              opacity: isOpen ? 0 : 1,
              // Quick out and delayed in, so the two legends never overlap.
              transition: reduced ? undefined : `opacity 160ms ease-out ${isOpen ? 0 : 240}ms`,
            }}
            inert={isOpen}
          >
            {slices.map((s, i) => {
              const row = (
                <>
                  <span className={`size-2.5 shrink-0 rounded-full ${DOT[i]}`} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  <span className="w-14 shrink-0 text-end tabular-nums">
                    {percentFigure(s.percent)}
                  </span>
                  <span className="w-20 shrink-0 text-end tabular-nums text-muted-foreground">
                    {shareCount(s.shares, locale)}
                  </span>
                </>
              );
              const cls = `flex w-full items-center gap-2 @md:gap-3 rounded-md px-2 py-1.5 text-start outline-none focus-visible:ring-2 focus-visible:ring-ring ${active === i && !isOpen ? "bg-foreground/10" : ""}`;
              return (
                <li key={s.name}>
                  {drills[i] ? (
                    <button
                      type="button"
                      ref={(el) => {
                        rows.current[i] = el;
                      }}
                      className={cls}
                      aria-label={t`Show ${s.name} breakdown`}
                      onClick={() => go(i)}
                      {...on(i)}
                    >
                      {row}
                    </button>
                  ) : (
                    <div className={cls} {...on(i)}>
                      {row}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {drill ? (
            <>
              <div
                className="absolute"
                style={{
                  left: bBase[0],
                  top: bBase[1],
                  width: SIZE,
                  height: SIZE,
                  transformOrigin: wide ? "0% 50%" : "50% 0%",
                  transform: `scale(${bShown ? sB : 0.5})`,
                  opacity: bShown ? 1 : 0,
                  transition: reduced
                    ? undefined
                    : `transform ${MS}ms ${EASE}, opacity ${MS}ms ${EASE}`,
                }}
                inert={!isOpen}
                aria-hidden={!isOpen}
                data-testid="breakdown"
                data-open={isOpen}
              >
                <svg
                  width={SIZE}
                  height={SIZE}
                  role="img"
                  aria-label={`${slices[view ?? 0]?.name ?? ""}: ${drill
                    .slice(0, 3)
                    .map((s) => `${s.name} ${percentFigure(s.percent)}`)
                    .join(", ")}`}
                >
                  {drill.map((s, i) => (
                    // biome-ignore lint/a11y/noStaticElementInteractions: the legend rows are the keyboard path to the same highlight
                    <path
                      key={s.name}
                      d={holderArcs[i]}
                      fillRule="evenodd"
                      className={`${FILL[i]} transition-opacity`}
                      style={{ opacity: activeHolder !== null && activeHolder !== i ? 0.3 : 1 }}
                      onMouseEnter={() => setActiveHolder(i)}
                      onMouseLeave={() => setActiveHolder(null)}
                      data-testid="holder-slice"
                    />
                  ))}
                </svg>
                <div
                  className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center"
                  data-testid="breakdown-centre"
                >
                  <span className="text-xl font-semibold leading-none tabular-nums">
                    {shareCount(holderTip ? holderTip.shares : drillTotal, locale)}
                  </span>
                  <span className="mt-1 line-clamp-2 text-xs leading-tight text-muted-foreground">
                    {holderTip ? holderTip.name : slices[view ?? 0]?.name}
                  </span>
                </div>
              </div>
              <ul
                className="rk-scroll absolute grid content-start gap-0.5 overflow-y-auto text-sm"
                style={{
                  maxHeight: drillLegendHeight(MAX_DRILL_ROWS),
                  left: drillLegend.x,
                  top: drillLegend.y,
                  width: drillLegend.w,
                  opacity: bShown ? 1 : 0,
                  transition: reduced ? undefined : `opacity 200ms ease-out ${isOpen ? 200 : 0}ms`,
                }}
                inert={!isOpen}
                aria-hidden={!isOpen}
                data-testid="breakdown-legend"
              >
                <li
                  data-testid="breakdown-head"
                  className="sticky top-0 z-10 flex items-center gap-2 bg-card px-2 text-sm font-medium"
                  style={{ height: HEAD }}
                >
                  <span className="min-w-0 flex-1 truncate" title={slices[view ?? 0]?.name}>
                    {slices[view ?? 0]?.name}
                  </span>
                  <span className="w-14 shrink-0 text-end text-xs font-normal text-muted-foreground">
                    {t`of class`}
                  </span>
                  <span className="w-20 shrink-0" />
                </li>
                {drill.map((s, i) => (
                  <li key={s.name}>
                    <div
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start outline-none focus-visible:ring-2 focus-visible:ring-ring ${activeHolder === i ? "bg-foreground/10" : ""}`}
                      // biome-ignore lint/a11y/noNoninteractiveTabindex: focus highlights the same slice as hover
                      tabIndex={0}
                      {...onHolder(i)}
                    >
                      <span
                        className={`size-2.5 shrink-0 rounded-full ${DOT[i]}`}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 truncate" title={s.name}>
                        {s.name}
                      </span>
                      <span className="w-14 shrink-0 text-end tabular-nums">
                        {percentFigure(s.percent)}
                      </span>
                      <span className="w-20 shrink-0 text-end tabular-nums text-muted-foreground">
                        {shareCount(s.shares, locale)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              {reduced ? null : (
                <Projection
                  key={view ?? 0}
                  show={isOpen}
                  from={{ c: aCentre, r: R * sA }}
                  to={{ c: bCentre, r: R * sB }}
                  half={half}
                  dir={dir}
                />
              )}
            </>
          ) : null}
        </div>
      </div>
      <table className="sr-only">
        <thead>
          <tr>
            <th>{t`Name`}</th>
            <th>{t`Ownership`}</th>
            <th>{t`Shares`}</th>
          </tr>
        </thead>
        <tbody>
          {slices.map((s) => (
            <tr key={s.name}>
              <td>{s.name}</td>
              <td>{percentFigure(s.percent)}</td>
              <td>{shareCount(s.shares, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
