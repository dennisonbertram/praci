import { useLingui } from "@lingui/react/macro";
import { Skeleton } from "@rakazo/ui-web";
import { StillLoading } from "./ShellSkeleton";

/** Placeholder list rows (avatar and two lines) for any list that is still loading. */
export function RowsSkeleton({
  rows = 6,
  className = "",
  onRetry,
  variant = "rows",
}: {
  /** "bars" is plain full-width bars, for tables and cards with no avatar. */
  variant?: "rows" | "bars";
  rows?: number;
  className?: string;
  onRetry?: () => void;
}) {
  const { t } = useLingui();
  if (variant === "bars") {
    return (
      <div className={`flex flex-col gap-2 ${className}`} aria-busy="true">
        {Array.from({ length: rows }, (_, row) => (
          <Skeleton key={row} className="h-9 w-full" />
        ))}
        <StillLoading onRetry={onRetry} />
      </div>
    );
  }
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
      <StillLoading onRetry={onRetry} />
    </div>
  );
}
