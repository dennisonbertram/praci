// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { isCoarsePointer, useVisualViewport } from "./visual-viewport";

afterEach(() => vi.unstubAllGlobals());

it("tracks the visual viewport while enabled", () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const vv = Object.assign(new EventTarget(), { height: 500, offsetTop: 40 });
  Object.defineProperty(window, "visualViewport", { value: vv, configurable: true });
  let seen: unknown;
  function Probe({ on }: { on: boolean }) {
    seen = useVisualViewport(on);
    return null;
  }
  const root = createRoot(document.createElement("div"));
  act(() => root.render(<Probe on />));
  expect(seen).toEqual({ height: 500, top: 40 });
  act(() => {
    vv.height = 300;
    vv.offsetTop = 0;
    vv.dispatchEvent(new Event("resize"));
  });
  expect(seen).toEqual({ height: 300, top: 0 });
  act(() => root.render(<Probe on={false} />));
  expect(seen).toBeNull();
  act(() => root.unmount());
});

it("detects coarse pointers", () => {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: q === "(pointer: coarse)" }));
  expect(isCoarsePointer()).toBe(true);
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  expect(isCoarsePointer()).toBe(false);
});
