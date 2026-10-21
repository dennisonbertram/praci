import { useLingui } from "@lingui/react/macro";
import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@rakazo/ui-web";
import { ChevronDown, MoreHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { createContext, useContext } from "react";

const PagesCollapsedContext = createContext(false);

/** True while the pages group is collapsed; the icon rail never collapses, so it reads false there. */
export const usePagesCollapsed = () => useContext(PagesCollapsedContext);

/**
 * The sidebar's pages (Inbox, Finance, ...) under a header styled like the "Personnel" one. Rows
 * hide when collapsed unless they hold a notification or are the current page. The rail ignores it.
 */
export function SidebarPagesGroup({
  title,
  collapsed,
  rail = false,
  onToggle,
  pages = [],
  hidden = [],
  onToggleHidden,
  children,
}: {
  title: string;
  collapsed: boolean;
  rail?: boolean;
  onToggle: () => void;
  /** Every page that can be shown or hidden; with `onToggleHidden`, adds the "⋯" menu. */
  pages?: readonly { key: string; label: string }[];
  hidden?: readonly string[];
  onToggleHidden?: (key: string) => void;
  children: ReactNode;
}) {
  const { t } = useLingui();
  return (
    <PagesCollapsedContext.Provider value={collapsed && !rail}>
      {rail ? null : (
        <div className="flex items-center pt-1 pb-0.5">
          <button
            type="button"
            data-testid="sidebar-pages-toggle"
            aria-expanded={!collapsed}
            aria-label={collapsed ? t`Expand ${title}` : t`Collapse ${title}`}
            className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-2.5 py-1 text-[11px] font-semibold tracking-wider text-foreground/70 uppercase hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
            onClick={onToggle}
          >
            <span className="line-clamp-2 text-start break-words">{title}</span>
            <ChevronDown
              size={14}
              strokeWidth={1.8}
              className={`transition-transform motion-reduce:transition-none ${collapsed ? "-rotate-90" : ""}`}
              aria-hidden="true"
            />
          </button>
          {onToggleHidden ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t`Page options`}
                    className="text-muted-foreground hover:text-foreground"
                  />
                }
              >
                <MoreHorizontal size={14} aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" aria-label={t`Page options`} className="w-[200px]">
                {pages.map((page) => (
                  <DropdownMenuCheckboxItem
                    key={page.key}
                    checked={!hidden.includes(page.key)}
                    onCheckedChange={() => onToggleHidden(page.key)}
                  >
                    {page.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      )}
      {children}
    </PagesCollapsedContext.Provider>
  );
}
