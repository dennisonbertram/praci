import type { ReactNode } from "react";

/** A page-level row at the top of the sidebar (Inbox, Finance). */
export function SidebarPageLink({
  testId,
  current,
  icon,
  label,
  onOpen,
  children,
}: {
  testId: string;
  current: boolean;
  icon: ReactNode;
  label: ReactNode;
  onOpen: () => void;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-current={current ? "page" : undefined}
      onClick={onOpen}
      className={`mb-1 flex items-center gap-3 rounded-xl px-2.5 py-2 text-start hover:bg-sidebar-accent ${
        current ? "bg-sidebar-accent" : ""
      }`}
    >
      <span className="grid h-[30px] w-[30px] place-items-center rounded-lg bg-accent text-foreground/80">
        {icon}
      </span>
      <span className="text-[14px] font-medium text-foreground/90">{label}</span>
      {children}
    </button>
  );
}
