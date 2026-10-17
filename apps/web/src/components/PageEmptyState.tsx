import type { ReactNode } from "react";

/**
 * The empty state of a main page (Finance, Cap Table, Data room): an icon, a title, one line on
 * what goes here, and the action that fills it.
 */
export function PageEmptyState({
  icon,
  title,
  description,
  children,
  titleAs: Title = "h2",
  className = "",
}: {
  icon: ReactNode;
  title: ReactNode;
  description: ReactNode;
  /** The primary action, then any secondary ones. */
  children?: ReactNode;
  /** h1 when the empty state is the whole page, with no page header above it. */
  titleAs?: "h1" | "h2";
  className?: string;
}) {
  return (
    <div
      className={`flex min-h-72 flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center ${className}`}
    >
      <div className="mb-1 flex gap-3 text-muted-foreground">{icon}</div>
      <Title className="text-lg font-semibold">{title}</Title>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {children ? <div className="mt-1 flex flex-wrap justify-center gap-2">{children}</div> : null}
    </div>
  );
}
