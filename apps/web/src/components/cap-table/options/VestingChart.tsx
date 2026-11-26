import { i18n } from "@lingui/core";
import { useLingui } from "@lingui/react/macro";
import type { VestingEvent } from "@rakazo/core/equity";
import { todayIso } from "../../../lib/legal-format";
import { formatDay } from "./format";

const WIDTH = 480;
const HEIGHT = 160;
const PAD_X = 4;
const TOP = 22;
const BASELINE = 136;

const figure = (value: bigint) => new Intl.NumberFormat(i18n.locale || "en").format(value);

/** Whole days since the epoch, so dates sort and scale without timezone drift. */
const dayOf = (iso: string) => {
  const [year, month, day] = iso.split("-").map(Number);
  return Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1) / 86_400_000;
};

const round = (value: number) => Math.round(value * 10) / 10;

/**
 * Cumulative vested shares over time as a step chart. Shares stay bigint until the final
 * coordinate is drawn.
 */
export function VestingChart({
  events,
  total,
  asOf,
}: {
  events: VestingEvent[];
  total: bigint;
  /** Date the marker and the vested figure use; today when omitted. */
  asOf?: string;
}) {
  const { t } = useLingui();
  if (events.length === 0) return null;

  const first = events[0];
  const last = events.at(-1);
  if (!first || !last) return null;
  const marker = asOf ?? todayIso();
  const firstDay = dayOf(first.date);
  const lastDay = dayOf(last.date);
  const span = lastDay - firstDay;
  const plotWidth = WIDTH - PAD_X * 2;

  const xOf = (date: string) =>
    span <= 0 ? PAD_X + plotWidth : PAD_X + ((dayOf(date) - firstDay) / span) * plotWidth;
  const yOf = (shares: bigint) => {
    if (total <= 0n) return BASELINE;
    const ratio = Number((shares * 10_000n) / total) / 10_000;
    return BASELINE - Math.min(ratio, 1) * (BASELINE - TOP);
  };

  // The start of the series sits at zero and the first event steps the line up to its own date.
  const points = [
    { x: PAD_X, y: BASELINE },
    ...events.map((event) => ({ x: xOf(event.date), y: yOf(event.cumulative) })),
  ];
  const path = points
    .map((point, index) =>
      index === 0 ? `M${round(point.x)},${round(point.y)}` : `H${round(point.x)}V${round(point.y)}`,
    )
    .join("");

  let vested = 0n;
  for (const event of events) if (event.date <= marker) vested = event.cumulative;
  const markerX = span > 0 && marker >= first.date && marker <= last.date ? xOf(marker) : null;

  return (
    <svg
      role="img"
      aria-label={t`Vesting: ${figure(vested)} of ${figure(total)} vested by ${marker}`}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="aspect-[3/1] w-full max-w-[480px] shrink-0 text-primary"
    >
      <text x={PAD_X} y={12} className="fill-current" fontSize={12} fontWeight={600}>
        {figure(total)}
      </text>
      <line
        x1={PAD_X}
        y1={BASELINE}
        x2={WIDTH - PAD_X}
        y2={BASELINE}
        className="stroke-current text-muted-foreground"
        strokeWidth={1}
      />
      {markerX != null && (
        <line
          x1={round(markerX)}
          y1={TOP}
          x2={round(markerX)}
          y2={BASELINE}
          className="stroke-current text-muted-foreground"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      )}
      <path d={path} fill="none" className="stroke-current" strokeWidth={2} />
      <text x={PAD_X} y={HEIGHT - 6} className="fill-muted-foreground" fontSize={11}>
        {formatDay(first.date)}
      </text>
      {last.date !== first.date && (
        <text
          x={WIDTH - PAD_X}
          y={HEIGHT - 6}
          textAnchor="end"
          className="fill-muted-foreground"
          fontSize={11}
        >
          {formatDay(last.date)}
        </text>
      )}
    </svg>
  );
}
