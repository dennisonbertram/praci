import { t } from "@lingui/core/macro";
import type { KeyboardEvent, PointerEvent, ReactNode } from "react";
import { useRef, useState } from "react";

const WIDTH_KEY = "rakazo:data-room-folders-width";
export const MIN_FOLDERS_WIDTH = 180;
export const DEFAULT_FOLDERS_WIDTH = 244;
const KEY_STEP = 32;

function savedWidth() {
  try {
    const saved = Number(localStorage.getItem(WIDTH_KEY));
    if (saved >= MIN_FOLDERS_WIDTH) return saved;
  } catch {
    // Storage blocked: the default applies.
  }
  return DEFAULT_FOLDERS_WIDTH;
}

/**
 * The folder column. Its end edge is a handle: drag it or use the arrow keys to resize (at least
 * 180px, at most half the page); double-click resets it. The width is remembered in this browser.
 */
export function ResizableFolders({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(savedWidth);
  const [start, setStart] = useState<{ x: number; width: number } | null>(null);
  const maxWidth = () =>
    Math.max(MIN_FOLDERS_WIDTH, Math.round((box.current?.parentElement?.clientWidth ?? 0) / 2));
  const change = (next: number) => {
    const value = Math.max(MIN_FOLDERS_WIDTH, Math.min(maxWidth(), Math.round(next)));
    setWidth(value);
    try {
      localStorage.setItem(WIDTH_KEY, String(value));
    } catch {
      // Storage blocked: the width lasts until the page closes.
    }
  };
  const rtl = document.documentElement.dir === "rtl" ? -1 : 1;
  const onKeyDown = (event: KeyboardEvent<HTMLHRElement>) => {
    const keys: Record<string, number> = {
      ArrowRight: width + KEY_STEP * rtl,
      ArrowLeft: width - KEY_STEP * rtl,
      Home: MIN_FOLDERS_WIDTH,
      End: maxWidth(),
    };
    const next = keys[event.key];
    if (next === undefined) return;
    event.preventDefault();
    change(next);
  };
  return (
    <div
      ref={box}
      style={{ width, minWidth: MIN_FOLDERS_WIDTH, maxWidth: "50%" }}
      className="relative flex shrink-0 self-stretch"
    >
      {children}
      <hr
        tabIndex={0}
        aria-label={t`Resize folders`}
        aria-orientation="vertical"
        aria-valuemin={MIN_FOLDERS_WIDTH}
        aria-valuemax={maxWidth()}
        aria-valuenow={width}
        className="absolute inset-y-0 -end-1 z-10 m-0 h-full w-2 touch-none cursor-col-resize border-0 bg-transparent hover:bg-border focus-visible:bg-border focus-visible:outline-none"
        onPointerDown={(event: PointerEvent<HTMLHRElement>) => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          setStart({ x: event.clientX, width });
        }}
        onPointerMove={(event) => {
          if (start) change(start.width + (event.clientX - start.x) * rtl);
        }}
        onPointerUp={() => setStart(null)}
        onPointerCancel={() => setStart(null)}
        onDoubleClick={() => change(DEFAULT_FOLDERS_WIDTH)}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}
