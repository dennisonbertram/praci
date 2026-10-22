// @vitest-environment jsdom

import { act, useRef } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import {
  MIN_CHAT_WIDTH,
  PANEL_DOCKED_QUERY,
  SIDEBAR_DOCKED_QUERY,
  showHeaderWindowChrome,
  sidebarInert,
  sidebarRail,
  useDrawerFocus,
} from "./shell-layout";

describe("shell layout breakpoints", () => {
  it("docks the sidebar at Tailwind lg (1024px) and the panel at xl (1280px)", () => {
    expect(SIDEBAR_DOCKED_QUERY).toBe("(min-width: 1024px)");
    expect(PANEL_DOCKED_QUERY).toBe("(min-width: 1280px)");
  });

  it("leaves room for a readable chat beside the docked sidebar and panel", () => {
    const sidebar = 316;
    const minPanel = 320;
    expect(1280 - sidebar - minPanel).toBeGreaterThanOrEqual(MIN_CHAT_WIDTH);
  });
});

describe("window chrome and inert state", () => {
  it("shows header window controls whenever the sidebar header is not visible", () => {
    expect(showHeaderWindowChrome(false, true)).toBe(false);
    expect(showHeaderWindowChrome(true, true)).toBe(true);
    expect(showHeaderWindowChrome(false, false)).toBe(true);
    expect(showHeaderWindowChrome(true, false)).toBe(true);
  });

  it("keeps the rail interactive and makes the undocked sidebar inert unless the drawer is open", () => {
    expect(sidebarInert(true, false)).toBe(false);
    expect(sidebarInert(false, false)).toBe(true);
    expect(sidebarInert(false, true)).toBe(false);
  });

  it("shows the rail only when collapsed and docked", () => {
    expect(sidebarRail(true, true)).toBe(true);
    expect(sidebarRail(true, false)).toBe(false);
    expect(sidebarRail(false, true)).toBe(false);
  });
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("useDrawerFocus", () => {
  const close = vi.fn();
  function Harness({ open }: { open: boolean }) {
    const ref = useRef<HTMLElement>(null);
    useDrawerFocus(open, close, ref);
    return (
      <div>
        <button type="button" id="opener">
          menu
        </button>
        <aside ref={ref}>
          <button type="button" id="first">
            first
          </button>
          <button type="button" id="close" data-drawer-focus>
            close
          </button>
          <input readOnly id="search" />
        </aside>
      </div>
    );
  }

  it("focuses into the drawer, closes on Escape, and restores focus to the opener", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    act(() => root.render(<Harness open={false} />));
    container.querySelector<HTMLElement>("#opener")?.focus();
    act(() => root.render(<Harness open />));
    // The marked close button takes focus, not the first control or the search box.
    expect(document.activeElement?.id).toBe("close");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(close).toHaveBeenCalledTimes(1);
    act(() => root.render(<Harness open={false} />));
    expect(document.activeElement?.id).toBe("opener");
    act(() => root.unmount());
    container.remove();
  });
});
