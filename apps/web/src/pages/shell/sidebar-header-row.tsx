import type { ReactNode } from "react";
import { desktopBridge } from "../../lib/desktop";
import { WindowChrome } from "../WindowChrome";

/** The sidebar's top row: desktop window controls, then Search, then the header buttons. */
export function SidebarHeaderRow({ search, actions }: { search: ReactNode; actions: ReactNode }) {
  return (
    <div className="app-drag flex items-center gap-1 px-2.5 pb-3 pt-3">
      {/* Desktop only: window controls (or their macOS gap) lead the row; the rest stays no-drag. */}
      {desktopBridge() ? (
        <div data-testid="sidebar-window-chrome" className="shrink-0 pe-1.5">
          <WindowChrome />
        </div>
      ) : null}
      {search}
      {actions}
    </div>
  );
}
