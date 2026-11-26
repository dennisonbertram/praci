import { useEffect, useState } from "react";

/** Whether the media query matches now, and as it changes. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const list = window.matchMedia?.(query);
    if (!list) return;
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, [query]);
  return matches;
}

export type VisualViewportBox = { height: number; top: number };

/**
 * The visible area of the page. iOS Safari does not shrink the layout viewport for the software
 * keyboard, so a full-screen dialog sized to `dvh` slides under it; size it to this box instead.
 * Null while disabled or where the API is missing.
 */
export function useVisualViewport(enabled: boolean): VisualViewportBox | null {
  const [box, setBox] = useState<VisualViewportBox | null>(null);
  useEffect(() => {
    const vv = typeof window === "undefined" ? undefined : window.visualViewport;
    if (!enabled || !vv) {
      setBox(null);
      return;
    }
    const read = () => setBox({ height: vv.height, top: vv.offsetTop });
    read();
    vv.addEventListener("resize", read);
    vv.addEventListener("scroll", read);
    return () => {
      vv.removeEventListener("resize", read);
      vv.removeEventListener("scroll", read);
      setBox(null);
    };
  }, [enabled]);
  return box;
}

/** True on touch screens, where Return on the software keyboard should add a line. */
export function isCoarsePointer(): boolean {
  return (
    typeof window !== "undefined" && (window.matchMedia?.("(pointer: coarse)").matches ?? false)
  );
}

/**
 * When the software keyboard opens, pan the page so `el` ends above it. iOS Safari fires the
 * viewport resize after focus, so the check runs on that event (and once now for a late keyboard).
 */
export function revealAboveKeyboard(el: Element) {
  const vv = window.visualViewport;
  if (!vv) return;
  const reveal = () => {
    const overlap = el.getBoundingClientRect().bottom - (vv.offsetTop + vv.height);
    if (overlap > 0) window.scrollBy(0, overlap);
  };
  vv.addEventListener("resize", reveal, { once: true });
  window.setTimeout(() => vv.removeEventListener("resize", reveal), 1500);
  reveal();
}
