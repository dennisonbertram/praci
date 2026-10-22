import { t } from "@lingui/core/macro";
import { cn } from "@rakazo/ui-web/lib/utils";
import { Menu } from "lucide-react";
import type { ReactNode } from "react";
import { createContext, useContext, useLayoutEffect } from "react";

/**
 * The shell provides this so a phone page puts the navigation button on its title row. A header
 * claims the shell's own menu band while mounted; a page without a header keeps the band.
 */
export const PageNavContext = createContext<{
  open: () => void;
  claim: () => () => void;
} | null>(null);

/** The page's side padding. Page rows and panels that must line up with the title share it. */
export const PAGE_GUTTER_X = "px-4 md:px-7";
export const PAGE_GUTTER_START = "ps-4 md:ps-7";

/** The title row's height. The title and actions sit in it, so titles align on every page. */
export const PAGE_HEADER_ROW = "h-10";

/** The phone navigation button. A page header that shows it also claims the shell's menu band. */
export function PageNavButton() {
  const nav = useContext(PageNavContext);
  useLayoutEffect(() => nav?.claim(), [nav]);
  return nav ? (
    <button
      type="button"
      aria-label={t`Open navigation`}
      onClick={nav.open}
      className="-ms-2 grid size-10 shrink-0 place-items-center rounded-lg text-foreground/75 hover:bg-accent lg:hidden"
    >
      <Menu size={19} strokeWidth={1.7} />
    </button>
  ) : null;
}

/**
 * A page's title row: the h1, optional meta (status, "Updated …", eye toggle, search), and
 * trailing actions. The first line is always PAGE_HEADER_ROW tall. Where the page is wide enough
 * the meta sits inline after the title; where it is not, the meta wraps onto its own line below
 * and never overlaps the actions. Long titles truncate. Actions that do not fit beside the title
 * move to their own line below it and wrap there.
 */
export function PageHeader({
  title,
  meta,
  actions,
  className,
  compact = false,
}: {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
  /** Keeps the meta on the title's line down to a narrower pane (512px, not 672px). */
  compact?: boolean;
}) {
  return (
    <div
      data-page-header
      className={cn("@container/ph mb-4 flex flex-wrap items-center gap-x-3", className)}
    >
      <PageNavButton />
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
          className={cn(
            "order-3 flex min-w-0 basis-full flex-wrap items-center gap-x-2 gap-y-1 pb-2 text-xs text-muted-foreground",
            compact
              ? "@lg/ph:order-2 @lg/ph:basis-0 @lg/ph:flex-1 @lg/ph:flex-nowrap @lg/ph:pb-0"
              : "@2xl/ph:order-2 @2xl/ph:basis-0 @2xl/ph:flex-1 @2xl/ph:flex-nowrap @2xl/ph:pb-0",
          )}
        >
          {meta}
        </div>
      ) : null}
      {actions ? (
        <div
          className={cn(
            // min-h, not h: when the actions cannot share the title's line they drop to their own
            // line and wrap there, right-aligned.
            "order-2 ms-auto flex min-h-10 min-w-0 max-w-full flex-wrap items-center justify-end gap-2",
            compact ? "@lg/ph:order-3" : "@2xl/ph:order-3",
          )}
        >
          {actions}
        </div>
      ) : null}
    </div>
  );
}
