import { useLingui } from "@lingui/react/macro";

export type Trend = "up" | "down" | "flat";

/** A move under half a percent from first to last value counts as flat (stablecoins). */
export function trendOf(values: number[]): Trend {
  const first = values[0];
  const last = values.at(-1);
  if (first === undefined || last === undefined || first <= 0) return "flat";
  const change = (last - first) / first;
  return Math.abs(change) < 0.005 ? "flat" : change > 0 ? "up" : "down";
}

const TONE: Record<Trend, string> = {
  up: "text-success",
  down: "text-destructive",
  flat: "text-muted-foreground",
};
const WIDTH = 64;
const HEIGHT = 20;

/** A tiny trend line, oldest value first. Draws nothing for fewer than two values. */
export function Sparkline({
  values,
  label,
  neutral = false,
}: {
  values: number[];
  /** Accessible name for non-price series; the price wording stays the default. */
  label?: string;
  /** Spend is not good or bad by direction, so Brex draws it in muted ink. */
  neutral?: boolean;
}) {
  const { t } = useLingui();
  if (values.length < 2) return null;
  const trend = trendOf(values);
  const min = Math.min(...values);
  const span = Math.max(...values) - min;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * WIDTH;
      // A flat line sits in the middle rather than on an edge.
      const y = span === 0 ? HEIGHT / 2 : 2 + (1 - (v - min) / span) * (HEIGHT - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const text =
    label ?? (trend === "up" ? t`Price up` : trend === "down" ? t`Price down` : t`Price flat`);
  return (
    <svg
      role="img"
      aria-label={text}
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className={neutral ? "text-muted-foreground" : TONE[trend]}
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
