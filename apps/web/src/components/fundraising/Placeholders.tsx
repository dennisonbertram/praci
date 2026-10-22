import { Skeleton } from "@rakazo/ui-web";

/**
 * Static skeletons for a Fundraising section that is empty. They keep the section's real layout
 * where data will appear and do not pulse, so they read as "nothing here yet", not "loading".
 */

/** The round bar with no amounts. */
export function RoundBarPlaceholder() {
  return (
    <Skeleton static aria-hidden="true" className="h-3 w-full rounded-full bg-foreground/15" />
  );
}

/** The legend's value under its label, with no amount. */
export function LegendValuePlaceholder() {
  return <Skeleton static aria-hidden="true" className="mt-1.5 h-4 w-3/5" />;
}

/** One prospect row with no prospect. */
export function ProspectRowPlaceholder() {
  return (
    <li aria-hidden="true" className="flex min-h-13 items-center gap-3 border-t border-border">
      <div className="min-w-0 flex-1">
        <Skeleton static className="h-[11px] w-2/5" />
        <Skeleton static className="mt-1.5 h-2.5 w-1/4" />
      </div>
      <Skeleton static className="hidden h-2.5 w-[60px] @md/bd:block" />
      <Skeleton static className="hidden h-5 w-14 rounded-full @md/bd:block" />
      <span className="w-7" />
    </li>
  );
}

/** One SAFE row with no SAFE. */
export function SafeRowPlaceholder() {
  return (
    <li aria-hidden="true" className="flex min-h-13 items-center gap-3 border-t border-border">
      <div className="min-w-0 flex-1">
        <Skeleton static className="h-[11px] w-1/3" />
        <Skeleton static className="mt-1.5 h-2.5 w-1/5" />
      </div>
      <Skeleton static className="h-2.5 w-16" />
      <Skeleton static className="hidden h-2.5 w-12 @md/bd:block" />
      <Skeleton static className="h-5 w-[52px] rounded-full" />
      <span className="w-7" />
    </li>
  );
}
