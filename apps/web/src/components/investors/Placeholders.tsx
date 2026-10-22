import { t } from "@lingui/core/macro";
import { Skeleton } from "@rakazo/ui-web";

/**
 * Static skeletons for an Investors section that is empty. They keep the section's real layout
 * where data will appear and do not pulse, so they read as "nothing here yet", not "loading".
 */

/** The Fully diluted and Equity raised cards with no figures. */
export function FiguresPlaceholder() {
  return (
    <div className="mb-4 grid grid-cols-2 gap-2 @md/bd:gap-3">
      {[t`Fully diluted`, t`Equity raised`].map((title, i) => (
        <div key={title} className="rounded-xl px-3.5 py-3 ring-1 ring-foreground/10">
          <div className="text-xs font-semibold text-muted-foreground">{title}</div>
          <Skeleton static className={`mt-3 h-[18px] ${i === 0 ? "w-1/2" : "w-2/5"}`} />
          <Skeleton static className="mt-2.5 h-2.5 w-1/3" />
        </div>
      ))}
    </div>
  );
}

/** The ownership bar and its legend with no classes. */
export function OwnershipPlaceholder({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden="true">
      <Skeleton static className="h-2.5 w-full rounded-full" />
      <div className="mt-2 flex gap-4">
        <Skeleton static className="h-2 w-[90px]" />
        <Skeleton static className="h-2 w-[90px]" />
        <Skeleton static className="hidden h-2 w-[120px] @md/bd:block" />
      </div>
    </div>
  );
}

/** One update row with no update. */
export function UpdateRowPlaceholder() {
  return (
    <li aria-hidden="true" className="flex min-h-13 items-center gap-3 border-t border-border">
      <div className="min-w-0 flex-1">
        <Skeleton static className="h-[11px] w-2/5" />
        <Skeleton static className="mt-1.5 h-2.5 w-1/4" />
      </div>
      <Skeleton static className="h-5 w-[52px] rounded-full" />
      <span className="w-7" />
    </li>
  );
}

/** One contact row with no contact. */
export function ContactRowPlaceholder() {
  return (
    <li aria-hidden="true" className="flex min-h-13 items-center gap-3 border-t border-border">
      <Skeleton static className="size-7 shrink-0 rounded-full" />
      <div className="min-w-0 flex-[1.2]">
        <Skeleton static className="h-[11px] w-3/5" />
        <Skeleton static className="mt-1.5 h-2.5 w-2/5" />
      </div>
      <div className="hidden min-w-0 flex-[1.3] @md/bd:block">
        <Skeleton static className="h-2.5 w-3/5" />
      </div>
      <div className="hidden w-[140px] @md/bd:block">
        <Skeleton static className="h-2.5 w-[60px]" />
      </div>
      <span className="w-7" />
    </li>
  );
}
