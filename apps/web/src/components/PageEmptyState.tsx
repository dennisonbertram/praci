import type { ReactNode } from "react";

/**
 * The empty state of a main page (Inbox, Finance, Cap Table, Data room), under its title: an icon, a title, one line on
 * what goes here, and the action that fills it.
 */
export function PageEmptyState({
  icon,
  title,
  description,
  children,
  className = "",
}: {
  icon: ReactNode;
  title: ReactNode;
  description: ReactNode;
  /** The primary action, then any secondary ones. */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      // Top-aligned on every page, so the empty pages line up when you move between them.
      className={`flex flex-col items-center gap-3 px-6 py-12 text-center ${className}`}
    >
      <div className="mb-1 flex gap-3 text-muted-foreground">{icon}</div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {children ? <div className="mt-1 flex flex-wrap justify-center gap-2">{children}</div> : null}
    </div>
  );
}
