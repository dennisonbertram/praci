import { Card } from "@rakazo/ui-web";
import { cn } from "@rakazo/ui-web/lib/utils";
import type { ReactNode } from "react";

/**
 * One section of the Investors and Fundraising pages: a card on the page's full content width
 * (so every card ends where the header's actions end), a title row with optional actions, then
 * the content. `attention` outlines the card in ink for what needs the founder.
 */
export function SectionCard({
  title,
  heading,
  actions,
  attention = false,
  className,
  children,
}: {
  /** The section's accessible name; also its visible heading unless `heading` is given. */
  title: string;
  /** Replaces the visible heading, e.g. a round's name with its cap under it. */
  heading?: ReactNode;
  actions?: ReactNode;
  attention?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section aria-label={title} className="min-w-0">
      <Card className={cn("gap-0 px-4", attention && "ring-foreground", className)}>
        <div className={cn("flex min-h-8 items-center gap-2", children && "mb-3")}>
          <div className="me-auto min-w-0">
            {heading ?? <h2 className="truncate text-sm font-semibold">{title}</h2>}
          </div>
          {actions}
        </div>
        {children}
      </Card>
    </section>
  );
}
