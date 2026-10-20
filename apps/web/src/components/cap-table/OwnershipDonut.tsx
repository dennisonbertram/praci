import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { Card } from "@rakazo/ui-web";
import { useState } from "react";
import { percentFigure, shareCount } from "../../lib/finance-format";

export type DonutClass = { name: string; shares: number };
type Slice = DonutClass & { percent: number };

/** Foreground at stepped opacity: the app is monochrome, and the legend names every slice. */
const OPACITY = [0.9, 0.7, 0.55, 0.4, 0.28, 0.18];
const MAX_SLICES = 6;
const SIZE = 168;
const R = 78;
const INNER = 52;

/**
 * The largest classes by shares, the rest merged into "Other" so there are at most six slices.
 * Percents have one decimal and are spread by largest remainder so they always sum to 100.
 */
export function groupClasses(classes: DonutClass[]): Slice[] {
  const sorted = classes.filter((c) => c.shares > 0).sort((a, b) => b.shares - a.shares);
  const kept = sorted.slice(0, sorted.length > MAX_SLICES ? MAX_SLICES - 1 : MAX_SLICES);
  const rest = sorted.slice(kept.length);
  if (rest.length) kept.push({ name: t`Other`, shares: rest.reduce((n, c) => n + c.shares, 0) });
  const total = kept.reduce((n, c) => n + c.shares, 0);
  const tenths = kept.map((c) => (c.shares * 1000) / total);
  const floors = tenths.map(Math.floor);
  let left = 1000 - floors.reduce((n, v) => n + v, 0);
  for (const i of tenths
    .map((v, index) => ({ index, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac)
    .map((e) => e.index)) {
    if (left-- <= 0) break;
    floors[i] = (floors[i] ?? 0) + 1;
  }
  return kept.map((c, i) => ({ ...c, percent: (floors[i] ?? 0) / 10 }));
}

const point = (angle: number, radius: number) =>
  `${(SIZE / 2 + radius * Math.sin(angle)).toFixed(2)},${(SIZE / 2 - radius * Math.cos(angle)).toFixed(2)}`;

function arc(from: number, to: number) {
  // A full circle cannot be one arc, so a lone slice is cut a hair short.
  const end = Math.min(to, from + Math.PI * 2 - 0.001);
  const large = end - from > Math.PI ? 1 : 0;
  return `M${point(from, R)}A${R},${R} 0 ${large} 1 ${point(end, R)}L${point(end, INNER)}A${INNER},${INNER} 0 ${large} 0 ${point(from, INNER)}Z`;
}

/**
 * Fully diluted ownership by share class as a muted donut with its legend. Percents and share
 * counts are not money, so they stay visible while amounts are hidden. A class listed in
 * `selectable` can be clicked, and then calls `onSelect` with its name.
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
  const slices = groupClasses(classes);
  if (slices.length === 0) return null;
  const locale = i18n.locale || "en";
  const total = slices.reduce((n, s) => n + s.shares, 0);
  const canSelect = (s: Slice) => !!onSelect && selectable.includes(s.name);
  const label = `${t`Ownership`}: ${slices
    .slice(0, 3)
    .map((s) => `${s.name} ${percentFigure(s.percent, 1)}`)
    .join(", ")}`;
  let angle = 0;
  const arcs = slices.map((s) => {
    const from = angle;
    angle += (s.shares / total) * Math.PI * 2;
    return arc(from, angle);
  });
  const on = (i: number) => ({
    onMouseEnter: () => setActive(i),
    onMouseLeave: () => setActive(null),
    onFocus: () => setActive(i),
    onBlur: () => setActive(null),
  });
  const tip = active === null ? null : slices[active];
  return (
    <Card className="mb-4 flex-col gap-4 p-4 @md:flex-row @md:items-center @md:gap-8">
      <div className="relative mx-auto shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} role="img" aria-label={label} data-testid="ownership-donut">
          {slices.map((s, i) => (
            // biome-ignore lint/a11y/noStaticElementInteractions: the legend rows are the keyboard path to the same actions
            <path
              key={s.name}
              d={arcs[i]}
              className={`fill-foreground stroke-card transition-opacity ${canSelect(s) ? "cursor-pointer" : ""}`}
              strokeWidth={2}
              style={{
                opacity: active === null || active === i ? OPACITY[i] : (OPACITY[i] ?? 0) * 0.35,
              }}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onClick={canSelect(s) ? () => onSelect?.(s.name) : undefined}
              data-testid="donut-slice"
            />
          ))}
        </svg>
        {fullyDilutedShares != null ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
            <span className="text-sm font-semibold tabular-nums">
              {shareCount(fullyDilutedShares, locale)}
            </span>
            <span className="text-[10px] leading-tight text-muted-foreground">
              {t`Fully diluted shares`}
            </span>
          </div>
        ) : null}
        {tip ? (
          <div
            role="tooltip"
            className="pointer-events-none absolute start-1/2 top-2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md"
          >
            <div className="font-medium">{tip.name}</div>
            <div className="tabular-nums text-muted-foreground">
              {percentFigure(tip.percent, 1)} · {shareCount(tip.shares, locale)} {t`Shares`}
            </div>
          </div>
        ) : null}
      </div>
      <ul className="grid min-w-0 flex-1 gap-1 text-sm">
        {slices.map((s, i) => {
          const row = (
            <>
              <span
                className="size-2.5 shrink-0 rounded-full bg-foreground"
                style={{ opacity: OPACITY[i] }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate">{s.name}</span>
              <span className="tabular-nums">{percentFigure(s.percent, 1)}</span>
              <span className="w-20 shrink-0 text-end tabular-nums text-muted-foreground">
                {shareCount(s.shares, locale)}
              </span>
            </>
          );
          const cls = `flex w-full items-center gap-2 rounded-md px-2 py-1 text-start ${active === i ? "bg-muted" : ""}`;
          return (
            <li key={s.name}>
              {canSelect(s) ? (
                <button type="button" className={cls} onClick={() => onSelect?.(s.name)} {...on(i)}>
                  {row}
                </button>
              ) : (
                // biome-ignore lint/a11y/noNoninteractiveTabindex: focus shows the same tooltip as hover
                <div className={cls} tabIndex={0} {...on(i)}>
                  {row}
                </div>
              )}
            </li>
          );
        })}
      </ul>
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
              <td>{percentFigure(s.percent, 1)}</td>
              <td>{shareCount(s.shares, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
