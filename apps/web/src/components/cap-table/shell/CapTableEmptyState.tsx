import type { ReactNode } from "react";

/** A tab with nothing in it yet: one line, and an action only when there is something to do. */
export function CapTableEmptyState({
  message,
  action,
}: {
  /** One short line, e.g. "No stakeholders yet". */
  message: ReactNode;
  /** The one thing that fills the tab, when the person can do it. */
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      {action}
    </div>
  );
}
