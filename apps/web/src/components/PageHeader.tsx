import { cn } from "@rakazo/ui-web/lib/utils";
import type { ReactNode } from "react";

/** The one height and spacing every page title row uses, so titles sit at the same place. */
export const PAGE_HEADER_ROW = "mb-4 flex h-10 shrink-0 items-center gap-x-3";

/**
 * A page's title row: the h1, optional inline meta after it (status, "Updated …", eye toggle),
 * and trailing actions. The row height is fixed, so meta and actions never move the title.
 */
export function PageHeader({
  title,
  meta,
  actions,
  className,
}: {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div data-page-header className={cn(PAGE_HEADER_ROW, className)}>
      <h1 className="shrink-0 text-lg leading-7 font-semibold">{title}</h1>
      {meta ? (
        <div className="flex min-w-0 flex-1 items-center gap-x-2 text-xs text-muted-foreground">
          {meta}
        </div>
      ) : null}
      {actions ? <div className="ms-auto flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
