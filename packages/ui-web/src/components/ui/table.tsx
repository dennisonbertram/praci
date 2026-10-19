import { cn } from "@rakazo/ui-web/lib/utils";
import type * as React from "react";

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <table data-slot="table" className={cn("w-full table-fixed text-sm", className)} {...props} />
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn(className)} {...props} />;
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={cn(className)} {...props} />;
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "h-14 border-t border-border transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
        className,
      )}
      {...props}
    />
  );
}

// The header row is not a body row: no height, border or hover.
function TableHeadRow({ className, ...props }: React.ComponentProps<"tr">) {
  return <tr data-slot="table-head-row" className={cn(className)} {...props} />;
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn("py-2 pe-3 text-start text-xs font-medium text-muted-foreground", className)}
      {...props}
    />
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
