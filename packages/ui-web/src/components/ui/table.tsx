import { cn } from "@rakazo/ui-web/lib/utils";
import { ArrowDown, ArrowUp } from "lucide-react";
import type * as React from "react";

// `compact` is for dense lists of short rows: columns size to their content (no fixed layout, so
// give columns widths only where they need them) and rows are as tall as their content.
function Table({
  className,
  compact,
  ...props
}: React.ComponentProps<"table"> & { compact?: boolean }) {
  return (
    <table
      data-slot="table"
      data-compact={compact ? "" : undefined}
      className={cn(
        "group/table w-full text-sm",
        compact ? "table-auto" : "table-fixed",
        className,
      )}
      {...props}
    />
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn(className)} {...props} />;
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={cn(className)} {...props} />;
}

// `onOpen` makes the whole row open its item. Put `data-row-open` on the one control that names
// the row (a button with no click handler of its own): it is the row's only tab stop, and Enter on
// it reaches the row. Clicks on any other control inside the row, and clicks that end a text
// selection, do not open it.
function TableRow({
  className,
  onOpen,
  onClick,
  ...props
}: React.ComponentProps<"tr"> & { onOpen?: () => void }) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "h-14 group-data-[compact]/table:h-auto pointer-coarse:group-data-[compact]/table:h-11 border-t border-border transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
        onOpen &&
          "cursor-pointer [&_[data-row-open]]:-mx-1 [&_[data-row-open]]:px-1 [&>td:first-child]:ps-2 has-[:focus-visible]:bg-muted/50 has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-ring",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        if (!onOpen || event.defaultPrevented) return;
        const control = (event.target as Element).closest("button,a,input,select,textarea");
        if (control && !control.hasAttribute("data-row-open")) return;
        if (window.getSelection()?.toString()) return;
        onOpen();
      }}
      {...props}
    />
  );
}

// The header row is not a body row: no height, border or hover.
function TableHeadRow({ className, ...props }: React.ComponentProps<"tr">) {
  return <tr data-slot="table-head-row" className={cn(className)} {...props} />;
}

// With `onSort` the header is a button that sorts by its column. `sortDirection` is the column's
// current sort (null when another column is sorted): the arrow shows while it is set, and on
// hover or focus otherwise. Without `onSort` it is a plain header.
function TableHead({
  className,
  children,
  sortDirection,
  onSort,
  ...props
}: React.ComponentProps<"th"> & { sortDirection?: "asc" | "desc" | null; onSort?: () => void }) {
  const Arrow = sortDirection === "desc" ? ArrowDown : ArrowUp;
  return (
    <th
      data-slot="table-head"
      scope="col"
      aria-sort={
        onSort
          ? sortDirection === "asc"
            ? "ascending"
            : sortDirection === "desc"
              ? "descending"
              : "none"
          : undefined
      }
      className={cn("py-2 pe-3 text-start text-xs font-medium text-muted-foreground", className)}
      {...props}
    >
      {onSort ? (
        <button
          type="button"
          onClick={onSort}
          className={cn(
            "group/sort inline-flex items-center gap-1 rounded-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
            sortDirection && "text-foreground",
          )}
        >
          {children}
          <Arrow
            aria-hidden="true"
            className={cn(
              "size-3",
              !sortDirection &&
                "opacity-0 group-hover/sort:opacity-60 group-focus-visible/sort:opacity-60",
            )}
          />
        </button>
      ) : (
        children
      )}
    </th>
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return <td data-slot="table-cell" className={cn("py-2 pe-3", className)} {...props} />;
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableHeadRow,
  TableRow,
};
