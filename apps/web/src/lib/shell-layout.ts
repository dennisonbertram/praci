import type { RefObject } from "react";
import { useEffect, useRef, useSyncExternalStore } from "react";

/**
 * Shell layout breakpoints. Tailwind classes must stay static, so these mirror `lg:` (sidebar)
 * and `xl:` (right panel) in Shell and ResizableSidePanel.
 */
/** The bots sidebar docks from here; below it, it is a drawer. */
export const SIDEBAR_DOCKED_QUERY = "(min-width: 1024px)";
/** The right panel docks from here; below it, it overlays the chat. */
export const PANEL_DOCKED_QUERY = "(min-width: 1280px)";
/** The chat column never shrinks below this when the panel is docked. */
export const MIN_CHAT_WIDTH = 480;

/** Whether the sidebar is docked (true) or a drawer (false) at the current width. */
export function useSidebarDocked(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia(SIDEBAR_DOCKED_QUERY);
      query.addEventListener("change", notify);
      return () => query.removeEventListener("change", notify);
    },
    () => window.matchMedia(SIDEBAR_DOCKED_QUERY).matches,
    () => true,
  );
}

/** The leading window controls move into the page header whenever the sidebar header has no room for them (rail or drawer). */
export function showHeaderWindowChrome(sidebarCollapsed: boolean, sidebarDocked: boolean): boolean {
  return sidebarCollapsed || !sidebarDocked;
}

/** Docked and collapsed: the sidebar shows as an icon rail. */
export function sidebarRail(collapsed: boolean, docked: boolean): boolean {
  return collapsed && docked;
}

/** Below the dock width the sidebar is out of the tab order and screen reader tree unless the drawer is open. */
export function sidebarInert(docked: boolean, drawerOpen: boolean): boolean {
  return drawerOpen ? false : !docked;
}

/**
 * Drawer keyboard behaviour: focus moves into the drawer on open, Escape closes it, and focus
 * returns to the opener on close. The page behind is inert while open, which traps focus.
 */
export function useDrawerFocus(
  open: boolean,
  close: () => void,
  drawer: RefObject<HTMLElement | null>,
) {
  const opener = useRef<Element | null>(null);
  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    // The search box (read-only, so it raises no keyboard) is the way in; else the first control.
    (
      drawer.current?.querySelector<HTMLElement>("[data-drawer-focus]") ??
      drawer.current?.querySelector<HTMLElement>("button, a[href]")
    )?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (opener.current instanceof HTMLElement) opener.current.focus();
    };
  }, [open, close, drawer]);
}
