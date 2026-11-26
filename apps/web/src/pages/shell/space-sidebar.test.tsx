// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { openBotMenuFromKeyboard } from "./space-sidebar";

describe("openBotMenuFromKeyboard", () => {
  it.each(["ContextMenu", "F10"] as const)("opens the menu for %s", (key) => {
    const button = document.createElement("button");
    button.getBoundingClientRect = () => ({ left: 12, bottom: 34 }) as DOMRect;
    const anchor = { current: null as HTMLElement | null };
    const setBotMenu = vi.fn();
    const event = new KeyboardEvent("keydown", {
      key,
      shiftKey: key === "F10",
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, "currentTarget", { value: button });

    const opened = openBotMenuFromKeyboard(
      event as unknown as React.KeyboardEvent<HTMLButtonElement>,
      true,
      { kind: "bot", id: "bot_ada" },
      anchor,
      setBotMenu,
    );

    expect(opened).toBe(true);
    expect(event.defaultPrevented).toBe(true);
    expect(anchor.current).toBe(button);
    expect(setBotMenu).toHaveBeenCalledWith({
      kind: "bot",
      id: "bot_ada",
      position: { x: 12, y: 34 },
    });
  });

  it("leaves Enter for the row click handler", () => {
    const event = new KeyboardEvent("keydown", { key: "Enter", cancelable: true });
    expect(
      openBotMenuFromKeyboard(
        event as unknown as React.KeyboardEvent<HTMLButtonElement>,
        true,
        { kind: "bot", id: "bot_ada" },
        { current: null },
        vi.fn(),
      ),
    ).toBe(false);
    expect(event.defaultPrevented).toBe(false);
  });
});
