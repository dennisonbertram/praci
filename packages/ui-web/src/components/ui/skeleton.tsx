import { cn } from "@rakazo/ui-web/lib/utils";

/**
 * A placeholder block. By default it pulses, for content that is loading. `static` draws it
 * without the pulse, for a section that is empty and keeps its layout where data will appear.
 */
function Skeleton({
  className,
  static: still = false,
  ...props
}: React.ComponentProps<"div"> & { static?: boolean }) {
  return (
    <div
      data-slot="skeleton"
      data-static={still || undefined}
      className={cn("rounded-md", still ? "bg-foreground/10" : "animate-pulse bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
