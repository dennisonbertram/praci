import type { ReactElement, ReactNode } from "react";
import { Tip } from "./data-room/FilterBar";
import { usePagesCollapsed } from "./SidebarPagesGroup";

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
  href,
  current,
  icon,
  label,
  onOpen,
  badge,
  badgeLabel,
  onBadgeClick,
  notified = false,
  rail = false,
}: {
  testId: string;
  /** Makes the row a real link: it opens in a new tab and is announced as a link. */
  href?: string;
  current: boolean;
  icon: ReactNode;
  label: string;
  onOpen: () => void;
  badge?: ReactNode;
  /** What the badge means in words (for example "3 unread"), added to the accessible name. */
  badgeLabel?: string;
  /** Makes the badge its own button beside the row, so the row and the badge open different views. */
  onBadgeClick?: () => void;
  /** Unseen notification: the row stays visible while the pages group is collapsed. */
  notified?: boolean;
  rail?: boolean;
}) {
  const collapsed = usePagesCollapsed();
  if (collapsed && !notified && !current) return null;
  const name = badgeLabel ? `${label}, ${badgeLabel}` : label;
  const split = !rail && !!badge && !!onBadgeClick;
  const Row = href ? "a" : "button";
  const row = (
    <Row
      {...(href ? { href } : { type: "button" as const })}
      data-testid={testId}
      data-tour={testId}
      data-roster-row={testId}
      aria-current={current ? "page" : undefined}
      aria-label={rail || badgeLabel ? name : undefined}
      onClick={(event) => {
        // A link keeps the browser's own handling of new-tab clicks; a plain click stays in the app.
        if (href && (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0))
          return;
        event.preventDefault();
        onOpen();
      }}
      className={`mb-0.5 flex items-center ${split ? "w-full" : ""} rounded-xl text-start hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring ${
        rail
          ? "justify-center px-0 py-1.5"
          : "gap-3 px-2.5 py-1 pointer-coarse:min-h-11 pointer-coarse:py-1.5"
      } ${current ? "bg-sidebar-accent" : ""}`}
    >
      <span className="relative grid h-6 w-6 pointer-coarse:h-7 pointer-coarse:w-7 place-items-center rounded-lg bg-accent text-foreground/80">
        {icon}
        {rail && badge ? (
          <span
            data-testid="rail-badge"
            aria-hidden="true"
            className="absolute -end-0.5 -top-0.5 size-2.5 rounded-full border-2 border-sidebar bg-primary"
          />
        ) : null}
      </span>
      {rail ? null : (
        <>
          <span className="text-[14px] font-medium text-foreground/90">{label}</span>
          {split ? null : badge}
        </>
      )}
    </Row>
  );
  return (
    <RailTip rail={rail} label={label}>
      {split ? (
        <div className="relative">
          {row}
          <button
            type="button"
            aria-label={badgeLabel}
            onClick={onBadgeClick}
            className="absolute end-1 top-1/2 grid min-h-6 min-w-6 -translate-y-1/2 place-items-center rounded-md px-1.5 py-1 hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring pointer-coarse:min-h-11 pointer-coarse:min-w-11"
          >
            {badge}
          </button>
        </div>
      ) : (
        row
      )}
    </RailTip>
  );
}
