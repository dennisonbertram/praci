import { t } from "@lingui/core/macro";
import { formatDollars } from "./format";

export type FinancingBar = { id: string; label: string; cents: string };

/** Cash raised per round, in date order, as bars scaled to the largest round, with a cumulative line. */
export function FinancingChart({ bars }: { bars: FinancingBar[] }) {
  if (bars.length === 0) return null;
  const max = bars.reduce((top, bar) => (BigInt(bar.cents) > top ? BigInt(bar.cents) : top), 0n);
  const total = bars.reduce((sum, bar) => sum + BigInt(bar.cents), 0n);
  const height = (cents: string) => (max === 0n ? 0 : Number((BigInt(cents) * 1000n) / max) / 10);
  let running = 0n;
  const points = bars.map((bar, index) => {
    running += BigInt(bar.cents);
    const x = Number((BigInt(index * 2 + 1) * 1000n) / BigInt(bars.length * 2)) / 10;
    const y = total === 0n ? 100 : 100 - Number((running * 1000n) / total) / 10;
    return `${x},${y}`;
  });
  return (
    <figure className="flex flex-col gap-2" aria-label={t`Cash raised by round`}>
      <figcaption className="text-sm">
        <span className="font-semibold tabular-nums">{formatDollars(total.toString())}</span>{" "}
        <span className="text-muted-foreground">{t`raised`}</span>
      </figcaption>
      {/* Values, then the plot (bars and the cumulative line share its box), then names. */}
      <div className="flex gap-3">
        {bars.map((bar) => (
          <span
            key={bar.id}
            className="min-w-12 flex-1 text-center text-xs tabular-nums text-muted-foreground"
          >
            {formatDollars(bar.cents)}
          </span>
        ))}
      </div>
      <div className="relative flex h-32 items-end gap-3">
        {bars.map((bar) => (
          <span
            key={bar.id}
            className="min-w-12 flex-1 rounded-t-sm bg-primary"
            style={{ height: `${height(bar.cents)}%` }}
          />
        ))}
        <svg
          role="img"
          aria-label={t`Cumulative cash raised ${formatDollars(total.toString())}`}
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <polyline
            points={points.join(" ")}
            fill="none"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            className="stroke-muted-foreground"
          />
        </svg>
      </div>
      <ol className="flex gap-3">
        {bars.map((bar) => (
          <li key={bar.id} className="min-w-12 flex-1 truncate text-center text-xs">
            {bar.label}
          </li>
        ))}
      </ol>
    </figure>
  );
}
