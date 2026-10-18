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
