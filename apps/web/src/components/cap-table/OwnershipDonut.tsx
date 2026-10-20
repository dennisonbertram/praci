import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { Card } from "@rakazo/ui-web";
import { useState } from "react";
import { percentFigure, shareCount } from "../../lib/finance-format";

export type DonutClass = { name: string; shares: number };
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
export function groupClasses(classes: DonutClass[]): Slice[] {
  const sorted = classes.filter((c) => c.shares > 0).sort((a, b) => b.shares - a.shares);
  const kept = sorted.slice(0, sorted.length > MAX_SLICES ? MAX_SLICES - 1 : MAX_SLICES);
  const rest = sorted.slice(kept.length);
  if (rest.length) kept.push({ name: t`Other`, shares: rest.reduce((n, c) => n + c.shares, 0) });
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

/** Slice outlines. Tiny slices are widened to MIN_FRACTION and the others shrink to make room. */
export function sliceArcs(shares: number[]): string[] {
  if (shares.length === 1) return [ring()];
  const total = shares.reduce((n, v) => n + v, 0);
  const small = shares.filter((v) => v / total < MIN_FRACTION).length;
  const room = 1 - small * MIN_FRACTION;
  const bigTotal = shares.reduce((n, v) => (v / total < MIN_FRACTION ? n : n + v), 0);
  let angle = 0;
  return shares.map((v) => {
    const fraction = v / total < MIN_FRACTION ? MIN_FRACTION : (v / bigTotal) * room;
    const from = angle;
    angle += fraction * Math.PI * 2;
    return arc(from + GAP / 2, angle - GAP / 2);
  });
}

/**
 * Ownership by share class as a muted donut with its legend. The slices cover the fully diluted
 * count: what no class holds (granted options and the unallocated pool) is its own slice.
 * Percents and share counts are not money, so they stay visible while amounts are hidden. A class
 * listed in `selectable` can be clicked, and then calls `onSelect` with its name.
 */
export function OwnershipDonut({
  classes,
  fullyDilutedShares,
  selectable = [],
  onSelect,
}: {
  classes: DonutClass[];
  fullyDilutedShares: number | null;
  selectable?: string[];
  onSelect?: (name: string) => void;
}) {
  const [active, setActive] = useState<number | null>(null);
  const issued = classes.reduce((n, c) => n + c.shares, 0);
  const unissued = (fullyDilutedShares ?? 0) - issued;
  const slices = groupClasses(
    unissued > 0 ? [...classes, { name: t`Options and pool`, shares: unissued }] : classes,
  );
  if (slices.length === 0) return null;
  const locale = i18n.locale || "en";
  const total = slices.reduce((n, s) => n + s.shares, 0);
  const canSelect = (s: Slice) => !!onSelect && selectable.includes(s.name);
  const label = `${t`Ownership`}: ${slices
    .slice(0, 3)
    .map((s) => `${s.name} ${percentFigure(s.percent)}`)
    .join(", ")}`;
  const arcs = sliceArcs(slices.map((s) => s.shares));
  const on = (i: number) => ({
    onMouseEnter: () => setActive(i),
    onMouseLeave: () => setActive(null),
    onFocus: () => setActive(i),
    onBlur: () => setActive(null),
  });
  const tip = active === null ? null : slices[active];
  return (
    <Card className="mb-4 p-4 @md:p-6">
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 @md:flex-row @md:justify-center @md:gap-12">
        <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
          <svg
            width={SIZE}
            height={SIZE}
            role="img"
            aria-label={label}
            data-testid="ownership-donut"
          >
            {slices.map((s, i) => (
              // biome-ignore lint/a11y/noStaticElementInteractions: the legend rows are the keyboard path to the same actions
              <path
                key={s.name}
                d={arcs[i]}
                fillRule="evenodd"
                className={`${FILL[i]} transition-opacity ${canSelect(s) ? "cursor-pointer" : ""} ${active !== null && active !== i ? "opacity-30" : ""}`}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onClick={canSelect(s) ? () => onSelect?.(s.name) : undefined}
                data-testid="donut-slice"
              />
            ))}
          </svg>
          <div
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center"
            data-testid="donut-centre"
          >
            <span className="text-xl font-semibold leading-none tabular-nums">
              {shareCount(tip ? tip.shares : total, locale)}
            </span>
            <span className="mt-1 line-clamp-2 text-xs leading-tight text-muted-foreground">
              {tip ? tip.name : unissued > 0 ? t`Fully diluted shares` : t`Shares`}
            </span>
          </div>
        </div>
        <ul className="grid w-full min-w-0 gap-0.5 text-sm @md:w-auto @md:min-w-72 @md:max-w-sm">
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
            const cls = `flex w-full items-center gap-2 @md:gap-3 rounded-md px-2 py-1.5 text-start outline-none focus-visible:ring-2 focus-visible:ring-ring ${active === i ? "bg-foreground/10" : ""}`;
            return (
              <li key={s.name}>
                {canSelect(s) ? (
                  <button
                    type="button"
                    className={cls}
                    onClick={() => onSelect?.(s.name)}
                    {...on(i)}
                  >
                    {row}
                  </button>
                ) : (
                  // biome-ignore lint/a11y/noNoninteractiveTabindex: focus highlights the same slice as hover
                  <div className={cls} tabIndex={0} {...on(i)}>
                    {row}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
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
