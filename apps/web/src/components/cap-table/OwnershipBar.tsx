import { t } from "@lingui/core/macro";
import { cn } from "@rakazo/ui-web/lib/utils";
import { percentFigure } from "../../lib/finance-format";

export type OwnershipSegment = { name: string; percent: number };

/** Four ink tones; the unallocated pool is hatched instead, so it never reads as a holder. */
const TONES = ["bg-foreground", "bg-foreground/65", "bg-foreground/40", "bg-foreground/20"];
const HATCH =
  "bg-[repeating-linear-gradient(135deg,currentColor_0_2px,transparent_2px_5px)] text-foreground/45";

/** At most four tones: the largest three classes keep their own, the rest share the last as "Other". */
function toneSegments(classes: OwnershipSegment[]): OwnershipSegment[] {
  if (classes.length <= TONES.length) return classes;
  const rest = classes.slice(TONES.length - 1);
  return [
    ...classes.slice(0, TONES.length - 1),
    {
      name: t`Other`,
      percent: rest.reduce((sum, c) => sum + Math.round(c.percent * 10), 0) / 10,
    },
  ];
}

/**
 * Who owns the company, one bar. `classes` and `pool` come from `capTableMath`, so the segments
 * and the legend add up to 100.0 exactly like the table's percent column.
 */
export function OwnershipBar({
  classes,
  pool,
  className,
}: {
  classes: OwnershipSegment[];
  pool: number | null;
  className?: string;
}) {
  const segments = toneSegments(classes);
  const total = segments.reduce((sum, s) => sum + s.percent, 0) + (pool ?? 0);
  if (total <= 0) return null;
  return (
    <div className={className}>
      <div aria-hidden="true" className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
        {segments.map((segment, i) => (
          <i
            key={segment.name}
            className={cn("block h-full", TONES[i])}
            style={{ width: `${segment.percent}%` }}
          />
        ))}
        {pool ? <i className={cn("block h-full", HATCH)} style={{ width: `${pool}%` }} /> : null}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {segments.map((segment, i) => (
          <li key={segment.name} className="flex items-center gap-1.5">
            <i aria-hidden="true" className={cn("size-2 rounded-full", TONES[i])} />
            {segment.name} {percentFigure(segment.percent, 1)}
          </li>
        ))}
        {pool ? (
          <li className="flex items-center gap-1.5">
            <i aria-hidden="true" className={cn("size-2 rounded-full", HATCH)} />
            {t`Unallocated pool`} {percentFigure(pool, 1)}
          </li>
        ) : null}
      </ul>
    </div>
  );
}
