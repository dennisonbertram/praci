import { t } from "@lingui/core/macro";
import type { CSSProperties, PointerEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { MIN_CHAT_WIDTH } from "../lib/shell-layout";

const STORAGE_KEY = "rakazo:right-panel-width";
const MIN_WIDTH = 320;
const DEFAULT_WIDTH = 384;
const ABSOLUTE_MAX = 1000;
/** Desktop bots sidebar width (`lg:w-[316px]` in Shell). */
const BOTS_SIDEBAR_WIDTH = 316;

function maximumWidth(reservedLeadingPx: number) {
  return Math.max(
    MIN_WIDTH,
    Math.min(ABSOLUTE_MAX, window.innerWidth - reservedLeadingPx - MIN_CHAT_WIDTH),
  );
}

function readPreferredWidth() {
  try {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    if (saved >= MIN_WIDTH) return Math.min(ABSOLUTE_MAX, saved);
  } catch {
    /* Storage may be disabled. */
  }
  return DEFAULT_WIDTH;
}

export function ResizableSidePanel({
  open,
  panel,
  botsSidebarCollapsed = false,
  onClose,
  children,
}: {
  open: boolean;
  panel: string;
  botsSidebarCollapsed?: boolean;
  /** Closes the panel; below xl it lies over the chat, so a scrim and Escape use it. */
  onClose?: () => void;
  children: ReactNode;
}) {
  const reservedLeadingPx = botsSidebarCollapsed ? 0 : BOTS_SIDEBAR_WIDTH;
  const [preferredWidth, setPreferredWidth] = useState(readPreferredWidth);
  const [maxWidth, setMaxWidth] = useState(() => maximumWidth(reservedLeadingPx));
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; width: number; direction: number } | null>(null);
  const wasOpen = useRef(false);
  const opener = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const returnFocusOnClose = useRef(false);
  if (open && !wasOpen.current) {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  } else if (!open && wasOpen.current) {
    const activeElement = document.activeElement;
    returnFocusOnClose.current =
      activeElement === document.body || Boolean(panelRef.current?.contains(activeElement));
  }
  wasOpen.current = open;
  const width = Math.max(MIN_WIDTH, Math.min(maxWidth, preferredWidth));

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(preferredWidth));
    } catch {
      /* Storage may be disabled. */
    }
  }, [preferredWidth]);

  useEffect(() => {
    function syncMax() {
      setMaxWidth(maximumWidth(reservedLeadingPx));
    }
    syncMax();
    window.addEventListener("resize", syncMax);
    return () => window.removeEventListener("resize", syncMax);
  }, [reservedLeadingPx]);

  useEffect(() => {
    if (open) {
      if (!window.matchMedia("(max-width: 1279px)").matches) return;
      const panelElement = panelRef.current;
      if (!panelElement || panelElement.contains(document.activeElement)) return;
      const firstFocusable = Array.from(
        panelElement.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).find(
        (element) =>
          element.tagName !== "HR" &&
          getComputedStyle(element).display !== "none" &&
          getComputedStyle(element).visibility !== "hidden",
      );
      firstFocusable?.focus();
      return;
    }
    if (returnFocusOnClose.current) {
      const focusTarget = opener.current;
      if (focusTarget && document.contains(focusTarget)) focusTarget.focus();
    }
    returnFocusOnClose.current = false;
  }, [open]);

  useEffect(() => {
    if (!open || !onClose) return;
    const overlay = window.matchMedia("(max-width: 1279px)");
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !event.defaultPrevented && overlay.matches) onClose?.();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  function stopDrag(event: PointerEvent<HTMLHRElement>) {
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function setWidthFromUser(next: number) {
    setPreferredWidth(Math.max(MIN_WIDTH, Math.min(maximumWidth(reservedLeadingPx), next)));
  }

  // A closed panel leaves nothing in the page, not an empty unnamed landmark.
  if (!open) return null;
  return (
    <>
      {onClose ? (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          data-testid="side-panel-scrim"
          className="absolute inset-0 z-10 bg-foreground/30 xl:hidden"
          onClick={onClose}
        />
      ) : null}
      <aside
        ref={panelRef}
        data-testid="side-panel"
        data-toast-panel=""
        data-panel={panel}
        style={{ "--panel-width": `${width}px` } as CSSProperties}
        className={`absolute inset-y-0 end-0 z-20 flex min-h-0 shrink-0 flex-col overflow-hidden bg-background pb-[var(--toast-page-reserve,0px)] xl:relative ${dragging ? "" : "transition-[width] duration-150 ease-out"} w-full max-w-[384px] max-sm:max-w-none border-s border-sidebar-border shadow-xl xl:w-(--panel-width) xl:max-w-none xl:shadow-none`}
      >
        <hr
          tabIndex={0}
          aria-label={t`Resize panel`}
          aria-orientation="vertical"
          aria-valuemin={MIN_WIDTH}
          aria-valuemax={maxWidth}
          aria-valuenow={Math.round(width)}
          className="absolute inset-y-0 start-0 z-30 m-0 hidden h-full w-2 touch-none cursor-col-resize border-0 bg-transparent hover:bg-border focus-visible:bg-ring focus-visible:outline-none xl:block"
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = {
              x: event.clientX,
              width,
              direction: document.documentElement.dir === "rtl" ? -1 : 1,
            };
            setDragging(true);
          }}
          onPointerMove={(event) => {
            if (drag.current)
              setWidthFromUser(
                drag.current.width + (drag.current.x - event.clientX) * drag.current.direction,
              );
          }}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
          onLostPointerCapture={() => {
            drag.current = null;
            setDragging(false);
          }}
          onKeyDown={(event) => {
            const direction = document.documentElement.dir === "rtl" ? -1 : 1;
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              setWidthFromUser(width + (event.key === "ArrowLeft" ? 32 : -32) * direction);
            } else if (event.key === "Home") {
              event.preventDefault();
              setWidthFromUser(MIN_WIDTH);
            } else if (event.key === "End") {
              event.preventDefault();
              setWidthFromUser(maximumWidth(reservedLeadingPx));
            }
          }}
        />
        {children}
      </aside>
    </>
  );
}
