import { useLingui } from "@lingui/react/macro";
import { Skeleton } from "@rakazo/ui-web";

/** Placeholder list rows (avatar and two lines) for any list that is still loading. */
export function RowsSkeleton({ rows = 6, className = "" }: { rows?: number; className?: string }) {
  const { t } = useLingui();
  return (
    <div role="status" aria-label={t`Loading…`} className={`flex flex-col gap-4 ${className}`}>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex items-center gap-3">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="h-2.5 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
