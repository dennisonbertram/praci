import { cn } from "@rakazo/ui-web/lib/utils";
import type { ReactNode } from "react";

/** The page's side padding. Page rows and panels that must line up with the title share it. */
export const PAGE_GUTTER_X = "px-4 md:px-7";
export const PAGE_GUTTER_START = "ps-4 md:ps-7";

/** The title row's height. The title and actions sit in it, so titles align on every page. */
export const PAGE_HEADER_ROW = "h-10";

/**
 * A page's title row: the h1, optional meta (status, "Updated …", eye toggle, search), and
 * trailing actions. The first line is always PAGE_HEADER_ROW tall. Where the page is wide enough
 * the meta sits inline after the title; where it is not, the meta wraps onto its own line below
 * and never overlaps the actions. Long titles truncate.
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
    <div
      data-page-header
      className={cn("@container/ph mb-4 flex flex-wrap items-center gap-x-3", className)}
    >
      <h1
        className={cn(
          PAGE_HEADER_ROW,
          "order-1 flex min-w-0 max-w-full items-center text-lg leading-7 font-semibold",
        )}
      >
        <span className="truncate">{title}</span>
      </h1>
      {meta ? (
        <div
          data-page-header-meta
          className="order-3 flex min-w-0 basis-full flex-wrap items-center gap-x-2 gap-y-1 pb-2 text-xs text-muted-foreground @2xl/ph:order-2 @2xl/ph:basis-0 @2xl/ph:flex-1 @2xl/ph:flex-nowrap @2xl/ph:pb-0"
        >
          {meta}
        </div>
      ) : null}
      {actions ? (
        <div
          className={cn(
            PAGE_HEADER_ROW,
            "order-2 ms-auto flex shrink-0 items-center gap-2 @2xl/ph:order-3",
          )}
        >
          {actions}
        </div>
      ) : null}
    </div>
  );
}
