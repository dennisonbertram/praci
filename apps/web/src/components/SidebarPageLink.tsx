import type { ReactElement, ReactNode } from "react";
import { Tip } from "./data-room/FilterBar";

/** In the icon rail a row keeps only its icon; the label moves to a tooltip (also on keyboard focus). */
export function RailTip({
  rail,
  label,
  children,
}: {
  rail: boolean;
  label: string;
  children: ReactElement;
}) {
  return rail ? (
    <Tip label={label} side="right">
      {children}
    </Tip>
  ) : (
    children
  );
}

/**
 * A page-level row at the top of the sidebar (Inbox, Finance). `badge` sits on the right when the
 * sidebar is open and becomes a dot on the icon in the rail, so a notification survives collapse.
 */
export function SidebarPageLink({
  testId,
  current,
  icon,
  label,
  onOpen,
  badge,
  rail = false,
}: {
  testId: string;
  current: boolean;
  icon: ReactNode;
  label: string;
  onOpen: () => void;
  badge?: ReactNode;
  rail?: boolean;
}) {
  return (
    <RailTip rail={rail} label={label}>
      <button
        type="button"
        data-testid={testId}
        aria-current={current ? "page" : undefined}
        aria-label={rail ? label : undefined}
        onClick={onOpen}
        className={`mb-1 flex items-center rounded-xl text-start hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring ${
          rail ? "justify-center px-0 py-1.5" : "gap-3 px-2.5 py-2"
        } ${current ? "bg-sidebar-accent" : ""}`}
      >
        <span className="relative grid h-[30px] w-[30px] place-items-center rounded-lg bg-accent text-foreground/80">
          {icon}
          {rail && badge ? (
            <span
              data-testid="rail-badge"
              aria-hidden="true"
              className="absolute -end-0.5 -top-0.5 size-2.5 rounded-full border-2 border-sidebar bg-primary"
            />
          ) : null}
        </span>
        {rail ? (
          badge ? (
            <span className="sr-only">{badge}</span>
          ) : null
        ) : (
          <>
            <span className="text-[14px] font-medium text-foreground/90">{label}</span>
            {badge}
          </>
        )}
      </button>
    </RailTip>
  );
}
